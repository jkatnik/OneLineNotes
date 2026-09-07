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
   modyfikacji, tło.

## Status (ostatnia aktualizacja: 2026-09-07)

Fazy 0-4 zrobione i zweryfikowane na żywym Cinnamonie, plus formatowanie
Markdown i wybór koloru atramentu z menu (2026-09-07). Zostaje Faza 5
(README + spisany scenariusz testowy) i Faza 6 (wybór tła i czcionki —
zaprojektowana, nie zaimplementowana).

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
- ✅ Faza 4 — wygląd docelowy, 9-slice okazał się niepotrzebny (karta ma
  stały rozmiar, obrazek renderowany 1:1).
- ⬜ Faza 5 — README i scenariusz testowy: nie zaczęte.

### Aktualne parametry wyglądu (`desklet.js`)

| Co | Wartość |
|---|---|
| Rozmiar karty | `CARD_WIDTH` 350 × `CARD_HEIGHT` 100 |
| Tło | `karteczki@jkatnik/img/karteczka-bristol-4.png` (przezroczyste tło, renderowane 1:1) |
| Font | `Caveat 20` (zbundlowany w `assets/fonts/`, zainstalowany w `~/.local/share/fonts/`) |
| Kolor atramentu | domyślnie niebieski `#112971`; z menu też czarny `#1a1a1a`, czerwony `#a51d2d`, zielony `#26653b` |
| Padding tekstu | `{ top: 0, right: 16, bottom: 15, left: 16 }` — `bottom` podnosi tekst o 7,5 px, bo papier kończy się w ~85/100 wysokości grafiki |
| Wyrównanie | `Clutter.BinLayout`, `y_align: CENTER`, `x_align: START` |
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
- **Prawoklik** → menu: „Kolor atramentu" (podmenu z kropką przy
  aktywnym), „Usuń", „Nowa karteczka".
- **Enter** → zapis i wyjście z edycji, **Escape** → anulowanie (przywraca
  treść sprzed edycji), **klik poza kartą** → zapis i wyjście.
- Poza edycją `_text` ma `reactive: false` — inaczej `Clutter.Text`
  przechwytuje klik, zanim dojdzie do deskletu (i blokuje przeciąganie
  karteczek z długą treścią).
- Edytować można tylko jedną karteczkę naraz (`_startEditing` sprawdza
  `_editing` pozostałych deskletów) — `Main.pushModal` robi pełny grab
  X11, dwa naraz zablokowałyby wejście.
- Przeciągnięcie zapisuje pozycję do JSON *i* do `enabled-desklets`;
  pozycja odtwarzana jest z gsettings, pole `position` w JSON jest tylko
  kopią informacyjną.

### Znane niespójności (drobne, świadome)

- Pola `background` i `font` w JSON notatki są zapisywane, ale desklet ich
  nie czyta (ścieżka tła i font są stałe w kodzie) — ożywia je Faza 6.
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
7. Silne pomniejszanie assetu (>8×) spłaszcza fakturę papieru —
   dlatego tło ma dziś dokładnie rozmiar karty. Poprzednia proteza
   (`boostTexture()`, unsharp mask) usunięta jako zbędna.

## Struktura plików (stan faktyczny)

```
karteczki@jkatnik/                          # katalog desletu
├── metadata.json
├── desklet.js
├── karteczki_markdown.js                   # Markdown → Pango markup + pozycje linków
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

~/.local/share/nemo/actions/
└── dodaj-karteczke.nemo_action             # wpis menu kontekstowego pulpitu

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
  "font": "Caveat",
  "background": "karteczka-bristol.png",
  "position": { "x": 100, "y": 100 },
  "created_at": "2026-09-06T12:00:00+02:00",
  "modified_at": "2026-09-06T12:00:00+02:00"
}
```

