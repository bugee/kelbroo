/**
 * Znak rozpoznawczy gościa: kształt w wyraźnym kolorze.
 *
 * Rysowany identycznie w panelu i w aplikacji gościa — kelner szuka wzrokiem
 * tego samego, co gość widzi u siebie na telefonie. Dwie kopie tych ścieżek
 * rozjechałyby się przy pierwszej korekcie kształtu.
 *
 * Same kształty mieszkają w `@kelbroo/types`, obok listy symboli — symbol bez
 * kształtu to symbol niewidoczny, a rozdzielone listy nie dawały tego wykryć.
 */
import { COLOR_HEX, SYMBOL_PATH, describeIdentity, isParticipantColor } from '@kelbroo/types';


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
  const path = SYMBOL_PATH[symbol as keyof typeof SYMBOL_PATH];
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
