# Plan implementacji — OneLineNotes

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
8. Zapis: jeden plik JSON na karteczkę w `~/.local/share/onelinenotes/`.
9. Schemat JSON: treść, kolor, czcionka, pozycja, data utworzenia, data
   modyfikacji, tło, kąt obrotu.

## Status (ostatnia aktualizacja: 2026-09-07)

Fazy 0-9 i 11 zrobione i zweryfikowane na żywym Cinnamonie. Faza 10
(publikacja w Spices) przygotowana — zostaje `screenshot.png` i wysłanie PR-a.
Ostatnia sesja (2026-09-07) dołożyła formatowanie Markdown, wybór koloru
atramentu, tła i rozmiaru tekstu, pozycjonowanie nowej karteczki w miejscu
menu, kursor-rączkę nad linkiem, README, ściągawkę „Formatowanie", losowy
obrót, kotwiczenie przy krawędziach monitora, i18n z wyborem języka z menu,
ikony w menu i potwierdzanie usuwania.

- ✅ Faza 0 — format `enabled-desklets` potwierdzony eksperymentalnie:
  `UUID:instance_id:X:Y`. Akcja Nemo na tle pulpitu **zweryfikowana
  ręcznie przez użytkownika (2026-09-07) — działa**.
- ✅ Faza 1 — desklet `onelinenotes@jkatnik/` (symlink w
  `~/.local/share/cinnamon/desklets/`), `max-instances: -1`,
  `prevent-decorations: true`.
- ✅ Faza 2 — `bin/notes_common.py` (CRUD + wpis gsettings + mapowanie
  `instance_id`→uuid w `instances.json`), CLI `bin/note-new`,
  `bin/note-remove`. Testy: `tests/test_notes_common.py`
  (6 × unittest, gsettings zamockowane) + `tests/test_desklet.gjs`
  (self-check logiki parsowania w GJS). Oba przechodzą.
- ✅ Faza 3 — menu kontekstowe karteczki („Usuń", „Nowa karteczka"),
  `~/.local/share/nemo/actions/add-note.nemo_action`.
- ✅ Faza 4 — wygląd docelowy, 9-slice okazał się niepotrzebny (obrazek
  renderowany 1:1, karta przyjmuje jego rozmiar).
- ✅ Faza 5 — `README.md` z instalacją i ręcznym scenariuszem testowym.
- ✅ Faza 6 — wybór tła i rozmiaru tekstu z menu (pola `background`/`font`).
- ✅ Faza 7 — ściągawka „Formatowanie" w oknie modalnym.
- ✅ Faza 8 — i18n (gettext + wybór języka z menu, `po/pl.po`).
- ✅ Faza 9 — licencja GPL-3.0 dla kodu, OFL 1.1 dla czcionek.
- ✅ Faza 11 — losowy obrót karteczek ±3°.
- 🔶 Faza 10 — publikacja w Spices: paczka i wymogi gotowe, brakuje
  `screenshot.png` i wysłania PR-a.

### Aktualne parametry wyglądu (`desklet.js`)

| Co | Wartość |
|---|---|
| Rozmiar karty | rozmiar pliku tła; `CARD_WIDTH` 350 × `CARD_HEIGHT` 100 tylko awaryjnie |
| Tło | pole `background` w JSON, plik z `onelinenotes@jkatnik/img/` (domyślnie `paper-strip.png`, 350×100; drugie dostępne: `-3`, 395×158) |
| Font | pole `font` w JSON jako opis Pango (domyślnie `Caveat 20`); do wyboru z menu 5 rodzin zbundlowanych w `assets/fonts/` (alfabetycznie), wszystkie z polskimi znakami |
| Kolor atramentu | domyślnie niebieski `#112971`; z menu też czarny `#1a1a1a`, czerwony `#a51d2d`, zielony `#26653b` |
| Padding tekstu | `{ top: 0, right: 16, bottom: 15, left: 16 }` — `bottom` podnosi tekst o 7,5 px, bo papier kończy się w ~85/100 wysokości grafiki |
| Wyrównanie | `Clutter.BinLayout`, `y_align: CENTER`, `x_align: START` |
| Obrót | pole `rotation` w JSON, losowane raz z zakresu ±3° (`MAX_ROTATION`) |
| Domyślna treść nowej karteczki | `Lorem ipsum` |

