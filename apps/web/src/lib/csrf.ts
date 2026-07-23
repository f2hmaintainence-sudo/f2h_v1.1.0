// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : csrf.ts
// Description : CSRF token helper for web application
// Website     : https://www.chronosparksolutions.com/
// Copyright   : https://www.chronosparksolutions.com/copyright
// ============================================================================

"use client";

import { getApiBaseUrl } from './api-config';

let csrfToken: string | null = null;

const CSRF_COOKIE_NAME = 'csrf_token';

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;

  const cookie = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`));

  if (!cookie) return null;
  return decodeURIComponent(cookie.split('=')[1] || '');
}

async function fetchFreshCsrfToken(): Promise<string> {
  const apiBaseUrl = getApiBaseUrl();
  const res = await fetch(`${apiBaseUrl}/csrf/token`, {
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch CSRF token");
  }

  const data = (await res.json()) as { csrfToken: string };
  csrfToken = data.csrfToken;
  return csrfToken;
}

export async function getCsrfToken(): Promise<string> {
  const cookieToken = readCookie(CSRF_COOKIE_NAME);

  if (csrfToken && cookieToken && csrfToken === cookieToken) {
    return csrfToken;
  }

  return fetchFreshCsrfToken();
}

export function clearCsrfToken() {
  csrfToken = null;
}

