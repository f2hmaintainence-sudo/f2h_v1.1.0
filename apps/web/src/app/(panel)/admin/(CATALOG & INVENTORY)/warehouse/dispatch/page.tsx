"use client";

import { useEffect, useState, useMemo } from "react";
import { api } from "@/services/api.client";
import {
  DispatchPlanningService,
  DeliveryPartnerPlan,
  WarehouseTotalItem
} from "@/services/dispatch-planning.service";
import {
  ClipboardList, RefreshCw, Home, ChevronRight,
  Truck, Package, Users, Zap, CheckCircle2,
  ChevronDown, ChevronUp, Printer, FileDown, Search,
  Calendar, Info, AlertCircle, ShoppingBag, Eye, EyeOff, Check, Loader2,
  X, Trash2, Plus
} from "lucide-react";
import Link from "next/link";
import { showSuccessToast, showErrorToast } from "@/components/Toast";



function getPastWeekDates() {
  const dates = [];
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const labelFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric',
  });

  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const parts = formatter.formatToParts(d);
    const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    const dateStr = `${pick('year')}-${pick('month')}-${pick('day')}`;
    
    let label = labelFormatter.format(d);
    if (i === 0) label = `Today (${label})`;
    else if (i === 1) label = `Yesterday (${label})`;
    
    dates.push({ value: dateStr, label });
  }
  return dates;
}

