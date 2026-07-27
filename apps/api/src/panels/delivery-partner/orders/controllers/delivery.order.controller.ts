import {
  Controller,
  Get,
  Param,
  Patch,
  Body,
  UseGuards,
  Request,
  Query,
  HttpCode,
  HttpStatus,
  NotFoundException,
  ForbiddenException,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { DatabaseService } from '../../../../shared/database/Database.service';
import { PushNotificationService } from '../../../../shared/pushNotifications/pushNotification.service';
import { DeveloperService } from '../../../../shared/logger/Developer.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';

import { FirstOrderDetectorService } from '../../../customer/referral/services/first-order-detector.service';
import { ReferralRewardEngineService } from '../../../customer/referral/services/referral-reward-engine.service';

@Controller({ path: 'delivery/orders', version: '1' })
@UseGuards(JwtAuthGuard)
export class DeliveryOrderController {
  constructor(
    private readonly db: DatabaseService,
    private readonly pushNotificationService: PushNotificationService,
    private readonly developer: DeveloperService,
    private readonly firstOrderDetector: FirstOrderDetectorService,
    private readonly referralRewardEngine: ReferralRewardEngineService,
  ) { }

  private cleanDeliveryImagePath(imageUrl: string | null | undefined): string | null {
    if (!imageUrl) return null;
    const idx = imageUrl.indexOf('/uploads/');
    if (idx !== -1) {
      return imageUrl.substring(idx);
    }
    return imageUrl;
  }

  private mapDeliveryImage(imagePath: string | null): string | null {
    if (!imagePath) return null;
    if (imagePath.startsWith('http')) return imagePath;
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    const cleaned = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
    return `${backendUrl}${cleaned}`;
  }

  private async resolveDeliveryPartner(userId: string) {
    const boyRes = await this.db.query(
      `SELECT id, user_id, full_name, branch_id FROM delivery_partners WHERE user_id = $1 OR delivery_partner_id = $1 LIMIT 1`,
      [userId],
    );
    if (!boyRes?.length) {
      throw new NotFoundException('Delivery boy profile not found for this account');
    }
    return boyRes[0];
  }

  private async buildDeliveryResponses(orders: any[]) {
    const orderIds = orders.map((o: any) => o.order_id);

    const items = await this.db.query(
      `SELECT
         oi.order_id,
         oi.quantity,
         oi.final_price,
         pv.name AS product_name,
         pv.unit_value,
         pv.unit_type,
         COALESCE(pt.is_returnable, p.is_returnable, false) AS is_returnable
       FROM order_items oi
       JOIN product_variants pv ON pv.variant_id = oi.variant_id
       JOIN products p ON p.product_id = pv.product_id
       LEFT JOIN packaging_types pt ON pt.id = pv.packaging_type_id
       WHERE oi.order_id = ANY($1)`,
      [orderIds],
    );

    const itemsByOrder: Record<string, any[]> = {};
    const expectedBottlesByOrder: Record<string, number> = {};
    for (const item of items || []) {
      const key = String(item.order_id);
      if (!itemsByOrder[key]) itemsByOrder[key] = [];
      itemsByOrder[key].push({
        product_name: item.product_name,
        quantity: Number(item.quantity),
        unit: `${item.unit_value}${item.unit_type}`,
        price: Number(item.final_price),
      });

      if (item.is_returnable) {
        expectedBottlesByOrder[key] = (expectedBottlesByOrder[key] || 0) + Number(item.quantity);
      }
    }

    const collectedRes = await this.db.query(
      `SELECT reference_id AS order_id, COALESCE(SUM(quantity), 0) AS collected
       FROM container_transactions
       WHERE reference_type = 'order'
         AND reference_id = ANY($1)
         AND transaction_type = 'return'
       GROUP BY reference_id`,
      [orderIds],
    );

    const collectedBottlesByOrder: Record<string, number> = {};
    for (const row of collectedRes || []) {
      collectedBottlesByOrder[String(row.order_id)] = Number(row.collected);
    }

    const customerIds = [...new Set(orders.map((o: any) => o.customer_id))];
    const bottlesWithCustomerByCustomer: Record<string, number> = {};
    if (customerIds.length > 0) {
      const balanceRes = await this.db.query(
        `SELECT customer_id, 
                COALESCE(SUM(issued_quantity - returned_quantity - damaged_quantity - lost_quantity), 0) AS balance
         FROM customer_container_balances
         WHERE customer_id = ANY($1)
         GROUP BY customer_id`,
        [customerIds],
      );
      for (const row of balanceRes || []) {
        bottlesWithCustomerByCustomer[String(row.customer_id)] = Number(row.balance);
      }
    }

    return orders.map((o: any, idx: number) => ({
      stop: o.sequence_number ?? o.sequence_no ?? idx + 1,
      order_id: o.order_id,
      subscription_id: o.subscription_id,
      order_type: o.order_type,
      customer_id: o.customer_id,
      customer_name: o.customer_name,
      customer_phone: o.customer_phone,
      address_id: o.address_id,
      address: o.customer_address,
      address_lat: Number(o.address_lat),
      address_lng: Number(o.address_lng),
      zone_id: o.zone_id,
      route_id: o.route_id,
      route_name: o.route_name,
      branch_id: o.branch_id,
      delivery_slot: o.delivery_slot,
      scheduled_date: o.scheduled_date,
      status: o.status,
      subtotal: Number(o.subtotal),
      discount_amount: Number(o.discount_amount),
      gst_amount: Number(o.gst_amount),
      payment_mode: o.payment_mode,
      payment_status: o.payment_status,
      is_cod: o.payment_mode === 'cod',
      cod_amount: o.payment_mode === 'cod' ? Number(o.total_amount) : null,
      total_amount: Number(o.total_amount),
      delivery_partner_id: o.delivery_partner_id,
      delivery_session_id: o.delivery_session_id ?? o.run_id ?? null,
      run_id: o.run_id ?? null,
      special_instructions: o.special_instructions,
      invoice_image: o.invoice_image,
      delivery_image: this.mapDeliveryImage(o.delivery_image),
      payment_screenshot: o.payment_screenshot,
      created_at: o.created_at,
      updated_at: o.updated_at,
      empty_bottles_expected: expectedBottlesByOrder[String(o.order_id)] || 0,
      empty_bottles_collected: collectedBottlesByOrder[String(o.order_id)] || 0,
      bottles_with_customer: bottlesWithCustomerByCustomer[String(o.customer_id)] || 0,
      products: itemsByOrder[String(o.order_id)] || [],
    }));
  }

  private getRunIdentifiers(run: any): string[] {
    const ids = [String(run.id)];
    if (run.run_id && String(run.run_id) !== String(run.id)) {
      ids.push(String(run.run_id));
    }
    return ids;
  }

  // Runs can be referenced elsewhere in the schema by either their numeric `id`
  // or their separate `run_id` column. Given either form, resolve the canonical
  // run row plus both identifier forms so every downstream query stays in sync.
  private async resolveRunByIdentifier(identifier: string | number | null | undefined) {
    if (!identifier) return null;
    const idStr = String(identifier);
    const runRes = await this.db.query(
      `SELECT id, run_id, status, delivery_slot AS slot, run_date, branch_id
       FROM delivery_runs
       WHERE id::text = $1 OR run_id::text = $1
       LIMIT 1`,
      [idStr],
    );
    if (!runRes?.length) return null;
    const run = runRes[0];
    return { run, ids: this.getRunIdentifiers(run) };
  }



  private async findDeliveryRunByIdAndBoy(runId: string, boy: any) {
    const runRes = await this.db.query(
      `SELECT id, run_id, status, delivery_slot AS slot, run_date, branch_id FROM delivery_runs
       WHERE delivery_partner_id = $1
         AND (id::text = $2::text OR run_id::text = $2::text)
       LIMIT 1`,
      [String(boy.user_id), runId],
    );
    if (!runRes?.length) {
      throw new NotFoundException('Delivery run not found');
    }
    return runRes[0];
  }

  // ─── Shared Helpers ─────────────────────────────────────────────

  private getKolkataDateAndSlot(dateParam?: string): { targetDate: string; targetSlot: string } {
    const kolkataDateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const targetDate = dateParam || kolkataDateStr;

    const timeParts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    }).formatToParts(new Date());
    const h = parseInt(timeParts.find((p) => p.type === 'hour')?.value || '0', 10);
    const m = parseInt(timeParts.find((p) => p.type === 'minute')?.value || '0', 10);
    const targetSlot = h < 13 || (h === 13 && m < 30) ? 'morning' : 'evening';

    return { targetDate, targetSlot };
  }

  private normalizeDeliveryBody(body: any) {
    return {
      paymentMode: (body.payment_mode || body.paymentMode || null) as string | null,
      paymentStatus: (body.payment_status || body.paymentStatus || null) as string | null,
      deliveryImage: this.cleanDeliveryImagePath(body.delivery_image || body.deliveryImage),
      bottles: (body.empty_bottles_collected ?? body.emptyBottlesCollected ?? 0) as number,
      returnedContainers: (body.returned_containers ?? body.returnedContainers ?? 0) as number,
      damagedContainers: (body.damaged_containers ?? body.damagedContainers ?? 0) as number,
      lostContainers: (body.lost_containers ?? body.lostContainers ?? 0) as number,
      notes: (body.remarks || body.notes || null) as string | null,
      latitude: body.latitude ? Number(body.latitude) : null,
      longitude: body.longitude ? Number(body.longitude) : null,
      cashOverride: body.cash_collected !== undefined
        ? Number(body.cash_collected)
        : body.cashCollected !== undefined
          ? Number(body.cashCollected)
          : undefined,
    };
  }

  private computeCashCollected(
    norm: { cashOverride?: number },
    orders: any[],
    status: string,
    paymentMode: string | null,
  ): number {
    if (norm.cashOverride !== undefined) return norm.cashOverride;
    let cash = 0;
    if (['delivered', 'partial'].includes(status)) {
      for (const o of orders) {
        if (paymentMode === 'cod' || o.payment_mode === 'cod') {
          cash += Number(o.total_amount || 0);
        }
      }
    }
    return cash;
  }

  private buildItemsJson(items: any[], defaultSlot?: string): any[] {
    return items.map((item) => {
      const slot = item.delivery_slot || defaultSlot;
      const isMorning = slot === 'morning'
        || slot?.toString().toLowerCase().startsWith('m')
        || slot?.startsWith('AM');
      return {
        product_variant_id: item.variant_id,
        product_name: item.product_name || 'Product',
        m_qty: isMorning ? Number(item.quantity) : 0,
        e_qty: !isMorning ? Number(item.quantity) : 0,
      };
    });
  }

  private async isRunHandedOver(runId: string): Promise<boolean> {
    const res = await this.db.query(
      `SELECT 1 FROM delivery_logs
       WHERE run_id = $1
         AND (remarks = 'Warehouse handover completed' OR remarks = 'Warehouse handover confirmed')
       LIMIT 1`,
      [runId],
    );
    return !!(res?.length);
  }

  private async upsertDeliveryLog(
    client: any,
    params: {
      orderId: string;
      runIdentifier: string;
      customerId: string;
      addressId: string;
      deliveryPartnerId: string;
      deliveryDate: string;
      slot: string;
      itemsJson: any[];
      status: string;
      norm: {
        bottles: number; returnedContainers: number; damagedContainers: number;
        lostContainers: number; deliveryImage: string | null;
        notes: string | null; latitude: number | null; longitude: number | null;
      };
      cashCollected: number;
    },
  ): Promise<void> {
    const { orderId, norm, status, cashCollected } = params;
    const updateRes = await client.query(
      `UPDATE delivery_logs
       SET bottles_collected = $1, cash_collected = $2,
           latitude = $3, longitude = $4, status = $5,
           delivered_at = NOW(), returned_containers = $6,
           damaged_containers = $7, lost_containers = $8,
           proof_photo_url = $9, delivery_time = NOW()
       WHERE order_id = $10`,
      [
        norm.bottles, cashCollected, norm.latitude, norm.longitude,
        status, norm.returnedContainers, norm.damagedContainers,
        norm.lostContainers, norm.deliveryImage, orderId,
      ],
    );
    if (updateRes.rowCount === 0) {
      await client.query(
        `INSERT INTO delivery_logs (
           run_id, customer_id, order_id, address_id, delivery_partner_id, delivery_date, slot,
           items_json, photo_id, bottles_collected, cash_collected, remarks,
           latitude, longitude, status, delivered_at, created_at,
           returned_containers, damaged_containers, lost_containers, proof_photo_url, delivery_time
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW(),NOW(),$16,$17,$18,$19,NOW())`,
        [
          params.runIdentifier, params.customerId, orderId, params.addressId,
          params.deliveryPartnerId, params.deliveryDate, params.slot,
          JSON.stringify(params.itemsJson), norm.deliveryImage,
          norm.bottles, cashCollected, norm.notes,
          norm.latitude, norm.longitude, status,
          norm.returnedContainers, norm.damagedContainers,
          norm.lostContainers, norm.deliveryImage,
        ],
      );
    }
  }

  private async handleBottleReturn(
    executor: { query: (sql: string, params?: any[]) => Promise<any> },
    params: {
      customerId: string;
      referenceOrderId: string;
      returned: number;
      damaged: number;
      lost: number;
      remarks: string | null;
      createdBy: string;
    },
  ): Promise<void> {
    const total = params.returned + params.damaged + params.lost;
    if (total <= 0) return;

    let pkgId = 'PKG_GLASS_BOTTLE';
    const pkgRes = await executor.query(
      `SELECT id FROM packaging_types WHERE is_returnable = true AND status = 'active' LIMIT 1`,
    );
    const pkgs = Array.isArray(pkgRes) ? pkgRes : (pkgRes?.rows || []);
    if (pkgs.length) {
      pkgId = pkgs[0].id;
    } else {
      await executor.query(
        `INSERT INTO packaging_types (id, name, capacity, unit, is_returnable, deposit_amount, status)
         VALUES ('PKG_GLASS_BOTTLE', 'Glass Bottle', 1.0, 'PCS', true, 0.00, 'active')
         ON CONFLICT (id) DO NOTHING`,
      );
    }

    if (params.returned > 0) {
      await executor.query(
        `INSERT INTO container_transactions (
           customer_id, packaging_type_id, reference_type, reference_id,
           transaction_type, quantity, remarks, transaction_date, created_by
         ) VALUES ($1, $2, 'order', $3, 'return', $4, $5, CURRENT_DATE, $6)`,
        [params.customerId, pkgId, params.referenceOrderId, params.returned,
         params.remarks || 'Collected by delivery boy', params.createdBy],
      );
    }

    if (params.damaged > 0) {
      await executor.query(
        `INSERT INTO container_transactions (
           customer_id, packaging_type_id, reference_type, reference_id,
           transaction_type, quantity, remarks, transaction_date, created_by
         ) VALUES ($1, $2, 'order', $3, 'damaged', $4, 'Damaged during delivery', CURRENT_DATE, $5)`,
        [params.customerId, pkgId, params.referenceOrderId, params.damaged, params.createdBy],
      );
    }

    if (params.lost > 0) {
      await executor.query(
        `INSERT INTO container_transactions (
           customer_id, packaging_type_id, reference_type, reference_id,
           transaction_type, quantity, remarks, transaction_date, created_by
         ) VALUES ($1, $2, 'order', $3, 'lost', $4, 'Lost during delivery', CURRENT_DATE, $5)`,
        [params.customerId, pkgId, params.referenceOrderId, params.lost, params.createdBy],
      );
    }

    await executor.query(
      `INSERT INTO customer_container_balances (
         customer_id, packaging_type_id, issued_quantity, returned_quantity,
         damaged_quantity, lost_quantity, updated_at
       ) VALUES ($1, $2, 0, $3, $4, $5, NOW())
       ON CONFLICT (customer_id, packaging_type_id)
       DO UPDATE SET
         returned_quantity = customer_container_balances.returned_quantity + EXCLUDED.returned_quantity,
         damaged_quantity = customer_container_balances.damaged_quantity + EXCLUDED.damaged_quantity,
         lost_quantity = customer_container_balances.lost_quantity + EXCLUDED.lost_quantity,
         updated_at = NOW()`,
      [params.customerId, pkgId, params.returned, params.damaged, params.lost],
    );
  }

  private async handleBottleIssue(
    executor: { query: (sql: string, params?: any[]) => Promise<any> },
    params: {
      customerId: string;
      referenceOrderId: string;
      packagingTypeId: string;
      quantity: number;
      createdBy: string;
    },
  ): Promise<void> {
    if (params.quantity <= 0) return;

    await executor.query(
      `INSERT INTO container_transactions (
         customer_id, packaging_type_id, reference_type, reference_id,
         transaction_type, quantity, remarks, transaction_date, created_by
       ) VALUES ($1, $2, 'order', $3, 'issue', $4, 'Issued during delivery', CURRENT_DATE, $5)`,
      [params.customerId, params.packagingTypeId, params.referenceOrderId, params.quantity, params.createdBy],
    );

    await executor.query(
      `INSERT INTO customer_container_balances (
         customer_id, packaging_type_id, issued_quantity, returned_quantity,
         damaged_quantity, lost_quantity, updated_at
       ) VALUES ($1, $2, $3, 0, 0, 0, NOW())
       ON CONFLICT (customer_id, packaging_type_id)
       DO UPDATE SET
         issued_quantity = customer_container_balances.issued_quantity + EXCLUDED.issued_quantity,
         updated_at = NOW()`,
      [params.customerId, params.packagingTypeId, params.quantity],
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // POST /delivery/orders/:orderId/upload-proof
  // Upload photo proof of delivery
  // ═══════════════════════════════════════════════════════════════
  @Post(':orderId/upload-proof')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit
      fileFilter: (_req, file, cb) => {
        if (/\/(jpg|jpeg|png|gif|webp)$/.test(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only image files are allowed'), false);
        }
      },
    }),
  )
  async uploadProof(
    @Request() req: any,
    @Param('orderId') orderId: string,
    @UploadedFile() file: any,
  ) {
    const userId = req.user?.user_id;
    if (!file) throw new BadRequestException('No file provided');

    const boy = await this.resolveDeliveryPartner(userId);

    const orderRes = await this.db.query(
      `SELECT order_id FROM orders
       WHERE order_id = $1
         AND (
           delivery_partner_id = $2 OR delivery_partner_id = $3
         )`,
      [orderId, boy.id, boy.user_id],
    );
    if (!orderRes?.length) throw new NotFoundException('Order not found');

    // Create directory for delivery proofs
    const proofDir = path.join(process.cwd(), 'uploads', 'deliveries');
    if (!fs.existsSync(proofDir)) {
      fs.mkdirSync(proofDir, { recursive: true });
    }

    const ext = path.extname(file.originalname || 'proof.jpg') || '.jpg';
    const filename = `${orderId}_proof_${Date.now()}${ext}`;
    const filePath = path.join(proofDir, filename);
    fs.writeFileSync(filePath, file.buffer);

    const relativePath = `/uploads/deliveries/${filename}`;
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    const fileUrl = `${backendUrl}${relativePath}`;

    // Update order with the new delivery proof relative path
    await this.db.query(
      `UPDATE orders SET delivery_image = $1, updated_at = NOW() WHERE order_id = $2`,
      [relativePath, orderId],
    );

    return {
      success: true,
      url: fileUrl,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // GET /delivery/orders/today
  // Returns today's delivery list for the authenticated delivery boy
  // ═══════════════════════════════════════════════════════════════
  @Get('today')
  async getTodayDeliveries(
    @Request() req: any,
    @Query('date') dateParam?: string,
    @Query('status') status?: string,
  ) {
    // `today` used to run its own narrower query that only looked at
    // orders.delivery_partner_id directly and completely ignored delivery_runs.
    // That let this endpoint and GET run/today disagree about what the rider
    // should see. run/today's resolution already covers both the route-based
    // (delivery_runs + delivery_run_addresses) and legacy direct-assignment
    // cases, so today now just delegates to it — one source of truth for the
    // rider's list, reused everywhere the app needs it.
    return this.getTodayRun(req, dateParam, status);
  }

  // ═══════════════════════════════════════════════════════════════
  // PATCH /delivery/orders/:orderId/status
  // Mark order as delivered / failed
  // ═══════════════════════════════════════════════════════════════
  @Patch(':orderId/status')
  @HttpCode(HttpStatus.OK)
  async updateOrderStatus(
    @Request() req: any,
    @Param('orderId') orderId: string,
    @Body() body: {
      status: 'delivered' | 'failed';
      notes?: string;
      empty_bottles_collected?: number;
      emptyBottlesCollected?: number;
      payment_mode?: string;
      paymentMode?: string;
      payment_status?: string;
      paymentStatus?: string;
      delivery_image?: string;
      deliveryImage?: string;
      cash_collected?: number;
      cashCollected?: number;
      latitude?: number;
      longitude?: number;
      returned_containers?: number;
      returnedContainers?: number;
      damaged_containers?: number;
      damagedContainers?: number;
      lost_containers?: number;
      lostContainers?: number;
    },
  ) {
    const userId = req.user?.user_id;

    const boy = await this.resolveDeliveryPartner(userId);

    // Verify order belongs to this branch and is not already completed
    const orderRes = await this.db.query(
      `SELECT order_id, status, customer_id, delivery_partner_id, delivery_run_id AS delivery_session_id, address_id, scheduled_date, delivery_slot, payment_mode, total_amount
       FROM orders WHERE order_id = $1`,
      [orderId],
    );
    if (!orderRes?.length) throw new NotFoundException('Order not found');
    const order = orderRes[0];
    if (['delivered', 'cancelled'].includes(order.status)) {
      throw new ForbiddenException('Order already completed');
    }
    // Match on both possible delivery-boy identifier forms, same as every
    // other query in this controller, and compare as strings — the previous
    // strict `!==` check could reject a legitimate match purely on type
    // mismatch (e.g. numeric id vs string id).
    const orderOwner = String(order.delivery_partner_id ?? '');
    if (orderOwner !== String(boy.id) && orderOwner !== String(boy.user_id)) {
      throw new ForbiddenException('Order not assigned to this delivery partner');
    }

    const newStatus = body.status === 'delivered' ? 'delivered' : 'failed';
    const norm = this.normalizeDeliveryBody(body);

    await this.db.transaction(async (client) => {
      // WHERE also re-checks status here (not just in the pre-check above) to
      // close a race window: two concurrent requests for the same order could
      // both pass the earlier "not already completed" check before either
      // writes. This guard makes the second one a safe no-op instead of
      // silently overwriting a terminal state.
      const updateRes = await client.query(
        `UPDATE orders 
         SET status = $1, 
             payment_mode = COALESCE($2, payment_mode), 
             payment_status = COALESCE($3, payment_status), 
             delivery_image = COALESCE($4, delivery_image),
             updated_at = NOW() 
         WHERE order_id = $5
           AND status NOT IN ('delivered', 'cancelled')`,
        [newStatus, norm.paymentMode, norm.paymentStatus, norm.deliveryImage, orderId],
      );
      if (!updateRes?.rowCount) {
        throw new ForbiddenException('Order already completed');
      }

      // Log status change
      await client.query(
        `INSERT INTO order_status_logs (order_id, status, notes, changed_by, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [orderId, newStatus, body.notes || null, String(boy.user_id)],
      );


      const resolvedRun = order.delivery_session_id
        ? await this.resolveRunByIdentifier(order.delivery_session_id)
        : null;

      if (resolvedRun) {
        const runIds = resolvedRun.ids;
        const runIdentifier = resolvedRun.run.run_id || String(resolvedRun.run.id);

        // Mark run started if it was still pending
        await client.query(
          `UPDATE delivery_runs
           SET status = 'in_progress', started_at = COALESCE(started_at, NOW()), updated_at = NOW()
           WHERE (id::text = ANY($1) OR run_id::text = ANY($1)) AND status = 'pending'`,
          [runIds],
        );

        // Build delivery log item snapshot
        const itemsRes = await client.query(
          `SELECT oi.variant_id, oi.quantity, pv.name as product_name, o.delivery_slot, pv.packaging_type_id
           FROM order_items oi
           JOIN orders o ON o.order_id = oi.order_id
           LEFT JOIN product_variants pv ON pv.variant_id = oi.variant_id
           WHERE oi.order_id = $1`,
          [orderId],
        );
        const items = itemsRes.rows || [];
        const itemsJson = this.buildItemsJson(items, order.delivery_slot);
        const cashCollected = this.computeCashCollected(norm, [order], newStatus, norm.paymentMode);

        await this.upsertDeliveryLog(client, {
          orderId, runIdentifier, customerId: order.customer_id,
          addressId: order.address_id, deliveryPartnerId: String(boy.id),
          deliveryDate: order.scheduled_date || new Date().toISOString().split('T')[0],
          slot: (order.delivery_slot || 'morning').substring(0, 5),
          itemsJson, status: newStatus, norm, cashCollected,
        });

        if (newStatus === 'delivered') {
          const itemQuantities: Record<string, number> = {};
          for (const item of items) {
            itemQuantities[item.variant_id] = (itemQuantities[item.variant_id] || 0) + Number(item.quantity);

            // Record bottle issue transaction if variant is returnable
            if (item.packaging_type_id) {
              await this.handleBottleIssue(client, {
                customerId: order.customer_id,
                referenceOrderId: orderId,
                packagingTypeId: item.packaging_type_id,
                quantity: Number(item.quantity),
                createdBy: String(boy.user_id),
              });
            }
          }

          for (const [variantId, qty] of Object.entries(itemQuantities)) {
            await client.query(
              `UPDATE delivery_dispatch_items
               SET delivered_qty = delivered_qty + $1,
                   updated_at = NOW()
               WHERE delivery_run_id::text = ANY($2) AND product_variant_id = $3`,
              [qty, runIds, variantId],
            );
          }
        }

        const stopStatusRes = await client.query(
          `SELECT status FROM orders WHERE delivery_run_id::text = ANY($1) AND address_id = $2::text`,
          [runIds, order.address_id],
        );
        const stopStatuses = (stopStatusRes.rows || []).map((row) => String(row.status));
        const allTerminal = stopStatuses.every((status) => ['delivered', 'failed', 'cancelled'].includes(status));
        if (allTerminal && stopStatuses.length > 0) {
          const anyDelivered = stopStatuses.some((status) => status === 'delivered');
          const stopStatus = anyDelivered ? 'delivered' : 'failed';
          await client.query(
            `UPDATE delivery_run_addresses
             SET delivery_status = $1,
                 delivered_at = NOW()
             WHERE run_id::text = ANY($2) AND address_id = $3::text`,
            [stopStatus, runIds, order.address_id],
          );
        }

        const pendingRes = await client.query(
          `SELECT COUNT(*) as pending_count FROM delivery_run_addresses WHERE run_id::text = ANY($1) AND delivery_status = 'pending'`,
          [runIds],
        );
        const pendingCount = parseInt(pendingRes.rows[0]?.pending_count || '0', 10);
        if (pendingCount === 0) {
          await client.query(
            `UPDATE delivery_runs SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id::text = ANY($1) OR run_id::text = ANY($1)`,
            [runIds],
          );
        }
      }
    });

    // Send push notification to customer if delivered & process referral reward
    if (newStatus === 'delivered') {
      try {
        await this.firstOrderDetector.detectAndMarkFirstOrder(order.customer_id, orderId);
        await this.firstOrderDetector.unlockReferralCode(order.customer_id);
        await this.referralRewardEngine.processReferralReward(order.customer_id, orderId);
      } catch (refErr) {
        this.developer.error('DeliveryOrderController: Failed to process referral reward on order delivery', refErr);
      }

      try {
        await this.pushNotificationService.sendNotificationToUsers(
          [order.customer_id],
          {
            title: 'Delivery Confirmed! ✅',
            body: 'Your F2H Fresh order has been successfully delivered. Thank you!',
          }
        );
      } catch (err) {
        console.error('Failed to send delivery confirmation notification:', err);
      }
    }

    // Handle empty bottles collection
    if (newStatus === 'delivered') {
      await this.handleBottleReturn(this.db, {
        customerId: order.customer_id,
        referenceOrderId: orderId,
        returned: norm.returnedContainers,
        damaged: norm.damagedContainers,
        lost: norm.lostContainers,
        remarks: norm.notes,
        createdBy: String(boy.id),
      });
    }

    return {
      status: true,
      message: `Order marked as ${newStatus}`,
      order_id: orderId,
      empty_bottles_collected: norm.bottles,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // GET /delivery/orders/run/today
  // Fetch today's delivery run, sequence of stops, and associated orders
  // ═══════════════════════════════════════════════════════════════
  @Get('run/today')
  async getTodayRun(
    @Request() req: any,
    @Query('date') dateParam?: string,
    @Query('status') status?: string,
  ) {
    const userId = req.user?.user_id;
    this.developer.debug('getTodayRun: Fetching today run for user', { userId, dateParam, status });
    const boy = await this.resolveDeliveryPartner(userId);
    const { targetDate, targetSlot } = this.getKolkataDateAndSlot(dateParam);

    this.developer.debug('getTodayRun: Parameters resolved', {
      deliveryPartnerId: boy.id,
      deliveryPartnerName: boy.full_name,
      userId: boy.user_id,
      targetDate,
      targetSlot,
    });

    const runs = await this.db.query(
      `SELECT id, run_id, status, delivery_slot, run_date
     FROM delivery_runs
     WHERE delivery_partner_id = $1
       AND DATE(run_date AT TIME ZONE 'Asia/Kolkata') = $2::date
       AND delivery_slot = $3
       AND status != 'cancelled'
     ORDER BY run_date DESC, created_at DESC`,
      [String(boy.user_id), targetDate, targetSlot],
    );

    this.developer.debug('getTodayRun: Queried delivery runs', {
      runsCount: runs?.length || 0,
      runs,
    });

    let activeRunId: string | null = null;
    let activeRunStatus: string | null = null;

    if (runs?.length) {
      const activeRun = runs[0];
      activeRunId = activeRun.run_id || String(activeRun.id);
      activeRunStatus = activeRun.status;

      // If completed in DB, check if handover was logged to map to handed_over for Flutter UI
      if (activeRunStatus === 'completed') {
        if (await this.isRunHandedOver(activeRunId!)) {
          activeRunStatus = 'handed_over';
        }
      }
    }

    this.developer.debug('getTodayRun: Active run state resolved', {
      activeRunId,
      activeRunStatus,
    });

    // Query specified status, or default to fetching confirmed, out_for_delivery, delivered, failed, assigned, and packed
    const orderStatuses = status
      ? [status]
      : ['confirmed', 'out_for_delivery', 'delivered', 'failed', 'assigned', 'packed'];

    this.developer.debug('getTodayRun: Fetching orders with parameters', {
      deliveryPartnerUserId: boy.user_id,
      targetDate,
      orderStatuses,
      targetSlot,
    });

    const orders = await this.db.query(
      `SELECT
        o.order_id,
        o.subscription_id,
        CASE WHEN o.subscription_id IS NULL THEN 'single' ELSE 'subscription' END AS order_type,
        o.customer_id,
        o.status,
        o.address_id,
        NULL AS zone_id,
        drc.route_id::text AS route_id,
        COALESCE(r.route_name, o.delivery_run_id::text) AS route_name,
        o.branch_id,
        o.delivery_slot,
        o.scheduled_date,
        o.subtotal,
        o.discount_amount,
        o.gst_amount,
        o.payment_mode,
        o.payment_status,
        o.total_amount,
        o.delivery_partner_id,
        o.delivery_run_id AS run_id,
        o.special_instructions,
        o.invoice_image,
        o.delivery_image,
        o.payment_screenshot,
        o.created_at,
        o.updated_at,
        COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, '') AS customer_name,
        c.phone AS customer_phone,
        COALESCE(ca.flat_no, '') || ' ' ||
        COALESCE(ca.building_name, '') || ' ' ||
        COALESCE(ca.street, '') || ' ' ||
        COALESCE(ca.area, '') AS customer_address,
        COALESCE(ca.latitude, 0.0) AS address_lat,
        COALESCE(ca.longitude, 0.0) AS address_lng,
        o.run_sequence AS sequence_number
     FROM orders o
     JOIN customers c ON c.customer_id = o.customer_id
     LEFT JOIN customer_addresses ca
       ON (ca.address_id = o.address_id OR ca.id::text = o.address_id)
     LEFT JOIN delivery_route_customers drc
       ON drc.customer_id = c.id
     LEFT JOIN delivery_routes r
       ON r.id = drc.route_id
      WHERE o.delivery_partner_id = $1
        AND o.status = ANY($3)
        AND DATE(o.scheduled_date AT TIME ZONE 'Asia/Kolkata') = $2::date
        AND o.delivery_slot = $4
      ORDER BY o.run_sequence ASC NULLS LAST,
               o.created_at ASC`,
      [
        String(boy.user_id),
        targetDate,
        orderStatuses,
        targetSlot,
      ],
    );

    this.developer.debug('getTodayRun: Queried orders', {
      ordersCount: orders?.length || 0,
      orderIds: orders?.map((o: any) => o.order_id) || [],
    });

    if (!activeRunId && orders?.length) {
      const orderWithRun = orders.find((o: any) => o.run_id);
      if (orderWithRun) {
        activeRunId = orderWithRun.run_id;
        activeRunStatus = 'in_progress';
      }
    }

    // Check handover state again if activeRunStatus was fallback to in_progress but DB run was completed
    if (activeRunId && activeRunStatus === 'in_progress') {
      const dbRun = await this.db.query(
        `SELECT status FROM delivery_runs WHERE run_id = $1 OR id::text = $1 LIMIT 1`,
        [activeRunId],
      );
      if (dbRun?.length && dbRun[0].status === 'completed') {
        activeRunStatus = (await this.isRunHandedOver(activeRunId!)) ? 'handed_over' : 'completed';
      }
    }

    if (!orders?.length) {
      return {
        status: true,
        delivery_partner: {
          id: boy.id,
          name: boy.full_name,
        },
        date: targetDate,
        run_id: activeRunId,
        run_status: activeRunStatus,
        total: 0,
        deliveries: [],
      };
    }

    const deliveries = await this.buildDeliveryResponses(orders);

    return {
      status: true,
      delivery_partner: {
        id: boy.id,
        name: boy.full_name,
      },
      date: targetDate,
      run_id: activeRunId,
      run_status: activeRunStatus,
      total: deliveries.length,
      deliveries,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // POST /delivery/orders/run/:runId/start
  // Start delivery run shift and mark orders as 'out_for_delivery'
  // ═══════════════════════════════════════════════════════════════
  @Post('run/:runId/start')
  @HttpCode(HttpStatus.OK)
  async startTodayRun(@Request() req: any, @Param('runId') runId: string) {
    const userId = req.user?.user_id;

    // Resolve delivery boy
    const boy = await this.resolveDeliveryPartner(userId);

    const run = await this.findDeliveryRunByIdAndBoy(runId, boy);
    if (!['pending', 'assigned', 'planned', 'dispatched'].includes(run.status)) {
      return { success: true, message: 'Run already started or completed', status: run.status };
    }
    const runIdentifier = run.run_id || String(run.id);

    await this.db.transaction(async (client) => {
      // Set run started_at and status = 'in_progress'
      await client.query(
        `UPDATE delivery_runs SET status = 'in_progress', started_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [run.id],
      );

      // Fetch all order ids from orders table directly
      const runAddressesRes = await client.query(
        `SELECT order_id FROM orders WHERE delivery_run_id = ANY($1)`,
        [this.getRunIdentifiers(run)],
      );
      const runAddresses = runAddressesRes.rows || [];

      const orderIds = runAddresses.map((row) => String(row.order_id));

      if (orderIds.length > 0) {
        // Update orders in this run to 'out_for_delivery'
        await client.query(
          `UPDATE orders
           SET status = 'out_for_delivery',
               delivery_partner_id = $1,
               delivery_run_id = $2,
               updated_at = NOW()
           WHERE order_id = ANY($3) AND status IN ('pending', 'placed', 'confirmed', 'packed', 'assigned')`,
          [boy.user_id, runIdentifier, orderIds],
        );
      }
    });

    return { success: true, message: 'Delivery run started successfully', status: 'in_progress' };
  }

  @Patch('run/:runId/address/:addressId/deliver')
  @HttpCode(HttpStatus.OK)
  async markStopDelivered(
    @Request() req: any,
    @Param('runId') runId: string,
    @Param('addressId') addressId: string,
    @Body()
    body: {
      status: 'delivered' | 'failed' | 'partial' | 'skipped';
      notes?: string;
      remarks?: string;
      empty_bottles_collected?: number;
      emptyBottlesCollected?: number;
      payment_mode?: string;
      paymentMode?: string;
      payment_status?: string;
      paymentStatus?: string;
      delivery_image?: string;
      deliveryImage?: string;
      latitude?: number;
      longitude?: number;
      cash_collected?: number;
      cashCollected?: number;
      returned_containers?: number;
      returnedContainers?: number;
      damaged_containers?: number;
      damagedContainers?: number;
      lost_containers?: number;
      lostContainers?: number;
    },
  ) {
    const userId = req.user?.user_id;

    // Resolve delivery boy
    const boy = await this.resolveDeliveryPartner(userId);

    const run = await this.findDeliveryRunByIdAndBoy(runId, boy);
    const runIdentifier = run.run_id || String(run.id);
    const runIds = this.getRunIdentifiers(run);

    // Find the orders directly from orders matching delivery_partner_id and address_id
    const addressRes = await this.db.query(
      `SELECT order_id, customer_id, address_id, status, delivery_run_id FROM orders
       WHERE delivery_partner_id = $1
         AND address_id = $2::text
         AND status NOT IN ('cancelled', 'delivered', 'failed')`,
      [boy.user_id, addressId],
    );
    if (!addressRes?.length) throw new NotFoundException('Address stop not found in delivery run');
    const stopAddress = addressRes[0];

    const newStatus = body.status;
    const norm = this.normalizeDeliveryBody(body);

    const orderIds = addressRes.map((o) => String(o.order_id));

    // Fetch order details for calculations
    const orders = await this.db.query(
      `SELECT order_id, customer_id, total_amount, status, payment_mode FROM orders WHERE order_id = ANY($1)`,
      [orderIds],
    );

    await this.db.transaction(async (client) => {
      // 1. Update delivery_run_addresses stop status (fallback for admin console compatibility)
      await client.query(
        `UPDATE delivery_run_addresses
         SET delivery_status = $1::text,
             delivered_at = CASE WHEN $1::text = 'skipped' THEN NULL ELSE NOW() END
         WHERE run_id = ANY($2::text[]) AND address_id::text = $3::text`,
        [newStatus, runIds, addressId],
      );

      // 1b. Increment run counters atomically for all involved runs
      const runIdsToUpdate = [...new Set(addressRes.map(o => o.delivery_run_id).filter(id => id))].map(String);
      if (runIdsToUpdate.length > 0) {
        if (['delivered', 'partial'].includes(newStatus)) {
          await client.query(
            `UPDATE delivery_runs
             SET completed_addresses = COALESCE(completed_addresses, 0) + 1,
                 updated_at = NOW()
             WHERE run_id = ANY($1::text[]) OR id::text = ANY($1::text[])`,
            [runIdsToUpdate],
          );
        } else if (newStatus === 'failed') {
          await client.query(
            `UPDATE delivery_runs
             SET failed_addresses = COALESCE(failed_addresses, 0) + 1,
                 updated_at = NOW()
             WHERE run_id = ANY($1::text[]) OR id::text = ANY($1::text[])`,
            [runIdsToUpdate],
          );
        }
      }

      // 2. Fetch order items to build items_json for logs
      const itemsRes = await client.query(
        `SELECT oi.order_id, oi.variant_id, oi.quantity, pv.name as product_name, o.delivery_slot, pv.packaging_type_id
         FROM order_items oi
         JOIN orders o ON o.order_id = oi.order_id
         LEFT JOIN product_variants pv ON pv.variant_id = oi.variant_id
         WHERE oi.order_id = ANY($1)`,
        [orderIds],
      );
      const items = itemsRes.rows || [];

      // Update existing rows in delivery_logs for all orderIds at this stop
      for (const orderId of orderIds) {
        const targetOrder = orders.find((o: any) => String(o.order_id) === String(orderId));
        const orderCashCollected = this.computeCashCollected(norm, targetOrder ? [targetOrder] : [], newStatus, norm.paymentMode);
        const orderItems = items.filter((item: any) => String(item.order_id) === String(orderId));
        const orderItemsJson = this.buildItemsJson(orderItems);

        await this.upsertDeliveryLog(client, {
          orderId, runIdentifier, customerId: stopAddress.customer_id,
          addressId, deliveryPartnerId: String(boy.user_id),
          deliveryDate: run.run_date,
          slot: (run.slot || 'morning').substring(0, 5),
          itemsJson: orderItemsJson, status: newStatus, norm, cashCollected: orderCashCollected,
        });
      }

      // 4. Map and update each order status
      // Status mapping: delivered -> delivered, failed -> failed, partial -> out_for_delivery, skipped -> pending
      let orderMappedStatus = 'pending';
      if (newStatus === 'delivered') orderMappedStatus = 'delivered';
      else if (newStatus === 'failed') orderMappedStatus = 'failed';
      else if (newStatus === 'partial') orderMappedStatus = 'delivered'; // default to delivered per decision
      else if (newStatus === 'skipped') orderMappedStatus = 'pending';

      await client.query(
        `UPDATE orders
         SET status = $1,
             payment_mode = COALESCE($2, payment_mode),
             payment_status = COALESCE($3, payment_status),
             delivery_image = COALESCE($4, delivery_image),
             updated_at = NOW()
         WHERE order_id = ANY($5)`,
        [orderMappedStatus, norm.paymentMode, norm.paymentStatus, norm.deliveryImage, orderIds],
      );

      // Log status changes in order_status_logs
      for (const orderId of orderIds) {
        await client.query(
          `INSERT INTO order_status_logs (order_id, status, notes, changed_by, created_at)
           VALUES ($1, $2, $3, $4, NOW())`,
          [orderId, orderMappedStatus, norm.notes, String(boy.user_id)],
        );
      }

      // 5. Update delivery_dispatch_items delivered quantities
      if (['delivered', 'partial'].includes(newStatus)) {
        const itemQuantities: Record<string, number> = {};
        for (const item of items) {
          itemQuantities[item.variant_id] = (itemQuantities[item.variant_id] || 0) + Number(item.quantity);
        }

        for (const [variantId, qty] of Object.entries(itemQuantities)) {
          await client.query(
            `UPDATE delivery_dispatch_items
             SET delivered_qty = delivered_qty + $1,
                 updated_at = NOW()
             WHERE delivery_run_id = $2 AND product_variant_id = $3`,
            [qty, run.id, variantId],
          );
        }
      }

      // 6. Handle empty bottles container balance
      if (['delivered', 'partial'].includes(newStatus)) {
        await this.handleBottleReturn(client, {
          customerId: stopAddress.customer_id,
          referenceOrderId: orderIds[0],
          returned: norm.returnedContainers,
          damaged: norm.damagedContainers,
          lost: norm.lostContainers,
          remarks: norm.notes || 'Collected by delivery boy during run stop',
          createdBy: String(boy.user_id),
        });

        // Record bottle issue transactions for delivered returnable items
        for (const item of items) {
          if (item.packaging_type_id) {
            await this.handleBottleIssue(client, {
              customerId: stopAddress.customer_id,
              referenceOrderId: item.order_id,
              packagingTypeId: item.packaging_type_id,
              quantity: Number(item.quantity),
              createdBy: String(boy.user_id),
            });
          }
        }
      }

      // Send push notification if marked delivered/partial
      if (['delivered', 'partial'].includes(newStatus)) {
        try {
          const uniqueCustomerIds = [...new Set(orders.map((o: any) => o.customer_id))];
          await this.pushNotificationService.sendNotificationToUsers(
            uniqueCustomerIds,
            {
              title: 'Delivery Confirmed! ✅',
              body: 'Your F2H Fresh order has been successfully delivered. Thank you!',
            }
          );

          // S3.3: Arriving Soon push for next 1-3 upcoming stops in the run
          const currentRunId = addressRes[0]?.delivery_run_id;
          const currentSequence = addressRes[0]?.run_sequence || 0;
          if (currentRunId) {
            const upcomingOrders = await this.db.query(
              `SELECT DISTINCT customer_id, run_sequence
               FROM orders
               WHERE delivery_run_id = $1
                 AND run_sequence > $2
                 AND status NOT IN ('delivered', 'failed', 'cancelled')
                 AND (is_arriving_notified IS FALSE OR is_arriving_notified IS NULL)
               ORDER BY run_sequence ASC
               LIMIT 3`,
              [currentRunId, currentSequence]
            );
            if (upcomingOrders?.length) {
              for (const upcoming of upcomingOrders) {
                const stopsAway = Math.max(1, (upcoming.run_sequence || 0) - currentSequence);
                await this.pushNotificationService.sendNotificationToUsers(
                  [upcoming.customer_id],
                  {
                    title: '🚴 Arriving Soon!',
                    body: `Your F2H Fresh delivery is arriving soon (approx. ${stopsAway * 4} min, ${stopsAway} stop${stopsAway > 1 ? 's' : ''} away)!`,
                  }
                );
              }
              const notifiedCustIds = upcomingOrders.map((u: any) => u.customer_id);
              await this.db.query(
                `UPDATE orders SET is_arriving_notified = TRUE WHERE delivery_run_id = $1 AND customer_id = ANY($2)`,
                [currentRunId, notifiedCustIds]
              );
            }
          }
        } catch (err) {
          console.error('Failed to send delivery confirmation notification:', err);
        }
      } else if (newStatus === 'failed') {
        try {
          const uniqueCustomerIds = [...new Set(orders.map((o: any) => o.customer_id))];
          await this.pushNotificationService.sendNotificationToUsers(
            uniqueCustomerIds,
            {
              title: 'Delivery Attempt Failed ⚠️',
              body: `We could not complete your delivery. Reason: ${norm.notes || 'Driver was unable to reach'}. Please contact support.`,
            }
          );
        } catch (err) {
          console.error('Failed to send delivery failure notification:', err);
        }
      }

      // Check if all address stops are non-pending to auto-complete the run for all involved runs
      for (const runIdVal of runIdsToUpdate) {
        // FIX: cast $1 consistently everywhere it's used, otherwise Postgres
        // can't decide a single type for the parameter (varchar vs text)
        // and throws "inconsistent types deduced for parameter $1".
        const pendingRes = await client.query(
          `SELECT COUNT(*) as pending_count FROM orders
           WHERE delivery_run_id::text = $1::text
             AND status NOT IN ('cancelled', 'delivered', 'failed')`,
          [runIdVal],
        );

        const pendingCount = parseInt(pendingRes.rows[0]?.pending_count || '0', 10);
        if (pendingCount === 0) {
          await client.query(
            `UPDATE delivery_runs
             SET status = 'completed',
                 completed_at = NOW(),
                 actual_end_time = NOW(),
                 updated_at = NOW()
             WHERE run_id::text = $1::text OR id::text = $1::text`,
            [runIdVal],
          );
        }
      }
    });

    return {
      status: true,
      message: `Stop marked as ${newStatus}`,
      run_id: runIdentifier,
      address_id: addressId,
      empty_bottles_collected: norm.bottles,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // POST /delivery/orders/run/:runId/complete
  // Manually mark delivery run as completed
  // ═══════════════════════════════════════════════════════════════
  @Post('run/:runId/complete')
  @HttpCode(HttpStatus.OK)
  async completeTodayRun(@Request() req: any, @Param('runId') runId: string) {
    const userId = req.user?.user_id;

    // Resolve delivery boy
    const boy = await this.resolveDeliveryPartner(userId);

    const run = await this.findDeliveryRunByIdAndBoy(runId, boy);
    if (run.status === 'completed') {
      return { success: true, message: 'Run already completed', status: run.status };
    }

    await this.db.query(
      `UPDATE delivery_runs SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [run.id],
    );

    return { success: true, message: 'Delivery run completed successfully', status: 'completed' };
  }

  // ═══════════════════════════════════════════════════════════════
  // GET /delivery/orders/pickup-items
  // Get items to pickup from warehouse for today's delivery run
  // ═══════════════════════════════════════════════════════════════
  @Get('pickup-items')
  async getPickupItems(@Request() req: any, @Query('date') dateParam?: string) {
    try {
      const userId = req.user?.user_id;

      const boy = await this.resolveDeliveryPartner(userId);
      const { targetDate, targetSlot } = this.getKolkataDateAndSlot(dateParam);

      // Find all active delivery runs assigned to this delivery partner
      const runs = await this.db.query(
        `SELECT id, run_id, status, delivery_slot AS slot, run_date FROM delivery_runs
         WHERE delivery_partner_id = $1
           AND DATE(run_date AT TIME ZONE 'Asia/Kolkata') = $2::date
           AND delivery_slot = $3
           AND status NOT IN ('completed', 'handed_over', 'cancelled')
         ORDER BY run_date DESC, created_at DESC`,
        [String(boy.user_id), targetDate, targetSlot]
      );

      let runIds: string[] = [];
      let runIdentifier: string | null = null;
      let runStatus = 'pending';
      let runSlot = 'morning';
      let stops: any[] = [];
      const runOrderIds: string[] = [];

      if (runs?.length) {
        const run = runs[0];
        runIdentifier = run.run_id || String(run.id);
        runStatus = run.status;
        runSlot = run.slot || 'morning';

        runIds = runs.flatMap((r: any) => {
          const ids = [String(r.id)];
          if (r.run_id && String(r.run_id) !== String(r.id)) ids.push(String(r.run_id));
          return ids;
        });

        stops = await this.db.query(
          `SELECT
             o.run_sequence AS sequence_no,
             o.address_id,
             o.order_id,
             o.customer_id,
             COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, '') AS customer_name,
             COALESCE(ca.flat_no, '') || ' ' || COALESCE(ca.building_name, '') || ' ' || COALESCE(ca.street, '') || ' ' || COALESCE(ca.area, '') AS customer_address
           FROM orders o
           JOIN customers c ON c.customer_id = o.customer_id
           LEFT JOIN customer_addresses ca ON (ca.address_id = o.address_id OR ca.id::text = o.address_id)
           WHERE o.delivery_run_id = ANY($1)
             AND o.status IN ('confirmed', 'out_for_delivery', 'assigned', 'packed')
             AND o.delivery_slot = $2
           ORDER BY o.run_sequence ASC`,
          [runIds, targetSlot]
        );

        for (const stop of stops || []) {
          if (stop.order_id) {
            runOrderIds.push(String(stop.order_id));
          }
        }
      }

      // Fallback & Merge: Query directly from orders table
      const directOrders = await this.db.query(
        `SELECT
           1 AS sequence_no,
           o.address_id,
           o.order_id,
           o.customer_id,
           COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, '') AS customer_name,
           COALESCE(ca.flat_no, '') || ' ' || COALESCE(ca.building_name, '') || ' ' || COALESCE(ca.street, '') || ' ' || COALESCE(ca.area, '') AS customer_address
         FROM orders o
         JOIN customers c ON c.customer_id = o.customer_id
         LEFT JOIN customer_addresses ca ON (ca.address_id = o.address_id OR ca.id::text = o.address_id)
         WHERE o.delivery_partner_id = $1
           AND DATE(o.scheduled_date AT TIME ZONE 'Asia/Kolkata') = $2::date
           AND o.status IN ('confirmed', 'out_for_delivery', 'assigned', 'packed')
           AND o.delivery_slot = $3`,
        [String(boy.user_id), targetDate, targetSlot]
      );

      const directStops = directOrders || [];
      for (const stop of directStops) {
        if (stop.order_id && !runOrderIds.includes(String(stop.order_id))) {
          runOrderIds.push(String(stop.order_id));
          stops.push(stop);
        }
      }

      if (!runs?.length && !stops?.length) {
        return {
          status: true,
          delivery_partner: { id: boy.id, name: boy.full_name },
          date: targetDate,
          run_id: null,
          pickup_confirmed: false,
          items: [],
          message: 'No delivery run or orders found for today'
        };
      }

      const allOrderIds: string[] = [];
      for (const stop of stops || []) {
        if (stop.order_id) {
          allOrderIds.push(String(stop.order_id));
        }
      }

      let items: any[] = [];
      const itemsByOrder: Record<string, any[]> = {};

      if (allOrderIds.length > 0) {
        // 2. Fetch all products and quantities directly from order_items
        const orderItems = await this.db.query(
          `SELECT
             oi.order_id,
             oi.variant_id AS product_variant_id,
             oi.quantity,
             pv.name AS product_name,
             pv.unit_value,
             pv.unit_type,
             p.is_returnable
           FROM order_items oi
           JOIN product_variants pv ON pv.variant_id = oi.variant_id
           LEFT JOIN products p ON p.product_id = pv.product_id
           WHERE oi.order_id = ANY($1)`,
          [allOrderIds]
        );

        for (const item of orderItems || []) {
          const key = String(item.order_id);
          if (!itemsByOrder[key]) itemsByOrder[key] = [];
          itemsByOrder[key].push({
            product_variant_id: item.product_variant_id,
            product_name: item.product_name,
            quantity: Number(item.quantity),
            unit: `${item.unit_value}${item.unit_type}`,
            unit_value: item.unit_value || 1,
            is_returnable: item.is_returnable || false,
          });
        }

        // 3. Consolidate identical items for the warehouse pickup list
        const consolidatedPickupItems: Record<string, any> = {};
        for (const orderId of allOrderIds) {
          const oItems = itemsByOrder[String(orderId)] || [];
          for (const item of oItems) {
            const key = `${item.product_variant_id}_${item.unit}`;
            if (!consolidatedPickupItems[key]) {
              consolidatedPickupItems[key] = {
                id: key,
                dispatch_id: '',
                product_variant_id: item.product_variant_id,
                product_name: item.product_name || 'Unknown Product',
                quantity: item.quantity,
                unit: item.unit || 'PCS',
                unit_value: item.unit_value || 1,
                is_returnable: item.is_returnable || false,
                loaded_qty: 0,
              };
            } else {
              consolidatedPickupItems[key].quantity += item.quantity;
            }
          }
        }
        items = Object.values(consolidatedPickupItems);
      }

      const baggingInstructions = (stops || []).map((stop: any) => {
        const ids = stop.order_id ? [String(stop.order_id)] : [];

        const stopItems: any[] = [];
        for (const orderId of ids) {
          const oItems = itemsByOrder[orderId] || [];
          stopItems.push(...oItems);
        }

        // Consolidate identical items
        const consolidatedItems: Record<string, any> = {};
        for (const item of stopItems) {
          const key = `${item.product_name}_${item.unit}`;
          if (!consolidatedItems[key]) {
            consolidatedItems[key] = { ...item };
          } else {
            consolidatedItems[key].quantity += item.quantity;
          }
        }

        return {
          sequence_no: stop.sequence_no,
          customer_name: stop.customer_name,
          address: stop.customer_address,
          items: Object.values(consolidatedItems)
        };
      });



      return {
        status: true,
        delivery_partner: { id: boy.id, name: boy.full_name },
        date: targetDate,
        run_id: runIdentifier,
        run_status: runStatus,
        slot: runSlot,
        pickup_confirmed: ['in_progress', 'completed', 'partial'].includes(String(runStatus)),
        items,
        bagging_instructions: baggingInstructions
      };
    } catch (err: any) {
      console.error('[getPickupItems] Error:', err.message);
      throw err;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // POST /delivery/orders/pickup-items/confirm
  // Confirm pickup of items from warehouse
  // ═══════════════════════════════════════════════════════════════
  @Post('pickup-items/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmPickup(
    @Request() req: any,
    @Body() body: {
      run_id: string;
      items: Array<{
        product_variant_id: string;
        confirmed_qty: number;
      }>;
      latitude?: number;
      longitude?: number;
    }
  ) {
    try {
      const userId = req.user?.user_id;

      // Resolve delivery boy
      const boy = await this.resolveDeliveryPartner(userId);

      const run = await this.findDeliveryRunByIdAndBoy(body.run_id, boy);
      const runIds = this.getRunIdentifiers(run);
      const runIdentifier = run.run_id || String(run.id);

      if (!['planned', 'assigned', 'dispatched'].includes(String(run.status))) {
        return { success: true, message: 'Pickup already confirmed', status: run.status };
      }

      await this.db.transaction(async (client) => {
        // Update loaded_qty for each confirmed item
        for (const item of body.items) {
          await client.query(
            `UPDATE delivery_dispatch_items
             SET loaded_qty = $1, updated_at = NOW()
             WHERE delivery_run_id = ANY($2) AND product_variant_id = $3`,
            [item.confirmed_qty, runIds, item.product_variant_id]
          );
        }

        // Pickup confirmation starts the run and unlocks the route queue.
        await client.query(
          `UPDATE delivery_runs
           SET status = 'in_progress',
               actual_start_time = COALESCE(actual_start_time, NOW()),
               updated_at = NOW()
           WHERE id = $1`,
          [run.id]
        );

        const runAddressesRes = await client.query(
          `SELECT order_id FROM orders WHERE delivery_run_id = ANY($1)`,
          [runIds],
        );
        const orderIds = (runAddressesRes.rows || []).map((row) => String(row.order_id));

        if (orderIds.length > 0) {
          await client.query(
            `UPDATE orders
             SET status = 'out_for_delivery',
                 delivery_partner_id = $1,
                 delivery_run_id = $2,
                 updated_at = NOW()
             WHERE order_id = ANY($3)
               AND status IN ('pending', 'placed', 'confirmed', 'packed', 'assigned')`,
            [boy.user_id, runIdentifier, orderIds],
          );
        }

        // Update existing delivery_logs for this run with pickup confirmation
        await client.query(
          `UPDATE delivery_logs
           SET status = 'pickup_confirmed',
               latitude = COALESCE($2, latitude),
               longitude = COALESCE($3, longitude),
               delivery_time = NOW(),
               remarks = 'Warehouse pickup confirmed'
           WHERE run_id = ANY($1)
             AND status = 'pending'`,
          [
            runIds,
            body.latitude ? Number(body.latitude) : null,
            body.longitude ? Number(body.longitude) : null
          ]
        );
      });

      return {
        success: true,
        message: 'Pickup confirmed successfully',
        run_id: runIdentifier,
        status: 'in_progress'
      };
    } catch (err: any) {
      if (err?.status) throw err; // Re-throw NestJS HttpExceptions as-is
      throw new BadRequestException(`Failed to confirm pickup: ${err.message || err}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // POST /delivery/orders/run/:runId/handover
  // Complete delivery run shift and hand over remaining items
  // ═══════════════════════════════════════════════════════════════
  @Post('run/:runId/handover')
  @HttpCode(HttpStatus.OK)
  async handoverRun(@Request() req: any, @Param('runId') runId: string) {
    const userId = req.user?.user_id;

    // Resolve delivery boy
    const boy = await this.resolveDeliveryPartner(userId);

    const run = await this.findDeliveryRunByIdAndBoy(runId, boy);

    const runIds = this.getRunIdentifiers(run);
    const runIdentifier = run.run_id || String(run.id);

    // Check if handover has already been logged for this run
    if (await this.isRunHandedOver(runIdentifier)) {
      return {
        success: true,
        message: 'Run already handed over',
        status: 'handed_over',
        empty_bottles_returned: 0,
        returned_items: []
      };
    }

    // Fetch empty bottles collected in this run (sum of bottles_collected from delivery_logs)
    const bottlesRes = await this.db.query(
      `SELECT COALESCE(SUM(bottles_collected), 0) AS total_bottles
       FROM delivery_logs
       WHERE run_id = ANY($1) AND status != 'pickup_confirmed' AND status != 'handed_over'`,
      [runIds]
    );
    const totalBottles = Number(bottlesRes[0]?.total_bottles || 0);

    // Fetch returned items (non-delivered orders in this run)
    const returnedItemsRes = await this.db.query(
      `SELECT 
         oi.variant_id, 
         pv.name AS product_name, 
         SUM(oi.quantity) AS quantity,
         pv.unit_value,
         pv.unit_type
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.order_id
       JOIN product_variants pv ON pv.variant_id = oi.variant_id
       WHERE o.delivery_run_id = ANY($1) 
         AND o.status != 'delivered'
       GROUP BY oi.variant_id, pv.name, pv.unit_value, pv.unit_type`,
      [runIds]
    );

    const returnedItems = (returnedItemsRes || []).map((item: any) => ({
      product_variant_id: item.variant_id,
      product_name: item.product_name || 'Unknown Product',
      quantity: Number(item.quantity),
      unit: `${item.unit_value || 1}${item.unit_type || 'PCS'}`
    }));

    await this.db.transaction(async (client) => {
      // Keep the run in the schema-supported completed state after warehouse handover.
      await client.query(
        `UPDATE delivery_runs SET status = 'completed', actual_end_time = COALESCE(actual_end_time, NOW()), updated_at = NOW() WHERE id = $1`,
        [run.id],
      );

      // Log handover event in delivery_logs by updating existing records instead of inserting
      await client.query(
        `UPDATE delivery_logs
         SET delivery_date = CURRENT_DATE,
             photo_id = NULL,
             bottles_collected = COALESCE(bottles_collected, 0),
             cash_collected = COALESCE(cash_collected, 0),
             remarks = 'Warehouse handover completed',
             status = 'completed',
             delivered_at = NOW(),
             created_at = NOW()
         WHERE run_id = ANY($1)`,
        [runIds],
      );
    });

    return {
      success: true,
      message: 'Run handed over successfully',
      status: 'handed_over',
      empty_bottles_returned: totalBottles,
      returned_items: returnedItems
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // POST /delivery/orders/mark-out-for-delivery
  // For riders without a formal delivery run — marks all their
  // pending orders as out_for_delivery so they appear in the app.
  // ═══════════════════════════════════════════════════════════════
  @Post('mark-out-for-delivery')
  @HttpCode(HttpStatus.OK)
  async markOrdersOutForDelivery(@Request() req: any) {
    const userId = req.user?.user_id;
    const boy = await this.resolveDeliveryPartner(userId);
    const targetDate = new Date().toISOString().split('T')[0];

    // Fetch all confirmed orders assigned to this boy for today
    const pendingRes = await this.db.query(
      `SELECT order_id FROM orders
       WHERE delivery_partner_id = $1
         AND status = 'confirmed'
         AND DATE(scheduled_date) <= $2::date`,
      [String(boy.user_id), targetDate],
    );

    if (!pendingRes?.length) {
      return {
        success: true,
        message: 'No pending orders to mark',
        updated_count: 0,
      };
    }

    const orderIds = pendingRes.map((r: any) => r.order_id);

    await this.db.transaction(async (client) => {
      await client.query(
        `UPDATE orders
         SET status = 'out_for_delivery',
             delivery_partner_id = $1,
             updated_at = NOW()
         WHERE order_id = ANY($2)
           AND status NOT IN ('cancelled', 'delivered', 'failed', 'out_for_delivery')`,
        [boy.user_id, orderIds],
      );

      // Bulk insert status logs
      await client.query(
        `INSERT INTO order_status_logs (order_id, status, notes, changed_by, created_at)
         SELECT oid, 'out_for_delivery', 'Rider confirmed pickup — marked out for delivery', $2, NOW()
         FROM unnest($1::text[]) AS oid
         ON CONFLICT DO NOTHING`,
        [orderIds, String(boy.user_id)],
      );
    });

    return {
      success: true,
      message: `${orderIds.length} order(s) marked as out for delivery`,
      updated_count: orderIds.length,
      order_ids: orderIds,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // POST /delivery/orders/:id/update-containers
  // Accept container return checklist & missing statuses with notes
  // ═══════════════════════════════════════════════════════════════
  @Post(':id/update-containers')
  @HttpCode(HttpStatus.OK)
  async updateOrderContainers(
    @Param('id') id: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    const userId = req.user?.user_id;
    const boy = await this.resolveDeliveryPartner(userId);

    const orderRes = await this.db.query(
      `SELECT order_id, customer_id FROM orders WHERE order_id = $1 OR id::text = $1 LIMIT 1`,
      [id],
    );
    if (!orderRes?.length) {
      throw new NotFoundException('Order not found');
    }

    const order = orderRes[0];
    const { container_updates } = body;

    if (!Array.isArray(container_updates) || container_updates.length === 0) {
      throw new BadRequestException('container_updates must be a non-empty array');
    }

    for (const item of container_updates) {
      const { container_id, expected_quantity = 1, returned_quantity = 0, status = 'returned', notes } = item;
      if (!container_id) continue;

      await this.db.query(
        `INSERT INTO order_containers 
         (order_id, customer_id, container_id, expected_quantity, returned_quantity, status, notes, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [order.order_id, order.customer_id, container_id, expected_quantity, returned_quantity, status, notes || null]
      );

      const txnType = status === 'returned' ? 'return' : status === 'broken' ? 'damaged' : status === 'lost' ? 'lost' : 'issue';
      const qty = Math.max(1, Number(returned_quantity || expected_quantity || 1));

      await this.db.query(
        `INSERT INTO container_transactions 
         (customer_id, packaging_type_id, reference_type, reference_id, transaction_type, quantity, remarks, created_by)
         VALUES ($1, $2, 'order', $3, $4, $5, $6, $7)`,
        [order.customer_id, container_id, order.order_id, txnType, qty, notes || `Order ${order.order_id} container check (${status})`, boy.full_name || String(boy.user_id)]
      ).catch(() => null);

      const returnAdd = txnType === 'return' ? qty : 0;
      const damagedAdd = txnType === 'damaged' ? qty : 0;
      const lostAdd = txnType === 'lost' ? qty : 0;

      await this.db.query(
        `INSERT INTO customer_container_balances 
         (customer_id, packaging_type_id, issued_quantity, returned_quantity, damaged_quantity, lost_quantity)
         VALUES ($1, $2, 0, $3, $4, $5)
         ON CONFLICT (customer_id, packaging_type_id) DO UPDATE SET
           returned_quantity = customer_container_balances.returned_quantity + EXCLUDED.returned_quantity,
           damaged_quantity = customer_container_balances.damaged_quantity + EXCLUDED.damaged_quantity,
           lost_quantity = customer_container_balances.lost_quantity + EXCLUDED.lost_quantity,
           updated_at = NOW()`,
        [order.customer_id, container_id, returnAdd, damagedAdd, lostAdd]
      ).catch(() => null);
    }

    return {
      success: true,
      message: 'Container checklist & statuses updated successfully',
    };
  }
}