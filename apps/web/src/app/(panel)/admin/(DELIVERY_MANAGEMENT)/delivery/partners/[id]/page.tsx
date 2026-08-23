'use client';

import React, { useState, useEffect } from 'react';
import {
  Truck,
  Phone,
  Mail,
  MapPin,
  ShieldCheck,
  ShieldAlert,
  Star,
  CheckCircle2,
  XCircle,
  Package,
  Calendar,
  CreditCard,
  User,
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  Home,
  FileText,
  DollarSign,
  Activity,
  Box,
  Gift
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/services/api.client';

export default function DeliveryPartnerPortfolioPage({ params }: { params?: any }) {
  const routeParams = useParams();
  const router = useRouter();

  const [partnerId, setPartnerId] = useState<string>('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Overview & Performance');

  useEffect(() => {
    const rawId = (routeParams?.id as string) || '';
    if (rawId) {
      setPartnerId(rawId);
    } else if (params) {
      Promise.resolve(params).then((p: any) => {
        if (p?.id) setPartnerId(p.id);
      });
    }
  }, [params, routeParams]);

  useEffect(() => {
    if (partnerId) fetchPortfolio(partnerId);
  }, [partnerId]);

  const fetchPortfolio = async (targetId: string) => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/delivery/partners/${targetId}/portfolio`);
      if (res.data) {
        const payload = (res.data as any).data || res.data;
        setData(payload);
      }
    } catch (error) {
      console.error('Failed to fetch partner portfolio:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-slate-50/50">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!data || !data.partner) {
    return (
      <div className="p-12 text-center text-gray-500 font-medium">
        Delivery partner not found
      </div>
    );
  }

  const { partner, stats = {}, referral_stats = {}, referral_bonuses = [], orders = [], documents = [], bank_accounts = [], vehicles = [] } = data;

  const tabs = [
    { name: 'Overview & Performance', icon: <Activity size={16} /> },
    { name: `Assigned Deliveries (${orders.length})`, icon: <Package size={16} /> },
    { name: 'Referrals & Bonuses', icon: <Gift size={16} /> },
    { name: 'KYC & Verification', icon: <ShieldCheck size={16} /> },
    { name: 'Vehicles & Assets', icon: <Truck size={16} /> },
    { name: 'Bank & Earnings', icon: <CreditCard size={16} /> },
  ];

  return (
    <div className="space-y-6 p-4 md:p-6 font-sans min-h-screen bg-slate-50/50">
      {/* Back Button */}
      <div className="flex items-center gap-2">
        <Link href="/admin/delivery/partners" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-emerald-600 transition-colors">
          <ArrowLeft size={14} /> Back to Delivery Partners
        </Link>
      </div>

      {/* Header Profile Card */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-black text-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
            {(partner.full_name || 'D').charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-bold text-slate-900">{partner.full_name}</h1>
              <span className="text-xs font-mono px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md border border-slate-200">
                #{partner.delivery_partner_id || partner.id}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-medium text-slate-600 mb-3">
              <span className="flex items-center gap-1"><Phone size={13} className="text-emerald-600" /> {partner.phone}</span>
              <span className="flex items-center gap-1"><Mail size={13} className="text-emerald-600" /> {partner.email}</span>
              <Link href="/admin/branches" className="flex items-center gap-1 text-slate-700 hover:text-emerald-600 font-bold transition-colors hover:underline">
                <MapPin size={13} className="text-emerald-600" /> Branch: {partner.branch_name || partner.branch_id || 'No Branch'}
              </Link>
            </div>

            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                partner.is_active ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-200 text-slate-700'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${partner.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                {partner.is_active ? 'Active' : 'Inactive'}
              </span>

              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                partner.is_verified ? 'bg-teal-100 text-teal-700 border border-teal-200' : 'bg-amber-100 text-amber-700 border border-amber-200'
              }`}>
                {partner.is_verified ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />}
                {partner.is_verified ? 'Verified KYC' : 'Pending Verification'}
              </span>
            </div>
          </div>
        </div>

        {/* Rating & Salary */}
        <div className="flex items-center gap-6 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-amber-500 font-black text-lg">
              <Star size={18} fill="currentColor" /> {Number(partner.average_rating || 5.0).toFixed(1)}
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Rating</p>
          </div>

          <div className="text-center">
            <p className="text-lg font-black text-slate-900">₹{Number(partner.daily_salary || 0).toLocaleString()}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Daily Salary</p>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard title="ASSIGNED DELIVERIES" value={`${stats.total_assigned || 0}`} sub="Total orders" icon={<Package size={16} className="text-blue-500" />} />
        <MetricCard title="COMPLETED DELIVERIES" value={`${stats.total_delivered || 0}`} sub="Delivered successfully" icon={<CheckCircle2 size={16} className="text-emerald-500" />} />
        <MetricCard title="TOTAL RUNS" value={`${stats.active_runs || 0}`} sub="Assigned runs" icon={<Truck size={16} className="text-purple-500" />} />
        <MetricCard title="DAILY SALARY" value={`₹${Number(stats.daily_salary || 0).toLocaleString()}`} sub="Per active day" icon={<DollarSign size={16} className="text-emerald-600" />} />
      </div>

      {/* Tabs Bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="flex overflow-x-auto border-b border-slate-100 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {tabs.map((tab) => (
            <button
              key={tab.name}
              onClick={() => setActiveTab(tab.name)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${
                activeTab === tab.name
                  ? 'border-emerald-600 text-emerald-600 bg-emerald-50/30'
                  : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {tab.icon} {tab.name}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'Overview & Performance' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Vehicle & Assignment Info */}
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200/80">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Truck size={16} className="text-emerald-600" /> Vehicle & Equipment
                  </h3>
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between border-b border-slate-200/60 pb-2">
                      <span className="font-semibold text-slate-500">Vehicle Type</span>
                      <span className="font-bold text-slate-800 uppercase">{partner.vehicle_type || 'Bike'}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200/60 pb-2">
                      <span className="font-semibold text-slate-500">Vehicle Number</span>
                      <span className="font-bold text-slate-800 font-mono">{partner.vehicle_number || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200/60 pb-2">
                      <span className="font-semibold text-slate-500">Assigned Branch</span>
                      <Link href="/admin/branches" className="font-bold text-emerald-600 hover:underline flex items-center gap-1">
                        {partner.branch_name || partner.branch_id || 'N/A'} <ChevronRight size={12} />
                      </Link>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold text-slate-500">Joined Date</span>
                      <span className="font-bold text-slate-800">{partner.joined_date ? new Date(partner.joined_date).toLocaleDateString() : 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* Bank Account Overview */}
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200/80">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <CreditCard size={16} className="text-emerald-600" /> Primary Bank Account
                  </h3>
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between border-b border-slate-200/60 pb-2">
                      <span className="font-semibold text-slate-500">Bank Name</span>
                      <span className="font-bold text-slate-800">{partner.bank_name || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200/60 pb-2">
                      <span className="font-semibold text-slate-500">Account Number</span>
                      <span className="font-bold text-slate-800 font-mono">{partner.bank_account_number || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200/60 pb-2">
                      <span className="font-semibold text-slate-500">IFSC Code</span>
                      <span className="font-bold text-slate-800 font-mono">{partner.bank_ifsc || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold text-slate-500">Account Holder</span>
                      <span className="font-bold text-slate-800">{partner.account_holder_name || partner.full_name}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab.startsWith('Assigned Deliveries') && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Recent Order Deliveries</h3>
              {orders.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">No orders assigned to this partner yet</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px] tracking-wider">
                        <th className="py-3 px-4">Order ID</th>
                        <th className="py-3 px-4">Customer</th>
                        <th className="py-3 px-4">Slot</th>
                        <th className="py-3 px-4">Amount</th>
                        <th className="py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {orders.map((o: any) => (
                        <tr key={o.order_id} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-mono font-bold text-slate-800">#{o.order_id}</td>
                          <td className="py-3 px-4 font-semibold text-slate-700">{o.customer_name || o.customer_id}</td>
                          <td className="py-3 px-4 font-medium text-slate-500">{o.delivery_slot || 'Morning'}</td>
                          <td className="py-3 px-4 font-bold text-slate-900">₹{Number(o.total_amount || 0).toLocaleString()}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              o.status === 'delivered' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {o.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'Referrals & Bonuses' && (
            <div className="space-y-6">
              {/* Summary KPI Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Total Referrals</span>
                  <p className="text-lg font-black text-slate-900 mt-1">{referral_stats.total_referrals || 0}</p>
                </div>
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Eligible Referrals</span>
                  <p className="text-lg font-black text-emerald-700 mt-1">{referral_stats.eligible_referrals || 0}</p>
                </div>
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Pending Activation</span>
                  <p className="text-lg font-black text-amber-700 mt-1">{referral_stats.pending_referrals || 0}</p>
                </div>
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Total Earned</span>
                  <p className="text-lg font-black text-slate-900 mt-1">₹{Number(referral_stats.total_amount_earned || 0).toFixed(2)}</p>
                </div>
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Total Paid Out</span>
                  <p className="text-lg font-black text-emerald-700 mt-1">₹{Number(referral_stats.total_amount_paid || 0).toFixed(2)}</p>
                </div>
                <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800">Outstanding</span>
                  <p className="text-lg font-black text-amber-900 mt-1">₹{Number(referral_stats.outstanding_referral_amount || 0).toFixed(2)}</p>
                </div>
              </div>

              {/* Referrals & Payouts Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Referral Reward History (₹75 / Partner)</h3>
                  <Link
                    href="/admin/delivery/referral-payments"
                    className="text-xs font-bold text-emerald-600 hover:underline flex items-center gap-1"
                  >
                    Manage Referral Payments <ChevronRight size={13} />
                  </Link>
                </div>

                {referral_bonuses.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-xs bg-slate-50 rounded-xl border border-slate-200">
                    No referral bonuses recorded for this partner yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider">
                          <th className="py-3 px-4">Bonus ID</th>
                          <th className="py-3 px-4">Referee Name</th>
                          <th className="py-3 px-4">Phone</th>
                          <th className="py-3 px-4">Referral Date</th>
                          <th className="py-3 px-4 text-center">Reward</th>
                          <th className="py-3 px-4 text-center">Payment Status</th>
                          <th className="py-3 px-4">Payment Reference</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {referral_bonuses.map((b: any) => (
                          <tr key={b.id || b.bonus_id} className="hover:bg-slate-50">
                            <td className="py-3 px-4 font-mono font-bold text-slate-800">{b.bonus_id}</td>
                            <td className="py-3 px-4 font-bold text-slate-900">{b.referee_name}</td>
                            <td className="py-3 px-4 text-slate-500">{b.referee_phone || 'N/A'}</td>
                            <td className="py-3 px-4 text-slate-600">
                              {new Date(b.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </td>
                            <td className="py-3 px-4 text-center font-black text-slate-900">₹{Number(b.amount || 75).toFixed(2)}</td>
                            <td className="py-3 px-4 text-center">
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                b.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                              }`}>
                                {b.status === 'paid' ? 'PAID' : 'UNPAID'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-600">
                              {b.payment_reference ? (
                                <span className="font-semibold text-slate-800">{b.payment_reference}</span>
                              ) : (
                                <span className="text-slate-400 italic">Pending offline payout</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'KYC & Verification' && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Uploaded KYC Documents</h3>
              {documents.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">No documents uploaded yet</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {documents.map((doc: any) => (
                    <div key={doc.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                      <div className="flex justify-between font-bold">
                        <span className="uppercase text-slate-700">{doc.document_type || 'Document'}</span>
                        <span className="text-emerald-600 uppercase">{doc.verification_status || 'Pending'}</span>
                      </div>
                      <p className="text-slate-500 font-mono">Doc Number: {doc.document_number || 'N/A'}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'Vehicles & Assets' && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Vehicle Details</h3>
              {vehicles.length === 0 ? (
                <div className="bg-slate-50 p-6 rounded-xl text-center text-xs text-slate-500 border border-slate-200">
                  <p className="font-bold text-slate-800 mb-1">{partner.vehicle_type || 'Bike'} - {partner.vehicle_number || 'No Reg Number'}</p>
                  <p>Primary vehicle assigned to partner profile.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {vehicles.map((v: any) => (
                    <div key={v.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2">
                      <p className="font-bold text-slate-800 uppercase">{v.vehicle_type} - {v.registration_number}</p>
                      <p className="text-slate-500">Insurance: {v.insurance_number || 'N/A'}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'Bank & Earnings' && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Bank & Payout Setup</h3>
              <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 text-xs space-y-3">
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="font-semibold text-slate-500">Bank Name</span>
                  <span className="font-bold text-slate-800">{partner.bank_name || 'N/A'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="font-semibold text-slate-500">Account Number</span>
                  <span className="font-bold text-slate-800 font-mono">{partner.bank_account_number || 'N/A'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="font-semibold text-slate-500">IFSC Code</span>
                  <span className="font-bold text-slate-800 font-mono">{partner.bank_ifsc || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-500">Daily Salary Rate</span>
                  <span className="font-black text-emerald-600">₹{Number(partner.daily_salary || 0).toLocaleString()} / day</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, sub, icon }: { title: string; value: string; sub: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col justify-center">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{title}</p>
        {icon}
      </div>
      <p className="text-xl font-black text-slate-900 mb-1">{value}</p>
      <p className="text-xs text-slate-400 font-medium">{sub}</p>
    </div>
  );
}
