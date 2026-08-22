import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { BusinessDate } from './business-date';

export type CounterScope = 'order' | 'table_session';

interface Allocation {
  organizationId: string;
  restaurantId: string;
  businessDate: BusinessDate;
  scope: CounterScope;
}

@Injectable()
export class DailyCounterService {
  /**
   * Przydziela kolejny numer dzienny.
   *
   * Upsert z `RETURNING` jest atomowy w obrębie jednej instrukcji, więc dwa
   * równoczesne zamówienia nie dostaną tego samego numeru. `SELECT max(...) + 1`
   * gubiłby się dokładnie wtedy, gdy w lokalu jest najwięcej ruchu.
   */
  async next(tx: Prisma.TransactionClient, allocation: Allocation): Promise<number> {
    const { organizationId, restaurantId, businessDate, scope } = allocation;

    const rows = await tx.$queryRaw<{ last_value: number }[]>`
      INSERT INTO daily_counter (id, organization_id, restaurant_id, business_date, scope, last_value)
      VALUES (
        gen_random_uuid(),
        ${organizationId}::uuid,
        ${restaurantId}::uuid,
        ${businessDate}::date,
        ${scope}::"CounterScope",
        1
      )
      ON CONFLICT (restaurant_id, business_date, scope)
      DO UPDATE SET last_value = daily_counter.last_value + 1
      RETURNING last_value
    `;

    const value = rows[0]?.last_value;
    if (value === undefined) {
      throw new Error(`Nie udało się przydzielić numeru dziennego (${scope}).`);
    }
    return value;
  }
}
