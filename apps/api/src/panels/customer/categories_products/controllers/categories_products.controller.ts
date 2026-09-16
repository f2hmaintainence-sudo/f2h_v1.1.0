import { Body, Controller, Get, Post, Query, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { Public } from 'src/auth/decorators/public.decorator';
import { CreateDeveloperSubscriptionDto } from '../dto/create-developer-subscription.dto';
import { CategoriesProductsService } from '../ModuleServices/categories_products.service';

@Controller({ path: 'customer', version: '1' })
export class CategoriesController {
  constructor(private readonly service: CategoriesProductsService) {}

  /**
   * Turns an admin `product_banner` row into the shape the app's carousels
   * expect. `route` keeps the old string contract for existing taps, while
   * actionType/actionValue let the app target a category or product exactly.
   */
  private mapManagedBanner(row: any, host: string) {
    const actionType = (row.action_type || 'NONE').toUpperCase();
    const actionValue = row.action_value || row.category_id || null;

    let route = 'menu';
    if (actionType === 'PRODUCT') route = 'product';
    else if (actionType === 'CATEGORY') route = 'category';
    else if (actionType === 'SUBSCRIPTION') route = 'subscribe';
    else if (actionType === 'WALLET') route = 'wallet';
    else if (actionType === 'REFERRAL') route = 'refer';

    const rawImage = row.image_url || row.image_path || '';
    const imageUrl = /^https?:\/\//i.test(rawImage)
      ? rawImage
      : `${host}${rawImage.startsWith('/') ? '' : '/'}${rawImage}`;

    return {
      id: `banner-${row.id}`,
      imageUrl,
      image_url: imageUrl,
      title: row.title || '',
      subtitle: row.description || row.discount_text || '',
      description: row.description || '',
      discountText: row.discount_text || null,
      discount_text: row.discount_text || null,
      backgroundColor: row.background_color || null,
      background_color: row.background_color || null,
      cta: row.cta_label || 'Shop Now',
      cta_label: row.cta_label || 'Shop Now',
      route,
      actionType,
      actionValue,
      bannerType: row.banner_type || 'home_carousel',
      banner_type: row.banner_type || 'home_carousel',
      categoryId: row.category_id || null,
      category_id: row.category_id || null,
      categoryName: row.category_name || null,
      category_name: row.category_name || null,
      couponCode: row.coupon_code || row.promo_code || null,
      coupon_code: row.coupon_code || row.promo_code || null,
      isActive: true,
    };
  }

  @Public()
  @Get('banners')
  async getBanners(@Req() req: Request) {
    const host = `${req.protocol}://${req.get('host')}`;

    // Admin-managed carousel banners win; the bundled files are the fallback.
    const managed = await this.service.getManagedBanners(
      ['home_carousel', 'offer_banner', 'category_slide', 'checkout_promo', 'checkout_banner'],
      false,
    );
    if (managed.length > 0) {
      return {
        status: true,
        data: managed.map((row) => this.mapManagedBanner(row, host)),
      };
    }

    const bannersDir = join(process.cwd(), 'uploads', 'banners');
    let bannerFiles: string[] = [];
    try {
      if (existsSync(bannersDir)) {
        const files = readdirSync(bannersDir).filter(
          (f) =>
            f.endsWith('.png') ||
            f.endsWith('.jpg') ||
            f.endsWith('.jpeg') ||
            f.endsWith('.webp'),
        );
        const subBanners = files
          .filter((f) => f.startsWith('sub_banner_'))
          .sort();
        bannerFiles =
          subBanners.length > 0
            ? subBanners
            : ['sub_banner_1.png', 'sub_banner_2.png', 'sub_banner_3.png'];
      }
    } catch {
      // Deliberately tolerated: the caller has a valid fallback for this failure.
    }

    if (bannerFiles.length === 0) {
      bannerFiles = [
        'sub_banner_1.png',
        'sub_banner_2.png',
        'sub_banner_3.png',
      ];
    }

    const data = bannerFiles.map((file, idx) => {
      let route = 'menu';
      if (file.includes('sub_banner_1')) route = 'subscribe';
      else if (file.includes('sub_banner_2')) route = 'refer';
      else if (file.includes('sub_banner_3')) route = 'menu';

      return {
        id: `banner-${idx + 1}`,
        imageUrl: `${host}/uploads/banners/${encodeURIComponent(file)}`,
        title: 'Farm Fresh Essentials',
        subtitle:
          'Subscribe to pure organic milk, paneer, ghee & daily essentials.',
        cta:
          route === 'subscribe'
            ? 'Subscribe Now'
            : route === 'refer'
              ? 'Refer Now'
              : 'Shop Now',
        route,
        actionType: 'NONE',
        actionValue: null,
        isActive: true,
      };
    });

    return {
      status: true,
      data,
    };
  }

  @Public()
  @Get('promo-banners')
  async getPromoBanners(@Req() req: Request) {
    const host = `${req.protocol}://${req.get('host')}`;

    const managed = await this.service.getManagedBanners(
      ['home_carousel', 'offer_banner', 'category_slide', 'checkout_promo', 'checkout_banner', 'popup'],
      false,
    );
    if (managed.length > 0) {
      return {
        status: true,
        data: managed.map((row) => this.mapManagedBanner(row, host)),
      };
    }

    const bannersDir = join(process.cwd(), 'uploads', 'banners');
    let promoFiles: string[] = [];
    try {
      if (existsSync(bannersDir)) {
        const files = readdirSync(bannersDir);
        promoFiles = ['subscription_banner.png', 'wallet_banner.png'].filter(
          (f) => files.includes(f),
        );
      }
    } catch {
      // Deliberately tolerated: the caller has a valid fallback for this failure.
    }

    if (promoFiles.length === 0) {
      promoFiles = ['subscription_banner.png', 'wallet_banner.png'];
    }

    const data = promoFiles.map((file, idx) => {
      const isSub = file.includes('subscription');
      return {
        id: `promo-banner-${idx + 1}`,
        imageUrl: `${host}/uploads/banners/${encodeURIComponent(file)}`,
        title: isSub ? 'Subscription Savings' : 'F2H Wallet',
        subtitle: isSub
          ? 'Subscribe & Save on Daily Fresh Essentials'
          : 'Add Cash & Get Extra Cashback',
        cta: isSub ? 'Subscribe Now' : 'Add Money',
        route: isSub ? 'subscribe' : 'wallet',
        actionType: 'NONE',
        actionValue: null,
        isActive: true,
      };
    });

    return {
      status: true,
      data,
    };
  }


  /**
   * Popup banners only — `banner_type = 'popup'` or `is_popup = TRUE`.
   * Returns empty banners array if none found — no fallback.
   */
  @Public()
  @Get('popup-banner')
  async getPopupBanner(@Req() req: Request) {
    const host = `${req.protocol}://${req.get('host')}`;
    const rows = await this.service.getManagedBanners([], true);

    const banners = rows.map((row) => {
      const rawImage = row.image_url || row.image_path || '';
      return {
        id: row.id,
        title: row.title || '',
        description: row.description || null,
        discount_text: row.discount_text || null,
        image_url: /^https?:\/\//i.test(rawImage)
          ? rawImage
          : `${host}${rawImage.startsWith('/') ? '' : '/'}${rawImage}`,
        action_type: (row.action_type || 'NONE').toUpperCase(),
        action_value: row.action_value || row.category_id || null,
        category_id: row.category_id || null,
        cta_label: row.cta_label || 'Shop Now',
        background_color: row.background_color || null,
        banner_type: row.banner_type || 'popup',
      };
    });

    return {
      status: true,
      banners,
    };
  }

  /**
   * Only `category_slide` banners — used by Home screen to build
   * per-category product sections matched by category_id.
   */
  @Public()
  @Get('category-slide-banners')
  async getCategorySlideBanners(@Req() req: Request) {
    const host = `${req.protocol}://${req.get('host')}`;
    const rows = await this.service.getCategorySlideBanners();

    return {
      status: true,
      data: rows.map((row) => this.mapManagedBanner(row, host)),
    };
  }

  /**
   * Only `checkout_banner` banners — shown at top of checkout screen.
   */
  @Public()
  @Get('checkout-banners')
  async getCheckoutBanners(@Req() req: Request) {
    const host = `${req.protocol}://${req.get('host')}`;
    const rows = await this.service.getCheckoutBanners();

    return {
      status: true,
      data: rows.map((row) => this.mapManagedBanner(row, host)),
    };
  }

  private extractCustomerId(req: Request): string | null {
    if ((req as any).user?.user_id) return (req as any).user.user_id;
    if ((req as any).user?.id) return (req as any).user.id;
    if ((req as any).user?.customer_id) return (req as any).user.customer_id;

    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(
            Buffer.from(parts[1], 'base64').toString('utf-8'),
          );
          return (
            payload?.user_id ||
            payload?.id ||
            payload?.sub ||
            payload?.customer_id ||
            null
          );
        }
      } catch {}
    }

    const customHeader =
      req.headers['x-user-id'] || req.headers['x-customer-id'];
    if (customHeader) return String(customHeader);

    return null;
  }

  @Public()
  @Get('categories')
  async getCategories() {
    return this.service.getCategories();
  }

  @Public()
  @Get('products')
  async getProducts(
    @Req() req: Request,
    @Query('branch_id') branchId?: string,
  ) {
    const customerId = this.extractCustomerId(req);
    const warehouseId = branchId
      ? await this.service.resolveWarehouseId(branchId)
      : null;
    return this.service.getProducts(customerId, warehouseId);
  }

  @Public()
  @Get('category/:category_id')
  async getProductsByCategoryId(
    @Req() req: Request,
    @Query('branch_id') branchId?: string,
  ) {
    const customerId = this.extractCustomerId(req);
    const warehouseId = branchId
      ? await this.service.resolveWarehouseId(branchId)
      : null;
    return this.service.getProductsByCategoryId(
      req.params.category_id as string,
      customerId,
      warehouseId,
    );
  }

  // [ADDED BY ANTIGRAVITY FOR SUBSCRIPTION & PRODUCT UI UPDATE]
  // GET /customer/products/:productId/reviews
  @Public()
  @Get('products/:productId/reviews')
  async getProductReviews(@Req() req: Request) {
    return this.service.getProductReviews(req.params.productId as string);
  }

  /**
   * Check if a product or variant is active and not deleted.
   * GET /customer/products/:productId/availability
   */
  @Public()
  @Get('products/:productId/availability')
  async checkProductAvailability(
    @Req() req: Request,
    @Query('branch_id') branchId?: string,
  ) {
    const warehouseId = branchId
      ? await this.service.resolveWarehouseId(branchId)
      : null;
    return this.service.checkProductAvailability(
      req.params.productId as string,
      warehouseId,
    );
  }

  /**
   * Public Product Share & Link Preview Endpoint
   * GET /customer/share/product/:productId
   * Serves Open Graph tags for WhatsApp/Telegram/social previews
   * and auto-deep links or redirects to the Play Store app / web.
   */
  @Public()
  @Get('share/product/:productId')
  async getProductSharePage(
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const productId = (req.params as any).productId;
    const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
    const host = (req.headers['x-forwarded-host'] as string) || req.get('host') || 'c.f2hfresh.com';
    const baseUrl = `${protocol}://${host}`;

    const meta = await this.service.getProductShareMeta(productId, baseUrl);
    const title = meta ? `Buy ${meta.name} from F2H Fresh!` : 'Buy Fresh Groceries from F2H Fresh!';
    const rawDesc = meta?.description || 'Order fresh farm-to-home milk, dairy, vegetables, and daily essentials online at best prices.';
    const description = rawDesc.length > 160 ? rawDesc.substring(0, 157) + '...' : rawDesc;
    const imageUrl = meta?.imageUrl || `${baseUrl}/uploads/banners/app_logo.png`;
    const shareUrl = `https://c.f2hfresh.com/p/${productId}`;
    const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.f2h.customer';
    const intentUrl = `intent://c.f2hfresh.com/p/${encodeURIComponent(productId)}#Intent;scheme=https;package=com.f2h.customer;S.browser_fallback_url=${encodeURIComponent(playStoreUrl)};end;`;
    const priceText = meta?.price ? `₹${meta.price}` : '';
    const origPriceText = meta?.originalPrice && meta.originalPrice > (meta.price || 0) ? `₹${meta.originalPrice}` : '';

    const userAgent = (req.headers['user-agent'] as string) || '';
    const isBot = /bot|crawl|spider|whatsapp|facebookexternalhit|telegrambot|twitterbot|linkedinbot|embedly|quora|slackbot/i.test(userAgent);

    const escape = (s: string) => (s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escape(title)}</title>
  <meta name="description" content="${escape(description)}">

  <!-- Open Graph / WhatsApp / Facebook / Telegram -->
  <meta property="og:type" content="product">
  <meta property="og:site_name" content="F2H Fresh">
  <meta property="og:url" content="${escape(shareUrl)}">
  <meta property="og:title" content="${escape(title)}">
  <meta property="og:description" content="${escape(description)}">
  <meta property="og:image" content="${escape(imageUrl)}">
  <meta property="og:image:secure_url" content="${escape(imageUrl)}">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="600">
  <meta property="og:image:height" content="600">
  <meta property="og:image:alt" content="${escape(meta?.name || 'F2H Fresh')}">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${escape(shareUrl)}">
  <meta name="twitter:title" content="${escape(title)}">
  <meta name="twitter:description" content="${escape(description)}">
  <meta name="twitter:image" content="${escape(imageUrl)}">

  <!-- App Deep Link Meta -->
  <meta property="al:android:url" content="f2hfresh://product/${escape(productId)}">
  <meta property="al:android:package" content="com.f2h.customer">
  <meta property="al:android:app_name" content="F2H Fresh">

  <link rel="icon" type="image/png" href="${baseUrl}/favicon.ico">
  <style>
    :root {
      --primary: #15803d;
      --primary-dark: #166534;
      --bg: #f8fafc;
      --card: #ffffff;
      --text: #0f172a;
      --text-muted: #64748b;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    body {
      background: var(--bg);
      color: var(--text);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 16px;
    }
    .card {
      background: var(--card);
      border-radius: 24px;
      box-shadow: 0 12px 32px rgba(0,0,0,0.08);
      max-width: 440px;
      width: 100%;
      overflow: hidden;
      text-align: center;
      border: 1px solid #e2e8f0;
      animation: fadeIn 0.3s ease-out;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .img-wrap {
      width: 100%;
      height: 280px;
      background: #f8fafc;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      border-bottom: 1px solid #f1f5f9;
    }
    .img-wrap img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      border-radius: 12px;
    }
    .content {
      padding: 24px;
    }
    .brand {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 700;
      color: var(--primary);
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 8px;
    }
    .title {
      font-size: 20px;
      font-weight: 700;
      line-height: 1.3;
      margin-bottom: 8px;
      color: var(--text);
    }
    .price-row {
      display: flex;
      align-items: baseline;
      justify-content: center;
      gap: 8px;
      margin-bottom: 12px;
    }
    .price {
      font-size: 22px;
      font-weight: 800;
      color: var(--primary);
    }
    .orig-price {
      font-size: 15px;
      color: #94a3b8;
      text-decoration: line-through;
    }
    .desc {
      font-size: 14px;
      color: var(--text-muted);
      line-height: 1.5;
      margin-bottom: 24px;
    }
    .btn-group {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      width: 100%;
      padding: 14px 20px;
      border-radius: 14px;
      font-size: 15px;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      transition: all 0.2s ease;
      border: none;
    }
    .btn-primary {
      background: var(--primary);
      color: #ffffff;
      box-shadow: 0 4px 14px rgba(21, 128, 61, 0.3);
    }
    .btn-primary:hover {
      background: var(--primary-dark);
    }
    .btn-secondary {
      background: #f1f5f9;
      color: #334155;
    }
    .btn-secondary:hover {
      background: #e2e8f0;
    }
  </style>
  <script>
    const isBot = ${isBot};
    const intentUrl = ${JSON.stringify(intentUrl)};
    const playStoreUrl = ${JSON.stringify(playStoreUrl)};
    if (!isBot) {
      if (/Android/i.test(navigator.userAgent)) {
        // Try to open in installed app via Android intent, fallback immediately to Play Store
        window.location.replace(intentUrl);
        setTimeout(function() {
          window.location.replace(playStoreUrl);
        }, 1200);
      } else {
        // Direct redirect to Google Play Store app
        window.location.replace(playStoreUrl);
      }
    }
  </script>
</head>
<body>
  <div class="card">
    <div class="img-wrap">
      <img src="${escape(imageUrl)}" alt="${escape(meta?.name || 'Product Image')}">
    </div>
    <div class="content">
      <div class="brand">🌱 F2H Fresh</div>
      <h1 class="title">${escape(meta?.name || 'Fresh Product')}</h1>
      ${priceText ? `<div class="price-row"><span class="price">${priceText}</span>${origPriceText ? `<span class="orig-price">${origPriceText}</span>` : ''}</div>` : ''}
      <p class="desc">${escape(description)}</p>

      <div class="btn-group">
        <a href="${escape(intentUrl)}" class="btn btn-primary" id="openAppBtn">
          <span>📱 Open in F2H Fresh App</span>
        </a>
        <a href="${escape(playStoreUrl)}" class="btn btn-secondary" target="_blank" rel="noopener">
          <span>🛒 Download on Google Play</span>
        </a>
      </div>
    </div>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.send(html);
  }
}

