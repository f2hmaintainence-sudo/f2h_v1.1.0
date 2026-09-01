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
  Logger,
} from '@nestjs/common';
import { generateId } from 'src/helpers/RandomHelper';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { DataService } from 'src/shared/database/Data.service';
import { DatabaseService } from 'src/shared/database/Database.service';
import { DeveloperService } from 'src/shared/logger/Developer.service';
import { AuthService } from './auth.service';
const COORDINATE_EPSILON = 0.0000001;

/** Cached firebase client configs (TTL: 1h per process) */
const _firebaseConfigCache: Record<string, { config: any; cachedAt: number }> = {};
const FIREBASE_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

@Controller('customer')
export class CustomerBootstrapController {
  private readonly logger = new Logger(CustomerBootstrapController.name);

  constructor(
    private readonly Data: DataService,
    private readonly db: DatabaseService,
    private readonly Developer: DeveloperService,
    private readonly authService: AuthService,
  ) { }

  private columnCache: Map<string, { columns: Set<string>; cachedAt: number }> = new Map();
  private readonly COLUMN_CACHE_TTL_MS = 10 * 60 * 1000;


  private async getTableColumns(tableName: string): Promise<Set<string>> {
    const cached = this.columnCache.get(tableName);
    if (cached && Date.now() - cached.cachedAt < this.COLUMN_CACHE_TTL_MS) {
      return cached.columns;
    }
    try {
      const rows = await this.db.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
        [tableName],
      );
      const cols = new Set<string>((rows || []).map((r: any) => r.column_name));
      if (cols.size > 0) {
        this.columnCache.set(tableName, { columns: cols, cachedAt: Date.now() });
      }
      return cols;
    } catch (err: any) {
      this.Developer.error(`[CustomerBootstrapController] Failed to fetch columns for ${tableName}`, { error: err?.message || err });
      return new Set();
    }
  }

  private async filterValidFields(tableName: string, data: Record<string, any>): Promise<Record<string, any>> {
    if (!data || typeof data !== 'object') return data;
    const cols = await this.getTableColumns(tableName);
    if (cols.size === 0) return data;
    const filtered: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (cols.has(key)) {
        filtered[key] = value;
      }
    }
    return filtered;
  }

  private normalizeAddress(addr: any) {
    if (!addr) return addr;
    const resolvedId = String(addr.address_id || addr.id || addr.action_id || '');
    return {
      ...addr,
      address_id: resolvedId,
      id: resolvedId,
      is_default: (addr.is_default === true || addr.is_default === 'true' || addr.is_default === 1 || addr.is_default === '1') ? true : false,
      status: (addr.status === false || addr.status === 'false' || addr.status === '0') ? false : true
    };
  }

  private async findCustomerAddress(customerId: string, rawAddressId: string) {
    const addressId = decodeURIComponent(String(rawAddressId || '')).trim();
    let addressCheck = await this.Data.query('customer_addresses', {
      where: [
        { column: 'address_id', operator: '=', value: addressId },
        { column: 'customer_id', operator: '=', value: customerId },
      ],
      limit: 1,
    });

    if (!addressCheck?.data || addressCheck.data.length === 0) {
      addressCheck = await this.Data.query('customer_addresses', {
        where: [
          { column: 'id', operator: '=', value: addressId },
          { column: 'customer_id', operator: '=', value: customerId },
        ],
        limit: 1,
      });
    }

    if (!addressCheck?.data || addressCheck.data.length === 0) {
      const allAddresses = await this.Data.query('customer_addresses', {
        where: [
          { column: 'customer_id', operator: '=', value: customerId },
        ],
      });
      const list = allAddresses?.data || [];
      const matched = list.find((a: any) => {
        const uId = (a.address_id || a.id || '')?.toString();
        if (uId && uId === addressId) return true;
        const fallbackKey = `${a.flat_no || ''}_${a.building_name || ''}_${a.area || ''}_${a.pincode || ''}_${a.contact_mobile || ''}`;
        return fallbackKey === addressId;
      });
      if (matched) return matched;
    }

    if (!addressCheck?.data || addressCheck.data.length === 0) {
      throw new BadRequestException('Address not found or unauthorized');
    }

    return addressCheck.data[0];
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

    let deliveryRules: any = {
      base_delivery_fee: 0.0,
      free_delivery_threshold: 0.0,
      free_delivery_for_subscriptions: true,
      free_delivery_first_order: true,
      taxes_and_handling_fee: 0.0,
      display_notes: 'Free delivery on all orders.',
    };
    try {
      const deliveryRulesRes = await this.db.query(
        `SELECT config_data FROM system_configurations WHERE config_key = 'delivery_rules' LIMIT 1`,
      );
      if (deliveryRulesRes?.[0]?.config_data) {
        deliveryRules = {
          ...deliveryRulesRes[0].config_data,
          base_delivery_fee: 0.0,
          taxes_and_handling_fee: 0.0,
          free_delivery_threshold: 0.0,
        };
      }
    } catch (err) {
      this.Developer.error('[CustomerBootstrapController] Failed to load delivery_rules', err);
    }

    let slotTimings: any = {
      morning_slot: {
        slot_key: 'morning',
        slot_name: 'Morning',
        customer_cutoff_time: '20:00',
        customer_cutoff_day_offset: -1,
        delivery_window_start: '06:00',
        delivery_window_end: '08:30',
      },
      evening_slot: {
        slot_key: 'evening',
        slot_name: 'Evening',
        customer_cutoff_time: '14:00',
        customer_cutoff_day_offset: 0,
        delivery_window_start: '17:00',
        delivery_window_end: '20:00',
      },
    };
    try {
      const slotTimingsRes = await this.db.query(
        `SELECT config_data FROM system_configurations WHERE config_key = 'slot_timings' LIMIT 1`,
      );
      if (slotTimingsRes?.[0]?.config_data) {
        slotTimings = slotTimingsRes[0].config_data;
      }
    } catch (err) {
      this.Developer.error('[CustomerBootstrapController] Failed to load slot_timings', err);
    }

    const todayPartnersData = await this.getTodayDeliveryPartners(customerId);

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
      delivery_rules: deliveryRules,
      slot_timings: slotTimings,
      today_delivery_partners: todayPartnersData.delivery_partners,
      current_delivery_slot: todayPartnersData.current_slot,
      today_date: todayPartnersData.today_date,
    };
  }

  /**
   * GET /customer/today-delivery-partners
   * Returns assigned delivery partner(s) for the customer's addresses for today and current slot.
   */
  @Get('today-delivery-partners')
  @UseGuards(AuthGuard('jwt'))
  async getTodayDeliveryPartnersEndpoint(@Req() req: Request) {
    const user = req.user as any;
    const userId = user?.user_id;
    const email = user?.email;
    const profile = await this.resolveCustomer(userId, email);
    const customerId = profile?.customer_id || userId;

    return await this.getTodayDeliveryPartners(customerId);
  }

  private parseSlotTimeMinutes(timeStr?: string, defaultMinutes = 840): number {
    if (!timeStr || typeof timeStr !== 'string') return defaultMinutes;
    const parts = timeStr.split(':');
    if (parts.length < 2) return defaultMinutes;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return defaultMinutes;
    return h * 60 + m;
  }

  private getCurrentKolkataDateAndSlot(slotTimings?: any): {
    todayDate: string;
    currentSlot: string;
    timeMinutes: number;
    morningStart: number;
    morningEnd: number;
    eveningStart: number;
    eveningEnd: number;
  } {
    const todayDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    const timeParts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    }).formatToParts(new Date());
    const h = parseInt(timeParts.find((p) => p.type === 'hour')?.value || '0', 10);
    const m = parseInt(timeParts.find((p) => p.type === 'minute')?.value || '0', 10);
    const timeMinutes = h * 60 + m;

    const morningStart = this.parseSlotTimeMinutes(slotTimings?.morning_slot?.delivery_window_start, 6 * 60);
    const morningEnd = this.parseSlotTimeMinutes(slotTimings?.morning_slot?.delivery_window_end, 8 * 60 + 30);
    const eveningStart = this.parseSlotTimeMinutes(slotTimings?.evening_slot?.delivery_window_start, 17 * 60);
    const eveningEnd = this.parseSlotTimeMinutes(slotTimings?.evening_slot?.delivery_window_end, 20 * 60);

    let currentSlot = 'closed';
    if (timeMinutes >= morningStart && timeMinutes <= morningEnd) {
      currentSlot = 'morning';
    } else if (timeMinutes >= eveningStart && timeMinutes <= eveningEnd) {
      currentSlot = 'evening';
    } else if (timeMinutes < morningStart) {
      currentSlot = 'morning';
    } else if (timeMinutes > morningEnd && timeMinutes < eveningStart) {
      currentSlot = 'evening';
    } else {
      currentSlot = 'closed';
    }

    return {
      todayDate,
      currentSlot,
      timeMinutes,
      morningStart,
      morningEnd,
      eveningStart,
      eveningEnd,
    };
  }

  async getTodayDeliveryPartners(customerId: string) {
    try {
      let slotTimings: any = null;
      try {
        const slotTimingsRes = await this.db.query(
          `SELECT config_data FROM system_configurations WHERE config_key = 'slot_timings' AND is_active = true LIMIT 1`,
        );
        if (slotTimingsRes?.[0]?.config_data) {
          slotTimings = slotTimingsRes[0].config_data;
        }
      } catch (_) { }

      const {
        todayDate,
        currentSlot,
        timeMinutes,
        morningEnd,
        eveningEnd,
      } = this.getCurrentKolkataDateAndSlot(slotTimings);

      // Query delivery_run_addresses grouped/matched by customer addresses & customer_id for today
      // Follows DB rule: identity fields (first_name, last_name, phone) are joined from users table.
      const sql = `
        SELECT 
          dr.delivery_partner_id,
          dr.run_id,
          dr.run_date,
          dr.delivery_slot,
          dr.status AS run_status,
          dra.id AS run_address_id,
          dra.address_id,
          dra.sequence_no,
          COALESCE(dra.delivery_status, 'pending') AS address_delivery_status,
          dra.delivered_at,
          COALESCE(NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), ''), u.user_name, 'Delivery Partner') AS partner_name,
          COALESCE(u.phone, '') AS partner_phone,
          dp.profile_photo_url AS partner_photo,
          ca.address_type,
          ca.address_line,
          ca.flat_no,
          ca.building_name,
          ca.area,
          ca.landmark,
          ca.city
        FROM delivery_run_addresses dra
        JOIN delivery_runs dr ON (dr.run_id = dra.run_id OR dr.id::varchar = dra.run_id)
        LEFT JOIN customer_addresses ca ON (ca.address_id = dra.address_id OR ca.id::varchar = dra.address_id)
        LEFT JOIN delivery_partners dp ON (dp.delivery_partner_id = dr.delivery_partner_id )
        LEFT JOIN users u ON ( u.user_id = dr.delivery_partner_id)
        WHERE (
          dra.customer_id = $1 
          OR dra.address_id IN (
            SELECT address_id FROM customer_addresses WHERE customer_id = $1 OR user_id = $1
            UNION
            SELECT id::varchar FROM customer_addresses WHERE customer_id = $1 OR user_id = $1
          )
        )
        AND dr.run_date = $2
        AND dr.status != 'cancelled'
        AND dra.deleted_at IS NULL
        ORDER BY 
          CASE WHEN dr.delivery_slot = $3 THEN 0 ELSE 1 END,
          dra.sequence_no ASC
      `;

      const rows = await this.db.query(sql, [customerId, todayDate, currentSlot]);
      this.Developer.log('[CustomerBootstrapController] getTodayDeliveryPartners', {
        customerId,
        todayDate,
        currentSlot,
        rowsFound: rows?.length || 0,
      });

      const partnerMap = new Map<string, any>();

      for (const row of rows || []) {
        const partnerId = row.delivery_partner_id;
        if (!partnerId) continue;

        const isCurrentSlot = (row.delivery_slot || '').toLowerCase() === currentSlot.toLowerCase();

        if (!partnerMap.has(partnerId)) {
          const slotLabel = row.delivery_slot === 'evening' ? 'Evening Delivery' : 'Morning Delivery';
          partnerMap.set(partnerId, {
            partner_id: partnerId,
            partner_name: row.partner_name || 'Delivery Partner',
            phone: row.partner_phone || '',
            profile_photo: row.partner_photo || null,
            delivery_slot: row.delivery_slot || currentSlot,
            slot_label: slotLabel,
            is_current_slot: isCurrentSlot,
            run_status: row.run_status || 'planned',
            delivery_status: row.address_delivery_status || 'pending',
            run_date: row.run_date,
            addresses: [],
          });
        }

        const partner = partnerMap.get(partnerId);

        const addrId = row.address_id || String(row.run_address_id || '');
        if (addrId && !partner.addresses.some((a: any) => a.address_id === addrId)) {
          const fallbackLine = [row.flat_no ? `Flat ${row.flat_no}` : '', row.building_name, row.area, row.city]
            .filter(Boolean)
            .join(', ');

          partner.addresses.push({
            address_id: addrId,
            address_type: row.address_type || 'home',
            address_line: row.address_line || fallbackLine,
            area: row.area || '',
            delivery_status: row.address_delivery_status || 'pending',
            delivered_at: row.delivered_at || null,
            sequence_no: row.sequence_no || 0,
          });
        }

        if (row.address_delivery_status === 'in_transit') {
          partner.delivery_status = 'in_transit';
        } else if (row.address_delivery_status === 'arrived' && partner.delivery_status !== 'in_transit') {
          partner.delivery_status = 'arrived';
        } else if (row.address_delivery_status === 'delivered' && partner.delivery_status === 'pending') {
          partner.delivery_status = 'delivered';
        }
      }

      const deliveryPartners = Array.from(partnerMap.values());

      return {
        status: true,
        today_date: todayDate,
        current_slot: currentSlot,
        delivery_partners: deliveryPartners,
      };
    } catch (err: any) {
      this.Developer.error('[CustomerBootstrapController] Failed to get today delivery partners', {
        error: err?.message || err,
        customerId,
      });
      return {
        status: false,
        today_date: new Date().toISOString().split('T')[0],
        current_slot: 'morning',
        delivery_partners: [],
      };
    }
  }

  /** Public endpoint — no auth required. Returns active Firebase client config for the requested app panel. */
  @Get('device/firebase-config')
  async getFirebaseConfig() {
    const config = await this.loadFirebaseClientConfig('firebase:customer');
    return { status: true, firebase_config: config };
  }

  /** Public endpoint — returns live slot timings from database table. */
  @Get('slot-timings')
  async getSlotTimings() {
    let slotTimings: any = null;
    try {
      const res = await this.db.query(
        `SELECT config_data FROM system_configurations WHERE config_key = 'slot_timings' AND is_active = true LIMIT 1`,
      );
      if (res?.[0]?.config_data) {
        slotTimings = res[0].config_data;
      }
    } catch (_) { }
    return {
      status: true,
      slot_timings: slotTimings,
    };
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
    const query = `
      SELECT
        c.customer_id,
        c.customer_type,
        c.is_blocked,
        c.block_reason,
        c.is_postpaid_enabled,
        c.postpaid_credit_limit,
        c.first_order_completed,
        c.wallet_balance,
        c.reward_points,
        c.gender,
        c.dob,
        c.alternate_mobile,
        c.notes,
        c.branch_id,
        c.created_by,
        c.created_at,
        c.updated_at,
        u.account_status AS customer_status,
        u.first_name,
        u.last_name,
        u.user_name,
        u.email,
        u.phone,
        u.phone AS mobile,
        u.referred_by
      FROM customers c
      JOIN users u ON u.user_id = c.customer_id
      WHERE c.customer_id = $1 OR (u.email IS NOT NULL AND u.email = $2 AND u.email != '')
      LIMIT 1
    `;
    const rows = await this.db.query(query, [userId, email || userId]);
    let customer = rows?.[0];

    if (!customer) {
      // Auto-heal: Check if user exists in users table
      try {
        const userRows = await this.db.query(
          `SELECT * FROM users WHERE user_id = $1 OR (email IS NOT NULL AND email = $2 AND email != '') LIMIT 1`,
          [userId, email || userId],
        );
        const userObj = userRows?.[0];
        if (userObj) {
          const now = new Date();
          const activeBranchRes = await this.Data.query('branches', {
            where: [{ column: 'is_active', operator: '=', value: true }],
            limit: 1,
          });
          const activeBranchId = activeBranchRes?.data?.[0]?.branch_id || 'BRANCH_KUPPAM_01';
          const newCustData = {
            customer_id: userObj.user_id || userId,
            branch_id: activeBranchId,
            wallet_balance: 0,
            customer_type: 'retail',
            created_at: now,
            updated_at: now,
          };
          const filteredNewCust = await this.filterValidFields('customers', newCustData);
          await this.Data.insert('customers', filteredNewCust);

          const reFetch = await this.db.query(query, [userObj.user_id || userId, userObj.email || email || userId]);
          customer = reFetch?.[0];
        }
      } catch (err) {
        this.Developer.error('[CustomerBootstrapController] Failed to auto-create missing customer record', err);
      }
    }

    if (customer) {
      if (!customer.first_name || !customer.first_name.trim()) {
        customer.first_name = customer.user_name || (customer.email ? customer.email.split('@')[0] : 'Customer');
      }
      if (!customer.mobile && customer.phone) {
        customer.mobile = customer.phone;
      }

      try {
        const deliveredCheck = await this.Data.query('orders', {
          select: ['order_id'],
          where: [
            { column: 'customer_id', operator: '=', value: customer.customer_id || userId },
            { column: 'status', operator: 'IN', value: ['delivered', 'completed'] },
          ],
          limit: 1,
        });
        const hasDeliveredOrder = (deliveredCheck?.data?.length || 0) > 0;
        const isUnlocked = Boolean(customer.first_order_completed || hasDeliveredOrder);

        if (isUnlocked) {
          customer.referral_code = customer.customer_id || userId;
          customer.referral_status = 'active';
          customer.first_order_completed = true;
        } else {
          customer.referral_code = null;
          customer.referral_status = 'locked';
          customer.first_order_completed = false;
        }

        const updatePayload = await this.filterValidFields('customers', {
          first_order_completed: customer.first_order_completed,
          updated_at: new Date(),
        });

        await this.Data.update(
          'customers',
          updatePayload,
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
          const refCode = customer.referred_by || 'F2HREF';
          const ts = Math.floor(Date.now() / 1000).toString(36).toUpperCase();
          const rnd = Math.floor(Math.random() * 9000 + 1000);
          // Delivery partner referrers earn a flat ₹75 bonus; customers earn ₹100
          const dpReferrerRows = await this.db.query(
            `SELECT delivery_partner_id FROM delivery_partners WHERE delivery_partner_id = $1 LIMIT 1`,
            [customer.referred_by],
          );
          const isDpRef = (dpReferrerRows?.length || 0) > 0;

          const referralData = await this.filterValidFields('referrals', {
            refer_id: `REF${ts}${rnd}`,
            referrer_customer_id: customer.referred_by,
            referred_customer_id: customer.customer_id,
            referral_code: refCode,
            referrer_reward_amount: isDpRef ? 75.00 : 100.00,
            referred_reward_amount: 0.00,
            status: 'pending',
            remarks: isDpRef
              ? 'DP referral registered - ₹75 for DP on 1st delivered order'
              : 'Referral registered - pending first delivered order',
            created_at: new Date(),
            updated_at: new Date(),
          });
          await this.Data.insert('referrals', referralData);
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

  private async saveExistingAddress(
    customerId: string,
    addressId: string,
    body: any,
  ) {
    try {
      const existing = await this.findCustomerAddress(customerId, addressId);
      const targetAddressId = existing.address_id || null;
      const targetId = existing.id || null;
      const primaryKeyId = targetAddressId || targetId || addressId;

      const addressData = this.buildAddressData(body, customerId, existing);
      addressData.address_id = primaryKeyId;

      if (addressData.latitude != null && addressData.longitude != null) {
        const { branch_id, h3_index } = await this.assignBranchAndH3(
          addressData.latitude,
          addressData.longitude,
        );
        addressData.branch_id = branch_id || 'BRANCH_KUPPAM_01';
        addressData.h3_index = h3_index || '';
      }

      const { address_id, id, ...updatePayload } = addressData;

      if (addressData.is_default === true) {
        await this.clearDefaultAddresses(customerId);
      }

      const filteredUpdatePayload = await this.filterValidFields('customer_addresses', updatePayload);

      // Force explicit is_default: true if provided
      if (body?.is_default === true || body?.is_default === 'true' || body?.is_default === 1) {
        filteredUpdatePayload.is_default = true;
      }

      if (targetAddressId) {
        await this.Data.update('customer_addresses', filteredUpdatePayload, [
          { column: 'address_id', operator: '=', value: targetAddressId },
          { column: 'customer_id', operator: '=', value: customerId },
        ]);
      } else if (targetId) {
        await this.Data.update('customer_addresses', filteredUpdatePayload, [
          { column: 'id', operator: '=', value: targetId },
          { column: 'customer_id', operator: '=', value: customerId },
        ]);
      } else {
        await this.Data.update('customer_addresses', filteredUpdatePayload, [
          { column: 'address_id', operator: '=', value: addressId },
          { column: 'customer_id', operator: '=', value: customerId },
        ]);
      }

      if (addressData.branch_id) {
        try {
          const filteredCustBranch = await this.filterValidFields('customers', {
            branch_id: addressData.branch_id,
            updated_at: new Date(),
          });
          await this.Data.update(
            'customers',
            filteredCustBranch,
            [{ column: 'customer_id', operator: '=', value: customerId }],
          );
        } catch {
          // Deliberately tolerated: the caller has a valid fallback for this failure.
        }
      }

      let updatedQueryResult = await this.Data.query('customer_addresses', {
        where: [
          { column: targetAddressId ? 'address_id' : 'id', operator: '=', value: targetAddressId || targetId || addressId },
          { column: 'customer_id', operator: '=', value: customerId },
        ],
        limit: 1,
      });

      const updatedRecord = updatedQueryResult?.data?.[0] || addressData;

      return {
        status: true,
        message: 'Address updated successfully',
        address_id: primaryKeyId,
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
    const filteredCustEmail = await this.filterValidFields('customers', { email, updated_at: updatedAt });
    const updateCustomer = await this.Data.update(
      'customers',
      filteredCustEmail,
      [{ column: 'customer_id', operator: '=', value: existingProfile.customer_id }],
    );

    const filteredUserEmail = await this.filterValidFields('users', { email, updated_at: updatedAt });
    const updateUser = await this.Data.update(
      'users',
      filteredUserEmail,
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
    this.logger.log('[CustomerBootstrapController] updateProfile', body);
    this.Developer.log('[CustomerBootstrapController] updateProfile', body);
    if (!userId) {
      throw new BadRequestException('Invalid customer session');
    }

    const updateData = {
      first_name: String(body?.first_name ?? '').trim(),
      last_name: String(body?.last_name ?? '').trim(),
      email: String(body?.email ?? '').trim(),
      mobile: String(body?.mobile ?? body?.phone ?? '').trim(),
      phone: String(body?.mobile ?? body?.phone ?? '').trim(),
      dob: this.formatDateForPostgres(body?.dob),
      gender: String(body?.gender ?? '').trim(),
      updated_at: new Date(),
    };
    if (!updateData.first_name || (!updateData.mobile && !updateData.phone) || !updateData.email) {
      throw new BadRequestException('First name and mobile number are required');
    }
    const existingProfile = await this.resolveCustomer(userId, user?.email);
    if (!existingProfile) {
      throw new BadRequestException('Customer profile not found');
    }

    const filteredCustProfile = await this.filterValidFields('customers', updateData);

    const updateCustomer = await this.Data.update(
      'customers',
      filteredCustProfile,
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

    const filteredUserProfile = await this.filterValidFields('users', userUpdateData);

    const updateUser = await this.Data.update(
      'users',
      filteredUserProfile,
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

    const filteredAddressData = await this.filterValidFields('customer_addresses', addressData);
    await this.Data.insert('customer_addresses', filteredAddressData);

    if (addressData.branch_id) {
      try {
        const filteredCustBranch = await this.filterValidFields('customers', {
          branch_id: addressData.branch_id,
          updated_at: new Date(),
        });
        await this.Data.update(
          'customers',
          filteredCustBranch,
          [{ column: 'customer_id', operator: '=', value: customerId }],
        );
      } catch {
        // Deliberately tolerated: the caller has a valid fallback for this failure.
      }
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
    this.logger.log('Update Address ---->', body);

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
    const filteredDeletePayload = await this.filterValidFields('customer_addresses', { status: false });
    await this.Data.update('customer_addresses', filteredDeletePayload, [
      { column: 'address_id', operator: '=', value: addressId },
      { column: 'customer_id', operator: '=', value: customerId },
    ]);
    return {
      status: true,
      message: 'Address deleted successfully',
    };
  }
}
