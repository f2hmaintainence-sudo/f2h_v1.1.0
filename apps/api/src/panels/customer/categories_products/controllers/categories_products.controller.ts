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
        bannerFiles = readdirSync(bannersDir).filter(
          (f) => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.webp'),
        );
      }
    } catch (_) {}

    if (bannerFiles.length === 0) {
      bannerFiles = ['subscription_banner.png'];
    }

    const data = bannerFiles.map((file, idx) => ({
      id: `banner-${idx + 1}`,
      imageUrl: `${host}/uploads/banners/${encodeURIComponent(file)}`,
      title: 'Farm Fresh Essentials',
      subtitle: 'Subscribe to pure organic milk, paneer, ghee & daily essentials.',
      cta: 'Order Now',
      route: 'menu',
      isActive: true,
    }));

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


