/**
 * Znak rozpoznawczy gościa: kształt w wyraźnym kolorze.
 *
 * Rysowany identycznie w panelu i w aplikacji gościa — kelner szuka wzrokiem
 * tego samego, co gość widzi u siebie na telefonie. Dwie kopie tych ścieżek
 * rozjechałyby się przy pierwszej korekcie kształtu.
 *
 * Kształty są celowo proste i zwarte: ikona bywa wielkości paznokcia, a mimo to
 * ma być rozpoznawalna z drugiej strony stolika.
 */
import { COLOR_HEX, describeIdentity, isParticipantColor } from '@kelbroo/types';

/** Ścieżki w układzie 24×24, wyśrodkowane. */
const PATHS: Record<string, string> = {
  star: 'M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.6 6.1 20.7l1.2-6.6L2.5 9.5l6.6-.9z',
  heart:
    'M12 21l-1.45-1.32C5.4 15.36 2 12.28 2 8.5A4.5 4.5 0 016.5 4c1.74 0 3.41.81 4.5 2.09C12.09 4.81 13.76 4 15.5 4A4.5 4.5 0 0120 8.5c0 3.78-3.4 6.86-8.55 11.18z',
  square: 'M4 4h16v16H4z',
  triangle: 'M12 3l9 17H3z',
  circle: 'M12 3a9 9 0 100 18 9 9 0 000-18z',
  house: 'M12 3l9 8h-2.5v10h-5v-6h-3v6h-5V11H3z',
  arrow: 'M12 2l7 8h-4v12h-6V10H5z',
  moon: 'M15 3a9 9 0 100 18 7 7 0 010-18z',
  diamond: 'M12 2l8 10-8 10-8-10z',
  bolt: 'M13 2L4 14h6l-1 8 9-12h-6z',
};

export function GuestMark({
  symbol,
  color,
  size = 20,
  title,
}: {
  symbol: string;
  color: string;
  size?: number;
  /** Domyślnie opis do wypowiedzenia, np. „czerwona gwiazdka". */
  title?: string;
}) {
  const path = PATHS[symbol];
  const fill = isParticipantColor(color) ? COLOR_HEX[color] : 'currentColor';
  const label = title ?? describeIdentity(symbol, color);

  // Nieznany kształt (dane sprzed zmiany) nie może wysadzić ekranu rachunku.
  if (!path) {
    return (
      <span
        aria-hidden="true"
        style={{
          display: 'inline-block',
          width: size,
          height: size,
          borderRadius: '50%',
          background: fill,
        }}
      />
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label={label || undefined}
      aria-hidden={label ? undefined : 'true'}
      style={{ flexShrink: 0 }}
    >
      <path d={path} fill={fill} />
    </svg>
  );
}
