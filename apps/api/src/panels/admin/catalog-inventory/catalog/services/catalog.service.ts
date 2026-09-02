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
      // 1. Fetch product identifiers (id, product_id, name)
      const isNumericId = !isNaN(Number(id));
      const productQuery = isNumericId
        ? `SELECT id, product_id, name FROM products WHERE id = $1 AND deleted_at IS NULL LIMIT 1;`
        : `SELECT id, product_id, name FROM products WHERE (product_id = $1 OR id::text = $1) AND deleted_at IS NULL LIMIT 1;`;
      const productParams = [isNumericId ? Number(id) : id];
      const productRes = await this.db.query(productQuery, productParams);

      const targetProduct = productRes?.[0];
      const productIdNum = targetProduct?.id ? String(targetProduct.id) : (isNumericId ? String(id) : null);
      const productIdStr = targetProduct?.product_id ? String(targetProduct.product_id) : String(id);

      // 2. Check for active (non-deleted) variants linked to this product
      const variantCheckSql = `
        SELECT id FROM product_variants 
        WHERE (${productIdNum ? 'product_id = $1 OR ' : ''}product_id = $2) 
          AND deleted_at IS NULL 
        LIMIT 1;
      `;
      const variantParams = productIdNum ? [productIdNum, productIdStr] : [productIdStr, productIdStr];
      const variantRes = await this.db.query(variantCheckSql, variantParams);

      if (variantRes?.length > 0) {
        throw new BadRequestException(
          'Cannot delete product because active product variant(s) exist. Please delete or remove all variants first.'
        );
      }

      // 3. Perform soft delete
      await this.db.query(
        `UPDATE products 
            SET deleted_at = NOW(), 
                updated_by = $2, 
                updated_at = NOW() 
          WHERE (id::text = $1 OR product_id = $1) 
            AND deleted_at IS NULL`,
        [String(id), adminId],
      );

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
      await this.db.query(
        `UPDATE product_variants 
            SET deleted_at = NOW(), 
                updated_by = $2, 
                updated_at = NOW() 
          WHERE (id::text = $1 OR variant_id = $1) 
            AND deleted_at IS NULL`,
        [String(id), adminId],
      );

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
      // 1. Fetch category identifiers (id, category_id, name)
      const isNumericId = !isNaN(Number(id));
      const categoryQuery = isNumericId
        ? `SELECT id, category_id, name FROM categories WHERE id = $1 AND deleted_at IS NULL LIMIT 1;`
        : `SELECT id, category_id, name FROM categories WHERE (category_id = $1 OR id::text = $1) AND deleted_at IS NULL LIMIT 1;`;
      const categoryParams = [isNumericId ? Number(id) : id];
      const categoryRes = await this.db.query(categoryQuery, categoryParams);

      const targetCategory = categoryRes?.[0];
      const categoryIdNum = targetCategory?.id ? String(targetCategory.id) : (isNumericId ? String(id) : null);
      const categoryIdStr = targetCategory?.category_id ? String(targetCategory.category_id) : String(id);

      // 2. Check for active (non-deleted) products linked to this category
      const productCheckSql = `
        SELECT id FROM products 
        WHERE (${categoryIdNum ? 'category_id = $1 OR ' : ''}category_id = $2) 
          AND deleted_at IS NULL 
        LIMIT 1;
      `;
      const productParams = categoryIdNum ? [categoryIdNum, categoryIdStr] : [categoryIdStr, categoryIdStr];
      const productRes = await this.db.query(productCheckSql, productParams);

      if (productRes?.length > 0) {
        throw new BadRequestException(
          'Cannot delete category because active product(s) exist in this category. Please delete or reassign all products first.'
        );
      }

      // 3. Perform soft delete
      await this.db.query(
        `UPDATE categories 
            SET deleted_at = NOW(), 
                updated_by = $2, 
                updated_at = NOW() 
          WHERE (id::text = $1 OR category_id = $1) 
            AND deleted_at IS NULL`,
        [String(id), adminId],
      );

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
