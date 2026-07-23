import TodayOrdersClient from '../TodayOrdersClient';

export default function FailedPendingOrdersPage() {
  return (
    <TodayOrdersClient
      initialTab="all"
      title="Failed Orders"
      scope="all"
      fixedTab
      filters={['failed']}
      showDashboard={false}
    />
  );
}
