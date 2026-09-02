# Obsługa zamówień na zmianie

Trzy ekrany w górnym pasku i każdy odpowiada innej roli przy pracy. Liczba przy
nazwie mówi, ile rzeczy czeka.

## Powiadomienia

Wszystko, co wymaga decyzji człowieka: zamówienia czekające na potwierdzenie,
wezwania kelnera i prośby o rachunek. Goście proszący o wpuszczenie do stolika
też trafiają tutaj.

Jeśli w ustawieniach lokalu masz włączone **potwierdzanie zamówień**, nic nie
trafi na kuchnię, dopóki obsługa nie przyjmie zamówienia z tego ekranu. Przy
wyłączonym — zamówienie idzie na kuchnię od razu, a ten ekran pokazuje wyłącznie
wezwania i prośby o rachunek.

### Co gość wybrał, prosząc o rachunek

Przy prośbie o rachunek pytamy gościa o trzy rzeczy i wszystkie trzy stoją
wytłuszczone przy zgłoszeniu, w tej samej kolejności, w jakiej je wyklikał:

`Każdy za siebie · kartą · faktura VAT`

1. **Sposób podziału** — jeden rachunek, każdy za siebie albo po równo. Mówi,
   ile wydruków wziąć ze sobą.
2. **Forma płatności** — kartą, gotówką albo obie naraz. Mówi, czy brać terminal.
3. **Faktura VAT** — pojawia się tylko wtedy, gdy gość o nią poprosił. Danych
   do faktury nie zbieramy w aplikacji: bierzesz je przy stoliku.

To samo zdanie widzisz na **Sali**, przy karcie stolika — kelner pracujący z sali
nie musi wracać do Powiadomień. Pojawia się dopiero po prośbie o rachunek;
dopóki jej nie ma, nie ma czego pokazywać.

## Kuchnia

Ekran dla osoby przy wydawce. Widać na nim wyłącznie zamówienia **już potwierdzone** —
te, które przeszły bramkę. Zamówienie czekające na potwierdzenie kelnera nigdy się
tu nie pojawi, więc kuchnia nie gotuje niczego, co może jeszcze zniknąć.

Ekran odświeża się sam. Nie trzeba go przeładowywać.

## Sala

Widok wszystkich stolików naraz — to na nim spędza się większość zmiany.

Stolik **wolny** pokazuje „Nikt jeszcze nie zeskanował kodu przy tym stoliku”
i dwie możliwości:

- **Otwórz stolik** — zaczyna wizytę bez udziału gościa. Przydaje się, gdy goście
  usiedli i wolą zamówić u kelnera.
- **Zamów** — składasz zamówienie w imieniu gościa.

Stolik **zajęty** pokazuje, ile trwa wizyta, ilu jest gości, kwotę **Do zapłaty**
oraz znaki rozpoznawcze gości (nick i symbol). Gospodarz wizyty ma przy nicku
oznaczenie `host`.

Jeśli goście poprosili o rachunek, pod kwotą stoi ich deklaracja — podział,
forma płatności i faktura, dokładnie ta sama, którą widać w Powiadomieniach.

Gość, który zamknął kartę w przeglądarce, **nie musi skanować kodu ponownie** —
wchodząc na `menu.kelbroo.com` wraca do swojej wizyty razem z historią zamówień,
dopóki rachunek jest otwarty. Po rozliczeniu widzi już tylko prośbę o skan.

