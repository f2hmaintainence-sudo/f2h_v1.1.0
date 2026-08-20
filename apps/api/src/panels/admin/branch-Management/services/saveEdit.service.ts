import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { FormHelper } from '../../../../helpers/FormHelper';
import { DataService } from '../../../../shared/database/Data.service';
import { DeveloperService } from '../../../../shared/logger/Developer.service';
import { BranchShowAddService } from './showAdd.service';
import { BranchShowEditService } from './showEdit.service';
import { SectorService } from '../ModuleServices/sector.service';
import { UpdateBranchDto } from '../dto/branch.dto';
import {
  BranchCoverageOverlapService,
  BranchCoverageTransaction,
} from './branch-coverage-overlap.service';

const BRANCH_COVERAGE_SHAPES = new Set(['hexagon', 'circle', 'square', 'rectangle']);
const BRANCH_COVERAGE_FIELDS: ReadonlyArray<keyof UpdateBranchDto> = [
  'lat',
  'lng',
  'delivery_radius_km',
  'buffer_zone',
  'allow_buffer_order',
  'is_active',
  'hex_shape',
];

interface CurrentBranchRow {
  branch_id: string;
  branch_name: string;
  branch_code: string;
  city: string | null;
  state: string | null;
  is_active: boolean | string;
  allow_buffer_order: boolean | string;
  lat: number | string | null;
  lng: number | string | null;
  delivery_radius_km: number | string;
  buffer_zone: number | string | null;
  hex_shape: string | null;
}

@Injectable()
export class BranchSaveEditService {
  constructor(
    private readonly formHelper: FormHelper,
    private readonly dataService: DataService,
    private readonly developer: DeveloperService,
    private readonly showAddService: BranchShowAddService,
    private readonly showEditService: BranchShowEditService,
    private readonly sectorService: SectorService,
    private readonly coverageOverlapService: BranchCoverageOverlapService,
  ) { }

  // ═══════════════════════════════════════════════════════════════
  // BRANCH — Save Edit (with conditional H3 Hex Regeneration)
  // ═══════════════════════════════════════════════════════════════

