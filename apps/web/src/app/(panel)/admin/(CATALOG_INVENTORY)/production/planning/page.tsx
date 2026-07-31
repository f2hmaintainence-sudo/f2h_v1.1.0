'use client';

import React, { useState, useCallback } from 'react';
import {
  ClipboardList,
  Plus,
  Home,
  ChevronRight,
  Play,
  CheckCircle,
  XCircle,
  MoreVertical
} from 'lucide-react';
import Link from 'next/link';
import SkeletonTable from '@/components/Table Generator/SkeletonTable';
import SkeletonForm from '@/components/Table Generator/SkeletonForm';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function ProductionPlanningPage() {
  const [addFormOpen, setAddFormOpen] = useState(false);
  const [editFormOpen, setEditFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [tableKey, setTableKey] = useState(0);

  const refreshTable = useCallback(() => setTableKey(prev => prev + 1), []);

  const handleAction = useCallback(async (type: string, row: any) => {
    const id = row.id;

    if (type === 'edit') {
      setEditId(id);
      setEditFormOpen(true);
    } else if (type === 'view') {
      // Implement view if needed
    } else if (type === 'delete') {
      // Implement delete if needed
    }
  }, []);

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`${API_URL}/admin/production/planning/updateStatus/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
        credentials: 'include'
      });
      const result = await res.json();
      if (result.status) {
        refreshTable();
      } else {
        alert(result.message || 'Failed to update status');
      }
    } catch (error) {
      alert('Network error while updating status');
    }
  };

  const handleAddSuccess = () => {
    setAddFormOpen(false);
    refreshTable();
  };

  const handleEditSuccess = () => {
    setEditFormOpen(false);
    setEditId(null);
    refreshTable();
  };

  // Custom Actions for the table
  const renderCustomActions = (row: any) => {
    const status = row.production_status || 'planned';

    return (
      <div className="flex items-center gap-2">
        {status === 'planned' && (
          <button
            onClick={() => updateStatus(row.id, 'in_progress')}
            className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
            title="Start Production"
          >
            <Play size={14} />
          </button>
        )}
        {status === 'in_progress' && (
          <button
            onClick={() => updateStatus(row.id, 'completed')}
            className="p-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"
            title="Complete Production"
          >
            <CheckCircle size={14} />
          </button>
        )}
        {(status === 'planned' || status === 'in_progress') && (
          <button
            onClick={() => updateStatus(row.id, 'cancelled')}
            className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
            title="Cancel Plan"
          >
            <XCircle size={14} />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 p-4 md:p-6 font-sans bg-[#f9f6ef] min-h-screen">
      {/* Breadcrumbs */}
      <div className="flex items-center justify-between">
        <nav className="flex items-center gap-1.5 text-sm text-gray-500" aria-label="Breadcrumb">
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center gap-1 hover:text-fresh-green transition-colors"
          >
            <Home size={14} />
            <span>Dashboard</span>
          </Link>
          <ChevronRight size={14} className="text-gray-300" />
          <span className="text-gray-400">Production</span>
          <ChevronRight size={14} className="text-gray-300" />
          <span className="font-semibold text-deep-green">Planning</span>
        </nav>

        <button
          onClick={() => setAddFormOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-fresh-green text-white text-sm font-bold rounded-xl shadow-md shadow-fresh-green/20 hover:bg-deep-green hover:shadow-lg transition-all"
        >
          <Plus size={16} />
          Create Plan
        </button>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <ClipboardList className="text-fresh-green" size={24} />
          Production Planning
        </h1>
        <p className="text-sm text-gray-500">Plan and track your production cycles, raw material consumption, and batch generation.</p>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100/80 overflow-hidden">
        <SkeletonTable
          key={tableKey}
          apiEndpoint="/admin/production/planning/table"
          onAction={handleAction}
          initialPageSize={10}
        />
      </div>

      {/* Add Plan Form */}
      <SkeletonForm
        isOpen={addFormOpen}
        onClose={() => setAddFormOpen(false)}
        apiEndpoint="/admin/production/planning/showAdd"
        submitEndpoint="/admin/production/planning/saveAdd"
        onSuccess={handleAddSuccess}
      />

      {/* Edit Plan Form */}
      {editId && (
        <SkeletonForm
          isOpen={editFormOpen}
          onClose={() => {
            setEditFormOpen(false);
            setEditId(null);
          }}
          apiEndpoint={`/admin/production/planning/showEdit/${editId}`}
          submitEndpoint={`/admin/production/planning/saveEdit/${editId}`}
          onSuccess={handleEditSuccess}
        />
      )}
    </div>
  );
}
