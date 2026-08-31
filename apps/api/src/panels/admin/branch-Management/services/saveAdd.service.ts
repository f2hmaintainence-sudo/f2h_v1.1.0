import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { generateId } from '../../../../helpers/RandomHelper';
import { FormHelper, FormResponse, FieldDef } from '../../../../helpers/FormHelper';
import { DataService } from '../../../../shared/database/Data.service';
import { DatabaseService } from '../../../../shared/database/Database.service';
import { DeveloperService } from '../../../../shared/logger/Developer.service';
import { CreateBranchDto } from '../dto/branch.dto';
import { IdGeneratorService } from '../../../../shared/services/idGenerator.service';
import { SectorService } from '../ModuleServices/sector.service';
import { BranchCoverageOverlapService } from './branch-coverage-overlap.service';

@Injectable()
export class BranchSaveAddService {
  constructor(
    private readonly formHelper: FormHelper,
    private readonly Data: DataService,
    private readonly db: DatabaseService,
    private readonly Developer: DeveloperService,
    private readonly idGenerator: IdGeneratorService,
    private readonly sectorService: SectorService,
    private readonly coverageOverlapService: BranchCoverageOverlapService,
  ) { }

  // ═══════════════════════════════════════════════════════════════
  // BRANCH — Save Add (Google Maps: lat/lng/radius + sector slices)
  // ═══════════════════════════════════════════════════════════════

  async saveBranch(body: CreateBranchDto, adminId: string) {
    try {
      if (!body.branch_name?.trim()) {
        throw new BadRequestException({ status: false, message: 'Branch name is required' });
      }
      if (!body.branch_code?.trim()) {
        throw new BadRequestException({ status: false, message: 'Branch code is required' });
      }

      // Unique check — branch_code
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
      const radiusKm = body.delivery_radius_km ?? 5;
      const bufferZone = body.buffer_zone ?? 0;

      return await this.Data.executeTransaction(async (tx) => {
        const branchData: Record<string, any> = {
          branch_id,
          branch_name: body.branch_name.trim(),
          branch_code: body.branch_code.trim(),
          city: body.city?.trim() || null,
          state: body.state?.trim() || null,
          is_active: isActive,
          allow_buffer_order: allowBufferOrder,
          lat: body.lat ?? null,
          lng: body.lng ?? null,
          delivery_radius_km: radiusKm,
          buffer_zone: bufferZone,
          hex_shape: body.hex_shape || 'hexagon',
        };
        const coverageConflict = await this.coverageOverlapService.findConflict(
          tx,
          {
            branch_id,
            branch_name: body.branch_name.trim(),
            lat: body.lat ?? null,
            lng: body.lng ?? null,
            delivery_radius_km: radiusKm,
            buffer_zone: bufferZone,
            allow_buffer_order: allowBufferOrder,
            is_active: isActive,
            hex_shape: body.hex_shape || 'hexagon',
          },
        );
        if (coverageConflict) {
          throw new BadRequestException({
            status: false,
            code: 'branch_coverage_overlap',
            message: `Coverage overlaps with ${coverageConflict.branch_name}. Move the map pin or reduce the radius or buffer.`,
            errors: {
              coverage: `Conflicts with ${coverageConflict.branch_name}`,
            },
          });
        }
        this.Developer.log('Branch data', { branchData });
        const branchResult = await this.Data.insert('branches', branchData, { transaction: tx });
        if (!branchResult.status) throw new Error(branchResult.message || 'Branch insert failed');

        try {
          await this.Data.insert('admin_audit_logs', {
            admin_id: adminId,
            action: 'branch_create',
            target_type: 'branches',
            target_id: branch_id,
            details: JSON.stringify({ branch_name: body.branch_name }),
          }, { transaction: tx });
        } catch (auditError) {
          this.Developer.warn('Failed to save audit log', { error: auditError.message });
        }

        return {
          status: true,
          message: 'Branch created successfully.',
          data: { branch_id },
        };
      });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.Developer.error('saveBranch error', { error });
      throw new InternalServerErrorException('Failed to create branch');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // ZONE — Save Add (legacy — kept for backward compatibility)
  // ═══════════════════════════════════════════════════════════════

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

      const userId = generateId('F2H', 9);
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
