import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GuestGateway } from '../realtime/guest.gateway';
import type { StaffContext } from '../auth/auth.types';

/**
 * Wezwania kelnera po stronie obsługi.
 *
 * Zgłoszenie ma dwa kroki, nie jeden: „widzę" i „załatwione". Bez tego dwóch
 * kelnerów idzie do tego samego stolika, a trzeci sądzi, że ktoś już poszedł.
 */
@Injectable()
export class WaiterCallsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly guests: GuestGateway,
  ) {}

  private restaurantOf(staff: StaffContext): string {
    if (!staff.restaurantId) {
      throw new ForbiddenException('Konto nie jest przypisane do lokalu.');
    }
    return staff.restaurantId;
  }

  /** Otwarte i przyjęte zgłoszenia — załatwione znikają z widoku. */
  async open(staff: StaffContext) {
    return this.prisma.withTenant(staff.organizationId, async (tx) => {
      const calls = await tx.waiterCall.findMany({
        where: {
          restaurantId: this.restaurantOf(staff),
          status: { in: ['open', 'acknowledged'] },
        },
        orderBy: { createdAt: 'asc' },
        include: {
          table: { select: { label: true } },
          acknowledgedByStaff: { select: { name: true } },
          // Przy prośbie o rachunek gość zadeklarował sposób podziału, formę
          // płatności i fakturę. Kelner czyta to tutaj, **zanim wstanie** —
          // inaczej idzie do stolika i wraca po terminal albo po drugi rachunek.
          tableSession: {
            select: { splitMode: true, paymentPreference: true, invoiceRequested: true },
          },
        },
      });

      return calls.map((call) => ({
        id: call.id,
        // Prośba o otwarcie stolika wymaga akcji na stoliku, nie na zgłoszeniu.
        tableId: call.tableId,
        tableLabel: call.table.label,
        reason: call.reason,
        status: call.status,
        createdAt: call.createdAt,
        acknowledgedBy: call.acknowledgedByStaff?.name ?? null,
        /**
         * Podział wysyłamy **tylko przy zadeklarowanym rachunku**.
         *
         * `splitMode` ma domyślnie `none` i nie odróżnia „gość wybrał jeden
         * rachunek" od „nikt jeszcze o nic nie pytał". Deklaracja istnieje
         * dokładnie wtedy, gdy jest forma płatności — tę ustawia wyłącznie
         * prośba o rachunek.
         */
        splitMode: call.tableSession?.paymentPreference ? call.tableSession.splitMode : null,
        paymentPreference: call.tableSession?.paymentPreference ?? null,
        invoiceRequested: call.tableSession?.invoiceRequested ?? false,
      }));
    });
  }

  /** „Idę" — reszta zmiany widzi, że ktoś już się tym zajął. */
  async acknowledge(staff: StaffContext, callId: string) {
    return this.update(staff, callId, {
      status: 'acknowledged',
      acknowledgedAt: new Date(),
      acknowledgedByStaffId: staff.staffId,
    });
  }

  async resolve(staff: StaffContext, callId: string) {
    return this.update(staff, callId, { status: 'resolved', resolvedAt: new Date() });
  }

  private async update(
    staff: StaffContext,
    callId: string,
    data: {
      status: 'acknowledged' | 'resolved';
      acknowledgedAt?: Date;
      acknowledgedByStaffId?: string;
      resolvedAt?: Date;
    },
  ) {
    return this.prisma.withTenant(staff.organizationId, async (tx) => {
      const call = await tx.waiterCall.findFirst({
        where: { id: callId, restaurantId: this.restaurantOf(staff) },
      });
      if (!call) {
        throw new NotFoundException('Wezwanie nie istnieje.');
      }

      const updated = await tx.waiterCall.update({ where: { id: call.id }, data });

      // Przycisk gościa zmienia napis na „Kelner idzie" bez czekania na odpytanie.
      if (updated.tableSessionId) {
        this.guests.publish(updated.tableSessionId, { kind: 'call' });
      }
      return { id: updated.id, status: updated.status };
    });
  }
}
