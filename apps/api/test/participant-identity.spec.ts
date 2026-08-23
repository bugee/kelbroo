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

/**
 * Człony nicka przy jednym stoliku.
 *
 * Goście mówią o sobie skrótem: „ten uparty", „Kruk". Dwa różne napisy nie
 * wystarczą, jeśli oba skracają się do tego samego słowa.
 */
describe('człony nicka', () => {
  const czlony = (identity: TakenIdentity) => {
    const spacja = identity.displayName.indexOf(' ');
    return {
      przymiotnik: identity.displayName.slice(0, spacja),
      zwierze: identity.displayName.slice(spacja + 1),
    };
  };

  it('nie powtarza przymiotnika ani zwierzęcia, dopóki starcza słów', () => {
    // 12 przymiotników × 12 zwierząt — dwunastu gości musi zmieścić się bez powtórki.
    const stolik = fillTable(12);
    const przymiotniki = stolik.map((identity) => czlony(identity).przymiotnik);
    const zwierzeta = stolik.map((identity) => czlony(identity).zwierze);

    expect(new Set(przymiotniki).size).toBe(12);
    expect(new Set(zwierzeta).size).toBe(12);
  });

  it('po wyczerpaniu słów powtarza przymiotnik, a nie zwierzę', () => {
    // Zwierzę jest rzeczownikiem i to ono zostaje w pamięci, więc ustępuje
    // ostatnie. Przy trzynastym gościu przymiotników już nie ma.
    const stolik = fillTable(13);
    const zwierzeta = stolik.map((identity) => czlony(identity).zwierze);

    // Zwierząt jest 12, więc przy trzynastym gościu dokładnie jedno się powtarza.
    expect(new Set(zwierzeta).size).toBe(12);
    // Nick i tak zostaje niepowtarzalny — inaczej rachunku nie da się przypisać.
    expect(new Set(stolik.map((i) => i.displayName)).size).toBe(13);
  });

  it('trzyma nicki unikalne nawet po wyczerpaniu obu zestawów', () => {
    const stolik = fillTable(40);
    expect(new Set(stolik.map((identity) => identity.displayName)).size).toBe(40);
  });
});
