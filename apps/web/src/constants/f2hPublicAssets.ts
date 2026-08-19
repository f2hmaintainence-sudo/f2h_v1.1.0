/**
 * F2H static assets served from `frontend/public/assets/`.
 * Root cause of broken images was the typo `assests` — correct path is `/assets/...`.
 */
export const F2H_PUBLIC = {
  heroBg: "/assets/bghero.webp",
  problemBg: "/assets/problem.webp",
  logo: "/assets/log1.webp",
} as const;

export const F2H_CUSTOMER_PLAYSTORE_URL = "https://play.google.com/store/apps/details?id=com.f2h.customer";

