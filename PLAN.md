# Plan implementacji — Karteczki

## Wymagania (zebrane z rozmowy)

1. Desklet renderujący karteczkę w kształcie/kolorze fizycznego kartonika,
   na podstawie zdjęcia JPG/PNG.
2. Pozycja "Dodaj karteczkę" w menu kontekstowym pulpitu Cinnamon.
3. Czcionka Caveat, kolor niebieskiego atramentu (ustalony: `#112971`).
4. Karteczka przeciągalna (drag-and-drop) po pulpicie.
5. Menu kontekstowe karteczki: "usuń", "nowa karteczka".
6. Tekst edytowany inline, w treści (wejście w edycję: dwuklik).
7. Treść w formacie Markdown, renderowana: pogrubienie, kursywa,
   podkreślenie, hiperłącze.
8. Zapis: jeden plik JSON na karteczkę w `~/.local/share/karteczki/`.
9. Schemat JSON: treść, kolor, czcionka, pozycja, data utworzenia, data
   modyfikacji, tło, kąt obrotu.

## Status (ostatnia aktualizacja: 2026-09-07)

Fazy 0-7 i 11 zrobione i zweryfikowane na żywym Cinnamonie; zostają fazy
8-10 (i18n, licencja, publikacja w Spices).
Ostatnia sesja (2026-09-07) dołożyła formatowanie Markdown, wybór koloru
atramentu, tła i rozmiaru tekstu, pozycjonowanie nowej karteczki w miejscu
menu, kursor-rączkę nad linkiem, README, ściągawkę „Formatowanie" i losowy
obrót karteczek.

- ✅ Faza 0 — format `enabled-desklets` potwierdzony eksperymentalnie:
  `UUID:instance_id:X:Y`. Akcja Nemo na tle pulpitu **zweryfikowana
  ręcznie przez użytkownika (2026-09-07) — działa**.
- ✅ Faza 1 — desklet `karteczki@jkatnik/` (symlink w
  `~/.local/share/cinnamon/desklets/`), `max-instances: -1`,
  `prevent-decorations: true`.
- ✅ Faza 2 — `bin/karteczki_common.py` (CRUD + wpis gsettings + mapowanie
  `instance_id`→uuid w `instances.json`), CLI `bin/karteczki-nowa`,
  `bin/karteczki-usun`. Testy: `tests/test_karteczki_common.py`
  (6 × unittest, gsettings zamockowane) + `tests/test_desklet_json.gjs`
  (self-check logiki parsowania w GJS). Oba przechodzą.
- ✅ Faza 3 — menu kontekstowe karteczki („Usuń", „Nowa karteczka"),
  `~/.local/share/nemo/actions/dodaj-karteczke.nemo_action`.
- ✅ Faza 4 — wygląd docelowy, 9-slice okazał się niepotrzebny (obrazek
  renderowany 1:1, karta przyjmuje jego rozmiar).
- ✅ Faza 5 — `README.md` z instalacją i ręcznym scenariuszem testowym.
- ✅ Faza 6 — wybór tła i rozmiaru tekstu z menu (pola `background`/`font`).
- ✅ Faza 7 — ściągawka „Formatowanie" w oknie modalnym.
- ✅ Faza 11 — losowy obrót karteczek ±3°.
- ⬜ Fazy 8-10 — i18n, licencja GPL-3.0, publikacja w Spices.

### Aktualne parametry wyglądu (`desklet.js`)

| Co | Wartość |
|---|---|
| Rozmiar karty | rozmiar pliku tła; `CARD_WIDTH` 350 × `CARD_HEIGHT` 100 tylko awaryjnie |
| Tło | pole `background` w JSON, plik z `karteczki@jkatnik/img/` (domyślnie `karteczka-bristol-4.png`, 350×100; drugie dostępne: `-3`, 395×158) |
| Font | pole `font` w JSON jako opis Pango (domyślnie `Caveat 20`; czcionka zbundlowana w `assets/fonts/`) |
| Kolor atramentu | domyślnie niebieski `#112971`; z menu też czarny `#1a1a1a`, czerwony `#a51d2d`, zielony `#26653b` |
| Padding tekstu | `{ top: 0, right: 16, bottom: 15, left: 16 }` — `bottom` podnosi tekst o 7,5 px, bo papier kończy się w ~85/100 wysokości grafiki |
| Wyrównanie | `Clutter.BinLayout`, `y_align: CENTER`, `x_align: START` |
| Obrót | pole `rotation` w JSON, losowane raz z zakresu ±3° (`MAX_ROTATION`) |
| Domyślna treść nowej karteczki | `Lorem ipsum` |