### Formatowanie treści (Markdown → Pango markup)

`onelinenotes@jkatnik/onelinenotes_markdown.js`, `render()` zwraca markup +
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
  skryptowi: `note-new [x y]`. Akcja Nemo nie ma jak podać
  współrzędnych, więc skrypt bez argumentów pyta o pozycję kursora przez
  Gdk. Bez argumentów i bez Gdk zostaje stara kaskada od `BASE_X/BASE_Y`.
- **Prawoklik** → menu z ikonami. Na górze dwie najczęstsze akcje („Nowa
  karteczka", „Usuń"), separator, dalej ustawienia: podmenu „Kolor
  atramentu", „Tło", „Czcionka", „Rozmiar tekstu" i „Język" (każde z kropką
  przy aktywnej pozycji) oraz
  „Formatowanie" (okno ze ściągawką Markdown).
  Ikona podmenu musi siedzieć **w jednym aktorze razem z etykietą**:
  `PopupSubMenuMenuItem` nie przyjmuje ikony, a dołożenie jej jako osobnego
  aktora dokłada pozycji kolumnę — szerokości kolumn są wspólne dla całego
  menu, więc etykiety podmenu robiły się zerowej szerokości.
- **„Usuń" pyta o potwierdzenie** (`ModalDialog` z czerwonym
  `destructive_action`) z checkboxem „Nie pytaj ponownie". Zaznaczenie
  zapisuje się dopiero po potwierdzeniu usunięcia — checkbox + „Anuluj"
  nie wyłącza pytania. Flaga `skipRemoveConfirmation` leży w
  `settings.json`, więc dotyczy wszystkich karteczek.
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
- **Kotwiczenie przy krawędziach** (`onelinenotes_layout.js`): karta, której
  środek leży w skrajnej ⅓ **monitora**, zapisuje w JSON `anchor` —
  odległość od prawej i/lub dolnej krawędzi plus indeks monitora, zamiast
  polegać na samym `x, y`. Dzięki temu po zmianie zestawu ekranów karta przy
  prawej krawędzi nie wyjeżdża poza ekran, a karta „na dole" nie ląduje w
  połowie pulpitu. Oś bez kotwicy zostaje nietknięta, a wpisu w gsettings nie
  ruszamy — kotwica jest źródłem prawdy i przelicza się przy każdym starcie.
  - **Względem monitora, nie całego pulpitu.** Pierwsza wersja liczyła
    kotwicę względem `global.stage` i nie zadziałała: przy dwóch ekranach
    (2560 + 1920) karta dosunięta do prawej krawędzi lewego monitora ma
    środek w okolicy 2250 px, czyli w skali 4480 px leży pośrodku i nigdy nie
    przekraczała progu.
  - Monitor wybierany jest po indeksie zapisanym w kotwicy, dopóki taki
    istnieje (odpięcie ekranu zmienia numerację); potem po tym, na którym
    karta leży; w ostateczności główny.
  - Kotwicę dostaje **każda** karta stojąca przy krawędzi, nadawana przy
    starcie — nie tylko ta świeżo przeciągnięta. Bez tego karteczki sprzed
    tej wersji nie miałyby czego użyć przy odpięciu monitora.
  - Przeliczenie odpala się przy starcie (`on_desklet_added_to_desktop` —
    Cinnamon ustawia `set_position` tuż przed nim, więc to ostatni moment na
    nadpisanie) **oraz na sygnał `monitors-changed`** z `Main.layoutManager`,
    w `idle`, żeby wykonać się po tym, jak Cinnamon sam ściśnie deskleta do
    nowego układu. Odpięcie monitora nie przeładowuje deskletów, więc bez
    tego sygnału kotwica zadziałałaby dopiero po restarcie powłoki.

### Znane niespójności (drobne, świadome)

