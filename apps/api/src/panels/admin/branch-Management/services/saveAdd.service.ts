import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { FormHelper, FormResponse, FieldDef } from '../../../../helpers/FormHelper';
import { DataService } from '../../../../shared/database/Data.service';
import { DatabaseService } from '../../../../shared/database/Database.service';
import { DeveloperService } from '../../../../shared/logger/Developer.service';
import { CreateBranchDto } from '../dto/branch.dto';
import { IdGeneratorService } from '../../../../shared/services/idGenerator.service';
import { SectorService } from '../ModuleServices/sector.service';
import { H3_RESOLUTION } from '../constants/h3.constants';

@Injectable()
export class BranchSaveAddService {
  constructor(
    private readonly formHelper: FormHelper,
    private readonly Data: DataService,
    private readonly db: DatabaseService,
    private readonly Developer: DeveloperService,
    private readonly idGenerator: IdGeneratorService,
    private readonly sectorService: SectorService,
  ) { }

  // ═══════════════════════════════════════════════════════════════
  // BRANCH — Save Add (with H3 Hex Disk Generation)
  // ═══════════════════════════════════════════════════════════════

  async saveBranch(body: CreateBranchDto, adminId: string) {
    try {
      // 1. Validate required fields
      if (!body.branch_name?.trim()) {
        throw new BadRequestException({ status: false, message: 'Branch name is required' });
      }
      if (!body.branch_code?.trim()) {
        throw new BadRequestException({ status: false, message: 'Branch code is required' });
      }

      // 2. Unique check — branch_code
      const existing = await this.Data.query('branches', {
        select: ['id'],
        where: [{ column: 'branch_code', operator: '=', value: String(body.branch_code).trim() }],
        limit: 1,
      });
      if (existing?.data?.length) {
        throw new BadRequestException({
          status: false,
          message: 'Branch code already exists',
          errors: { branch_code: 'This branch code is already in use' },
        });
      }
      const branch_id = this.idGenerator.generateId('BRANCH', 12);
      const isActive = body.is_active === true || String(body.is_active) === 'true';
      const allowBufferOrder = body.allow_buffer_order === true || String(body.allow_buffer_order) === 'true';
      const resolution = body.h3_resolution || H3_RESOLUTION;
      const sectorCount = body.sector_count || 3;
      const radiusKm = body.delivery_radius_km || 5;
      const bufferZone = body.buffer_zone || 0;
      const hexShape = ['hexagon', 'circle', 'square'].includes(String(body.hex_shape)) ? String(body.hex_shape) : 'hexagon';

      // 3. If lat/lng provided, generate H3 hex disk
      let hexCount = 0;
      let centerHex: string | null = null;
      let hexes: { hex_id: string; sector_index: number }[] = [];

      if (body.lat && body.lng) {
        centerHex = this.sectorService.getCenterHex(body.lat, body.lng, resolution);
        hexes = this.sectorService.generateHexDisk(body.lat, body.lng, radiusKm, sectorCount, resolution);
        hexCount = hexes.length;

        // 4. Overlap check
        const overlap = await this.sectorService.checkOverlap(hexes.map(h => h.hex_id));
        if (overlap) {
          throw new BadRequestException({
            status: false,
            message: `Branch zone overlaps with "${overlap.branchName}". ${overlap.conflicting} hex(es) conflict. Reduce the radius or move the warehouse pin.`,
          });
        }
      }

      // 5. Transaction: Insert branch + hexes + sectors
      return await this.Data.executeTransaction(async (tx) => {
        // Insert branch
        const branchData: Record<string, any> = {
          branch_id,
          branch_name: body.branch_name.trim(),
          branch_code: body.branch_code.trim(),
          city: body.city?.trim() || null,
          state: body.state?.trim() || null,
          is_active: isActive,
          allow_buffer_order: allowBufferOrder,
          lat: body.lat || null,
          lng: body.lng || null,
          delivery_radius_km: radiusKm,
          buffer_zone: bufferZone,
          center_hex: centerHex,
          sector_count: sectorCount,
          h3_resolution: resolution,
          hex_shape: hexShape,
        };
        this.Developer.log('Branch data', { branchData });
        const branchResult = await this.Data.insert('branches', branchData, { transaction: tx });
        if (!branchResult.status) throw new Error(branchResult.message || 'Branch insert failed');

        // Insert hexes (if coordinates provided)
        if (hexes.length > 0) {
          await this.sectorService.bulkInsertHexes(branch_id, hexes, tx);
        }

        // Create sector rows
        if (body.lat && body.lng) {
          await this.sectorService.createSectors(branch_id, sectorCount, tx);
        }

        // Audit log (Wrap in try-catch to prevent transaction abort on non-critical failure)
        try {
          await this.Data.insert('admin_audit_logs', {
            admin_id: adminId,
            action: 'branch_create',
            target_type: 'branches',
            target_id: branch_id,
            details: JSON.stringify({
              branch_name: body.branch_name,
              hex_count: hexCount,
              sector_count: sectorCount,
            }),
          }, { transaction: tx });
        } catch (auditError) {
          this.Developer.warn('Failed to save audit log, but continuing branch creation', { error: auditError.message });
        }

        return {
          status: true,
          message: `Branch created successfully. ${hexCount} hexes generated across ${sectorCount} sectors.`,
          data: { branch_id, hex_count: hexCount, sector_count: sectorCount },
        };
      });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      if (error?.code === '23505' && error?.constraint === 'idx_bzh_hex_id') {
        throw new BadRequestException({
          status: false,
          message: 'Branch zone overlaps with existing branch coverage. Reduce the radius or move the warehouse pin.',
        });
      }
      this.Developer.error('saveBranch error', { error });
      throw new InternalServerErrorException('Failed to create branch');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // ZONE — Save Add (legacy — kept for backward compatibility)
  // ═══════════════════════════════════════════════════════════════

  async saveZone(body: any, adminId: string) {
    try {
      // Validate
      if (!body.name?.trim()) {
        throw new BadRequestException({ status: false, message: 'Zone name is required' });
      }
      if (!body.branch_id) {
        throw new BadRequestException({ status: false, message: 'Branch ID is required' });
      }

      const h3Indexes: string[] = body.h3_indexes || [];
      if (h3Indexes.length === 0) {
        throw new BadRequestException({ status: false, message: 'At least one hexagon must be selected' });
      }

      // Conflict check
      const placeholders = h3Indexes.map((_, i) => `$${i + 1}`).join(', ');
      const conflictResult = await this.db.query(
        `SELECT zh.h3_index, z.name AS zone_name
         FROM zone_hexagons zh
         JOIN zones z ON z.id = zh.zone_id
         WHERE zh.h3_index IN (${placeholders})`,
        h3Indexes,
      );
      if (conflictResult?.length > 0) {
        const conflictNames = [...new Set(conflictResult.map((r: any) => r.zone_name))];
        throw new BadRequestException({
          status: false,
          message: `${conflictResult.length} hexagon(s) already claimed by: ${conflictNames.join(', ')}`,
        });
      }

      const { randomUUID } = require('crypto');
      const zoneId = randomUUID();
      const insertData: Record<string, any> = {
        id: zoneId,
        name: body.name.trim(),
        description: body.description?.trim() || null,
        branch_id: body.branch_id,
        center_lat: body.center_lat || 0,
        center_lng: body.center_lng || 0,
        h3_resolution: body.h3_resolution || 9,
        is_active: body.is_active === true || String(body.is_active) === 'true',
      };

      const result = await this.Data.insert('zones', insertData);
      if (!result.status) throw new InternalServerErrorException(result.message || 'Failed to insert zone');

      for (const h3Index of h3Indexes) {
        await this.Data.insert('zone_hexagons', {
          zone_id: zoneId,
          h3_index: h3Index,
          h3_resolution: body.h3_resolution || 9,
        });
      }

      await this.Data.insert('admin_audit_logs', {
        admin_id: adminId,
        action: 'zone_create',
        target_type: 'zones',
        target_id: zoneId,
        details: JSON.stringify({ name: body.name, hexagon_count: h3Indexes.length }),
      });

      return {
        status: true,
        message: 'Zone created successfully',
        data: { zone_id: zoneId },
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.Developer.error('saveZone error', { error });
      throw new InternalServerErrorException('Failed to create zone');
    }
  }
}

@Injectable()
export class StaffsSaveAddService {
  constructor(
    private readonly Data: DataService,
    private readonly Developer: DeveloperService,
    private readonly idGenerator: IdGeneratorService,
  ) {}

  async saveStaff(body: any, adminId: string) {
    try {
      if (!body.user_name || !body.email || !body.phone || !body.password || !body.role_id) {
        throw new BadRequestException('Required fields: username, email, phone, password, role_id');
      }

      const emailCheck = await this.Data.query('users', {
        select: ['user_id'],
        where: [{ column: 'email', operator: '=', value: body.email.toLowerCase().trim() }],
        limit: 1,
      });
      if (emailCheck?.data?.length) {
        throw new BadRequestException('Email address is already registered');
      }

      const phoneCheck = await this.Data.query('users', {
        select: ['user_id'],
        where: [{ column: 'phone', operator: '=', value: body.phone.trim() }],
        limit: 1,
      });
      if (phoneCheck?.data?.length) {
        throw new BadRequestException('Phone number is already registered');
      }

      const userId = this.idGenerator.generateId('USR', 12);
      const managementId = this.idGenerator.generateId('MNG', 12);

      const bcrypt = require('bcrypt');
      const hashedPassword = bcrypt.hashSync(body.password, 12);

      const now = new Date().toISOString();

      const result = await this.Data.executeTransaction(async (tx) => {
        await this.Data.insert('users', {
          user_id: userId,
          email: body.email.toLowerCase().trim(),
          phone: body.phone.trim(),
          user_name: body.user_name.trim(),
          password: hashedPassword,
          role_id: body.role_id,
          created_at: now,
          updated_at: now,
        }, { transaction: tx });

        await this.Data.insert('role_assignments', {
          id: Date.now() + Math.floor(Math.random() * 1000),
          user_id: userId,
          role_id: body.role_id,
          is_active: 1,
          created_at: now,
          updated_at: now,
        }, { transaction: tx });

        const maxIdResult = await tx.query('SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM management_staff');
        const nextId = maxIdResult[0]?.next_id || maxIdResult.rows?.[0]?.next_id || 1;

        await this.Data.insert('management_staff', {
          id: nextId,
          management_id: managementId,
          user_id: userId,
          branch_id: body.branch_id || null,
          role_id: body.role_id,
          user_name: body.user_name.trim(),
          department: body.department ? body.department.trim() : null,
          designation: body.designation ? body.designation.trim() : null,
          is_active: body.is_active === true || String(body.is_active) === 'true',
          phone: body.phone.trim(),
          created_at: now,
          updated_at: now,
        }, { transaction: tx });

        return managementId;
      });

      try {
        await this.Data.insert('admin_audit_logs', {
          admin_id: adminId,
          action: 'staff_create',
          target_type: 'management_staff',
          target_id: managementId,
          details: JSON.stringify({
            username: body.user_name,
            role_id: body.role_id,
            branch_id: body.branch_id || null,
          }),
        });
      } catch (auditError) {
        this.Developer.warn('Audit log failed on staff create', { error: auditError.message });
      }

      return {
        status: true,
        message: 'Staff member created successfully',
        data: { management_id: result },
      };

    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.Developer.error('saveStaff error', { error });
      throw new InternalServerErrorException('Failed to create staff member');
    }
  }
}