'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle,
  PauseCircle,
  XCircle,
  Clock,
  ChevronRight,
  Home,
  LayoutDashboard,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import TableComponents from '@/components/Table Generator/TableComponents';

const API = '/api/subscriptions/subscriptions';
const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface SummaryData {
  total: number;
  active: number;
  paused: number;
  expired: number;
  cancelled: number;
}

const statusCards = [
  {
    key: 'active' as const,
    label: 'Active',
    icon: CheckCircle,
    gradient: 'from-emerald-500 to-emerald-700',
    ring: 'ring-emerald-200',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    lightText: 'text-emerald-100',
  },
  {
    key: 'paused' as const,
    label: 'Paused',
    icon: PauseCircle,
    gradient: 'from-amber-400 to-amber-600',
    ring: 'ring-amber-200',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    lightText: 'text-amber-100',
  },
  {
    key: 'expired' as const,
    label: 'Expired',
    icon: Clock,
    gradient: 'from-slate-400 to-slate-600',
    ring: 'ring-slate-200',
    bg: 'bg-slate-50',
    text: 'text-slate-700',
    lightText: 'text-slate-200',
  },
  {
    key: 'cancelled' as const,
    label: 'Cancelled',
    icon: XCircle,
    gradient: 'from-rose-400 to-rose-600',
    ring: 'ring-rose-200',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    lightText: 'text-rose-100',
  },
  {
    key: 'total' as const,
    label: 'Total',
    icon: LayoutDashboard,
    gradient: 'from-[#14532d] to-[#1f7a4d]',
    ring: 'ring-green-200',
    bg: 'bg-green-50',
    text: 'text-deep-green',
    lightText: 'text-green-100',
  },
];

export default function SubscriptionsPage() {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [tableKey, setTableKey] = useState(0);

  const fetchSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const res = await fetch(`${API_URL}/api/subscriptions/subscriptions/summary`, {
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        if (json.status) setSummary(json.data);
      }
    } catch (e) {
      console.error('Failed to fetch subscription summary', e);
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const handleCardClick = (key: string) => {
    if (key === 'total') {
      setActiveFilter(null);
    } else {
      setActiveFilter((prev) => (prev === key ? null : key));
    }
    setTableKey((k) => k + 1);
  };

  const tableFilters = activeFilter ? [activeFilter] : [];

  return (
    <div className="space-y-4 p-1 md:p-2 font-sans  min-h-screen">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <nav
          className="flex items-center gap-1.5 text-sm text-gray-500"
          aria-label="Breadcrumb"
        >
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center gap-1 hover:text-fresh-green transition-colors"
          >
            <Home size={14} />
            <span>Dashboard</span>
          </Link>
          <ChevronRight size={14} className="text-gray-300" />
          <span className="text-gray-400">Subscriptions</span>
          <ChevronRight size={14} className="text-gray-300" />
          <span className="font-semibold text-deep-green">Status</span>
        </nav>

        <button
          onClick={() => {
            fetchSummary();
            setTableKey((k) => k + 1);
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-deep-green px-3 py-2 text-sm font-bold text-white hover:bg-green-800 transition-colors"
        >
          <RefreshCw size={15} />
          Refresh
        </button>
      </div>

      {/* Dashboard Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {statusCards.map((card) => {
          const Icon = card.icon;
          const count = summary?.[card.key] ?? 0;
          const isActive = activeFilter === card.key || (card.key === 'total' && !activeFilter);

          return (
            <button
              key={card.key}
              onClick={() => handleCardClick(card.key)}
              className={`group relative overflow-hidden rounded-2xl p-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${
                isActive
                  ? `bg-gradient-to-br ${card.gradient} text-white shadow-lg ring-2 ${card.ring}`
                  : `bg-white border border-gray-100 shadow-sm hover:border-gray-200`
              }`}
            >
              {/* Glow effect */}
              {isActive && (
                <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/10 blur-2xl transition-opacity" />
              )}

              <div className="relative flex items-start justify-between">
                <div>
                  <div
                    className={`text-[11px] font-bold uppercase tracking-wide ${
                      isActive ? card.lightText : 'text-gray-400'
                    }`}
                  >
                    {card.label}
                  </div>
                  <div
                    className={`mt-2 text-3xl font-black ${
                      isActive ? 'text-white' : card.text
                    }`}
                  >
                    {loadingSummary ? (
                      <span className="inline-block h-8 w-12 animate-pulse rounded bg-gray-200" />
                    ) : (
                      count.toLocaleString('en-IN')
                    )}
                  </div>
                </div>
                <div
                  className={`rounded-xl p-2 ${
                    isActive ? 'bg-white/15' : card.bg
                  }`}
                >
                  <Icon
                    size={20}
                    className={isActive ? 'text-white' : card.text}
                  />
                </div>
              </div>

              {/* Selection indicator */}
              {isActive && (
                <div className="mt-3 h-0.5 w-8 rounded-full bg-white/50" />
              )}
            </button>
          );
        })}
      </div>

      {/* Active filter badge */}
      {activeFilter && (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-deep-green/10 px-3 py-1 text-xs font-bold text-deep-green">
            Filtered by:{' '}
            <span className="capitalize">{activeFilter}</span>
            <button
              onClick={() => {
                setActiveFilter(null);
                setTableKey((k) => k + 1);
              }}
              className="ml-1 rounded-full p-0.5 hover:bg-deep-green/10 transition"
            >
              <XCircle size={12} />
            </button>
          </span>
        </div>
      )}

      {/* Table */}
      
        <TableComponents
          key={tableKey}
          title=""
          apiBase={API}
          actionTypes={['view']}
          filters={tableFilters}
        />
     
    </div>
  );
}