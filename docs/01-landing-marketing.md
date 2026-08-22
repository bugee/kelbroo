# System 1 — Strona produktowa i zakup abonamentu

> Aplikacja: `apps/web-marketing` · Next.js (SSG/ISR) · Odbiorca: właściciele/managerowie restauracji (leady B2B)
> Kontekst: [product.md](product.md) · [architecture.md](architecture.md)

## 1. Cel

Publiczna strona, która wyjaśnia wartość kelbroo właścicielowi restauracji, buduje zaufanie, przedstawia cennik i przeprowadza użytkownika przez rejestrację oraz zakup abonamentu — kończąc w panelu zarządzania ([System 2](02-admin-panel.md)).

**Główny cel konwersji:** rozpoczęcie 14-dniowego okresu próbnego.
**Drugorzędny:** umówienie prezentacji (demo) dla większych sieci.

## 2. Struktura strony

| Ścieżka | Strona | Typ renderowania |
|---|---|---|
| `/` | Strona główna | SSG |
| `/funkcje` | Funkcje produktu (szczegółowo) | SSG |
| `/dla-kogo/[segment]` | Landing per segment (restauracja, kawiarnia, bar, hotel, food court) | SSG |
| `/cennik` | Cennik i porównanie planów | SSG |
| `/demo` | Interaktywne demo menu (przykładowa restauracja) | SSG + klient |
| `/kontakt` | Formularz kontaktowy / umów prezentację | SSG |
| `/blog`, `/blog/[slug]` | Treści SEO (poradniki dla gastronomii) | ISR |
| `/pomoc`, `/pomoc/[slug]` | Baza wiedzy / dokumentacja dla klientów | ISR |
| `/rejestracja` | Utworzenie konta | SSR (dynamiczne) |
| `/logowanie` | Logowanie → przekierowanie do panelu | SSR |
| `/checkout/[plan]` | Wybór planu i płatność | SSR |
| `/checkout/sukces` | Potwierdzenie i przejście do onboardingu | SSR |
| `/regulamin`, `/prywatnosc`, `/rodo` | Dokumenty prawne | SSG |

## 3. Strona główna — sekcje (w kolejności)

1. **Hero** — nagłówek z jasną propozycją wartości ("Twoi goście zamawiają z telefonu. Ty skupiasz się na gotowaniu."), podnagłówek, CTA "Wypróbuj 14 dni za darmo" + "Zobacz demo", wizualizacja: telefon z menu obok tabletu z panelem kuchni.
2. **Pasek zaufania** — logotypy restauracji korzystających z kelbroo (lub "Zaufało nam już X lokali").
3. **Problem → rozwiązanie** — 3 bolączki gastronomii (kolejki do kelnera, błędy w zamówieniach, koszt druku menu) zestawione z odpowiedzią kelbroo.
4. **Jak to działa** — 4 kroki z ilustracjami: Zeskanuj QR → Zamów → Kuchnia dostaje zamówienie → Kelner przynosi.
5. **Kluczowe funkcje** — siatka kafelków: menu wielojęzyczne, płatności BLIK/karta, panel kuchni, generowanie kodów QR, oceny dań, analityka.
6. **Korzyści liczbowe** — mierzalne efekty (krótszy czas obsługi, wyższa średnia wartość zamówienia, oszczędność na druku menu). *Wymaga realnych danych z pilotażu przed publikacją — nie wymyślać liczb.*
7. **Interaktywne demo** — osadzony podgląd menu gościa, klikalny bezpośrednio na stronie.
8. **Opinie klientów** — cytaty właścicieli restauracji ze zdjęciem i nazwą lokalu.
9. **Cennik (skrót)** — trzy plany z CTA do pełnego cennika.
10. **FAQ** — najczęstsze obiekcje (patrz §6).
11. **CTA końcowe** — powtórzenie głównego wezwania do działania.
12. **Stopka** — nawigacja, dane firmy, kontakt, social media, dokumenty prawne.

