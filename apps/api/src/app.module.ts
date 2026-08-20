
import { CustomThrottlerGuard } from './throttler/custom-throttler.guard';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { RoleResolverService } from './auth/role-resolver.service';
import { CsrfGuard } from './csrf/csrf.guard';
import { AuthModule } from './auth/auth.module';
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
import { MapModule } from './map/map.module';
import { DeviceModule } from './device/device.module';
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
import { SchedulingModule } from './shared/scheduling/scheduling.module';
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
import { PromotionsCouponsModule } from './panels/admin/promotions-coupons/promotions-coupons.module';
import { CustomerAppAssetsModule } from './panels/customer/app_assets/app_assets.module';
import { FinanceModule } from './panels/admin/finance/finance.module';
@Module({
  imports: [
    FinanceModule,
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
    // Scheduled jobs can be turned off per process (ENABLE_CRON=false), so the
    // workers can eventually run as their own PM2 app while the API scales out.
    ...(process.env.ENABLE_CRON === 'false' ? [] : [ScheduleModule.forRoot()]),
    SchedulingModule,
    QueueModule,

    FieldEncryptionModule,
    AuthModule,
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
    PromotionsCouponsModule,
    // Two tiers only. A third 'bruteForce' tier of 100/hour was declared here, and
    // because every named tier applies to every route it would have capped the whole
    // API at 100 requests an hour once the guard's bypass was removed. Brute-force
    // protection now lives on the auth routes as explicit @Throttle() ceilings.
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 60000,
        limit: 300,
      },
      {
        name: 'medium',
        ttl: 900000,
        limit: 3000,
      },
    ]),
    MapModule,
    DeviceModule,
  ],
  controllers: [
    CsrfController,
    AppController,
  ],
  providers: [
    CsrfService,
    AppService,
    DeveloperService,
    RoleResolverService,
    // Guard order is registration order. Authentication is the default and routes
    // opt out with @Public(); previously 17 controllers — including admin finance
    // and orders — simply had no guard at all, so forgetting one meant exposing it.
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
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
      .forRoutes({ path: '(.*)', method: RequestMethod.ALL });

    // 2. Request logger (runs after headers are expanded)
    consumer
      .apply(LoggerMiddleware)
      .forRoutes({ path: '(.*)', method: RequestMethod.ALL });
  }
}
