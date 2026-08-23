/**
 * Znak rozpoznawczy gościa.
 *
 * Gość przedstawia się kelnerowi kształtem i kolorem, więc powtórzona para przy
 * jednym stoliku oznacza dwóch gości nie do odróżnienia — i pozycję dopisaną
 * nie temu, komu trzeba.
 */
import { describe, expect, it } from 'vitest';
import { PARTICIPANT_SYMBOLS, describeIdentity } from '@kelbroo/types';
import { generateIdentity, type TakenIdentity } from '../src/guest/participant-identity';

/** Symuluje kolejnych gości dosiadających się do jednego stolika. */
function fillTable(count: number): TakenIdentity[] {
  const taken: TakenIdentity[] = [];
  for (let i = 0; i < count; i++) {
    taken.push(generateIdentity(taken));
  }
  return taken;
}

describe('unikalność przy stoliku', () => {
  it('nie powtarza pary symbol + kolor', () => {
    const stolik = fillTable(30);
    const pary = stolik.map((identity) => `${identity.symbol}:${identity.color}`);

    expect(new Set(pary).size).toBe(pary.length);
  });

  it('nie powtarza nicków', () => {
    const stolik = fillTable(20);
    const nicki = stolik.map((identity) => identity.displayName);

    expect(new Set(nicki).size).toBe(nicki.length);
  });

  it('trzyma sam kształt unikalny, dopóki starcza kształtów', () => {
    // Przy małym stoliku „gwiazdka" wystarcza do przedstawienia się — kolor
    // dopowiada się dopiero wtedy, gdy kształty się powtórzą.
    const stolik = fillTable(PARTICIPANT_SYMBOLS.length);
    const ksztalty = stolik.map((identity) => identity.symbol);

    expect(new Set(ksztalty).size).toBe(PARTICIPANT_SYMBOLS.length);
  });

  it('dopiero po wyczerpaniu kształtów sięga po powtórkę w innym kolorze', () => {
    const stolik = fillTable(PARTICIPANT_SYMBOLS.length + 1);
    const ostatni = stolik.at(-1)!;
    const wczesniejszy = stolik.find((identity) => identity.symbol === ostatni.symbol)!;

    expect(wczesniejszy.color).not.toBe(ostatni.color);
  });
});

describe('opis do wypowiedzenia', () => {
  it('każdy wylosowany znak da się nazwać', () => {
    for (const identity of fillTable(15)) {
      expect(describeIdentity(identity.symbol, identity.color)).not.toBe('');
    }
  });
});

describe('pusty stolik', () => {
  it('pierwszy gość dostaje komplet bez oglądania się na innych', () => {
    const identity = generateIdentity();

    expect(identity.displayName).toBeTruthy();
    expect(describeIdentity(identity.symbol, identity.color)).toMatch(/\w+ \w+/);
  });
});
