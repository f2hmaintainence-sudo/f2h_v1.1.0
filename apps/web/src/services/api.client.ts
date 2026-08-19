// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : api.client.ts
// Description : API Client for web application
//
// ============================================================================

/**
 * Universal API Client with Middleware Pattern
 * 
 * SECURITY FEATURES:
 * - No localStorage for tokens (uses httpOnly cookies via credentials: 'include')
 * - Automatic CSRF token handling
 * - Request/response interceptors
 * - Automatic 401 redirect to login
 * - Rate limit (429) handling with retry
 */

import { getCsrfToken, clearCsrfToken } from '../lib/csrf';

// Types
export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  status?: number;
}

export interface RequestConfig extends Omit<RequestInit, 'body'> {
  skipCsrf?: boolean;
  skipAuth?: boolean;
  retryOn429?: boolean;
  maxRetries?: number;
  body?: unknown;
  /**
   * Query parameters appended to the URL. Several pages already passed this and it
   * was silently dropped — the requests went out with no filters at all.
   * `undefined`, `null`, and empty-string values are omitted.
   */
  params?: Record<string, string | number | boolean | undefined | null>;
}

type RequestInterceptor = (config: RequestConfig & { url: string }) => Promise<RequestConfig & { url: string }>;
type ResponseInterceptor = (response: Response, config: RequestConfig & { url: string }) => Promise<Response>;
type ErrorInterceptor = (error: Error, config: RequestConfig & { url: string }) => Promise<never>;

/** Appends query parameters, skipping values that carry no information. */
function buildUrl(
  url: string,
  params?: Record<string, string | number | boolean | undefined | null>,
): string {
  if (!params) return url;

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.append(key, String(value));
  }

  const query = search.toString();
  if (!query) return url;
  return url.includes('?') ? `${url}&${query}` : `${url}?${query}`;
}

