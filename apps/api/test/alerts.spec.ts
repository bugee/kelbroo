/**
 * Alarmy dla nas.
 *
 * Wartość tego mechanizmu leży w dwóch rzeczach naraz, a każda bez drugiej jest
 * bezużyteczna: awaria **ma** dojść, a powtórzenia tej samej awarii **nie mogą**
 * zalać skrzynki. Alarm wysyłany co dziesięć minut przestaje być czytany dokładnie
 * wtedy, gdy przyjdzie druga, inna awaria — i wtedy jego brak byłby lepszy.
 *
 * Trzecia rzecz, mniej oczywista: zgłoszenie alarmu nie ma prawa wywrócić
 * operacji, w której się dzieje. Kelner nie może stracić zamówienia dlatego,
 * że nie poszła wiadomość do nas.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AlertsService } from '../src/alerts/alerts.service';
import type { MailService } from '../src/mail/mail.service';

const GODZINA = 60 * 60_000;

function zestaw(send: MailService['send'] = async () => true) {
  const wyslane: { subject: string; text: string }[] = [];
  const poczta = {
    adresStrony: 'https://kelbroo.test',
    skrzynkaKelbroo: 'alarmy@kelbroo.test',
    send: async (wiadomosc: { subject: string; text: string }) => {
      wyslane.push(wiadomosc);
      return send(wiadomosc as never);
    },
  } as unknown as MailService;

  return { alerts: new AlertsService(poczta), wyslane };
}

const awaria = (klucz = 'usluga.baza') => ({
  klucz,
  temat: 'Baza danych nie odpowiada',
  akapity: ['Sonda nie dostała odpowiedzi.'],
  waga: 'awaria' as const,
});

beforeEach(() => {
  vi.useRealTimers();
});

describe('pierwsze zgłoszenie', () => {
  it('idzie pocztą od razu', async () => {
    const { alerts, wyslane } = zestaw();

    await alerts.zglos(awaria());

    expect(wyslane).toHaveLength(1);
    expect(wyslane[0].subject).toContain('Baza danych nie odpowiada');
  });

  it('zostaje na liście trwających, żeby /health mógł je pokazać', async () => {
    const { alerts } = zestaw();

    await alerts.zglos(awaria());

    expect(alerts.trwajace).toEqual(['usluga.baza']);
  });
});

describe('powtórzenia', () => {
  it('milczą w oknie ciszy', async () => {
    const { alerts, wyslane } = zestaw();

    // Tak wygląda trwająca awaria widziana przez dozór co minutę.
    for (let i = 0; i < 30; i += 1) await alerts.zglos(awaria());

    expect(wyslane).toHaveLength(1);
  });

  it('po ciszy wychodzą jedną wiadomością z liczbą wystąpień', async () => {
    vi.useFakeTimers();
    const { alerts, wyslane } = zestaw();

    await alerts.zglos(awaria());
    for (let i = 0; i < 5; i += 1) await alerts.zglos(awaria());

    vi.setSystemTime(new Date(Date.now() + GODZINA + 1_000));
    await alerts.zglos(awaria());

    expect(wyslane).toHaveLength(2);
    // Liczba jest tu jedyną informacją mówiącą, czy awaria trwa, czy mrugnęła raz.
    expect(wyslane[1].text).toContain('6 razy');
  });

  it('inna awaria przechodzi mimo ciszy na pierwszej', async () => {
    const { alerts, wyslane } = zestaw();

    await alerts.zglos(awaria('usluga.baza'));
    await alerts.zglos(awaria('usluga.baza'));
    await alerts.zglos(awaria('usluga.redis'));

    expect(wyslane).toHaveLength(2);
  });
});

describe('odwołanie alarmu', () => {
  it('idzie tylko wtedy, gdy było co odwoływać', async () => {
    const { alerts, wyslane } = zestaw();

    await alerts.ustapilo('usluga.baza', 'Baza znów odpowiada', ['—']);

    // „Wróciło do normy" bez wcześniejszej awarii jest wyłącznie szumem.
    expect(wyslane).toHaveLength(0);
  });

  it('zamyka alarm i zdejmuje go z listy trwających', async () => {
    const { alerts, wyslane } = zestaw();

    await alerts.zglos(awaria());
    await alerts.ustapilo('usluga.baza', 'Baza znów odpowiada', ['—']);

    expect(wyslane).toHaveLength(2);
    expect(alerts.trwajace).toEqual([]);
  });

  it('po odwołaniu ta sama awaria znów alarmuje od razu', async () => {
    const { alerts, wyslane } = zestaw();

    await alerts.zglos(awaria());
    await alerts.ustapilo('usluga.baza', 'Baza znów odpowiada', ['—']);
    await alerts.zglos(awaria());

    // Awaria, która wróciła po naprawie, jest nową awarią — cisza z poprzedniej
    // nie może jej wyciszyć.
    expect(wyslane).toHaveLength(3);
  });
});

describe('dozór nad zadaniem cyklicznym', () => {
  it('zgłasza wywrotkę zamiast zostawić odrzuconą obietnicę', async () => {
    const { alerts, wyslane } = zestaw();

    await alerts.pilnuj('uzgadnianie', async () => {
      throw new Error('operator nie odpowiada');
    });

    expect(wyslane).toHaveLength(1);
    expect(wyslane[0].text).toContain('operator nie odpowiada');
  });

  it('nie przepuszcza wyjątku dalej', async () => {
    const { alerts } = zestaw();

    // Zadanie z zegara nie ma komu rzucić wyjątkiem — zostawiłoby odrzuconą
    // obietnicę, a przy ustawieniach Node potrafi to zabić proces.
    await expect(
      alerts.pilnuj('uzgadnianie', async () => {
        throw new Error('cokolwiek');
      }),
    ).resolves.toBeUndefined();
  });

  it('odwołuje alarm, gdy zadanie znów się uda', async () => {
    const { alerts, wyslane } = zestaw();

    await alerts.pilnuj('uzgadnianie', async () => {
      throw new Error('padło');
    });
    await alerts.pilnuj('uzgadnianie', async () => undefined);

    expect(wyslane).toHaveLength(2);
    expect(wyslane[1].subject).toContain('znów działa');
    expect(alerts.trwajace).toEqual([]);
  });

  it('milczy, gdy zadanie działa i wcześniej nie padło', async () => {
    const { alerts, wyslane } = zestaw();

    await alerts.pilnuj('uzgadnianie', async () => undefined);

    expect(wyslane).toHaveLength(0);
  });
});

describe('awaria samego alarmowania', () => {
  it('nie wywraca operacji, w której się dzieje', async () => {
    const { alerts } = zestaw(async () => {
      throw new Error('SMTP leży');
    });

    // Nieudany alarm jest do naprawienia. Przerwane zamówienie kelnera — nie.
    await expect(alerts.zglos(awaria())).resolves.toBeUndefined();
  });
});
