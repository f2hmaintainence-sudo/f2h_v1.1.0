"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Globe, Zap, Shield, Users, ShoppingBag, 
  TrendingUp, ArrowUpRight, Search, Bell,
  LayoutGrid, Activity, MousePointer2, Sparkles,
  ChevronRight, Map as MapIcon, Layers
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, BarChart, Bar,
  Cell, PieChart, Pie
} from 'recharts';

const CHART_DATA = [
  { name: '01:00', value: 400 },
  { name: '04:00', value: 300 },
  { name: '08:00', value: 900 },
  { name: '12:00', value: 1200 },
  { name: '16:00', value: 1500 },
  { name: '20:00', value: 1100 },
  { name: '23:00', value: 800 },
];

const CATEGORY_DATA = [
  { name: 'Grocery', value: 45, color: '#10b981' },
  { name: 'Electronics', value: 25, color: '#6366f1' },
  { name: 'Apparel', value: 20, color: '#f59e0b' },
  { name: 'Home', value: 10, color: '#ef4444' },
];

export default function NexusDashboard() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#020617] text-white p-8 font-sans selection:bg-indigo-500/30">
      {/* Background Ambience */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/5 blur-[120px] rounded-full" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03]" />
      </div>

      <div className="relative z-10 max-w-[1600px] mx-auto space-y-8">
        
        {/* --- Top Navigation / Header --- */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[32px] p-6 shadow-2xl">
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Zap className="text-white fill-white" size={28} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-black tracking-tight">Nexus <span className="text-indigo-400">Command</span></h1>
                <div className="px-2 py-0.5 rounded-md bg-indigo-500/20 border border-indigo-500/30 text-[10px] font-black text-indigo-400 uppercase tracking-widest">v5.0 Stable</div>
              </div>
              <p className="text-slate-400 text-sm font-medium mt-1">Real-time multisystem synchronization active</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden xl:flex items-center gap-8 mr-6 border-r border-white/10 pr-8">
              <div className="text-right">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Network Load</div>
                <div className="text-sm font-bold text-emerald-400">Low (12ms)</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sync Status</div>
                <div className="text-sm font-bold text-indigo-400">Encrypted</div>
              </div>
            </div>
            <div className="flex gap-2 bg-black/20 p-1.5 rounded-2xl border border-white/5">
               {['overview', 'systems', 'analytics'].map(tab => (
                 <button 
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeTab === tab ? 'bg-white/10 text-white shadow-xl border border-white/10' : 'text-slate-500 hover:text-slate-300'}`}
                 >
                   {tab}
                 </button>
               ))}
            </div>
          </div>
        </header>

        {/* --- Main Dashboard Content --- */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          
          {/* Left Column: Mission Control & Stats */}
          <div className="xl:col-span-3 space-y-8">
            
            {/* KPI Banner */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[
                { label: 'Total Revenue', value: '₹42,50,000', trend: '+12.5%', icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                { label: 'Active Users', value: '1,24,000', trend: '+8.2%', icon: Users, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
                { label: 'Deliveries', value: '8,420', trend: '+5.4%', icon: ShoppingBag, color: 'text-amber-400', bg: 'bg-amber-500/10' },
                { label: 'Uptime', value: '99.98%', trend: 'Stable', icon: Shield, color: 'text-purple-400', bg: 'bg-purple-500/10' },
              ].map((kpi, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  whileHover={{ y: -4, scale: 1.02 }}
                  className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-[32px] p-6 hover:bg-white/[0.05] transition-all cursor-pointer group"
                >
                  <div className={`w-12 h-12 ${kpi.bg} rounded-2xl flex items-center justify-center mb-4 group-hover:rotate-12 transition-transform`}>
                    <kpi.icon className={kpi.color} size={24} />
                  </div>
                  <div className="text-3xl font-black tracking-tight mb-1">{kpi.value}</div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{kpi.label}</span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded ${kpi.trend.includes('+') ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'}`}>
                      {kpi.trend}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Central Intelligence Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Performance Graph */}
              <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-[40px] p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-black tracking-tight">System Performance</h3>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Throughput Analytics</p>
                  </div>
                  <div className="p-2 bg-white/5 rounded-xl border border-white/10">
                    <TrendingUp className="text-indigo-400" size={20} />
                  </div>
                </div>
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={CHART_DATA}>
                      <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="name" stroke="#64748b" fontSize={10} fontWeight={800} axisLine={false} tickLine={false} />
                      <YAxis stroke="#64748b" fontSize={10} fontWeight={800} axisLine={false} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', fontSize: '12px' }}
                        itemStyle={{ color: '#fff', fontWeight: '900' }}
                      />
                      <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorValue)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Tactical Map View */}
              <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-[40px] p-8 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-transparent z-10" />
                <img 
                  src="https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&q=80&w=800" 
                  className="absolute inset-0 w-full h-full object-cover opacity-20 grayscale group-hover:scale-110 transition-transform duration-[10s]" 
                  alt="Tactical Map"
                />
                
                <div className="relative z-20 h-full flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-black tracking-tight uppercase">Live Coverage</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em]">Active Sensors: 42</span>
                      </div>
                    </div>
                    <button className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-2xl border border-white/20 transition-all">
                      <MapIcon size={20} />
                    </button>
                  </div>

                  <div className="bg-black/40 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 mt-8">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Node Distribution</span>
                      <span className="text-[10px] font-black text-white">BANGALORE CENTER</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <div className="text-xl font-black">12.4k</div>
                        <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Requests / min</div>
                      </div>
                      <div className="space-y-1 text-right">
                        <div className="text-xl font-black text-emerald-400">8.2ms</div>
                        <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Avg Latency</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Quick Management Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
               <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-[40px] p-8 relative overflow-hidden shadow-2xl shadow-indigo-500/20">
                  <div className="absolute top-[-20px] right-[-20px] w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                  <Sparkles className="text-white/40 mb-6" size={32} />
                  <h3 className="text-2xl font-black mb-2 leading-none">Apex AI Insights</h3>
                  <p className="text-white/70 text-sm font-medium mb-8">System predicts 14% growth in Zone C by next interval.</p>
                  <button className="flex items-center gap-2 px-6 py-3 bg-white text-indigo-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-transform">
                    View Full Analysis <ChevronRight size={14} />
                  </button>
               </div>

               <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-[40px] p-8 col-span-2">
                  <div className="flex items-center justify-between mb-8">
                     <h3 className="text-lg font-black tracking-tight">Recent Activity Nodes</h3>
                     <button className="text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-indigo-300">View Protocol</button>
                  </div>
                  <div className="space-y-4">
                    {[
                      { node: 'HUB_SOUTH_01', type: 'Delivery Batch', time: '2m ago', status: 'COMPLETED', color: 'text-emerald-400' },
                      { node: 'USER_AUTH_MASTER', type: 'Security Check', time: '5m ago', status: 'VERIFIED', color: 'text-indigo-400' },
                      { node: 'PROD_SYNC_V4', type: 'Catalog Update', time: '12m ago', status: 'QUEUED', color: 'text-amber-400' },
                    ].map((act, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all group">
                         <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-black/40 flex items-center justify-center font-mono text-[10px] font-bold text-slate-500 group-hover:text-indigo-400">
                               ID_{i+1}
                            </div>
                            <div>
                               <div className="text-sm font-black text-white">{act.node}</div>
                               <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{act.type}</div>
                            </div>
                         </div>
                         <div className="text-right">
                            <div className={`text-[10px] font-black ${act.color} tracking-widest`}>{act.status}</div>
                            <div className="text-[10px] font-bold text-slate-500 mt-0.5">{act.time}</div>
                         </div>
                      </div>
                    ))}
                  </div>
               </div>
            </div>

          </div>

          {/* Right Column: Global Telemetry Sidebar */}
          <div className="space-y-8">
             
             {/* Security Status */}
             <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-[40px] p-8">
                <div className="flex items-center gap-3 mb-6">
                   <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                      <Shield className="text-emerald-400" size={20} />
                   </div>
                   <h3 className="text-sm font-black uppercase tracking-widest">Security Core</h3>
                </div>
                <div className="space-y-6">
                   <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Protocol</span>
                        <span className="text-[10px] font-black text-white">TLS 1.3 Active</span>
                      </div>
                      <div className="text-sm font-bold text-emerald-100">All subsystems nominal. No breaches detected.</div>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 bg-white/5 rounded-2xl border border-white/5">
                         <div className="text-2xl font-black">0</div>
                         <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Threats</div>
                      </div>
                      <div className="text-center p-4 bg-white/5 rounded-2xl border border-white/5">
                         <div className="text-2xl font-black text-indigo-400">100%</div>
                         <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Integrity</div>
                      </div>
                   </div>
                </div>
             </div>

             {/* Categories Distribution */}
             <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-[40px] p-8">
                <h3 className="text-sm font-black uppercase tracking-widest mb-6">Category Sync</h3>
                <div className="h-[180px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={CATEGORY_DATA}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {CATEGORY_DATA.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
                        <tspan x="50%" dy="-2" fontSize="24" fontWeight="900" fill="#fff">4</tspan>
                        <tspan x="50%" dy="16" fontSize="8" fontWeight="700" fill="#64748b" letterSpacing="1">CORES</tspan>
                      </text>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-3 mt-4">
                   {CATEGORY_DATA.map((cat, i) => (
                     <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                           <div className="w-2 h-2 rounded-full" style={{ background: cat.color }} />
                           <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{cat.name}</span>
                        </div>
                        <span className="text-[11px] font-black">{cat.value}%</span>
                     </div>
                   ))}
                </div>
             </div>

             {/* Quick Actions Addon */}
             <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-[40px] p-8">
                <h3 className="text-sm font-black uppercase tracking-widest mb-6 text-indigo-400">Nexus Addons</h3>
                <div className="grid grid-cols-2 gap-3">
                   {[
                     { label: 'Generate Report', icon: Activity },
                     { label: 'Neural Scan', icon: MousePointer2 },
                     { label: 'Node Relay', icon: Layers },
                     { label: 'Grid Settings', icon: LayoutGrid },
                   ].map((btn, i) => (
                     <button key={i} className="flex flex-col items-center justify-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all group">
                        <btn.icon size={20} className="text-slate-400 group-hover:text-indigo-400 transition-colors" />
                        <span className="text-[9px] font-black text-slate-500 group-hover:text-white uppercase tracking-wider text-center">{btn.label}</span>
                     </button>
                   ))}
                </div>
             </div>

          </div>

        </div>

      </div>
    </div>
  );
}
