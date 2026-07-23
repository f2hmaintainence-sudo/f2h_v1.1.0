'use client';

import TableComponents from '@/components/Table Generator/TableComponents';

export default function ProductsPage() {
  return (

   

    <TableComponents
      title="Vendor List"
      endpoints={{
        table: '/vendors/vendor-list/table',
        showAdd: '/vendors/vendor-list/showAdd',
        saveAdd: '/vendors/vendor-list/saveAdd',
        showEdit: (id: string) => `/vendors/vendor-list/showEdit/${id}`,
        saveEdit: (id: string) => `/vendors/vendor-list/saveEdit/${id}`,
        view: (id: string) => `/vendors/vendor-list/${id}/view`,
        delete: (id: string) => `/vendors/vendor-list/${id}/softDelete`,
      }}
      identifierKey="id"
      enableCardView={false}
      buttonLabel="Add Vendor"
      breadcrumbs={[
        {
          label: 'Logistics and Vendors',
        },
        {
          label: 'Warehouses',
        },
        {
          label: 'Transfers',
        },
      ]}
    />
  );
}
