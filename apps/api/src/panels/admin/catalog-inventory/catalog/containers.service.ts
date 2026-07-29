import { Injectable, BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../../../shared/database/Database.service';
import { DeveloperService } from '../../../../shared/logger/Developer.service';

@Injectable()
export class ContainersService {
  constructor(
    private readonly db: DatabaseService,
    private readonly developer: DeveloperService,
  ) {}

  async getContainers(query: any) {
    try {
      const page = parseInt(query.page || '1', 10);
      const limit = parseInt(query.limit || '10', 10);
      const offset = (page - 1) * limit;
      const search = query.search || '';

      let whereClause = `WHERE c.deleted_at IS NULL`;
      const params: any[] = [];

      if (search) {
        params.push(`%${search}%`, `%${search}%`);
        whereClause += ` AND (c.name ILIKE ? OR c.container_id ILIKE ?)`;
      }

      const listSql = `
        SELECT c.*
        FROM containers c
        ${whereClause}
        ORDER BY c.created_at DESC
        LIMIT ? OFFSET ?
      `;

      const countSql = `
        SELECT COUNT(*)::int as total
        FROM containers c
        ${whereClause}
      `;

      const [rows, countRes] = await Promise.all([
        this.db.query(listSql, [...params, limit, offset]),
        this.db.query(countSql, params),
      ]);

      const total = countRes[0]?.total || 0;

      return {
        status: true,
        data: rows.map((r: any) => ({
          ...r,
          quantity: Number(r.quantity || 0),
        })),
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
      const { container_id, name, quantity, is_returnable = true, status = 'active' } = body;
      if (!name || !quantity) {
        throw new BadRequestException('Container name and quantity are required');
      }

      const generatedId = container_id || `CONT-${Math.floor(1000 + Math.random() * 9000)}`;

      const checkExisting = await this.db.query(
        `SELECT id FROM containers WHERE container_id = ? AND deleted_at IS NULL`,
        [generatedId]
      );
      if (checkExisting?.length > 0) {
        throw new BadRequestException(`Container ID '${generatedId}' already exists`);
      }

      const insertRes = await this.db.query(
        `INSERT INTO containers (container_id, name, quantity, is_returnable, status)
         VALUES (?, ?, ?, ?, ?)
         RETURNING *`,
        [generatedId, name, Math.abs(Number(quantity || 0)), Boolean(is_returnable), status]
      );

      return {
        status: true,
        message: 'Container created successfully',
        data: insertRes[0],
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('ContainersService.createContainer error', { error });
      throw new InternalServerErrorException('Failed to create container');
    }
  }

  async updateContainer(id: string, body: any) {
    try {
      const { name, quantity, is_returnable, status } = body;

      const checkRes = await this.db.query(
        `SELECT * FROM containers WHERE (container_id = ? OR id::text = ?) AND deleted_at IS NULL`,
        [id, id]
      );
      if (!checkRes?.length) {
        throw new NotFoundException('Container not found');
      }

      const target = checkRes[0];

      const updatedName = name ?? target.name;
      const updatedQty = quantity !== undefined ? Math.abs(Number(quantity)) : Number(target.quantity);
      const updatedReturnable = is_returnable !== undefined ? Boolean(is_returnable) : target.is_returnable;
      const updatedStatus = status ?? target.status;

      const updateRes = await this.db.query(
        `UPDATE containers 
         SET name = ?, quantity = ?, is_returnable = ?, status = ?, updated_at = NOW()
         WHERE id = ?
         RETURNING *`,
        [updatedName, updatedQty, updatedReturnable, updatedStatus, target.id]
      );

      return {
        status: true,
        message: 'Container updated successfully',
        data: updateRes[0],
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) throw error;
      this.developer.error('ContainersService.updateContainer error', { error });
      throw new InternalServerErrorException('Failed to update container');
    }
  }

  async getContainersDropdown() {
    try {
      const rows = await this.db.query(
        `SELECT container_id, name, quantity, is_returnable 
         FROM containers 
         WHERE status = 'active' AND deleted_at IS NULL
         ORDER BY name ASC`
      );

      const dropdownOptions = rows.map((r: any) => ({
        label: `${r.name} (${r.container_id})`,
        value: r.container_id,
        container_id: r.container_id,
        name: r.name,
        quantity: Number(r.quantity || 0),
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
