import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseService } from 'src/shared/database/Database.service';
import { DataService } from 'src/shared/database/Data.service';
import { DeveloperService } from 'src/shared/logger/Developer.service';
import { PricingService } from 'src/shared/services/pricing.service';
import {
  CategoriesController,
} from './controllers/categories_products.controller';
import { CategoriesProductsService } from './ModuleServices/categories_products.service';

@Module({
  imports: [ConfigModule],
  controllers: [CategoriesController],
  providers: [DeveloperService, PricingService, CategoriesProductsService],
  exports: [CategoriesProductsService],
})
export class CustomerProductsModule { } 
