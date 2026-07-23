import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { Public } from 'src/auth/decorators/public.decorator';
import { CreateDeveloperSubscriptionDto } from '../dto/create-developer-subscription.dto';
import { CategoriesProductsService } from '../ModuleServices/categories_products.service';

@Controller({ path: 'customer', version: '1' })
export class CategoriesController {
  constructor(private readonly service: CategoriesProductsService) { }

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

