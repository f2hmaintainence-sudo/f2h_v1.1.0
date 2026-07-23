import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,

} from '@nestjs/common';
import { generateId } from 'src/helpers/RandomHelper';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { DataService } from 'src/shared/database/Data.service';
import { DeveloperService } from 'src/shared/logger/Developer.service';
import { AuthService } from './auth.service';
const h3 = require('h3-js');
const COORDINATE_EPSILON = 0.0000001;

@Controller('customer')
export class CustomerBootstrapController {
  constructor(private readonly Data: DataService,
    private readonly Developer: DeveloperService,
    private readonly authService: AuthService
  ) { }

  private normalizeAddress(addr: any) {
    if (!addr) return addr;
    return {
      ...addr,
      is_default: (addr.is_default === true || addr.is_default === 'true' || addr.is_default === 1 || addr.is_default === '1') ? true : false,
      status: (addr.status === false || addr.status === 'false' || addr.status === '0') ? false : true
    };
  }

  @Get('bootstrap')
  @UseGuards(AuthGuard('jwt'))
  async bootstrap(@Req() req: Request) {
    const user = req.user as any;
    const userId = user?.user_id;
    const email = user?.email;
    const profile = await this.resolveCustomer(userId, email);
    const customerId = profile?.customer_id || userId;

    const addressesResult = await this.Data.query('customer_addresses', {
      where: [
        { column: 'customer_id', operator: '=', value: customerId },
        { column: 'status', operator: '=', value: true },
      ],
    });
    const subscriptionSummary = await this.getSubscriptionSummary(customerId);

    const branchesResult = await this.Data.query('branches', {
      where: [{ column: 'is_active', operator: '=', value: true }],
    });

    return {
      profile,
      addresses: (addressesResult?.data || []).map((addr: any) => this.normalizeAddress(addr)),
      wallet: {
        balance: Number(profile?.wallet_balance || 0),
      },
      subscription_summary: subscriptionSummary,
      notifications_count: 0,
      branches: branchesResult?.data || [],
    };
  }

  private async resolveCustomer(userId: string, email?: string) {
    let customerResult = await this.Data.query('customers', {
      where: [{ column: 'customer_id', operator: '=', value: userId }],
      limit: 1,
    });
    const customer = customerResult?.data?.[0]
    return customer;
  }

  private async getSubscriptionSummary(customerId: string) {
    try {
      const result = await this.Data.query('subscriptions', {
        where: [{ column: 'customer_id', operator: '=', value: customerId }],
      });
      const subscriptions = result?.data || [];
      const activeCount = subscriptions.filter(
        (item: any) => item.status === 'active' || item.is_active === true,
      ).length;

      return {
        total: subscriptions.length,
        active: activeCount,
      };
    } catch (_) {
      return {};
    }
  }

  private getDistanceKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private async assignBranchAndH3(
    latitude: number | null,
    longitude: number | null,
  ): Promise<{ branch_id: string | null; h3_index: string | null }> {
    if (latitude === null || longitude === null) {
      return { branch_id: null, h3_index: null };
    }

    const branchesResult = await this.Data.query('branches', {
      where: [{ column: 'is_active', operator: '=', value: true }],
    });
    const branches = branchesResult?.data || [];

    let nearestBranch: any = null;
    let minDistance = Infinity;

    for (const branch of branches) {
      if (!branch.lat || !branch.lng) continue;
      const branchLat = Number(branch.lat);
      const branchLng = Number(branch.lng);

      const distance = this.getDistanceKm(
        branchLat,
        branchLng,
        latitude,
        longitude,
      );

      const deliveryRadius = Number(branch.delivery_radius_km || 5);
      const bufferZone = Number(branch.buffer_zone || 0);
      const allowBuffer = branch.allow_buffer_order === true;

      let isEligible = false;
      if (distance <= deliveryRadius) {
        isEligible = true;
      } else if (allowBuffer && distance <= deliveryRadius + bufferZone) {
        isEligible = true;
      }

      if (isEligible && distance < minDistance) {
        minDistance = distance;
        nearestBranch = branch;
      }
    }

    if (!nearestBranch) {
      throw new BadRequestException(
        'Currently this location is outside our delivery area.',
      );
    }

    const h3Index = h3.latLngToCell(latitude, longitude, 9);

    return {
      branch_id: nearestBranch.branch_id,
      h3_index: h3Index,
    };
  }



