import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { marked } from 'marked';

/**
 * Dokumenty prawne renderowane wprost z `docs/legal/`.
 *
 * Jedno źródło prawdy: opublikowana treść nie może rozjechać się z tą
 * w repozytorium, bo klient zgadza się na konkretną **wersję** dokumentu przy
 * rejestracji, a spór rozstrzyga się na tym, co wtedy było napisane.
 *
 * Czytamy przy budowaniu, nie na żądanie — strona jest statyczna, a plik zmienia
 * się kilka razy w roku.
 */
const KORZEN = path.join(process.cwd(), '..', '..', 'docs');

/**
 * Identyfikator sekcji z jej numeru: `## §8. Prawa…` → `#par-8`.
 *
 * `marked` nie nadaje nagłówkom identyfikatorów, a bez nich nie da się odesłać
 * do paragrafu — a właśnie tak wygodnie jest cytować dokument prawny. Numer
 * paragrafu jest stabilniejszy od tytułu: zmiana brzmienia nagłówka nie psuje
 * wtedy wszystkich istniejących odnośników.
 */
function idParagrafu(tekst: string): string | null {
  const numer = /§\s*(\d+)/.exec(tekst)?.[1];
  return numer ? `par-${numer}` : null;
}

const renderer = new marked.Renderer();
const domyslnyNaglowek = renderer.heading.bind(renderer);
renderer.heading = (token) => {
  const html = domyslnyNaglowek(token);
  const id = idParagrafu(token.text);
  return id ? html.replace(/^<(h[1-6])/, `<$1 id="${id}"`) : html;
};

export type Dokument = 'regulamin' | 'polityka-prywatnosci';

export async function dokumentHtml(nazwa: Dokument): Promise<string> {
  return markdownHtml(path.join(KORZEN, 'legal', `${nazwa}.md`));
}

/**
 * Artykuł bazy wiedzy z `docs/pomoc/`.
 *
 * Ten sam potok co dokumenty prawne: treść żyje w repozytorium, przechodzi przez
 * przegląd jak kod i renderuje się przy budowaniu. Instrukcja rozjechana
 * z produktem jest gorsza niż jej brak, więc ma leżeć tam, gdzie widać ją przy
 * zmianie w panelu.
 */
export async function pomocHtml(slug: string): Promise<string> {
  return markdownHtml(path.join(KORZEN, 'pomoc', `${slug}.md`));
}

async function markdownHtml(sciezka: string): Promise<string> {
  const zrodlo = await readFile(sciezka, 'utf-8');
  return marked.parse(zrodlo, { async: false, renderer });
}