  async saveBranch(
    branchId: string,
    body: UpdateBranchDto,
    adminId: string,
  ) {
    try {
      const coverageFieldRequested = BRANCH_COVERAGE_FIELDS.some((field) =>
        Object.prototype.hasOwnProperty.call(body, field),
      );

      const updateResult = await this.dataService.executeTransaction(
        async (tx: BranchCoverageTransaction) => {
          if (coverageFieldRequested) {
            await this.coverageOverlapService.lockCoverageChanges(tx);
          }

          const [currentRows] = await tx.query<CurrentBranchRow>(
            `SELECT branch_id, branch_name, branch_code, city, state, is_active, allow_buffer_order,
                    lat, lng, delivery_radius_km, buffer_zone, hex_shape
               FROM branches
              WHERE branch_id = $1`,
            [branchId],
          );
          if (!currentRows.length) {
            throw new BadRequestException({
              status: false,
              message: 'Branch not found',
            });
          }

          const current = currentRows[0];
          if (body.branch_code && body.branch_code !== current.branch_code) {
            const [existingBranches] = await tx.query<{ branch_id: string }>(
              `SELECT branch_id
                 FROM branches
                WHERE branch_code = $1
                  AND branch_id <> $2
                  AND deleted_at IS NULL
                LIMIT 1`,
              [body.branch_code.trim(), branchId],
            );
            if (existingBranches.length) {
              throw new BadRequestException({
                status: false,
                message: 'Validation failed',
                errors: {
                  branch_code: 'Branch code already used by another branch',
                },
              });
            }
          }

          const newLat = body.lat !== undefined ? body.lat : current.lat;
          const newLng = body.lng !== undefined ? body.lng : current.lng;
          const newRadiusKm =
            body.delivery_radius_km !== undefined
              ? body.delivery_radius_km
              : Number(current.delivery_radius_km);
          const newBufferZone =
            body.buffer_zone !== undefined
              ? body.buffer_zone
              : Number(current.buffer_zone || 0);
          const currentAllowBufferOrder =
            current.allow_buffer_order === true ||
            String(current.allow_buffer_order) === 'true';
          const newAllowBufferOrder =
            body.allow_buffer_order !== undefined
              ? body.allow_buffer_order === true ||
                String(body.allow_buffer_order) === 'true'
              : currentAllowBufferOrder;
          const currentIsActive =
            current.is_active === true || String(current.is_active) === 'true';
          const newIsActive =
            body.is_active !== undefined
              ? body.is_active === true || String(body.is_active) === 'true'
              : currentIsActive;
          const newShape = body.hex_shape ?? current.hex_shape ?? 'hexagon';
          const geoUpdated =
            (body.lat !== undefined && String(newLat) !== String(current.lat)) ||
            (body.lng !== undefined && String(newLng) !== String(current.lng)) ||
            (body.delivery_radius_km !== undefined &&
              Number(newRadiusKm) !== Number(current.delivery_radius_km));
          const coverageChanged =
            geoUpdated ||
            (body.buffer_zone !== undefined &&
              Number(newBufferZone) !== Number(current.buffer_zone || 0)) ||
            (body.allow_buffer_order !== undefined &&
              newAllowBufferOrder !== currentAllowBufferOrder) ||
            (body.is_active !== undefined && newIsActive !== currentIsActive) ||
            (body.hex_shape !== undefined &&
              newShape !== (current.hex_shape ?? 'hexagon'));

          const updateData: Record<string, unknown> = {};
          if (body.branch_name !== undefined)
            updateData.branch_name = body.branch_name.trim();
          if (body.branch_code !== undefined)
            updateData.branch_code = body.branch_code.trim();
          if (body.city !== undefined)
            updateData.city = body.city?.trim() || null;
          if (body.state !== undefined)
            updateData.state = body.state?.trim() || null;
          if (body.is_active !== undefined)
            updateData.is_active = newIsActive;
          if (body.allow_buffer_order !== undefined)
            updateData.allow_buffer_order = newAllowBufferOrder;
          if (body.buffer_zone !== undefined)
            updateData.buffer_zone = body.buffer_zone;
          if (body.hex_shape !== undefined) {
            if (!BRANCH_COVERAGE_SHAPES.has(body.hex_shape)) {
              throw new BadRequestException({
                status: false,
                message: 'Invalid branch coverage shape',
              });
            }
            updateData.hex_shape = body.hex_shape;
          }
          if (body.lat !== undefined) updateData.lat = body.lat;
          if (body.lng !== undefined) updateData.lng = body.lng;
          if (body.delivery_radius_km !== undefined)
            updateData.delivery_radius_km = body.delivery_radius_km;

          updateData.updated_at = new Date().toISOString();
          if (Object.keys(updateData).length > 1) {
            if (coverageChanged) {
              const coverageConflict =
                await this.coverageOverlapService.findConflict(
                  tx,
                  {
                    branch_id: branchId,
                    branch_name:
                      body.branch_name?.trim() || current.branch_name,
                    lat: newLat,
                    lng: newLng,
                    delivery_radius_km: newRadiusKm,
                    buffer_zone: newBufferZone,
                    allow_buffer_order: newAllowBufferOrder,
                    is_active: newIsActive,
                    hex_shape: newShape,
                  },
                  branchId,
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
            }

            const updateSql = `UPDATE branches SET ${Object.keys(updateData)
              .map((key, index) => `"${key}" = $${index + 1}`)
              .join(', ')} WHERE branch_id = $${Object.keys(updateData).length + 1}`;
            await tx.query(updateSql, [...Object.values(updateData), branchId]);
          }

          return {
            changes: Object.keys(updateData),
            geoUpdated,
            coverageChanged,
          };
        },
      );

      // 6. Audit log (non-fatal)
      try {
        await this.dataService.insert('admin_audit_logs', {
          admin_id: adminId,
          action: 'branch_update',
          target_type: 'branches',
          target_id: branchId,
          details: JSON.stringify({
            changes: updateResult.changes,
            geo_updated: updateResult.geoUpdated,
            coverage_updated: updateResult.coverageChanged,
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
