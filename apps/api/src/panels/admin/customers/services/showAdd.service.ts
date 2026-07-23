import { Injectable } from '@nestjs/common';
import {
  FormHelper,
  FormResponse,
  FieldDef,
} from '../../../../helpers/FormHelper';

@Injectable()
export class CustomerShowAddService {
  constructor(private readonly formHelper: FormHelper) {}

  getCustomersForm(): FormResponse {
    const fields: FieldDef[] = [
      {
        name: 'full_name',
        label: 'Full Name',
        type: 'text',
        required: true,
        width: 'half',
        placeholder: 'Enter full name',
        validation: { minLength: 2, maxLength: 150 },
      },
      {
        name: 'phone',
        label: 'Phone',
        type: 'phone',
        required: true,
        width: 'half',
        placeholder: '+91 9876543210',
        validation: {
          minLength: 10,
          maxLength: 20,
          pattern: '^\\+?[0-9]+$',
          message: 'Enter a valid phone number',
        },
      },
      {
        name: 'email',
        label: 'Email',
        type: 'email',
        required: false,
        width: 'half',
        placeholder: 'customer@example.com',
        validation: {
          pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
          message: 'Enter a valid email',
        },
      },
      // {
      //   name: 'zone_id',
      //   label: 'Zone',
      //   type: 'text',
      //   required: false,
      //   width: 'half',
      //   placeholder: 'e.g. zone UUID',
      //   validation: { maxLength: 50 },
      // },
      {
        name: 'referral_status',
        label: 'Referral Code',
        type: 'text',
        required: false,
        width: 'half',
        placeholder: 'e.g. REF-ABC123',
        validation: { maxLength: 20 },
      },
      {
        name: 'postpaid_credit_limit',
        label: 'Postpaid Credit Limit (₹)',
        type: 'number',
        required: false,
        width: 'half',
        defaultValue: 0,
        placeholder: '0',
        validation: { min: 0, max: 999999 },
      },
      {
        name: 'is_postpaid_enabled',
        label: 'Postpaid Enabled',
        type: 'toggle',
        required: false,
        width: 'half',
        defaultValue: false,
      },
      {
        name: 'is_blocked',
        label: 'Blocked',
        type: 'toggle',
        required: false,
        width: 'half',
        defaultValue: false,
      },
      {
        name: 'block_reason',
        label: 'Block Reason',
        type: 'textarea',
        required: false,
        width: 'full',
        placeholder: 'Reason for blocking (if applicable)',
        validation: { maxLength: 1000 },
      },
    ];
    return this.formHelper.generateResponse({
      title: 'Add Customer',
      submitLabel: 'Create Customer',
      fields: fields,
      script: '',
    });
  }

  /** Shared field definitions — used by both showAdd and showEdit */
  customersFields(): FieldDef[] {
    return [
      {
        name: 'full_name',
        label: 'Full Name',
        type: 'text',
        required: true,
        width: 'half',
        placeholder: 'Enter full name',
        validation: { minLength: 2, maxLength: 150 },
      },
      {
        name: 'phone',
        label: 'Phone',
        type: 'phone',
        required: true,
        width: 'half',
        placeholder: '+91 9876543210',
        validation: {
          minLength: 10,
          maxLength: 20,
          pattern: '^\\+?[0-9]+$',
          message: 'Enter a valid phone number',
        },
      },
      {
        name: 'email',
        label: 'Email',
        type: 'email',
        required: false,
        width: 'half',
        placeholder: 'customer@example.com',
        validation: {
          pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
          message: 'Enter a valid email',
        },
      },
      // {
      //   name: 'zone_id',
      //   label: 'Zone',
      //   type: 'text',
      //   required: false,
      //   width: 'half',
      //   placeholder: 'e.g. zone UUID',
      //   validation: { maxLength: 50 },
      // },
      {
        name: 'referral_status',
        label: 'Referral Code',
        type: 'text',
        required: false,
        width: 'half',
        placeholder: 'e.g. REF-ABC123',
        validation: { maxLength: 20 },
      },
      {
        name: 'postpaid_credit_limit',
        label: 'Postpaid Credit Limit (₹)',
        type: 'number',
        required: false,
        width: 'half',
        defaultValue: 0,
        placeholder: '0',
        validation: { min: 0, max: 999999 },
      },
      {
        name: 'is_postpaid_enabled',
        label: 'Postpaid Enabled',
        type: 'toggle',
        required: false,
        width: 'half',
        defaultValue: false,
      },
      {
        name: 'is_blocked',
        label: 'Blocked',
        type: 'toggle',
        required: false,
        width: 'half',
        defaultValue: false,
      },
      {
        name: 'block_reason',
        label: 'Block Reason',
        type: 'textarea',
        required: false,
        width: 'full',
        placeholder: 'Reason for blocking (if applicable)',
        validation: { maxLength: 1000 },
      },
    ];
  }