export default function DispatchPlanningDashboard() {
  const [isGenerated, setIsGenerated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState<DeliveryPartnerPlan[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  
  // Expanded states
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [showOrderBreakdowns, setShowOrderBreakdowns] = useState<Record<string, boolean>>({});
  const [approvingRuns, setApprovingRuns] = useState<Record<string, boolean>>({});
  
  // Modal & Edit states
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [activePlanForModal, setActivePlanForModal] = useState<DeliveryPartnerPlan | null>(null);
  const [modalItems, setModalItems] = useState<any[]>([]);
  const [availableVariants, setAvailableVariants] = useState<any[]>([]);
  const [selectedVariantToAdd, setSelectedVariantToAdd] = useState("");
  const [qtyToAdd, setQtyToAdd] = useState(1);
  const [searchQueryVariant, setSearchQueryVariant] = useState("");
  const [isSearchingVariantDropdownOpen, setIsSearchingVariantDropdownOpen] = useState(false);
  
  // Temporary Filter Inputs (before Apply Filters click)
  const [riderInput, setRiderInput] = useState("");
  const [branchInput, setBranchInput] = useState("");
  const [productInput, setProductInput] = useState("");
  const [searchInput, setSearchInput] = useState("");

  // Active Filter Variables (applied to view)
  const [activeRider, setActiveRider] = useState("");
  const [activeBranch, setActiveBranch] = useState("");
  const [activeProduct, setActiveProduct] = useState("");
  const [activeSearch, setActiveSearch] = useState("");

  // Slot Filter (applies instantly)
  const [selectedSlot, setSelectedSlot] = useState("");

  const [targetDate, setTargetDate] = useState(() => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date());
    const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    return `${pick('year')}-${pick('month')}-${pick('day')}`;
  });

  const [availableDates, setAvailableDates] = useState<{ value: string; label: string }[]>(() => getPastWeekDates());

  // Fetch available dates from backend
  useEffect(() => {
    api.get<any>('/admin/delivery/dispatch/requirements/dates')
      .then(res => {
        if (res.data?.status && Array.isArray(res.data.data)) {
          const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric',
          });
          const todayParts = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
          }).formatToParts(new Date());
          const todayStr = `${todayParts.find(p => p.type === 'year')?.value}-${todayParts.find(p => p.type === 'month')?.value}-${todayParts.find(p => p.type === 'day')?.value}`;
          
          const datesSet = new Set<string>(res.data.data);
          // Always ensure today is available to query/load
          datesSet.add(todayStr);

          const sortedDates = Array.from(datesSet).sort((a, b) => b.localeCompare(a));
          
          const mapped = sortedDates.map(dateStr => {
            const parts = dateStr.split('-');
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const day = parseInt(parts[2], 10);
            const dateObj = new Date(year, month, day);
            let label = formatter.format(dateObj);
            
            if (dateStr === todayStr) {
              label = `Today (${label})`;
            } else {
              const yesterdayObj = new Date();
              yesterdayObj.setDate(yesterdayObj.getDate() - 1);
              const yesterdayParts = new Intl.DateTimeFormat('en-CA', {
                timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
              }).formatToParts(yesterdayObj);
              const yesterdayStr = `${yesterdayParts.find(p => p.type === 'year')?.value}-${yesterdayParts.find(p => p.type === 'month')?.value}-${yesterdayParts.find(p => p.type === 'day')?.value}`;
              if (dateStr === yesterdayStr) {
                label = `Yesterday (${label})`;
              }
            }
            return { value: dateStr, label };
          });
          setAvailableDates(mapped);
        }
      })
      .catch(() => {});
  }, [isGenerated]);

  // Fetch warehouses
  useEffect(() => {
    api.get<any>('/admin/warehouses/active/list')
      .then(res => {
        if (res.data?.data) {
          setWarehouses(res.data.data);
          if (res.data.data.length > 0) {
            setSelectedWarehouse(res.data.data[0].warehouse_id || res.data.data[0].id);
          }
        }
      })
      .catch(() => {});
  }, []);

  // Fetch available variants for the modal search
  useEffect(() => {
    api.get<any>('/admin/delivery/dispatch/available-variants')
      .then(res => {
        if (res.data?.status && Array.isArray(res.data.data)) {
          setAvailableVariants(res.data.data);
        }
      })
      .catch((err) => console.error("Failed to load available variants:", err));
  }, []);

  // Fetch and Process Today's Dispatch Plan via Service
  const handleGeneratePlan = async () => {
    if (!targetDate) {
      showErrorToast("Please select a target date.");
      return;
    }
    setLoading(true);
    try {
      const data = await DispatchPlanningService.fetchDispatchPlan(targetDate);
      setPlans(data);
      if (data.length > 0) {
        // Auto-expand the first couple of cards
        const initialExpanded: Record<string, boolean> = {};
        data.slice(0, 2).forEach(p => {
          initialExpanded[p.run_id] = true;
        });
        setExpandedCards(initialExpanded);
        setIsGenerated(true);
        showSuccessToast("Dispatch requirements calculated successfully!");
      } else {
        setIsGenerated(false);
        showSuccessToast("No delivery runs have been generated/assigned for today yet. Please go to Delivery Assign to assign routes first.");
      }
    } catch (err: any) {
      console.error(err);
      showErrorToast("Failed to calculate dispatch requirements.");
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch dispatch plan when targetDate changes or component mounts
  useEffect(() => {
    const autoLoad = async () => {
      if (!targetDate) return;
      setLoading(true);
      try {
        const data = await DispatchPlanningService.fetchDispatchPlan(targetDate);
        setPlans(data);
        if (data.length > 0) {
          setIsGenerated(true);
          const initialExpanded: Record<string, boolean> = {};
          data.slice(0, 2).forEach(p => {
            initialExpanded[p.run_id] = true;
          });
          setExpandedCards(initialExpanded);
        } else {
          setIsGenerated(false);
        }
      } catch (err: any) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    autoLoad();
  }, [targetDate]);

  // Reset page state
  const handleReset = () => {
    setIsGenerated(false);
    setPlans([]);
    setExpandedCards({});
    setShowOrderBreakdowns({});
    setRiderInput("");
    setBranchInput("");
    setProductInput("");
    setSearchInput("");
    setActiveRider("");
    setActiveBranch("");
    setActiveProduct("");
    setActiveSearch("");
    setSelectedSlot("");
  };

  // Apply filters action
  const applyFilters = () => {
    setActiveRider(riderInput);
    setActiveBranch(branchInput);
    setActiveProduct(productInput);
    setActiveSearch(searchInput);
  };

  // Clear filters action
  const clearFilters = () => {
    setRiderInput("");
    setBranchInput("");
    setProductInput("");
    setSearchInput("");
    setActiveRider("");
    setActiveBranch("");
    setActiveProduct("");
    setActiveSearch("");
    setSelectedSlot("");
  };

  // Warehouse overall totals calculation via Service
  const warehouseTotals = useMemo(() => {
    return DispatchPlanningService.compileWarehouseTotals(plans);
  }, [plans]);

  // Overall statistics
  const statistics = useMemo(() => {
    let totalOrders = 0;
    const uniqueCustomers = new Set<string>();
    let totalRiders = 0;
    let totalQty = 0;

    plans.forEach(p => {
      totalOrders += p.orders.length;
      p.orders.forEach(o => uniqueCustomers.add(o.customer_name));
      if (p.delivery_partner_id) totalRiders++;
      totalQty += p.totalQuantity;
    });

    return {
      totalOrders,
      totalCustomers: uniqueCustomers.size,
      totalRiders,
      totalProducts: Object.keys(warehouseTotals).length,
      totalQty
    };
  }, [plans, warehouseTotals]);

  // Filter dropdown lists
  const availableBranches = useMemo(() => {
    return Array.from(new Set(plans.map(p => p.branch_name))).filter(Boolean);
  }, [plans]);

  const availableProducts = useMemo(() => {
    const productsMap = new Map<string, string>();
    plans.forEach(p => {
      Object.values(p.totals).forEach(t => {
        productsMap.set(t.product_variant_id, t.product_name);
      });
    });
    return Array.from(productsMap.entries()).map(([id, name]) => ({ id, name }));
  }, [plans]);

  // Approve Dispatch Workflow - Open Modal
  const handleApproveDispatch = async (plan: DeliveryPartnerPlan) => {
    if (!selectedWarehouse) {
      showErrorToast("Please select a source warehouse from the dropdown first.");
      return;
    }
    setActivePlanForModal(plan);
    // Clone and map totals to array for modal state editing
    const itemsArray = Object.values(plan.totals || {}).map(item => ({
      ...item,
      planned_qty: item.quantity,
      loaded_qty: item.quantity
    }));
    setModalItems(itemsArray);
    setSelectedVariantToAdd("");
    setQtyToAdd(1);
    setSearchQueryVariant("");
    setIsApproveModalOpen(true);
  };

  // Confirm Dispatch Workflow from Modal
  const handleConfirmModalApproval = async () => {
    if (!activePlanForModal || !selectedWarehouse) return;

    setApprovingRuns(prev => ({ ...prev, [activePlanForModal.run_id]: true }));
    setIsApproveModalOpen(false);

    try {
      // Re-compile totals from modalItems back to the format the API expects
      const updatedTotals: Record<string, any> = {};
      modalItems.forEach(item => {
        const key = `${item.product_name.trim()}::${item.variant_name.trim()}`;
        updatedTotals[key] = {
          ...item,
          quantity: item.loaded_qty
        };
      });

      const res = await DispatchPlanningService.approveDispatch(
        activePlanForModal.id,
        selectedWarehouse,
        updatedTotals
      );

      if (res && res.error) {
        showErrorToast(res.error);
        return;
      }
      showSuccessToast(`Dispatch approved and inventory issued for ${activePlanForModal.delivery_partner_name}!`);
      
      // Update status locally and totals in plan
      setPlans(prev => prev.map(p => {
        if (p.run_id === activePlanForModal.run_id) {
          const totalQty = modalItems.reduce((sum, item) => sum + Number(item.loaded_qty || 0), 0);
          const totalProds = modalItems.length;
          return {
            ...p,
            status: "dispatched",
            totals: updatedTotals,
            totalQuantity: totalQty,
            totalProducts: totalProds
          };
        }
        return p;
      }));
    } catch (err: any) {
      console.error(err);
      showErrorToast(err.response?.data?.message || err.message || "Failed to approve dispatch.");
    } finally {
      setApprovingRuns(prev => ({ ...prev, [activePlanForModal.run_id]: false }));
      setActivePlanForModal(null);
    }
  };

  // Expand / Collapse Helpers
  const toggleCard = (runId: string) => {
    setExpandedCards(prev => ({ ...prev, [runId]: !prev[runId] }));
  };

  const toggleOrderBreakdown = (runId: string) => {
    setShowOrderBreakdowns(prev => ({ ...prev, [runId]: !prev[runId] }));
  };

  const expandAll = () => {
    const expanded: Record<string, boolean> = {};
    plans.forEach(p => { expanded[p.run_id] = true; });
    setExpandedCards(expanded);
  };

  const collapseAll = () => {
    setExpandedCards({});
  };

  // Export to CSV Function
  const exportToCSV = () => {
    if (plans.length === 0) return;
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Delivery Boy,Branch,Slot,Product,Variant,Quantity,No. of Orders\n";

    plans.forEach(plan => {
      Object.values(plan.totals).forEach(t => {
        csvContent += `"${plan.delivery_partner_name}","${plan.branch_name}","${plan.delivery_slot}","${t.product_name}","${t.variant_name}",${t.quantity},${t.orderCount || 1}\n`;
      });
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `daily_dispatch_plan_${targetDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showSuccessToast("CSV exported!");
  };

  // Print single rider dispatch sheet
  const printSingleRider = (plan: DeliveryPartnerPlan) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    const itemsTableRows = Object.values(plan.totals).map(t => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">
          <strong>${t.product_name}</strong><br/>
          <span style="font-size: 12px; color: #475569;">${t.variant_name || t.product_name}</span>
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center; font-weight: bold; font-size: 15px;">× ${t.quantity}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center; font-weight: bold;">${t.orderCount || 1}</td>
      </tr>
    `).join('');

    const ordersRows = plan.orders.map(o => `
      <div style="border: 1px solid #f1f5f9; padding: 10px; margin-bottom: 8px; border-radius: 6px;">
        <div style="font-weight: bold; font-size: 14px; margin-bottom: 4px;">Order #${o.order_id} - ${o.customer_name}</div>
        <div style="font-size: 12px; color: #64748b; margin-bottom: 6px;">${o.address_line}</div>
        <ul style="margin: 0; padding-left: 20px; font-size: 13px;">
          ${o.items.map(item => `<li>${item.product_name}${item.variant_name && item.variant_name !== item.product_name ? ` (${item.variant_name})` : ''} × ${item.quantity}</li>`).join('')}
        </ul>
      </div>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Dispatch Plan - ${plan.delivery_partner_name}</title>
          <style>
            body { font-family: sans-serif; padding: 30px; color: #1e293b; line-height: 1.5; }
            .header { border-bottom: 2px solid #10b981; padding-bottom: 15px; margin-bottom: 25px; }
            .grid { display: grid; grid-template-cols: 1fr 1fr; gap: 15px; margin-bottom: 25px; }
            .meta-box { background: #f8fafc; padding: 12px; border-radius: 8px; font-size: 14px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th { background: #f1f5f9; padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #475569; }
            .footer { font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; margin-top: 50px; text-align: center; }
            h3 { border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; color: #0f172a; margin-top: 30px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 style="margin: 0; color: #047857;">F2H Daily Rider Dispatch Sheet</h1>
            <p style="margin: 5px 0 0 0; font-size: 14px; color: #64748b;">Prepared for Date: ${targetDate}</p>
          </div>
          <div class="grid">
            <div class="meta-box">
              <strong>Rider Name:</strong> ${plan.delivery_partner_name}<br>
              <strong>Phone:</strong> ${plan.phone}
            </div>
            <div class="meta-box">
              <strong>Branch:</strong> ${plan.branch_name}<br>
              <strong>Slot:</strong> <span style="text-transform: capitalize;">${plan.delivery_slot}</span>
            </div>
          </div>
          
          <h3>1. Items to Dispatch</h3>
          <table>
            <thead>
              <tr>
                <th>Product / Variant</th>
                <th style="text-align: center;">Qty to Issue</th>
                <th style="text-align: center;">Orders</th>
              </tr>
            </thead>
            <tbody>
              ${itemsTableRows}
            </tbody>
          </table>

          <h3>2. Assigned Customer Orders (${plan.orders.length})</h3>
          <div>
            ${ordersRows}
          </div>
          
          <div class="footer">
            Printed on ${new Date().toLocaleString()} - Farm to Home (F2H) Warehouse Logistics
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Filter plans based on selected inputs
  const filteredPlans = useMemo(() => {
    return plans.filter(p => {
      const matchesSearch = activeSearch === "" || 
        p.delivery_partner_name.toLowerCase().includes(activeSearch.toLowerCase()) ||
        p.orders.some(o => o.customer_name.toLowerCase().includes(activeSearch.toLowerCase())) ||
        p.orders.some(o => String(o.order_id || '').includes(activeSearch));
        
      const matchesBranch = activeBranch === "" || p.branch_name === activeBranch;
      const matchesRider = activeRider === "" || p.delivery_partner_name === activeRider;
      const matchesSlot = selectedSlot === "" || p.delivery_slot === selectedSlot;
      const matchesProduct = activeProduct === "" || Object.keys(p.totals).includes(activeProduct);

      return matchesSearch && matchesBranch && matchesRider && matchesSlot && matchesProduct;
    });
  }, [plans, activeSearch, activeBranch, activeRider, selectedSlot, activeProduct]);

  return (
    <div className="space-y-3 p-1 md:p-2 font-sans min-h-screen text-slate-800 pb-16 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Global CSS style for print optimization */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
          .print-full { width: 100% !important; display: block !important; }
          .print-card-break { page-break-inside: avoid !important; border: 1px solid #e2e8f0 !important; margin-bottom: 25px !important; }
        }
      ` }} />

      {/* Breadcrumb Header matching panel theme */}
      <div className="flex items-center justify-between no-print border-b border-slate-100 pb-4">
          <nav className="flex items-center gap-1.5 text-sm text-gray-500" aria-label="Breadcrumb">
            <Link
              href="/admin/dashboard"
              className="inline-flex items-center gap-1 hover:text-fresh-green transition-colors"
            >
              <Home size={14} />
              <span>Dashboard</span>
            </Link>
            <ChevronRight size={14} className="text-gray-300" />
            <span className="text-gray-400">Warehouse</span>
            <ChevronRight size={14} className="text-gray-300" />
            <span className="font-semibold text-deep-green font-semibold">Dispatch Planning</span>
          </nav>

        <div className="flex items-center gap-2">
          {/* Target Date Picker Dropdown */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm">
            <Calendar size={14} className="text-slate-400" />
            <select
              value={targetDate}
              onChange={e => setTargetDate(e.target.value)}
              className="outline-none border-none bg-transparent font-bold cursor-pointer text-slate-700"
            >
              {availableDates.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          {/* Warehouse Selector */}
          {warehouses.length > 0 && (
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm">
              <Package size={14} className="text-slate-400" />
              <select
                value={selectedWarehouse}
                onChange={e => setSelectedWarehouse(e.target.value)}
                className="outline-none border-none bg-transparent font-bold cursor-pointer text-slate-700"
              >
                {warehouses.map(w => (
                  <option key={w.warehouse_id || w.id} value={w.warehouse_id || w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isGenerated && (
            <>
              <button
                onClick={handleGeneratePlan}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs md:text-sm font-semibold hover:bg-slate-50 transition-all text-slate-700 shadow-sm"
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
              </button>
              <button
                onClick={exportToCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs md:text-sm font-semibold hover:bg-slate-50 transition-all text-slate-700 shadow-sm"
              >
                <FileDown size={14} /> Export CSV
              </button>
            </>
          )}
        </div>
      </div>

      {/* Page Title Header */}
      <div className="no-print">
        <h1 className="text-2xl font-black text-slate-900">Dispatch Planning</h1>
        <p className="text-xs text-slate-400 mt-1">Plan and prepare today's dispatch for delivery boys</p>
      </div>

      {/* ──────────────────────────────────────────────────────────────── */}
      {/* 1. INITIAL EMPTY STATE / SPLIT LAYOUT */}
      {/* ──────────────────────────────────────────────────────────────── */}
      {!isGenerated && !loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start mt-6">
          {/* Left card: Generate Dispatch CTA */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 text-center lg:col-span-1 flex flex-col items-center justify-center min-h-[360px]">
            <div className="h-14 w-14 rounded-2xl bg-emerald-50 flex items-center justify-center mb-5">
              <ClipboardList className="h-7 w-7 text-emerald-600" />
            </div>
            <h2 className="text-lg font-black text-slate-900">Generate Today's Dispatch Plan</h2>
            <p className="text-xs text-slate-400 mt-2 mb-6 leading-relaxed">
              Click the button below to fetch today's orders and generate dispatch requirements for all delivery boys.
            </p>
            <button
              onClick={handleGeneratePlan}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all"
            >
              <Zap size={14} /> Generate Today's Dispatch Requirements
            </button>
          </div>

          {/* Right layout: Summary Placeholder */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-50 border border-dashed border-slate-350 rounded-2xl p-6 min-h-[160px] flex flex-col justify-center items-center text-slate-400">
              <ShoppingBag size={28} className="mb-2 text-slate-300" />
              <p className="text-xs font-bold">Today's Dispatch Summary</p>
              <p className="text-[10px] mt-0.5">Please generate the plan to view dispatch metrics.</p>
            </div>
            <div className="bg-slate-50 border border-dashed border-slate-350 rounded-2xl p-6 min-h-[180px] flex flex-col justify-center items-center text-slate-400">
              <Package size={28} className="mb-2 text-slate-300" />
              <p className="text-xs font-bold">Overall Product Summary</p>
              <p className="text-[10px] mt-0.5">Prepare list will show here once plan is generated.</p>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────── */}
      {/* 2. LOADING STATE */}
      {/* ──────────────────────────────────────────────────────────────── */}
      {loading && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 animate-pulse">
                <div className="h-4 w-20 bg-slate-100 rounded mb-3" />
                <div className="h-8 w-12 bg-slate-200 rounded" />
              </div>
            ))}
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-6 animate-pulse">
            <div className="h-5 w-40 bg-slate-200 rounded mb-4" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-10 bg-slate-100 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────── */}
      {/* 3. ACTIVE DASHBOARD AND PLAN VIEWS */}
      {/* ──────────────────────────────────────────────────────────────── */}
      {isGenerated && !loading && (
        <div className="space-y-6 print-full">

              {/* SECTION 1 - SUMMARY AND STATS IN SPLIT LAYOUT */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
                {/* Left side overall summary */}
                <div className="lg:col-span-1 bg-white border border-slate-200 rounded-2xl shadow-sm p-4 no-print h-[340px] flex flex-col justify-between">
                  <div className="flex flex-col h-full">
                    <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-3">
                      Today's Dispatch Summary
                    </h3>
                    <div className="flex-1 overflow-y-auto pr-1 space-y-2 max-h-[260px]">
                      {[
                        { label: "Total Orders Today", value: statistics.totalOrders, icon: ShoppingBag, color: "bg-sky-50 text-sky-700" },
                        { label: "Total Customers", value: statistics.totalCustomers, icon: Users, color: "bg-emerald-50 text-emerald-700" },
                        { label: "Total Delivery Boys", value: statistics.totalRiders, icon: Truck, color: "bg-indigo-50 text-indigo-700" },
                        { label: "Total Products", value: statistics.totalProducts, icon: Package, color: "bg-amber-50 text-amber-700" },
                        { label: "Total Quantity (All Units)", value: statistics.totalQty, icon: Zap, color: "bg-rose-50 text-rose-700" },
                      ].map((stat, i) => {
                        const Icon = stat.icon;
                        return (
                          <div key={i} className={`flex items-center justify-between p-2.5 rounded-xl ${stat.color} border border-slate-100`}>
                            <div className="flex items-center gap-2">
                              <Icon size={14} />
                              <span className="text-xs font-bold">{stat.label}</span>
                            </div>
                            <span className="text-xs font-black">{stat.value}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
    
                {/* Right side product aggregates table */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print-card-break h-[340px] flex flex-col">
                  <div className="bg-slate-50 border-b border-slate-200 p-4 flex items-center justify-between shrink-0">
                    <h2 className="text-xs md:text-sm font-black text-slate-800 flex items-center gap-2">
                      <Package size={16} className="text-emerald-600" /> Overall Product Summary
                    </h2>
                    <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-extrabold border border-emerald-100 no-print">
                      {statistics.totalProducts} items
                    </span>
                  </div>
                  
                  <div className="flex-1 overflow-x-auto overflow-y-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="bg-slate-50/50 border-b text-[10px] text-slate-500 font-black uppercase tracking-wider">
                        <th className="px-4 py-2.5">Product</th>
                        <th className="px-4 py-2.5">Variant</th>
                        <th className="px-4 py-2.5 text-center">Qty to Issue</th>
                        <th className="px-4 py-2.5 text-center">Orders</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.values(warehouseTotals).map((wt, idx) => (
                        <tr key={idx} className="border-b last:border-0 hover:bg-slate-50/30 transition-colors">
                          <td className="px-4 py-2.5 font-bold text-slate-800">
                            {wt.product_name}
                          </td>
                          <td className="px-4 py-2.5 text-slate-600 font-semibold">
                            {wt.variant_name || wt.product_name}
                          </td>
                          <td className="px-4 py-2.5 text-center font-black text-emerald-700 text-sm">
                            × {wt.quantity}
                          </td>
                          <td className="px-4 py-2.5 text-center font-bold text-slate-600">
                            {wt.orderCount || 1}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              </div>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center gap-3 no-print">
            
            {/* Search Input */}
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search orders or customers..."
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs md:text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
              />
            </div>

            {/* Delivery Boy Select */}
            <select
              value={riderInput}
              onChange={e => setRiderInput(e.target.value)}
              className="py-2 px-3 border border-slate-200 rounded-xl text-xs md:text-sm outline-none bg-white text-slate-700"
            >
              <option value="">All Delivery Boys</option>
              {Array.from(new Set(plans.map(p => p.delivery_partner_name))).map((rider, i) => (
                <option key={i} value={rider}>{rider}</option>
              ))}
            </select>

            {/* Area / Route Select */}
            {availableBranches.length > 0 && (
              <select
                value={branchInput}
                onChange={e => setBranchInput(e.target.value)}
                className="py-2 px-3 border border-slate-200 rounded-xl text-xs md:text-sm outline-none bg-white text-slate-700"
              >
                <option value="">All Areas</option>
                {availableBranches.map((b, i) => (
                  <option key={i} value={b}>{b}</option>
                ))}
              </select>
            )}

            {/* Slot Filter (applied instantly) */}
            <select
              value={selectedSlot}
              onChange={e => setSelectedSlot(e.target.value)}
              className="py-2 px-3 border border-slate-200 rounded-xl text-xs md:text-sm outline-none bg-white text-slate-700"
            >
              <option value="">All Slots</option>
              <option value="morning">Morning</option>
              <option value="evening">Evening</option>
            </select>

            {/* Product Filter */}
            {availableProducts.length > 0 && (
              <select
                value={productInput}
                onChange={e => setProductInput(e.target.value)}
                className="py-2 px-3 border border-slate-200 rounded-xl text-xs md:text-sm outline-none bg-white text-slate-700"
              >
                <option value="">All Products</option>
                {availableProducts.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}

            <button
              onClick={applyFilters}
              className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all shadow-sm"
            >
              Apply Filters
            </button>

            <button
              onClick={clearFilters}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-650 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all shadow-sm"
            >
              Clear
            </button>

            <div className="flex gap-2 ml-auto">
              <button
                onClick={expandAll}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-all"
              >
                Expand All
              </button>
              <button
                onClick={collapseAll}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-all"
              >
                Collapse All
              </button>
            </div>

          </div>

          {/* SECTION 2 - RIDER PLANNING CARDS */}
          {filteredPlans.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-slate-200/60 no-print">
              <Truck size={48} className="mx-auto mb-4 text-slate-200" />
              <p className="text-sm font-bold text-slate-400">No dispatch plans matching the filters were found.</p>
            </div>
          ) : (
            <div className="space-y-4 print-full">
              {filteredPlans.map((plan) => {
                const isExpanded = !!expandedCards[plan.run_id];
                const showBreakdown = !!showOrderBreakdowns[plan.run_id];
                const isDispatched = ['dispatched', 'in_progress', 'completed', 'partial'].includes(plan.status);
                const isApproving = !!approvingRuns[plan.run_id];

                return (
                  <div
                    key={plan.run_id}
                    id={`rider-card-${plan.run_id}`}
                    className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden print-card-break transition-all"
                  >
                    {/* Header Row */}
                    <div 
                      onClick={() => toggleCard(plan.run_id)}
                      className="p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/50 select-none border-b border-slate-100"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                          <Truck size={20} />
                        </div>
                        <div>
                          <h3 className="font-black text-slate-800 text-base flex items-center gap-2">
                            {plan.delivery_partner_name}
                            <span className="text-xs font-mono font-medium text-slate-400">({plan.run_number})</span>
                          </h3>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 mt-0.5">
                            <span>Phone: <strong>{plan.phone}</strong></span>
                            <span className="h-1 w-1 rounded-full bg-slate-300" />
                            <span>Route/Branch: <strong>{plan.branch_name}</strong></span>
                            <span className="h-1 w-1 rounded-full bg-slate-300" />
                            <span className="capitalize">Slot: <strong>{plan.delivery_slot}</strong></span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end md:self-auto">
                        <div className="flex items-center gap-4 text-xs font-bold text-slate-600">
                          <div className="text-center">
                            <span className="block text-[10px] text-slate-400 uppercase font-black">Orders</span>
                            <span>{plan.totalOrders}</span>
                          </div>
                          <div className="text-center border-l pl-3">
                            <span className="block text-[10px] text-slate-400 uppercase font-black">Customers</span>
                            <span>{plan.totalCustomers}</span>
                          </div>
                          <div className="text-center border-l pl-3">
                            <span className="block text-[10px] text-slate-400 uppercase font-black">Products</span>
                            <span>{plan.totalProducts}</span>
                          </div>
                          <div className="text-center border-l pl-3">
                            <span className="block text-[10px] text-slate-400 uppercase font-black">Total Qty</span>
                            <span>{plan.totalQuantity}</span>
                          </div>
                          <div className="text-center border-l pl-3">
                            <span className="block text-[10px] text-slate-400 uppercase font-black">Status</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                              isDispatched ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-amber-50 text-amber-700 border border-amber-100"
                            }`}>
                              {isDispatched ? "Approved" : "Pending"}
                            </span>
                          </div>
                        </div>

                        {/* Approve Dispatch Action */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isDispatched && !isApproving) handleApproveDispatch(plan);
                          }}
                          disabled={isDispatched || isApproving}
                          className={`flex items-center justify-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all no-print h-7 min-w-[76px] ${
                            isDispatched 
                              ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200" 
                              : isApproving
                                ? "bg-emerald-50 text-emerald-700 cursor-wait border border-emerald-250"
                                : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                          }`}
                        >
                          {isApproving ? (
                            <>
                              <Loader2 size={11} className="animate-spin text-emerald-700 shrink-0" />
                              <span>Approving</span>
                            </>
                          ) : isDispatched ? (
                            <span>Approved</span>
                          ) : (
                            <span>Approve</span>
                          )}
                        </button>

                        {/* Print Rider button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            printSingleRider(plan);
                          }}
                          className="p-1.5 bg-slate-50 text-slate-500 rounded-lg hover:bg-slate-100 hover:text-slate-800 border transition-all no-print"
                          title="Print Rider Sheet"
                        >
                          <Printer size={14} />
                        </button>

                        <div className="text-slate-400 no-print">
                          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </div>
                      </div>
                    </div>

                    {/* Expandable Content Panel */}
                    {isExpanded && (
                      <div className="p-5 border-t border-slate-100 bg-slate-50/20">
                        
                        {/* Split layout: left side tables, right side order list */}
                        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 items-start">
                          
                          {/* Left: Dispatch Requirements Table (60% width) */}
                          <div className="xl:col-span-3 space-y-3">
                            <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">
                              1. Dispatch Handover Requirements
                            </h4>
                            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                              <table className="w-full text-xs text-left">
                                <thead>
                                  <tr className="bg-slate-50 border-b text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                    <th className="px-4 py-2.5">Product</th>
                                    <th className="px-4 py-2.5">Variant</th>
                                    <th className="px-4 py-2.5 text-center">Qty to Issue</th>
                                    <th className="px-4 py-2.5 text-center">Orders</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {Object.values(plan.totals).map((t, idx) => (
                                    <tr key={idx} className="border-b last:border-0 hover:bg-slate-50/30 transition-colors">
                                      <td className="px-4 py-3 font-semibold text-slate-700">
                                        {t.product_name}
                                      </td>
                                      <td className="px-4 py-3 text-slate-600 font-semibold">
                                        {t.variant_name || t.product_name}
                                      </td>
                                      <td className="px-4 py-3 text-center font-black text-emerald-700 text-sm">
                                        × {t.quantity}
                                      </td>
                                      <td className="px-4 py-3 text-center font-bold text-slate-600">
                                        {t.orderCount || 1}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* Right: Order Breakdown list (40% width) */}
                          <div className="xl:col-span-2 space-y-3">
                            <div className="flex items-center justify-between pb-1 border-b">
                              <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">
                                2. Order Breakdown ({plan.orders.length} Orders)
                              </h4>
                              <button
                                onClick={() => toggleOrderBreakdown(plan.run_id)}
                                className="flex items-center gap-1 text-[10px] font-extrabold text-emerald-600 hover:text-emerald-700 no-print"
                              >
                                {showBreakdown ? (
                                  <>
                                    <EyeOff size={11} /> Hide Breakdown
                                  </>
                                ) : (
                                  <>
                                    <Eye size={11} /> View List
                                  </>
                                )}
                              </button>
                            </div>

                            {(showBreakdown || typeof window !== 'undefined' && window.matchMedia && window.matchMedia('print').matches) && (
                              <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1 animate-in fade-in slide-in-from-top-2 duration-300">
                                {plan.orders.map((order) => (
                                  <div key={order.order_id} className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col justify-between shadow-sm">
                                    <div>
                                      <div className="flex justify-between items-start gap-2">
                                        <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded-md font-mono font-bold text-[9px]">
                                          #{order.order_id}
                                        </span>
                                        <span className="text-[9px] text-slate-400 capitalize font-bold">{order.delivery_slot}</span>
                                      </div>
                                      <h5 className="font-black text-xs text-slate-700 mt-2">{order.customer_name}</h5>
                                      <p className="text-[9px] text-slate-400 truncate mt-0.5">{order.address_line}</p>
                                      
                                      <div className="border-t border-slate-100 mt-2 pt-2 space-y-1">
                                        {order.items.map((item, i) => (
                                          <div key={i} className="flex justify-between text-[10px] text-slate-650 font-bold items-start py-0.5 border-b border-slate-50 last:border-0">
                                            <span>{item.product_name}{item.variant_name && item.variant_name !== item.product_name ? ` (${item.variant_name})` : ''}</span>
                                            <span className="text-emerald-700 shrink-0 ml-2 font-black">× {item.quantity}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                        </div>

                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* Verification & Edit Modal */}
      {isApproveModalOpen && activePlanForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-black text-slate-800 text-lg">
                  Verify Dispatch Handover
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Rider: <strong className="text-slate-700">{activePlanForModal.delivery_partner_name}</strong> • Run: <strong className="text-slate-700">{activePlanForModal.run_id}</strong>
                </p>
              </div>
              <button
                onClick={() => {
                  setIsApproveModalOpen(false);
                  setActivePlanForModal(null);
                }}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-700">
              
              {/* Product and Variant List */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">
                  Dispatch items list
                </h4>
                
                {modalItems.length === 0 ? (
                  <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <p className="text-xs font-bold text-slate-400">No items in this dispatch plan. Please add items below.</p>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="bg-slate-50 border-b text-[10px] font-black text-slate-500 uppercase tracking-wider">
                          <th className="px-4 py-2.5">Product Name</th>
                          <th className="px-4 py-2.5">Variant</th>
                          <th className="px-4 py-2.5 text-center w-24">Original Qty</th>
                          <th className="px-4 py-2.5 text-center w-32">Issue Qty</th>
                          <th className="px-4 py-2.5 text-center w-16">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modalItems.map((item, idx) => (
                          <tr key={item.product_variant_id || idx} className="border-b last:border-0 hover:bg-slate-50/30 transition-colors">
                            <td className="px-4 py-3 font-semibold text-slate-800">
                              {item.product_name}
                            </td>
                            <td className="px-4 py-3 text-slate-600 font-semibold">
                              {item.variant_name || item.product_name}
                            </td>
                            <td className="px-4 py-3 text-center text-slate-500 font-bold">
                              {item.planned_qty || 0}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  value={item.loaded_qty}
                                  onChange={(e) => {
                                    const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                                    setModalItems(prev => prev.map(mi => 
                                      mi.product_variant_id === item.product_variant_id 
                                        ? { ...mi, loaded_qty: val }
                                        : mi
                                    ));
                                  }}
                                  className="w-20 px-2 py-1 border border-slate-200 rounded-lg text-center font-bold text-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-xs md:text-sm animate-none"
                                />
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => {
                                  setModalItems(prev => prev.filter(mi => mi.product_variant_id !== item.product_variant_id));
                                }}
                                className="p-1 hover:bg-red-50 text-red-500 rounded-md transition-colors"
                                title="Remove Item"
                              >
                                <Trash2 size={15} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Search and Add Variant */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/65 space-y-3">
                <h4 className="text-xs font-black uppercase text-slate-500 tracking-wider">
                  Add Other Product & Variant
                </h4>
                <div className="flex flex-col md:flex-row gap-3">
                  {/* Search input for available variants */}
                  <div className="relative flex-1">
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-3 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search product or variant..."
                        value={searchQueryVariant}
                        onChange={(e) => {
                          setSearchQueryVariant(e.target.value);
                          setIsSearchingVariantDropdownOpen(true);
                        }}
                        onFocus={() => setIsSearchingVariantDropdownOpen(true)}
                        onBlur={() => setTimeout(() => setIsSearchingVariantDropdownOpen(false), 200)}
                        className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-xl text-xs md:text-sm outline-none bg-white text-slate-750 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                      />
                      {searchQueryVariant && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQueryVariant("");
                            setSelectedVariantToAdd("");
                          }}
                          className="absolute right-3 top-3 text-slate-400 hover:text-slate-700"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    {/* Search results dropdown */}
                    {isSearchingVariantDropdownOpen && (
                      <div className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg">
                        {availableVariants
                          .filter(v => {
                            const label = `${v.product_name} ${v.variant_name} ${v.unit_value || ''} ${v.unit_type || ''}`;
                            return label.toLowerCase().includes(searchQueryVariant.toLowerCase());
                          })
                          .map((v) => {
                            const size = v.unit_value && v.unit_type ? ` (${v.unit_value} ${v.unit_type})` : '';
                            const vName = v.variant_name && v.variant_name !== v.product_name ? ` - ${v.variant_name}` : '';
                            const label = `${v.product_name}${vName}${size}`;
                            return (
                              <div
                                key={v.product_variant_id}
                                onMouseDown={() => {
                                  setSelectedVariantToAdd(v.product_variant_id);
                                  setSearchQueryVariant(label);
                                  setIsSearchingVariantDropdownOpen(false);
                                }}
                                className="px-4 py-2 text-xs md:text-sm text-slate-750 hover:bg-slate-50 cursor-pointer transition-colors"
                              >
                                {label}
                              </div>
                            );
                          })}
                        {availableVariants.filter(v => {
                          const label = `${v.product_name} ${v.variant_name} ${v.unit_value || ''} ${v.unit_type || ''}`;
                          return label.toLowerCase().includes(searchQueryVariant.toLowerCase());
                        }).length === 0 && (
                          <div className="px-4 py-2.5 text-xs text-slate-400 text-center">
                            No matching products or variants found
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Quantity to add */}
                  <div className="w-full md:w-28 shrink-0">
                    <input
                      type="number"
                      min="1"
                      value={qtyToAdd}
                      onChange={(e) => setQtyToAdd(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-full px-3 py-2 border border-slate-250 rounded-xl text-xs md:text-sm outline-none bg-white text-slate-750 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-bold"
                      placeholder="Qty"
                    />
                  </div>

                  {/* Add action */}
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedVariantToAdd) {
                        showErrorToast("Please select a product/variant from the search results first.");
                        return;
                      }
                      const variantObj = availableVariants.find(v => v.product_variant_id === selectedVariantToAdd);
                      if (!variantObj) return;

                      // Check if already in list
                      const exists = modalItems.find(mi => mi.product_variant_id === selectedVariantToAdd);
                      if (exists) {
                        setModalItems(prev => prev.map(mi => 
                          mi.product_variant_id === selectedVariantToAdd
                            ? { ...mi, loaded_qty: mi.loaded_qty + qtyToAdd }
                            : mi
                        ));
                      } else {
                        const size = variantObj.unit_value && variantObj.unit_type ? ` (${variantObj.unit_value} ${variantObj.unit_type})` : '';
                        const vName = variantObj.variant_name && variantObj.variant_name !== variantObj.product_name ? ` - ${variantObj.variant_name}` : '';
                        const sizeLabel = variantObj.unit_value && variantObj.unit_type ? `${variantObj.unit_value} ${variantObj.unit_type}` : (variantObj.variant_name || '');
                        
                        const newDispItem = {
                          product_variant_id: variantObj.product_variant_id,
                          product_name: variantObj.product_name,
                          variant_name: sizeLabel,
                          unit_value: variantObj.unit_value ? Number(variantObj.unit_value) : null,
                          unit_type: variantObj.unit_type || 'pcs',
                          planned_qty: 0,
                          loaded_qty: qtyToAdd,
                          displayLabel: `${variantObj.product_name}${vName}${size} × ${qtyToAdd}`,
                          orderCount: 0
                        };
                        setModalItems(prev => [...prev, newDispItem]);
                      }

                      // Reset fields
                      setSelectedVariantToAdd("");
                      setSearchQueryVariant("");
                      setQtyToAdd(1);
                      showSuccessToast("Added to list!");
                    }}
                    className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all shadow-sm flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <Plus size={14} /> Add Product
                  </button>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setIsApproveModalOpen(false);
                  setActivePlanForModal(null);
                }}
                className="px-4 py-2 border border-slate-200 text-slate-650 hover:bg-white rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmModalApproval}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 size={14} /> Confirm & Approve
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
