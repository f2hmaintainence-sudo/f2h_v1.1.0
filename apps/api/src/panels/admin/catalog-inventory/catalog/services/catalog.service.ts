import { Injectable, InternalServerErrorException } from '@nestjs/common';
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
      if (error instanceof InternalServerErrorException) {
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
      if (error instanceof InternalServerErrorException) {
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
