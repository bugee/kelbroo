/**
 * Tożsamość uczestnika wizyty: nick i znak rozpoznawczy z zamkniętego zestawu.
 *
 * Losowanie jest ścieżką domyślną — jedno kliknięcie, zero wpisywania, zero
 * danych osobowych (docs/architecture.md §14.1). Generator celowo nie proponuje
 * imion: nick nie ma być danymi osobowymi w rozumieniu RODO.
 *
 * Wszystkie zwierzęta są rodzaju męskiego, żeby przymiotnik zawsze się zgadzał.
 *
 * Znak rozpoznawczy (kształt + kolor) jest osobną osią tożsamości: nick czyta się
 * z ekranu, a znak wypowiada kelnerowi. Zestawy mieszkają w `@kelbroo/types`,
 * bo rysują je oba fronty.
 */
import {
  PARTICIPANT_COLORS,
  PARTICIPANT_SYMBOLS,
  type ParticipantColor,
  type ParticipantSymbol,
} from '@kelbroo/types';

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

const pick = <T>(items: readonly T[]): T => {
  const item = items[Math.floor(Math.random() * items.length)];
  if (item === undefined) {
    throw new Error('Pusty zestaw do losowania.');
  }
  return item;
};

export interface GeneratedIdentity {
  displayName: string;
  symbol: ParticipantSymbol;
  color: ParticipantColor;
}

export interface TakenIdentity {
  displayName: string;
  symbol: string;
  color: string;
}

/**
 * Losuje tożsamość unikalną w obrębie wizyty.
 *
 * Nick nie może się powtórzyć, bo goście nie rozpoznaliby, czyja jest która
 * pozycja na rachunku. Znak rozpoznawczy tym bardziej: para symbol + kolor jest
 * tym, czym gość przedstawia się kelnerowi.
 *
 * Kształt trzymamy unikalny tak długo, jak starcza kształtów — samo „gwiazdka"
 * wystarcza do przedstawienia się i jest krótsze niż „czerwona gwiazdka".
 * Dopiero po wyczerpaniu kształtów zaczynamy je powtarzać w innym kolorze.
 */
export function generateIdentity(taken: readonly TakenIdentity[] = []): GeneratedIdentity {
  const usedSymbols = new Set(taken.map((identity) => identity.symbol));
  const usedPairs = new Set(taken.map((identity) => `${identity.symbol}:${identity.color}`));

  const freeSymbols = PARTICIPANT_SYMBOLS.filter((symbol) => !usedSymbols.has(symbol));
  const symbol = freeSymbols.length > 0 ? pick(freeSymbols) : pick(PARTICIPANT_SYMBOLS);

  const freeColors = PARTICIPANT_COLORS.filter((color) => !usedPairs.has(`${symbol}:${color}`));
  // 10 kształtów × 8 kolorów to 80 par — przy stoliku nie da się ich wyczerpać,
  // ale nie zostawiamy wyboru bez wyjścia.
  const color = freeColors.length > 0 ? pick(freeColors) : pick(PARTICIPANT_COLORS);

  return { displayName: pickName(taken), symbol, color };
}

/**
 * Nick, w którym oba człony są nowe przy tym stoliku.
 *
 * Sam unikalny nick to za mało, bo goście mówią o sobie skrótem. „Uparty Borsuk"
 * i „Uparty Lis" to dwa różne napisy, ale przy stole padnie „ten uparty" —
 * i nie wiadomo, o kogo chodzi. Tak samo „Cichy Kruk" obok „Upartego Kruka".
 *
 * Gdy zestaw się kończy, ustępujemy stopniowo, a nie od razu do przypadkowej
 * pary. Kolejność ustępstw wynika z tego, jak ludzie skracają: zwierzę jest
 * rzeczownikiem i to ono zostaje w pamięci, więc powtórzony przymiotnik myli
 * mniej niż powtórzone zwierzę. Zwierzęta trzymamy unikalne najdłużej.
 */
function pickName(taken: readonly TakenIdentity[]): string {
  const usedNames = new Set(taken.map((identity) => identity.displayName));
  const usedAdjectives = new Set<string>();
  const usedAnimals = new Set<string>();

  for (const identity of taken) {
    const spacja = identity.displayName.indexOf(' ');
    if (spacja < 0) continue;
    usedAdjectives.add(identity.displayName.slice(0, spacja));
    usedAnimals.add(identity.displayName.slice(spacja + 1));
  }

  const wolneAnimals = ANIMALS.filter((animal) => !usedAnimals.has(animal));
  const wolneAdjectives = ADJECTIVES.filter((adjective) => !usedAdjectives.has(adjective));

  // 1. Oba człony nowe. Nick jest wtedy unikalny z samej konstrukcji.
  if (wolneAnimals.length > 0 && wolneAdjectives.length > 0) {
    return `${pick(wolneAdjectives)} ${pick(wolneAnimals)}`;
  }

  // 2. Skończyły się przymiotniki. Nowe zwierzę nadal odróżnia gościa jednym słowem.
  if (wolneAnimals.length > 0) {
    return `${pick(ADJECTIVES)} ${pick(wolneAnimals)}`;
  }

  // 3. Skończyły się zwierzęta — zostaje przymiotnik i pełny nick bez powtórki.
  for (let attempt = 0; attempt < 25; attempt++) {
    const adjective = wolneAdjectives.length > 0 ? pick(wolneAdjectives) : pick(ADJECTIVES);
    const displayName = `${adjective} ${pick(ANIMALS)}`;
    if (!usedNames.has(displayName)) return displayName;
  }

  // 144 kombinacje nicków wystarczają dla stolika, ale pętla musi mieć wyjście.
  return `Gość ${usedNames.size + 1}`;
}
