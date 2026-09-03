import {
  Injectable,
  InternalServerErrorException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { CatalogTableService } from './table.service';
import { DeveloperService } from '../../../../../shared/logger/Developer.service';
import { DataService } from '../../../../../shared/database/Data.service';

@Injectable()
export class CatalogService {
  constructor(
    private readonly catalogTableService: CatalogTableService,
    private readonly developer: DeveloperService,
    private readonly dataService: DataService,
  ) { }

  // ═══════════════════════════════════════════════════════════════
  // CATALOG PRODUCTS TABLE
  // ═══════════════════════════════════════════════════════════════

  async getCatalogTable(query: any) {
    return this.catalogTableService.getProductsTable(query);
  }

  // ═══════════════════════════════════════════════════════════════
  // PRODUCT VARIANTS TABLE
  // ═══════════════════════════════════════════════════════════════

  async getProductVariantsTable(query: any) {
    return this.catalogTableService.getProductVariantsTable(query);
  }

  // ═══════════════════════════════════════════════════════════════
  // PRODUCT CATEGORIES TABLE
  // ═══════════════════════════════════════════════════════════════

  async getProductCategoriesTable(query: any) {
    return this.catalogTableService.getCategoriesTable(query);
  }

  // ═══════════════════════════════════════════════════════════════
  // SOFT DELETION METHODS
  // ═══════════════════════════════════════════════════════════════

  async softDeleteProduct(id: string, adminId: string) {
    try {
      // 1. Fetch product to get product_id, numeric id, and name
      const productRes = await this.dataService.query('products', {
        select: ['id', 'product_id', 'name'],
        where: [
          isNaN(Number(id))
            ? { column: 'product_id', operator: '=', value: id }
            : { column: 'id', operator: '=', value: Number(id) },
        ],
      });

      const product = productRes?.data?.[0];
      if (!product) {
        throw new NotFoundException('Product not found');
      }

      // 2. Check if active/non-deleted variants exist for this product
      const targetProductIds = Array.from(
        new Set([product.product_id, String(product.id), id].filter(Boolean)),
      );

      const variantsRes = await this.dataService.query('product_variants', {
        select: { count: '*' },
        where: [
          {
            column: 'product_id',
            operator: 'IN',
            value: targetProductIds,
          },
        ],
      });

      const activeVariantsCount = Number(variantsRes?.data?.[0]?.count ?? 0);
      if (activeVariantsCount > 0) {
        throw new BadRequestException(
          `Cannot delete product "${product.name || product.product_id}": There are ${activeVariantsCount} active variant(s) associated with this product. Please delete all variants first.`,
        );
      }

      // 3. Perform soft-delete
      const result = await this.dataService.query('products', {
        update: {
          deleted_at: new Date().toISOString(),
          updated_by: adminId,
          updated_at: new Date().toISOString(),
        },
        where: [
          {
            column: 'id',
            operator: '=',
            value: Number(product.id),
          },
        ],
      });

      if (!result?.status) {
        throw new InternalServerErrorException('Failed to delete product');
      }

      return {
        status: true,
        message: 'Product deleted successfully',
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      this.developer.error('softDeleteProduct error', { error, id });
      throw new InternalServerErrorException('Failed to delete product');
    }
  }

  async softDeleteVariant(id: string, adminId: string) {
    try {
      const result = await this.dataService.query('product_variants', {
        update: {
          deleted_at: new Date().toISOString(),
          updated_by: adminId,
          updated_at: new Date().toISOString(),
        },
        where: [
          isNaN(Number(id))
            ? { column: 'variant_id', operator: '=', value: id }
            : { column: 'id', operator: '=', value: Number(id) },
        ],
      });

      if (!result?.status) {
        throw new InternalServerErrorException('Failed to delete variant');
      }

      return {
        status: true,
        message: 'Variant deleted successfully',
      };
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      this.developer.error('softDeleteVariant error', { error, id });
      throw new InternalServerErrorException('Failed to delete variant');
    }
  }

  async softDeleteCategory(id: string, adminId: string) {
    try {
      // 1. Fetch category to get category_id, name, slug, numeric id
      const catRes = await this.dataService.query('categories', {
        select: ['id', 'category_id', 'name', 'slug'],
        where: [
          isNaN(Number(id))
            ? { column: 'category_id', operator: '=', value: id }
            : { column: 'id', operator: '=', value: Number(id) },
        ],
      });

      const category = catRes?.data?.[0];
      if (!category) {
        throw new NotFoundException('Category not found');
      }

      // 2. Check if active/non-deleted products exist for this category
      const targetCategoryIds = Array.from(
        new Set(
          [category.category_id, String(category.id), category.name, category.slug, id].filter(Boolean),
        ),
      );

      const productsRes = await this.dataService.query('products', {
        select: { count: '*' },
        where: [
          {
            column: 'category_id',
            operator: 'IN',
            value: targetCategoryIds,
          },
        ],
      });

      const activeProductsCount = Number(productsRes?.data?.[0]?.count ?? 0);
      if (activeProductsCount > 0) {
        throw new BadRequestException(
          `Cannot delete category "${category.name || category.category_id}": There are ${activeProductsCount} active product(s) associated with this category. Please delete or reassign all products first.`,
        );
      }

      // 3. Check if active sub-categories exist under this category
      const subCatIds = Array.from(
        new Set([category.category_id, String(category.id), id].filter(Boolean)),
      );
      const subCatRes = await this.dataService.query('categories', {
        select: { count: '*' },
        where: [
          {
            column: 'parent_id',
            operator: 'IN',
            value: subCatIds,
          },
        ],
      });

      const subCatCount = Number(subCatRes?.data?.[0]?.count ?? 0);
      if (subCatCount > 0) {
        throw new BadRequestException(
          `Cannot delete category "${category.name || category.category_id}": There are ${subCatCount} active sub-category(ies) under this category. Please delete or reassign sub-categories first.`,
        );
      }

      // 4. Perform soft-delete
      const result = await this.dataService.query('categories', {
        update: {
          deleted_at: new Date().toISOString(),
          updated_by: adminId,
          updated_at: new Date().toISOString(),
        },
        where: [
          {
            column: 'id',
            operator: '=',
            value: Number(category.id),
          },
        ],
      });

      if (!result?.status) {
        throw new InternalServerErrorException('Failed to delete category');
      }

      return {
        status: true,
        message: 'Category deleted successfully',
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      this.developer.error('softDeleteCategory error', { error, id });
      throw new InternalServerErrorException('Failed to delete category');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // PRODUCT OFFERS / BANNERS TABLE & DELETE
  // ═══════════════════════════════════════════════════════════════

  async getOffersTable(query: any) {
    return this.catalogTableService.getOffersTable(query);
  }

  async deleteOffer(id: string, adminId: string) {
    try {
      const result = await this.dataService.query('product_banner', {
        delete: true,
        where: [{ column: 'id', operator: '=', value: id }],
      });

      if (!result?.status) {
        throw new InternalServerErrorException('Failed to delete offer banner');
      }

      return {
        status: true,
        message: 'Offer banner deleted successfully',
      };
    } catch (error) {
      if (error instanceof InternalServerErrorException) throw error;
      this.developer.error('deleteOffer error', { error, id });
      throw new InternalServerErrorException('Failed to delete offer banner');
    }
  }
}
