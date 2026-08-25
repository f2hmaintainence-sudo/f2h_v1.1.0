import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { RedisService } from 'src/shared/redis/redis.service';
import { DatabaseService } from 'src/shared/database/Database.service';
import { NotificationGateway } from 'src/notifications/notification.gateway';
import { FieldEncryptionService } from 'src/encryption/field-encryption.service';
import { PushNotificationService } from 'src/shared/pushNotifications/pushNotification.service';
import { Roles, ROLE } from 'src/auth/decorators/roles.decorator';

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

@Roles(ROLE.DELIVERY_PARTNER, ROLE.ADMIN, ROLE.SUPER_ADMIN)
@Controller({ path: 'delivery-partner/location', version: '1' })
export class LocationController {
  constructor(
    private readonly redisService: RedisService,
    private readonly db: DatabaseService,
    private readonly fieldEncryption: FieldEncryptionService,
    private readonly notificationGateway: NotificationGateway,
    private readonly pushNotificationService: PushNotificationService,
  ) { }

  @Post('update')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  async updateLocation(
    @Req() req: Request,
    @Body() body: { latitude: number; longitude: number; battery?: number; speed?: number },
  ) {
    const userObj = req.user as any;
    const userId = userObj?.user_id;

    if (!body.latitude || !body.longitude) {
      return { status: false, message: 'Latitude and longitude are required' };
    }

    // Fetch previous cached location to throttle DB writes
    const redisKey = `delivery_partner_location:${userId}`;
    const prevLocation: any = await this.redisService.fetch(redisKey);

    let shouldLogToDb = true;
    if (prevLocation) {
      const latDiff = Math.abs(Number(prevLocation.latitude) - Number(body.latitude));
      const lngDiff = Math.abs(Number(prevLocation.longitude) - Number(body.longitude));
      const locationChanged = latDiff > 0.0001 || lngDiff > 0.0001; // roughly 10 meters

      const lastDbLog = prevLocation.lastDbLogTime ? new Date(prevLocation.lastDbLogTime) : null;

      if (lastDbLog) {
        const timeDiffMinutes = (new Date().getTime() - lastDbLog.getTime()) / (1000 * 60);
        if (locationChanged) {
          if (timeDiffMinutes < 2) {
            shouldLogToDb = false;
          }
        } else {
          if (timeDiffMinutes < 5) {
            shouldLogToDb = false;
          }
        }
      }
    }

    // Append debug info to a file we can inspect
    try {
      const fs = require('fs');
      const logMsg = `[${new Date().toISOString()}] userId: ${userId}, lat: ${body.latitude}, lng: ${body.longitude}, shouldLogToDb: ${shouldLogToDb}\n`;
      fs.appendFileSync('location_debug.log', logMsg);
    } catch {
      // Deliberately tolerated: the caller has a valid fallback for this failure.
    }

    // 1. Log to database asynchronously if movement threshold is met
    if (shouldLogToDb) {
      (async () => {
        try {
          // Update recent coordinates on delivery_partners table
          await this.db.query(
            `UPDATE delivery_partners
             SET current_lat = $1,
                 current_lng = $2,
                 last_location_at = NOW(),
                 is_online = true,
                 duty_status = 'on_duty',
                 updated_at = NOW()
             WHERE delivery_partner_id = $3`,
            [Number(body.latitude), Number(body.longitude), userId]
          );

          const insertHistoryQuery = `
            INSERT INTO delivery_location_logs (user_id, latitude, longitude, speed, battery, recorded_at)
            VALUES ($1, $2, $3, $4, $5, NOW())`;
          await this.db.query(insertHistoryQuery, [
            userId,
            Number(body.latitude),
            Number(body.longitude),
            body.speed !== undefined ? Number(body.speed) : 0,
            body.battery !== undefined ? Number(body.battery) : 100,
          ]);
        } catch (err) {
          console.error('[LocationUpdate] Failed to log location history to database:', err);
        }

        // Check distance to next delivery for arriving-soon push notification
        try {
          const nextOrderRes = await this.db.query(`
            SELECT 
              o.order_id, 
              o.customer_id, 
              o.is_arriving_notified,
              ca.latitude AS address_lat, 
              ca.longitude AS address_lng
            FROM orders o
            JOIN customers c ON c.customer_id = o.customer_id
            LEFT JOIN customer_addresses ca ON (ca.address_id = o.address_id OR ca.id::text = o.address_id)
            WHERE o.delivery_partner_id = $1
              AND o.scheduled_date = CURRENT_DATE
              AND o.status IN ('pending', 'out_for_delivery')
            ORDER BY o.run_sequence ASC NULLS LAST, o.created_at ASC
            LIMIT 1
          `, [userId]);

          if (nextOrderRes && nextOrderRes.length > 0) {
            const nextOrder = nextOrderRes[0];
            if (!nextOrder.is_arriving_notified && nextOrder.address_lat && nextOrder.address_lng) {
              const dist = getDistanceKm(
                Number(body.latitude), 
                Number(body.longitude), 
                Number(nextOrder.address_lat), 
                Number(nextOrder.address_lng)
              );
              if (dist <= 1.0) { // 1 km threshold
                await this.pushNotificationService.sendNotificationToUsers(
                  [nextOrder.customer_id],
                  {
                    title: 'Your Delivery Partner is Arriving Soon!',
                    body: 'Your F2H Fresh order is less than 1km away.',
                  }
                );
                await this.db.query(
                  `UPDATE orders SET is_arriving_notified = true WHERE order_id = $1`,
                  [nextOrder.order_id]
                );
              }
            }
          }
        } catch (err) {
          console.error('[LocationUpdate] Failed to process arriving soon notification:', err);
        }
      })();
    }

    // Preserve the SOS status on subsequent updates until explicitly cleared
    const status = prevLocation?.status === 'SOS' ? 'SOS' : 'Delivering';

    // Save location to Redis (TTL 1 hour)
    const locationData = {
      userId,
      latitude: Number(body.latitude),
      longitude: Number(body.longitude),
      battery: body.battery !== undefined ? Number(body.battery) : 100,
      speed: body.speed !== undefined ? Number(body.speed) : 0,
      status,
      updatedAt: new Date().toISOString(),
      lastDbLogTime: shouldLogToDb ? new Date().toISOString() : (prevLocation?.lastDbLogTime || new Date().toISOString()),
    };
    await this.redisService.put(redisKey, locationData, 3600);

    // Broadcast GPS position to admin tracking room via targeted room emit
    try {
      this.notificationGateway.emitPartnerLocation({
        partnerId: userId,
        lat: Number(body.latitude),
        lng: Number(body.longitude),
        battery: body.battery !== undefined ? Number(body.battery) : undefined,
        speed: body.speed !== undefined ? Number(body.speed) : undefined,
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      // Gateway not ready — ignore silently
    }

    return {
      status: true,
      message: 'Location updated and broadcasted successfully',
    };
  }

  @Post('sos')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  async triggerSos(
    @Req() req: Request,
    @Body() body: { latitude?: number; longitude?: number },
  ) {
    const userObj = req.user as any;
    const userId = userObj?.user_id;

    // Fetch previous location for fallback coordinates
    const redisKey = `delivery_partner_location:${userId}`;
    const prevLocation: any = await this.redisService.fetch(redisKey);

    const latitude = body.latitude !== undefined ? Number(body.latitude) : (prevLocation ? Number(prevLocation.latitude) : 0);
    const longitude = body.longitude !== undefined ? Number(body.longitude) : (prevLocation ? Number(prevLocation.longitude) : 0);

    const locationData = {
      userId,
      latitude,
      longitude,
      battery: prevLocation?.battery || 100,
      speed: 0,
      status: 'SOS',
      updatedAt: new Date().toISOString(),
      lastDbLogTime: prevLocation?.lastDbLogTime || new Date().toISOString(),
    };

    // Update Redis cache with SOS status (TTL 1 hour)
    await this.redisService.put(redisKey, locationData, 3600);    // Write SOS entry to database logs immediately for emergency audit trail
    this.db.query(`SELECT delivery_partner_id FROM delivery_partners WHERE delivery_partner_id = $1`, [userId])
      .then(async (boyRows) => {
        if (boyRows && boyRows.length > 0) {
          const deliveryPartnerId = boyRows[0].delivery_partner_id;
          try {
            await this.db.query(
              `UPDATE delivery_partners SET current_lat = $1, current_lng = $2, last_location_at = NOW(), updated_at = NOW() WHERE delivery_partner_id = $3`,
              [latitude, longitude, deliveryPartnerId]
            );
            await this.db.query(
              `INSERT INTO delivery_location_logs (user_id, latitude, longitude, recorded_at)
               VALUES ($1, $2, $3, NOW())`,
              [deliveryPartnerId, latitude, longitude]
            );
          } catch (err) {
            console.error('Failed to log SOS location to database:', err);
          }
        }
      })
      .catch((err) => {
        console.error('Failed to fetch delivery boy ID for SOS logging:', err);
      });

    // Broadcast SOS alert strictly to admin clients in admin_tracking room
    if (this.notificationGateway && this.notificationGateway.server) {
      this.notificationGateway.server.to('admin_tracking').emit('delivery_sos_alert', {
        userId,
        latitude,
        longitude,
        speed: 0,
        battery: prevLocation?.battery || 100,
        status: 'SOS',
        timestamp: new Date().toISOString(),
      });
    }

    return {
      status: true,
      message: 'SOS alert broadcasted to dispatch team successfully',
      data: locationData,
    };
  }

  @Post('clear-sos')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  async clearSos(@Req() req: Request) {
    const userObj = req.user as any;
    const userId = userObj?.user_id;

    const redisKey = `delivery_partner_location:${userId}`;
    const prevLocation: any = await this.redisService.fetch(redisKey);

    if (prevLocation) {
      prevLocation.status = 'Delivering';
      await this.redisService.put(redisKey, prevLocation, 3600);

      // Broadcast the status resolution
      if (this.notificationGateway && this.notificationGateway.server) {
        this.notificationGateway.server.emit('delivery_location_update', {
          userId,
          latitude: Number(prevLocation.latitude),
          longitude: Number(prevLocation.longitude),
          battery: prevLocation.battery || 100,
          speed: prevLocation.speed || 0,
          status: 'Delivering',
          timestamp: new Date().toISOString(),
        });
      }
    }

    return {
      status: true,
      message: 'SOS status cleared successfully',
    };
  }

  @Get('active')
  @UseGuards(AuthGuard('jwt'))
  async getActiveLocations() {
    const query = `
      SELECT dp.delivery_partner_id,
             dp.delivery_partner_id AS id,
             dp.delivery_partner_id AS user_id,
             COALESCE(NULLIF(TRIM(u.first_name || ' ' || COALESCE(u.last_name, '')), ''), u.user_name, 'Delivery Partner') AS full_name,
             u.phone,
             dp.vehicle_type,
             dp.is_active,
             dp.is_online
      FROM delivery_partners dp
      LEFT JOIN users u ON u.user_id = dp.delivery_partner_id
      WHERE dp.is_active = true
    `;
    const rows = await this.db.query(query);

    // Map each driver with their Redis location
    const activeDrivers: any[] = [];
    for (const driver of rows || []) {
      const redisKey = `delivery_partner_location:${driver.user_id}`;
      const location: any = await this.redisService.fetch(redisKey);

      // Fetch today's orders and routes
      let orders: any[] = [];
      try {
        orders = await this.db.query(
          `SELECT 
             o.order_id, 
             o.status, 
             o.delivery_slot, 
             o.delivery_run_id::text AS route_id, 
             COALESCE(o.delivery_run_id::text, 'Run') AS route_name,
             COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, '') AS customer_name
           FROM orders o
           JOIN customers c ON c.customer_id = o.customer_id
           WHERE o.delivery_partner_id = $1 AND o.scheduled_date = CURRENT_DATE`,
          [driver.delivery_partner_id]
        );
      } catch (e) {
        console.error('Error fetching driver orders:', e);
      }

      const routeGroups: Record<string, { routeName: string, total: number, delivered: number, pending: number, orders: any[] }> = {};
      for (const order of orders || []) {
        const routeId = order.route_id || 'unassigned';
        const routeName = order.route_name || 'Unassigned Route';
        if (!routeGroups[routeId]) {
          routeGroups[routeId] = {
            routeName,
            total: 0,
            delivered: 0,
            pending: 0,
            orders: []
          };
        }
        routeGroups[routeId].total += 1;
        if (order.status === 'delivered') {
          routeGroups[routeId].delivered += 1;
        } else {
          routeGroups[routeId].pending += 1;
        }
        routeGroups[routeId].orders.push({
          orderId: order.order_id,
          customerName: order.customer_name,
          status: order.status,
          slot: order.delivery_slot
        });
      }

      const routesArray = Object.keys(routeGroups).map(id => ({
        id,
        ...routeGroups[id]
      }));

      const totalOrders = orders ? orders.length : 0;
      const deliveredOrders = orders ? orders.filter(o => o.status === 'delivered').length : 0;
      const pendingOrders = totalOrders - deliveredOrders;

      if (location) {
        activeDrivers.push({
          id: driver.id,
          userId: driver.user_id,
          name: driver.full_name,
          phone: driver.phone,
          vehicle: driver.vehicle_type || 'bike',
          status: location.status || 'Delivering', // Mark as active/delivering if they are sending location updates
          battery: location.battery !== undefined && location.battery !== null ? Number(location.battery) : 100,
          speed: location.speed !== undefined && location.speed !== null ? Number(location.speed) : 0,
          currentCoords: [Number(location.latitude), Number(location.longitude)],
          route: [],
          currentRouteIndex: 0,
          updatedAt: location.updatedAt || new Date().toISOString(),
          totalOrders,
          deliveredOrders,
          pendingOrders,
          routes: routesArray
        });
      } else {
        // Fetch last known location from database logs
        try {
          const lastLog = await this.db.query(
            `SELECT latitude, longitude, recorded_at 
             FROM delivery_location_logs 
             WHERE delivery_partner_id = $1 
             ORDER BY recorded_at DESC 
             LIMIT 1`,
            [driver.id]
          );
          if (lastLog && lastLog.length > 0) {
            activeDrivers.push({
              id: driver.id,
              userId: driver.user_id,
              name: driver.full_name,
              phone: driver.phone,
              vehicle: driver.vehicle_type || 'bike',
              status: 'Offline',
              battery: 0,
              speed: 0,
              currentCoords: [Number(lastLog[0].latitude), Number(lastLog[0].longitude)],
              route: [],
              currentRouteIndex: 0,
              lastSeenAt: lastLog[0].recorded_at,
              updatedAt: lastLog[0].recorded_at,
              totalOrders,
              deliveredOrders,
              pendingOrders,
              routes: routesArray
            });
          }
        } catch (err) {
          console.error(`Failed to fetch last known location for driver ${driver.id}:`, err);
        }
      }
    }

    return {
      status: true,
      data: activeDrivers,
    };
  }
}
