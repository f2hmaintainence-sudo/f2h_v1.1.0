import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { FormHelper } from '../../../../helpers/FormHelper';
import { DataService } from '../../../../shared/database/Data.service';
import { DatabaseService } from '../../../../shared/database/Database.service';
import { DeveloperService } from '../../../../shared/logger/Developer.service';
import { BranchShowAddService } from './showAdd.service';
import { BranchShowEditService } from './showEdit.service';
import { SectorService } from '../ModuleServices/sector.service';
import { CreateBranchDto } from '../dto/branch.dto';


@Injectable()
export class BranchSaveEditService {
  constructor(
    private readonly formHelper: FormHelper,
    private readonly dataService: DataService,
    private readonly db: DatabaseService,
    private readonly developer: DeveloperService,
    private readonly showAddService: BranchShowAddService,
    private readonly showEditService: BranchShowEditService,
    private readonly sectorService: SectorService,
  ) { }

  // ═══════════════════════════════════════════════════════════════
  // BRANCH — Save Edit (with conditional H3 Hex Regeneration)
  // ═══════════════════════════════════════════════════════════════

  async saveBranch(
    branchId: string,
    body: Partial<CreateBranchDto>,
    adminId: string,
  ) {
    try {
      // 1. Fetch current branch data to detect geo changes
      const currentRows = await this.db.query(
        `SELECT branch_id, branch_name, branch_code, city, state, is_active, allow_buffer_order,
                lat, lng, delivery_radius_km, buffer_zone
         FROM branches WHERE branch_id = $1`,
        [branchId],
      );

      if (!currentRows?.length) {
        throw new BadRequestException({ status: false, message: 'Branch not found' });
      }

      const current = currentRows[0];

      // 2. Validate branch_code uniqueness (exclude self)
      if (body.branch_code && body.branch_code !== current.branch_code) {
        const existing = await this.dataService.query('branches', {
          select: ['branch_id'],
          where: [
            { column: 'branch_code', operator: '=', value: String(body.branch_code).trim() },
            { column: 'branch_id', operator: '!=', value: branchId },
          ],
          limit: 1,
        });
        if (existing?.data?.length) {
          throw new BadRequestException({
            status: false,
            message: 'Validation failed',
            errors: { branch_code: 'Branch code already used by another branch' },
          });
        }
      }

      // 3. Determine if geo-relevant fields changed
      const newLat = body.lat !== undefined ? body.lat : current.lat;
      const newLng = body.lng !== undefined ? body.lng : current.lng;
      const newRadiusKm = body.delivery_radius_km !== undefined
        ? body.delivery_radius_km
        : Number(current.delivery_radius_km);
      const geoChanged = (
        (newLat !== null && newLat !== undefined) &&
        (newLng !== null && newLng !== undefined) &&
        (
          String(newLat) !== String(current.lat) ||
          String(newLng) !== String(current.lng) ||
          Number(newRadiusKm) !== Number(current.delivery_radius_km)
        )
      );

      const coordinatesNowProvided = (
        newLat && newLng &&
        (!current.lat || !current.lng)
      );

      const geoUpdated = geoChanged || coordinatesNowProvided;

      // 4. Build simple fields update
      const updateData: Record<string, any> = {};
      if (body.branch_name !== undefined) updateData.branch_name = body.branch_name.trim();
      if (body.branch_code !== undefined) updateData.branch_code = body.branch_code.trim();
      if (body.city !== undefined) updateData.city = body.city?.trim() || null;
      if (body.state !== undefined) updateData.state = body.state?.trim() || null;
      if (body.is_active !== undefined) {
        updateData.is_active = body.is_active === true || String(body.is_active) === 'true';
      }
      if (body.allow_buffer_order !== undefined) {
        updateData.allow_buffer_order = body.allow_buffer_order === true || String(body.allow_buffer_order) === 'true';
      }
      if (body.buffer_zone !== undefined) {
        updateData.buffer_zone = body.buffer_zone;
      }
      if (geoUpdated) {
        updateData.lat = newLat;
        updateData.lng = newLng;
        updateData.delivery_radius_km = newRadiusKm;
      }

      // 5. Update the branches table
      updateData.updated_at = new Date().toISOString();

      if (Object.keys(updateData).length > 1) { // > 1 because updated_at is always there
        await this.db.query(
          `UPDATE branches SET ${Object.keys(updateData).map((k, i) => `"${k}" = $${i + 1}`).join(', ')} WHERE branch_id = $${Object.keys(updateData).length + 1}`,
          [...Object.values(updateData), branchId],
        );
      }

      // 6. Audit log (non-fatal)
      try {
        await this.dataService.insert('admin_audit_logs', {
          admin_id: adminId,
          action: 'branch_update',
          target_type: 'branches',
          target_id: branchId,
          details: JSON.stringify({
            changes: Object.keys(updateData),
            geo_updated: geoUpdated,
          }),
        });
      } catch (auditError) {
        this.developer.warn('Audit log failed on branch edit', { error: auditError.message });
      }

      return { status: true, message: 'Branch updated successfully.' };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('saveBranch edit error', { error, branchId });
      throw new InternalServerErrorException('Failed to update branch');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // ZONE — Save Edit
  // ═══════════════════════════════════════════════════════════════

  async saveZoneEdit(id: string, body: any, adminId: string) {
    try {
      // 1. Validate zone fields
      const fields: any[] = [
        {
          name: 'name',
          label: 'Zone Name',
          type: 'text',
          required: true,
          width: 'half',
          placeholder: 'e.g. KR Puram',
          validation: { minLength: 2, maxLength: 100 },
        },
        {
          name: 'description',
          label: 'Description',
          type: 'textarea',
          required: false,
          width: 'full',
          placeholder: 'Brief description of the zone area',
          validation: { maxLength: 500 },
        },
        {
          name: 'is_active',
          label: 'Is Active',
          type: 'toggle',
          required: false,
          width: 'half',
          defaultValue: true,
        },
      ];
      const validation = this.formHelper.validateFields(fields, body);
      if (!validation.valid) {
        throw new BadRequestException({
          status: false,
          message: 'Validation failed',
          errors: validation.errors,
        });
      }

      // 2. Build update data
      const updateData: Record<string, any> = {};
      if (body.name !== undefined) updateData.name = body.name.trim();
      if (body.description !== undefined)
        updateData.description = body.description?.trim() || null;
      if (body.is_active !== undefined)
        updateData.is_active =
          body.is_active === true || String(body.is_active) === 'true';
      if (body.center_lat !== undefined)
        updateData.center_lat = body.center_lat;
      if (body.center_lng !== undefined)
        updateData.center_lng = body.center_lng;
      if (body.h3_resolution !== undefined)
        updateData.h3_resolution = body.h3_resolution;

      if (
        Object.keys(updateData).length === 0 &&
        (!body.h3_indexes || body.h3_indexes.length === 0)
      ) {
        throw new BadRequestException('No valid fields to update');
      }

      // 3. Update zones record
      if (Object.keys(updateData).length > 0) {
        updateData.updated_at = new Date().toISOString();
        await this.dataService.query('zones', {
          update: updateData,
          where: [{ column: 'id', operator: '=', value: id }],
        });
      }

      // 4. Update hexagons if provided
      if (body.h3_indexes && body.h3_indexes.length > 0) {
        // Check for conflicts (exclude self)
        const h3Indexes: string[] = body.h3_indexes;
        const placeholders = h3Indexes.map((_, i) => `$${i + 1}`).join(', ');
        const conflictResult = await this.db.query(
          `SELECT zh.h3_index, z.name AS zone_name 
           FROM zone_hexagons zh 
           JOIN zones z ON z.id = zh.zone_id 
           WHERE zh.h3_index IN (${placeholders}) AND zh.zone_id != $${h3Indexes.length + 1}`,
          [...h3Indexes, id],
        );
        if (conflictResult?.length > 0) {
          const conflictNames = [
            ...new Set(conflictResult.map((r: any) => r.zone_name)),
          ];
          throw new BadRequestException({
            status: false,
            message: `${conflictResult.length} hexagon(s) already claimed by: ${conflictNames.join(', ')}`,
          });
        }

        // Delete old hexagons and insert new ones
        await this.db.query(`DELETE FROM zone_hexagons WHERE zone_id = $1`, [
          id,
        ]);
        for (const h3Index of h3Indexes) {
          await this.dataService.insert('zone_hexagons', {
            zone_id: id,
            h3_index: h3Index,
            h3_resolution: body.h3_resolution || 9,
          });
        }
      }

      // 5. Audit log
      await this.dataService.insert('admin_audit_logs', {
        admin_id: adminId,
        action: 'zone_update',
        target_type: 'zones',
        target_id: id,
        details: JSON.stringify({ changes: Object.keys(updateData) }),
      });

      return {
        status: true,
        message: 'Zone updated successfully',
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      )
        throw error;
      this.developer.error('saveZoneEdit error', { error, id });
      throw new InternalServerErrorException('Failed to update zone');
    }
  }
}

@Injectable()
export class StaffsSaveEditService {
  constructor(
    private readonly Data: DataService,
    private readonly Developer: DeveloperService,
  ) {}

  async saveStaffEdit(id: string, body: any, adminId: string) {
    try {
      const currentRows = await this.Data.query('management_staff', {
        select: ['management_staff.*', 'users.email'],
        joins: [
          {
            type: 'LEFT',
            table: 'users',
            on: [['users.user_id', 'management_staff.user_id']],
          },
        ],
        where: [{ column: 'management_staff.management_id', operator: '=', value: id }],
        limit: 1,
      });

      if (!currentRows?.data?.length) {
        throw new BadRequestException('Staff member not found');
      }

      const current = currentRows.data[0];
      const userId = current.user_id;

      if (body.email && body.email.toLowerCase().trim() !== current.email?.toLowerCase().trim()) {
        const emailCheck = await this.Data.query('users', {
          select: ['user_id'],
          where: [
            { column: 'email', operator: '=', value: body.email.toLowerCase().trim() },
            { column: 'user_id', operator: '!=', value: userId },
          ],
          limit: 1,
        });
        if (emailCheck?.data?.length) {
          throw new BadRequestException('Email address is already in use by another user');
        }
      }

      if (body.phone && body.phone.trim() !== current.phone?.trim()) {
        const phoneCheck = await this.Data.query('users', {
          select: ['user_id'],
          where: [
            { column: 'phone', operator: '=', value: body.phone.trim() },
            { column: 'user_id', operator: '!=', value: userId },
          ],
          limit: 1,
        });
        if (phoneCheck?.data?.length) {
          throw new BadRequestException('Phone number is already in use by another user');
        }
      }

      const now = new Date().toISOString();

      await this.Data.executeTransaction(async (tx) => {
        const userUpdate: Record<string, any> = {
          updated_at: now,
        };
        if (body.email) userUpdate.email = body.email.toLowerCase().trim();
        if (body.phone) userUpdate.phone = body.phone.trim();
        if (body.user_name) userUpdate.user_name = body.user_name.trim();
        if (body.role_id) userUpdate.role_id = body.role_id;

        await this.Data.update('users', userUpdate, [{ column: 'user_id', operator: '=', value: userId }], { transaction: tx });

        if (body.role_id && body.role_id !== current.role_id) {
          await this.Data.update('role_assignments', {
            is_active: 0,
            updated_at: now,
          }, [{ column: 'user_id', operator: '=', value: userId }], { transaction: tx });

          await this.Data.insert('role_assignments', {
            id: Date.now() + Math.floor(Math.random() * 1000),
            user_id: userId,
            role_id: body.role_id,
            is_active: 1,
            created_at: now,
            updated_at: now,
          }, { transaction: tx });
        }

        const staffUpdate: Record<string, any> = {
          updated_at: now,
        };
        if (body.user_name) staffUpdate.user_name = body.user_name.trim();
        if (body.phone) staffUpdate.phone = body.phone.trim();
        if (body.role_id) staffUpdate.role_id = body.role_id;
        staffUpdate.branch_id = body.branch_id || null;
        staffUpdate.department = body.department ? body.department.trim() : null;
        staffUpdate.designation = body.designation ? body.designation.trim() : null;
        if (body.is_active !== undefined) {
          staffUpdate.is_active = body.is_active === true || String(body.is_active) === 'true';
        }

        await this.Data.update('management_staff', staffUpdate, [{ column: 'management_id', operator: '=', value: id }], { transaction: tx });
      });

      try {
        await this.Data.insert('admin_audit_logs', {
          admin_id: adminId,
          action: 'staff_update',
          target_type: 'management_staff',
          target_id: id,
          details: JSON.stringify({
            username: body.user_name,
            role_id: body.role_id,
            branch_id: body.branch_id || null,
          }),
        });
      } catch (auditError) {
        this.Developer.warn('Audit log failed on staff update', { error: auditError.message });
      }

      return {
        status: true,
        message: 'Staff member updated successfully',
      };

    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.Developer.error('saveStaffEdit error', { error, id });
      throw new InternalServerErrorException('Failed to update staff member');
    }
  }
}
