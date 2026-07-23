'use client';

import React, { useState, useEffect } from 'react';
import {
  ChevronRight,
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
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
          {!activeTab.startsWith('Orders') && activeTab !== 'Overview & Insights' && (
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
      className={`bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center ${
        onClick ? 'cursor-pointer hover:border-emerald-300 hover:shadow-md transition-all' : ''
      }`}
    >
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">{title}</p>
      <p className="text-xl font-black text-gray-900 mb-1">{value}</p>
      <p className="text-xs text-gray-400 flex items-center gap-1">
        <AlertTriangle size={12} className="opacity-0" /> {/* Spacer */}
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

function getAvatarColors(name: string) {
  const char = name?.charAt(0)?.toUpperCase() || 'A';
  if (['A','B','C','D','P'].includes(char)) return 'bg-emerald-50 text-emerald-600';
  if (['E','F','G','H','S'].includes(char)) return 'bg-blue-50 text-blue-600';
  if (['I','J','K','L','N'].includes(char)) return 'bg-indigo-50 text-indigo-600';
  if (['M','O','Q'].includes(char)) return 'bg-amber-50 text-amber-600';
  if (['R','T','U','V'].includes(char)) return 'bg-purple-50 text-purple-600';
  return 'bg-rose-50 text-rose-600';
}