class ApiClient {
  private baseURL: string;
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];
  private errorInterceptors: ErrorInterceptor[] = [];

  private getBaseUrl(): string {
    // If we're on the server (SSR/RSC), use the internal Docker network name
    if (typeof window === 'undefined') {
      return process.env.INTERNAL_API_URL || 'http://api:5001/api/v1';
    }

    // If we're on the client (Browser), use the public URL
    if (process.env.NEXT_PUBLIC_API_URL) {
      const raw = process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
      return raw.endsWith('/api/v1') ? raw : `${raw}/api/v1`;
    }

    return `${window.location.origin}/api/v1`;
  }

  constructor() {
    this.baseURL = this.getBaseUrl();
    console.log('[ApiClient] Initialized with baseURL:', this.baseURL);

    // Register default interceptors
    this.registerDefaultInterceptors();
  }

  /**
   * Register default middleware interceptors
   */
  private registerDefaultInterceptors(): void {
    // Request interceptor: Add CSRF token to mutating requests
    this.addRequestInterceptor(async (config) => {
      const method = (config.method || 'GET').toUpperCase();
      const mutatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];

      if (mutatingMethods.includes(method) && !config.skipCsrf) {
        try {
          const csrfToken = await getCsrfToken();
          config.headers = {
            ...config.headers,
            'x-csrf-token': csrfToken,
          };
        } catch (error) {
          console.warn('[ApiClient] Failed to get CSRF token:', error);
        }
      }

      return config;
    });

    // Response interceptor: silent refresh, then redirect if that fails.
    // Access tokens are short-lived now (15 minutes by default), so a 401 usually
    // means "expired", not "logged out". Without this the admin panel would bounce
    // the user to /login every quarter of an hour.
    this.addResponseInterceptor(async (response, config) => {
      if (response.status !== 401 || config.skipAuth) return response;

      const isRetry = (config as RequestConfig & { _refreshed?: boolean })._refreshed;
      if (!isRetry && (await this.refreshSession())) {
        (config as RequestConfig & { _refreshed?: boolean })._refreshed = true;
        clearCsrfToken();
        return this.executeRequest(config.url, config);
      }

      // Don't redirect if we're on public pages (no auth required)
      if (typeof window !== 'undefined') {
        const publicPages = ['/', '/login', '/register', '/forgot-password', '/reset-password'];
        const isPublicPage =
          publicPages.includes(window.location.pathname) ||
          window.location.pathname.startsWith('/landing') ||
          window.location.pathname.startsWith('/receipt') ||
          window.location.pathname.startsWith('/invoice') ||
          window.location.pathname.startsWith('/billing') ||
          window.location.pathname.startsWith('/download');
        if (!isPublicPage) {
          window.location.href = '/login';
        }
      }
      return response;
    });

    // Response interceptor: Handle 429 rate limiting with retry
    this.addResponseInterceptor(async (response, config) => {
      if (response.status === 429 && config.retryOn429 !== false) {
        const maxRetries = config.maxRetries || 3;
        const retryCount = (config as any)._retryCount || 0;

        if (retryCount < maxRetries) {
          // Wait before retry (exponential backoff)
          const delay = Math.pow(2, retryCount) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));

          // Retry the request
          (config as any)._retryCount = retryCount + 1;
          return this.executeRequest(config.url, config);
        }
      }
      return response;
    });
  }

  /**
   * Exchanges the refresh cookie for a new access token.
   *
   * Concurrent 401s share a single in-flight request: an admin page can fire a
   * dozen calls at once, and refreshing once per call would rotate the refresh
   * token repeatedly and invalidate the session.
   */
  private refreshPromise: Promise<boolean> | null = null;

  private async refreshSession(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    if (!this.refreshPromise) {
      this.refreshPromise = (async () => {
        try {
          // The refresh call is itself a cookie-authenticated mutation, so it has to
          // carry a CSRF token like any other.
          const csrfToken = await getCsrfToken().catch(() => '');
          const res = await fetch(`${this.getBaseUrl()}/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
            },
          });
          return res.ok;
        } catch {
          return false;
        } finally {
          // Cleared on the next tick so callers awaiting this attempt all see it.
          setTimeout(() => { this.refreshPromise = null; }, 0);
        }
      })();
    }

    return this.refreshPromise;
  }

  /**
   * Add request interceptor (runs before request)
   */
  addRequestInterceptor(interceptor: RequestInterceptor): void {
    this.requestInterceptors.push(interceptor);
  }

  /**
   * Add response interceptor (runs after response)
   */
  addResponseInterceptor(interceptor: ResponseInterceptor): void {
    this.responseInterceptors.push(interceptor);
  }

  /**
   * Add error interceptor (runs on error)
   */
  addErrorInterceptor(interceptor: ErrorInterceptor): void {
    this.errorInterceptors.push(interceptor);
  }

  /**
   * Execute request with all interceptors
   */
  private async executeRequest(endpoint: string, options: RequestConfig = {}): Promise<Response> {
    const baseUrl = this.getBaseUrl();
    const url = buildUrl(
      endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`,
      options.params,
    );

    // Build config
    let config: RequestConfig & { url: string } = {
      ...options,
      url,
      headers: {
        'Content-Type': 'application/json',
        'x-role': 'A',
        ...options.headers,
      },
      credentials: 'include', // SECURITY: Always include credentials for httpOnly cookies
    };

    // Run request interceptors
    for (const interceptor of this.requestInterceptors) {
      config = await interceptor(config);
    }

    // Serialize body if object. `params` is already folded into the URL and is not
    // a RequestInit field, so it is stripped here.
    const { params: _params, ...fetchable } = config;
    const fetchConfig: RequestInit = {
      ...fetchable,
      body: config.body ? JSON.stringify(config.body) : undefined,
    };

    try {
      let response = await fetch(config.url, fetchConfig);

      // Run response interceptors
      for (const interceptor of this.responseInterceptors) {
        response = await interceptor(response, config);
      }

      return response;
    } catch (error) {
      // Run error interceptors
      for (const interceptor of this.errorInterceptors) {
        await interceptor(error as Error, config);
      }
      throw error;
    }
  }

  /**
   * Generic request method with typed response
   */
  async request<T>(endpoint: string, options: RequestConfig = {}): Promise<ApiResponse<T>> {
    try {
      const response = await this.executeRequest(endpoint, options);

      if (!response.ok) {
        // Try to parse error message from response
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          // Response is not JSON
        }

        return {
          error: errorMessage,
          status: response.status
        };
      }

      // Handle empty responses
      const text = await response.text();
      if (!text) {
        return { data: undefined, status: response.status };
      }

      const data = JSON.parse(text) as T;
      return { data, status: response.status };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Network error';
      return { error: message };
    }
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string, options?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  /**
   * POST request
   */
  async post<T>(endpoint: string, body?: unknown, options?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'POST', body });
  }

  /**
   * PUT request
   */
  async put<T>(endpoint: string, body?: unknown, options?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'PUT', body });
  }

  /**
   * PATCH request
   */
  async patch<T>(endpoint: string, body?: unknown, options?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'PATCH', body });
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string, options?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  /**
   * Upload file(s) - handles FormData
   */
  async upload<T>(endpoint: string, formData: FormData, options?: RequestConfig): Promise<ApiResponse<T>> {
    // Remove Content-Type header so browser sets it with boundary
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { headers, body: _body, ...rest } = options || {};
    const newHeaders = { ...headers };
    delete (newHeaders as Record<string, string>)['Content-Type'];

    try {
      const url = endpoint.startsWith('http') ? endpoint : `${this.baseURL}${endpoint}`;

      // Get CSRF token
      let csrfToken = '';
      try {
        csrfToken = await getCsrfToken();
      } catch (error) {
        console.warn('[ApiClient] Failed to get CSRF token for upload');
      }

      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...newHeaders,
          ...(csrfToken && { 'x-csrf-token': csrfToken }),
        },
        body: formData as BodyInit,
        ...rest,
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          // Response is not JSON
        }
        return { error: errorMessage, status: response.status };
      }

      const data = await response.json() as T;
      return { data, status: response.status };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      return { error: message };
    }
  }
}

// Export singleton instance
export const api = new ApiClient();

// Token service methods for convenience
export const tokenService = {
  async getTokens() {
    const response = await api.get<unknown>('/tokenForKeys');
    return response.data;
  },

  async sendToken(token: string): Promise<Record<string, unknown> | undefined> {
    const response = await api.post<Record<string, unknown>>('/token', { token });
    return response.data;
  },
};

// Also export class for testing or custom instances
export default ApiClient;
