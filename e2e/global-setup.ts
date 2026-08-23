import { ALL_ACCOUNTS } from './fixtures/accounts';
import { createTestOrganization, dropTestOrganization } from './fixtures/db';

/**
 * Każdy przebieg zaczyna od czystej restauracji testowej. Kasujemy poprzednią
 * zamiast doklejać się do niej, żeby przerwany przebieg nie zatruwał następnego.
 */
export default async function globalSetup(): Promise<void> {
  await dropTestOrganization();
  await createTestOrganization(ALL_ACCOUNTS);
}
