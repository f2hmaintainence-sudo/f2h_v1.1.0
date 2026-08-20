// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : wallet-ledger.service.ts
// Description : Single writer for customer wallet balance + ledger entries.
//               Every credit/debit goes through here so the balance and the
//               `customer_wallet_transactions` ledger can never drift apart.
//
// ============================================================================

import { Injectable, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/Database.service';
import { DeveloperService } from '../logger/Developer.service';
import { PushNotificationService } from '../pushNotifications/pushNotification.service';

export interface WalletMovement {
  customerId: string;
  amount: number;
  referenceType: string;
  referenceId: string;
  remarks: string;
  createdBy?: string;
}

export interface WalletMovementResult {
  transactionId: string;
  balanceBefore: number;
  balanceAfter: number;
  amount: number;
}

/** Anything that can run a parameterised query — a pool client or the pool. */
export interface WalletExecutor {
  query: (sql: string, params?: any[]) => Promise<any>;
}

/** Notification the wallet owner should receive once a joined credit commits. */
export interface PendingWalletNotification {
  customerId: string;
  result: WalletMovementResult;
}

@Injectable()
export class WalletLedgerService {
  constructor(
    private readonly db: DatabaseService,
    private readonly developer: DeveloperService,
    private readonly pushNotificationService: PushNotificationService,
  ) {}

  /** Compact id that fits the ledger's VARCHAR(20) key columns. */
  private buildTransactionId(prefix: string): string {
    const ts = Math.floor(Date.now() / 1000).toString(36);
    const rnd = Math.floor(Math.random() * 9000 + 1000);
    return `${prefix}${ts}${rnd}`;
  }

  /**
   * Credits a wallet atomically: the balance update and the ledger row commit
   * together, and the balance is re-read `FOR UPDATE` inside the transaction so
   * concurrent credits cannot both write the same `balance_after`.
   *
   * Pass `executor` to join a transaction the caller already opened — used where
   * the credit must commit with other work (a refund payout, say) rather than on
   * its own. The push notification is only sent for self-contained credits,
   * because the caller's transaction may still roll back after this returns.
   */
  async credit(
    movement: WalletMovement,
    executor?: WalletExecutor,
  ): Promise<WalletMovementResult> {
    if (!(movement.amount > 0)) {
      throw new BadRequestException('Credit amount must be greater than zero');
    }

    const transactionId = this.buildTransactionId('WT');

    const apply = async (client: WalletExecutor) => {
      const balanceRows = await client.query(
        `SELECT COALESCE(wallet_balance, 0)::numeric AS wallet_balance
           FROM customers
          WHERE customer_id = $1
          FOR UPDATE`,
        [movement.customerId],
      );

      if (!balanceRows.rows?.length) {
        throw new BadRequestException('Customer profile not found');
      }

      const balanceBefore = Number(balanceRows.rows[0].wallet_balance || 0);
      const balanceAfter = Number((balanceBefore + movement.amount).toFixed(2));

      await client.query(
        `UPDATE customers
            SET wallet_balance = $1, updated_at = NOW()
          WHERE customer_id = $2`,
        [balanceAfter, movement.customerId],
      );

      await client.query(
        `INSERT INTO customer_wallet_transactions (
           transaction_id, customer_id, transaction_type, amount, balance_after,
           reference_type, reference_id, remarks, created_by, created_at
         ) VALUES ($1, $2, 'credit', $3, $4, $5, $6, $7, $8, NOW())`,
        [
          transactionId,
          movement.customerId,
          movement.amount,
          balanceAfter,
          movement.referenceType,
          movement.referenceId,
          movement.remarks,
          movement.createdBy || movement.customerId,
        ],
      );

      return { transactionId, balanceBefore, balanceAfter, amount: movement.amount };
    };

    // Joining a caller's transaction: they own the commit, and the notification.
    if (executor) return apply(executor);

    const result = await this.db.transaction(apply);
    await this.notifyCredit(movement.customerId, result);
    return result;
  }

  /** Debits a wallet atomically, refusing to go negative. */
  async debit(movement: WalletMovement): Promise<WalletMovementResult> {
    if (!(movement.amount > 0)) {
      throw new BadRequestException('Debit amount must be greater than zero');
    }

    const transactionId = this.buildTransactionId('WD');

    return this.db.transaction(async (client) => {
      const balanceRows = await client.query(
        `SELECT COALESCE(wallet_balance, 0)::numeric AS wallet_balance
           FROM customers
          WHERE customer_id = $1
          FOR UPDATE`,
        [movement.customerId],
      );

      if (!balanceRows.rows?.length) {
        throw new BadRequestException('Customer profile not found');
      }

      const balanceBefore = Number(balanceRows.rows[0].wallet_balance || 0);
      if (balanceBefore < movement.amount) {
        throw new BadRequestException(
          'Insufficient wallet balance. Please top up your wallet.',
        );
      }

      const balanceAfter = Number((balanceBefore - movement.amount).toFixed(2));

      await client.query(
        `UPDATE customers
            SET wallet_balance = $1, updated_at = NOW()
          WHERE customer_id = $2`,
        [balanceAfter, movement.customerId],
      );

      await client.query(
        `INSERT INTO customer_wallet_transactions (
           transaction_id, customer_id, transaction_type, amount, balance_after,
           reference_type, reference_id, remarks, created_by, created_at
         ) VALUES ($1, $2, 'debit', $3, $4, $5, $6, $7, $8, NOW())`,
        [
          transactionId,
          movement.customerId,
          movement.amount,
          balanceAfter,
          movement.referenceType,
          movement.referenceId,
          movement.remarks,
          movement.createdBy || movement.customerId,
        ],
      );

      return { transactionId, balanceBefore, balanceAfter, amount: movement.amount };
    });
  }

  /** In-app + push notification. Never allowed to fail a committed credit. */
  /**
   * Sends the wallet-credit notification for a credit that joined a caller's
   * transaction. Call it only after that transaction has committed.
   */
  async notifyCreditCommitted(
    customerId: string,
    result: WalletMovementResult,
  ): Promise<void> {
    await this.notifyCredit(customerId, result);
  }

  private async notifyCredit(
    customerId: string,
    result: WalletMovementResult,
  ): Promise<void> {
    const title = 'Wallet Credited';
    const message = `Your wallet has been credited with ₹${result.amount.toFixed(0)}. New balance: ₹${result.balanceAfter.toFixed(0)}.`;

    try {
      const ts = Math.floor(Date.now() / 1000).toString(36);
      const rnd = Math.floor(Math.random() * 9000 + 1000);
      const notificationId = `NF${ts}${rnd}`;

      await this.db.query(
        `INSERT INTO notifications (
           notification_id, title, message, medium, type, priority, status,
           created_by, updated_by, created_at, updated_at
         ) VALUES ($1, $2, $3, 'websocket', 'success', 'medium', 'active',
                   'system', 'system', NOW(), NOW())`,
        [notificationId, title, message],
      );

      await this.db.query(
        `INSERT INTO notification_recipients (
           notification_id, user_id, status, notified_at,
           created_by, updated_by, created_at, updated_at
         ) VALUES ($1, $2, 'unread', NOW(), 'system', 'system', NOW(), NOW())`,
        [notificationId, customerId],
      );
    } catch (error) {
      this.developer.error('Wallet credit notification insert failed', {
        customerId,
        error,
      });
    }

    try {
      await this.pushNotificationService.sendNotificationToUsers([customerId], {
        title: 'Wallet Credited! 💳',
        body: message,
      });
    } catch (error) {
      this.developer.error('Wallet credit push notification failed', {
        customerId,
        error,
      });
    }
  }
}
