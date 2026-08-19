import { Controller, Get } from '@nestjs/common';
import { Roles, ROLE } from 'src/auth/decorators/roles.decorator';
import { WalletReconciliationService } from './wallet-reconciliation.service';

/**
 * On-demand view of the same check the nightly job runs. Read-only: correcting a
 * drift is a money decision, not something an endpoint should do.
 */
@Roles(ROLE.ADMIN, ROLE.SUPER_ADMIN)
@Controller({ path: 'admin/finance/wallet-reconciliation', version: '1' })
export class WalletReconciliationController {
  constructor(private readonly reconciliation: WalletReconciliationService) {}

  @Get()
  async getDrift() {
    const { ledgerDrift, mirrorDrift } = await this.reconciliation.reconcile();

    return {
      status: true,
      data: {
        clean: ledgerDrift.length === 0 && mirrorDrift.length === 0,
        // `customers.wallet_balance` vs the sum of customer_wallet_transactions.
        ledgerDrift,
        // `customers.wallet_balance` vs `customer_wallet_balances.wallet_balance`.
        mirrorDrift,
      },
    };
  }
}
