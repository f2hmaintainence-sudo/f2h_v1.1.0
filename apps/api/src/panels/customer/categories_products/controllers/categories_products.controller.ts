import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { Public } from 'src/auth/decorators/public.decorator';
import { CreateDeveloperSubscriptionDto } from '../dto/create-developer-subscription.dto';
import { CategoriesProductsService } from '../ModuleServices/categories_products.service';

@Controller({ path: 'customer', version: '1' })
export class CategoriesController {
  constructor(private readonly service: CategoriesProductsService) { }

  @Public()
  @Get('banners')
  async getBanners(@Req() req: Request) {
    const host = `${req.protocol}://${req.get('host')}`;
    const bannersDir = join(process.cwd(), 'uploads', 'banners');
    let bannerFiles: string[] = [];
    try {
      if (existsSync(bannersDir)) {
        const files = readdirSync(bannersDir).filter(
          (f) => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.webp'),
        );
        const subBanners = files.filter((f) => f.startsWith('sub_banner_')).sort();
        bannerFiles = subBanners.length > 0 ? subBanners : ['sub_banner_1.png', 'sub_banner_2.png', 'sub_banner_3.png'];
      }
    } catch (_) {}

    if (bannerFiles.length === 0) {
      bannerFiles = ['sub_banner_1.png', 'sub_banner_2.png', 'sub_banner_3.png'];
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
        subtitle: 'Subscribe to pure organic milk, paneer, ghee & daily essentials.',
        cta: route === 'subscribe' ? 'Subscribe Now' : route === 'refer' ? 'Refer Now' : 'Shop Now',
        route,
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
    const bannersDir = join(process.cwd(), 'uploads', 'banners');
    let promoFiles: string[] = [];
    try {
      if (existsSync(bannersDir)) {
        const files = readdirSync(bannersDir);
        promoFiles = ['subscription_banner.png', 'wallet_banner.png'].filter((f) => files.includes(f));
      }
    } catch (_) {}

    if (promoFiles.length === 0) {
      promoFiles = ['subscription_banner.png', 'wallet_banner.png'];
    }

    const data = promoFiles.map((file, idx) => {
      const isSub = file.includes('subscription');
      return {
        id: `promo-banner-${idx + 1}`,
        imageUrl: `${host}/uploads/banners/${encodeURIComponent(file)}`,
        title: isSub ? 'Subscription Savings' : 'F2H Wallet',
        subtitle: isSub ? 'Subscribe & Save on Daily Fresh Essentials' : 'Add Cash & Get Extra Cashback',
        cta: isSub ? 'Subscribe Now' : 'Add Money',
        route: isSub ? 'subscribe' : 'wallet',
        isActive: true,
      };
    });

    return {
      status: true,
      data,
    };
  }

  @Public()
  @Get('categories')
  async getCategories() {
    return this.service.getCategories();
  }
  @Public()
  @Get('products')
  async getProducts() {
    return this.service.getProducts();
  }
  @Public()
  @Get('category/:category_id')
  async getProductsByCategoryId(@Req() req: Request) {
    return this.service.getProductsByCategoryId(req.params.category_id as string);
  }

  // [ADDED BY ANTIGRAVITY FOR SUBSCRIPTION & PRODUCT UI UPDATE]
  // GET /customer/products/:productId/reviews
  @Public()
  @Get('products/:productId/reviews')
  async getProductReviews(@Req() req: Request) {
    return this.service.getProductReviews(req.params.productId as string);
  }
}


