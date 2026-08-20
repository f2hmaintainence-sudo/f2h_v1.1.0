import { Injectable } from '@nestjs/common';
import {
  FieldDef,
  FormHelper,
  FormResponse,
} from '../../../../../helpers/FormHelper';
import { DatabaseService } from '../../../../../shared/database/Database.service';

@Injectable()
export class SubscriptionsShowAddService {
  constructor(
    private readonly formHelper: FormHelper,
    private readonly db: DatabaseService,
  ) {}

  getSubscriptionsForm(): FormResponse {
    return this.formHelper.generateResponse({
      title: 'Add Subscription',
      submitLabel: 'Create Subscription',
      fields: this.subscriptionsFields(),
      script: '',
    });
  }

  subscriptionsFields(): FieldDef[] {
    return [
      {
        name: 'subscription_number',
        label: 'Subscription Number',
        type: 'text',
        required: true,
        width: 'half',
        placeholder: 'SUB-0001',
        validation: { maxLength: 50 },
      },
      {
        name: 'customer_id',
        label: 'Customer ID',
        type: 'text',
        required: true,
        width: 'half',
        placeholder: 'Customer UUID',
      },
      {
        name: 'schedule_type',
        label: 'Schedule Type',
        type: 'select',
        required: true,
        width: 'half',
        defaultValue: 'weekly',
        options: [
          { value: 'weekly', label: 'Weekly' },
          { value: 'custom_dates', label: 'Custom Dates' },
        ],
      },
      {
        name: 'payment_type',
        label: 'Payment Type',
        type: 'select',
        required: true,
        width: 'half',
        defaultValue: 'prepaid',
        options: [
          { value: 'prepaid', label: 'Prepaid' },
          { value: 'postpaid', label: 'Postpaid' },
        ],
      },
      {
        name: 'start_date',
        label: 'Start Date',
        type: 'date',
        required: true,
        width: 'half',
      },
      {
        name: 'end_date',
        label: 'End Date',
        type: 'date',
        required: false,
        width: 'half',
      },
      {
        name: 'billing_cycle',
        label: 'Billing Cycle',
        type: 'text',
        required: false,
        width: 'half',
        defaultValue: 'monthly',
        placeholder: 'monthly',
      },
      {
        name: 'renewal_grace_days',
        label: 'Renewal Grace Days',
        type: 'number',
        required: false,
        width: 'half',
        defaultValue: 3,
        validation: { min: 0, max: 31 },
      },
      {
        name: 'status',
        label: 'Status',
        type: 'select',
        required: true,
        width: 'half',
        defaultValue: 'active',
        options: [
          { value: 'active', label: 'Active' },
          { value: 'paused', label: 'Paused' },
          { value: 'cancelled', label: 'Cancelled' },
          { value: 'expired', label: 'Expired' },
        ],
      },
      {
        name: 'pause_reason',
        label: 'Pause Reason',
        type: 'textarea',
        required: false,
        width: 'full',
        validation: { maxLength: 1000 },
      },
      {
        name: 'auto_renew',
        label: 'Auto Renew',
        type: 'toggle',
        required: false,
        width: 'half',
        defaultValue: false,
      },
      {
        name: 'cancel_reason',
        label: 'Cancel Reason',
        type: 'textarea',
        required: false,
        width: 'full',
        validation: { maxLength: 1000 },
      },
      {
        name: 'notes',
        label: 'Notes',
        type: 'textarea',
        required: false,
        width: 'full',
        validation: { maxLength: 1000 },
      },
    ];
  }

  async subscriptionOverrideFields(): Promise<FieldDef[]> {
    const variants = await this.getSubscribableProductVariants();

    return [
      {
        name: 'subscription_item_id',
        label: 'Subscription Item ID',
        type: 'text',
        required: true,
        width: 'half',
        placeholder: 'Subscription item ID',
        validation: { maxLength: 30 },
      },
      {
        name: 'product_variant_id',
        label: 'Product',
        type: 'select',
        required: false,
        width: 'half',
        options: variants.map((variant: any) => ({
          value: variant.variant_id,
          label: `${variant.product_name} - ${variant.variant_name}`,
        })),
        disabled: true,
      },
      {
        name: 'override_date',
        label: 'Override Date',
        type: 'date',
        required: true,
        width: 'half',
      },
      {
        name: 'override_type',
        label: 'Override Type',
        type: 'select',
        required: true,
        width: 'half',
        options: [
          { value: 'extra', label: 'Extra' },
          { value: 'cod', label: 'COD' },
          { value: 'replace', label: 'Replace' },
          { value: 'cancel', label: 'Cancel' },
        ],
      },
      {
        name: 'm_quantity',
        label: 'Morning Quantity',
        type: 'number',
        required: false,
        width: 'half',
        defaultValue: 0,
        validation: { min: 0 },
      },
      {
        name: 'e_quantity',
        label: 'Evening Quantity',
        type: 'number',
        required: false,
        width: 'half',
        defaultValue: 0,
        validation: { min: 0 },
      },
      {
        name: 'is_paid',
        label: 'Paid',
        type: 'toggle',
        required: false,
        width: 'half',
        defaultValue: false,
      },
      {
        name: 'notes',
        label: 'Notes',
        type: 'textarea',
        required: false,
        width: 'full',
        validation: { maxLength: 1000 },
      },
    ];
  }

  private async getSubscribableProductVariants() {
    return this.db.query(
      `
      SELECT
        pv.variant_id::text AS variant_id,
        COALESCE(p.name, 'Product') AS product_name,
        pv.name AS variant_name
      FROM product_variants pv
      JOIN products p
        ON p.product_id = pv.product_id
        OR p.id::text = pv.product_id
      WHERE pv.deleted_at IS NULL
        AND pv.status = 'active'
        AND p.deleted_at IS NULL
        AND p.is_active = true
        AND p.is_subscribable = true
      ORDER BY p.name ASC, pv.sort_order ASC, pv.name ASC
      `,
    );
  }
}