- `assets/*.png` to źródła, `onelinenotes@jkatnik/img/*.png` to kopie
  ładowane przez desklet — kopiowane ręcznie, nic tego nie synchronizuje.
- Cinnamon przy restarcie powłoki przepisuje `enabled-desklets` ze stanu w
  pamięci. Zaobserwowane raz (2026-09-07): usunięty wpis wrócił po
  `reexec_self()` jako sierota (bez pliku JSON), bo żywa instancja nie
  została wyładowana. Powtórne `note-remove` sprząta to poprawnie;
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
   dosuniętym do siatki 25 px. Nie jest to błąd `note-new`: skrypt
   zapisuje podane współrzędne, Cinnamon je potem przestawia.
8. Silne pomniejszanie assetu (>8×) spłaszcza fakturę papieru —
   dlatego tło ma dziś dokładnie rozmiar karty. Poprzednia proteza
   (`boostTexture()`, unsharp mask) usunięta jako zbędna.

## Struktura plików (stan faktyczny)

```
onelinenotes@jkatnik/                          # katalog desletu
├── metadata.json
├── desklet.js
├── onelinenotes_markdown.js                   # Markdown → Pango markup + pozycje linków
├── onelinenotes_layout.js                     # kotwiczenie przy krawędziach ekranu
├── onelinenotes_i18n.js                       # parser .po + wybór języka
├── po/{onelinenotes@jkatnik.pot,pl.po}        # tłumaczenia
└── img/karteczka-bristol-{3,4}.png         # kopie assetów, ładowane w runtime

assets/                                     # źródła grafik i fontów
├── karteczka-bristol{,-2,-3,-4}.png
└── fonts/Caveat-{Regular,Bold}.ttf

bin/
├── notes_common.py                     # CRUD notatek + gsettings
├── note-new                          # tworzy JSON + wpis gsettings
└── note-remove <instance_id>            # kasuje JSON + wpis gsettings

tests/
├── test_notes_common.py                # unittest, gsettings zamockowane
└── test_desklet.gjs                   # self-check logiki GJS

README.md                                   # instalacja, obsługa, scenariusz testowy
add-note.nemo_action                 # wzorzec z __ONELINENOTES__ zamiast ścieżki

~/.local/share/nemo/actions/
└── add-note.nemo_action             # zainstalowana kopia (ścieżka podstawiona)

~/.local/share/onelinenotes/
├── <uuid>.json                             # dane jednej karteczki
├── instances.json                          # mapowanie instance_id → uuid
└── settings.json                           # ustawienia wspólne: język, potwierdzanie usuwania
```

Nie powstały (i nie są potrzebne): `settings-schema.json`, `icon.png`.

## Schemat pliku karteczki (JSON)

```json
{
  "id": "uuid-v4",
  "content": "tekst w **Markdown**",
  "color": "#112971",
  "font": "Caveat 20",
  "background": "paper-strip.png",
  "rotation": 2.27,
  "position": { "x": 100, "y": 100 },
  "anchor": { "right": 130, "bottom": 40, "monitor": 0 },
  "created_at": "2026-09-06T12:00:00+02:00",
  "modified_at": "2026-09-06T12:00:00+02:00"
}
```

`anchor` pojawia się tylko dla karteczek stojących wyraźnie przy prawej lub
dolnej krawędzi swojego monitora — z osiami, które są zakotwiczone, i
indeksem monitora.
`font` to pełny opis Pango (rodzina + rozmiar) — rodzinę można podmienić
ręcznie w pliku, menu zmienia tylko rozmiar. `background` to sama nazwa
pliku z `onelinenotes@jkatnik/img/`; nazwa nieistniejącego pliku cofa się do
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
`note-new` / `note-remove` + `notes_common.py`, zapis pozycji
na `drag-end`, zapis treści przy wyjściu z edycji (Enter / klik poza
kartą), z aktualizacją `modified_at`.

### ✅ Faza 3 — menu kontekstowe
Pozycje „Usuń" i „Nowa karteczka" w menu prawoklika desletu, ten sam
skrypt podpięty pod akcję Nemo.

### ✅ Faza 4 — wygląd docelowy
Tło `paper-strip.png` renderowane 1:1 w rozmiarze karty (350×100)
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