Nick jest losowany przy wejściu („Wesoły Borsuk"), ale gość może raz wpisać
własny. Symbolu i koloru nie wybiera — one służą do wypowiedzenia przy stoliku
(„ten z żółtym samochodzikiem") i muszą pozostać niepowtarzalne.

Dostępne działania:

- **Zamów** — dokładka albo zamówienie za gościa.
- **Podgląd zamówienia** — co zamówiono, w rozbiciu na gości albo na kategorie
  i dania.
- **Gotówka** / **Terminal** — rozliczenie wizyty. Wybór zapisuje sposób zapłaty
  w historii.
- **Przesadź gości** — goście przenoszą się przy inny stolik (patrz niżej).
- **Zablokuj na 2 min** — chwilowo wstrzymuje nowe zamówienia z tego stolika.
- **Sprzątnij stolik** — zamyka wizytę i przygotowuje stolik na kolejnych gości.

## Przesiadka gości

Zrobiło się głośno, świeci słońce, dosiadła się piątka znajomych — **Przesadź
gości** przenosi całą wizytę przy inny stolik. Wybierasz go z listy wolnych.

Idzie za nimi wszystko: rachunek z dotychczasowym numerem, wszyscy goście,
złożone zamówienia i podział rachunku, jeśli był już ustawiony. **Nie trzeba nic
rozliczać ani otwierać od nowa.**

Zamówienia będące w kuchni dostają nowy numer stolika, więc kelner wydający
z ekranu kuchni zaniesie je pod właściwy stół. W historii zamówienia zostaje wpis,
kto i kiedy przesadził gości.

**Stary stolik zwalnia się od razu** — także wtedy, gdy była na nim blokada. Można
przy nim od razu posadzić następnych gości.

Goście nie muszą nic robić. Telefony, które mają otwartą kartę, same pokażą nowy
numer stolika. Gość, który wróci pod stary kod QR — bo odświeży kartę sprzed
przesiadki — zobaczy komunikat o przesiadce i zostanie przeniesiony do swojego
rachunku.

Czego przesiadka **nie** zrobi: nie połączy dwóch rachunków. Jeśli przy docelowym
stoliku trwa inna wizyta, kelbroo odmówi — dwa rachunki przy jednym stole to
osobna decyzja, a nie skutek uboczny przesiadki.

## Sygnał dźwiękowy

Panel daje krótki sygnał, gdy pojawi się **nowa praca do podjęcia** — zamówienie
do potwierdzenia, wezwanie kelnera albo nowy bon w kuchni. Sygnał gra niezależnie
od tego, który ekran masz otwarty, więc kelner stojący na Sali usłyszy zamówienie
czekające w Powiadomieniach.

**Dzwonek w prawym górnym rogu** włącza go i wyłącza. Ustawienie zapamiętuje się
**na Twoim koncie**, nie w przeglądarce — logując się na innym tablecie, masz je
takie samo.

**Pomarańczowa kropka przy dzwonku** znaczy: dźwięk jest włączony, ale przeglądarka
czeka na pierwsze dotknięcie ekranu. Tak działają wszystkie przeglądarki i nie da
się tego obejść — wystarczy stuknąć w cokolwiek na starcie zmiany, a kropka zniknie.
**Zrób to, zanim zaczniesz przyjmować zamówienia**, bo do tego czasu panel milczy.

Sygnał odzywa się tylko wtedy, gdy pracy **przybywa**. Odebranie zamówienia go nie
uruchamia, a wejście na ekran z pięcioma zamówieniami w kolejce nie wita Cię dzwonkiem.

## Podział rachunku

Na ekranie wizyty (**Podziel rachunek** przy stoliku) wybierasz sposób:

- **Jeden rachunek** — bez podziału.
- **Każdy za siebie** — każdy płaci za to, co zamówił.
- **Po pozycjach** — przypisujesz pozycje ręcznie, z możliwością podzielenia jednej
  między kilka osób (niżej).
- **Po równo** — suma dzielona przez liczbę gości.
- **Grupami** — układasz, kto z kim płaci.

### Po pozycjach

Stukasz gościa przy pozycji, żeby mu ją przypisać; drugie stuknięcie odpina.
Kilku gości przy jednej pozycji dzieli ją **na części** — plusem zwiększasz czyjś
udział. Dwie części z trzech przy butelce wina to dwie trzecie ceny, a kwota pod
znakiem gościa pokazuje, ile z tego wyszło.

Dwie rzeczy działają tu inaczej niż w pozostałych trybach:

- **Pozycja bez adresata blokuje rozliczenie.** Widać ją na pomarańczowo, z licznikiem
  „Do przypisania". Nie doliczamy jej po cichu gospodarzowi — pominięta pozycja to
  przeoczenie, a nie decyzja.
- **Przypisania przeżywają dokładkę.** Deser zamówiony po ustaleniu podziału nie kasuje
  Twojej pracy — wchodzi jako nieprzypisany i czeka.

Podziału nie da się zmienić po pierwszej płatności. Przeliczenie kwoty komuś, kto już
uregulował swoją część, byłoby cichą zmianą rachunku po fakcie.

## Zestawienie na e-mail dla gościa

Gość może wysłać sobie na e-mail zestawienie **kto co zamówił** — z podziałem na
osoby przy stoliku, sumą, nazwą lokalu, numerem stolika i datą. Robi to sam
w aplikacji: przy rachunku albo po jego rozliczeniu.

Po co: kolację służbową płaci jedna osoba, a rozliczyć trzeba całą delegację.
Dlatego **każdy przy stoliku wysyła sobie własną kopię**, niezależnie od tego, kto
zapłacił.

Nie musisz nic robić i nic nie ustawiasz. Warto natomiast wiedzieć dwie rzeczy,
bo goście o nie pytają:

- **Zestawienie nie jest paragonem fiskalnym** i mówi to wprost w treści. Paragon
  wystawia kasa lokalu.
- **Adresu nie zapisujemy** — ani my, ani aplikacja w telefonie gościa. Idzie
  jednorazowo do wysłania wiadomości i znika. Nie trafia do żadnej listy mailowej.

## Sprzedaż

**Ustawienia → Sprzedaż.** Widzą ją właściciel i manager; kelner i kuchnia nie.

Do wyboru trzy okresy: **dziś**, **7 dni**, **30 dni**. Na górze kwota sprzedaży,
liczba zamówień i średnie zamówienie. Niżej: sprzedaż dzień po dniu, ranking dań,
pozycje z karty, których **nikt nie zamówił**, i rozkład godzinowy.

Dwie rzeczy warto wiedzieć, żeby liczby się zgadzały z tym, co pamiętasz ze zmiany:

- **Liczymy po dobie biznesowej, nie po kalendarzu.** Zamówienie o 00:30 należy do
  wieczoru, który się jeszcze nie skończył — tak samo jak numeracja rachunków.
  Godzinę przełomu ustawiasz w ustawieniach lokalu.
- **Zamówienia odrzucone i anulowane nie wchodzą** do sprzedaży. To ta sama reguła,
  którą liczy się rachunek stolika.

### Eksport do arkusza

W planie Pro i wyższych pod nagłówkiem są przyciski **Pobierz dzień po dniu**
i **Pobierz ranking dań**. Plik CSV otwiera się bezpośrednio w Excelu i Arkuszach
Google — ma polski separator i przecinek dziesiętny, więc liczby wchodzą jako
liczby, a nie jako tekst.

Dwa osobne pliki zamiast jednego: arkusz nie radzi sobie z plikiem, w którym
w połowie zmienia się liczba kolumn.

## Paragon i kasa fiskalna

kelbroo **nie wystawia paragonów i nie zastępuje kasy fiskalnej**. Na ekranie Sala
stoi to zresztą wprost: „Paragon fiskalny wystawia kasa lokalu”. Zapis płatności
w kelbroo służy raportom i rozliczeniu zmiany, a nie ewidencji fiskalnej.

## Gdy padnie internet

Panel i aplikacja gościa **wymagają połączenia**. Przy jego braku zobaczysz
komunikat, a nie pusty ekran, ale zamówienia nie da się wtedy złożyć ani
potwierdzić.

Nie planujemy pracy bez sieci — to świadoma decyzja, a nie brak do nadrobienia.
Jeśli wi-fi w lokalu bywa zawodne, warto mieć na tablecie zapasowy internet
z telefonu.
