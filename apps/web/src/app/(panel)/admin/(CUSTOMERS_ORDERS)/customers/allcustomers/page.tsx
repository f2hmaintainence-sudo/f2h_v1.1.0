'use client';

import React, { useState, useEffect } from 'react';
import {
  ChevronRight,
  Home,
  Search,
  Grid,
  List as ListIcon,
  Phone,
  Mail,
  ChevronDown,
  ArrowRight,
  Users,
  Repeat,
  CreditCard,
  TrendingUp,
  AlertTriangle,
  ShieldAlert,
  ArrowDownUp
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/services/api.client';

export default function AllCustomersPage() {
  const router = useRouter();
  
  const [data, setData] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeTab, setActiveTab] = useState('All Customers');

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(12);

  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedWallet, setSelectedWallet] = useState('');
  const [selectedDue, setSelectedDue] = useState('');

  useEffect(() => {
    fetchCustomers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, page, limit, selectedBranch, selectedStatus, selectedWallet, selectedDue]);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      let type = '';
      if (activeTab === 'Subscribers') type = 'subscriber';
      if (activeTab === 'Postpaid') type = 'postpaid';
      if (activeTab === 'One-Time Only') type = 'non_subscriber';

      const queryParams = new URLSearchParams({
        type,
        page: String(page),
        limit: String(limit),
        search,
        branchId: selectedBranch,
        status: selectedStatus,
        wallet: selectedWallet,
        due: selectedDue,
      });

      const res = await api.get(`/admin/customer/intelligence-list?${queryParams.toString()}`);
      
      if (res.data) {
        const payload = res.data as any;
        setData(payload.data || []);
        setSummary(payload.summary || {});
        if (payload.branches) setBranches(payload.branches);
      }
    } catch (error) {
      console.error('Failed to fetch customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchCustomers();
  };

  return (
    <div className="space-y-6 p-4 md:p-6 font-sans min-h-screen bg-slate-50/50">
      {/* Breadcrumbs */}
      <div className="flex items-center justify-between">
        <nav className="flex items-center gap-1.5 text-sm text-gray-500" aria-label="Breadcrumb">
          <Link href="/admin/dashboard" className="inline-flex items-center gap-1 hover:text-fresh-green transition-colors">
            <Home size={14} />
            <span>Dashboard</span>
          </Link>
          <ChevronRight size={14} className="text-gray-300" />
          <span className="text-gray-400">Customers</span>
          <ChevronRight size={14} className="text-gray-300" />
          <span className="font-bold text-deep-green">Intelligence Dashboard & CRM</span>
        </nav>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard title="TOTAL CUSTOMERS" value={summary.total_customers || '0'} icon={<Users size={16} className="text-emerald-500" />} bg="bg-emerald-50" />
        <StatCard title="SUBSCRIBERS" value={summary.active_subscribers || '0'} icon={<Repeat size={16} className="text-teal-500" />} bg="bg-teal-50" />
        <StatCard title="POSTPAID ACCOUNTS" value={summary.postpaid_accounts || '0'} icon={<CreditCard size={16} className="text-blue-500" />} bg="bg-blue-50" />
        <StatCard title="TOTAL SALES" value={`₹${Number(summary.total_revenue || 0).toLocaleString()}`} icon={<TrendingUp size={16} className="text-emerald-600" />} bg="bg-emerald-50" />
        <StatCard title="TOTAL DUE" value={`₹${Number(summary.total_due || 0).toLocaleString()}`} icon={<AlertTriangle size={16} className="text-red-500" />} bg="bg-red-50" />
        <StatCard title="BLOCKED" value={summary.blocked_accounts || '0'} icon={<ShieldAlert size={16} className="text-amber-500" />} bg="bg-amber-50" />
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          
          <form onSubmit={handleSearch} className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Search by Name, Mobile, Email, ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-fresh-green/20 outline-none text-sm"
            />
          </form>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 w-full md:w-auto">
            {['All Customers', 'Subscribers', 'Postpaid', 'One-Time Only'].map((tab) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setPage(1); }}
                className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === tab 
                    ? 'bg-fresh-green text-white shadow-md shadow-fresh-green/20' 
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {tab}
              </button>
            ))}
            
            <div className="flex items-center bg-gray-50 p-1 rounded-xl ml-2">
              <button 
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg ${viewMode === 'grid' ? 'bg-white shadow-sm text-fresh-green' : 'text-gray-400'}`}
              >
                <Grid size={18} />
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg ${viewMode === 'list' ? 'bg-white shadow-sm text-fresh-green' : 'text-gray-400'}`}
              >
                <ListIcon size={18} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          {/* Branch Filter Dropdown */}
          <div className="relative">
            <select
              value={selectedBranch}
              onChange={(e) => { setSelectedBranch(e.target.value); setPage(1); }}
              className="appearance-none bg-white border border-gray-200 rounded-xl px-4 py-2 pr-8 text-sm font-medium text-fresh-green hover:bg-gray-50 focus:outline-none cursor-pointer"
            >
              <option value="">All Branches</option>
              {branches.map((b: any) => (
                <option key={b.branch_id} value={b.branch_id}>
                  {b.branch_name}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

          {/* Account Status Filter Dropdown */}
          <div className="relative">
            <select
              value={selectedStatus}
              onChange={(e) => { setSelectedStatus(e.target.value); setPage(1); }}
              className="appearance-none bg-white border border-gray-200 rounded-xl px-4 py-2 pr-8 text-sm font-medium text-fresh-green hover:bg-gray-50 focus:outline-none cursor-pointer"
            >
              <option value="">All Account Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="blocked">Blocked</option>
              <option value="dormant">Dormant</option>
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

          {/* Wallet Balance Filter Dropdown */}
          <div className="relative">
            <select
              value={selectedWallet}
              onChange={(e) => { setSelectedWallet(e.target.value); setPage(1); }}
              className="appearance-none bg-white border border-gray-200 rounded-xl px-4 py-2 pr-8 text-sm font-medium text-fresh-green hover:bg-gray-50 focus:outline-none cursor-pointer"
            >
              <option value="">All Wallet Balances</option>
              <option value="positive">Positive Balance (&gt; ₹0)</option>
              <option value="zero">Zero Balance (₹0)</option>
              <option value="negative">Negative Balance (&lt; ₹0)</option>
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

          {/* Postpaid Dues Filter Dropdown */}
          <div className="relative">
            <select
              value={selectedDue}
              onChange={(e) => { setSelectedDue(e.target.value); setPage(1); }}
              className="appearance-none bg-white border border-gray-200 rounded-xl px-4 py-2 pr-8 text-sm font-medium text-fresh-green hover:bg-gray-50 focus:outline-none cursor-pointer"
            >
              <option value="">All Postpaid Dues</option>
              <option value="has_due">Has Outstanding Due</option>
              <option value="no_due">No Outstanding Due</option>
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          
          <div className="ml-auto flex items-center gap-3">
            <div className="relative">
              <select
                value={limit}
                onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                className="appearance-none bg-white border border-gray-200 rounded-xl px-4 py-2 pr-8 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none cursor-pointer"
              >
                <option value={12}>12 / page</option>
                <option value={24}>24 / page</option>
                <option value={48}>48 / page</option>
                <option value={100}>100 / page</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Customers Grid */}
      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-fresh-green border-t-transparent rounded-full"></div></div>
      ) : data.length === 0 ? (
        <div className="text-center py-20 text-gray-500">No customers found.</div>
      ) : (
        <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'}`}>
          {data.map((c, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow group relative">
              <div className="flex justify-between items-start mb-4">
                <div className="flex gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${getAvatarColors(c.full_name)}`}>
                    {c.full_name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 truncate max-w-[150px]">{c.full_name || 'Unknown User'}</h3>
                    <p className="text-[11px] font-mono text-gray-400">#{c.customer_id}</p>
                  </div>
                </div>
                <button 
                  onClick={() => router.push(`/admin/customers/${c.customer_id}`)}
                  className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-fresh-green group-hover:text-white transition-colors flex-shrink-0"
                >
                  <ArrowRight size={16} />
                </button>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Phone size={14} className="text-fresh-green" />
                  {(!c.phone || c.phone.startsWith('NO_PHONE_')) ? 'No Phone Registered' : c.phone}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Mail size={14} className="text-fresh-green shrink-0" />
                  <span className="truncate">{c.email || 'No Email'}</span>
                </div>
              </div>

              <div className="mb-4">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                  c.customer_status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${c.customer_status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                  {c.customer_status || 'active'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-4 border-t border-gray-50">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Revenue</p>
                  <p className="font-bold text-gray-900">₹{Number(c.lifetime_revenue || 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Wallet</p>
                  <p className="font-bold text-gray-900">₹{Number(c.wallet_balance || 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Due</p>
                  <p className="font-bold text-gray-900">₹{Number(c.outstanding_due || 0).toLocaleString()}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, icon, bg }: { title: string, value: string | number, icon: React.ReactNode, bg: string }) {
  return (
    <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3 overflow-hidden">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${bg}`}>
        {icon}
      </div>
      <div className="overflow-hidden min-w-0">
        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider truncate">{title}</p>
        <p className="text-lg font-black text-gray-900 truncate">{value}</p>
      </div>
    </div>
  );
}

function FilterDropdown({ label, onChange }: { label: string, onChange?: (val: string) => void }) {
  return (
    <button className="flex items-center justify-between min-w-[140px] gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-fresh-green hover:bg-gray-50 transition-colors">
      <span>{label}</span>
      <ChevronDown size={14} className="text-gray-400" />
    </button>
  );
}

function getAvatarColors(name: string) {
  const char = name?.charAt(0)?.toUpperCase() || 'A';
  if (['A','B','C','D','P'].includes(char)) return 'bg-emerald-50 text-emerald-600';
  if (['E','F','G','H','S'].includes(char)) return 'bg-blue-50 text-blue-600';
  if (['I','J','K','L','N'].includes(char)) return 'bg-indigo-50 text-indigo-600';
  if (['M','O','Q'].includes(char)) return 'bg-amber-50 text-amber-600';
  if (['R','T','U','V'].includes(char)) return 'bg-purple-50 text-purple-600';
  return 'bg-rose-50 text-rose-600';
}
