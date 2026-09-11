import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
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
}

