// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : api-config.ts
// Description : Central API URL configuration helper
// Website     : https://www.chronosparksolutions.com/
// Copyright   : https://www.chronosparksolutions.com/copyright
// ============================================================================

export function getApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.trim().length > 0) {
    const raw = process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
    return raw.endsWith('/api/v1') ? raw : `${raw}/api/v1`;
  }
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:5001/api/v1`;
  }
  return 'http://localhost:5001/api/v1';
}
