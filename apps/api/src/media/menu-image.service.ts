import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { StaffContext } from '../auth/auth.types';
import { MenuImageStorage } from './menu-image.storage';

/**
 * Zdjęcia dań: jedno na pozycję.
 *
 * Jedno, a nie galeria — świadomie. Gość przegląda kartę na telefonie w lokalu,
 * a nie ogląda albumu; druga fotografia tego samego dania wydłuża listę i nie
 * pomaga wybrać. Wgranie nowego zastępuje poprzednie i kasuje stary plik.
 */
@Injectable()
export class MenuImageService {
  private readonly logger = new Logger(MenuImageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: MenuImageStorage,
  ) {}

  /**
   * Czy lokal ma w ogóle prawo do zdjęć.
   *
   * Sprawdzane przy każdym wgraniu, nie tylko przy rysowaniu przycisku:
   * ukrycie przycisku jest wygodą, a nie zabezpieczeniem.
   */
  private async wymagajFunkcji(organizationId: string): Promise<void> {
    const subscription = await this.prisma.withTenant(organizationId, (tx) =>
      tx.subscription.findUnique({ where: { organizationId } }),
    );

    if (!subscription?.menuPhotosEnabled) {
      throw new ForbiddenException(
        'Zdjęcia dań są w planie Pro i wyższych. Napisz na kontakt@kelbroo.com, ' +
          'jeśli chcesz je włączyć na swoim planie.',
      );
    }
  }

  async upload(staff: StaffContext, itemId: string, bajty: Buffer) {
    await this.wymagajFunkcji(staff.organizationId);
    const nazwa = await this.storage.save(bajty);

    try {
      return await this.prisma.withTenant(staff.organizationId, async (tx) => {
        const item = await tx.menuItem.findFirst({
          where: { id: itemId, organizationId: staff.organizationId },
          select: { id: true, imageUrl: true },
        });
        if (!item) throw new NotFoundException('Nie ma takiej pozycji w karcie.');

        const zapisany = await tx.menuItem.update({
          where: { id: item.id },
          data: { imageUrl: nazwa },
          select: { id: true, imageUrl: true },
        });

        // Poprzednie zdjęcie kasujemy dopiero po udanym zapisie — odwrotna
        // kolejność zostawiłaby pozycję bez zdjęcia, gdyby zapis się nie udał.
        if (item.imageUrl) await this.storage.remove(item.imageUrl);

        this.logger.log(`Zdjęcie dla pozycji ${item.id} zapisane jako ${nazwa}`);
        return zapisany;
      });
    } catch (przyczyna) {
      // Plik bez wiersza w bazie jest śmieciem, którego nikt nigdy nie sprzątnie.
      await this.storage.remove(nazwa);
      throw przyczyna;
    }
  }

  async remove(staff: StaffContext, itemId: string) {
    const usuniete = await this.prisma.withTenant(staff.organizationId, async (tx) => {
      const item = await tx.menuItem.findFirst({
        where: { id: itemId, organizationId: staff.organizationId },
        select: { id: true, imageUrl: true },
      });
      if (!item) throw new NotFoundException('Nie ma takiej pozycji w karcie.');
      if (!item.imageUrl) return null;

      await tx.menuItem.update({ where: { id: item.id }, data: { imageUrl: null } });
      return item.imageUrl;
    });

    if (usuniete) await this.storage.remove(usuniete);
    return { removed: usuniete !== null };
  }

  read(nazwa: string): Promise<Buffer> {
    return this.storage.read(nazwa);
  }
}
