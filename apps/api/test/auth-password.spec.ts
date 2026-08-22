/**
 * Zmiana hasła pracownika.
 *
 * Testy pilnują trzech rzeczy, których złamanie widać dopiero wtedy, gdy ktoś
 * nie może się zalogować w środku serwisu: że stare hasło przestaje działać,
 * że nowe zaczyna, i że nie da się zmienić hasła bez znajomości aktualnego.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { AuthService } from '../src/auth/auth.service';

const direct = new PrismaClient({ datasourceUrl: process.env.DIRECT_DATABASE_URL });
const auth = new AuthService(new JwtService({}));

const STARE = 'stareHaslo123';
const NOWE = 'noweHaslo456';

let organizationId: string;
let staffId: string;
let email: string;

beforeAll(async () => {
  const organization = await direct.organization.create({
    data: { name: `Haslo ${randomUUID()}`, billingEmail: 'haslo@test.local' },
  });
  organizationId = organization.id;

  email = `pracownik-${randomUUID()}@test.local`;
  const staff = await direct.staffMember.create({
    data: {
      organizationId,
      email,
      name: 'Test Testowy',
      role: 'owner',
      passwordHash: await bcrypt.hash(STARE, 10),
      // Konto założone ręcznie w bazie startuje z wymuszoną zmianą hasła.
      mustChangePassword: true,
    },
  });
  staffId = staff.id;
});

afterAll(async () => {
  await direct.organization.delete({ where: { id: organizationId } });
  await direct.$disconnect();
});

describe('zmiana hasła', () => {
  it('odrzuca zmianę, gdy aktualne hasło jest błędne', async () => {
    await expect(auth.changePassword(staffId, 'zupelnieInne', NOWE)).rejects.toThrow(
      'Nieprawidłowe aktualne hasło.',
    );
  });

  it('odrzuca ustawienie tego samego hasła', async () => {
    await expect(auth.changePassword(staffId, STARE, STARE)).rejects.toThrow(
      'Nowe hasło musi różnić się od aktualnego.',
    );
  });

  it('nie rusza hasła, gdy zmiana została odrzucona', async () => {
    await expect(auth.login(email, STARE)).resolves.toMatchObject({
      staff: { staffId },
    });
  });

  it('zmienia hasło i gasi flagę wymuszonej zmiany', async () => {
    const przed = await direct.staffMember.findUniqueOrThrow({ where: { id: staffId } });
    expect(przed.mustChangePassword).toBe(true);

    await auth.changePassword(staffId, STARE, NOWE);

    const po = await direct.staffMember.findUniqueOrThrow({ where: { id: staffId } });
    expect(po.mustChangePassword).toBe(false);
    expect(po.passwordHash).not.toBe(przed.passwordHash);
  });

  it('po zmianie działa nowe hasło, a stare przestaje', async () => {
    await expect(auth.login(email, NOWE)).resolves.toMatchObject({ staff: { staffId } });
    await expect(auth.login(email, STARE)).rejects.toThrow('Nieprawidłowy e-mail lub hasło.');
  });

  it('odrzuca zmianę hasła na koncie nieaktywnym', async () => {
    await direct.staffMember.update({ where: { id: staffId }, data: { isActive: false } });
    await expect(auth.changePassword(staffId, NOWE, 'jeszczeInne789')).rejects.toThrow(
      'Konto jest nieaktywne.',
    );
    await direct.staffMember.update({ where: { id: staffId }, data: { isActive: true } });
  });
});
