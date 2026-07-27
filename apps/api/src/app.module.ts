
import { CustomThrottlerGuard } from './throttler/custom-throttler.guard';
import { ThrottlerGuard } from '@nestjs/throttler'
import { APP_GUARD } from '@nestjs/core';
import { UserHelperModule } from './helpers/UserHelper.module'
import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { AdminAuthModule } from './panels/admin/auth/auth.module';
import { CustomerAuthModule } from './panels/customer/auth/auth.module';
import { DeliveryPartnerAuthModule } from './panels/delivery-partner/auth/auth.module';

import { NotificationModule } from './notifications/notification.module';
import { RedisModule } from './shared/redis/redis.module';
import { RolesModule } from './roles/roles.module';
import { UsersModule } from './users/users.module';
import { CsrfController } from './csrf/csrf.controller';
import { CsrfService } from './csrf/csrf.service';
import { LoggerMiddleware } from './middleware/logger.middleware';
import { RoleHeaderMiddleware } from './middleware/role-header.middleware';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { envValidationSchema } from './config/env.validation';
import { AppService } from './app.service';
import { SharedDatabaseModule } from './shared/database/Database.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DeveloperService } from './shared/logger/Developer.service';
import { ContactModule } from './landing/contact/contact.module';
import { HelpersModule } from './helpers/Helpers.module';
import { CustomersModule } from './panels/admin/customers/customers.module';
import { BranchManagementModule } from './panels/admin/branch-Management/branchManagement.module';
import { CatalogModule } from './panels/admin/catalog-inventory/catalog/catalog.module';
import { InventoryModule } from './panels/admin/catalog-inventory/inventory/inventory.module';
import { ProductionModule } from './panels/admin/catalog-inventory/production/production.module';
import { WarehouseModule } from './panels/admin/catalog-inventory/warehouse/warehouse.module';
import { FieldEncryptionModule } from './encryption/field-encryption.module';
import { OrdersModule } from './panels/admin/customers-orders/orders/orders.module';
import { SubscriptionsModule } from './panels/admin/customers-orders/subscriptions/subscriptions.module';
import { BullModule } from '@nestjs/bullmq';
import { QueueModule } from './shared/queue/queue.module';
import { CalendarModule } from './panels/admin/customers-orders/subscriptions/calendar/calendar.module';
import { DeliveryOrdersModule } from './panels/delivery-partner/orders/orders.module';
import { CustomerOrdersModule } from './panels/customer/orders/orders.module';
import { CartAndCheckoutModule } from './panels/customer/cartAndCheckout/cartAndCheckout.module';
import { ScheduleModule } from '@nestjs/schedule';
import { SubscriptionSnapshotModule } from './panels/admin/customers-orders/subscriptions/cron-job/subscription-snapshot.module';
import { SubscriptionStatusModule } from './panels/admin/customers-orders/subscriptions/status/subscription-status.module';
import { PackageModule } from './panels/admin/logistics-vendors/package/package.module';
import { CustomerProductsModule } from './panels/customer/categories_products/categories_products.module';
import { DeviceInformationModule } from './panels/customer/device_information/categories_products/device_information.module';
import { CustomerSubscriptionsModule } from './panels/customer/subscriptions/subscriptions.module';
import { WalletModule } from './panels/customer/wallet/wallet.module';
import { CustomerPackageModule } from './panels/customer/package/packege.module';
import { DashboardModule } from './panels/admin/dashboard/dashboard.module';
import { DeliveryManagementModule } from './panels/admin/delivery/delivery.module';
import { AnalyticsModule } from './panels/admin/analytics/analytics.module';
import { ProfileManagementModule } from './panels/admin/profile/profile.module';
import { DeliveryPartnerProfileModule } from './panels/delivery-partner/profile/profile.module';
import { SupportTicketsModule } from './support-tickets/support-tickets.module';
import { CustomerBillingModule } from './panels/admin/customers-orders/customer-billing/customer-billing.module';
import { ApiIntegrationsModule } from './developer/api-integrations/api-integrations.module';
import { ReferralModule } from './panels/customer/referral/referral.module';
import { AdminReferralModule } from './panels/admin/referrals/admin-referral.module';
import { CustomerAppAssetsModule } from './panels/customer/app_assets/app_assets.module';
@Module({
  imports: [
    ApiIntegrationsModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env', //
      validationSchema: envValidationSchema, //
      cache: true, //
      expandVariables: true, //
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', '127.0.0.1'),
          port: parseInt(configService.get<string>('REDIS_PORT', '6379'), 10),
          password: configService.get<string>('REDIS_PASSWORD', ''),
        },
      }),
    }),
    ScheduleModule.forRoot(),
    QueueModule,

    FieldEncryptionModule,
    AdminAuthModule,
    CustomerAuthModule,
    DeliveryPartnerAuthModule,
    DeliveryOrdersModule,
    HelpersModule,
    NotificationModule,
    RedisModule,
    RolesModule,
    UsersModule,
    UserHelperModule,
    EventEmitterModule.forRoot(), //
    ContactModule, //
    CustomersModule,
    BranchManagementModule,
    SubscriptionsModule,
    CustomerBillingModule,
    OrdersModule,
    CalendarModule,
    CartAndCheckoutModule,
    CustomerOrdersModule,
    SubscriptionSnapshotModule,
    SubscriptionStatusModule,
    CatalogModule,
    InventoryModule,
    ProductionModule,
    WarehouseModule,
    PackageModule,
    CustomerProductsModule,
    DeviceInformationModule,
    SharedDatabaseModule,
    CustomerSubscriptionsModule,
    CustomerAppAssetsModule,
    WalletModule,
    CustomerPackageModule,
    DashboardModule,
    DeliveryManagementModule,
    AnalyticsModule,
    ProfileManagementModule,
    DeliveryPartnerProfileModule,
    SupportTicketsModule,
    ReferralModule,
    AdminReferralModule,
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 60000,
        limit: 200,
      },
      {
        name: 'medium',
        ttl: 900000,
        limit: 2000,
      },
      {
        name: 'bruteForce',
        ttl: 3600000,
        limit: 100,
      },
    ]),
  ],
  controllers: [
    CsrfController,
    AppController,
  ],
  providers: [
    CsrfService,
    AppService,
    DeveloperService,
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    // 1. Expand compact headers (X-Role→x-role, X-Plt→x-app-platform, etc.)
    //    Must run BEFORE LoggerMiddleware so logs see the resolved role.
    consumer
      .apply(RoleHeaderMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });

    // 2. Request logger (runs after headers are expanded)
    consumer
      .apply(LoggerMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
