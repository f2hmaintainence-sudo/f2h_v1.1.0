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
  Eye,
  EyeOff
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/services/api.client';

function maskPhone(phone?: string): string {
  if (!phone || phone === '' || phone.startsWith('NO_PHONE_')) {
    return 'No Phone';
  }
  const clean = phone.trim();
  if (clean.length <= 4) return '••••';
  if (clean.length <= 7) return clean.slice(0, 2) + '••••' + clean.slice(-2);
  return clean.slice(0, 3) + '••••' + clean.slice(-3);
}

function maskEmail(email?: string): string {
  if (!email || email === '' || email.startsWith('noemail_')) {
    return 'No Email';
  }
  const parts = email.split('@');
  if (parts.length !== 2) return '••••••••';
  const name = parts[0];
  const domain = parts[1];
  if (name.length <= 2) {
    return `${name.charAt(0)}••••@${domain}`;
  }
  return `${name.slice(0, 2)}••••${name.slice(-1)}@${domain}`;
}

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

  // Sensitive data mask/reveal states
  const [showAllSensitive, setShowAllSensitive] = useState(false);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());

  const toggleCustomerReveal = (e: React.MouseEvent, customerId: string) => {
    e.stopPropagation();
    setRevealedIds(prev => {
      const next = new Set(prev);
      if (next.has(customerId)) {
        next.delete(customerId);
      } else {
        next.add(customerId);
      }
      return next;
    });
  };

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

            {/* Global Sensitive Info Toggle Button */}
            <button
              type="button"
              onClick={() => {
                const next = !showAllSensitive;
                setShowAllSensitive(next);
                if (next) {
                  setRevealedIds(new Set(data.map(c => c.customer_id)));
                } else {
                  setRevealedIds(new Set());
                }
              }}
              title={showAllSensitive ? "Hide sensitive details for all" : "Reveal sensitive details for all"}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                showAllSensitive 
                  ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              {showAllSensitive ? <EyeOff size={14} className="text-amber-600" /> : <Eye size={14} className="text-gray-500" />}
              <span className="hidden sm:inline">{showAllSensitive ? 'Mask Sensitive' : 'Reveal All'}</span>
            </button>
            
            <div className="flex items-center bg-gray-50 p-1 rounded-xl ml-1">
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

      {/* Customers Content */}
      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-fresh-green border-t-transparent rounded-full"></div></div>
      ) : data.length === 0 ? (
        <div className="text-center py-20 text-gray-500">No customers found.</div>
      ) : viewMode === 'list' ? (
        /* List View */
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-gray-100 text-gray-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="p-3.5 pl-4">Customer</th>
                  <th className="p-3.5">Contact Info</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Revenue</th>
                  <th className="p-3.5 text-right">Wallet</th>
                  <th className="p-3.5 text-right">Due</th>
                  <th className="p-3.5 text-center pr-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.map((c, i) => {
                  const isRevealed = showAllSensitive || revealedIds.has(c.customer_id);
                  return (
                    <tr 
                      key={i} 
                      onClick={() => router.push(`/admin/customers/${c.customer_id}`)}
                      className="hover:bg-slate-50/60 cursor-pointer transition-colors"
                    >
                      <td className="p-3.5 pl-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${getAvatarColors(c.full_name)}`}>
                            {c.full_name?.charAt(0)?.toUpperCase() || 'U'}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-semibold text-gray-900 truncate">{c.full_name || 'Customer'}</h4>
                            <p className="text-[10px] font-mono text-gray-400">#{c.customer_id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3.5">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <Phone size={11} className="text-fresh-green shrink-0" />
                            <span className="text-[11px] text-gray-700 font-mono">
                              {(!c.phone || c.phone === '' || c.phone.startsWith('NO_PHONE_'))
                                ? <span className="text-gray-400 italic">No Phone</span>
                                : (isRevealed ? c.phone : maskPhone(c.phone))
                              }
                            </span>
                            <button
                              type="button"
                              onClick={(e) => toggleCustomerReveal(e, c.customer_id)}
                              className="p-1 rounded text-gray-400 hover:text-fresh-green hover:bg-emerald-50 transition-colors ml-0.5"
                              title={isRevealed ? "Hide contact info" : "Show full phone & email"}
                            >
                              {isRevealed ? <EyeOff size={12} /> : <Eye size={12} />}
                            </button>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Mail size={11} className="text-fresh-green shrink-0" />
                            <span className="text-[11px] text-gray-500 truncate max-w-[200px]" title={isRevealed ? c.email : maskEmail(c.email)}>
                              {(!c.email || c.email === '')
                                ? <span className="text-gray-400 italic">No Email</span>
                                : (isRevealed ? c.email : maskEmail(c.email))
                              }
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          c.customer_status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                        }`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${c.customer_status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                          <span className="capitalize">{c.customer_status || 'active'}</span>
                        </span>
                      </td>
                      <td className="p-3.5 text-right font-bold text-gray-800">₹{Number(c.lifetime_revenue || 0).toLocaleString()}</td>
                      <td className="p-3.5 text-right font-bold text-gray-800">₹{Number(c.wallet_balance || 0).toLocaleString()}</td>
                      <td className="p-3.5 text-right font-bold text-gray-800">₹{Number(c.outstanding_due || 0).toLocaleString()}</td>
                      <td className="p-3.5 text-center pr-4">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gray-100 text-gray-400 group-hover:bg-fresh-green group-hover:text-white transition-colors">
                          <ArrowRight size={13} />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Grid View */
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.map((c, i) => {
            const isRevealed = showAllSensitive || revealedIds.has(c.customer_id);

            return (
              <div
                key={i}
                onClick={() => router.push(`/admin/customers/${c.customer_id}`)}
                className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-fresh-green/20 transition-all cursor-pointer relative overflow-hidden group"
              >
                {/* Arrow — absolutely positioned, never overflows */}
                <div className="absolute top-2.5 right-2.5 w-6 h-6 rounded-md bg-gray-100 group-hover:bg-fresh-green flex items-center justify-center transition-colors z-10 pointer-events-none">
                  <ArrowRight size={12} className="text-gray-400 group-hover:text-white transition-colors" />
                </div>

                <div className="p-3.5">
                  {/* Header — pr-8 keeps text away from the arrow */}
                  <div className="flex items-center gap-2 mb-2.5 pr-8">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${getAvatarColors(c.full_name)}`}>
                      {c.full_name?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <h3 className="font-semibold text-gray-900 text-xs truncate" title={c.full_name || 'Customer'}>
                        {c.full_name || 'Customer'}
                      </h3>
                      <p className="text-[9px] font-mono text-gray-400 truncate" title={`#${c.customer_id}`}>
                        #{c.customer_id}
                      </p>
                    </div>
                  </div>

                  {/* Contact Details with Eye Toggle */}
                  <div className="space-y-1 mb-2.5">
                    <div className="flex items-center justify-between min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <Phone size={11} className="text-fresh-green shrink-0" />
                        <span className="text-[11px] text-gray-700 truncate font-mono">
                          {(!c.phone || c.phone === '' || c.phone.startsWith('NO_PHONE_'))
                            ? <span className="text-gray-400 italic font-sans">No Phone</span>
                            : (isRevealed ? c.phone : maskPhone(c.phone))
                          }
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => toggleCustomerReveal(e, c.customer_id)}
                        className="p-1 rounded-md text-gray-400 hover:text-fresh-green hover:bg-emerald-50 transition-colors shrink-0 ml-1 cursor-pointer"
                        title={isRevealed ? "Hide contact info" : "Show full phone & email"}
                      >
                        {isRevealed ? <EyeOff size={12} /> : <Eye size={12} />}
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Mail size={11} className="text-fresh-green shrink-0" />
                      <span className="text-[11px] text-gray-500 truncate" title={isRevealed ? (c.email || '') : maskEmail(c.email)}>
                        {(!c.email || c.email === '')
                          ? <span className="text-gray-400 italic">No Email</span>
                          : (isRevealed ? c.email : maskEmail(c.email))
                        }
                      </span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="mb-2.5">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      c.customer_status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                    }`}>
                      <div className={`w-1 h-1 rounded-full shrink-0 ${c.customer_status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                      <span className="capitalize">{c.customer_status || 'active'}</span>
                    </span>
                  </div>

                  {/* KPI Footer */}
                  <div className="grid grid-cols-3 gap-1 pt-2 border-t border-gray-100 text-center">
                    <div className="min-w-0">
                      <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wide truncate">Revenue</p>
                      <p className="font-bold text-gray-800 text-[11px] truncate">₹{Number(c.lifetime_revenue || 0).toLocaleString()}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wide truncate">Wallet</p>
                      <p className="font-bold text-gray-800 text-[11px] truncate">₹{Number(c.wallet_balance || 0).toLocaleString()}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wide truncate">Due</p>
                      <p className="font-bold text-gray-800 text-[11px] truncate">₹{Number(c.outstanding_due || 0).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
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

function getAvatarColors(name: string) {
  const char = name?.charAt(0)?.toUpperCase() || 'A';
  if (['A','B','C','D','P'].includes(char)) return 'bg-emerald-50 text-emerald-600';
  if (['E','F','G','H','S'].includes(char)) return 'bg-blue-50 text-blue-600';
  if (['I','J','K','L','N'].includes(char)) return 'bg-indigo-50 text-indigo-600';
  if (['M','O','Q'].includes(char)) return 'bg-amber-50 text-amber-600';
  if (['R','T','U','V'].includes(char)) return 'bg-purple-50 text-purple-600';
  return 'bg-rose-50 text-rose-600';
}
