import TodayOrdersClient from '../TodayOrdersClient';

export default function SubscriptionOrdersPage() {
  return (
    <TodayOrdersClient
      initialTab="subscription"
      title="Subscription Orders"
      scope="all"
      fixedTab
      showDashboard={false}
    />
  );
}
