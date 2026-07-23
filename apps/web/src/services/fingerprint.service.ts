/**
 * 🔍 DEVICE FINGERPRINT SERVICE
 * Collects browser fingerprint data to send with login request
 * This uniquely identifies the device/browser combination
 */

export class FingerprintService {
  /**
   * Generate comprehensive device fingerprint
   * Returns data identifying the browser/device
   */
  async generateFingerprint(): Promise<any> {
    try {
      return {
        // 1. Screen resolution and color depth
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        colorDepth: window.screen.colorDepth,
        
        // 2. Timezone and locale
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        locales: navigator.languages?.join(',') || navigator.language,
        acceptLanguage: navigator.language,
        
        // 3. Platform and device info
        platform: navigator.platform,
        deviceMemory: (navigator as any).deviceMemory || 'unknown',
        hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
        
        // 4. Browser plugins
        plugins: this.getPlugins(),
        
        // 5. Canvas fingerprinting (unique per browser)
        canvas: await this.getCanvasFingerprint(),
        
        // 6. WebGL fingerprinting (GPU info)
        webgl: this.getWebGLInfo(),
        
        // 7. User agent
        userAgent: navigator.userAgent,
        
        // 8. Do Not Track
        doNotTrack: navigator.doNotTrack,
        
        // 9. Cookies enabled
        cookiesEnabled: navigator.cookieEnabled,
        
        // 10. Local storage available
        localStorageEnabled: this.isLocalStorageEnabled(),
      };
    } catch (error) {
      console.error('[FingerprintService] Error generating fingerprint:', error);
      // Return minimal fallback
      return {
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        platform: navigator.platform,
        userAgent: navigator.userAgent,
      };
    }
  }

  /**
   * Get browser plugins
   */
  private getPlugins(): string[] {
    try {
      return Array.from(navigator.plugins)
        .map((plugin: any) => ({
          name: plugin.name,
          version: plugin.version,
          description: plugin.description,
        }))
        .map(p => `${p.name}|${p.version}`)
        .slice(0, 10);
    } catch (e) {
      return [];
    }
  }

  /**
   * Generate canvas fingerprint
   * Each browser renders text/graphics slightly differently
   */
  private async getCanvasFingerprint(): Promise<string> {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) return 'unknown';
      
      // Set canvas size
      canvas.width = 280;
      canvas.height = 60;
      
      // Fill background with gradient
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('🔒 giftthem 🔐', 2, 15);
      
      // Various text styles
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = 'rgb(255,0,255)';
      ctx.beginPath();
      ctx.arc(50, 25, 20, 0, Math.PI * 2, true);
      ctx.fill();
      
      ctx.fillStyle = 'rgb(0,255,255)';
      ctx.beginPath();
      ctx.arc(100, 25, 20, 0, Math.PI * 2, true);
      ctx.fill();
      
      // Get canvas data
      const dataURL = canvas.toDataURL();
      
      // Hash to create fingerprint
      return this.hashString(dataURL).substring(0, 16);
    } catch (e) {
      return 'canvas-error';
    }
  }

  /**
   * Get WebGL info (GPU capabilities)
   */
  private getWebGLInfo(): string {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      
      if (!gl) return 'webgl-disabled';
      
      const debugInfo = (gl as any).getExtension('WEBGL_debug_renderer_info');
      if (!debugInfo) return 'webgl-no-debug';
      
      const renderer = (gl as any).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      const vendor = (gl as any).getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
      
      return `${vendor}|${renderer}`.substring(0, 32);
    } catch (e) {
      return 'webgl-error';
    }
  }

  /**
   * Check if localStorage is available
   */
  private isLocalStorageEnabled(): boolean {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Simple hash function for creating fingerprint hash
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }
}

// Export singleton instance
export const fingerprintService = new FingerprintService();
