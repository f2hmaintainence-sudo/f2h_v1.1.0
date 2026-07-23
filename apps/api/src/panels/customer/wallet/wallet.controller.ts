import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { DataService } from 'src/shared/database/Data.service';

@Controller({ path: '/customer/wallet', version: '1' })
export class WalletController {
  constructor(
    private readonly Data: DataService,
  ) {}

  @Post('topup')
  @UseGuards(AuthGuard('jwt'))
  async walletTopup(@Req() req: Request, @Body() body: any) {
    const user = req.user as any;
    const userId = user?.user_id;
    const email = user?.email;

    const amount = Number(body.amount || 0);

    if (amount <= 0) {
      throw new BadRequestException('Invalid topup amount');
    }

    // Resolve customer
    let customerResult = await this.Data.query('customers', {
      where: [{ column: 'email', operator: '=', value: email }],
      limit: 1,
    });
    if (!customerResult?.data?.length) {
      customerResult = await this.Data.query('customers', {
        where: [{ column: 'customer_id', operator: '=', value: userId }],
        limit: 1,
      });
    }
    const customer = customerResult?.data?.[0];
    if (!customer) {
      throw new BadRequestException('Customer profile not found');
    }

    const currentBalance = Number(customer?.wallet_balance || 0);
    const newBalance = currentBalance + amount;

    return this.Data.executeTransaction(async (conn) => {
      await this.Data.update(
        'customers',
        { wallet_balance: newBalance, updated_at: new Date() },
        [{ column: 'customer_id', operator: '=', value: customer.customer_id }],
        { transaction: conn },
      );

      // const txId = 'WTX_' + Math.random().toString(36).substring(2, 14).toUpperCase();
      await this.Data.insert('customer_wallet_transactions', {
        customer_id: customer.customer_id,
        transaction_type: 'credit',
        amount: amount,
        balance_after: newBalance,
        reference_type: 'topup',
        // reference_id : txId,
        remarks: 'Wallet Topup',
        created_by: customer.customer_id,
      }, { transaction: conn });

      // [ADDED BY ANTIGRAVITY FOR SUBSCRIPTION & PRODUCT UI UPDATE]
      // Insert wallet topup notification
      const notificationId = 'NTF-' + Date.now() + '-' + Math.floor(1000 + Math.random() * 9000);
      await this.Data.insert('notifications', {
        notification_id: notificationId,
        title: 'Wallet Credited',
        message: `Your wallet has been recharged with ₹${amount.toFixed(0)}. New balance: ₹${newBalance.toFixed(0)}.`,
        medium: 'websocket',
        type: 'success',
        priority: 'medium',
        status: 'active',
        created_by: 'system',
        updated_by: 'system',
        created_at: new Date(),
        updated_at: new Date(),
      }, { transaction: conn });

      await this.Data.insert('notification_recipients', {
        notification_id: notificationId,
        user_id: customer.customer_id,
        status: 'unread',
        notified_at: new Date(),
        created_by: 'system',
        updated_by: 'system',
        created_at: new Date(),
        updated_at: new Date(),
      }, { transaction: conn });

      return {
        status: true,
        message: 'Wallet recharged successfully',
        balance: newBalance,
      };
    });
  }

  @Get('transactions')
  @UseGuards(AuthGuard('jwt'))
  async getWalletTransactions(@Req() req: Request) {
    const user = req.user as any;
    const userId = user?.user_id;
    const email = user?.email;

    // Resolve customer
    let customerResult = await this.Data.query('customers', {
      where: [{ column: 'email', operator: '=', value: email }],
      limit: 1,
    });
    if (!customerResult?.data?.length) {
      customerResult = await this.Data.query('customers', {
        where: [{ column: 'customer_id', operator: '=', value: userId }],
        limit: 1,
      });
    }
    const customer = customerResult?.data?.[0];
    if (!customer) {
      throw new BadRequestException('Customer profile not found');
    }

    const txResult = await this.Data.query('customer_wallet_transactions', {
      where: [{ column: 'customer_id', operator: '=', value: customer.customer_id }],
      orderBy: [{ column: 'created_at', direction: 'DESC' }],
    });
    return {
      status: true,
      data: txResult?.data || [],
    };
  }
}