  private hasValue(value: any): boolean {
    return value !== undefined && value !== null && String(value).trim() !== '';
  }

  private toNullableNumber(value: any, fieldName: string): number | null {
    if (!this.hasValue(value)) {
      return null;
    }

    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) {
      throw new BadRequestException(`Invalid ${fieldName}`);
    }

    return numberValue;
  }

  private getCoordinate(
    body: any,
    existing: any | null,
    longKey: 'latitude' | 'longitude',
    shortKey: 'lat' | 'lng',
  ): number | null {
    if (this.hasValue(body?.[shortKey])) {
      return this.toNullableNumber(body[shortKey], longKey);
    }
    if (this.hasValue(body?.[longKey])) {
      return this.toNullableNumber(body[longKey], longKey);
    }

    return this.toNullableNumber(existing?.[longKey], longKey);
  }

  private buildAddressLine(addressData: any): string {
    const addressParts = [
      addressData.flat_no,
      addressData.floor_no ? `Floor ${addressData.floor_no}` : null,
      addressData.building_name,
      addressData.street,
      addressData.area,
      addressData.city,
      addressData.state,
    ].filter(Boolean);

    return addressParts.join(', ');
  }

  private buildAddressData(
    body: any,
    customerId: string,
    existing: any | null = null,
  ) {
    const rawDefault = body?.is_default !== undefined ? body.is_default : existing?.is_default;
    const defaultValue = (rawDefault === true || rawDefault === true || rawDefault === 'true' || rawDefault === 1 || rawDefault === '1') ? true : false;
    const addressData = {
      address_id: generateId('ADDR', 10),
      customer_id: customerId,
      address_type: String(
        body?.address_type !== undefined
          ? body.address_type
          : (existing?.address_type ?? 'home'),
      )
        .toLowerCase()
        .trim(),
      contact_name: String(
        body?.contact_name !== undefined
          ? body.contact_name
          : (existing?.contact_name ?? ''),
      ).trim(),
      contact_mobile: String(
        body?.contact_mobile !== undefined
          ? body.contact_mobile
          : (existing?.contact_mobile ?? ''),
      ).trim(),
      flat_no: String(
        body?.flat_no !== undefined ? body.flat_no : (existing?.flat_no ?? ''),
      ).trim(),
      floor_no: String(
        body?.floor_no !== undefined
          ? body.floor_no
          : (existing?.floor_no ?? ''),
      ).trim(),
      building_name: String(
        body?.building_name !== undefined
          ? body.building_name
          : (existing?.building_name ?? ''),
      ).trim(),
      landmark: String(
        body?.landmark !== undefined
          ? body.landmark
          : (existing?.landmark ?? ''),
      ).trim(),
      street: String(
        body?.street !== undefined ? body.street : (existing?.street ?? ''),
      ).trim(),
      area: String(
        body?.area !== undefined ? body.area : (existing?.area ?? ''),
      ).trim(),
      city: String(
        body?.city !== undefined ? body.city : (existing?.city ?? ''),
      ).trim(),
      state: String(
        body?.state !== undefined ? body.state : (existing?.state ?? ''),
      ).trim(),
      pincode: String(
        body?.pincode !== undefined ? body.pincode : (existing?.pincode ?? ''),
      ).trim(),
      latitude: this.getCoordinate(body, existing, 'latitude', 'lat'),
      longitude: this.getCoordinate(body, existing, 'longitude', 'lng'),
      delivery_note: String(
        body?.delivery_note !== undefined
          ? body.delivery_note
          : (existing?.delivery_note ?? ''),
      ).trim(),
      is_default: defaultValue,
      status: true,
      address_line: '',
      branch_id: existing?.branch_id ?? '',
      h3_index: existing?.h3_index ?? '',
    };

    addressData.address_line = this.buildAddressLine(addressData);

    return addressData;
  }

  private coordinatesChanged(
    existing: any,
    latitude: number | null,
    longitude: number | null,
  ): boolean {
    const existingLatitude = this.toNullableNumber(
      existing?.latitude,
      'latitude',
    );
    const existingLongitude = this.toNullableNumber(
      existing?.longitude,
      'longitude',
    );

    if (
      existingLatitude === null &&
      latitude === null &&
      existingLongitude === null &&
      longitude === null
    ) {
      return false;
    }

    if (
      existingLatitude === null ||
      latitude === null ||
      existingLongitude === null ||
      longitude === null
    ) {
      return true;
    }

    return (
      Math.abs(existingLatitude - latitude) > COORDINATE_EPSILON ||
      Math.abs(existingLongitude - longitude) > COORDINATE_EPSILON
    );
  }

  private async clearDefaultAddresses(customerId: string, transaction: any) {
    await this.Data.update(
      'customer_addresses',
      { is_default: false },
      [
        { column: 'customer_id', operator: '=', value: customerId },
      ],
      { transaction },
    );
  }

  private async findCustomerAddress(customerId: string, addressId: string) {
    const addressCheck = await this.Data.query('customer_addresses', {
      where: [
        { column: 'address_id', operator: '=', value: addressId },
        { column: 'customer_id', operator: '=', value: customerId },
      ],
      limit: 1,
    });

    if (!addressCheck?.data || addressCheck.data.length === 0) {
      throw new BadRequestException('Address not found or unauthorized');
    }

    return addressCheck.data[0];
  }

  private async saveExistingAddress(
    customerId: string,
    addressId: string,
    body: any,
  ) {
    try {
      const existing = await this.findCustomerAddress(customerId, addressId);

      const addressData = this.buildAddressData(body, customerId, existing);
      
      // Always keep the same address_id
      addressData.address_id = existing.address_id;

      // If coordinates are provided, recalculate branch and H3 index
      if (addressData.latitude != null && addressData.longitude != null) {
        const locationChanged = this.coordinatesChanged(
          existing,
          addressData.latitude,
          addressData.longitude,
        );

        if (locationChanged) {
          const { branch_id, h3_index } = await this.assignBranchAndH3(
            addressData.latitude,
            addressData.longitude,
          );
          addressData.branch_id = branch_id || '';
          addressData.h3_index = h3_index || '';
        }
      }

      // Keep address_id out of the update payload to ensure it is never modified
      const { address_id, ...updatePayload } = addressData;

      await this.Data.executeTransaction(
        async (transaction) => {
          if (addressData.is_default === true) {
            await this.clearDefaultAddresses(customerId, transaction);
          }

          const updateResult = await this.Data.update(
            'customer_addresses',
            updatePayload,
            [
              {
                column: 'address_id',
                operator: '=',
                value: addressId,
              },
              {
                column: 'customer_id',
                operator: '=',
                value: customerId,
              },
            ],
            { transaction },
          );

          if (!updateResult?.status) {
            throw new Error(updateResult?.message || 'Database update failed');
          }
        },
      );

      // Fetch the updated address to return correct normalized data
      const updatedQueryResult = await this.Data.query('customer_addresses', {
        where: [
          { column: 'address_id', operator: '=', value: addressId },
          { column: 'customer_id', operator: '=', value: customerId },
        ],
        limit: 1,
      });

      if (!updatedQueryResult?.data || updatedQueryResult.data.length === 0) {
        throw new Error('Updated address not found');
      }

      const updatedRecord = updatedQueryResult.data[0];

      return {
        status: true,
        message: 'Address updated successfully',
        address_id: addressId,
        data: this.normalizeAddress(updatedRecord),
      };
    } catch (error: any) {
      this.Developer.error('Failed to save existing address', error);
      throw new BadRequestException(error?.message || 'Failed to update address');
    }
  }

  private formatDateForPostgres(date: string | null): string | null {
    if (!date) return null;

    // Already in YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }

    // Convert DD-MM-YYYY or D-M-YYYY
    const parts = date.split('-');
    if (parts.length === 3) {
      const [day, month, year] = parts;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    return null;
  }
  @Put('profile/email')
  @UseGuards(AuthGuard('jwt'))
  async updateEmail(@Req() req: Request, @Body() body: any) {
    const user = req.user as any;
    const userId = user?.user_id;
    const email = String(body?.email ?? '').toLowerCase().trim();
    const verificationToken = String(body?.verification_token ?? '').trim();

    if (!userId) {
      throw new BadRequestException('Invalid customer session');
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('Please provide a valid email address');
    }

    if (!verificationToken) {
      throw new BadRequestException('OTP verification token is required');
    }

    const existingProfile = await this.resolveCustomer(userId, user?.email);
    if (!existingProfile) {
      throw new BadRequestException('Customer profile not found');
    }

    const usersResult = await this.Data.query('users', {
      select: ['user_id', 'email'],
    });
    const duplicateUser = (usersResult?.data ?? []).find(
      (item: any) =>
        item.email?.toLowerCase().trim() === email &&
        item.user_id !== existingProfile.customer_id,
    );
    if (duplicateUser) {
      throw new BadRequestException('Email already registered');
    }

    await this.authService.consumeVerifiedOtp(
      verificationToken,
      email,
      'email_change',
    );

    const updatedAt = new Date();
    const updateCustomer = await this.Data.update(
      'customers',
      { email, updated_at: updatedAt },
      [{ column: 'customer_id', operator: '=', value: existingProfile.customer_id }],
    );

    const updateUser = await this.Data.update(
      'users',
      { email, updated_at: updatedAt },
      [{ column: 'user_id', operator: '=', value: existingProfile.customer_id }],
    );

    if (!updateCustomer?.status) {
      await this.Developer.error('Customer email update failed', updateCustomer);
    }

    if (!updateUser?.status) {
      await this.Developer.error('User email update failed', updateUser);
    }

    const profile = await this.resolveCustomer(userId, email);
    return {
      status: true,
      message: 'Email updated successfully',
      email,
      profile,
    };
  }
  @Patch('bootstrap/profile')
  @UseGuards(AuthGuard('jwt'))
  async updateProfile(@Req() req: Request, @Body() body: any) {
    const user = req.user as any;
    const userId = user?.user_id;

    if (!userId) {
      throw new BadRequestException('Invalid customer session');
    }

    const updateData = {
      first_name: String(body?.first_name ?? '').trim(),
      last_name: String(body?.last_name ?? '').trim(),
      email: String(body?.email ?? '').trim(),
      phone: String(body?.mobile ?? '').trim(),
      dob: this.formatDateForPostgres(body?.dob),
      gender: String(body?.gender ?? '').trim(),
      updated_at: new Date(),
    };
    if (!updateData.first_name || !updateData.phone || !updateData.email) {
      throw new BadRequestException('First name and phone number are required');
    }
    const existingProfile = await this.resolveCustomer(userId, user?.email);
    if (!existingProfile) {
      throw new BadRequestException('Customer profile not found');
    }

    const updateCustomer = await this.Data.update(
      'customers',
      updateData,
      [
        {
          column: 'customer_id',
          operator: '=',
          value: existingProfile.customer_id,
        },
      ],
    );

    const userUpdateData = {
      first_name: updateData.first_name,
      last_name: updateData.last_name,
      user_name: `${updateData.first_name} ${updateData.last_name}`.trim(),
      phone: updateData.phone,
      email: updateData.email,
      updated_at: new Date(),
    };

    const updateUser = await this.Data.update(
      'users',
      userUpdateData,
      [
        {
          column: 'user_id',
          operator: '=',
          value: existingProfile.customer_id,
        },
      ],
    );

    if (!updateCustomer?.status) {
      await this.Developer.error('Customer update failed', updateCustomer);
    }

    if (!updateUser?.status) {
      await this.Developer.error('User update failed', updateUser);
    }
    const profile = await this.resolveCustomer(userId, user?.email);
    return {
      status: true,
      message: 'Profile updated successfully',
      profile,
    };
  }

  @Post('bootstrap/address')
  @UseGuards(AuthGuard('jwt'))
  async addAddress(@Req() req: Request, @Body() body: any) {
    const user = req.user as any;
    const userId = user?.user_id;

    if (!userId) {
      throw new BadRequestException('Invalid customer session');
    }

    const profile = await this.resolveCustomer(userId);
    const customerId = profile?.customer_id || userId;

    const requestedAddressId = body?.address_id;
    if (this.hasValue(requestedAddressId)) {
      const addressId = String(requestedAddressId);
      return this.saveExistingAddress(customerId, addressId, body);
    }

    const addressData = this.buildAddressData(body, customerId);
    const { branch_id, h3_index } = await this.assignBranchAndH3(
      addressData.latitude,
      addressData.longitude,
    );
    addressData.branch_id = branch_id || '';
    addressData.h3_index = h3_index || '';
    addressData.address_id = generateId('ADDR', 10);

    const insertResult = await this.Data.executeTransaction(
      async (transaction) => {
        if (addressData.is_default === true) {
          await this.clearDefaultAddresses(customerId, transaction);
        }

        return this.Data.insert('customer_addresses', addressData, {
          transaction,
        });
      },
    );

    return {
      status: true,
      message: 'Address added successfully',
      address_id: insertResult?.address_id,
      data: this.normalizeAddress(insertResult),
    };
  }

  @Patch('bootstrap/address/:address_id')
  @UseGuards(AuthGuard('jwt'))
  async updateAddress(
    @Req() req: Request,
    @Param('address_id') address_id: string,
    @Body() body: any,
  ) {
    const user = req.user as any;
    const userId = user?.user_id;
    console.log('Update Address ---->', body);

    if (!userId) {
      throw new BadRequestException('Invalid customer session');
    }

    const profile = await this.resolveCustomer(userId);
    const customerId = profile?.customer_id || userId;

    const addressId = String(address_id);
    return this.saveExistingAddress(customerId, addressId, body);
  }

  @Delete('bootstrap/address/:address_id')
  @UseGuards(AuthGuard('jwt'))
  async deleteAddress(@Req() req: Request, @Param('address_id') address_id: string) {
    const user = req.user as any;
    const userId = user?.user_id;

    if (!userId) {
      throw new BadRequestException('Invalid customer session');
    }

    const profile = await this.resolveCustomer(userId);
    const customerId = profile?.customer_id || userId;

    const addressId = String(address_id);

    // Check if the address is referenced by an active subscription
    const activeSubscription = await this.Data.query('subscriptions', {
      where: [
        { column: 'subscriptions.status', operator: '=', value: 'active' },
        { column: 'subscriptions.address_id', operator: '=', value: addressId },
      ],
      limit: 1,
    });

    const isUsedInActiveSub = activeSubscription?.data?.length > 0;

    if (isUsedInActiveSub) {
      throw new BadRequestException(
        'This address is currently used by an active subscription and cannot be deleted.',
      );
    }
    await this.Data.update('customer_addresses', { status: false }, [
      { column: 'address_id', operator: '=', value: addressId },
      { column: 'customer_id', operator: '=', value: customerId },
    ]);
    return {
      status: true,
      message: 'Address deleted successfully',
    };
  }
}
