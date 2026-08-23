/**
 * Znak rozpoznawczy gościa.
 *
 * Ten opis jest wypowiadany na głos przy stoliku, więc odmiana musi się zgadzać —
 * „niebieski gwiazdka" brzmi jak błąd aplikacji, a nie jak sposób przedstawienia się.
 */
import { describe, expect, it } from 'vitest';
import {
  COLOR_HEX,
  COLOR_LABEL,
  PARTICIPANT_COLORS,
  PARTICIPANT_SYMBOLS,
  SYMBOL_LABEL,
  describeIdentity,
} from '../src/participant-symbol.js';

describe('opis znaku rozpoznawczego', () => {
  it('odmienia kolor do rodzaju kształtu', () => {
    expect(describeIdentity('star', 'red')).toBe('czerwona gwiazdka');
    expect(describeIdentity('heart', 'red')).toBe('czerwone serce');
    expect(describeIdentity('square', 'red')).toBe('czerwony kwadrat');
  });

  it('radzi sobie z kolorem zakończonym na „i"', () => {
    // „niebieski" nie kończy się na `y`, więc reguła oparta na samym `y` dałaby
    // „niebieski gwiazdka".
    expect(describeIdentity('star', 'blue')).toBe('niebieska gwiazdka');
    expect(describeIdentity('circle', 'blue')).toBe('niebieskie koło');
    expect(describeIdentity('square', 'blue')).toBe('niebieski kwadrat');
  });

  it('daje wypowiadalny opis dla każdej pary', () => {
    for (const symbol of PARTICIPANT_SYMBOLS) {
      for (const color of PARTICIPANT_COLORS) {
        const opis = describeIdentity(symbol, color);
        expect(opis).not.toBe('');
        // Żadna forma nie może zostać z męską końcówką przy rodzaju żeńskim.
        expect(opis).not.toMatch(/(y|i) (gwiazdka|strzałka|błyskawica)$/);
        expect(opis).not.toMatch(/(y|i) (serce|koło)$/);
      }
    }
  });

  it('milczy przy nieznanym symbolu albo kolorze', () => {
    expect(describeIdentity('avatar-07', 'red')).toBe('');
    expect(describeIdentity('star', '#2A8F8C')).toBe('');
  });

  it('ma komplet etykiet i barw', () => {
    for (const symbol of PARTICIPANT_SYMBOLS) expect(SYMBOL_LABEL[symbol]).toBeTruthy();
    for (const color of PARTICIPANT_COLORS) {
      expect(COLOR_LABEL[color]).toBeTruthy();
      expect(COLOR_HEX[color]).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });
});