### Formatowanie treści (Markdown → Pango markup)

`karteczki@jkatnik/karteczki_markdown.js`, `render()` zwraca markup +
pozycje linków. Obsługiwane: `**pogrubienie**`, `*kursywa*`,
`__podkreślenie__`, `~~przekreślenie~~`, `[tekst](url)`. Bez zagnieżdżania
(jeden znacznik na fragment), bez nagłówków i list.

- Świadomie nie ma `_kursywy_` przez pojedynczy podkreślnik — kolidowałaby
  ze snake_case w treści i z `__podkreśleniem__`.
- W JSON leży surowy Markdown; podgląd renderuje markup, tryb edycji
  pokazuje surowe znaczniki (`set_use_markup(false)`).
- Linki: styl `underline="single"` + `#1a5fb4` nadawany ręcznie, zamiast
  pangowego `<a href>` — nie zależy od wersji Pango i od tego, czy Clutter
  poda kolor linku z motywu.
- Pozycje linków liczone w **bajtach** widocznego tekstu, bo
  `Clutter.Text.coords_to_position()` zwraca indeks bajtowy (przy polskich
  znakach różny od znakowego).
- Kursywa: Caveat nie ma odmiany italic, Pango syntezuje pochylenie.

### Aktualny model interakcji

- **Dwuklik** lewym w karteczkę → tryb edycji (`on_desklet_clicked`
  sprawdza `get_click_count() === 2`). Pojedynczy klik zostawiony D&D.
- **Ctrl+klik** w link → `xdg-open`. Zwykły klik nie może tego robić: przy
  dwukliku Clutter wysyła najpierw zdarzenie z `click_count === 1`, więc
  wejście w edycję nad linkiem odpalałoby przeglądarkę.
- **Kursor nad linkiem** zmienia się na rączkę (`motion-event` na
  kontenerze + `global.set_cursor(Cinnamon.Cursor.POINTING_HAND)`). Kursor
  jest globalny, więc `leave-event` musi go oddawać — inaczej rączka
  zostaje na całym pulpicie.
