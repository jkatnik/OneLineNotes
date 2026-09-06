# Plan implementacji — Karteczki

## Wymagania (zebrane z rozmowy)

1. Desklet renderujący karteczkę w kształcie/kolorze fizycznego kartonika,
   na podstawie zdjęcia JPG/PNG.
2. Pozycja "Dodaj karteczkę" w menu kontekstowym pulpitu Cinnamon.
3. Czcionka Caveat, kolor niebieskiego atramentu.
4. Karteczka przeciągalna (drag-and-drop) po pulpicie.
5. Menu kontekstowe karteczki: "usuń", "nowa karteczka".
6. Tekst edytowany inline, w treści.
7. Treść w formacie Markdown (bez renderowania formatowania — patrz
   AGENTS.md, sekcja YAGNI).
8. Zapis: jeden plik JSON na karteczkę w `~/.local/share/karteczki/`.
9. Schemat JSON: treść, kolor, czcionka, pozycja, data utworzenia, data
   modyfikacji, tło.

## Status (ostatnia aktualizacja: 2026-09-06)

- ✅ Zdjęcie fizycznej karteczki dostarczone i przetworzone —
  `assets/karteczka-bristol.png` (995×388, przezroczyste tło, realna
  faktura papieru wycięta maską wielokąta, syntetyczny cień). Gotowe do
  użycia w Fazie 4, placeholder nie jest już potrzebny.
- ✅ Faza 0 — format potwierdzony eksperymentalnie: `UUID:instance_id:X:Y`
  (zweryfikowane przez tymczasowe dodanie `clock@cinnamon.org` przez
  gsettings). Nemo `.nemo_action` na tle pulpitu — plik utworzony, **nie
  zweryfikowane ręcznie przez kliknięcie** (do potwierdzenia przez
  użytkownika).
- ✅ Faza 1 — szkielet desletu (`karteczki@jkatnik/`) działa, symlink w
  `~/.local/share/cinnamon/desklets/`, potwierdzone w logu Cinnamona:
  `Loaded desklet karteczki@jkatnik`, bez błędów po restarcie.
- ✅ Faza 2 — `bin/karteczki_common.py` (CRUD: tworzenie/kasowanie notatki +
  wpis gsettings), pokryte testami `tests/test_karteczki_common.py`
  (unittest, 6 testów, gsettings zamockowane). Zapis pozycji po
  przeciągnięciu i zapis treści po utracie fokusu podpięte w `desklet.js`.
