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
import { PushNotificationService } from 'src/shared/pushNotifications/pushNotification.service';
import { DeveloperService } from 'src/shared/logger/Developer.service';

@Controller({ path: '/customer/wallet', version: '1' })
export class WalletController {
  constructor(
    private readonly Data: DataService,
    private readonly pushNotificationService: PushNotificationService,
    private readonly developer: DeveloperService,
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

    await this.Data.update(
      'customers',
      { wallet_balance: newBalance, updated_at: new Date() },
      [{ column: 'customer_id', operator: '=', value: customer.customer_id }],
    );
    if (email) {
      try {
        await this.Data.update(
          'customers',
          { wallet_balance: newBalance, customer_id: userId, updated_at: new Date() },
          [{ column: 'email', operator: '=', value: email }],
        );
      } catch (_) {}
    }

    // ponytail: compact ID to fit VARCHAR(20) column constraint
    const ts = Math.floor(Date.now() / 1000).toString(36);
    const rnd = Math.floor(Math.random() * 9000 + 1000);
    const txId = `WT${ts}${rnd}`;
    await this.Data.insert('customer_wallet_transactions', {
      transaction_id: txId,
      customer_id: customer.customer_id,
      transaction_type: 'credit',
      amount: amount,
      balance_after: newBalance,
      reference_type: 'topup',
      reference_id: txId,
      remarks: 'Wallet Topup',
      created_by: customer.customer_id,
      created_at: new Date(),
    });

    try {
      const nts = Math.floor(Date.now() / 1000).toString(36);
      const nrnd = Math.floor(Math.random() * 9000 + 1000);
      const notificationId = `NF${nts}${nrnd}`;
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
      });

      await this.Data.insert('notification_recipients', {
        notification_id: notificationId,
        user_id: customer.customer_id,
        status: 'unread',
        notified_at: new Date(),
        created_by: 'system',
        updated_by: 'system',
        created_at: new Date(),
        updated_at: new Date(),
      });
    } catch (notifErr) {
      // Notification failure must not block wallet credit
    }

    try {
      await this.pushNotificationService.sendNotificationToUsers(
        [customer.customer_id],
        {
          title: 'Wallet Credited! 💳',
          body: `Your wallet has been recharged with ₹${amount.toFixed(0)}. New balance: ₹${newBalance.toFixed(0)}.`,
        },
      );
    } catch (error) {
      this.developer.error('Wallet topup push notification failed', {
        customerId: customer.customer_id,
        error,
      });
    }

    return {
      status: true,
      message: 'Wallet recharged successfully',
      balance: newBalance,
    };
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

    const customerIds = Array.from(new Set([userId, customer.customer_id].filter(Boolean)));

    const txResult = await this.Data.query('customer_wallet_transactions', {
      where: customerIds.length > 1
        ? [{ column: 'customer_id', operator: 'IN', value: customerIds }]
        : [{ column: 'customer_id', operator: '=', value: customerIds[0] }],
      orderBy: [{ column: 'created_at', direction: 'DESC' }],
    });
    return {
      status: true,
      data: txResult?.data || [],
    };
  }
}

