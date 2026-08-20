import { redirect } from 'next/navigation';

export default function FinanceBillingPage() {
  redirect('/admin/finance/outstandings');
}
