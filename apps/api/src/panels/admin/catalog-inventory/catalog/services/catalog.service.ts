import { Injectable, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { CatalogTableService } from './table.service';
import { DeveloperService } from '../../../../../shared/logger/Developer.service';
import { DataService } from '../../../../../shared/database/Data.service';
import { DatabaseService } from '../../../../../shared/database/Database.service';

@Injectable()
export class CatalogService {
  constructor(
    private readonly catalogTableService: CatalogTableService,
    private readonly developer: DeveloperService,
    private readonly dataService: DataService,
    private readonly db: DatabaseService,
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
      // Guard: reject if active (non-deleted) variants still exist for this product
      const variantRows = await this.db.query<{ count: string }>(
        `SELECT COUNT(*) AS count
           FROM product_variants pv
           JOIN products p ON p.product_id = pv.product_id
          WHERE p.id = $1
            AND pv.deleted_at IS NULL`,
        [Number(id)],
      );
      const variantCount = parseInt(variantRows?.[0]?.count ?? '0', 10);
      if (variantCount > 0) {
        throw new BadRequestException(
          `Cannot delete this product — ${variantCount} active variant(s) still exist. Please delete or remove all variants first.`,
        );
      }

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
            value: Number(id),
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
      if (error instanceof InternalServerErrorException || error instanceof BadRequestException) {
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
          {
            column: 'id',
            operator: '=',
            value: Number(id),
          },
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
      // Guard: reject if active (non-deleted) products still belong to this category
      const productRows = await this.db.query<{ count: string }>(
        `SELECT COUNT(*) AS count
           FROM products p
           JOIN categories c ON c.category_id = p.category_id
          WHERE c.id = $1
            AND p.deleted_at IS NULL`,
        [Number(id)],
      );
      const productCount = parseInt(productRows?.[0]?.count ?? '0', 10);
      if (productCount > 0) {
        throw new BadRequestException(
          `Cannot delete this category — ${productCount} active product(s) still belong to it. Please delete or reassign all products first.`,
        );
      }

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
            value: Number(id),
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
      if (error instanceof InternalServerErrorException || error instanceof BadRequestException) {
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
