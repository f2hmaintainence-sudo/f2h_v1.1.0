export interface CreateNotificationDto {
  notification_id?: string;
  title: string;
  message: string;
  medium: 'websocket' | 'email' | 'sms' | 'push';
  type: 'success' | 'info' | 'warning' | 'error';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  sender_id?: string;
  is_read?: boolean;
  status?: 'pending' | 'sent' | 'delivered' | 'failed';
  created_by?: string;
  updated_by?: string;
}

export interface CreateNotificationRecipientDto {
  notification_id: string;
  user_id: string;
  html?: string;
  image?: string;
  status?: 'unread' | 'read';
  notified_at?: Date;
  read_at?: Date;
  remind_at?: Date;
  created_by?: string;
  updated_by?: string;
}

export interface SendNotificationDto {
  title: string;
  message: string;
  type?: 'success' | 'info' | 'warning' | 'error';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  recipientIds: string[];
  html?: string;
  image?: string;
  senderId?: string;
}

export interface NotificationResponse {
  id: number;
  notification_id: string;
  title: string;
  message: string;
  type: string;
  priority: string;
  html?: string;
  image?: string;
  status: string;
  notified_at?: string;
  read_at?: string;
  created_at?: string;
}

export interface MarkAsReadDto {
  notificationIds: number[];
}
