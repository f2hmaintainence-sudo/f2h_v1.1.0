'use client';

import TableComponents from '@/components/Table Generator/TableComponents';

export default function PurchaseOrdersPage() {
  return (
    <TableComponents
      title="Purchase Orders"
      endpoints={{
        table: '/vendors/purchase-orders/table',
        showAdd: '/vendors/purchase-orders/showAdd',
        saveAdd: '/vendors/purchase-orders/saveAdd',
        showEdit: (id: string) => `/vendors/purchase-orders/showEdit/${id}`,
        saveEdit: (id: string) => `/vendors/purchase-orders/saveEdit/${id}`,
        view: (id: string) => `/vendors/purchase-orders/${id}/view`,
        delete: (id: string) => `/vendors/purchase-orders/${id}/softDelete`,
      }}
      identifierKey="id"
      enableCardView={false}
      buttonLabel="Add Purchase Order"
      breadcrumbs={[
        {
          label: 'Logistics and Vendors',
        },
        {
          label: 'Vendors',
        },
        {
          label: 'Purchase Orders',
        },
      ]}
    />
  );
}
