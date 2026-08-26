/**
 * Formularz kontaktowy.
 *
 * To jedyne wejście, które **wysyła pocztę na cudze polecenie** i nie wymaga
 * żadnego konta. Dwie rzeczy muszą się trzymać: zgłoszenie ma dotrzeć do nas
 * i do nadawcy, a automat ma odejść z niczym, nie dowiadując się, że został
 * rozpoznany.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { ContactService } from '../src/contact/contact.service';
import type { ContactDto } from '../src/contact/dto';
import type { MailService } from '../src/mail/mail.service';

const wyslane: { to: string; subject: string; text: string; html?: string }[] = [];
const mail = {
  send: async (w: { to: string; subject: string; text: string; html?: string }) => {
    wyslane.push(w);
    return true;
  },
  skrzynkaKelbroo: 'kontakt@kelbroo.com',
  adresStrony: 'https://kelbroo.com',
} as unknown as MailService;

const contact = new ContactService(mail);

const zgloszenie = (nadpisz: Partial<ContactDto> = {}): ContactDto => ({
  purpose: 'pytanie',
  name: 'Anna Kowalska',
  company: 'Bistro Widok',
  email: 'anna@bistro.test',
  message: 'Czy da się podpiąć naszą kasę fiskalną?',
  ...nadpisz,
});

beforeEach(() => {
  wyslane.length = 0;
});

describe('zgłoszenie', () => {
  it('trafia do nas i wraca potwierdzeniem do nadawcy', async () => {
    await contact.przyjmij(zgloszenie(), '1.2.3.4');

    expect(wyslane.map((w) => w.to).sort()).toEqual(['anna@bistro.test', 'kontakt@kelbroo.com']);
  });

  it('niesie komplet danych kontaktowych', async () => {
    await contact.przyjmij(zgloszenie({ phone: '600100200', company: 'Bistro Widok' }), '1.2.3.4');

    const doNas = wyslane.find((w) => w.to === 'kontakt@kelbroo.com')!;
    // Odpowiedź piszemy z własnej skrzynki, więc adres nadawcy musi być
    // w treści — szukanie go w nagłówkach to strata czasu przy każdym zgłoszeniu.
    expect(doNas.text).toContain('anna@bistro.test');
    expect(doNas.text).toContain('600100200');
    expect(doNas.text).toContain('Czy da się podpiąć naszą kasę fiskalną?');
  });

  it('odróżnia prośbę o prezentację od pytania', async () => {
    await contact.przyjmij(
      zgloszenie({ purpose: 'prezentacja', preferredTime: 'wtorki przed 11' }),
      '1.2.3.4',
    );

    const doNas = wyslane.find((w) => w.to === 'kontakt@kelbroo.com')!;
    expect(doNas.subject).toContain('Prezentacja');
    // Termin jest powodem, dla którego to pole w ogóle istnieje.
    expect(doNas.text).toContain('wtorki przed 11');
  });

  it('nie pokazuje terminu przy zwykłym pytaniu', async () => {
    await contact.przyjmij(zgloszenie({ preferredTime: 'wtorki przed 11' }), '1.2.3.4');

    const doNas = wyslane.find((w) => w.to === 'kontakt@kelbroo.com')!;
    expect(doNas.text).not.toContain('wtorki przed 11');
  });
});

describe('pułapka na roboty', () => {
  it('nie wysyła niczego, gdy ukryte pole zostało wypełnione', async () => {
    await contact.przyjmij(zgloszenie({ website: 'http://spam.example' }), '9.9.9.9');

    expect(wyslane).toHaveLength(0);
  });

  it('nie mówi robotowi, że został rozpoznany', async () => {
    // Serwis kończy bez wyjątku, więc kontroler odpowie tak samo jak przy
    // zgłoszeniu prawdziwym. Automat, któremu powiemy „odrzucono", spróbuje
    // inaczej; ten, któremu podziękujemy, uzna, że zadziałało.
    await expect(
      contact.przyjmij(zgloszenie({ website: 'http://spam.example' }), '9.9.9.9'),
    ).resolves.toBeUndefined();
  });
});

describe('treść od obcego', () => {
  it('nie wpuszcza znaczników HTML z formularza do wiadomości', async () => {
    // Treść pisze ktoś, kogo nie znamy, a wiadomość otwieramy my. Znacznik
    // przepuszczony do HTML-a byłby wstrzyknięciem do naszej skrzynki.
    // Sprawdzamy **wersję HTML**, bo tylko ona jest renderowana; w wersji
    // tekstowej nawiasy są zwykłymi znakami i nic nie znaczą.
    await contact.przyjmij(
      zgloszenie({ name: '<script>alert(1)</script>', message: 'Pozdrawiam <b>bardzo</b>' }),
      '1.2.3.4',
    );

    const doNas = wyslane.find((w) => w.to === 'kontakt@kelbroo.com')!;
    expect(doNas.html).not.toContain('<script>');
    expect(doNas.html).not.toContain('<b>bardzo</b>');
    // Treść zostaje czytelna — escapujemy, nie wycinamy.
    expect(doNas.html).toContain('&lt;script&gt;');
    expect(doNas.text).toContain('alert(1)');
  });

  it('zachowuje łamanie wierszy z pola wiadomości', async () => {
    await contact.przyjmij(zgloszenie({ message: 'Pierwsza linia\nDruga linia' }), '1.2.3.4');

    const doNas = wyslane.find((w) => w.to === 'kontakt@kelbroo.com')!;
    // Bez tego akapit wpisany w kilku wierszach skleja się w jeden ciąg.
    expect(doNas.html).toContain('Pierwsza linia<br>Druga linia');
  });
});
