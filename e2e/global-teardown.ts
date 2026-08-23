import { dropTestOrganization } from './fixtures/db';

export default async function globalTeardown(): Promise<void> {
  await dropTestOrganization();
}
