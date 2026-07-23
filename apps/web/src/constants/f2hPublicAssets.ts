/**
 * F2H static assets served from `frontend/public/assets/`.
 * Root cause of broken images was the typo `assests` — correct path is `/assets/...`.
 */
export const F2H_PUBLIC = {
  heroBg: "/assets/bghero.webp",
  problemBg: "/assets/problem.webp",
  logo: "/assets/log1.webp",
} as const;