- ✅ Faza 3 (częściowo) — menu kontekstowe karteczki ("Usuń", "Nowa
  karteczka") w `desklet.js`, wpis Nemo w
  `~/.local/share/nemo/actions/dodaj-karteczke.nemo_action`.
- ⬜ Faza 4 (dopracowanie wyglądu, np. 9-slice) i Faza 5 (README,
  scenariusz testowy) — nie zaczęte.
- **Znalezione i naprawione błędy (weryfikacja na żywym Cinnamonie +
  zrzuty ekranu):**
  1. `Clutter.Color` nie ma metody instancyjnej `from_string` — to
     statyczna funkcja zwracająca `[ok, color]`. Błędna wersja **wywalała
     Cinnamona (SIGSEGV, dwukrotnie)** — sesja ręcznie zrestartowana
     (`cinnamon --replace`).
  2. Tło karteczki jako CSS `background-image` na `St.Bin` nie renderowało
     się wiarygodnie — zastąpione sprawdzonym wzorcem z zainstalowanego
     `notes@schorschii` (GdkPixbuf → `Clutter.Image` → `Clutter.Actor`).
  3. `Clutter.Text` z `editable:true` nie łapie fokusu klawiatury samym
     kliknięciem — dodano `grab_key_focus()` w handlerze
     `button-press-event` (z `Clutter.EVENT_STOP`, żeby klik w tekst nie
     uruchamiał przeciągania całego desletu).
  4. Tekst wyśrodkowany pionowo na karteczce (na życzenie użytkownika) —
     `Clutter.BinLayout` + `y_align: Clutter.ActorAlign.CENTER` zamiast
     stałej pozycji od góry.
  - Wszystko zweryfikowane wizualnie zrzutem ekranu głównego pulpitu i
    testem edycji tekstu przez `xdotool` — karteczka renderuje się
    poprawnie, tekst edytowalny i zapisywany po utracie fokusu.
- **Otwarte:** dokładny odcień "niebieskiego atramentu" nie potwierdzony
  przez użytkownika — roboczo `#1a3fae`. Rozmiar karteczki na pulpicie
  (obecnie 260×101 px) też roboczy. Font Caveat nie zainstalowany na tej
  maszynie — tekst renderuje się domyślnym fontem systemowym do czasu
  ręcznej instalacji.

- **Naprawiony bug (2026-09-06, po restarcie komputera): edycja inline nie
  działała w ogóle.** Klik w tekst ustawiał wewnętrzny fokus Cluttera, ale
  nie przenosił realnego fokusu klawiatury X11 na powłokę Cinnamona (okno
  pulpitu jest typu `_NET_WM_WINDOW_TYPE_DESKTOP` i nie dostaje fokusu
  przez zwykłe click-to-focus WM) — wpisywane znaki leciały do ostatnio
  aktywnego okna. Naprawa: `Main.pushModal(this._text)` przy kliknięciu +
  `_startEditing`/`_stopEditing` z nasłuchem kliknięcia poza karteczką i
  obsługą Escape (bo `pushModal` robi pełny grab X11, trzeba go świadomie
  zwalniać). Zweryfikowane end-to-end przez `xdotool` + D-Bus Eval na
  żywym Cinnamonie, bez restartu powłoki.
- **Tło zaktualizowane na `karteczka-bristol-2.png`** (dostarczony przez
  użytkownika, stary `img/karteczka-bristol.png` usunięty jako nieużywany).
  Płaski wygląd karty przy silnym pomniejszeniu (2172×724 → ~256×100,
  >8×) to efekt uśredniania pikseli przy skalowaniu, nie wada pliku — w
  oryginale faktura papieru jest widoczna (subtelna, niski kontrast).
  Naprawiono w `desklet.js` (`boostTexture()`): lokalny unsharp mask
  (separowalny box blur promień 2 jako "tło" + wzmocnienie różnicy
  piksel-minus-tło, `TEXTURE_SHARPEN_FACTOR = 6`). Pierwsza wersja robiła
  globalny rozciąg kontrastu wokół jednej średniej dla całej karty — cień
  na brzegu ciągnął średnią w dół i obcinał jasne piksele karty do bieli
  (znów płasko, tylko biało zamiast szaro). **Zaakceptowane przez
  użytkownika jako wystarczające** — efekt wyostrzenia jest subtelny
  (fundamentalne ograniczenie: ~5 poziomów szarości oryginalnej faktury na
  256×100 px karcie, algorytm nie odtworzy informacji utraconej przy
  tak mocnym pomniejszeniu bez utraty naturalnego wyglądu). Ewentualne
  dalsze wzmocnienie: zwiększyć `CARD_WIDTH`/`CARD_HEIGHT` (więcej
  pikseli źródłowych na kartę) albo podnieść `TEXTURE_SHARPEN_FACTOR`
  kosztem ryzyka artefaktów na krawędziach.

- **Dopracowanie odstępów tekstu (2026-09-06):** lewy padding zmniejszony
  o połowę (45→23px), a górny/dolny margines tekstu wyzerowany (było
  asymetryczne 14/26, co przesuwało tekst poza prawdziwy środek mimo
  `y_align: CENTER` — margines dolny większy niż górny ciągnął box tekstu
  w dół przed wyśrodkowaniem). Zweryfikowane wizualnie na żywym pulpicie.

- **Naprawiony bug: nie dało się wejść w edycję pustej karteczki.**
  Przyczyna: klikalny handler siedział na `_text` (`Clutter.Text`), a
  pusty tekst ma prawie zerową naturalną wysokość (Pango nie ma czego
  zmierzyć), więc jego hit-box praktycznie znikał — kliknięcie nigdy nie
  trafiało w aktor tekstu. Naprawa: `button-press-event` przeniesiony na
  `_container` (stały rozmiar 350×100, zawsze pełny obszar klikalny).
  Przy okazji poprawiono też test „kliknięcie poza kartą” w
  `_startEditing()` — zamiast porównania `event.get_source() !== _text`
  (które fałszywie kończyłoby edycję przy każdym kliknięciu w środek
  pustej/krótkiej karty, bo trafiałoby w `_container`, nie w `_text`) jest
  teraz `!this._container.contains(event.get_source())` — sprawdza całe
  poddrzewo karty, nie jeden konkretny aktor. Zweryfikowane end-to-end:
  klik na pustej karcie → edycja, klik w środku podczas edycji → edycja
  trwa, klik na zewnątrz → zapis i koniec edycji.

- **Naprawiony regres: D&D i menu kontekstowe przestały działać** po
  poprzedniej poprawce (handler `button-press-event` na `_container`,
  zawsze zwracający `Clutter.EVENT_STOP`). Przyczyna: Cinnamon-owy D&D
  (`imports.ui.dnd`) i przełączanie menu (`_onButtonReleaseEvent` w
  bazowym `Desklet.Desklet`) nasłuchują na `this.actor` — **przodku**
  naszego `_container` w drzewie aktorów. `EVENT_STOP` na dziecku
  zatrzymuje event przed dotarciem do rodzica, więc żadna z tych dwóch
  wbudowanych funkcji nigdy nie widziała kliknięcia. Naprawa: usunięty
  ręczny handler na `_container`, zamiast tego nadpisana metoda
  `on_desklet_clicked(event)` — dedykowany hook z bazowej klasy
  `Desklet.Desklet`, wywoływany przez Cinnamona TYLKO dla "prawdziwego"
  kliknięcia (bez przekroczenia progu przeciągnięcia) i z pominięciem
  prawoklika — dokładnie to, czego trzeba, bez ręcznego zarządzania
  propagacją zdarzeń. Przy okazji to naturalnie rozwiązuje też przypadek
  pustej karteczki, bo `on_desklet_clicked` odpala się dla kliknięcia
  gdziekolwiek na `this.actor`, niezależnie od (pustego) rozmiaru
  `_text`. Zweryfikowane end-to-end przez `xdotool` (symulacja
  mousedown/mousemove/mouseup + odczyt stanu `_draggable` przez D-Bus
  Eval): przeciąganie zmienia pozycję w `enabled-desklets`, prawoklik
  otwiera menu bez wchodzenia w tryb edycji, klik na pustej karcie wciąż
  wchodzi w edycję.
  Uboczna obserwacja (nie wymaga akcji): natywna obsługa kliknięcia w
  `Clutter.Text` (editable+selectable) sama łapie `button-press-event` w
  obrębie własnego hit-boxa tekstu i nie przepuszcza go do D&D — więc przy
  karteczce z długą treścią przeciąganie działa tylko z obszaru karty
  POZA tekstem (marginesy), a kliknięcie w sam tekst nadal edytuje. To
  standardowe zachowanie edytowalnego tekstu w Clutter, nie bug tego kodu.

## Wejście brakujące od użytkownika

- **Dokładny odcień "niebieskiego atramentu"** — do czasu decyzji przyjęty
  domyślny `#1a3fae`.

## Struktura plików docelowych

```
karteczki@jkatnik/                          # katalog desletu
├── metadata.json
├── desklet.js
├── settings-schema.json                    # (jeśli potrzebne ustawienia globalne)
└── icon.png

bin/
└── karteczki-nowa                          # skrypt: tworzy JSON + wpis gsettings

~/.local/share/nemo/actions/
└── dodaj-karteczke.nemo_action             # wpis menu kontekstowego pulpitu

~/.local/share/karteczki/
└── <uuid>.json                             # dane jednej karteczki
```

## Schemat pliku karteczki (JSON)

```json
{
  "id": "uuid-v4",
  "content": "tekst w **Markdown**",
  "color": "#1a3fae",
  "font": "Caveat",
  "background": "sticky-yellow.png",
  "position": { "x": 100, "y": 100 },
  "created_at": "2026-09-06T12:00:00+02:00",
  "modified_at": "2026-09-06T12:00:00+02:00"
}
```

## Fazy

### Faza 0 — rozpoznanie środowiska (rychło, przed kodem)
- Dodać dowolny istniejący desklet przez `cinnamon-settings desklets`,
  potwierdzić realny format wpisu w `gsettings get org.cinnamon
  enabled-desklets`, zapisać przykład w AGENTS.md.
- Sprawdzić, czy Nemo w tej instalacji Cinnamona faktycznie obsługuje
  `.nemo_action` na tle pulpitu (nie tylko na plikach) — jeśli pulpit nie
  jest renderowany przez Nemo tylko przez coś innego, trzeba to
  zweryfikować zanim zaprojektujemy krok 2.

### Faza 1 — szkielet desletu
- `metadata.json` z `multiInstance: true`, `decoration: false`.
- `desklet.js`: wczytanie JSON po `instance_id` → placeholder tła
  (jednolity kolor) + `Clutter.Text` z treścią, font Caveat, kolor
  atramentu.
- Ręczne dodanie 1-2 instancji przez cinnamon-settings, weryfikacja że
  każda czyta swój plik.

### Faza 2 — trwałość i CRUD
- Skrypt `karteczki-nowa`: generuje UUID, zapisuje domyślny JSON,
  dopisuje wpis do `enabled-desklets`.
- Zapis pozycji do JSON po zakończeniu przeciągania (hook na sygnał
  end-drag desletu).
- Zapis treści do JSON po wyjściu z trybu edycji (blur/Escape), z
  aktualizacją `modified_at`.

### Faza 3 — menu kontekstowe
- Nadpisanie/rozszerzenie menu prawoklika desletu o pozycje "usuń" (kasuje
  plik JSON + usuwa wpis z `enabled-desklets`) i "nowa karteczka" (wywołuje
  `karteczki-nowa`).
- Wpis Nemo `dodaj-karteczke.nemo_action` wywołujący ten sam skrypt.

### Faza 4 — wygląd docelowy
- ✅ Asset gotowy: `assets/karteczka-bristol.png`. Pozostaje: wpięcie go
  jako `background-image` w desklecie, ewentualnie 9-slice jeśli desklet
  ma być skalowalny bez zniekształcania rogów.
- Instrukcja instalacji fontu Caveat (dokumentacja, nie kod).

### Faza 5 — porządki
- Krótki `README.md` z instrukcją instalacji (symlink do
  `~/.local/share/cinnamon/desklets/`, instalacja `.nemo_action`,
  instalacja fontu).
- Jeden ręczny scenariusz testowy spisany w README: dodaj → edytuj →
  przeciągnij → nowa karteczka z menu → usuń → restart Cinnamona
  (`Alt+F2`, `r`) → karteczki wracają na miejsce.

## Poza zakresem (patrz AGENTS.md → YAGNI)

Renderowanie formatowania Markdown, zmiana koloru/czcionki/tła z UI,
paczka instalacyjna .deb, synchronizacja/chmura.

## Referencje zebrane podczas researchu

- Istniejące deskleta jako wzorzec API: [Note (Cinnamon
  Spices)](https://cinnamon-spices.linuxmint.com/desklets/view/38),
  [Sticky-Notes na
  GitHubie](https://github.com/muzena/Sticky-Notes),
  [cinnamon-spices-desklets
  (repo źródłowe)](https://github.com/linuxmint/cinnamon-spices-desklets).
- Czcionka: [Caveat na Google
  Fonts](https://fonts.google.com/specimen/Caveat) — potwierdzone wsparcie
  `latin-ext` (obejmuje polskie znaki diakrytyczne).
