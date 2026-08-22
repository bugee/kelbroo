import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import path from 'node:path';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health/health.controller';
import { TableController } from './table/table.controller';
import { TableService } from './table/table.service';
import { OrdersController } from './orders/orders.controller';
import { OrdersService } from './orders/orders.service';
import { MenuService } from './menu/menu.service';
import { GuestSessionService } from './guest/guest-session.service';
import { GuestAuthGuard } from './guest/guest.guard';
import { DailyCounterService } from './common/daily-counter.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Jeden plik .env w korzeniu monorepo.
      envFilePath: path.resolve(__dirname, '../../../.env'),
    }),
    PrismaModule,
  ],
  controllers: [HealthController, TableController, OrdersController],
  providers: [
    TableService,
    OrdersService,
    MenuService,
    GuestSessionService,
    GuestAuthGuard,
    DailyCounterService,
  ],
})
export class AppModule {}