Pola `font` i `background` są dziś tylko zapisywane — desklet ich nie
czyta (font i ścieżka tła są stałe w `desklet.js`).

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
przez `Clutter.Image` — 9-slice niepotrzebny, bo karta ma stały rozmiar.
Font Caveat zbundlowany w `assets/fonts/` i zainstalowany (zmiana decyzji
z AGENTS.md, gdzie był traktowany jako zależność systemowa).

### ⬜ Faza 5 — porządki (jedyne, co zostało)
- Krótki `README.md` z instrukcją instalacji (symlink do
  `~/.local/share/cinnamon/desklets/`, instalacja `.nemo_action`,
  instalacja fontu).
- Jeden ręczny scenariusz testowy spisany w README: dodaj → edytuj →
  przeciągnij → nowa karteczka z menu → usuń → restart Cinnamona
  (`Alt+F2`, `r`) → karteczki wracają na miejsce.

### ⬜ Faza 6 — wybór tła i czcionki (zaprojektowane, nie zaimplementowane)

Obie rzeczy działają tak samo jak gotowy już wybór koloru atramentu:
podmenu w menu kontekstowym → zapis pola w JSON karteczki → natychmiastowe
przerysowanie. Pola `background` i `font` już są w schemacie, dziś martwe.

**Tło (`background`)**

- W JSON sama nazwa pliku, np. `"karteczka-bristol-4.png"`; katalog stały
  (`karteczki@jkatnik/img/`), żeby JSON nie zawierał ścieżek absolutnych i
  przetrwał przeniesienie repo.
- **Rozmiar karty = rozmiar pliku PNG** (`pixbuf.get_width/height`), a nie
  stałe `CARD_WIDTH`/`CARD_HEIGHT`. Konwencja z Fazy 4 („asset renderowany
  1:1") zostaje, tylko przestaje być zaszyta w kodzie — inne tło może
  znaczyć inny format karteczki. Stałe zostają wyłącznie jako wymiar
  awaryjny, gdy pliku nie ma.
- Wymagania dla assetu: PNG z kanałem alfa (cień i nierówne brzegi
  wtopione w przezroczystość), dokładnie w docelowym rozmiarze ekranowym.
  Rozsądne warianty do przygotowania: `350×100` (dzisiejszy pasek),
  `350×200` (wysoka), `200×200` (kwadrat). Powyżej ~2× skalowania faktura
  papieru się spłaszcza — patrz pułapka 7.
- Menu: podmenu „Tło" listujące `img/*.png` (`Gio.File.enumerate_children`),
  etykieta = nazwa bez rozszerzenia, kropka przy aktywnym.
- Po zmianie: `_container.set_size(w, h)`, podmiana aktora obrazu,
  `_text.set_width(w - padding)`. Brak pliku → tło domyślne, bez wyjątku.
- **Otwarte:** czy pionowy padding tekstu (dziś `bottom: 15`, dobrany pod
  jeden konkretny obrazek) ma być polem assetu — najprościej: konwencja,
  że papier na PNG kończy się w 85% wysokości, więc wzór działa dla
  każdego tła.

**Czcionka (`font`)**

- W JSON pełny opis Pango w jednym polu: `"Caveat 20"` (rodzina + rozmiar),
  bo dokładnie to przyjmuje `Clutter.Text.font_name` — bez rozbijania na
  dwa pola i sklejania w kodzie.
- Menu, wariant rekomendowany (lazy): podmenu „Rozmiar tekstu" — Mała 16 /
  Średnia 20 / Duża 24, rodzina zmieniana ręcznie w JSON. Pokrywa realną
  potrzebę („nie mieści się / za drobne") jednym podmenu.
- Wariant szerszy, jeśli rodzina ma być wybierana z UI: lista ograniczona
  do fontów zbundlowanych w `assets/fonts/` (dziś: Caveat). Enumerowanie
  fontów systemowych przez `Pango.FontMap.list_families()` odpada — setki
  pozycji w menu kontekstowym karteczki.
- Uwaga z Fazy 4: nowy plik `.ttf` wymaga restartu Cinnamona, żeby Pango
  go zobaczył. Instalacja fontu zostaje krokiem README, nie runtime'em.

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
