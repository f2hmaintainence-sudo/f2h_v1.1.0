// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : locationTrackingService.ts
// Description : Location tracking service for delivery partners
// Website     : https://www.chronosparksolutions.com/
// Copyright   : https://www.chronosparksolutions.com/copyright
// ============================================================================

import axios from 'axios';
import { getApiBaseUrl } from '@/lib/api-config';

const getBaseUrl = () => getApiBaseUrl();

export interface DeliveryPartnerLocation {
  user_id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
}

export interface LocationTrackingResponse {
  success: boolean;
  data: DeliveryPartnerLocation[];
  count: number;
}

export const locationTrackingService = {
  async getAllDeliveryPartnerLocations(): Promise<DeliveryPartnerLocation[]> {
    try {
      const token = localStorage.getItem('admin_token') || localStorage.getItem('token');
      
      const response = await axios.get<LocationTrackingResponse>(
        `${getBaseUrl()}/Admin/location-tracking/all-delivery-partners`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.success) {
        return response.data.data;
      }
      
      return [];
    } catch (error) {
      console.error('Failed to fetch delivery partner locations:', error);
      return [];
    }
  },

  async getDeliveryPartnerLocation(userId: string): Promise<DeliveryPartnerLocation | null> {
    try {
      const token = localStorage.getItem('admin_token') || localStorage.getItem('token');
      
      const response = await axios.get<{ success: boolean; data: DeliveryPartnerLocation | null }>(
        `${getBaseUrl()}/Admin/location-tracking/delivery-partner/${userId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.success) {
        return response.data.data;
      }
      
      return null;
    } catch (error) {
      console.error('Failed to fetch delivery partner location:', error);
      return null;
    }
  },
};
