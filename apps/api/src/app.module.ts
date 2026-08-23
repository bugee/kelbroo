import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import path from 'node:path';
import { PrismaModule } from './prisma/prisma.module';
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
import { StaffAuthGuard } from './auth/staff.guard';
import { StaffController } from './staff/staff.controller';
import { StaffOrdersService } from './staff/staff-orders.service';
import { StaffOrderingService } from './staff/staff-ordering.service';
import { SplitService } from './staff/split.service';
import { WaiterCallsService } from './staff/waiter-calls.service';
import { BadgesService } from './staff/badges.service';
import { GuestSignalsService } from './guest/guest-signals.service';
import { GuestController } from './guest/guest.controller';
import { StaffSignalsGateway } from './realtime/staff-signals.gateway';
import { StaffSessionsService } from './staff/staff-sessions.service';
import { OrdersGateway } from './realtime/orders.gateway';
import { ManagementController } from './management/management.controller';
import { MenuAdminService } from './management/menu.admin.service';
import { TablesAdminService } from './management/tables.admin.service';
import { RestaurantAdminService } from './management/restaurant.admin.service';
import { StaffAdminService } from './management/staff.admin.service';

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
    PrismaModule,
  ],
  controllers: [
    GuestController,
    HealthController,
    TableController,
    OrdersController,
    AuthController,
    StaffController,
    ManagementController,
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
    StaffAuthGuard,
    StaffOrdersService,
    StaffOrderingService,
    SplitService,
    WaiterCallsService,
    BadgesService,
    GuestSignalsService,
    StaffSignalsGateway,
    StaffSessionsService,
    OrdersGateway,
    MenuAdminService,
    TablesAdminService,
    RestaurantAdminService,
    StaffAdminService,
  ],
})
export class AppModule {}
