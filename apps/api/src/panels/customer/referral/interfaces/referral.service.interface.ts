import { CreateReferralDto } from '../dto/create-referral.dto';

export interface IReferralService {
  getReferralDashboard(userId: string): Promise<any>;
  getReferralDetails(userId: string): Promise<any>;
  getReferralHistory(userId: string): Promise<any>;
  validateReferralCode(userId: string | undefined, code: string): Promise<any>;
  createReferral(userId: string, dto: CreateReferralDto): Promise<any>;
}
