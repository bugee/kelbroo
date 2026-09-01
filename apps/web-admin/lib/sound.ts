/**
 * Sygnał dźwiękowy panelu.
 *
 * **Dźwięk jest generowany, nie odtwarzany z pliku** i to jest wybór, nie
 * skrót. Plik trzeba pobrać, a pierwsze zamówienie zmiany bywa pierwszym
 * żądaniem po włączeniu tabletu — w lokalu z zawodnym wi-fi cisza wypadłaby
 * dokładnie wtedy, gdy dźwięk jest najbardziej potrzebny. Dwa tony z generatora
 * grają zawsze, bo nie wymagają niczego z sieci.
 *
 * **Przeglądarka nie zagra przed pierwszym dotknięciem ekranu** — to reguła
 * przeglądarek, nie nasz błąd, i nie da się jej obejść. Dlatego `stan()` mówi
 * wprost, czy dźwięk jest gotowy, a panel prosi o jedno stuknięcie, zamiast
 * milczeć i udawać, że działa.
 */

type Kontekst = AudioContext & { state: AudioContextState };

let kontekst: Kontekst | null = null;

function silnik(): Kontekst | null {
  if (typeof window === 'undefined') return null;
  if (kontekst) return kontekst;

  const Konstruktor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Konstruktor) return null;

  kontekst = new Konstruktor() as Kontekst;
  return kontekst;
}

/** `blocked` znaczy: przeglądarka czeka na pierwsze stuknięcie w ekran. */
export function stanDzwieku(): 'ready' | 'blocked' | 'unsupported' {
  const silnikAudio = silnik();
  if (!silnikAudio) return 'unsupported';
  return silnikAudio.state === 'running' ? 'ready' : 'blocked';
}

/**
 * Próbuje odblokować dźwięk. Wołane przy pierwszym stuknięciu w cokolwiek.
 *
 * Zwraca `true`, gdy po tej próbie dźwięk gra — wołający może wtedy przerysować
 * przycisk bez czekania na cokolwiek innego.
 */
export async function odblokujDzwiek(): Promise<boolean> {
  const silnikAudio = silnik();
  if (!silnikAudio) return false;
  if (silnikAudio.state === 'running') return true;
  try {
    await silnikAudio.resume();
    // Stan czytamy od nowa, a nie ze zmiennej sprzed `resume()` — po niej
    // TypeScript wciąż zna typ zawężony do stanów sprzed wywołania.
    return stanDzwieku() === 'ready';
  } catch {
    return false;
  }
}

/**
 * Dwa krótkie tony, wznoszące.
 *
 * Wznoszące, bo mają brzmieć jak wezwanie, a nie jak błąd. Krótkie, bo w kuchni
 * powtórzą się kilkadziesiąt razy na zmianie — dźwięk, który trwa sekundę,
 * zaczyna po godzinie przeszkadzać i kończy wyciszony na stałe.
 */
export function zagrajSygnal(): void {
  const silnikAudio = silnik();
  if (!silnikAudio || silnikAudio.state !== 'running') return;

  const teraz = silnikAudio.currentTime;
  for (const [krok, czestotliwosc] of [
    [0, 880],
    [0.14, 1174.7],
  ] as const) {
    const oscylator = silnikAudio.createOscillator();
    const glosnosc = silnikAudio.createGain();

    oscylator.type = 'sine';
    oscylator.frequency.value = czestotliwosc;

    // Narastanie i wygaszanie zamiast twardego włącz/wyłącz: bez tego głośnik
    // strzela trzaskiem, który przy kilkudziesięciu powtórzeniach męczy bardziej
    // niż sam sygnał.
    const start = teraz + krok;
    glosnosc.gain.setValueAtTime(0.0001, start);
    glosnosc.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
    glosnosc.gain.exponentialRampToValueAtTime(0.0001, start + 0.13);

    oscylator.connect(glosnosc).connect(silnikAudio.destination);
    oscylator.start(start);
    oscylator.stop(start + 0.14);
  }
}
