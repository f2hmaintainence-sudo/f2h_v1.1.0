// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : OrderDetailsDrawer.tsx
// Description : Offcanvas drawer fitting between admin header navbar and screen bottom
//
// ============================================================================

'use client';

import React, { useState } from 'react';
import {
  X,
  PackageOpen,
  User,
  Phone,
  MapPin,
  Clock,
  Package,
  CheckCircle2,
  AlertCircle,
  Truck,
  Bike,
  Repeat,
  ShoppingCart,
  Calendar,
  Camera,
  Eye,
  XCircle,
} from 'lucide-react';
import OrderActionModal, { ModalType, ModalData } from './OrderActionModal';
import { PaymentStatusBadge, getDeliveryImageUrl, ImagePreviewModal } from './OrdersTable';

export interface OrderItem {
  id: number | string;
  product_id?: string;
  product_name?: string;
  product_variant_id?: string;
  variant_id?: string;
  variant_name?: string;
  unit_price?: string | number;
  discount_amount?: string | number;
  coupon_amount?: string | number;
  total_price?: string | number;
  final_price?: string | number;
  is_free?: boolean;
  quantity?: string | number;
  default_m_quantity?: string | number;
  default_e_quantity?: string | number;
}

interface OrderDetailsDrawerProps {
  order: Record<string, any> | null;
  items: OrderItem[];
  loadingItems: boolean;
  itemsError: string;
  onClose: () => void;
  onUpdateStatus?: (orderId: string, newStatus: string) => void;
}

export function stripHtml(input: unknown): string {
  if (input === null || input === undefined) return '';
  const str = String(input);
  return str.replace(/<[^>]*>/g, '').trim();
}

function formatMoney(value: unknown) {
  const amount = Number(value ?? 0);
  return amount.toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  });
}

