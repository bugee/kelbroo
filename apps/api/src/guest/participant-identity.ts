/**
 * Tożsamość uczestnika wizyty: nick i awatar z zamkniętego zestawu.
 *
 * Losowanie jest ścieżką domyślną — jedno kliknięcie, zero wpisywania, zero
 * danych osobowych (docs/architecture.md §14.1). Generator celowo nie proponuje
 * imion: nick nie ma być danymi osobowymi w rozumieniu RODO.
 *
 * Wszystkie zwierzęta są rodzaju męskiego, żeby przymiotnik zawsze się zgadzał.
 */

const ADJECTIVES = [
  'Wesoły',
  'Szybki',
  'Dzielny',
  'Głodny',
  'Cichy',
  'Śmiały',
  'Zwinny',
  'Sprytny',
  'Leniwy',
  'Ciekawski',
  'Uparty',
  'Roztargniony',
] as const;

const ANIMALS = [
  'Borsuk',
  'Jeż',
  'Ryś',
  'Żubr',
  'Bóbr',
  'Lis',
  'Sokół',
  'Wilk',
  'Łoś',
  'Zając',
  'Dzik',
  'Kruk',
] as const;

/** Awatary i kolory z zamkniętego zestawu — bez uploadu, bez moderacji treści. */
export const AVATAR_KEYS = ANIMALS.map(
  (_, index) => `avatar-${String(index + 1).padStart(2, '0')}`,
);

export const PARTICIPANT_COLORS = [
  '#2A8F8C',
  '#37AAA3',
  '#5FC9BE',
  '#E8722F',
  '#F7A85C',
  '#6B807E',
] as const;

const pick = <T>(items: readonly T[]): T => {
  const item = items[Math.floor(Math.random() * items.length)];
  if (item === undefined) {
    throw new Error('Pusty zestaw do losowania.');
  }
  return item;
};

export interface GeneratedIdentity {
  displayName: string;
  avatarKey: string;
  color: string;
}

/**
 * Losuje tożsamość unikalną w obrębie wizyty. Kolizja nicków przy stoliku
 * uniemożliwiłaby gościom rozpoznanie, czyja jest która pozycja na rachunku.
 */
export function generateIdentity(taken: readonly string[] = []): GeneratedIdentity {
  const used = new Set(taken);

  for (let attempt = 0; attempt < 25; attempt++) {
    const displayName = `${pick(ADJECTIVES)} ${pick(ANIMALS)}`;
    if (!used.has(displayName)) {
      return {
        displayName,
        avatarKey: pick(AVATAR_KEYS),
        color: pick(PARTICIPANT_COLORS),
      };
    }
  }

  // 144 kombinacje wystarczają dla stolika, ale nie zostawiamy pętli bez wyjścia.
  return {
    displayName: `Gość ${used.size + 1}`,
    avatarKey: pick(AVATAR_KEYS),
    color: pick(PARTICIPANT_COLORS),
  };
}