**Tło (`background`)** — sama nazwa pliku z `onelinenotes@jkatnik/img/`, więc
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
dokładnie to przyjmuje `Clutter.Text.font_name`. Menu ma osobno rodzinę
(5 krojów zbundlowanych w repo) i rozmiar (Mała 16 / Średnia 20 / Duża 24);
zmiana jednego wymiaru zachowuje drugi, więc ręcznie wpisana rodzina spoza
listy przeżywa zmianę rozmiaru. Enumerowania `Pango.FontMap.list_families()`
świadomie nie ma — to setki pozycji w menu karteczki. Wartość bez rozmiaru (notatki
sprzed tej fazy) zastępowana jest domyślną — inaczej Pango zeszłoby do
własnego, drobnego rozmiaru bazowego.

### ✅ Faza 7 — ściągawka „Formatowanie"

Pozycja menu otwiera `ModalDialog` z tabelką składnia → efekt (każdy wiersz
renderuje realny markup, więc ściągawka pokazuje dokładnie to, co zrobi
karteczka) plus przypomnienie o Ctrl+kliku i dwukliku. `close()` w
Cinnamonie domyślnie zwalnia grab i niszczy dialog (`destroyOnClose: true`),
więc nie ma czego sprzątać ręcznie.

### ✅ Faza 8 — i18n (gettext)

Zrobione: `Gettext.dgettext(UUID, …)` z `bindtextdomain` na
`~/.local/share/locale`, wszystkie widoczne ciągi przeszły na angielskie
`msgid` (28 sztuk razem z `name`/`description`), polski wrócił jako
`po/pl.po`. Etykiety teł mają własne tłumaczenia (`Paper strip`,
`Tall paper`), nazwy plików zostały bez zmian — pole `background` w
istniejących notatkach nadal pasuje. Komunikaty `logWarning` zostają
angielskie, bo to log dla dewelopera, nie interfejs.

Odstępstwo od pierwotnego pomysłu: `cinnamon-xlet-makepot` wymaga pakietu
`python3-polib`, którego nie ma w systemie (instalacja przez `apt` wymaga
sudo), więc `.pot` powstaje przez `xgettext`, a dwa ciągi z `metadata.json`
są w nim dopisane ręcznie. Do PR-a w Spices i tak trzeba przejechać
`./cinnamon-spices-makepot UUID` z ich repozytorium.

**Wybór języka z menu** (`onelinenotes_i18n.js`), niezależny od locale sesji.
gettext tłumaczy wyłącznie na język procesu, a Cinnamon to jeden proces dla
całego pulpitu — wymuszenie przez `setlocale` przestawiłoby też panel i menu
systemowe. Dlatego przy wymuszonym języku `.po` czytany jest wprost (parser
w module, ~40 linii, bez form mnogich — w desklecie nie występują), a przy
„języku systemu" działa normalny `dgettext`. Pliki `.po` pozostają jedynym
źródłem tłumaczeń, więc wymóg Spices jest spełniony.

Wybór jest wspólny dla wszystkich karteczek: `settings.json` obok notatek,
a przemalowanie idzie po żywych instancjach w tym samym procesie
(`Main.deskletContainer` → `_applyLanguage`), więc działa bez restartu
powłoki. Etykiety menu musiały przy okazji przestać być stałymi modułu i
stać się funkcjami — inaczej zostałyby w języku z chwili załadowania.

Uwaga: sesja na tej maszynie ma `LANGUAGE=en_US`, więc „język systemu" daje
tu angielski; polski wybiera się z menu.

### Poprzedni plan tej fazy (dla porządku)

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

### ✅ Faza 9 — licencja GPL-3.0

Zrobione: `LICENSE` (pełny GPL-3.0), nagłówki copyright w `desklet.js`,
`onelinenotes_markdown.js`, `onelinenotes_layout.js`, `onelinenotes_i18n.js` i w
skryptach `bin/`, sekcja „Licencja" w README. Kod idzie jako
**GPL-3.0-or-later**.

