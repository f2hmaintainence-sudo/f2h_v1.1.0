'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { ChevronRight, Home, Plus, LayoutGrid, List } from 'lucide-react';
import Link from 'next/link';
import SkeletonTable from '@/components/Table Generator/SkeletonTable';
import { api as apiClient } from '@/services/api.client';
import { showSuccessToast, showErrorToast } from '@/components/Toast';

const SkeletonForm = dynamic(() => import('./SkeletonForm'), { ssr: false });
const SkeletonCard = dynamic(() => import('./SkeletonCard'), { ssr: false });
const SkeletonViewDrawer = dynamic(() => import('./SkeletonViewDrawer'), { ssr: false });
const DeleteConfirmModal = dynamic(() => import('./DeleteConfirmModal'), { ssr: false });

type RowData = Record<string, any>;

type RowIdentifier =
  | string
  | ((row: RowData) => string);

type ActionType = 'view' | 'edit' | 'delete';

type EndpointBuilder = (id: string) => string;

type CustomEndpoints = {
  table?: string;
  showAdd?: string;
  saveAdd?: string;
  showEdit?: EndpointBuilder;
  saveEdit?: EndpointBuilder;
  view?: EndpointBuilder;
  delete?: EndpointBuilder;
};

type Props = {
  title: string;
  apiBase?: string;
  endpoints?: CustomEndpoints;
  identifierKey?: RowIdentifier;
  actionTypes?: ActionType[];
  filters?: string[];
  enableCardView?: boolean;
  buttonLabel?: string;
  breadcrumbs?: Array<{ label: string; url?: string }>;
  modalsOnly?: boolean;
};

