import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import type { StaffRole } from '@kelbroo/types';
import { PrismaService } from '../prisma/prisma.service';
import { PASSWORD_ROUNDS } from '../auth/auth.service';
import { ROLE_RANK, type StaffContext } from '../auth/auth.types';

/**
 * Konta pracowników lokalu.
 *
 * Do tej pory jedyną drogą był `INSERT` w bazie, więc panelu nie dało się oddać
 * nikomu poza właścicielem. Reguły poniżej pilnują, żeby ekran nie stał się
 * jednocześnie sposobem na przejęcie restauracji: manager nie awansuje się do
 * właściciela ani nie zresetuje mu hasła, i nikt nie usunie ostatniego właściciela.
 */
@Injectable()
export class StaffAdminService {
  constructor(private readonly prisma: PrismaService) {}

  private restaurantOf(staff: StaffContext): string {
    if (!staff.restaurantId) {
      throw new ForbiddenException('Konto nie jest przypisane do lokalu.');
    }
    return staff.restaurantId;
  }

  /**
   * Adres zapisujemy zawsze małymi literami i bez spacji. Logowanie szuka konta
   * po `lower(trim())` tego, co wpisano w formularzu, ale porównuje z bazą
   * dosłownie — adres z wielką literą to konto, którego nie da się zalogować.
   */
  private normalizeEmail(email: string): string {
    return email.toLowerCase().trim();
  }

  /** Nie da się nadać roli wyższej niż własna ani sięgnąć do konta wyżej w hierarchii. */
  private assertMayManage(actor: StaffContext, targetRole: StaffRole, what: string): void {
    if (ROLE_RANK[targetRole] > ROLE_RANK[actor.role]) {
      throw new ForbiddenException(`Twoja rola nie pozwala ${what}.`);
    }
  }

  async list(staff: StaffContext) {
    return this.prisma.withTenant(staff.organizationId, async (tx) => {
      const members = await tx.staffMember.findMany({
        where: { restaurantId: this.restaurantOf(staff) },
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      });

      return members.map((member) => ({
        id: member.id,
        email: member.email,
        name: member.name,
        role: member.role as StaffRole,
        isActive: member.isActive,
        mustChangePassword: member.mustChangePassword,
        lastLoginAt: member.lastLoginAt,
        // Panel nie pokazuje akcji, których i tak nie wolno wykonać.
        isSelf: member.id === staff.staffId,
        canManage:
          member.id !== staff.staffId &&
          ROLE_RANK[member.role as StaffRole] <= ROLE_RANK[staff.role],
      }));
    });
  }

  async create(
    staff: StaffContext,
    dto: { email: string; name: string; role: StaffRole; password: string },
  ) {
    this.assertMayManage(staff, dto.role, 'nadać tej roli');

    const email = this.normalizeEmail(dto.email);
    const passwordHash = await bcrypt.hash(dto.password, PASSWORD_ROUNDS);

    return this.prisma.withTenant(staff.organizationId, async (tx) => {
      try {
        const member = await tx.staffMember.create({
          data: {
            organizationId: staff.organizationId,
            restaurantId: this.restaurantOf(staff),
            email,
            name: dto.name.trim(),
            role: dto.role,
            passwordHash,
            // Adres podał ktoś, kto sam przeszedł weryfikację — nie zmuszamy
            // kelnera do potwierdzania konta, którego nie zakładał.
            emailVerifiedAt: new Date(),
            // Hasło nadane przez kogoś innego jest z definicji tymczasowe.
            mustChangePassword: true,
          },
        });
        return this.publicView(member, staff);
      } catch (cause) {
        throw this.asConflict(cause);
      }
    });
  }

  async update(
    staff: StaffContext,
    id: string,
    dto: { email?: string; name?: string; role?: StaffRole },
  ) {
    return this.prisma.withTenant(staff.organizationId, async (tx) => {
      const member = await this.findManageable(tx, staff, id);

      if (dto.role && dto.role !== member.role) {
        this.assertMayManage(staff, dto.role, 'nadać tej roli');
        if (member.role === 'owner') {
          await this.assertNotLastOwner(tx, staff, member.id);
        }
      }

      try {
        const updated = await tx.staffMember.update({
          where: { id: member.id },
          data: {
            ...(dto.email ? { email: this.normalizeEmail(dto.email) } : {}),
            ...(dto.name ? { name: dto.name.trim() } : {}),
            ...(dto.role ? { role: dto.role } : {}),
          },
        });
        return this.publicView(updated, staff);
      } catch (cause) {
        throw this.asConflict(cause);
      }
    });
  }

