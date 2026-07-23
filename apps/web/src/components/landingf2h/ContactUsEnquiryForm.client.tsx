"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, ChevronLeft, Check, MapPin } from "lucide-react";

function normalizeIndianPhone(input: string): string {
  const digits = String(input ?? "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

const IN_MOBILE_RE = /^[6-9]\d{9}$/;

function perUnitLabel(name: string, price: number, unitType?: string): string {
  const m = name.match(/(\d+\.?\d*)\s*-?\s*(g|gm|gms|gram|grams|kg|kgs|ml|ltr|ltrs|litre|litres|liter|liters|l)\b/i);
  if (!m) return `\u20b9${price}/${unitType || 'unit'}`;
  const qty = m[1];
  const unit = m[2];
  if (!parseFloat(qty) || parseFloat(qty) <= 0) return `\u20b9${price}/${unitType || 'unit'}`;
  return `\u20b9${price}/${qty}${unit}`;
}

function buildApiUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_API_URL || "").trim().replace(/\/$/, "");
  return base ? base + path : path;
}

export function ContactUsEnquiryForm({ onSuccess }: { onSuccess?: () => void }) {
  const [products, setProducts] = useState<Array<{ product_id: string; name: string; price_per_unit: number; unit_type: string }>>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState(1);
  const totalSteps = 3;

  const [form, setForm] = useState({
    full_name: "", phone: "", product_id: "", product_name: "", quantity: "", unit_type: "", 
    map_url: "", address: "", address_line1: "", city: "", state: "", pincode: "", notes: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [locationFetching, setLocationFetching] = useState(false);
  const [locationLabel, setLocationLabel] = useState("");

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoadingProducts(true);
      try {
        const res = await fetch(buildApiUrl("/api/f2h/contact-enquiry/products"));
        const json = await res.json();
        if (!cancelled) {
          const fetchedProducts = Array.isArray(json?.data) ? json.data : [];
          setProducts(fetchedProducts);
          setForm((prev) => {
            if (!prev.product_id) {
              const milkProduct = fetchedProducts.find((p: any) => p.name.toLowerCase().includes("milk"));
              if (milkProduct) {
                return { ...prev, product_id: milkProduct.product_id, product_name: milkProduct.name, unit_type: milkProduct.unit_type ?? "", quantity: "" };
              }
            }
            return prev;
          });
        }
      } catch {
        if (!cancelled) setProducts([]);
      } finally {
        if (!cancelled) setLoadingProducts(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const onChange = (key: keyof typeof form, value: string) => {
    setForm((p) => ({ ...p, [key]: value }));
    setError(""); // clear error when typing
  };

  const fetchLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }
    setLocationFetching(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const mapUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
        setForm((p) => ({ ...p, map_url: mapUrl }));
        setLocationLabel(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        setLocationFetching(false);
      },
      (err) => {
        setError(err.code === 1 ? "Location access denied. Please allow it." : "Unable to fetch location.");
        setLocationFetching(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const validateStep = () => {
    if (step === 1) {
      if (!form.product_id.trim()) return "Please select a product.";
      if (!form.quantity || parseFloat(form.quantity) <= 0) return "Please select a daily quantity.";
    }
    if (step === 2) {
      if (!form.full_name.trim()) return "Full name is required.";
      const phone = normalizeIndianPhone(form.phone);
      if (!phone) return "Phone number is required.";
      if (!IN_MOBILE_RE.test(phone)) return "Enter a valid 10-digit mobile number.";
      if (!form.map_url) return "Please tap 'Share Location' so we can deliver accurately.";
    }
    if (step === 3) {
      if (!form.address.trim()) return "Door No / Flat No is required.";
      if (!form.address_line1.trim()) return "Street / Area is required.";
      if (!form.city.trim()) return "City is required.";
      if (!form.state.trim()) return "State is required.";
      if (!form.pincode.trim() || !/^[1-9][0-9]{5}$/.test(form.pincode)) return "Enter a valid 6-digit pincode.";
    }
    return "";
  };

  const handleNext = () => {
    const msg = validateStep();
    if (msg) { setError(msg); return; }
    setError("");
    setStep((s) => Math.min(s + 1, totalSteps));
  };

  const handleBack = () => {
    setError("");
    setStep((s) => Math.max(s - 1, 1));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement> | React.MouseEvent) => {
    e.preventDefault();
    const msg = validateStep();
    if (msg) { setError(msg); return; }

    setSubmitting(true);
    setError("");

    try {
      const { full_name, phone, product_id, product_name, quantity, unit_type, map_url, address, address_line1, city, state, pincode, notes } = form;
      const res = await fetch(buildApiUrl("/api/f2h/contact-enquiry"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          full_name, phone, product_id, product_name, quantity: parseFloat(quantity) || 0, unit_type, map_url, address, address_line1, city, state, pincode, notes,
        }),
      });

      if (!res.ok) {
        let body: any = null;
        try { body = await res.json(); } catch {}
        throw new Error(body?.message || body?.error || "Error submitting form.");
      }
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setSubmitted(false);
    setError("");
    setSubmitting(false);
    setLocationLabel("");
    setStep(1);
    setForm({ full_name: "", phone: "", product_id: "", product_name: "", quantity: "", unit_type: "", map_url: "", address: "", address_line1: "", city: "", state: "", pincode: "", notes: "" });
  };

  const quickOptions = useMemo(() => {
    const ut = (form.unit_type || "").trim().toLowerCase();
    if (ut.includes("litre") || ut === "l" || ut.includes("liter") || ut.includes("ltr")) return { unitLabel: "L", values: ["0.5", "1", "1.5", "2"] };
    if (ut === "kg" || ut.includes("kilogram")) return { unitLabel: "kg", values: ["0.25", "0.5", "1", "2"] };
    if (ut === "g" || ut.includes("gram")) return { unitLabel: "g", values: ["250", "500", "750", "1000"] };
    return { unitLabel: "unit", values: ["1", "2", "3", "4"] };
  }, [form.unit_type]);

  const selectedProduct = products.find((p) => p.product_id === form.product_id);
  const inputClass = "w-full rounded-xl border border-deep-green/15 bg-white px-4 py-3 text-[14px] text-deep-green placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-fresh-green/30 transition-all";

  // Step Map
  const stepTitles = ["Product & Quantity", "Contact & Location", "Delivery Address"];

  return (
    <div className="rounded-3xl p-6 sm:p-8 shrink-0 w-full bg-white/70 shadow-[0_8px_30px_rgb(0,0,0,0.06)] backdrop-blur-xl border border-white/60 relative overflow-hidden">
      
      {/* ProgressBar Background */}
      <div className="absolute top-0 left-0 w-full h-1 bg-white" />
      <div 
        className="absolute top-0 left-0 h-1 bg-gradient-to-r from-fresh-green to-[#2d8a45] transition-all duration-500 ease-in-out" 
        style={{ width: submitted ? '100%' : `${((step - 1) / (totalSteps - 1)) * 100}%` }} 
      />

      {submitted ? (
        <div className="flex flex-col items-center text-center py-6">
          <div className="w-16 h-16 bg-fresh-green/10 rounded-full flex items-center justify-center mb-4 text-fresh-green border border-fresh-green/20">
            <Check size={32} strokeWidth={2.5} />
          </div>
          <h4 className="text-2xl font-bold text-deep-green mb-2">Enquiry Submitted!</h4>
          <p className="text-[14px] text-[#3a5c42] mb-6">
            We'll call you within 24 hours to confirm your location and start your trial.
          </p>
          <button type="button" onClick={() => { if (onSuccess) onSuccess(); else reset(); }}
            className="rounded-full bg-white border border-gray-200 px-6 py-2.5 text-sm font-bold text-deep-green hover:bg-gray-50 transition-colors shadow-sm">
            {onSuccess ? "Close & Return" : "Submit Another"}
          </button>
        </div>
      ) : (
        <form onSubmit={(e) => step === totalSteps ? handleSubmit(e) : e.preventDefault()} className="flex flex-col h-full">

          {/* Stepper Header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-2xl font-black text-deep-green tracking-tight">Quick Subscribe</h3>
              <p className="text-[13px] text-gray-500 mt-1 font-medium">Step {step} of {totalSteps}: {stepTitles[step-1]}</p>
            </div>
            
            {/* Dots */}
            <div className="hidden sm:flex gap-1.5">
              {[1, 2, 3].map((s) => (
                <div key={s} className={`w-2 h-2 rounded-full transition-colors duration-300 ${step === s ? "bg-fresh-green scale-125" : step > s ? "bg-fresh-green/40" : "bg-gray-200"}`} />
              ))}
            </div>
          </div>

          <div className="flex-1 min-h-[220px]">
          
            {/* Step 1: Product + Quantity */}
            {step === 1 && (
              <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-right-4 duration-300 max-h-[350px] overflow-y-auto pr-1 pb-1 custom-scrollbar">
                
                {/* Scrollbar config */}
                <style>{`
                  .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                  .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                  .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
                `}</style>

                {/* Sub-section: Product */}
                <div className="flex flex-col gap-3">
                  <label className="text-[12px] font-bold text-deep-green/70 uppercase tracking-wider block -mb-1">
                    Select your product
                  </label>
                  <div ref={dropdownRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setDropdownOpen((o) => !o)}
                      disabled={loadingProducts}
                      className={`w-full flex items-center justify-between rounded-xl border px-4 py-4 text-[14px] text-left transition-colors bg-white hover:border-fresh-green/40 shadow-sm ${
                        selectedProduct ? "border-fresh-green/50 ring-4 ring-fresh-green/10 text-deep-green font-semibold" : "border-gray-200 text-gray-500"
                      }`}
                    >
                      {loadingProducts ? (
                        <span className="flex items-center gap-2">
                          <span className="w-4 h-4 border-2 border-gray-300 border-t-deep-green rounded-full animate-spin" />
                          Loading products…
                        </span>
                      ) : selectedProduct ? (
                        <span className="flex items-center gap-3">
                          <span className="text-xl leading-none">🥛</span>
                          <span>
                            {selectedProduct.name}
                            <span className="block text-[12px] font-normal text-gray-400 mt-0.5">
                              {perUnitLabel(selectedProduct.name, selectedProduct.price_per_unit, selectedProduct.unit_type)}
                            </span>
                          </span>
                        </span>
                      ) : (
                        "Click to choose a product"
                      )}
                      <ChevronRight size={20} className={`text-gray-400 transition-transform ${dropdownOpen ? "rotate-90" : ""}`} />
                    </button>
                    {dropdownOpen && products.length > 0 && (
                      <div className="absolute z-30 mt-2 w-full rounded-2xl border border-gray-100 bg-white shadow-xl max-h-56 overflow-y-auto p-1.5 focus:outline-none">
                        {products.map((p) => (
                          <button
                            key={p.product_id}
                            type="button"
                            onClick={() => {
                              setForm((prev) => ({ ...prev, product_id: p.product_id, product_name: p.name, unit_type: p.unit_type ?? "", quantity: "" }));
                              setDropdownOpen(false);
                              setError("");
                            }}
                            className={`w-full text-left rounded-xl px-4 py-3 flex items-center justify-between transition-colors ${
                              form.product_id === p.product_id ? "bg-fresh-green/10 text-deep-green font-bold" : "hover:bg-gray-50 text-gray-700"
                            }`}
                          >
                            <span className="truncate pr-3">{p.name}</span>
                            <span className="text-[11px] bg-gray-100 px-2 py-1 rounded-md text-gray-500 whitespace-nowrap">
                              {perUnitLabel(p.name, p.price_per_unit, p.unit_type)}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t border-gray-100" />

                {/* Sub-section: Quantity */}
                <div className="flex flex-col gap-3">
                  <label className="text-[12px] font-bold text-deep-green/70 uppercase tracking-wider block -mb-1">
                    How much per day?
                  </label>
                  
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.quantity}
                      onChange={(e) => { onChange("quantity", e.target.value); setError(""); }}
                      placeholder={`e.g. 1.5`}
                      className="w-full rounded-2xl border border-deep-green/20 bg-white px-5 py-4 text-[18px] font-bold text-deep-green placeholder:text-gray-300 placeholder:font-normal focus:outline-none focus:ring-4 focus:ring-fresh-green/10 focus:border-fresh-green transition-all shadow-sm"
                    />
                    <div className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 font-bold select-none text-sm">
                       {quickOptions.unitLabel}
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] text-gray-400 mb-2.5 font-bold tracking-wide uppercase">Or Quick Select:</p>
                    <div className="flex flex-wrap gap-2.5">
                      {quickOptions.values.map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => { onChange("quantity", v); setError(""); }}
                          className={`px-4 py-2 rounded-xl text-[14px] font-bold border-2 transition-all ${
                            form.quantity === v
                              ? "bg-fresh-green/10 border-fresh-green text-deep-green shadow-sm ring-2 ring-fresh-green/10"
                              : "bg-white border-gray-100 text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                          }`}
                        >
                          {v} {quickOptions.unitLabel}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Contact Details & Location */}
            {step === 2 && (
              <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-right-4 duration-300 max-h-[350px] overflow-y-auto pr-1 pb-1 custom-scrollbar">
                
                {/* Scrollbar styles local to this step to keep it clean */}
                <style>{`
                  .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                  .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                  .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
                `}</style>
                
                <div className="flex flex-col gap-3">
                  <label className="text-[12px] font-bold text-deep-green/70 uppercase tracking-wider block -mb-1">
                    Contact Information
                  </label>
                  
                  <div className="flex flex-col gap-3">
                    <div>
                      <input
                        type="text"
                        autoFocus
                        value={form.full_name}
                        onChange={(e) => onChange("full_name", e.target.value)}
                        placeholder="Your Full Name"
                        className={inputClass}
                      />
                    </div>
                    <div className="flex items-center rounded-xl border border-deep-green/15 bg-white focus-within:ring-2 focus-within:ring-fresh-green/30 overflow-hidden shadow-sm">
                      <div className="pl-4 pr-3 py-3 border-r border-gray-100 bg-gray-50/50">
                        <span className="text-[14px] font-semibold text-gray-500 select-none">🇮🇳 +91</span>
                      </div>
                      <input
                        type="tel"
                        value={form.phone}
                        inputMode="numeric"
                        maxLength={10}
                        onChange={(e) => onChange("phone", normalizeIndianPhone(e.target.value).slice(0, 10))}
                        placeholder="Mobile Number"
                        className="flex-1 px-4 py-3 text-[14px] font-semibold text-deep-green placeholder:text-gray-400 placeholder:font-normal focus:outline-none bg-transparent w-full"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-100" />

                <div className="bg-gradient-to-br from-fresh-green/10 to-transparent border border-fresh-green/20 rounded-2xl p-4">
                   <div className="flex items-start gap-3 mb-3">
                     <div className="bg-white p-2 rounded-full shadow-sm text-fresh-green shrink-0">
                       <MapPin size={18} strokeWidth={2.5} />
                     </div>
                     <div>
                       <p className="text-[13px] font-bold text-deep-green">Pin Your Live Location</p>
                       <p className="text-[11.5px] text-gray-500 mt-0.5 leading-snug">Required for accurate early-morning door delivery.</p>
                     </div>
                   </div>
                   
                   <button
                    type="button"
                    onClick={fetchLocation}
                    disabled={locationFetching}
                    className={`w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-[14px] font-bold transition-all shadow-sm ${
                      form.map_url
                        ? "bg-fresh-green text-white border-transparent"
                        : "bg-white border-2 border-fresh-green/30 text-deep-green hover:border-fresh-green"
                    }`}
                  >
                    {locationFetching ? (
                      <><span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> Fetching GPS…</>
                    ) : form.map_url ? (
                      <>✓ Location Captured</>
                    ) : (
                      <>Share Location</>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Address */}
            {step === 3 && (
              <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 duration-300 max-h-[350px] overflow-y-auto pr-1 pb-1 custom-scrollbar">
                
                {/* Scrollbar styles */}
                <style>{`
                  .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                  .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                  .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
                `}</style>
                
                <div className="flex flex-col gap-3">
                  <label className="text-[12px] font-bold text-deep-green/70 uppercase tracking-wider block -mb-1">
                    Delivery Address
                  </label>
                  <div className="flex flex-col gap-2.5">
                    <input type="text" value={form.address} onChange={(e) => onChange("address", e.target.value)} placeholder="Door No / Flat No / Building" className={inputClass} />
                    <input type="text" value={form.address_line1} onChange={(e) => onChange("address_line1", e.target.value)} placeholder="Street / Area / Landmark" className={inputClass} />
                    <input type="text" value={form.notes} onChange={(e) => onChange("notes", e.target.value)} placeholder="Address Line 2 (Optional)" className={inputClass} />
                    
                    <div className="grid grid-cols-2 gap-2.5">
                      <input type="text" value={form.city} onChange={(e) => onChange("city", e.target.value)} placeholder="City" className={inputClass} />
                      <input type="text" value={form.state} onChange={(e) => onChange("state", e.target.value)} placeholder="State" className={inputClass} />
                    </div>
                    <input type="text" value={form.pincode} onChange={(e) => onChange("pincode", e.target.value.replace(/\D/g, ""))} placeholder="Pincode" inputMode="numeric" maxLength={6} className={inputClass} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Stepper Footer Controls */}
          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
            {error ? (
              <div className="flex-1 text-red-500 text-[12px] font-medium leading-tight mr-2 animate-in slide-in-from-bottom-1">
                {error}
              </div>
            ) : (
              <div className="flex-1" />
            )}

            <div className="flex items-center gap-2 shrink-0">
              {step > 1 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="w-12 h-12 flex flex-col items-center justify-center rounded-full bg-gray-50 text-gray-500 hover:bg-gray-100 transition-colors border border-gray-200"
                >
                  <ChevronLeft size={20} />
                </button>
              )}

              {step < totalSteps ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex items-center gap-2 rounded-full bg-deep-green px-6 py-3 text-[14px] font-bold text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                >
                  Next Step <ChevronRight size={18} />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 rounded-full bg-gradient-to-r from-fresh-green to-deep-green px-7 py-3 text-[14px] font-bold text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:hover:translate-y-0"
                >
                  {submitting ? "Submitting..." : "Subscribe Now"} 
                </button>
              )}
            </div>
          </div>

        </form>
      )}
    </div>
  );
}
