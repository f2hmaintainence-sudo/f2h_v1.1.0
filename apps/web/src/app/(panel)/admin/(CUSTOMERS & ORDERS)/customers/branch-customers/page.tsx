'use client';

import { getApiBaseUrl } from '@/lib/api-config';

import React, { useState, useEffect } from 'react';
import { HardHat, Users, Filter } from 'lucide-react';
import SkeletonTable from '@/components/Table Generator/SkeletonTable';

export default function BranchCustomersPage() {
  const [branches, setBranches] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);

  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [selectedZone, setSelectedZone] = useState<string>('');
  const [tableKey, setTableKey] = useState<number>(0);

  // Fetch Branches on mount
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const apiUrl = getApiBaseUrl();
        const res = await fetch(`${apiUrl}/admin/zone/branches-list`);
        const json = await res.json();
        if (json.status && Array.isArray(json.data)) {
          setBranches(json.data);
        }
      } catch (error) {
        console.error('Error fetching branches:', error);
      }
    };
    fetchBranches();
  }, []);

  // Fetch Zones when Branch changes
  useEffect(() => {
    if (!selectedBranch) {
      setZones([]);
      setSelectedZone('');
      return;
    }

    const fetchZones = async () => {
      try {
        const apiUrl = getApiBaseUrl();
        const res = await fetch(`${apiUrl}/admin/zone/zones-list/${selectedBranch}`);
        const json = await res.json();
        if (json.status && Array.isArray(json.data)) {
          setZones(json.data);
        }
      } catch (error) {
        console.error('Error fetching zones:', error);
      }
    };
    fetchZones();
  }, [selectedBranch]);

  // Handle Action
  const handleAction = (action: string, row: any) => {
    console.log(`Action ${action} clicked for customer`, row);
  };

  // Construct API endpoint dynamically based on filters
  let apiEndpoint = '/admin/customer/table';
  const queryParams = [];
  if (selectedBranch) queryParams.push(`branch_id=${selectedBranch}`);
  if (selectedZone) queryParams.push(`zone_id=${selectedZone}`);

  if (queryParams.length > 0) {
    apiEndpoint += `?${queryParams.join('&')}`;
  }

  return (
    <div className="flex flex-col min-h-[80vh] w-full p-6 bg-gray-50/50">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 tracking-tight flex items-center gap-3">
          <Users className="w-8 h-8 text-fresh-green" />
          Branch Customer Management
        </h1>
        <p className="text-gray-500 mt-2 text-sm">
          Select a branch and a zone to view associated customers.
        </p>
      </div>

      {/* Filter Section */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-6 items-end mb-6">
        <div className="flex flex-col gap-2 min-w-[250px]">
          <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Filter size={16} className="text-gray-400" />
            Select Branch
          </label>
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-fresh-green/20 focus:border-fresh-green transition-all"
          >
            <option value="">All Branches</option>
            {branches.map((b) => (
              <option key={b.branch_id} value={b.branch_id}>
                {b.branch_name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2 min-w-[250px]">
          <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Filter size={16} className="text-gray-400" />
            Select Zone
          </label>
          <select
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
            disabled={!selectedBranch}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-fresh-green/20 focus:border-fresh-green transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">All Zones</option>
            {zones.map((z) => (
              <option key={z.zone_id} value={z.zone_id}>
                {z.zone_name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