  async setActive(staff: StaffContext, id: string, isActive: boolean) {
    return this.prisma.withTenant(staff.organizationId, async (tx) => {
      const member = await this.findManageable(tx, staff, id);

      if (!isActive && member.role === 'owner') {
        await this.assertNotLastOwner(tx, staff, member.id);
      }

      const updated = await tx.staffMember.update({
        where: { id: member.id },
        data: { isActive },
      });
      return this.publicView(updated, staff);
    });
  }

  /**
   * Reset hasła przez managera. Nowe hasło jest tymczasowe — pracownik zmieni je
   * przy pierwszym logowaniu, więc manager nie zostaje z hasłem do cudzego konta.
   */
  async resetPassword(staff: StaffContext, id: string, password: string) {
    const passwordHash = await bcrypt.hash(password, PASSWORD_ROUNDS);

    return this.prisma.withTenant(staff.organizationId, async (tx) => {
      const member = await this.findManageable(tx, staff, id);
      const updated = await tx.staffMember.update({
        where: { id: member.id },
        data: { passwordHash, mustChangePassword: true },
      });
      return this.publicView(updated, staff);
    });
  }

  /** Konto z tego lokalu, którym wolno zarządzać — nigdy własne, nigdy wyżej w hierarchii. */
  private async findManageable(tx: Prisma.TransactionClient, staff: StaffContext, id: string) {
    const member = await tx.staffMember.findFirst({
      where: { id, restaurantId: this.restaurantOf(staff) },
    });
    if (!member) {
      throw new NotFoundException('Konto nie istnieje.');
    }
    if (member.id === staff.staffId) {
      // Własne konto zmienia się przez ekran hasła, nie przez listę pracowników —
      // inaczej łatwo odebrać sobie dostęp jednym kliknięciem.
      throw new BadRequestException('Własnego konta nie zmienisz z tej listy.');
    }
    this.assertMayManage(staff, member.role as StaffRole, 'zmieniać tego konta');
    return member;
  }

  /**
   * Restauracja bez aktywnego właściciela nie miałaby jak odzyskać dostępu z panelu.
   *
   * Przy obecnych regułach ten strażnik nie ma prawa się odezwać: własnego konta
   * nie da się zmienić z listy, a rolę właściciela może ruszyć wyłącznie inny
   * właściciel — czyli ktoś aktywny, kto zawsze zostaje. Zostaje jako druga
   * bariera na wypadek poluzowania którejś z tamtych reguł; skutek jej braku
   * (lokal zamknięty przed własnym właścicielem) jest nieodwracalny z poziomu aplikacji.
   */
  private async assertNotLastOwner(
    tx: Prisma.TransactionClient,
    staff: StaffContext,
    excludedId: string,
  ): Promise<void> {
    const remaining = await tx.staffMember.count({
      where: {
        restaurantId: this.restaurantOf(staff),
        role: 'owner',
        isActive: true,
        id: { not: excludedId },
      },
    });
    if (remaining === 0) {
      throw new BadRequestException('To jedyny aktywny właściciel — lokal straciłby dostęp.');
    }
  }

  private asConflict(cause: unknown): unknown {
    if (cause instanceof Prisma.PrismaClientKnownRequestError && cause.code === 'P2002') {
      return new ConflictException('Konto z tym adresem e-mail już istnieje w tym lokalu.');
    }
    return cause;
  }

  private publicView(
    member: {
      id: string;
      email: string;
      name: string;
      role: string;
      isActive: boolean;
      mustChangePassword: boolean;
      lastLoginAt: Date | null;
    },
    staff: StaffContext,
  ) {
    return {
      id: member.id,
      email: member.email,
      name: member.name,
      role: member.role as StaffRole,
      isActive: member.isActive,
      mustChangePassword: member.mustChangePassword,
      lastLoginAt: member.lastLoginAt,
      isSelf: member.id === staff.staffId,
      canManage:
        member.id !== staff.staffId && ROLE_RANK[member.role as StaffRole] <= ROLE_RANK[staff.role],
    };
  }
}