- **Nowa karteczka pojawia się tam, gdzie rozwinięto menu.** Desklet
  zapamiętuje `global.get_pointer()` na `open-state-changed` menu (punkt
  otwarcia, nie punkt kliknięcia w pozycję „Nowa karteczka") i podaje go
  skryptowi: `karteczki-nowa [x y]`. Akcja Nemo nie ma jak podać
  współrzędnych, więc skrypt bez argumentów pyta o pozycję kursora przez
  Gdk. Bez argumentów i bez Gdk zostaje stara kaskada od `BASE_X/BASE_Y`.
- **Prawoklik** → menu: podmenu „Kolor atramentu", „Tło" i „Rozmiar
  tekstu" (każde z kropką przy aktywnej pozycji), „Formatowanie"
  (okno ze ściągawką Markdown), „Usuń", „Nowa karteczka".
- **Enter** → zapis i wyjście z edycji, **Escape** → anulowanie (przywraca
  treść sprzed edycji), **klik poza kartą** → zapis i wyjście.
- Poza edycją `_text` ma `reactive: false` — inaczej `Clutter.Text`
  przechwytuje klik, zanim dojdzie do deskletu (i blokuje przeciąganie
  karteczek z długą treścią).
- Edytować można tylko jedną karteczkę naraz (`_startEditing` sprawdza
  `_editing` pozostałych deskletów) — `Main.pushModal` robi pełny grab
  X11, dwa naraz zablokowałyby wejście.
- Przeciągnięcie zapisuje pozycję do JSON *i* do `enabled-desklets`.
  Normalnie pozycję odtwarza Cinnamon z gsettings, a `position` w JSON jest
  kopią informacyjną — **wyjątkiem są karteczki zakotwiczone przy prawej
  lub dolnej krawędzi** (patrz niżej), którym pozycję przelicza desklet.
- **Kotwiczenie przy krawędziach** (`karteczki_layout.js`): karta, której
  środek leży w skrajnej ⅓ ekranu, zapisuje w JSON `anchor` — odległość od
  prawej i/lub dolnej krawędzi zamiast polegać na samym `x, y`. Przy starcie
  `on_desklet_added_to_desktop` przelicza z tego pozycję (Cinnamon ustawia
  `set_position` tuż przed tym hookiem, więc to ostatni moment na nadpisanie).
  Dzięki temu po zmianie zestawu monitorów karta przy prawej krawędzi nie
  wyjeżdża poza ekran, a karta „na dole" nie ląduje w połowie pulpitu.
  Oś bez kotwicy zostaje nietknięta, a wpisu w gsettings nie ruszamy —
  kotwica jest źródłem prawdy i przelicza się przy każdym starcie.

### Znane niespójności (drobne, świadome)

- `assets/*.png` to źródła, `karteczki@jkatnik/img/*.png` to kopie
  ładowane przez desklet — kopiowane ręcznie, nic tego nie synchronizuje.
- Cinnamon przy restarcie powłoki przepisuje `enabled-desklets` ze stanu w
  pamięci. Zaobserwowane raz (2026-09-07): usunięty wpis wrócił po
  `reexec_self()` jako sierota (bez pliku JSON), bo żywa instancja nie
  została wyładowana. Powtórne `karteczki-usun` sprząta to poprawnie;
  gdyby wracało regularnie — usuwać desklet przez API Cinnamona zamiast
  samego zapisu gsettings.

### Pułapki potwierdzone eksperymentalnie (nie powtarzać)

1. **Błąd w `desklet.js` potrafi ubić całego Cinnamona (SIGSEGV), nie
   tylko rzucić wyjątkiem.** Zdarzyło się dwukrotnie (`Clutter.Color`
   nie ma metody instancyjnej `from_string` — to statyczna funkcja
   zwracająca `[ok, color]`). Każdą zmianę sprawdzać przez `gjs -c` przed
   wpisem do żywego `enabled-desklets`; ratunek: `cinnamon --replace`.
2. **Kliknięcie w pulpit nie przenosi fokusu klawiatury X11** na powłokę
   (okno typu `_NET_WM_WINDOW_TYPE_DESKTOP`) — bez `Main.pushModal()`
   wpisywane znaki lecą do ostatnio aktywnego okna, mimo że Clutter
   pokazuje poprawny fokus. `pushModal` trzeba świadomie zwalniać
   (`_stopEditing`), inaczej sesja zostaje zablokowana na edycji.
3. **CSS `background-image` na `St.Bin` nie renderuje się wiarygodnie** —
   działa wzorzec GdkPixbuf → `Clutter.Image` → `Clutter.Actor`
   (skopiowany z `notes@schorschii`).
4. **`Clutter.EVENT_STOP` na dziecku zabija wbudowane D&D i menu** —
   `imports.ui.dnd` i `_onButtonReleaseEvent` nasłuchują na `this.actor`,
   czyli przodku. Zamiast własnego handlera używać hooka
   `on_desklet_clicked(event)`.
5. **Nowo zainstalowany font nie jest widoczny dla działającego
   Cinnamona** — Pango cache'uje listę przy starcie; potrzebny restart
   powłoki (`global.reexec_self()` przez D-Bus Eval).
6. **Guake schowany poza ekranem potrafi zabrać wejście pulpitowi** —
   objaw „klikanie w karteczkę przestało działać" bez żadnego regresu w
   kodzie (`on_desklet_clicked` w ogóle się nie odpala). Sprawdzić F12.
7. **Pozycja spoza obszaru pulpitu jest korygowana przez Cinnamona** —
   desklet dodany na `3000:250` (drugi monitor) wylądował na `675:525`,
   dosuniętym do siatki 25 px. Nie jest to błąd `karteczki-nowa`: skrypt
   zapisuje podane współrzędne, Cinnamon je potem przestawia.
8. Silne pomniejszanie assetu (>8×) spłaszcza fakturę papieru —
   dlatego tło ma dziś dokładnie rozmiar karty. Poprzednia proteza
   (`boostTexture()`, unsharp mask) usunięta jako zbędna.

## Struktura plików (stan faktyczny)

```
karteczki@jkatnik/                          # katalog desletu
├── metadata.json
├── desklet.js
├── karteczki_markdown.js                   # Markdown → Pango markup + pozycje linków
├── karteczki_layout.js                     # kotwiczenie przy krawędziach ekranu
└── img/karteczka-bristol-{3,4}.png         # kopie assetów, ładowane w runtime

assets/                                     # źródła grafik i fontów
├── karteczka-bristol{,-2,-3,-4}.png
└── fonts/Caveat-{Regular,Bold}.ttf

bin/
├── karteczki_common.py                     # CRUD notatek + gsettings
├── karteczki-nowa                          # tworzy JSON + wpis gsettings
└── karteczki-usun <instance_id>            # kasuje JSON + wpis gsettings

tests/
├── test_karteczki_common.py                # unittest, gsettings zamockowane
└── test_desklet_json.gjs                   # self-check logiki GJS

README.md                                   # instalacja, obsługa, scenariusz testowy
dodaj-karteczke.nemo_action                 # wzorzec z __KARTECZKI__ zamiast ścieżki

~/.local/share/nemo/actions/
└── dodaj-karteczke.nemo_action             # zainstalowana kopia (ścieżka podstawiona)

~/.local/share/karteczki/
├── <uuid>.json                             # dane jednej karteczki
└── instances.json                          # mapowanie instance_id → uuid
```

Nie powstały (i nie są potrzebne): `settings-schema.json`, `icon.png`.

## Schemat pliku karteczki (JSON)

```json
{
  "id": "uuid-v4",
  "content": "tekst w **Markdown**",
  "color": "#112971",
  "font": "Caveat 20",
  "background": "karteczka-bristol-4.png",
  "rotation": 2.27,
  "position": { "x": 100, "y": 100 },
  "anchor": { "right": 130, "bottom": 40 },
  "created_at": "2026-09-06T12:00:00+02:00",
  "modified_at": "2026-09-06T12:00:00+02:00"
}
```

`anchor` pojawia się tylko dla karteczek stojących wyraźnie przy prawej lub
dolnej krawędzi — z osiami, które są zakotwiczone.
`font` to pełny opis Pango (rodzina + rozmiar) — rodzinę można podmienić
ręcznie w pliku, menu zmienia tylko rozmiar. `background` to sama nazwa
pliku z `karteczki@jkatnik/img/`; nazwa nieistniejącego pliku cofa się do
domyślnego tła przy wczytaniu notatki.

## Fazy

### ✅ Faza 0 — rozpoznanie środowiska
Format `enabled-desklets` potwierdzony (`UUID:instance_id:X:Y`), Nemo
obsługuje `.nemo_action` na tle pulpitu — sprawdzone kliknięciem.

### ✅ Faza 1 — szkielet desletu
`metadata.json` (`max-instances: -1`, `prevent-decorations: true` — to
realne nazwy kluczy, nie planowane `multiInstance`/`decoration`),
`desklet.js` czyta JSON po `instance_id` przez `instances.json`.

### ✅ Faza 2 — trwałość i CRUD
`karteczki-nowa` / `karteczki-usun` + `karteczki_common.py`, zapis pozycji
na `drag-end`, zapis treści przy wyjściu z edycji (Enter / klik poza
kartą), z aktualizacją `modified_at`.

### ✅ Faza 3 — menu kontekstowe
Pozycje „Usuń" i „Nowa karteczka" w menu prawoklika desletu, ten sam
skrypt podpięty pod akcję Nemo.

### ✅ Faza 4 — wygląd docelowy
Tło `karteczka-bristol-4.png` renderowane 1:1 w rozmiarze karty (350×100)
przez `Clutter.Image` — 9-slice niepotrzebny, bo obrazek nie jest skalowany
(w Fazie 6 rozmiar karty zaczął się brać wprost z pliku tła).
Font Caveat zbundlowany w `assets/fonts/` i zainstalowany (zmiana decyzji
z AGENTS.md, gdzie był traktowany jako zależność systemowa).

### ✅ Faza 5 — porządki
- Krótki `README.md` z instrukcją instalacji (symlink do
  `~/.local/share/cinnamon/desklets/`, instalacja `.nemo_action`,
  instalacja fontu).
- Jeden ręczny scenariusz testowy spisany w README: dodaj → edytuj →
  przeciągnij → nowa karteczka z menu → usuń → restart Cinnamona
  (`Alt+F2`, `r`) → karteczki wracają na miejsce.

### ✅ Faza 6 — wybór tła i czcionki

Oba wyborniki chodzą tym samym wzorcem co kolor atramentu (`_addChoiceMenu`:
podmenu z kropką przy aktywnej pozycji → zapis pola w JSON → przerysowanie).

**Tło (`background`)** — sama nazwa pliku z `karteczki@jkatnik/img/`, więc
JSON nie zawiera ścieżek absolutnych i przetrwa przeniesienie repo. Podmenu
listuje `img/*.png` przez `Gio.File.enumerate_children`. **Rozmiar karty
bierze się z pliku** (`pixbuf.get_width/height`), a nie z `CARD_WIDTH`/
`CARD_HEIGHT` — te zostały tylko jako wymiar awaryjny; inne tło może znaczyć
inny format karteczki (dziś: 350×100 i 395×158). Nazwa pliku, którego nie
ma, cofa się do domyślnego tła już przy wczytaniu notatki — inaczej stare
notatki nie zaznaczałyby w menu żadnej pozycji.

Nowy asset: PNG z kanałem alfa (cień i nierówne brzegi wtopione w
przezroczystość), dokładnie w docelowym rozmiarze ekranowym — przy
skalowaniu faktura papieru się spłaszcza (pułapka 7). Pionowy padding
tekstu pozostaje konwencją „papier kończy się w ~85% wysokości".

**Czcionka (`font`)** — pełny opis Pango w jednym polu (`"Caveat 20"`), bo
dokładnie to przyjmuje `Clutter.Text.font_name`. Menu zmienia sam rozmiar
(Mała 16 / Średnia 20 / Duża 24) przez podmianę końcowej liczby, więc ręcznie
wpisana w JSON rodzina przeżywa zmianę rozmiaru. Rodziny nie wybiera się z
UI: enumerowanie `Pango.FontMap.list_families()` to setki pozycji w menu
karteczki, a zbundlowana jest jedna (Caveat). Wartość bez rozmiaru (notatki
sprzed tej fazy) zastępowana jest domyślną — inaczej Pango zeszłoby do
własnego, drobnego rozmiaru bazowego.

### ✅ Faza 7 — ściągawka „Formatowanie"

Pozycja menu otwiera `ModalDialog` z tabelką składnia → efekt (każdy wiersz
renderuje realny markup, więc ściągawka pokazuje dokładnie to, co zrobi
karteczka) plus przypomnienie o Ctrl+kliku i dwukliku. `close()` w
Cinnamonie domyślnie zwalnia grab i niszczy dialog (`destroyOnClose: true`),
więc nie ma czego sprzątać ręcznie.

### ⬜ Faza 8 — i18n (gettext)

Wzorzec z deskletów w Spices (sprawdzony w zainstalowanym
`notes@schorschii`):

```js
const Gettext = imports.gettext;
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");
function _(str) { return Gettext.dgettext(UUID, str); }
```

- **Warunek wstępny, największa część pracy: `msgid` musi być po
  angielsku.** Dziś wszystkie etykiety są polskie („Kolor atramentu",
  „Tło", „Rozmiar tekstu", „Formatowanie", „Usuń", „Nowa karteczka", nazwy
  kolorów i rozmiarów, cały dialog ściągawki, komunikat awaryjny) — do
  publikacji idą po angielsku, a polski wraca jako `po/pl.po`. Około
  20 ciągów.
- Nazwy plików teł nie nadają się na etykiety menu („karteczka-bristol-4").
  Przy okazji i18n: albo angielskie nazwy assetów (`paper-strip.png`,
  `paper-tall.png`), albo mapa nazwa pliku → tłumaczona etykieta.
- Narzędzia są w systemie: `cinnamon-xlet-makepot` (lokalnie),
  `./cinnamon-spices-makepot UUID` i `--install` w repo Spices — to drugie
  kompiluje `.po` do `~/.local/share/locale` i pozwala przetestować
  tłumaczenie przed PR-em.
- `makepot` zbiera też `name` i `description` z `metadata.json`.

### ⬜ Faza 9 — licencja GPL-3.0

- `LICENSE` z pełnym tekstem GPL-3.0 w katalogu repo + krótki nagłówek
  copyright w `desklet.js`, `karteczki_markdown.js` i skryptach `bin/*.py`.
  Sekcja „Licencja" w README.
- **Font Caveat ma własną licencję (OFL-1.1), nie GPL** — jeśli zostaje w
  repo, potrzebuje osobnego katalogu z kopią OFL i notą, że jego licencja
  jest inna niż licencja kodu.
- Grafiki `assets/*.png` to własne zdjęcia — do decyzji, czy idą na GPL-3.0
  razem z kodem, czy na osobnej licencji (np. CC BY-SA).
- **Do potwierdzenia z maintainerami Spices:** repozytorium
  `cinnamon-spices-desklets` jest oznaczone jako GPL-2.0 (sprawdzone przez
  API GitHuba). Xlet to osobne dzieło, nie linkowane z resztą repo, więc
  GPL-3.0 nie powinno kolidować, ale warto to zapytać w PR zamiast
  zakładać.

### ⬜ Faza 10 — publikacja w Cinnamon Spices

Wymagany układ katalogów (z README repozytorium Spices):

```
karteczki@jkatnik/
├── info.json          # {"author": "<nazwa użytkownika GitHub>"}
├── screenshot.png     # zrzut karteczek na pulpicie
├── README.md
└── files/
    └── karteczki@jkatnik/     # files/ zawiera TYLKO ten katalog
        ├── metadata.json      # uuid, name, description, version, author, max-instances, last-edited
        ├── desklet.js
        ├── karteczki_markdown.js
        ├── icon.png           # ikona w menu deskletów — jeszcze nie istnieje
        ├── img/
        └── po/
```

Zmiany, których to wymaga w obecnym projekcie:

1. **Skrypty `bin/` muszą wjechać do środka xleta** (`files/UUID/bin/`) —
   dziś desklet woła je przez `DESKLET_ROOT + "/../bin/"`, co poza repo
   deweloperskim nie istnieje. Ścieżka staje się lokalna.
2. **Akcja Nemo nie może być instalowana z zewnątrz.** Do wyboru: desklet
   sam zakłada `~/.local/share/nemo/actions/…` przy pierwszym starcie, albo
   rezygnujemy z integracji z pulpitem i nowe karteczki dodaje się wyłącznie
   z menu istniejącej karteczki. Wariant pierwszy wymaga uprzedzenia w
   opisie desletu.
3. **Font `.ttf` prawdopodobnie odpada z paczki** — zasady zabraniają
   „pre-compiled blobs (besides icons and images)", a pakietu `fonts-caveat`
   nie ma w repozytoriach dystrybucji (sprawdzone: `apt-cache`). Zalecane:
   desklet działa na foncie systemowym, gdy Caveat nie jest zainstalowany
   (dziś Pango i tak podstawia zamiennik), a README opisuje ręczną
   instalację. Bundlowanie tylko po zgodzie maintainerów.
4. `metadata.json` dostaje `author` i `last-edited` (timestamp), których
   dziś nie ma; `description` musi być po angielsku.
5. Wymóg samowystarczalności: bez zależności spoza oficjalnych repozytoriów
   dystrybucji. Obecne zależności (`python3`, `gsettings`, `xdg-open`) to
   spełniają.
6. PR: jeden desklet na pull request, zmiany tylko w jego katalogu,
   tłumaczenia przetestowane przez `--install` przed wysłaniem.

### ✅ Faza 11 — lekki obrót karteczek (±3°)

`set_pivot_point(0.5, 0.5)` + `set_rotation_angle(Z_AXIS, kąt)` na
`_container` (nie na `this.actor` — tym zarządza Cinnamon przy D&D). Kąt
losowany raz przy tworzeniu notatki i zapisany w JSON jako `rotation`;
inaczej karteczki przeskakiwałyby przy każdym restarcie powłoki. Notatki
bez tego pola dostają kąt przy pierwszym wczytaniu — zapis pomija
`modified_at`, bo to uzupełnienie pola, nie zmiana treści. Wyprostowanie
karteczki: `"rotation": 0` w pliku.

Zweryfikowane na żywym pulpicie:
- mapowanie współrzędnych uwzględnia obrót co do 0,1 px (punkt 100 px na
  prawo od środka karty obróconej o 2,27° dał lokalne 274,9/46,0 zamiast
  275/50) — czyli trafianie w link i wejście w edycję działa po obrocie;
- `clip_to_allocation` jest wyłączone na karcie, na aktorze desletu i na
  kontenerze pulpitu, więc wystające rogi (przy 5° obrys rośnie o ~7 px w
  poziomie i ~30 px w pionie) nie są przycinane.

## Poza zakresem (patrz AGENTS.md → YAGNI)

Zagnieżdżone formatowanie Markdown, nagłówki i listy, color picker zamiast
czterech kolorów, paczka instalacyjna .deb, synchronizacja/chmura.

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