## 4. Strona cennika

Źródło cen: [product.md §5](product.md#5-model-biznesowy-i-cennik). Ceny prezentowane **netto**, z wyraźną adnotacją „+ VAT" — odbiorcą jest firma.

- Przełącznik **miesięcznie / rocznie** (rocznie −17%, czyli 2 miesiące gratis), z wyróżnieniem oszczędności.
- Cztery karty planów:

  | | Menu | Starter | Pro | Enterprise |
  |---|---|---|---|---|
  | Miesięcznie | 0 zł | 159 zł | **349 zł** | od 899 zł |
  | Rocznie (za mies.) | 0 zł | 132 zł | **291 zł** | indywidualnie |

- **Pro oznaczony jako „Najpopularniejszy"** i wizualnie wyróżniony — kotwica cenowa.
- Każda karta: cena, dla kogo, limit stolików i języków, lista funkcji, CTA.
- Enterprise: zamiast ceny — „Wyceniana indywidualnie" + CTA „Porozmawiajmy".
- **Tabela porównawcza** wszystkich funkcji (rozwijana) — pełna macierz z [product.md §5.1](product.md#51-plany).
- **Sekcja dodatków** (+10 stolików, dodatkowy język, integracja z kasą fiskalną, wdrożenie pod klucz) — z [product.md §5.2](product.md#52-dodatki-płatne-add-ony).
- **Kalkulator zwrotu (ROI)** — użytkownik podaje liczbę stolików i średni obrót, widzi szacowaną oszczędność. Element mocno zwiększający konwersję w SaaS B2B.
- Sekcja FAQ o rozliczeniach (VAT, faktury, wypowiedzenie, zmiana planu).
- Wyraźnie wyeksponowane: **0% prowizji od zamówień**, **bez umowy na czas określony**, **14 dni Pro za darmo bez karty**.

### 4.1 Komunikacja trybu „płatność u kelnera"

Możliwość działania **bez płatności online** to wyróżnik sprzedażowy, nie ograniczenie — i tak musi być prezentowana. Wiele restauracji z pełną obsługą kelnerską nie chce zmieniać obiegu płatności ani kasy fiskalnej, a to właśnie ta obiekcja najczęściej blokuje zakup systemów zamówieniowych.

Przekaz na stronie:
- Osobna sekcja: **„Nie musisz zmieniać sposobu płatności"** — goście zamawiają z telefonu, płacą kelnerowi jak dotąd, kasa fiskalna i procedury zostają bez zmian.
- Wyraźnie: w tym trybie **nie ma żadnych opłat transakcyjnych** — restauracja płaci wyłącznie abonament.
- Wdrożenie w jeden dzień, bez integracji z kasą i bez zmian księgowych.
- Na stronie cennika i w porównaniu planów oba tryby pokazane jako równoprawne funkcje, dostępne od planu Starter.
- W FAQ: „Czy muszę przyjmować płatności online?" → **Nie.**

## 5. Ścieżka rejestracji i zakupu

```
/cennik → wybór planu
   ↓
/rejestracja   ← e-mail, hasło, nazwa restauracji, telefon
   ↓  (utworzenie Organization + Subscription w statusie `trialing`)
Weryfikacja e-mail (link aktywacyjny)
   ↓
/checkout/[plan]   ← Stripe Checkout / Elements: dane karty + dane do faktury (NIP)
   ↓  (webhook Stripe → subscription: active|trialing)
/checkout/sukces   → CTA "Skonfiguruj restaurację"
   ↓
Panel admina — onboarding (System 2)
```

Zasady:
- Trial 14 dni startuje **od rejestracji**, nie od podania karty — użytkownik może wejść do panelu przed checkoutem.
- Przypomnienia e-mail: 3 dni przed końcem trialu, w dniu zakończenia, 3 dni po (win-back).
- Zmiana planu i anulowanie: przez Stripe Customer Portal osadzony w panelu admina.
- Faktury VAT generowane automatycznie, dostępne w panelu i wysyłane mailem.

## 6. FAQ — obiekcje do zaadresowania

- Czy goście muszą instalować aplikację? — **Nie.** Skan QR otwiera stronę w przeglądarce.
- Czy potrzebuję nowego sprzętu? — Wystarczy dowolny tablet lub komputer z przeglądarką.
- Co jeśli padnie internet? — Panel obsługi działa offline i synchronizuje po powrocie sieci.
- Czy to zastąpi kelnerów? — Nie, odciąża ich od przyjmowania zamówień i rozliczeń.
- **Czy muszę przyjmować płatności online?** — Nie. Możesz włączyć tryb, w którym goście tylko zamawiają, a płacą kelnerowi po posiłku — tak jak dotychczas.
- **Czy mogę potwierdzać zamówienia przed wysłaniem ich na kuchnię?** — Tak, kelner może zatwierdzać każde zamówienie przy stoliku.
- Jak działa fiskalizacja/paragony? — W trybie płatności u kelnera paragon wystawiasz na swojej kasie, tak jak zawsze. Przy płatnościach online dostępna jest integracja z Twoją kasą fiskalną. *(Treść do finalizacji po decyzji z [architecture.md §12](architecture.md#12-fiskalizacja-i-paragony-polska).)*
- Czy mogę używać własnego brandingu? — Tak, logo i kolory w menu gościa.
- Ile trwa wdrożenie? — Konfiguracja menu i wydruk QR: jeden dzień.
- Czy mogę zrezygnować? — Tak, w dowolnym momencie, bez okresu wypowiedzenia.

## 7. Wymagania SEO i wydajnościowe

- **Docelowe frazy:** "menu QR restauracja", "zamawianie przy stoliku", "elektroniczne menu", "system zamówień dla restauracji", "menu cyfrowe kod QR".
- Metadane, Open Graph, dane strukturalne JSON-LD (`SoftwareApplication`, `Product` z cenami, `FAQPage`, `Organization`).
- `sitemap.xml`, `robots.txt`, kanoniczne URL-e.
- **Core Web Vitals:** LCP < 2.0s, CLS < 0.1, INP < 200ms. Obrazy `next/image` (AVIF/WebP), fonty lokalne.
- Wersje językowe: `pl` (główna) i `en` z `hreflang` — przygotowanie pod ekspansję.
- Blog jako główny kanał pozyskiwania ruchu organicznego (poradniki dla restauratorów).

## 8. Analityka i integracje

- Analityka produktowa zgodna z RODO (np. Plausible lub GA4 z consent mode) + banner zgody na cookies.
- Śledzone zdarzenia: `view_pricing`, `start_trial`, `signup_completed`, `checkout_started`, `subscription_activated`, `demo_opened`, `contact_form_submitted`.
- Formularz kontaktowy → CRM lub e-mail sprzedaży + potwierdzenie do klienta.
- Widget czatu / kontakt na WhatsApp (opcjonalnie, faza 2).

## 9. Kryteria akceptacji

- [ ] Strona główna i cennik osiągają wynik Lighthouse ≥ 90 we wszystkich kategoriach.
- [ ] Pełna ścieżka rejestracja → checkout → panel działa na kartach testowych Stripe.
- [ ] Trial aktywuje się bez podania karty i poprawnie wygasa po 14 dniach.
- [ ] Faktura VAT z NIP-em generuje się automatycznie po pierwszej płatności.
- [ ] Strona jest w pełni responsywna (właściciele restauracji często przeglądają na telefonie).
- [ ] Interaktywne demo prezentuje realną apkę gościa, nie zrzuty ekranu.
- [ ] Wszystkie treści dostępne w `pl`, kluczowe strony także w `en`.
