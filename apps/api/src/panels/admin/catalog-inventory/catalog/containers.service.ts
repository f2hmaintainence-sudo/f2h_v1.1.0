import { Injectable, BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../../../shared/database/Database.service';
import { DeveloperService } from '../../../../shared/logger/Developer.service';

@Injectable()
export class ContainersService {
  constructor(
    private readonly db: DatabaseService,
    private readonly developer: DeveloperService,
  ) {}

  private async ensureWarehouseContainersTable() {
    try {
      await this.db.query(`
        CREATE TABLE IF NOT EXISTS public.warehouse_containers (
          id BIGSERIAL PRIMARY KEY,
          warehouse_id VARCHAR(100) NOT NULL,
          container_id VARCHAR(100) NOT NULL,
          quantity INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          deleted_at TIMESTAMPTZ DEFAULT NULL,
          CONSTRAINT uq_warehouse_container UNIQUE (warehouse_id, container_id)
        );
        CREATE INDEX IF NOT EXISTS idx_warehouse_containers_wh ON public.warehouse_containers (warehouse_id);
        CREATE INDEX IF NOT EXISTS idx_warehouse_containers_cont ON public.warehouse_containers (container_id);
      `);
    } catch {
      // Ignore if table/indexes exist
    }
  }

  async getContainers(query: any) {
    try {
      await this.ensureWarehouseContainersTable();
      const page = parseInt(query.page || '1', 10);
      const limit = parseInt(query.limit || '20', 10);
      const offset = (page - 1) * limit;
      const search = query.search || '';

      let whereClause = `WHERE c.deleted_at IS NULL`;
      const params: any[] = [];

      if (search) {
        params.push(`%${search}%`, `%${search}%`);
        whereClause += ` AND (c.name ILIKE $1 OR c.container_id ILIKE $2)`;
      }

      const listSql = `
        SELECT 
          c.id,
          c.container_id,
          c.name,
          c.is_returnable,
          c.status,
          c.created_at,
          c.updated_at,
          COALESCE(SUM(wc.quantity), c.quantity, 0)::int as total_quantity
        FROM containers c
        LEFT JOIN warehouse_containers wc ON wc.container_id = c.container_id AND wc.deleted_at IS NULL
        ${whereClause}
        GROUP BY c.id, c.container_id, c.name, c.is_returnable, c.status, c.created_at, c.updated_at, c.quantity
        ORDER BY c.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;

      const countSql = `
        SELECT COUNT(DISTINCT c.id)::int as total
        FROM containers c
        ${whereClause}
      `;

      const [rows, countRes, allWarehouseStock, activeWarehouses] = await Promise.all([
        this.db.query(listSql, [...params, limit, offset]),
        this.db.query(countSql, params),
        this.db.query(`
          SELECT 
            wc.container_id,
            wc.warehouse_id,
            wc.quantity,
            w.name AS warehouse_name,
            w.code AS warehouse_code
          FROM warehouse_containers wc
          JOIN warehouses w ON (w.warehouse_id = wc.warehouse_id OR w.id::text = wc.warehouse_id) AND w.deleted_at IS NULL
          WHERE wc.deleted_at IS NULL
        `),
        this.db.query(`
          SELECT warehouse_id, name, code, is_active 
          FROM warehouses 
          WHERE deleted_at IS NULL 
          ORDER BY name ASC
        `),
      ]);

      const total = countRes[0]?.total || 0;

      // Group warehouse breakdown by container_id
      const stockMap = new Map<string, any[]>();
      for (const item of (allWarehouseStock || [])) {
        if (!stockMap.has(item.container_id)) {
          stockMap.set(item.container_id, []);
        }
        stockMap.get(item.container_id)!.push({
          warehouse_id: item.warehouse_id,
          warehouse_name: item.warehouse_name,
          warehouse_code: item.warehouse_code,
          quantity: Number(item.quantity || 0),
        });
      }

      const enrichedRows = rows.map((r: any) => {
        const existingStock = stockMap.get(r.container_id) || [];
        // Ensure every active warehouse is represented
        const warehouseBreakdown = (activeWarehouses || []).map((wh: any) => {
          const match = existingStock.find((s: any) => s.warehouse_id === wh.warehouse_id);
          return {
            warehouse_id: wh.warehouse_id,
            warehouse_name: wh.name,
            warehouse_code: wh.code,
            quantity: match ? match.quantity : 0,
          };
        });

        const computedTotal = warehouseBreakdown.reduce((sum: number, w: any) => sum + w.quantity, 0);

        return {
          id: r.id,
          container_id: r.container_id,
          name: r.name,
          quantity: computedTotal > 0 ? computedTotal : Number(r.total_quantity || 0),
          is_returnable: r.is_returnable,
          status: r.status || 'active',
          created_at: r.created_at,
          updated_at: r.updated_at,
          warehouses: warehouseBreakdown,
        };
      });

      return {
        status: true,
        data: enrichedRows,
        warehouses: activeWarehouses || [],
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.developer.error('ContainersService.getContainers error', { error });
      throw new InternalServerErrorException('Failed to fetch containers list');
    }
  }

  async createContainer(body: any) {
    try {
      await this.ensureWarehouseContainersTable();
      const { container_id, name, warehouse_quantities, quantity, is_returnable = true, status = 'active' } = body;
      if (!name || !String(name).trim()) {
        throw new BadRequestException('Container Type name is required');
      }

      const generatedId = container_id ? String(container_id).trim() : `CONT-${Math.floor(1000 + Math.random() * 9000)}`;

      const checkExisting = await this.db.query(
        `SELECT id FROM containers WHERE container_id = $1 AND deleted_at IS NULL`,
        [generatedId]
      );
      if (checkExisting?.length > 0) {
        throw new BadRequestException(`Container Type ID '${generatedId}' already exists`);
      }

      let totalQty = 0;
      const parsedWarehouseStock: { warehouse_id: string; quantity: number }[] = [];

      if (Array.isArray(warehouse_quantities) && warehouse_quantities.length > 0) {
        for (const wq of warehouse_quantities) {
          const q = Math.max(0, Number(wq.quantity || 0));
          totalQty += q;
          if (wq.warehouse_id) {
            parsedWarehouseStock.push({
              warehouse_id: String(wq.warehouse_id).trim(),
              quantity: q,
            });
          }
        }
      } else if (quantity !== undefined && quantity !== null) {
        totalQty = Math.max(0, Number(quantity));
      }

      const insertRes = await this.db.query(
        `INSERT INTO containers (container_id, name, quantity, is_returnable, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         RETURNING *`,
        [generatedId, String(name).trim(), totalQty, Boolean(is_returnable), status]
      );

      // Upsert warehouse container stock
      if (parsedWarehouseStock.length > 0) {
        for (const ws of parsedWarehouseStock) {
          await this.db.query(
            `INSERT INTO warehouse_containers (warehouse_id, container_id, quantity, created_at, updated_at)
             VALUES ($1, $2, $3, NOW(), NOW())
             ON CONFLICT (warehouse_id, container_id) DO UPDATE
             SET quantity = EXCLUDED.quantity, updated_at = NOW()`,
            [ws.warehouse_id, generatedId, ws.quantity]
          );
        }
      }

      return {
        status: true,
        message: 'Container Type created successfully',
        data: insertRes[0],
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('ContainersService.createContainer error', { error });
      throw new InternalServerErrorException('Failed to create container type');
    }
  }

  async updateContainer(id: string, body: any) {
    try {
      await this.ensureWarehouseContainersTable();
      const { name, warehouse_quantities, quantity, is_returnable, status } = body;

      const checkRes = await this.db.query(
        `SELECT * FROM containers WHERE (container_id = $1 OR id::text = $2) AND deleted_at IS NULL`,
        [id, id]
      );
      if (!checkRes?.length) {
        throw new NotFoundException('Container Type not found');
      }

      const target = checkRes[0];
      const targetContainerId = target.container_id;

      const updatedName = name !== undefined ? String(name).trim() : target.name;
      const updatedReturnable = is_returnable !== undefined ? Boolean(is_returnable) : target.is_returnable;
      const updatedStatus = status ?? target.status;

      let totalQty = Number(target.quantity || 0);

      // If warehouse quantities provided, update warehouse_containers
      if (Array.isArray(warehouse_quantities)) {
        totalQty = 0;
        for (const wq of warehouse_quantities) {
          const q = Math.max(0, Number(wq.quantity || 0));
          totalQty += q;
          if (wq.warehouse_id) {
            await this.db.query(
              `INSERT INTO warehouse_containers (warehouse_id, container_id, quantity, created_at, updated_at)
               VALUES ($1, $2, $3, NOW(), NOW())
               ON CONFLICT (warehouse_id, container_id) DO UPDATE
               SET quantity = EXCLUDED.quantity, updated_at = NOW()`,
              [String(wq.warehouse_id).trim(), targetContainerId, q]
            );
          }
        }
      } else if (quantity !== undefined && quantity !== null) {
        totalQty = Math.max(0, Number(quantity));
      }

      const updateRes = await this.db.query(
        `UPDATE containers 
         SET name = $1, quantity = $2, is_returnable = $3, status = $4, updated_at = NOW()
         WHERE id = $5
         RETURNING *`,
        [updatedName, totalQty, updatedReturnable, updatedStatus, target.id]
      );

      return {
        status: true,
        message: 'Container Type updated successfully',
        data: updateRes[0],
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) throw error;
      this.developer.error('ContainersService.updateContainer error', { error });
      throw new InternalServerErrorException('Failed to update container type');
    }
  }

  async adjustWarehouseStock(body: any) {
    try {
      await this.ensureWarehouseContainersTable();
      const { warehouse_id, container_id, quantity, mode = 'set' } = body;
      if (!warehouse_id || !container_id || quantity === undefined) {
        throw new BadRequestException('warehouse_id, container_id, and quantity are required');
      }

      const qtyNum = Number(quantity);
      if (mode === 'add') {
        await this.db.query(
          `INSERT INTO warehouse_containers (warehouse_id, container_id, quantity, created_at, updated_at)
           VALUES ($1, $2, $3, NOW(), NOW())
           ON CONFLICT (warehouse_id, container_id) DO UPDATE
           SET quantity = GREATEST(0, warehouse_containers.quantity + $3), updated_at = NOW()`,
          [warehouse_id, container_id, qtyNum]
        );
      } else {
        const safeQty = Math.max(0, qtyNum);
        await this.db.query(
          `INSERT INTO warehouse_containers (warehouse_id, container_id, quantity, created_at, updated_at)
           VALUES ($1, $2, $3, NOW(), NOW())
           ON CONFLICT (warehouse_id, container_id) DO UPDATE
           SET quantity = $3, updated_at = NOW()`,
          [warehouse_id, container_id, safeQty]
        );
      }

      // Recompute total quantity on master container
      const sumRes = await this.db.query(
        `SELECT COALESCE(SUM(quantity), 0)::int as total 
         FROM warehouse_containers 
         WHERE container_id = $1 AND deleted_at IS NULL`,
        [container_id]
      );
      const newTotal = sumRes[0]?.total || 0;
      await this.db.query(
        `UPDATE containers SET quantity = $1, updated_at = NOW() WHERE container_id = $2`,
        [newTotal, container_id]
      );

      return {
        status: true,
        message: 'Warehouse container stock updated successfully',
        data: {
          warehouse_id,
          container_id,
          total_quantity: newTotal,
        },
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('ContainersService.adjustWarehouseStock error', { error });
      throw new InternalServerErrorException('Failed to adjust warehouse container stock');
    }
  }

  async getContainersDropdown() {
    try {
      await this.ensureWarehouseContainersTable();
      const rows = await this.db.query(
        `SELECT 
           c.container_id, 
           c.name, 
           c.is_returnable,
           COALESCE(SUM(wc.quantity), c.quantity, 0)::int as total_quantity
         FROM containers c
         LEFT JOIN warehouse_containers wc ON wc.container_id = c.container_id AND wc.deleted_at IS NULL
         WHERE (c.status = 'active' OR c.status IS NULL) AND c.deleted_at IS NULL
         GROUP BY c.id, c.container_id, c.name, c.is_returnable, c.quantity
         ORDER BY c.name ASC`
      );

      const dropdownOptions = rows.map((r: any) => ({
        label: `${r.name} (${r.container_id})`,
        value: r.container_id,
        container_id: r.container_id,
        name: r.name,
        is_returnable: r.is_returnable,
        quantity: Number(r.total_quantity || 0),
      }));

      return {
        status: true,
        data: dropdownOptions,
      };
    } catch (error) {
      this.developer.error('ContainersService.getContainersDropdown error', { error });
      throw new InternalServerErrorException('Failed to fetch containers dropdown options');
    }
  }
}
