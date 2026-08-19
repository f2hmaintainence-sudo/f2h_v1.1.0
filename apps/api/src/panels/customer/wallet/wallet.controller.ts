import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import { WalletTopupDto } from './dto/wallet.dto';
import { DataService } from 'src/shared/database/Data.service';
import { PushNotificationService } from 'src/shared/pushNotifications/pushNotification.service';
import { DatabaseService } from 'src/shared/database/Database.service';
import { DeveloperService } from 'src/shared/logger/Developer.service';

@Controller({ path: '/customer/wallet', version: '1' })
export class WalletController {
  constructor(
    private readonly Data: DataService,
    private readonly db: DatabaseService,
    private readonly pushNotificationService: PushNotificationService,
    private readonly developer: DeveloperService,
  ) {}

  @Post('topup')
  async walletTopup(@Req() req: Request, @Body() body: WalletTopupDto) {
    const userId = (req.user as any)?.user_id;
    const amount = Number(body.amount || 0);

    if (!userId) {
      throw new BadRequestException('Authenticated customer is required');
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Invalid topup amount');
    }

    // Look the customer up strictly by id. The previous query also matched on the
    // token's email with `LIMIT 1` and no ORDER BY, so it could return a different
    // customer entirely — and then credit that customer's wallet.
    const custRows = await this.db.query(
      `SELECT c.customer_id, c.wallet_balance
         FROM customers c
        WHERE c.customer_id = $1
        LIMIT 1`,
      [userId],
    );
    const customer = custRows?.[0];
    if (!customer) {
      throw new BadRequestException('Customer profile not found');
    }

    // Credit and ledger entry commit together, and the credit is a single atomic
    // statement. The previous version read the balance, added in JS, wrote it back,
    // then wrote the ledger row separately — so two concurrent top-ups lost one
    // credit, and a failure between the two steps left money with no ledger trail.
    // There was also a second UPDATE keyed on `email` that overwrote `customer_id`
    // on whatever row matched, with its error swallowed.
    const newBalance = await this.Data.executeTransaction(async (tx) => {
      const [rows] = await tx.query(
        `UPDATE customers
            SET wallet_balance = wallet_balance + $1,
                updated_at = NOW()
          WHERE customer_id = $2
      RETURNING wallet_balance`,
        [amount, customer.customer_id],
      );

      if (!rows?.length) {
        throw new BadRequestException('Customer profile not found');
      }
      const balanceAfter = Number(rows[0].wallet_balance);

      const ts = Math.floor(Date.now() / 1000).toString(36);
      const rnd = Math.floor(Math.random() * 9000 + 1000);

      this.Data.assertWritten(
        await this.Data.insert(
          'customer_wallet_transactions',
          {
            transaction_id: `WT${ts}${rnd}`,
            customer_id: customer.customer_id,
            transaction_type: 'credit',
            amount,
            balance_after: balanceAfter,
            reference_type: 'topup',
            reference_id: `WT${ts}${rnd}`,
            remarks: 'Wallet Topup',
            created_by: customer.customer_id,
            created_at: new Date(),
          },
          { transaction: tx },
        ),
        'Wallet topup ledger entry',
      );

      return balanceAfter;
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
    } catch (error) {
      // Best-effort: the credit is already committed, so a notification failure
      // must not fail the request — but it should not be invisible either.
      this.developer.warn('Wallet topup notification insert failed', {
        customerId: customer.customer_id,
        error,
      });
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
  async getWalletTransactions(@Req() req: Request) {
    const userId = (req.user as any)?.user_id;

    // By id only — matching on the token's email could return another customer's
    // profile and expose their wallet history.
    const custRows = await this.db.query(
      `SELECT c.customer_id
         FROM customers c
        WHERE c.customer_id = $1
        LIMIT 1`,
      [userId],
    );
    const customer = custRows?.[0];
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

