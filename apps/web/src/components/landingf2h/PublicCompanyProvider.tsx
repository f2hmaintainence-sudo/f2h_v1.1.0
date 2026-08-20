"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  DEFAULT_PUBLIC_COMPANY,
  fetchPublicCompany,
  type PublicCompanyProfile,
} from "@/services/public-company.service";

const PublicCompanyContext = createContext<PublicCompanyProfile | null>(null);

export function PublicCompanyProvider({ children }: { children: ReactNode }) {
  const [company, setCompany] = useState(DEFAULT_PUBLIC_COMPANY);

  useEffect(() => {
    const controller = new AbortController();

    void fetchPublicCompany(controller.signal)
      .then(setCompany)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.warn("Public company details are unavailable; using defaults.");
      });

    return () => controller.abort();
  }, []);

  return <PublicCompanyContext value={company}>{children}</PublicCompanyContext>;
}

export function usePublicCompany(): PublicCompanyProfile {
  const company = useContext(PublicCompanyContext);
  if (!company) {
    throw new Error("usePublicCompany must be used within PublicCompanyProvider");
  }
  return company;
}
