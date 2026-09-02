"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ChevronRight,
  Home,
  Loader2,
  RefreshCw,
  Save,
  Smartphone,
} from "lucide-react";
import { api } from "@/services/api.client";
import { showSuccessToast } from "@/components/Toast";

interface AppConfig {
  id: number;
  platform: string;
  latest_version: string;
  min_version: string;
  force_update: boolean;
  store_url: string;
  update_message: string | null;
  updated_at?: string;
}

const PLATFORM_LABEL: Record<string, string> = {
  android_customer: "Customer App (Android)",
  android_delivery: "Delivery Partner App (Android)",
  ios_customer: "Customer App (iOS)",
  ios_delivery: "Delivery Partner App (iOS)",
};

/** Mirrors APP_VERSION_PATTERN on the API so a bad value is caught before saving. */
const VERSION_RE = /^\d+\.\d+\.\d+(\+\d+)?$/;

/** Same ordering the API applies, so the warnings here match what it will accept. */
function compareVersions(a: string, b: string): number {
  const parse = (raw: string) => {
    const [name, build] = String(raw ?? "").trim().split("+");
    const parts = String(name ?? "").split(".").map((p) => parseInt(p, 10));
    return {
      parts: [0, 1, 2].map((i) => (Number.isFinite(parts[i]) ? parts[i] : 0)),
      build: Number.isFinite(parseInt(build, 10)) ? parseInt(build, 10) : 0,
    };
  };
  const l = parse(a);
  const r = parse(b);
  for (let i = 0; i < 3; i++) {
    if (l.parts[i] !== r.parts[i]) return l.parts[i] > r.parts[i] ? 1 : -1;
  }
  if (l.build !== r.build) return l.build > r.build ? 1 : -1;
  return 0;
}

export default function AppVersionControlPage() {
  const [configs, setConfigs] = useState<AppConfig[]>([]);
  const [drafts, setDrafts] = useState<Record<string, AppConfig>>({});
  const [loading, setLoading] = useState(true);
  const [savingPlatform, setSavingPlatform] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<any>("/admin/system/version-control");
      const raw = res?.data?.data ?? res?.data;
      const rows: AppConfig[] = Array.isArray(raw) ? raw : [];
      setConfigs(rows);
      setDrafts(Object.fromEntries(rows.map((r) => [r.platform, { ...r }])));
    } catch (e: any) {
      setError(e?.message ?? "Failed to load app version configuration");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = (platform: string, field: keyof AppConfig, value: unknown) => {
    setDrafts((prev) => ({
      ...prev,
      [platform]: { ...prev[platform], [field]: value } as AppConfig,
    }));
  };

  const validate = (draft: AppConfig): string | null => {
    if (!VERSION_RE.test(draft.latest_version.trim()))
      return "Latest version must look like 1.2.3 or 1.2.3+45";
    if (!VERSION_RE.test(draft.min_version.trim()))
      return "Minimum supported version must look like 1.2.3 or 1.2.3+45";
    if (compareVersions(draft.min_version, draft.latest_version) > 0)
      return "Minimum supported version cannot be newer than the latest version";
    if (!draft.store_url.trim().startsWith("https://"))
      return "Store URL must be an https:// link";
    return null;
  };

  const save = async (platform: string) => {
    const draft = drafts[platform];
    const problem = validate(draft);
    if (problem) {
      setError(problem);
      return;
    }
    setSavingPlatform(platform);
    setError(null);
    try {
      await api.patch<any>(`/admin/system/version-control/${platform}`, {
        latest_version: draft.latest_version.trim(),
        min_version: draft.min_version.trim(),
        force_update: draft.force_update,
        store_url: draft.store_url.trim(),
        update_message: draft.update_message ?? "",
      });
      showSuccessToast("App version configuration saved");
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed to save app version configuration");
    } finally {
      setSavingPlatform(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading app version configuration…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <nav className="mb-4 flex items-center gap-1 text-xs text-slate-500">
        <Link href="/admin" className="flex items-center gap-1 hover:text-slate-800">
          <Home className="h-3.5 w-3.5" /> Dashboard
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-semibold text-slate-800">App Version Control</span>
      </nav>

      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <Smartphone className="h-5 w-5 text-emerald-600" />
            App Version Control
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Controls the mandatory update gate. Customers running a build below the minimum
            supported version are blocked at launch until they update.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </header>

      {error && (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-5">
        {configs.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
            No app version configurations found.
          </div>
        ) : (
          configs.map((config) => {
            const draft = drafts[config.platform] ?? config;
            const isSaving = savingPlatform === config.platform;
            // The gate only blocks when force update is on AND a build can fall
            // below the minimum, so the warning has to reflect both together.
            const willBlock =
              draft.force_update && compareVersions(draft.min_version, "0.0.0+0") > 0;

            return (
              <section
                key={config.platform}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-900">
                    {PLATFORM_LABEL[config.platform] ?? config.platform}
                  </h2>
                  <code className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-500">
                    {config.platform}
                  </code>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Latest version
                    </span>
                    <input
                      value={draft.latest_version}
                      onChange={(e) => patch(config.platform, "latest_version", e.target.value)}
                      placeholder="1.0.8+21"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                    />
                    <span className="mt-1 block text-[11px] text-slate-400">
                      The newest build on the store. Older builds see an optional update prompt.
                    </span>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Minimum supported version
                    </span>
                    <input
                      value={draft.min_version}
                      onChange={(e) => patch(config.platform, "min_version", e.target.value)}
                      placeholder="1.0.8+21"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                    />
                    <span className="mt-1 block text-[11px] text-slate-400">
                      Anything below this is blocked when force update is on.
                    </span>
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Store URL
                    </span>
                    <input
                      value={draft.store_url}
                      onChange={(e) => patch(config.platform, "store_url", e.target.value)}
                      placeholder="https://play.google.com/store/apps/details?id=com.f2h.customer"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                    />
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Update message
                    </span>
                    <textarea
                      value={draft.update_message ?? ""}
                      onChange={(e) => patch(config.platform, "update_message", e.target.value)}
                      rows={3}
                      className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                    />
                  </label>
                </div>

                <div className="mt-4 flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3">
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={draft.force_update}
                      onChange={(e) => patch(config.platform, "force_update", e.target.checked)}
                      className="h-4 w-4 accent-emerald-600"
                    />
                    <span className="text-sm font-semibold text-slate-800">Force update</span>
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Last updated{" "}
                    {config.updated_at ? new Date(config.updated_at).toLocaleString("en-IN") : "—"}
                  </span>
                </div>

                {willBlock && (
                  <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      Force update is on. Every install below{" "}
                      <strong>{draft.min_version}</strong> will be locked out of the app until the
                      customer updates from the store. Make sure that build is actually live on the
                      store first.
                    </span>
                  </div>
                )}

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => void save(config.platform)}
                    className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save
                  </button>
                </div>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