export default function TableComponents({
  title,
  apiBase,
  endpoints = {},
  identifierKey = 'id',
  actionTypes = ['view', 'edit', 'delete'],
  filters = [],
  enableCardView = false,
  buttonLabel,
  breadcrumbs = [],
  modalsOnly = false,
}: Props) {
  const [tableKey, setTableKey] = useState(0);
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');

  const [addOpen, setAddOpen] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [viewOpen, setViewOpen] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const [viewRow, setViewRow] = useState<RowData | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteRow, setDeleteRow] = useState<RowData | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const refreshTable = useCallback(() => {
    setTableKey((prev) => prev + 1);
  }, []);

  const api = useMemo(() => {
    if (!apiBase && !endpoints.table) {
      throw new Error(
        'PackageTablePage requires either "apiBase" or endpoints.table'
      );
    }

    return {
      table:
        endpoints.table ||
        `${apiBase}/table`,

      showAdd:
        endpoints.showAdd ||
        `${apiBase}/showAdd`,

      saveAdd:
        endpoints.saveAdd ||
        `${apiBase}/saveAdd`,

      showEdit:
        endpoints.showEdit ||
        ((id: string) => `${apiBase}/${id}/showEdit`),

      saveEdit:
        endpoints.saveEdit ||
        ((id: string) => `${apiBase}/${id}/saveEdit`),

      view:
        endpoints.view ||
        ((id: string) => `${apiBase}/${id}/view`),

      delete:
        endpoints.delete ||
        ((id: string) => `${apiBase}/${id}/delete`),
    };
  }, [apiBase, endpoints]);

  const tableEndpoint = useMemo(() => {
    const url = new URL(api.table, window.location.origin);

    filters.forEach((filter) => {
        url.searchParams.append('filters', filter);
    });

    return url.pathname + url.search;
   }, [api.table, filters]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteId) return;

    try {
        setDeleteLoading(true);
        setDeleteError(null);

        const result = await apiClient.delete<any>(api.delete(deleteId));

        if (result.error || result.data?.status === false) {
        throw new Error(result.error || result.data?.message || 'Delete failed');
        }

        setDeleteOpen(false);
        setDeleteId(null);
        setDeleteRow(null);
        setDeleteError(null);

        showSuccessToast(result.data?.message || 'Record deleted successfully');
        refreshTable();
    } catch (error: any) {
        const errorMsg = error.message || 'Unable to delete record';
        setDeleteError(errorMsg);
        showErrorToast(errorMsg);
    } finally {
        setDeleteLoading(false);
    }
  }, [api, deleteId, refreshTable]);

  const getRowIdentifier = useCallback(
    (row: RowData): string => {
        if (typeof identifierKey === 'function') {
        return String(identifierKey(row) ?? '');
        }

        if (identifierKey && row[identifierKey] !== undefined) {
        return String(row[identifierKey]);
        }

        const fallbackKeys = [
        'id',
        '_id',
        'uuid',
        'order_id',
        'subscription_id',
        'user_id',
        'customer_id',
        'product_id',
        'branch_id',
        ];

        for (const key of fallbackKeys) {
        if (row[key] !== undefined && row[key] !== null) {
            return String(row[key]);
        }
        }

        return '';
    },
    [identifierKey]
  );

  const handleAction = useCallback(
    async (type: string, row: RowData) => {
      const id = getRowIdentifier(row);
      if (!id) return;

      switch (type) {
        case 'view':
          setViewId(id);
          setViewRow(row);
          setViewOpen(true);
          break;

        case 'edit':
          setEditId(id);
          setEditOpen(true);
          break;
        case 'delete':
            setDeleteId(id);
            setDeleteRow(row);
            setDeleteError(null);
            setDeleteOpen(true);
        break;
      }
    },
    [getRowIdentifier],
  );

  useEffect(() => {
    const handleOpenAdd = () => {
      setAddOpen(true);
    };

    const handleCustomAction = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      const { type, id, row } = detail;
      const targetId = String(id || row?.id || row?.warehouse_id || row?.category_id || row?.product_id || '');

      if (type === 'add') {
        setAddOpen(true);
      } else if (type === 'edit') {
        if (targetId) {
          setEditId(targetId);
          setEditOpen(true);
        }
      } else if (type === 'view') {
        if (targetId) {
          setViewId(targetId);
          setViewRow(row || {});
          setViewOpen(true);
        }
      } else if (type === 'delete') {
        if (targetId) {
          setDeleteId(targetId);
          setDeleteRow(row || {});
          setDeleteError(null);
          setDeleteOpen(true);
        }
      }
    };

    window.addEventListener('table:add', handleOpenAdd);
    window.addEventListener('table:action', handleCustomAction as EventListener);
    window.addEventListener('table:edit', handleCustomAction as EventListener);
    window.addEventListener('table:view', handleCustomAction as EventListener);
    return () => {
      window.removeEventListener('table:add', handleOpenAdd);
      window.removeEventListener('table:action', handleCustomAction as EventListener);
      window.removeEventListener('table:edit', handleCustomAction as EventListener);
      window.removeEventListener('table:view', handleCustomAction as EventListener);
    };
  }, []);

  if (modalsOnly) {
    return (
      <>
        {/* Add Drawer */}
        <SkeletonForm
          isOpen={addOpen}
          onClose={() => setAddOpen(false)}
          apiEndpoint={api.showAdd}
          submitEndpoint={api.saveAdd}
          onSuccess={() => {
            setAddOpen(false);
            refreshTable();
            if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('table:refresh'));
          }}
        />

        {/* Edit Drawer */}
        {editId && (
          <SkeletonForm
            isOpen={editOpen}
            onClose={() => {
              const closedId = editId;
              setEditOpen(false);
              setEditId(null);
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('table:edit:closed', { detail: { id: closedId, saved: false } }));
              }
            }}
            apiEndpoint={api.showEdit(editId)}
            submitEndpoint={api.saveEdit(editId)}
            onSuccess={() => {
              const closedId = editId;
              setEditOpen(false);
              setEditId(null);
              refreshTable();
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('table:refresh'));
                window.dispatchEvent(new CustomEvent('table:edit:closed', { detail: { id: closedId, saved: true } }));
              }
            }}
          />
        )}

        {/* View Drawer */}
        <SkeletonViewDrawer
          isOpen={viewOpen}
          onClose={() => {
            setViewOpen(false);
            setViewId(null);
            setViewRow(null);
          }}
          title={`${title || ''} Details`}
          rowData={viewRow}
          viewEndpoint={viewId ? api.view(viewId) : undefined}
        />

        <DeleteConfirmModal
          isOpen={deleteOpen}
          loading={deleteLoading}
          error={deleteError}
          title={`Delete ${title || ''}?`}
          message={`Are you sure you want to delete this ${title || 'item'}? This action cannot be undone.`}
          itemName={
            deleteRow?.name ||
            deleteRow?.title ||
            deleteRow?.code ||
            deleteId ||
            undefined
          }
          onClose={() => {
            setDeleteOpen(false);
            setDeleteId(null);
            setDeleteRow(null);
            setDeleteError(null);
          }}
          onConfirm={handleDeleteConfirm}
        />
      </>
    );
  }

  return (
    <div className="space-y-1 font-sans min-h-screen">
      {/* Breadcrumbs & Add Button */}
      <div className="flex items-center justify-between">

        {buttonLabel && (
          <button
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-fresh-green text-white text-sm font-bold rounded-xl shadow-md shadow-fresh-green/20 hover:bg-deep-green hover:shadow-lg transition-all"
          >
            <Plus size={16} />
            {buttonLabel}
          </button>
        )}
      </div>

      {/* Header & Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            {title}
          </h1>
        </div>
        {enableCardView && (
          <div className="flex items-center bg-gray-100 p-1 rounded-xl shadow-inner border border-gray-200/50 gap-1 bg-gray-200/40">
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-lg transition-all ${
                viewMode === 'table'
                  ? 'bg-white text-fresh-green shadow-sm'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
              title="Table View"
            >
              <List size={18} />
            </button>
            <button
              onClick={() => setViewMode('card')}
              className={`p-2 rounded-lg transition-all ${
                viewMode === 'card'
                  ? 'bg-white text-fresh-green shadow-sm'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
              title="Card View"
            >
              <LayoutGrid size={18} />
            </button>
          </div>
        )}
      </div>

      {/* Main Table / Grid */}
      {viewMode === 'card' ? (
        <SkeletonCard
          key={tableKey}
          apiEndpoint={api.table}
          onAction={handleAction}
          initialPageSize={12}
        />
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100/80 overflow-hidden">
          {/* Table */}
          <SkeletonTable
            key={tableKey}
            apiEndpoint={tableEndpoint}
            onAction={handleAction}
            actionTypes={actionTypes}
            initialPageSize={10}
          />
        </div>
      )}

      {/* Add Drawer */}
      <SkeletonForm
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        apiEndpoint={api.showAdd}
        submitEndpoint={api.saveAdd}
        onSuccess={() => {
          setAddOpen(false);
          refreshTable();
        }}
      />

      {/* Edit Drawer */}
      {editId && (
        <SkeletonForm
          isOpen={editOpen}
          onClose={() => {
            const closedId = editId;
            setEditOpen(false);
            setEditId(null);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('table:edit:closed', { detail: { id: closedId, saved: false } }));
            }
          }}
          apiEndpoint={api.showEdit(editId)}
          submitEndpoint={api.saveEdit(editId)}
          onSuccess={() => {
            const closedId = editId;
            setEditOpen(false);
            setEditId(null);
            refreshTable();
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('table:refresh'));
              window.dispatchEvent(new CustomEvent('table:edit:closed', { detail: { id: closedId, saved: true } }));
            }
          }}
        />
      )}

      {/* View Drawer */}
      <SkeletonViewDrawer
        isOpen={viewOpen}
        onClose={() => {
          setViewOpen(false);
          setViewId(null);
          setViewRow(null);
        }}
        title={`${title} Details`}
        rowData={viewRow}
        viewEndpoint={viewId ? api.view(viewId) : undefined}
      />

      <DeleteConfirmModal
        isOpen={deleteOpen}
        loading={deleteLoading}
        error={deleteError}
        title={`Delete ${title}?`}
        message={`Are you sure you want to delete this ${title}? This action cannot be undone.`}
        itemName={
          deleteRow?.name ||
          deleteRow?.title ||
          deleteRow?.code ||
          deleteId ||
          undefined
        }
        onClose={() => {
          setDeleteOpen(false);
          setDeleteId(null);
          setDeleteRow(null);
          setDeleteError(null);
        }}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