  // ═══════════════════════════════════════════════════════════════
  // WALLET TRANSACTIONS — Add Form
  // ═══════════════════════════════════════════════════════════════

  getWalletTransactionsForm(): FormResponse {
    return this.formHelper.generateResponse({
      title: 'Add Wallet Transaction',
      submitLabel: 'Create Transaction',
      fields: this.walletTransactionsFields(),
      script: '',
    });
  }

  /** Shared field definitions for wallet_transactions */
  walletTransactionsFields(): FieldDef[] {
    return [
      {
        name: 'customer_id',
        label: 'Customer ID',
        type: 'text',
        required: true,
        width: 'half',
        placeholder: 'Customer UUID',
        validation: { maxLength: 50 },
      },
      {
        name: 'wallet_id',
        label: 'Wallet ID',
        type: 'text',
        required: true,
        width: 'half',
        placeholder: 'Wallet UUID',
        validation: { maxLength: 50 },
      },
      {
        name: 'direction',
        label: 'Direction',
        type: 'select',
        required: true,
        width: 'half',
        defaultValue: 'credit',
        options: [
          { value: 'credit', label: 'Credit' },
          { value: 'debit', label: 'Debit' },
        ],
      },
      {
        name: 'amount',
        label: 'Amount (₹)',
        type: 'number',
        required: true,
        width: 'half',
        placeholder: '0.00',
        validation: { min: 0.01, max: 999999 },
      },
      {
        name: 'balance_before',
        label: 'Balance Before (₹)',
        type: 'number',
        required: true,
        width: 'half',
        placeholder: '0.00',
        validation: { min: 0, max: 999999 },
      },
      {
        name: 'balance_after',
        label: 'Balance After (₹)',
        type: 'number',
        required: true,
        width: 'half',
        placeholder: '0.00',
        validation: { min: 0, max: 999999 },
      },
      {
        name: 'reason',
        label: 'Reason',
        type: 'select',
        required: true,
        width: 'half',
        options: [
          { value: 'topup', label: 'Top-up' },
          { value: 'order_payment', label: 'Order Payment' },
          { value: 'refund', label: 'Refund' },
          { value: 'cashback', label: 'Cashback' },
          { value: 'admin_credit', label: 'Admin Credit' },
          { value: 'admin_debit', label: 'Admin Debit' },
          { value: 'reversal', label: 'Reversal' },
          { value: 'other', label: 'Other' },
        ],
      },
      {
        name: 'reference_type',
        label: 'Reference Type',
        type: 'text',
        required: false,
        width: 'half',
        placeholder: 'e.g. order, refund',
        validation: { maxLength: 50 },
      },
      {
        name: 'description',
        label: 'Description',
        type: 'textarea',
        required: false,
        width: 'full',
        placeholder: 'Transaction description...',
        validation: { maxLength: 500 },
      },
      {
        name: 'initiated_by',
        label: 'Initiated By',
        type: 'text',
        required: false,
        width: 'half',
        placeholder: 'Admin ID or system',
        validation: { maxLength: 30 },
      },
    ];
  }
}
