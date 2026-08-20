import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import { NotificationService } from './notification.service';
import { DatabaseService } from '../shared/database/Database.service';
import { RedisService } from '../redis/redis.service';
import * as jwt from 'jsonwebtoken';
import { RoleResolverService } from 'src/auth/role-resolver.service';

interface NotificationPayload {
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
  timestamp: string;
  notification_id?: string;
  title?: string;
  html?: string;
  image?: string;
}

@WebSocketGateway({
  path: '/socket.io',
  cors: {
    origin: [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:8085',
      'http://127.0.0.1:8085',
      'https://f2hfresh.com',
      'https://www.f2hfresh.com',
    ],
    credentials: true,
  },
  transports: ['websocket'],
  allowEIO3: true,
})
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationGateway.name);
  private userSockets = new Map<string, Set<string>>();

  constructor(
    private configService: ConfigService,
    private notificationService: NotificationService,
    private databaseService: DatabaseService,
    private readonly roleResolver: RoleResolverService,
    private redisService: RedisService,
  ) {}

  afterInit(server: Server) {
    this.notificationService.setGateway(this);
    this.logger.log('Socket gateway initialized');
  }

  getOnlineUsersExcept(excludeUserId?: string): string[] {
    const users = Array.from(this.userSockets.keys());
    return excludeUserId ? users.filter((id) => id !== excludeUserId) : users;
  }

  isUserOnline(userId: string): boolean {
    const sockets = this.userSockets.get(userId);
    return !!sockets && sockets.size > 0;
  }

  private getUserRoom(userId: string): string {
    return `user:${userId}`;
  }

  sendToUsers(userIds: string[], payload: NotificationPayload): void {
    let sentCount = 0;

    for (const userId of userIds) {
      if (!this.isUserOnline(userId)) continue;
      this.server.to(this.getUserRoom(userId)).emit('notification', payload);
      sentCount += 1;
    }

    this.logger.log(`Notification delivered to ${sentCount} user room(s)`);
  }

  broadcastExcept(excludeUserId: string, payload: NotificationPayload): void {
    const recipients = this.getOnlineUsersExcept(excludeUserId);
    this.sendToUsers(recipients, payload);
  }

  /**
   * Broadcast real-time GPS position of a delivery partner to all admin
   * clients that have joined the 'admin_tracking' room.
   * Called from LocationController after every location update.
   */
  emitPartnerLocation(payload: {
    partnerId: string;
    partnerName?: string;
    lat: number;
    lng: number;
    battery?: number;
    speed?: number;
    timestamp: string;
    activeRunId?: string;
    currentStop?: string;
    remainingStops?: number;
  }): void {
    this.server.to('admin_tracking').emit('partner_location_update', payload);
  }

  /**
   * Broadcast newly created order to all admin clients listening in admin_live_orders room
   */
  emitOrderCreated(orderPayload: any): void {
    if (!this.server) return;
    this.server.to('admin_live_orders').emit('order_created', orderPayload);
    this.logger.log(`[LiveOrders] Broadcasted order_created for order ${orderPayload?.order_id}`);
  }

  /**
   * Broadcast order status change or delivery assignment to admin_live_orders room
   */
  emitOrderStatusChanged(payload: {
    order_id: string;
    status?: string;
    delivery_partner_id?: string;
    partner_name?: string;
    partner_phone?: string;
    assignment_method?: string;
    assigned_at?: string;
    updated_at?: string;
  }): void {
    if (!this.server) return;
    this.server.to('admin_live_orders').emit('order_status_changed', payload);
    this.logger.log(`[LiveOrders] Broadcasted order_status_changed for order ${payload?.order_id}`);
  }

  disconnectUserSockets(userId: string): number {
    const socketIds = this.userSockets.get(userId);
    if (!socketIds || socketIds.size === 0) {
      return 0;
    }

    let disconnectedCount = 0;
    for (const socketId of [...socketIds]) {
      const socket = this.server.sockets.sockets.get(socketId);
      if (socket) {
        socket.disconnect(true);
        disconnectedCount += 1;
      }
    }

    this.userSockets.delete(userId);
    this.logger.log(
      `Force-disconnected ${disconnectedCount} socket(s) for user ${userId}`,
    );

    return disconnectedCount;
  }

  private async getUserIdFromToken(client: Socket): Promise<string | null> {
    // ─── WS Ticket path (secure, no JS-readable cookie) ───────────────────────
    const ticket = client.handshake.auth?.ticket;
    if (ticket) {
      const ticketData = await this.redisService.fetch<any>(
        `ws_ticket_${ticket}`,
      );
      if (!ticketData) {
        this.logger.warn(
          `[Socket:${client.id}] ❌ Invalid or expired WS ticket`,
        );
        client.disconnect(true);
        return null;
      }
      // One-time use — delete immediately after reading
      await this.redisService.forget(`ws_ticket_${ticket}`);

      const { userId } =
        typeof ticketData === 'string' ? JSON.parse(ticketData) : ticketData;

      // Still verify the session key exists (catches force-logout after ticket was issued)
      const sessionData = await this.redisService.fetch(
        `f2h_user_jwt_${userId}`,
      );
      if (!sessionData) {
        this.logger.warn(
          `[Socket:${client.id}] ❌ WS ticket valid but session revoked for user ${userId}`,
        );
        client.disconnect(true);
        return null;
      }

      return String(userId);
    }

    // ─── JWT fallback path (Bearer header / handshake.auth.token / cookie) ────
    let token: string | null = null;

    const auth = client.handshake.headers.authorization;
    if (auth?.startsWith('Bearer ')) {
      token = auth.substring(7);
    }

    if (!token && client.handshake.auth?.token) {
      token = client.handshake.auth.token;
    }

    if (!token) {
      const cookie = client.handshake.headers.cookie;
      if (cookie) {
        const match = cookie.match(/access_token=([^;]+)/);
        if (match) token = match[1];
      }
    }

    if (!token) {
      this.logger.warn(
        `[Socket:${client.id}] ❌ NO TOKEN - Authorization: ${auth ? 'present' : 'missing'}, Cookie: ${client.handshake.headers.cookie ? 'present' : 'missing'}`,
      );
      return null;
    }

    try {
      const secret = this.configService.get('JWT_SECRET');

      const decoded = jwt.verify(token, secret) as any;
      // FIXED: Also check for user_id (snake_case) - this is what the JWT actually uses!
      const userId =
        decoded.sub || decoded.id || decoded.userId || decoded.user_id || null;

      if (!userId) {
        this.logger.warn(
          `[Socket:${client.id}] ❌ No userId in JWT - decoded keys: ${Object.keys(decoded).join(', ')}`,
        );
        return null;
      }

      // 🔐 CRITICAL: Check if JTI is revoked (user logged out from all devices)
      const userIdStr = String(userId);
      const userPrefix = `f2h_user_jwt_${userIdStr}`;
      this.logger.log(`[Socket:${client.id}] 🔍 Checking Redis: ${userPrefix}`);

      const jtiData = await this.redisService.fetch(userPrefix);
      this.logger.log(
        `[Socket:${client.id}]   Redis result: ${jtiData ? 'FOUND' : 'NOT FOUND'}`,
      );

      if (!jtiData) {
        // 🔌 No JTI data = user has logged out (tokens revoked)
        this.logger.warn(
          `[Socket:${client.id}] ❌ JTI revoked - disconnecting user ${userIdStr}`,
        );
        client.disconnect(true);
        return null;
      }

      // Additional check: Verify this specific JTI exists in the stored sessions
      const jti = decoded.jti;
      if (jti) {
        try {
          const parsed =
            typeof jtiData === 'string' ? JSON.parse(jtiData) : jtiData;

          // FIXED: Look for JTI in paired sessions structure
          // accessJti may be null (expired access token) — skip null entries
          const sessions = parsed.sessions || [];
          const sessionExists = sessions.some(
            (session: any) =>
              (session.accessJti !== null && session.accessJti === jti) ||
              session.refreshJti === jti,
          );

          this.logger.log(
            `[Socket:${client.id}]   JTI check: looking for ${jti.substring(0, 8)}... in ${sessions.length} active sessions`,
          );

          if (!sessionExists) {
            // JTI not in current sessions = token is old/revoked
            this.logger.warn(
              `[Socket:${client.id}] ❌ JTI not in active sessions - disconnecting user ${userIdStr}`,
            );
            client.disconnect(true);
            return null;
          }
        } catch (parseErr) {
          this.logger.error(
            `[Socket:${client.id}] ❌ Error parsing session data:`,
            parseErr,
          );
          client.disconnect(true);
          return null;
        }
      }

      return userIdStr;
    } catch (err) {
      this.logger.warn(
        `[Socket:${client.id}] ❌ JWT verification FAILED: ${(err as Error).message}`,
      );
      return null;
    }
  }

  private async getDisplayNameByUserId(userId: string): Promise<string> {
    try {
      // users is keyed by the varchar user_id; there is no numeric id column.
      const rows = await this.databaseService.query<any>(
        `SELECT COALESCE(NULLIF(user_name, ''), TRIM(CONCAT_WS(' ', first_name, last_name))) AS display_name
         FROM users
         WHERE user_id = ?
         LIMIT 1`,
        [userId],
      );

      const displayName = rows?.[0]?.display_name;
      if (displayName && String(displayName).trim()) {
        return String(displayName).trim();
      }

      return userId;
    } catch (error) {
      this.logger.warn(
        `Username lookup failed for ${userId}: ${(error as Error).message}`,
      );
      return userId;
    }
  }

  async handleConnection(client: Socket) {
    const userId = await this.getUserIdFromToken(client);
    if (!userId) {
      client.disconnect();
      return;
    }

    (client as any).userId = userId;

    // Allow multiple sockets per user (multiple browsers/devices share user room)
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(client.id);
    client.join(this.getUserRoom(userId));

    // The admin rooms carry live GPS for every delivery partner and the whole order
    // book. They used to be self-join: any authenticated customer could emit
    // 'join_admin_tracking' and receive staff location telemetry continuously.
    // Membership is now decided here, from the role the database reports.
    const roles = await this.roleResolver.resolveRoles(userId);
    (client as any).roles = roles;

    if (roles.includes('ADMIN') || roles.includes('SUPER_ADMIN')) {
      client.join('admin_tracking');
      client.join('admin_live_orders');
      this.logger.log(`Admin ${userId} (${client.id}) joined the admin rooms`);
    }

    const socketCount = this.userSockets.get(userId)!.size;
    this.logger.log(
      `Connected: ${userId} (${client.id}) - Total sockets for user: ${socketCount}`,
    );
  }

  /**
   * Check if user has any active sessions in Redis.
   * If no sessions exist, disconnect all sockets for that user.
   * Called after logout to clean up sockets when all sessions are gone.
   */
  async checkAndDisconnectIfNoSessions(userId: string): Promise<void> {
    try {
      // FIXED: Use the same Redis key format as auth.service.ts
      const redisKey = `f2h_user_jwt_${userId}`;
      const data = await this.redisService.fetch<any>(redisKey);

      if (!data) {
        // No sessions at all - disconnect user's sockets
        this.logger.log(
          `[CheckSessions] User ${userId} has no session data - disconnecting sockets`,
        );
        this.disconnectUserSockets(userId);
        return;
      }

      // Handle both string and object responses from Redis
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      const sessions = parsed?.sessions || [];

      if (sessions.length === 0) {
        // Empty sessions array - disconnect user's sockets
        this.logger.log(
          `[CheckSessions] User ${userId} has 0 active sessions - disconnecting sockets`,
        );
        this.disconnectUserSockets(userId);
      } else {
        this.logger.log(
          `[CheckSessions] User ${userId} still has ${sessions.length} active session(s) - keeping sockets alive`,
        );
      }
    } catch (err) {
      this.logger.error(
        `[CheckSessions] Error checking sessions for ${userId}: ${(err as Error).message}`,
      );
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = (client as any).userId as string | undefined;
    if (!userId) return;

    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.delete(client.id);
      if (sockets.size === 0) {
        this.userSockets.delete(userId);
      }
    }

    this.logger.log(`Disconnected: ${userId} (${client.id})`);
  }
}
