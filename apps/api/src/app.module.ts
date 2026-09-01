import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import path from 'node:path';
import { PrismaModule } from './prisma/prisma.module';
import { AlertsService } from './alerts/alerts.service';
import { HealthWatchdogService } from './alerts/health-watchdog.service';
import { BillingController } from './billing/billing.controller';
import { ContactController } from './contact/contact.controller';
import { ContactService } from './contact/contact.service';
import { PublicDemoService } from './demo/public-demo.service';
import { GuestNameService } from './guest/guest-name.service';
import { GuestResumeService } from './guest/guest-resume.service';
import { ReviewsService } from './guest/reviews.service';
import { BillSummaryService } from './guest/bill-summary.service';
import { MenuImageAdminController, MenuImagePublicController } from './media/menu-image.controller';
import { MenuImageService } from './media/menu-image.service';
import { LocalDiskImageStorage, MenuImageStorage } from './media/menu-image.storage';
import { BillingService } from './billing/billing.service';
import { BillingReconciliationService } from './billing/billing-reconciliation.service';
import { SubscriptionRemindersService } from './billing/subscription-reminders.service';
import { SubscriptionPaymentProvider } from './billing/payment-provider';
import { PayuProvider } from './billing/payu.provider';
import { HealthController } from './health/health.controller';
import { TableController } from './table/table.controller';
import { TableService } from './table/table.service';
import { OrdersController } from './orders/orders.controller';
import { OrdersService } from './orders/orders.service';
import { OrderPricingService } from './orders/order-pricing.service';
import { MenuService } from './menu/menu.service';
import { GuestSessionService } from './guest/guest-session.service';
import { GuestAuthGuard } from './guest/guest.guard';
import { DailyCounterService } from './common/daily-counter.service';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { RegistrationService } from './auth/registration.service';
import { MailService } from './mail/mail.service';
import { PlatformController } from './platform/platform.controller';
import { PlatformAuthService } from './platform/platform-auth.service';
import { PlatformClientsService } from './platform/platform-clients.service';
import { PlatformClientService } from './platform/platform-client.service';
import { StaffAuthGuard } from './auth/staff.guard';
import { StaffController } from './staff/staff.controller';
import { StaffOrdersService } from './staff/staff-orders.service';
import { StaffOrderingService } from './staff/staff-ordering.service';
import { ReportsService } from './staff/reports.service';
import { SplitService } from './staff/split.service';
import { WaiterCallsService } from './staff/waiter-calls.service';
import { BadgesService } from './staff/badges.service';
import { TableLifecycleService } from './staff/table-lifecycle.service';
import { GuestSignalsService } from './guest/guest-signals.service';
import { TableAccessService } from './guest/table-access.service';
import { GuestController, GuestOpenTableController } from './guest/guest.controller';
import { StaffSignalsGateway } from './realtime/staff-signals.gateway';
import { GuestGateway } from './realtime/guest.gateway';
import { StaffSessionsService } from './staff/staff-sessions.service';
import { OrdersGateway } from './realtime/orders.gateway';
import { ManagementController } from './management/management.controller';
import { MenuAdminService } from './management/menu.admin.service';
import { TablesAdminService } from './management/tables.admin.service';
import { RestaurantAdminService } from './management/restaurant.admin.service';
import { StaffAdminService } from './management/staff.admin.service';
import { ReviewsAdminService } from './management/reviews.admin.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Jeden plik .env w korzeniu monorepo.
      envFilePath: path.resolve(__dirname, '../../../.env'),
    }),
    // Sekrety podajemy przy każdym podpisie i weryfikacji, bo access i refresh
    // mają osobne klucze — moduł rejestrujemy bez globalnej konfiguracji.
    JwtModule.register({}),
    // Zadania cykliczne: uzgadnianie płatności, przypomnienia, sprzątanie demo
    // i dozór nad bazą i Redisem. Każde chodzi pod `AlertsService.pilnuj`, bo
    // zadanie, które przestało chodzić, nie zostawia po sobie żadnego śladu.
    // Zakłada JEDNĄ instancję API — przy skalowaniu w poziomie każda
    // uruchamiałaby je osobno i trzeba będzie dołożyć blokadę w Redisie.
    ScheduleModule.forRoot(),
    // Limit żądań. Sam moduł niczego nie ogranicza — strażnik jest podpinany
    // punktowo tam, gdzie ma działać (dziś: formularz kontaktowy). Licznik
    // trzyma się w pamięci procesu, co wystarcza przy jednej instancji API
    // (ta sama uwaga co przy ScheduleModule).
    ThrottlerModule.forRoot([{ name: 'default', ttl: 3_600_000, limit: 5 }]),
    PrismaModule,
  ],
  controllers: [
    GuestController,
    PlatformController,
    GuestOpenTableController,
    HealthController,
    TableController,
    OrdersController,
    AuthController,
    StaffController,
    ManagementController,
    BillingController,
    ContactController,
    MenuImagePublicController,
    MenuImageAdminController,
  ],
  providers: [
    TableService,
    OrdersService,
    OrderPricingService,
    MenuService,
    GuestSessionService,
    GuestAuthGuard,
    DailyCounterService,
    AuthService,
    RegistrationService,
    MailService,
    AlertsService,
    HealthWatchdogService,
    PlatformAuthService,
    PlatformClientsService,
    PlatformClientService,
    StaffAuthGuard,
    StaffOrdersService,
    StaffOrderingService,
    SplitService,
    ReportsService,
    WaiterCallsService,
    BadgesService,
    TableLifecycleService,
    GuestSignalsService,
    TableAccessService,
    StaffSignalsGateway,
    GuestGateway,
    StaffSessionsService,
    OrdersGateway,
    MenuAdminService,
    TablesAdminService,
    RestaurantAdminService,
    StaffAdminService,
    ReviewsAdminService,
    BillingService,
    BillingReconciliationService,
    SubscriptionRemindersService,
    ContactService,
    PublicDemoService,
    GuestNameService,
    GuestResumeService,
    ReviewsService,
    BillSummaryService,
    MenuImageService,
    // Dziś dysk serwera; docelowo S3/R2 z CDN-em — wymiana to podmiana tej linii.
    { provide: MenuImageStorage, useClass: LocalDiskImageStorage },
    // Operator płatności wchodzi przez token, nie przez import: wymiana PayU
    // na innego dostawcę to jedna linia, a nie przeszukiwanie serwisów.
    { provide: SubscriptionPaymentProvider, useClass: PayuProvider },
  ],
})
export class AppModule {}
