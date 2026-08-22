import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import path from 'node:path';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Jeden plik .env w korzeniu monorepo.
      envFilePath: path.resolve(__dirname, '../../../.env'),
    }),
    PrismaModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
