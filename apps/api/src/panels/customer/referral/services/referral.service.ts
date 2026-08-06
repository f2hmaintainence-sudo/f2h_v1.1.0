import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { IReferralService } from '../interfaces/referral.service.interface';
import { IReferralRepository } from '../interfaces/referral.repository.interface';
import { CreateReferralDto } from '../dto/create-referral.dto';
import { ReferralResource } from '../resources/referral.resource';
import { generateId } from 'src/helpers/RandomHelper';

@Injectable()
export class ReferralService implements IReferralService {
  constructor(
    @Inject('IReferralRepository')
    private readonly referralRepository: IReferralRepository,
  ) {}

  async getReferralDashboard(userId: string): Promise<any> {
    const { referral_code, referral_status, customer_id } = await this.referralRepository.ensureCustomerReferralCode(userId);

    const primaryId = customer_id || userId;
    let list = await this.referralRepository.findByReferrerId(primaryId);
    if (list.length === 0 && userId && customer_id && userId !== customer_id) {
      const altList = await this.referralRepository.findByReferrerId(userId);
      if (altList.length > 0) list = altList;
    }

    let earnings = await this.referralRepository.getTotalEarnings(primaryId);
    if (earnings === 0 && userId && customer_id && userId !== customer_id) {
      const altEarnings = await this.referralRepository.getTotalEarnings(userId);
      if (altEarnings > earnings) earnings = altEarnings;
    }

    const totalReferrals = Math.max(list.length, earnings > 0 ? Math.ceil(earnings / 50) : 0);

    return {
      status: true,
      referral_code,
      referral_status,
      total_referrals: totalReferrals,
      total_earnings: earnings,
      referrals: ReferralResource.formatCollection(list),
    };
  }

  async getReferralDetails(userId: string): Promise<any> {
    const { referral_code, referral_status, customer_id } = await this.referralRepository.ensureCustomerReferralCode(userId);
    const targetId = customer_id || userId;

    const list = await this.referralRepository.findByReferrerId(targetId);
    const earnings = await this.referralRepository.getTotalEarnings(targetId);

    return {
      status: true,
      data: {
        referral_code,
        referral_status,
        reward_per_referral: 50.00,
        total_referrals: list.length,
        total_earnings: earnings,
      },
    };
  }

  async getReferralHistory(userId: string): Promise<any> {
    const { customer_id } = await this.referralRepository.ensureCustomerReferralCode(userId);
    const targetId = customer_id || userId;
    const list = await this.referralRepository.findByReferrerId(targetId);
    return {
      status: true,
      referrals: ReferralResource.formatCollection(list),
      data: ReferralResource.formatCollection(list),
    };
  }

  async validateReferralCode(userId: string | undefined, code: string): Promise<any> {
    if (!code || !code.trim()) {
      throw new BadRequestException('Referral code is required');
    }
    const cleanCode = code.trim().toUpperCase();
    const referrer = await this.referralRepository.findByReferralCode(cleanCode);

    if (!referrer) {
      return {
        status: true,
        valid: false,
        message: 'Invalid referral code',
      };
    }

    if (userId && (referrer.referrer_id === userId || referrer.user_id === userId || referrer.customer_id === userId)) {
      return {
        status: true,
        valid: false,
        message: 'Self-referral is not allowed',
      };
    }

    return {
      status: true,
      valid: true,
      message: 'Referral code is valid',
      referrer_name: referrer.first_name || referrer.referee_name || referrer.user_name || 'F2H User',
    };
  }

  async createReferral(userId: string, dto: CreateReferralDto): Promise<any> {
    const refId = generateId('REF', 8);
    const { referral_code } = await this.referralRepository.ensureCustomerReferralCode(userId);

    const newReferral = await this.referralRepository.createReferral({
      id: refId,
      referrer_id: userId,
      referee_name: dto.referee_name,
      referee_phone: dto.referee_phone,
      referral_code: dto.referral_code || referral_code,
      status: 'completed',
      reward_amount: 50.00,
    });

    return {
      status: true,
      message: 'Referral recorded successfully',
      data: newReferral,
    };
  }
}
