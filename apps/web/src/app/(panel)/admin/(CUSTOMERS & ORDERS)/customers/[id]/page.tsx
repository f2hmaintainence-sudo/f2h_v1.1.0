'use client';

import React, { useState, useEffect } from 'react';
import {
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  Home,
  Phone,
  Mail,
  MapPin,
  Lock,
  Wallet,
  TrendingUp,
  CreditCard,
  AlertTriangle,
  Award,
  Sparkles,
  ShoppingBag,
  Activity,
  Calendar,
  Box,
  Truck,
  CheckCircle2
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/services/api.client';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer
} from 'recharts';

export default function CustomerDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Overview & Insights');
  const [isPostpaidModalOpen, setIsPostpaidModalOpen] = useState(false);
  const [postpaidInput, setPostpaidInput] = useState('');
  const [savingPostpaid, setSavingPostpaid] = useState(false);

  useEffect(() => {
    if (id) fetchPortfolio();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchPortfolio = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/customer/${id}/portfolio`);
      if (res.data) {
        const payload = (res.data as any).data || res.data;
        setData(payload);
      }
    } catch (error) {
      console.error('Failed to fetch portfolio:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePostpaidLimit = async () => {
    const limitNum = Number(postpaidInput || 0);
    if (isNaN(limitNum) || limitNum < 0) return;
    setSavingPostpaid(true);
    try {
      const res = await api.put(`/admin/customer/${id}/postpaid-limit`, { limit: limitNum });
      if (res.data) {
        await fetchPortfolio();
        setIsPostpaidModalOpen(false);
      }
    } catch (err) {
      console.error('Failed to update postpaid limit:', err);
    } finally {
      setSavingPostpaid(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-fresh-green border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!data || !data.customer) {
    return (
      <div className="p-6 text-center text-gray-500">Customer not found</div>
    );
  }

  const { customer, formattedOrders = [], stats = {}, addresses = [] } = data;
  const primaryAddress = addresses.find((a: any) => a.is_default) || addresses[0];

  const totalOrdersCount = formattedOrders.length;
  const deliveredCount = formattedOrders.filter((o: any) => o.status === 'delivered').length;
  const cancelledCount = formattedOrders.filter((o: any) => o.status === 'cancelled').length;

  const tabs = [
    { name: 'Overview & Insights', icon: <Sparkles size={16} /> },
    { name: `Orders (${totalOrdersCount})`, icon: <ShoppingBag size={16} /> },
    { name: 'Postpaid Ledger', icon: <CreditCard size={16} /> },
    { name: 'Wallet Analytics', icon: <Wallet size={16} /> },
    { name: 'Subscription', icon: <Calendar size={16} /> },
    { name: 'Revenue Trends', icon: <TrendingUp size={16} /> },
    { name: 'Activity Log', icon: <Activity size={16} /> }
  ];

  return (
    <div className="space-y-6 p-4 md:p-6 font-sans min-h-screen bg-slate-50/50">
      
      {/* Return to Customers Navigation */}
      <div className="flex items-center justify-between">
        <Link 
          href="/admin/customers/allcustomers"
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 text-slate-700 hover:text-emerald-700 hover:border-emerald-300 text-xs font-bold rounded-xl shadow-2xs transition-all"
        >
          <ArrowLeft size={14} /> Return to Customers
        </Link>
      </div>
      
      {/* Header Panel */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className={`w-16 h-16 rounded-xl flex items-center justify-center font-bold text-2xl ${getAvatarColors(customer.full_name || customer.first_name)}`}>
            {(customer.full_name || customer.first_name || 'U').charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-bold text-gray-900">{customer.full_name || customer.first_name || 'Unknown'}</h1>
              <span className="text-xs font-mono px-2 py-1 bg-gray-100 text-gray-500 rounded-md">#{customer.customer_id}</span>
            </div>
            
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-600 mb-3">
              <div className="flex items-center gap-1.5"><Phone size={14} className="text-fresh-green" /> {customer.phone || 'N/A'}</div>
              <div className="flex items-center gap-1.5"><Mail size={14} className="text-fresh-green" /> {customer.email || 'N/A'}</div>
              {primaryAddress && (
                <div className="flex items-center gap-1.5"><MapPin size={14} className="text-fresh-green" /> {primaryAddress.address_line_1 || primaryAddress.city || 'N/A'}</div>
              )}
            </div>

            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
              customer.customer_status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${customer.customer_status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
              {customer.customer_status || 'active'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              setPostpaidInput(String(customer.postpaid_credit_limit || 0));
              setIsPostpaidModalOpen(true);
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-2 cursor-pointer"
          >
            <CreditCard size={16} /> Postpaid Credit Limit
          </button>
          <button className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2">
            <Lock size={16} /> Block Customer
          </button>
        </div>
      </div>

      {/* Postpaid Limit Modal */}
      {isPostpaidModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <CreditCard size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Set Postpaid Credit Limit</h3>
                  <p className="text-xs text-slate-500 font-medium">Customer: #{customer.customer_id}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsPostpaidModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Credit Limit Amount (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={postpaidInput}
                    onChange={(e) => setPostpaidInput(e.target.value)}
                    placeholder="Enter credit limit e.g. 5000"
                    className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-bold focus:bg-white focus:border-blue-600 focus:outline-none transition-all"
                  />
                </div>
                <p className="text-[11px] text-slate-400 font-medium mt-1">
                  Setting limit &gt; ₹0 automatically enables postpaid credit for this customer.
                </p>
              </div>

              {/* Quick Presets */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Quick Presets</p>
                <div className="grid grid-cols-4 gap-2">
                  {[0, 2000, 5000, 10000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setPostpaidInput(String(preset))}
                      className={`py-1.5 px-2 text-xs font-bold rounded-lg border transition-all ${
                        Number(postpaidInput) === preset
                          ? 'bg-blue-50 text-blue-700 border-blue-300 shadow-xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {preset === 0 ? 'Disable' : `₹${preset.toLocaleString()}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsPostpaidModalOpen(false)}
                className="px-4 py-2 text-slate-600 text-xs font-bold hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingPostpaid}
                onClick={handleSavePostpaidLimit}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {savingPostpaid ? 'Saving...' : 'Save Credit Limit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard title="TOTAL REVENUE" value={`₹${Number(stats.lifetimeRevenue || 0).toLocaleString()}`} sub="Cumulative spend" onClick={() => setActiveTab('Revenue Trends')} />
        <MetricCard title="TOTAL ORDERS" value={`${totalOrdersCount} (${deliveredCount} ✓ / ${cancelledCount} ✕)`} sub="Click for orders" onClick={() => setActiveTab(tabs[1]?.name || 'Orders')} />
        <MetricCard title="AVG ORDER VALUE" value={`₹${Number(stats.aov || 0).toLocaleString()}`} sub="Average per order" onClick={() => setActiveTab(tabs[1]?.name || 'Orders')} />
        <MetricCard title="WALLET BALANCE" value={`₹${Number(customer.wallet_balance || 0).toLocaleString()}`} sub="Prepaid balance" onClick={() => setActiveTab('Wallet Analytics')} />
        <MetricCard title="OUTSTANDING DUE" value={`₹${Number(stats.outstandingDue || 0).toLocaleString()}`} sub="Postpaid balance due" onClick={() => setActiveTab('Postpaid Ledger')} />
        <MetricCard title="REWARD POINTS" value={`${customer.reward_points || 0} pts`} sub="Earned reward points" onClick={() => setActiveTab('Overview & Insights')} />
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex overflow-x-auto border-b border-gray-100 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {tabs.map((tab) => (
            <button
              key={tab.name}
              onClick={() => setActiveTab(tab.name)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${
                activeTab === tab.name 
                  ? 'border-emerald-600 text-emerald-600 bg-emerald-50/30' 
                  : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {tab.icon} {tab.name}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'Overview & Insights' && <OverviewTab customer={customer} formattedOrders={formattedOrders} primaryAddress={primaryAddress} />}
          {activeTab.startsWith('Orders') && <OrdersTab orders={formattedOrders} />}
          {activeTab === 'Postpaid Ledger' && <PostpaidTab ledger={data.postpaid_ledger} />}
          {activeTab === 'Wallet Analytics' && <WalletTab ledger={data.wallet_ledger} />}
          {activeTab === 'Subscription' && <SubscriptionTab subscriptions={data.subscriptions} />}
          {activeTab === 'Revenue Trends' && <RevenueTrendsTab revenueAnalytics={data.revenue_analytics} />}
          {activeTab === 'Activity Log' && <ActivityLogTab timeline={data.activity_timeline} />}
          {!activeTab.startsWith('Orders') && !['Overview & Insights', 'Postpaid Ledger', 'Wallet Analytics', 'Subscription', 'Revenue Trends', 'Activity Log'].includes(activeTab) && (
            <div className="text-center py-10 text-gray-400 font-medium flex flex-col items-center justify-center">
              <Box size={40} className="mb-4 text-gray-200" />
              This section is under construction. Check back soon.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, sub, onClick }: { title: string, value: string, sub: string, onClick?: () => void }) {
  return (
    <div 
      onClick={onClick}
      className={`bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center overflow-hidden min-w-0 ${
        onClick ? 'cursor-pointer hover:border-emerald-300 hover:shadow-md transition-all' : ''
      }`}
    >
      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1 truncate">{title}</p>
      <p className="text-lg font-black text-gray-900 mb-1 truncate">{value}</p>
      <p className="text-[10px] text-gray-400 flex items-center gap-1 truncate">
        {sub}
      </p>
    </div>
  );
}

function OverviewTab({ customer, formattedOrders, primaryAddress }: { customer: any, formattedOrders: any[], primaryAddress: any }) {
  const preferredSlot = formattedOrders[0]?.delivery_slot || 'N/A';
  const preferredPayment = formattedOrders[0]?.payment_mode || 'N/A';

  return (
    <div className="space-y-8">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">
          <Sparkles size={16} className="text-amber-500" /> AUTOMATED CUSTOMER INTELLIGENCE & INSIGHTS
        </h3>
        <p className="text-sm text-gray-400 italic">No automated insights generated yet.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-50 p-6 rounded-2xl border border-gray-100">
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">ORDER & DELIVERY PREFERENCES</h4>
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-gray-200 border-dashed">
              <span className="text-sm text-gray-500">Preferred Delivery Slot:</span>
              <span className="text-sm font-bold text-gray-900 capitalize">{preferredSlot}</span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-gray-200 border-dashed">
              <span className="text-sm text-gray-500">Preferred Payment Method:</span>
              <span className="text-sm font-bold text-gray-900 capitalize">{preferredPayment}</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 p-6 rounded-2xl border border-gray-100">
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">PRIMARY DELIVERY ADDRESS</h4>
          {primaryAddress ? (
            <div className="space-y-2">
              <p className="text-sm font-bold text-gray-900">{primaryAddress.full_name || customer.first_name} ({primaryAddress.mobile_number || customer.phone})</p>
              <p className="text-sm text-gray-600">{primaryAddress.address_line_1}</p>
              {primaryAddress.address_line_2 && <p className="text-sm text-gray-600">{primaryAddress.address_line_2}</p>}
              <p className="text-sm text-gray-600">{primaryAddress.city}, {primaryAddress.state} - {primaryAddress.pincode}</p>
              <span className="inline-block mt-2 text-[10px] font-bold uppercase px-2 py-1 bg-white border border-gray-200 rounded text-gray-500">
                {primaryAddress.address_type || 'HOME'}
              </span>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No primary address registered.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function OrdersTab({ orders }: { orders: any[] }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">
        FULL ORDER HISTORY ({orders.length})
      </h3>
      {orders.length === 0 ? (
        <p className="text-sm text-gray-500">No orders found for this customer.</p>
      ) : (
        <div className="space-y-3">
          {orders.map((order, i) => (
            <div key={i} className="flex flex-col md:flex-row md:items-center justify-between p-4 border border-gray-100 rounded-xl hover:shadow-sm transition-shadow">
              <div className="flex items-start gap-4 mb-4 md:mb-0">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  order.status === 'delivered' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                }`}>
                  <ShoppingBag size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-gray-900">#{order.order_id}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                      order.status === 'delivered' ? 'bg-emerald-100 text-emerald-700' : 
                      order.status === 'assigned' ? 'bg-amber-100 text-amber-700' : 
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {order.status || 'PENDING'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Placed on {new Date(order.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    <span className="mx-2">•</span>
                    Slot: <span className="capitalize">{order.delivery_slot || 'N/A'}</span>
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-8 pl-14 md:pl-0">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Payment</p>
                  <p className="text-sm font-semibold text-gray-700 capitalize">
                    {order.payment_mode || 'Cash'} {order.payment_status === 'paid' ? '(Paid)' : '(Unpaid)'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Amount</p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-gray-900">₹{Number(order.total_amount || 0).toLocaleString()}</p>
                    <ChevronDown size={16} className="text-gray-400" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PostpaidTab({ ledger }: { ledger: any }) {
  if (!ledger) return <div className="text-sm text-gray-500 py-8 text-center bg-gray-50 rounded-xl">No Postpaid Ledger Data Available</div>;
  const { summary = {}, bills = [] } = ledger;

  return (
    <div className="space-y-6 font-sans">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-50 p-4 rounded-xl border border-gray-100">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Credit Limit</p>
          <p className="text-xl font-black text-gray-900">₹{Number(summary?.credit_limit || 0).toLocaleString()}</p>
        </div>
        <div className="bg-slate-50 p-4 rounded-xl border border-gray-100">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Current Due</p>
          <p className="text-xl font-black text-rose-600">₹{Number(summary?.current_due || 0).toLocaleString()}</p>
        </div>
        <div className="bg-slate-50 p-4 rounded-xl border border-gray-100">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Total Credit Given</p>
          <p className="text-xl font-black text-blue-600">₹{Number(summary?.total_credit_given || 0).toLocaleString()}</p>
        </div>
        <div className="bg-slate-50 p-4 rounded-xl border border-gray-100">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Total Paid</p>
          <p className="text-xl font-black text-emerald-600">₹{Number(summary?.total_paid || 0).toLocaleString()}</p>
        </div>
      </div>

      {/* Utilization Bar */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-2xs">
        <div className="flex justify-between items-center mb-2 text-xs font-bold text-gray-700">
          <span>Credit Utilization ({Number(summary?.credit_utilization_pct || 0).toFixed(1)}%)</span>
          <span>₹{Number(summary?.current_due || 0).toLocaleString()} / ₹{Number(summary?.credit_limit || 0).toLocaleString()}</span>
        </div>
        <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all ${
              Number(summary?.credit_utilization_pct || 0) > 80 ? 'bg-rose-500' : 
              Number(summary?.credit_utilization_pct || 0) > 50 ? 'bg-amber-500' : 'bg-blue-600'
            }`}
            style={{ width: `${Math.min(100, Math.max(0, Number(summary?.credit_utilization_pct || 0)))}%` }}
          ></div>
        </div>
      </div>

      {/* Bills Table */}
      <div>
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
          <CreditCard size={16} className="text-blue-600" /> Postpaid Bills History ({bills.length})
        </h3>
        {bills.length === 0 ? (
          <p className="text-xs text-gray-500 italic py-8 text-center bg-gray-50 rounded-xl border border-gray-100">
            No postpaid bills generated for this customer yet.
          </p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">Bill ID</th>
                    <th className="text-left px-4 py-3 font-semibold">Period / Date</th>
                    <th className="text-right px-4 py-3 font-semibold">Total</th>
                    <th className="text-right px-4 py-3 font-semibold">Paid</th>
                    <th className="text-right px-4 py-3 font-semibold">Due</th>
                    <th className="text-center px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {bills.map((bill: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-bold text-gray-900">
                        #{bill.bill_id || bill.id}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {bill.billing_period || (bill.created_at ? new Date(bill.created_at).toLocaleDateString('en-GB') : 'N/A')}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">
                        ₹{Number(bill.total_amount || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-600">
                        ₹{Number(bill.paid_amount || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-rose-600">
                        ₹{Number(bill.due_amount || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                          bill.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                          bill.status === 'partially_paid' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                        }`}>
                          {bill.status || 'UNPAID'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function WalletTab({ ledger }: { ledger: any }) {
  if (!ledger) return <div className="text-sm text-gray-500">No Wallet Data</div>;
  const { summary, transactions = [] } = ledger;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-50 p-4 rounded-xl border border-gray-100">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Current Balance</p>
          <p className="text-xl font-black text-gray-900">₹{summary?.balance?.toLocaleString()}</p>
        </div>
        <div className="bg-slate-50 p-4 rounded-xl border border-gray-100">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Total Credits</p>
          <p className="text-xl font-black text-emerald-600">₹{summary?.total_credits?.toLocaleString()}</p>
        </div>
        <div className="bg-slate-50 p-4 rounded-xl border border-gray-100">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Total Debits</p>
          <p className="text-xl font-black text-red-600">₹{summary?.total_debits?.toLocaleString()}</p>
        </div>
      </div>
      
      <div>
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Transaction History ({transactions.length})</h3>
        {transactions.length === 0 ? (
          <p className="text-sm text-gray-500">No transactions found.</p>
        ) : (
          <div className="space-y-3">
            {transactions.map((t: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:shadow-sm transition-shadow bg-white">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                      t.transaction_type === 'credit' || t.transaction_type === 'refund' || t.transaction_type === 'cashback' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {t.transaction_type}
                    </span>
                    <span className="font-bold text-gray-900 text-sm">{t.remarks || t.reference_type || 'Wallet Transaction'}</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {new Date(t.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {t.reference_id && <span className="ml-2">• Ref: {t.reference_id}</span>}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-bold ${t.transaction_type === 'credit' || t.transaction_type === 'refund' || t.transaction_type === 'cashback' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {t.transaction_type === 'credit' || t.transaction_type === 'refund' || t.transaction_type === 'cashback' ? '+' : '-'}₹{t.amount?.toLocaleString()}
                  </p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Balance: ₹{t.balance_after?.toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SubscriptionTab({ subscriptions }: { subscriptions: any }) {
  if (!subscriptions || (!subscriptions.active_plan && (!subscriptions.history || subscriptions.history.length === 0))) {
    return (
      <div className="text-center py-12 text-gray-500 font-medium flex flex-col items-center justify-center">
        <Calendar size={44} className="mb-3 text-gray-300" />
        <p className="text-base font-bold text-gray-700">No Active Subscriptions</p>
        <p className="text-xs text-gray-400 mt-1">This customer does not have any active or past subscription plans.</p>
      </div>
    );
  }

  const { active_plan, items = [], history = [] } = subscriptions;

  return (
    <div className="space-y-6">
      {/* Active Subscription Summary Card */}
      {active_plan ? (
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50/50 p-6 rounded-2xl border border-emerald-100/80 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-emerald-200/40">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
                <Calendar size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-gray-900">
                    Subscription #{active_plan.subscription_number || active_plan.subscription_id || active_plan.id}
                  </h3>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                    active_plan.status === 'active' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-amber-100 text-amber-700 border border-amber-200'
                  }`}>
                    {active_plan.status || 'ACTIVE'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Created on {new Date(active_plan.created_at || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold px-3 py-1.5 bg-white border border-emerald-200 rounded-lg text-emerald-800 shadow-2xs">
                Cycle: <strong className="capitalize">{active_plan.billing_cycle || active_plan.schedule_type || 'Daily'}</strong>
              </span>
              {active_plan.delivery_slot && (
                <span className="text-xs font-semibold px-3 py-1.5 bg-white border border-emerald-200 rounded-lg text-emerald-800 shadow-2xs">
                  Slot: <strong className="capitalize">{active_plan.delivery_slot}</strong>
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Start Date</p>
              <p className="text-sm font-bold text-gray-900">
                {active_plan.start_date ? new Date(active_plan.start_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">End Date</p>
              <p className="text-sm font-bold text-gray-900">
                {active_plan.end_date ? new Date(active_plan.end_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Ongoing / No End'}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Schedule Type</p>
              <p className="text-sm font-bold text-gray-900 capitalize">{active_plan.schedule_type || 'Everyday'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Payment Mode</p>
              <p className="text-sm font-bold text-gray-900 capitalize">{active_plan.payment_mode || active_plan.payment_type || 'Prepaid Wallet'}</p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Subscribed Items */}
      <div>
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Box size={16} className="text-emerald-600" /> Subscribed Items ({items.length})
        </h3>
        {items.length === 0 ? (
          <p className="text-xs text-gray-500 italic bg-gray-50 p-4 rounded-xl border border-gray-100">
            No specific items detailed for this active plan.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {items.map((item: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl hover:shadow-xs transition-shadow">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
                    {i + 1}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{item.product_name || 'Milk / Dairy Product'}</p>
                    {item.variant_name && <p className="text-xs text-gray-500">{item.variant_name}</p>}
                    {item.quantity && <p className="text-[11px] font-semibold text-emerald-700 mt-0.5">Quantity: {item.quantity} unit(s)</p>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-extrabold text-gray-900 text-sm">₹{Number(item.final_price || item.unit_price || 0).toLocaleString()}</p>
                  <p className="text-[10px] text-gray-400 uppercase">per delivery</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Subscription History */}
      {history.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">
            Subscription History ({history.length})
          </h3>
          <div className="space-y-2">
            {history.map((sub: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-4 border border-gray-100 rounded-xl bg-white text-xs">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-gray-900">#{sub.subscription_number || sub.subscription_id || sub.id}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      sub.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {sub.status}
                    </span>
                  </div>
                  <p className="text-gray-500">
                    Cycle: <span className="capitalize font-semibold">{sub.billing_cycle || sub.schedule_type || 'N/A'}</span> • Created {new Date(sub.created_at).toLocaleDateString('en-GB')}
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-semibold text-gray-700 capitalize">{sub.schedule_type || 'Custom Schedule'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RevenueTrendsTab({ revenueAnalytics }: { revenueAnalytics: any }) {
  const monthlyTrend = revenueAnalytics?.monthly_trend || [];
  const topProducts = revenueAnalytics?.top_products || [];

  return (
    <div className="space-y-6 font-sans">
      {/* 6-Month Revenue Trend */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs">
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
          <TrendingUp size={16} className="text-emerald-600" /> Revenue & Spending Trends
        </h3>
        
        {monthlyTrend.length === 0 ? (
          <p className="text-xs text-gray-500 italic py-8 text-center bg-gray-50 rounded-xl border border-gray-100">
            No completed order revenue recorded yet.
          </p>
        ) : (
          <div className="h-64 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTrend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={8} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(v) => `₹${v}`} />
                <RechartsTooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', fontSize: '12px', fontWeight: 'bold' }}
                  formatter={(val: number) => [`₹${val.toLocaleString()}`, 'Revenue']}
                />
                <Bar dataKey="revenue" fill="#10b981" radius={[6, 6, 0, 0]} barSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Top Products */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs">
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Award size={16} className="text-amber-500" /> Top Purchased Products ({topProducts.length})
        </h3>
        
        {topProducts.length === 0 ? (
          <p className="text-xs text-gray-500 italic py-6 text-center bg-gray-50 rounded-xl border border-gray-100">
            No item breakdown available yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {topProducts.map((prod: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-4 border border-gray-100 rounded-xl bg-slate-50/50 hover:bg-white hover:shadow-xs transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                    #{i + 1}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{prod.name || prod.product_name || 'Product Item'}</p>
                    <p className="text-xs text-gray-500">{prod.total_qty} unit(s) ordered</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-900 text-sm">₹{Number(prod.total_spend || 0).toLocaleString()}</p>
                  <p className="text-[10px] text-gray-400 uppercase">Total Spend</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ActivityLogTab({ timeline }: { timeline: any[] }) {
  const events = timeline || [];

  return (
    <div className="space-y-4 font-sans">
      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
        <Activity size={16} className="text-emerald-600" /> Customer Activity Timeline ({events.length})
      </h3>

      {events.length === 0 ? (
        <p className="text-xs text-gray-500 italic py-8 text-center bg-gray-50 rounded-xl border border-gray-100">
          No activity timeline recorded for this customer yet.
        </p>
      ) : (
        <div className="relative border-l-2 border-slate-100 ml-4 space-y-6 pb-2">
          {events.map((event: any, i: number) => (
            <div key={i} className="relative pl-6">
              <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white shadow-xs"></div>
              <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-2xs hover:shadow-xs transition-shadow">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                  <span className="font-bold text-gray-900 text-sm">{event.title}</span>
                  <span className="text-[11px] font-semibold text-gray-400">
                    {event.date ? new Date(event.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
                <p className="text-xs text-gray-600">{event.desc}</p>
                {event.tag && (
                  <span className="inline-block mt-2 px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-gray-100 text-gray-500">
                    {event.tag}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
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
