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
import { DatabaseService } from 'src/database/database.service';
import { DeveloperService } from 'src/shared/logger/Developer.service';
import { AuthService } from './auth.service';
const COORDINATE_EPSILON = 0.0000001;

/** Cached firebase client configs (TTL: 1h per process) */
const _firebaseConfigCache: Record<string, { config: any; cachedAt: number }> = {};
const FIREBASE_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

@Controller('customer')
export class CustomerBootstrapController {
  constructor(
    private readonly Data: DataService,
    private readonly db: DatabaseService,
    private readonly Developer: DeveloperService,
    private readonly authService: AuthService,
  ) {}

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

    const firebaseConfig = await this.loadFirebaseClientConfig('firebase:customer');

    return {
      profile,
      addresses: (addressesResult?.data || []).map((addr: any) => this.normalizeAddress(addr)),
      wallet: {
        balance: Number(profile?.wallet_balance || 0),
        referral_code: profile?.referral_code || null,
        referral_status: profile?.referral_status || 'unlocked',
      },
      subscription_summary: subscriptionSummary,
      notifications_count: 0,
      branches: branchesResult?.data || [],
      firebase_config: firebaseConfig,
    };
  }

  /** Public endpoint — no auth required. Returns active Firebase client config for the requested app panel. */
  @Get('device/firebase-config')
  async getFirebaseConfig() {
    const config = await this.loadFirebaseClientConfig('firebase:customer');
    return { status: true, firebase_config: config };
  }

  private async loadFirebaseClientConfig(configKey: string): Promise<any | null> {
    const now = Date.now();
    const cached = _firebaseConfigCache[configKey];
    if (cached && now - cached.cachedAt < FIREBASE_CACHE_TTL_MS) {
      return cached.config;
    }
    try {
      const rows = await this.db.query(
        `SELECT config_data FROM api_integrations_config WHERE config_key = $1 AND is_active = true LIMIT 1`,
        [configKey],
      );
      const row = rows?.[0];
      const config = row?.config_data ?? null;
      if (config) {
        _firebaseConfigCache[configKey] = { config, cachedAt: now };
      }
      return config;
    } catch {
      this.Developer.error(`Failed to load firebase client config for key: ${configKey}`, {});
      return null;
    }
  }

  private async resolveCustomer(userId: string, email?: string) {
    // 1. Fetch user details from users table
    const userRes = await this.Data.query('users', {
      where: [{ column: 'user_id', operator: '=', value: userId }],
      limit: 1,
    });
    let userObj = userRes?.data?.[0];

    if (!userObj && email) {
      const emailUserRes = await this.Data.query('users', {
        where: [{ column: 'email', operator: '=', value: email.toLowerCase().trim() }],
        limit: 1,
      });
      userObj = emailUserRes?.data?.[0];
      if (userObj) {
        userId = userObj.user_id;
      }
    }

    let customerResult = await this.Data.query('customers', {
      where: [{ column: 'customer_id', operator: '=', value: userId }],
      limit: 1,
    });
    let customer = customerResult?.data?.[0];

    if (!customer && userObj) {
      // Auto-heal: Create customer profile for user
      try {
        const now = new Date();
        const activeBranchRes = await this.Data.query('branches', {
          where: [{ column: 'is_active', operator: '=', value: true }],
          limit: 1,
        });
        const activeBranchId = activeBranchRes?.data?.[0]?.branch_id || '';
        const newCustData = {
          customer_id: userId,
          branch_id: activeBranchId,
          referral_status: 'locked',
          created_at: now,
          updated_at: now,
        };
        await this.Data.insert('customers', newCustData);
        customer = newCustData;
      } catch (err) {
        this.Developer.error('[CustomerBootstrapController] Failed to auto-create missing customer record', err);
      }
    }

    if (customer) {
      // Merge user fields for complete identity
      customer.first_name = userObj?.first_name || userObj?.user_name || (userObj?.email ? userObj.email.split('@')[0] : 'Customer');
      customer.last_name = userObj?.last_name || '';
      customer.phone = userObj?.phone || null;
      customer.mobile = userObj?.phone || null;
      customer.email = userObj?.email || email || null;

      try {
        const orderCheck = await this.Data.query('orders', {
          select: ['order_id'],
          where: [{ column: 'customer_id', operator: '=', value: customer.customer_id || userId }],
          limit: 1,
        });
        const hasOrder = (orderCheck?.data?.length || 0) > 0;
        const isUnlocked = customer.first_order_completed || hasOrder || customer.referral_status === 'active';
        const computedStatus = isUnlocked ? 'active' : 'locked';

        if (!customer.referral_code || !customer.referral_code.trim()) {
          const nameSeed = customer.first_name || (customer.email ? customer.email.split('@')[0] : 'USR');
          const cleanName = nameSeed.replace(/[^a-zA-Z]/g, '').toUpperCase();
          const prefix = cleanName.length >= 3 ? cleanName.slice(0, 3) : (cleanName.length > 0 ? cleanName.padEnd(3, 'X') : 'USR');
          const cleanPhone = (customer.phone || '').replace(/\D/g, '');
          const phoneSuffix = cleanPhone.length >= 3 ? cleanPhone.slice(-3) : Math.floor(100 + Math.random() * 900).toString();
          customer.referral_code = `F2H${prefix}${phoneSuffix}`;
        }

        customer.referral_status = computedStatus;
        customer.first_order_completed = isUnlocked;

        await this.Data.update(
          'customers',
          { referral_code: customer.referral_code, referral_status: computedStatus, first_order_completed: isUnlocked, updated_at: new Date() },
          [{ column: 'customer_id', operator: '=', value: customer.customer_id || userId }],
        );
      } catch (err) {
        this.Developer.error('[CustomerBootstrapController] Failed to auto-assign referral_code', err);
      }
    }

    if (customer && customer.referred_by) {
      try {
        const existingRef = await this.Data.query('referrals', {
          where: [{ column: 'referred_customer_id', operator: '=', value: customer.customer_id }],
          limit: 1,
        });
        if (!existingRef?.data?.length) {
          const referrerCust = await this.Data.query('customers', {
            where: [{ column: 'customer_id', operator: '=', value: customer.referred_by }],
            limit: 1,
          });
          const refCode = referrerCust?.data?.[0]?.referral_code || 'F2HREF';
          const ts = Math.floor(Date.now() / 1000).toString(36).toUpperCase();
          const rnd = Math.floor(Math.random() * 9000 + 1000);
          const refereeName = customer.first_name || customer.name || customer.email || 'Customer';
          const refereePhone = customer.phone || '';
          await this.Data.insert('referrals', {
            refer_id: `REF${ts}${rnd}`,
            referrer_customer_id: customer.referred_by,
            referred_customer_id: customer.customer_id,
            referral_code: refCode,
            referrer_reward_amount: 50.00,
            referred_reward_amount: 50.00,
            referrer_id: customer.referred_by,
            reward_amount: '50.00',
            referee_name: refereeName,
            referee_phone: refereePhone,
            status: customer.first_order_completed ? 'completed' : 'pending',
            remarks: 'Referral registered - pending first delivered order',
            created_at: new Date(),
            updated_at: new Date(),
          });
        }
      } catch (err) {
        this.Developer.error('[CustomerBootstrapController] Failed to auto-sync referral record', err);
      }
    }

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

    if (!nearestBranch && branches.length > 0) {
      nearestBranch = branches[0];
    }

    if (!nearestBranch) {
      throw new BadRequestException(
        'Currently this location is outside our delivery area.',
      );
    }

    return {
      branch_id: nearestBranch.branch_id,
      h3_index: null,
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

    if (existing?.[longKey] !== undefined) {
      return this.toNullableNumber(existing[longKey], longKey);
    }

    return null;
  }

  private buildAddressLine(data: any): string {
    const parts = [
      data.flat_no ? `Flat ${data.flat_no}` : '',
      data.floor_no ? `Floor ${data.floor_no}` : '',
      data.building_name,
      data.street,
      data.area,
      data.landmark ? `Near ${data.landmark}` : '',
      data.city,
      data.state,
      data.pincode,
    ].filter(Boolean);

    return parts.join(', ');
  }

  private buildAddressData(body: any, customerId: string, existing: any = null) {
    const isDefaultInput =
      body?.is_default !== undefined
        ? body.is_default
        : (existing?.is_default ?? false);

    const defaultValue =
      isDefaultInput === true ||
      isDefaultInput === 1 ||
      isDefaultInput === '1' ||
      isDefaultInput === 'true';

    const addressData: any = {
      customer_id: customerId,
      address_type: String(
        body?.address_type ?? existing?.address_type ?? 'home',
      ).toLowerCase(),
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
      branch_id: existing?.branch_id ?? 'BRANCH_KUPPAM_01',
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

  private async clearDefaultAddresses(customerId: string, _tx?: any) {
    await this.Data.update(
      'customer_addresses',
      { is_default: false },
      [
        { column: 'customer_id', operator: '=', value: customerId },
      ],
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
      addressData.address_id = existing.address_id;

      if (addressData.latitude != null && addressData.longitude != null) {
        const { branch_id, h3_index } = await this.assignBranchAndH3(
          addressData.latitude,
          addressData.longitude,
        );
        addressData.branch_id = branch_id || 'BRANCH_KUPPAM_01';
        addressData.h3_index = h3_index || '';
      }

      const { address_id, ...updatePayload } = addressData;

      if (addressData.is_default === true) {
        await this.clearDefaultAddresses(customerId);
      }

      await this.Data.update(
        'customer_addresses',
        updatePayload,
        [
          { column: 'address_id', operator: '=', value: addressId },
          { column: 'customer_id', operator: '=', value: customerId },
        ],
      );

      if (addressData.branch_id) {
        try {
          await this.Data.update(
            'customers',
            { branch_id: addressData.branch_id, updated_at: new Date() },
            [{ column: 'customer_id', operator: '=', value: customerId }],
          );
        } catch (_) {}
      }

      const updatedQueryResult = await this.Data.query('customer_addresses', {
        where: [
          { column: 'address_id', operator: '=', value: addressId },
          { column: 'customer_id', operator: '=', value: customerId },
        ],
        limit: 1,
      });

      const updatedRecord = updatedQueryResult?.data?.[0] || addressData;

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

    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }

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
    console.log('[CustomerBootstrapController] updateProfile', body);
    this.Developer.log('[CustomerBootstrapController] updateProfile', body);
    if (!userId) {
      throw new BadRequestException('Invalid customer session');
    }

    const updateData = {
      first_name: String(body?.first_name ?? '').trim(),
      last_name: String(body?.last_name ?? '').trim(),
      email: String(body?.email ?? '').trim(),
      mobile: String(body?.mobile ?? '').trim(),
      dob: this.formatDateForPostgres(body?.dob),
      gender: String(body?.gender ?? '').trim(),
      updated_at: new Date(),
    };
    if (!updateData.first_name || !updateData.mobile || !updateData.email) {
      throw new BadRequestException('First name and mobile number are required');
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
      phone: updateData.mobile,
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
    addressData.branch_id = branch_id || 'BRANCH_KUPPAM_01';
    addressData.h3_index = h3_index || '';
    addressData.address_id = generateId('ADDR', 10);

    if (addressData.is_default === true) {
      await this.clearDefaultAddresses(customerId);
    }

    await this.Data.insert('customer_addresses', addressData);

    if (addressData.branch_id) {
      try {
        await this.Data.update(
          'customers',
          { branch_id: addressData.branch_id, updated_at: new Date() },
          [{ column: 'customer_id', operator: '=', value: customerId }],
        );
      } catch (_) {}
    }

    return {
      status: true,
      message: 'Address added successfully',
      address_id: addressData.address_id,
      data: this.normalizeAddress(addressData),
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
