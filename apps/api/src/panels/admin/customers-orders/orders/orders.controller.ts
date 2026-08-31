import { Controller, Get, Param, Patch, Query, Res, Body } from '@nestjs/common';
import { Response } from 'express';
import { OrdersService } from './orders.service';
import { OrdersTableService } from './services/table.service';
import { Roles, ROLE } from 'src/auth/decorators/roles.decorator';

@Roles(ROLE.ADMIN, ROLE.SUPER_ADMIN)
@Controller({ path: 'admin/orders', version: '1' })
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly tableService: OrdersTableService,
  ) {}

  // ── Table endpoints ──
  @Get('today/table')
  async getTodayOrdersTable(@Query() query: any) {
    return this.tableService.getOrdersTable({ ...query, scope: 'today' });
  }

  @Get('table')
  async getOrdersTable(@Query() query: any) {
    return this.tableService.getOrdersTable(query);
  }

  @Get('onetime-orders/table')
  async getOntimeOrdersTable(@Query() query: any) {
    return this.tableService.getOrdersTable(query);
  }

  @Get('subscription-orders/table')
  async getSubscriptionSnapshotsTable(@Query() query: any) {
    return this.tableService.getOrdersTable(query);
  }

  // ── Today Dashboard Summary ──

  @Get('summary')
  async getOrdersSummary(@Query() query: any) {
    return this.ordersService.getOrdersSummary(query);
  }

  @Get('today/summary')
  async getTodaySummary(@Query() query: any) {
    return this.ordersService.getTodaySummary(query);
  }

  // ── Bulk Mark Delivered ──

  @Patch(['today/bulk-deliver', 'bulk-deliver'])
  async bulkMarkDelivered(@Query() query: any) {
    return this.ordersService.bulkMarkDelivered(query);
  }

  // ── Bulk Mark Failed ──

  @Patch(['today/bulk-fail', 'bulk-fail'])
  async bulkMarkFailed(@Query() query: any) {
    return this.ordersService.bulkMarkFailed(query);
  }

  // ── PDF Export ──

  @Get('today/export-pdf')
  async exportTodayPdf(@Query() query: any, @Res() res: Response) {
    const buffer = await this.ordersService.exportTodayPdf(query);

    const date = query.date || new Date().toISOString().slice(0, 10);
    const filename = `orders-report-${date}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }

  // ── Single Order endpoints ──

  @Get(':orderId/view')
  async getOrderView(@Param('orderId') orderId: string) {
    return this.ordersService.getOrderView(orderId);
  }

  @Get(':orderId/items')
  async getOrderItems(@Param('orderId') orderId: string) {
    return this.ordersService.getOrderItems(orderId);
  }

  @Patch(':orderId/status')
  async updateOrderStatus(
    @Param('orderId') orderId: string,
    @Body() body: { status: string; notes?: string },
  ) {
    return this.ordersService.updateOrderStatus(orderId, body.status, body.notes);
  }
}
