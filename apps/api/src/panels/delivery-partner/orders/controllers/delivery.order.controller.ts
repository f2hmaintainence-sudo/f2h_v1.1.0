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
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { DatabaseService } from '../../../../shared/database/Database.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { DeliveryOrderService } from '../services/delivery.order.service';
import { Roles, ROLE } from 'src/auth/decorators/roles.decorator';

@Roles(ROLE.DELIVERY_PARTNER, ROLE.ADMIN, ROLE.SUPER_ADMIN)
@Controller({ path: ['delivery-partner/orders', 'delivery/orders'], version: '1' })
@UseGuards(JwtAuthGuard)
export class DeliveryOrderController {
  constructor(
    private readonly service: DeliveryOrderService,
    private readonly db: DatabaseService,
  ) { }

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

    const boy = await this.service.resolveDeliveryPartner(userId);

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

  @Get('today')
  async getTodayDeliveries(
    @Request() req: any,
    @Query('date') dateParam?: string,
    @Query('status') status?: string,
  ) {
    const userId = req.user?.user_id;
    return this.service.getTodayRun(userId, dateParam, status);
  }

  @Get('run/today')
  async getTodayRun(
    @Request() req: any,
    @Query('date') dateParam?: string,
    @Query('status') status?: string,
  ) {
    const userId = req.user?.user_id;
    return this.service.getTodayRun(userId, dateParam, status);
  }

  @Post('run/:runId/start')
  @HttpCode(HttpStatus.OK)
  async startTodayRun(@Request() req: any, @Param('runId') runId: string) {
    const userId = req.user?.user_id;
    return this.service.startTodayRun(userId, runId);
  }

  @Patch('run/:runId/address/:addressId/deliver')
  @HttpCode(HttpStatus.OK)
  async markStopDelivered(
    @Request() req: any,
    @Param('runId') runId: string,
    @Param('addressId') addressId: string,
    @Body() body: any,
  ) {
    const userId = req.user?.user_id;
    return this.service.markStopDelivered(userId, runId, addressId, body);
  }

  @Post('run/:runId/handover')
  @HttpCode(HttpStatus.OK)
  async handoverRun(@Request() req: any, @Param('runId') runId: string) {
    const userId = req.user?.user_id;
    return this.service.handoverRun(userId, runId);
  }

  @Post('mark-out-for-delivery')
  @HttpCode(HttpStatus.OK)
  async markOrdersOutForDelivery(@Request() req: any) {
    const userId = req.user?.user_id;
    return this.service.markOrdersOutForDelivery(userId);
  }

  @Patch(':orderId/status')
  @HttpCode(HttpStatus.OK)
  async updateOrderStatus(
    @Request() req: any,
    @Param('orderId') orderId: string,
    @Body() body: any,
  ) {
    const userId = req.user?.user_id;
    return this.service.updateOrderStatus(userId, orderId, body);
  }

  @Get('pickup-items')
  async getPickupItems(@Request() req: any, @Query('date') dateParam?: string) {
    const userId = req.user?.user_id;
    return this.service.getPickupItems(userId, dateParam);
  }

  @Post('pickup-items/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmPickup(
    @Request() req: any,
    @Body() body: any,
  ) {
    const userId = req.user?.user_id;
    return this.service.confirmPickup(userId, body);
  }


}