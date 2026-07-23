import TodayOrdersClient from '../TodayOrdersClient';

export default function OneTimeOrdersPage() {
  return (
    <TodayOrdersClient
      initialTab="one-time"
      title="One-time Orders"
      scope="all"
      fixedTab
      showDashboard={false}
    />
  );
}
