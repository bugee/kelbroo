/**
 * NIP sprawdzamy sumą kontrolną, nie długością.
 *
 * Dziesięć cyfr ma też literówka, a ta wychodzi dopiero przy wystawianiu faktury
 * — miesiąc później i po stronie księgowości.
 */
import { describe, expect, it } from 'vitest';
import { formatNip, isValidNip, normalizeNip } from '../src/nip';

describe('NIP', () => {
  it('przyjmuje prawdziwy numer, także z myślnikami i spacjami', () => {
    // NIP z regulaminu kelbroo.
    expect(isValidNip('5222269366')).toBe(true);
    expect(isValidNip('522-226-93-66')).toBe(true);
    expect(isValidNip(' 522 226 93 66 ')).toBe(true);
  });

  it('odrzuca numer z przestawionymi cyframi', () => {
    // Klasyczna literówka: zamiana miejscami dwóch sąsiednich cyfr.
    expect(isValidNip('5222269366')).toBe(true);
    expect(isValidNip('5222263966')).toBe(false);
  });

  it('odrzuca złą długość i znaki niebędące cyframi', () => {
    expect(isValidNip('522226936')).toBe(false);
    expect(isValidNip('52222693660')).toBe(false);
    expect(isValidNip('')).toBe(false);
    expect(isValidNip('abcdefghij')).toBe(false);
  });

  it('odrzuca same zera, choć przechodzą sumę kontrolną', () => {
    expect(isValidNip('0000000000')).toBe(false);
  });

  it('normalizuje i formatuje', () => {
    expect(normalizeNip('522-226-93-66')).toBe('5222269366');
    expect(formatNip('5222269366')).toBe('522-226-93-66');
    // Numer, którego nie umiemy sformatować, zostaje jak był.
    expect(formatNip('123')).toBe('123');
  });
});
