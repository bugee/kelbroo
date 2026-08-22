import { describe, expect, it } from 'vitest';
import { businessDateFor, toDateColumn } from '../src/common/business-date';

const WARSAW = 'Europe/Warsaw';

describe('businessDateFor', () => {
  it('kolacja przypada na dzień kalendarzowy', () => {
    // 22 sierpnia 2026, 20:00 czasu warszawskiego (UTC+2).
    expect(businessDateFor(new Date('2026-08-22T18:00:00Z'), WARSAW, 4)).toBe('2026-08-22');
  });

  it('zamówienie po północy należy do poprzedniej zmiany', () => {
    // 00:30 czasu warszawskiego 23 sierpnia — wciąż wieczór 22 sierpnia.
    expect(businessDateFor(new Date('2026-08-22T22:30:00Z'), WARSAW, 4)).toBe('2026-08-22');
  });

  it('po godzinie przełomu zaczyna się nowa doba', () => {
    // 04:30 czasu warszawskiego 23 sierpnia.
    expect(businessDateFor(new Date('2026-08-23T02:30:00Z'), WARSAW, 4)).toBe('2026-08-23');
  });

  it('startHour = 0 sprowadza dobę biznesową do kalendarzowej', () => {
    expect(businessDateFor(new Date('2026-08-22T22:30:00Z'), WARSAW, 0)).toBe('2026-08-23');
  });

  it('liczy w strefie lokalu, nie serwera', () => {
    const instant = new Date('2026-08-22T23:30:00Z');
    // W Warszawie jest już 23 sierpnia 01:30 → doba 22 sierpnia.
    expect(businessDateFor(instant, WARSAW, 4)).toBe('2026-08-22');
    // W Nowym Jorku dopiero 22 sierpnia 19:30 → doba 22 sierpnia.
    expect(businessDateFor(instant, 'America/New_York', 4)).toBe('2026-08-22');
    // W Tokio 23 sierpnia 08:30 → doba 23 sierpnia.
    expect(businessDateFor(instant, 'Asia/Tokyo', 4)).toBe('2026-08-23');
  });

  it('zmiana czasu nie gubi ani nie dubluje doby', () => {
    // Ostatnia niedziela października 2026: 25.10, cofnięcie zegarów o 03:00.
    const before = businessDateFor(new Date('2026-10-24T20:00:00Z'), WARSAW, 4);
    const during = businessDateFor(new Date('2026-10-25T00:30:00Z'), WARSAW, 4);
    const after = businessDateFor(new Date('2026-10-25T20:00:00Z'), WARSAW, 4);
    expect([before, during, after]).toEqual(['2026-10-24', '2026-10-24', '2026-10-25']);
  });

  it('odrzuca godzinę przełomu spoza zakresu', () => {
    expect(() => businessDateFor(new Date(), WARSAW, 24)).toThrow();
    expect(() => businessDateFor(new Date(), WARSAW, -1)).toThrow();
  });
});

describe('toDateColumn', () => {
  it('zwraca północ UTC, żeby kolumna DATE nie przesunęła się o dzień', () => {
    expect(toDateColumn('2026-08-22').toISOString()).toBe('2026-08-22T00:00:00.000Z');
  });
});
