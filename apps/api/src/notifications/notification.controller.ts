import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  Query,
  Patch,
  Put,
  Delete,
  Param,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { NotificationService } from './notification.service';
import { DeveloperService } from '../shared/logger/Developer.service';
import { Request } from 'express';
import { SendNotificationDto, MarkAsReadDto } from './dto/notification.dto';

@Controller({ path: 'notifications', version: '1' })
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly developer: DeveloperService,
  ) {}

  /**
   * Get notifications for the authenticated user
   * Higher limit since frontend periodically fetches notifications
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  @Throttle({
    short: { limit: 30, ttl: 60000 },
    medium: { limit: 300, ttl: 900000 },
  })
  async getUserNotifications(
    @Req() req: Request,
    @Query('status') status?: 'read' | 'unread',
  ) {
    const user = req.user as any;
    this.developer.info(
      '📬 [NotificationController] GET /notifications called',
      {
        user_id: user.user_id,
        status,
      },
    );

    const notifications = await this.notificationService.getUserNotifications(
      user.user_id,
      status,
    );

    this.developer.info('📬 [NotificationController] Returning notifications', {
      count: notifications.length,
      status,
    });

    return {
      success: true,
      data: notifications,
      count: notifications.length,
    };
  }

  /**
   * Get unread notification count
   * Higher limit so frontend can poll frequently
   */
  @Get('unread-count')
  @UseGuards(JwtAuthGuard)
  @Throttle({
    short: { limit: 60, ttl: 60000 },
    medium: { limit: 600, ttl: 900000 },
  })
  async getUnreadCount(@Req() req: Request) {
    const user = req.user as any;
    const notifications = await this.notificationService.getUserNotifications(
      user.user_id,
      'unread',
    );

    return {
      success: true,
      count: notifications.length,
    };
  }

  /**
   * Mark specific notifications as read (supports POST/PATCH and kebab/camel case)
   */
  @Post('mark-read')
  @Patch('mark-read')
  @Post('mark-as-read')
  @Patch('mark-as-read')
  @UseGuards(JwtAuthGuard)
  @Throttle({ short: { limit: 60, ttl: 60000 } })
  async markAsRead(@Req() req: Request, @Body() body: any) {
    const user = req.user as any;
    const rawIds =
      body?.notificationIds ||
      body?.notification_ids ||
      body?.ids ||
      (body?.notificationId ? [body.notificationId] : []) ||
      (body?.id ? [body.id] : []);

    const ids = Array.isArray(rawIds) ? rawIds : [rawIds];
    await this.notificationService.markAsRead(user.user_id, ids.filter(Boolean));

    return {
      success: true,
      message: 'Notifications marked as read',
    };
  }

  /**
   * Mark all notifications as read for the authenticated user
   */
  @Post('mark-all-read')
  @Patch('mark-all-read')
  @Post('mark-all-as-read')
  @Patch('mark-all-as-read')
  @Put('mark-all/read')
  @Put('mark-all-read')
  @UseGuards(JwtAuthGuard)
  @Throttle({ short: { limit: 30, ttl: 60000 } })
  async markAllAsRead(@Req() req: Request) {
    const user = req.user as any;
    await this.notificationService.markAllAsRead(user.user_id);

    return {
      success: true,
      message: 'All notifications marked as read',
    };
  }

  /**
   * Send a new notification (admin/system use)
   */
  @Post('send')
  @UseGuards(JwtAuthGuard)
  @Throttle({ short: { limit: 10, ttl: 60000 } })
  async sendNotification(
    @Req() req: Request,
    @Body() dto: SendNotificationDto,
  ) {
    const user = req.user as any;
    dto.senderId = user.user_id;

    await this.notificationService.sendNotification(dto);

    return {
      success: true,
      message: 'Notification sent successfully',
    };
  }

  /**
   * Get notifications with unread count (combined response)
   * Used by frontend NotificationContext for efficient loading
   */
  @Get('with-count')
  @UseGuards(JwtAuthGuard)
  @Throttle({
    short: { limit: 30, ttl: 60000 },
    medium: { limit: 300, ttl: 900000 },
  })
  async getNotificationsWithCount(@Req() req: Request) {

    const user = req.user as any;
    const result = await this.notificationService.getUserNotificationsWithCount(
      user.user_id,
    );

    return {
      success: true,
      notifications: result.notifications,
      unreadCount: result.unreadCount,
    };
  }

  /**
   * Mark a single notification as read by recipient ID
   */
  @Put(':recipientId/read')
  @UseGuards(JwtAuthGuard)
  @Throttle({ short: { limit: 20, ttl: 60000 } })
  async markNotificationAsRead(
    @Req() req: Request,
    @Param('recipientId') recipientId: string,
  ) {
    const user = req.user as any;
    const id = parseInt(recipientId, 10);

    if (isNaN(id)) {
      return {
        success: false,
        message: 'Invalid notification ID',
      };
    }

    await this.notificationService.markNotificationAsRead(user.user_id, id);

    return {
      success: true,
      message: 'Notification marked as read',
    };
  }

  /**
   * Dismiss/soft delete a notification
   */
  @Delete(':recipientId')
  @Put(':recipientId/dismiss')
  @UseGuards(JwtAuthGuard)
  @Throttle({ short: { limit: 60, ttl: 60000 } })
  async dismissNotification(
    @Req() req: Request,
    @Param('recipientId') recipientId: string,
  ) {
    const user = req.user as any;
    await this.notificationService.dismissNotification(user.user_id, recipientId);

    return {
      success: true,
      message: 'Notification dismissed',
    };
  }

  /**
   * Mark all as read (PUT endpoint for new frontend)
   */
  @Put('mark-all/read')
  @UseGuards(JwtAuthGuard)
  @Throttle({ short: { limit: 10, ttl: 60000 } })
  async markAllAsReadPut(@Req() req: Request) {
    const user = req.user as any;
    await this.notificationService.markAllAsRead(user.user_id);

    return {
      success: true,
      message: 'All notifications marked as read',
    };
  }

  /**
   * Dismiss all notifications for the authenticated user
   */
  @Delete('dismiss-all')
  @Put('dismiss-all')
  @Post('dismiss-all')
  @UseGuards(JwtAuthGuard)
  @Throttle({ short: { limit: 20, ttl: 60000 } })
  async dismissAllNotifications(@Req() req: Request) {
    const user = req.user as any;
    await this.notificationService.dismissAllNotifications(user.user_id);

    return {
      success: true,
      message: 'All notifications dismissed',
    };
  }

  // ===== Legacy test endpoints =====

  @Post('test')
  @UseGuards(JwtAuthGuard)
  async testNotification(
    @Req() req: Request,
    @Body()
    body: { message?: string; type?: 'success' | 'info' | 'warning' | 'error' },
  ) {
    const user = req.user as any;
    const message = body.message || 'This is a test notification!';
    const type = body.type || 'info';

    // Send to the requesting user
    this.notificationService.sendToUser(user.user_id, {
      message,
      type,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      message: 'Notification sent',
      sentTo: user.user_id,
    };
  }

  @Post('broadcast')
  @UseGuards(JwtAuthGuard)
  async broadcastNotification(
    @Req() req: Request,
    @Body()
    body: { message?: string; type?: 'success' | 'info' | 'warning' | 'error' },
  ) {
    const message = body.message || 'This is a broadcast test!';
    const type = body.type || 'info';

    // Send to all users
    this.notificationService.sendToAll({
      message,
      type,
      timestamp: new Date().toISOString(),
    });

    const onlineCount = this.notificationService.getOnlineUserCount();

    return {
      success: true,
      message: 'Broadcast sent to all connected users',
      connectedUsers: onlineCount,
    };
  }
}
