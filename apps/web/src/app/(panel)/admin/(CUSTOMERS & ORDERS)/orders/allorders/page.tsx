import TodayOrdersClient from '../TodayOrdersClient';

export default function AllOrdersPage() {
  return (
    <TodayOrdersClient
      initialTab="all"
      title="All Orders"
      scope="all"
      showDashboard
    />
  );
}
