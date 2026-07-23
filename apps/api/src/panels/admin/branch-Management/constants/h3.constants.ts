/**
 * H3 Constants — single source of truth for H3 resolution
 * and sector rendering colors across the entire application.
 */

/** H3 resolution used for all hex operations. Resolution 9 ≈ 174m per hex. */
export const H3_RESOLUTION = 9;

/** Average hex edge length in km per resolution level */
export const H3_AVG_HEX_RADIUS_KM: Record<number, number> = {
  7: 1.221,
  8: 0.461,
  9: 0.174,
  10: 0.066,
};

/** Color palette for sector rendering on maps (up to 20 sectors) */
export const SECTOR_COLORS = [
  '#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16',
  '#6366f1', '#d946ef', '#0ea5e9', '#facc15', '#e11d48',
  '#10b981', '#7c3aed', '#f43f5e', '#0891b2', '#a3e635',
];