function toAmount(value: unknown): number {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function getItemSubtotal(item: OrderItem): number {
  const price = toAmount(item.final_price) || toAmount(item.total_price) || toAmount(item.unit_price);
  const qty = Number(item.quantity ?? ((Number(item.default_m_quantity) || 0) + (Number(item.default_e_quantity) || 0))) || 1;
  if (toAmount(item.final_price) > 0) return toAmount(item.final_price);
  if (toAmount(item.total_price) > 0) return toAmount(item.total_price);
  return price * qty;
}

function getItemDiscount(item: OrderItem): number {
  const promo = toAmount(item.discount_amount);
  const coupon = toAmount(item.coupon_amount);
  return promo + coupon;
}

function getItemTotal(item: OrderItem): number {
  const finalPrice = toAmount(item.final_price) || toAmount(item.total_price);
  if (finalPrice > 0 || item.is_free) return finalPrice;

  const subtotal = getItemSubtotal(item);
  const discount = getItemDiscount(item);
  return Math.max(0, subtotal - discount);
}

function getLightStatusBadge(statusRaw: unknown) {
  const status = stripHtml(statusRaw).toLowerCase().replace(/[\s_-]+/g, '_');

  if (status.includes('out_for_delivery') || status.includes('outfordelivery') || status.includes('dispatch')) {
    return { label: 'Out for Delivery', bg: 'bg-blue-50 text-blue-900 border-blue-200', icon: Truck };
  }
  if (status.includes('deliver')) {
    return { label: 'Delivered', bg: 'bg-emerald-50 text-emerald-900 border-emerald-200', icon: CheckCircle2 };
  }
  if (status.includes('pack')) {
    return { label: 'Packed', bg: 'bg-indigo-50 text-indigo-900 border-indigo-200', icon: Package };
  }
  if (status.includes('confirm')) {
    return { label: 'Confirmed', bg: 'bg-teal-50 text-teal-900 border-teal-200', icon: CheckCircle2 };
  }
  if (status.includes('assign')) {
    return { label: 'Assigned', bg: 'bg-indigo-50 text-indigo-900 border-indigo-200', icon: Bike };
  }
  if (status.includes('place')) {
    return { label: 'Placed', bg: 'bg-sky-50 text-sky-900 border-sky-200', icon: Clock };
  }
  if (status.includes('fail') || status.includes('undeliver')) {
    return { label: 'Failed', bg: 'bg-amber-50 text-amber-900 border-amber-200', icon: AlertCircle };
  }
  if (status.includes('cancel')) {
    return { label: 'Cancelled', bg: 'bg-rose-50 text-rose-900 border-rose-200', icon: AlertCircle };
  }
  return { label: 'Pending', bg: 'bg-amber-50 text-amber-900 border-amber-200', icon: Clock };
}

export default function OrderDetailsDrawer({
  order,
  items,
  loadingItems,
  itemsError,
  onClose,
  onUpdateStatus,
}: OrderDetailsDrawerProps) {
  const [actionModal, setActionModal] = useState<{
    isOpen: boolean;
    type: ModalType;
    data?: ModalData;
  }>({
    isOpen: false,
    type: null,
  });
  const [actionLoading, setActionLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; title?: string } | null>(null);

  if (!order) return null;

  const orderId = stripHtml(order.order_id || order.id || 'N/A');
  const rawSource = stripHtml(order.order_source || order.order_type || '');
  const isSubscription = Boolean(
    order.is_subscription ||
    rawSource.toLowerCase().includes('sub') ||
    order.subscription_id
  );

  const statusInfo = getLightStatusBadge(order.order_status || order.status);
  const StatusIcon = statusInfo.icon;
  const itemSubtotal = items.reduce((sum, item) => sum + getItemSubtotal(item), 0);
  const promotionDiscount = items.reduce((sum, item) => sum + toAmount(item.discount_amount), 0);
  const couponDiscount = items.reduce((sum, item) => sum + toAmount(item.coupon_amount), 0);
  const storedDiscount = toAmount(order.discount_amount);
  const otherDiscount = Math.max(0, storedDiscount - promotionDiscount - couponDiscount);
  const subtotal = (order.subtotal === null || order.subtotal === undefined || (toAmount(order.subtotal) === 0 && itemSubtotal > 0))
    ? itemSubtotal
    : toAmount(order.subtotal);
  const grandTotal = (order.total_amount === null || order.total_amount === undefined || (toAmount(order.total_amount) === 0 && itemSubtotal > 0))
    ? Math.max(0, subtotal - storedDiscount + toAmount(order.gst_amount))
    : toAmount(order.total_amount);

  const customerName = stripHtml(order.customer_name || order.customer_id || 'Guest Customer');
  const customerPhone = stripHtml(order.customer_phone || order.phone || order.contact_number || '');
  const addressStr = stripHtml(order.delivery_address || order.address_line || order.address || order.area || order.pincode || 'Address not specified');
  const deliverySlot = stripHtml(order.delivery_slot || order.slot || 'Standard Slot');

  const handleConfirmAction = async () => {
    if (!onUpdateStatus) return;
    setActionLoading(true);
    try {
      if (actionModal.type === 'single-fail') {
        await onUpdateStatus(orderId, 'failed');
      } else if (actionModal.type === 'single-deliver') {
        await onUpdateStatus(orderId, 'delivered');
      }
    } finally {
      setActionLoading(false);
      setActionModal({ isOpen: false, type: null });
    }
  };

  return (
    <div className="fixed top-16 right-0 bottom-0 left-0 z-40 bg-slate-900/30 backdrop-blur-2xs flex justify-end">
      {/* Drawer Container - Positioned top-16 to start below navbar header */}
      <div className="relative w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col justify-between overflow-hidden border-l border-gray-200 animate-in slide-in-from-right duration-300">
        
        {/* Light Drawer Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-emerald-50/90 via-teal-50/80 to-emerald-50/90 border-b border-emerald-100 text-slate-900 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${isSubscription ? 'bg-purple-100 text-purple-800 border-purple-200' : 'bg-emerald-100 text-emerald-800 border-emerald-200'}`}>
              {isSubscription ? <Repeat size={20} /> : <ShoppingCart size={20} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base md:text-lg font-extrabold text-slate-900 tracking-tight">Order #{orderId}</h2>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${statusInfo.bg}`}>
                  <StatusIcon size={12} />
                  {statusInfo.label}
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                {isSubscription ? 'Subscribed Order' : 'One-Time Checkout Order'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-slate-900 rounded-xl hover:bg-emerald-100/60 transition-colors border border-transparent hover:border-emerald-200"
            title="Close Drawer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">

          {/* Failure / Cancellation Reason Banner */}
          {statusInfo.label === 'Failed' && order.failed_reason && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 text-amber-900 shadow-2xs">
              <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900">Delivery Failure Reason</h4>
                <p className="text-xs font-medium text-amber-800 mt-1">{stripHtml(order.failed_reason)}</p>
              </div>
            </div>
          )}
          {statusInfo.label === 'Cancelled' && (order.cancel_reason || order.cancellation_reason) && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3 text-rose-900 shadow-2xs">
              <XCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-rose-900">Cancellation Reason</h4>
                <p className="text-xs font-medium text-rose-800 mt-1">{stripHtml(order.cancel_reason || order.cancellation_reason)}</p>
              </div>
            </div>
          )}

          {/* Customer & Delivery Information */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Customer Box */}
            <div className="bg-white p-4 rounded-2xl border border-gray-200/90 shadow-2xs space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <User size={13} className="text-emerald-700" /> Customer Information
              </span>
              <p className="text-sm font-extrabold text-slate-900">
                {customerName}
              </p>
              {customerPhone && (
                <p className="text-xs text-slate-600 flex items-center gap-1.5 font-medium">
                  <Phone size={12} className="text-slate-400" />
                  {customerPhone}
                </p>
              )}
            </div>

            {/* Delivery Partner Box */}
            <div className="bg-white p-4 rounded-2xl border border-gray-200/90 shadow-2xs space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Bike size={13} className="text-indigo-600" /> Delivery Partner
              </span>
              {order.delivery_partner_id || order.partner_name ? (
                <div>
                  <p className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                    {order.partner_name || order.delivery_partner_name || order.delivery_partner_id}
                  </p>
                  {(order.partner_phone || order.delivery_partner_phone) && (
                    <p className="text-xs text-slate-600 flex items-center gap-1.5 font-medium mt-1">
                      <Phone size={12} className="text-slate-400" />
                      <a href={`tel:${order.partner_phone || order.delivery_partner_phone}`} className="hover:text-indigo-600 underline">
                        {order.partner_phone || order.delivery_partner_phone}
                      </a>
                    </p>
                  )}
                  {(order.vehicle_type || order.vehicle_number) && (
                    <p className="text-[11px] text-slate-500 font-medium mt-1">
                      Vehicle: <span className="font-bold text-slate-700">{order.vehicle_type || ''} {order.vehicle_number ? `(${order.vehicle_number})` : ''}</span>
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-slate-500 py-1">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                    Unassigned
                  </span>
                  <span className="text-[11px] text-slate-400">No partner assigned yet</span>
                </div>
              )}
            </div>

            {/* Delivery Box */}
            <div className="bg-white p-4 rounded-2xl border border-gray-200/90 shadow-2xs space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <MapPin size={13} className="text-emerald-700" /> Delivery Details
              </span>
              <p className="text-xs text-slate-700 font-medium leading-relaxed">
                {addressStr}
              </p>
              <div className="pt-2 flex flex-wrap items-center gap-2 border-t border-slate-100 mt-1">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200">
                  <Clock size={11} />
                  {deliverySlot}
                </span>
                {order.scheduled_date && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-sky-50 text-sky-800 px-2 py-0.5 rounded border border-sky-200">
                    <Calendar size={11} />
                    Scheduled: {new Date(order.scheduled_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                )}
                {order.created_at && (
                  <span className="text-[11px] text-slate-500 font-medium ml-auto">
                    Placed: {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>

            {/* Delivery Proof Box */}
            <div className="bg-white p-4 rounded-2xl border border-gray-200/90 shadow-2xs space-y-2 flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Camera size={13} className="text-emerald-700" /> Delivery Proof
                  </span>
                  {order.delivery_image && (
                    <span className="text-[9px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                      PHOTO
                    </span>
                  )}
                </span>
                {order.delivery_image ? (
                  <div className="mt-2 space-y-2">
                    <div
                      onClick={() => {
                        const url = getDeliveryImageUrl(order.delivery_image);
                        if (url) setPreviewImage({ url, title: `Delivery Proof — #${orderId}` });
                      }}
                      className="group relative cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-slate-100 h-24 flex items-center justify-center shadow-xs"
                      title="Click to view full photo"
                    >
                      <img
                        src={getDeliveryImageUrl(order.delivery_image)!}
                        alt="Delivery Proof"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[11px] font-bold gap-1">
                        <Eye size={13} /> View Photo
                      </div>
                    </div>
                    <p className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                      <CheckCircle2 size={11} /> Proof Uploaded
                    </p>
                  </div>
                ) : (
                  <div className="mt-2 py-5 flex flex-col items-center justify-center text-center text-slate-400 bg-slate-50/70 rounded-xl border border-dashed border-slate-200">
                    <Camera size={18} className="text-slate-300 mb-1 opacity-60" />
                    <span className="text-[10px] font-medium text-slate-400">No Photo Uploaded</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Order Items Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <PackageOpen size={16} className="text-emerald-600" /> Items Breakdown
              </h3>
              <span className="text-xs text-slate-500 font-semibold">{items.length} item(s) total</span>
            </div>

            {loadingItems ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500 space-y-2">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-600" />
                <span className="text-xs font-semibold">Fetching order items...</span>
              </div>
            ) : itemsError ? (
              <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-xs font-medium text-rose-700">
                {itemsError}
              </div>
            ) : items.length === 0 ? (
              <div className="p-8 rounded-2xl border border-dashed border-slate-200 text-center text-xs font-semibold text-slate-400 bg-white">
                No individual item rows found for this order.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/90 text-slate-700 uppercase text-[10px] font-bold border-b border-gray-200">
                    <tr>
                      <th className="px-3.5 py-2.5">Item / Variant</th>
                      <th className="px-3.5 py-2.5 text-center">Qty</th>
                      <th className="px-3.5 py-2.5 text-right">Price</th>
                      <th className="px-3.5 py-2.5 text-right">Discount</th>
                      <th className="px-3.5 py-2.5 text-right">Final Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white text-slate-800 font-medium">
                    {items.map((item) => {
                      const prodName = stripHtml(item.product_name || item.variant_name || 'Produce Item');
                      const varName = stripHtml(item.variant_name || '');
                      const showVar = varName && prodName && varName.toLowerCase() !== prodName.toLowerCase();
                      const numQty = Number(item.quantity);
                      const displayQty = !isNaN(numQty) && numQty > 0
                        ? numQty
                        : (item.quantity ?? `${item.default_m_quantity ?? 0}/${item.default_e_quantity ?? 0}`);

                      return (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-3.5 py-2.5 font-semibold text-slate-900">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-900 flex items-center gap-1.5">
                                {prodName}
                                {item.is_free && (
                                  <span className="bg-amber-100 text-amber-900 text-[10px] font-bold px-1.5 py-0.5 rounded border border-amber-300">
                                    FREE
                                  </span>
                                )}
                              </span>
                              {showVar && (
                                <span className="text-[11px] text-slate-500 font-medium">
                                  {varName}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3.5 py-2.5 text-center font-bold text-slate-900">
                            {displayQty}
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-medium text-slate-600">
                            {formatMoney(item.unit_price)}
                          </td>
                        <td className="px-3.5 py-2.5 text-right font-medium text-rose-600">
                          {getItemDiscount(item) > 0 ? (
                            <span className="inline-flex flex-col items-end">
                              <span>-{formatMoney(getItemDiscount(item))}</span>
                              {toAmount(item.coupon_amount) > 0 && (
                                <span className="text-[9px] text-slate-400">
                                  Promo {formatMoney(item.discount_amount)} + Coupon {formatMoney(item.coupon_amount)}
                                </span>
                              )}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-bold text-emerald-700">
                          {formatMoney(getItemTotal(item))}
                        </td>
                      </tr>
                    );
                  })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pricing & Billing Summary */}
          <div className="bg-emerald-50/80 border border-emerald-200 p-4 rounded-2xl space-y-2 shadow-2xs">
            <div className="flex justify-between text-xs text-slate-600 font-semibold">
              <span>Items Subtotal:</span>
              <span className="font-bold text-slate-900">{formatMoney(subtotal)}</span>
            </div>
            {promotionDiscount > 0 && (
              <div className="flex justify-between text-xs font-semibold text-rose-700">
                <span>Promotion Discount:</span>
                <span>-{formatMoney(promotionDiscount)}</span>
              </div>
            )}
            {couponDiscount > 0 && (
              <div className="flex justify-between text-xs font-semibold text-rose-700">
                <span>Coupon Discount:</span>
                <span>-{formatMoney(couponDiscount)}</span>
              </div>
            )}
            {otherDiscount > 0 && (
              <div className="flex justify-between text-xs font-semibold text-rose-700">
                <span>Other Discount:</span>
                <span>-{formatMoney(otherDiscount)}</span>
              </div>
            )}
            {toAmount(order.gst_amount) > 0 && (
              <div className="flex justify-between text-xs font-semibold text-slate-600">
                <span>GST:</span>
                <span>+{formatMoney(order.gst_amount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-extrabold border-t border-emerald-200/90 pt-2 text-emerald-900">
              <span>Grand Total:</span>
              <span className="text-base text-emerald-700">{formatMoney(grandTotal)}</span>
            </div>
            <div className="flex justify-between items-center text-xs font-semibold pt-2 border-t border-emerald-200/50">
              <span className="text-slate-600">Payment Status:</span>
              <PaymentStatusBadge
                paymentStatus={order.payment_status}
                paymentMode={order.payment_mode}
              />
            </div>
          </div>

        </div>

        {/* Light Drawer Footer */}
        <div className="px-6 py-3.5 bg-white border-t border-gray-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            {onUpdateStatus && statusInfo.label !== 'Failed' && statusInfo.label !== 'Cancelled' && statusInfo.label !== 'Delivered' && (
              <button
                type="button"
                onClick={() => {
                  const isPrepaid = (String(order.payment_status || '').toLowerCase() === 'paid' || ['wallet', 'prepaid', 'razorpay', 'online'].includes(String(order.payment_mode || '').toLowerCase())) && Number(order.total_amount || 0) > 0;
                  setActionModal({
                    isOpen: true,
                    type: 'single-fail',
                    data: {
                      orderId,
                      customerName,
                      isSubscription,
                      isPrepaid,
                      totalAmount: Number(order.total_amount || 0),
                    },
                  });
                }}
                className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold rounded-xl shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <AlertCircle size={14} className="text-amber-700" />
                <span>Mark as Failed</span>
              </button>
            )}

            {onUpdateStatus && statusInfo.label !== 'Delivered' && statusInfo.label !== 'Cancelled' && statusInfo.label !== 'Failed' && (
              <button
                type="button"
                onClick={() => {
                  setActionModal({
                    isOpen: true,
                    type: 'single-deliver',
                    data: {
                      orderId,
                      customerName,
                    },
                  });
                }}
                className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-bold rounded-xl shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 size={14} className="text-emerald-700" />
                <span>Mark as Delivered</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow-2xs transition-colors cursor-pointer"
          >
            Close Details
          </button>
        </div>

      </div>

      {/* Action Confirmation Modal */}
      <OrderActionModal
        isOpen={actionModal.isOpen}
        type={actionModal.type}
        data={actionModal.data}
        loading={actionLoading}
        onClose={() => setActionModal({ isOpen: false, type: null })}
        onConfirm={handleConfirmAction}
      />

      <ImagePreviewModal
        isOpen={Boolean(previewImage)}
        imageUrl={previewImage?.url || null}
        title={previewImage?.title}
        onClose={() => setPreviewImage(null)}
      />
    </div>
  );
}
