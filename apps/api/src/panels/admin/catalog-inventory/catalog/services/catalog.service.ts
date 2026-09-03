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
  // DELETE DEPENDENCY CHECKS
  // ═══════════════════════════════════════════════════════════════

  async checkProductCanDelete(id: string) {
    try {
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

      const targetProductIds = Array.from(
        new Set([product.product_id, String(product.id), id].filter(Boolean)),
      );

      // Only check non-soft-deleted variants
      const variantsRes = await this.dataService.query('product_variants', {
        select: ['id', 'variant_id', 'name', 'unit_value', 'unit_type', 'price'],
        where: [
          {
            column: 'product_id',
            operator: 'IN',
            value: targetProductIds,
          },
        ],
        limit: 50,
      });

      const activeVariants = variantsRes?.data ?? [];
      const canDelete = activeVariants.length === 0;

      return {
        status: true,
        canDelete,
        count: activeVariants.length,
        itemType: 'product',
        childType: 'variants',
        itemName: product.name || product.product_id,
        items: activeVariants.map((v: any) => ({
          id: v.id,
          identifier: v.variant_id,
          name: v.name || v.variant_id,
          extra: [
            v.unit_value && v.unit_type ? `${v.unit_value} ${v.unit_type}` : null,
            v.price ? `₹${v.price}` : null,
          ].filter(Boolean).join(' • '),
        })),
        message: canDelete
          ? 'Product can be safely deleted.'
          : `Cannot delete product "${product.name || product.product_id}": There are ${activeVariants.length} active variant(s) associated with this product. Please delete all variants first.`,
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.developer.error('checkProductCanDelete error', { error, id });
      throw new InternalServerErrorException('Failed to check product delete constraints');
    }
  }

  async checkCategoryCanDelete(id: string) {
    try {
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

      const targetCategoryIds = Array.from(
        new Set(
          [category.category_id, String(category.id), category.name, category.slug, id].filter(Boolean),
        ),
      );

      // 1. Only check non-soft-deleted products
      const productsRes = await this.dataService.query('products', {
        select: ['id', 'product_id', 'name'],
        where: [
          {
            column: 'category_id',
            operator: 'IN',
            value: targetCategoryIds,
          },
        ],
        limit: 50,
      });

      const activeProducts = productsRes?.data ?? [];

      // 2. Only check non-soft-deleted subcategories
      const subCatIds = Array.from(
        new Set([category.category_id, String(category.id), id].filter(Boolean)),
      );
      const subCatRes = await this.dataService.query('categories', {
        select: ['id', 'category_id', 'name'],
        where: [
          {
            column: 'parent_id',
            operator: 'IN',
            value: subCatIds,
          },
        ],
        limit: 50,
      });

      const activeSubCats = subCatRes?.data ?? [];
      const totalBlockingCount = activeProducts.length + activeSubCats.length;
      const canDelete = totalBlockingCount === 0;

      const items = [
        ...activeProducts.map((p: any) => ({
          id: p.id,
          identifier: p.product_id,
          name: p.name || p.product_id,
          extra: 'Product',
        })),
        ...activeSubCats.map((c: any) => ({
          id: c.id,
          identifier: c.category_id,
          name: c.name || c.category_id,
          extra: 'Sub-category',
        })),
      ];

      let message = 'Category can be safely deleted.';
      if (activeProducts.length > 0) {
        message = `Cannot delete category "${category.name || category.category_id}": There are ${activeProducts.length} active product(s) associated with this category. Please delete or reassign all products first.`;
      } else if (activeSubCats.length > 0) {
        message = `Cannot delete category "${category.name || category.category_id}": There are ${activeSubCats.length} active sub-category(ies) under this category. Please delete or reassign sub-categories first.`;
      }

      return {
        status: true,
        canDelete,
        count: totalBlockingCount,
        itemType: 'category',
        childType: activeProducts.length > 0 ? 'products' : 'sub-categories',
        itemName: category.name || category.category_id,
        items,
        message,
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.developer.error('checkCategoryCanDelete error', { error, id });
      throw new InternalServerErrorException('Failed to check category delete constraints');
    }
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
        select: ['id', 'variant_id', 'name'],
        where: [
          {
            column: 'product_id',
            operator: 'IN',
            value: targetProductIds,
          },
        ],
        limit: 20,
      });

      const activeVariants = variantsRes?.data ?? [];
      if (activeVariants.length > 0) {
        const variantListStr = activeVariants
          .slice(0, 5)
          .map((v: any) => v.name || v.variant_id)
          .join(', ');
        const extraCount = activeVariants.length > 5 ? ` and ${activeVariants.length - 5} more` : '';
        throw new BadRequestException(
          `Cannot delete product "${product.name || product.product_id}": There are ${activeVariants.length} active variant(s) (${variantListStr}${extraCount}) associated with this product. Please delete all variants first.`,
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
        select: ['id', 'product_id', 'name'],
        where: [
          {
            column: 'category_id',
            operator: 'IN',
            value: targetCategoryIds,
          },
        ],
        limit: 20,
      });

      const activeProducts = productsRes?.data ?? [];
      if (activeProducts.length > 0) {
        const productListStr = activeProducts
          .slice(0, 5)
          .map((p: any) => p.name || p.product_id)
          .join(', ');
        const extraCount = activeProducts.length > 5 ? ` and ${activeProducts.length - 5} more` : '';
        throw new BadRequestException(
          `Cannot delete category "${category.name || category.category_id}": There are ${activeProducts.length} active product(s) (${productListStr}${extraCount}) associated with this category. Please delete or reassign all products first.`,
        );
      }

      // 3. Check if active sub-categories exist under this category
      const subCatIds = Array.from(
        new Set([category.category_id, String(category.id), id].filter(Boolean)),
      );
      const subCatRes = await this.dataService.query('categories', {
        select: ['id', 'category_id', 'name'],
        where: [
          {
            column: 'parent_id',
            operator: 'IN',
            value: subCatIds,
          },
        ],
        limit: 20,
      });

      const activeSubCats = subCatRes?.data ?? [];
      if (activeSubCats.length > 0) {
        const subCatListStr = activeSubCats
          .slice(0, 5)
          .map((c: any) => c.name || c.category_id)
          .join(', ');
        const extraCount = activeSubCats.length > 5 ? ` and ${activeSubCats.length - 5} more` : '';
        throw new BadRequestException(
          `Cannot delete category "${category.name || category.category_id}": There are ${activeSubCats.length} active sub-category(ies) (${subCatListStr}${extraCount}) under this category. Please delete or reassign sub-categories first.`,
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
