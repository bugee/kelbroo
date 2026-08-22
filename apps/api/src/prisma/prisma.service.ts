import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Jedyna droga do danych tenanta.
   *
   * Kontekst RLS ustawiany jest przez set_config(..., is_local => true), co
   * działa wyłącznie wewnątrz transakcji — dlatego całość biegnie w jednej.
   * Poza tą metodą rola aplikacyjna nie widzi ani jednego wiersza, więc błąd
   * w kodzie kończy się pustym wynikiem, nie wyciekiem danych innego tenanta.
   */
  async withTenant<T>(
    organizationId: string,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    if (!UUID.test(organizationId)) {
      throw new Error('organizationId musi być poprawnym UUID.');
    }

    return this.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_organization_id', ${organizationId}, true)`;
      return work(tx);
    });
  }
}
