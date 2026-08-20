import {
  Controller,
  Post,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from 'src/shared/database/Database.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Roles, ROLE } from 'src/auth/decorators/roles.decorator';

@Roles(ROLE.ADMIN, ROLE.SUPER_ADMIN)
@Controller({ path: 'admin/delivery-runs', version: '1' })
@UseGuards(JwtAuthGuard)
export class DeliveryRunsAdminController {
  constructor(private readonly db: DatabaseService) {}

  @Post()
  async createDeliveryRun(
    @Body()
    body: {
      branch_id: string;
      delivery_partner_id: string;
      run_date: string;
      slot: string;
      order_ids: string[];
    },
  ) {
    if (!body.branch_id) {
      throw new BadRequestException('branch_id is required');
    }
    if (!body.delivery_partner_id) {
      throw new BadRequestException('delivery_partner_id is required');
    }
    if (!body.run_date) {
      throw new BadRequestException('run_date is required');
    }
    if (!body.slot) {
      throw new BadRequestException('slot is required');
    }
    if (!body.order_ids || !Array.isArray(body.order_ids) || body.order_ids.length === 0) {
      throw new BadRequestException('order_ids must be a non-empty array');
    }

    // Generate RUN ID (RUN_YYYYMMDD_XXXXXX)
    const dateStr = body.run_date.replace(/-/g, '');
    const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    const runId = `RUN_${dateStr}_${randomSuffix}`.substring(0, 30);

    return this.db.transaction(async (client) => {
      // 1. Retrieve orders with customer and address details
      const ordersRes = await client.query(
        `SELECT
           o.order_id,
           o.address_id,
           o.contact_number,
           COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, '') AS customer_name,
           COALESCE(ca.flat_no, '') || ' ' || COALESCE(ca.building_name, '') || ' ' || COALESCE(ca.street, '') || ' ' || COALESCE(ca.area, '') AS customer_address,
           ca.latitude,
           ca.longitude
         FROM orders o
         JOIN customers c ON c.customer_id = o.customer_id
         LEFT JOIN customer_addresses ca ON (ca.address_id = o.address_id OR ca.id::text = o.address_id)
         WHERE o.order_id = ANY($1)`,
        [body.order_ids],
      );
      const orders = ordersRes.rows || [];

      if (orders.length === 0) {
        throw new BadRequestException('No valid orders found with the provided order_ids');
      }

      // 2. Insert into delivery_runs
      // `id` is an auto-incrementing integer — the generated identifier is the
      // varchar `run_id`. There is no route_json column; the stop list lives in
      // delivery_run_addresses.
      await client.query(
        `INSERT INTO delivery_runs (
           run_id, branch_id, delivery_partner_id, run_date, delivery_slot,
           status, total_addresses, created_at, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, 'pending', $6, NOW(), NOW())`,
        [runId, body.branch_id, body.delivery_partner_id, body.run_date, body.slot, orders.length],
      );

      // 3. Insert into delivery_run_addresses (one row per order in the run)
      let seq = 1;
      for (const order of orders) {
        await client.query(
          `INSERT INTO delivery_run_addresses (
             run_id, order_id, address_id, sequence_no, delivery_status,
             customer_name, address_line, contact_number, latitude, longitude,
             created_at, updated_at
           )
           VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, $8, $9, NOW(), NOW())`,
          [
            runId,
            order.order_id,
            order.address_id,
            seq++,
            order.customer_name,
            order.customer_address,
            order.contact_number || '',
            order.latitude ? Number(order.latitude) : null,
            order.longitude ? Number(order.longitude) : null,
          ],
        );
      }

      // 4. Update orders table with assignment
      await client.query(
        `UPDATE orders
         SET delivery_partner_id = $1,
             delivery_run_id = $2,
             status = 'assigned',
             updated_at = NOW()
         WHERE order_id = ANY($3)`,
        [body.delivery_partner_id, runId, body.order_ids],
      );

      // 5. Aggregate product quantities for delivery_dispatch_items
      const itemsRes = await client.query(
        `SELECT oi.variant_id as product_variant_id, COALESCE(SUM(oi.quantity), 0) as planned_qty, pv.unit_type as unit
         FROM order_items oi
         LEFT JOIN product_variants pv ON pv.variant_id = oi.variant_id
         WHERE oi.order_id = ANY($1)
         GROUP BY oi.variant_id, pv.unit_type`,
        [body.order_ids],
      );
      const items = itemsRes.rows || [];

      const dispatchId = `DIS_${Date.now().toString(36).toUpperCase()}`;
      for (const item of items) {
        await client.query(
          `INSERT INTO delivery_dispatch_items (
             dispatch_id, delivery_run_id, product_variant_id, planned_qty, loaded_qty, unit, created_at, updated_at
           ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
          [
            dispatchId,
            runId,
            item.product_variant_id,
            Number(item.planned_qty),
            Number(item.planned_qty), // Default loaded_qty to planned_qty
            item.unit || 'PCS',
          ],
        );
      }

      return {
        success: true,
        message: 'Delivery run created successfully',
        run_id: runId,
        stops: seq - 1,
        orders_assigned: orders.length,
      };
    });
  }
}