Czcionki dostały `assets/fonts/OFL.txt` — pełny tekst SIL Open Font License
1.1 ze źródła fontu (repozytorium `googlefonts/caveat`). Sprawdzone w
metadanych pliku `.ttf`: copyright „The Caveat Project Authors", licencja
OFL, **bez Reserved Font Name**. OFL nie obejmuje programu dołączającego
font, więc GPL-3.0 dla kodu i OFL dla `.ttf` współistnieją bez konfliktu;
warunkiem redystrybucji jest tylko dołączenie noty i tekstu licencji — stąd
`OFL.txt` obok plików fontu.

Grafiki `assets/*.png` (własne zdjęcia autora) idą na tej samej licencji co
kod. Zostaje pytanie do PR-a w Spices: repo jest oznaczone GPL-2.0, xlet na
GPL-3.0 to osobne dzieło, ale warto to potwierdzić zamiast zakładać.

### Poprzedni plan tej fazy (dla porządku)

- `LICENSE` z pełnym tekstem GPL-3.0 w katalogu repo + krótki nagłówek
  copyright w `desklet.js`, `onelinenotes_markdown.js` i skryptach `bin/*.py`.
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

### 🔶 Faza 10 — publikacja w Cinnamon Spices (przygotowana, PR niewysłany)

Zrobione:
- `bin/` przeniesione do `onelinenotes@jkatnik/bin/` — desklet woła skrypty
  ścieżką względem `DESKLET_ROOT`, bo poza repo deweloperskim nie ma nic obok
  katalogu xleta.
- **Akcja Nemo zakłada się sama** przy pierwszym starcie (decyzja użytkownika
  z 2026-09-07): wzorzec `add-note.nemo_action` leży w katalogu xleta,
  `__ONELINENOTES__` jest podmieniane na `DESKLET_ROOT`. Skasowanie akcji przez
  użytkownika jest respektowane (flaga `nemoActionInstalled` w
  `settings.json`), ale wpis z martwym `Exec` zostaje naprawiony — inaczej po
  przeniesieniu repo pozycja w menu pulpitu po cichu przestaje działać. Tak
  właśnie było po przeniesieniu `bin/`: akcja z 6 września wskazywała starą
  ścieżkę, naprawione automatycznie przy starcie.
- `info.json` (`{"author": "jkatnik"}`), `icon.png` (96×96, wygenerowana z
  assetu karteczki), `author` i `last-edited` w `metadata.json`.
- `tools/build-spice` — buduje układ wymagany przez Spices do `build/` i
  sprawdza wymogi: `files/` tylko z katalogiem UUID, obecność
  `screenshot.png`, komplet pól `metadata.json`, brak plików `.ttf`.
- Menu „Czcionka" pokazuje tylko kroje faktycznie zainstalowane
  (`PangoCairo.FontMap`), bo paczka ze Spices nie wozi `.ttf`.
- README przetłumaczone na angielski (2026-09-07) — trafia do repo Spices,
  gdzie językiem jest angielski. PLAN.md i AGENTS.md zostają po polsku.

Zostało:
- Wysłanie PR-a. `screenshot.png` dostarczony przez użytkownika (`assets/`),
  walidacja `tools/build-spice` przechodzi.
- Wysłanie PR-a (fork `linuxmint/cinnamon-spices-desklets`, jeden xlet na PR)
  i zapytanie maintainerów o dwie rzeczy: licencję GPL-3.0 przy repo
  oznaczonym GPL-2.0 oraz to, czy desklet może zakładać plik poza swoim
  katalogiem (akcja Nemo).

### Pierwotny plan tej fazy (dla porządku)

Wymagany układ katalogów (z README repozytorium Spices):

```
onelinenotes@jkatnik/
├── info.json          # {"author": "<nazwa użytkownika GitHub>"}
├── screenshot.png     # zrzut karteczek na pulpicie
├── README.md
└── files/
    └── onelinenotes@jkatnik/     # files/ zawiera TYLKO ten katalog
        ├── metadata.json      # uuid, name, description, version, author, max-instances, last-edited
        ├── desklet.js
        ├── onelinenotes_markdown.js
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
