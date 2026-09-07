# Karteczki — kontekst dla agentów

## Co to jest

Cinnamon **desklet** (nie extension, nie osobna aplikacja GTK) renderujący
karteczki samoprzylepne na pulpicie. Wygląd kartonika pochodzi ze zdjęcia
JPG/PNG fizycznej karteczki, nie jest rysowany programistycznie.

Dlaczego desklet, a nie extension/applet: desklety to jedyny mechanizm
Cinnamona, który daje za darmo pozycję na pulpicie pod oknami, przeciąganie
myszką i wiele niezależnych instancji tego samego widżetu — dokładnie to,
czego potrzeba. Pisanie tego jako extension oznaczałoby ręczne odtwarzanie
tych mechanizmów.

## Architektura (skrót)

- **Desklet** (`desklet.js`, `metadata.json` z `"max-instances": "-1"`) —
  jedna instancja = jedna karteczka. `"prevent-decorations": true`, żeby nie
  było paska tytułowego Cinnamona nad zdjęciem kartonika. (To realne nazwy
  kluczy — nie `multiInstance`/`decoration` z pierwotnego planu.)
- **`karteczki_markdown.js`** — czysty moduł (bez importów Cinnamona)
  zamieniający Markdown na Pango markup; ładowany przez `imports.searchPath`,
  więc ten sam plik testuje `tests/test_desklet_json.gjs` pod gołym `gjs`.
- **Nemo custom action** (`~/.local/share/nemo/actions/*.nemo_action`) —
  dodaje "Dodaj karteczkę" do menu kontekstowego tła pulpitu. To menu
  należy do procesu `nemo-desktop`, nie do powłoki Cinnamon — desklet sam
  w sobie nie ma dostępu do tego menu.
- **Skrypt tworzący notatkę** (wywoływany przez akcję Nemo i przez pozycję
  "nowa karteczka" w menu desklecika) — generuje UUID, zapisuje domyślny
  JSON, dopisuje wpis do klucza gsettings `org.cinnamon enabled-desklets`.
- **Magazyn danych**: `~/.local/share/karteczki/<uuid>.json`, jeden plik na
  karteczkę.

## Decyzje i uzasadnienia

- **XDG_DATA_HOME, nie XDG_STATE_HOME.** Treść karteczek to wartościowe
  dane użytkownika (chce je mieć w backupie), nie efemeryczny stan
  aplikacji jak historia czy cache. Stąd `~/.local/share/karteczki`,
  a nie `~/.local/state/karteczki`.
- **Pozycja duplikowana w JSON.** Cinnamon i tak śledzi pozycję desklecika
  we własnym gsettings, ale zapisujemy `position` też do pliku JSON, żeby
  backup/restore samych plików JSON odtwarzał układ pulpitu bez zależności
  od stanu gsettings.
- **Kotwiczenie przy prawej/dolnej krawędzi** (`karteczki_layout.js`).
  Współrzędne z gsettings są liczone od lewego górnego rogu, więc po zmianie
  zestawu monitorów karta z prawej strony wyjeżdża poza ekran, a karta „na
  dole" ląduje w połowie pulpitu. Karty, których środek leży w skrajnej ⅓
  **swojego monitora**, zapisują więc `anchor` (odległość od prawej/dolnej
  krawędzi + indeks monitora) i odtwarzają z niego pozycję w
  `on_desklet_added_to_desktop` — Cinnamon ustawia `set_position` tuż przed
  tym hookiem, więc nadpisanie tam jest bezpieczne i nie wymaga grzebania w
  `enabled-desklets` — oraz na sygnale `monitors-changed`, bo odpięcie ekranu
  nie przeładowuje deskletów. Liczenie względem monitora, nie całego
  wirtualnego pulpitu, jest istotne: karta dosunięta do prawej krawędzi
  lewego ekranu leży w skali pulpitu mniej więcej pośrodku.
- **Treść w Markdown, renderowana przez Pango markup** (decyzja zmieniona
  2026-09-07 — wcześniej tylko surowy tekst). `karteczki_markdown.js`
  zamienia `**pogrubienie**`, `*kursywę*`, `__podkreślenie__`,
  `~~przekreślenie~~` i `[tekst](url)` na markup (`<b>`, `<i>`, `<u>`,
  `<s>`, `<span>`), który `Clutter.Text` renderuje natywnie — bez
  parsera Markdown i bez budowania drzewa aktorów St. W JSON zapisywany
  jest zawsze surowy Markdown; tryb edycji pokazuje właśnie jego.
  Zagnieżdżanie znaczników, nagłówki, listy i cytaty: nadal poza zakresem.
- **Font Caveat zbundlowany w repo (`assets/fonts/`), instalowany do
  `~/.local/share/fonts/` + `fc-cache`.** Decyzja zmieniona względem
  pierwotnego planu (miał być czystą zależnością systemową, ręcznie
  instalowaną przez użytkownika) — dociągnięty automatycznie z Google
  Fonts, żeby nie zależeć od ręcznego kroku. Nadal bez kodu rejestrującego
  font w fontconfig w runtime — sama obecność plików `.ttf` w
  `~/.local/share/fonts` wystarcza, Pango znajdzie je przez zwykłe
  wyszukiwanie po nazwie rodziny (dziś rodzina i rozmiar biorą się z pola
  `font` notatki, domyślnie `"Caveat 20"`). Uwaga: proces Cinnamona musi zostać zrestartowany po
  instalacji nowego pliku fontu — już działający proces nie widzi nowo
  dodanych czcionek bez restartu (fontconfig cache'uje listę w pamięci).
- **Format `enabled-desklets`** to lista stringów `"UUID:instance_id:X:Y"`
  — potwierdzone eksperymentalnie (Faza 0): tymczasowe ustawienie
  `gsettings set org.cinnamon enabled-desklets
  "['clock@cinnamon.org:1:100:100']"` zostało przyjęte przez Cinnamona bez
  normalizacji. `bin/karteczki_common.py` generuje wpisy w tym formacie.

## Czego NIE robimy (świadomie, YAGNI)

- Kolor atramentu, tło i rozmiar tekstu wybierane z menu kontekstowego, ale
  z zamkniętych list: bez color pickera, bez wyboru pliku z dysku i bez
  listy rodzin czcionek (rodzinę zmienia się ręcznie w polu `font`).
- Brak zagnieżdżonego formatowania Markdown, nagłówków, list i cytatów —
  tylko pogrubienie, kursywa, podkreślenie, przekreślenie i link.
- Brak własnego mechanizmu przeciągania — używamy wbudowanego drag
  desklecików Cinnamona.
- Brak instalatora/paczki .deb — projekt uruchamiany z katalogu
  deweloperskiego przez symlink do `~/.local/share/cinnamon/desklets/`.
  Publikacja w Cinnamon Spices jest w planie (PLAN.md, Faza 10) i wymusi
  przeniesienie `bin/` do wnętrza xleta oraz rezygnację z instalowania
  akcji Nemo spoza katalogu desletu.
- **Interfejs po angielsku, tłumaczenia przez gettext.** Wszystkie widoczne
  ciągi idą przez `_()` (`Gettext.dgettext(UUID, …)`), polski siedzi w
  `karteczki@jkatnik/po/pl.po`, a `.mo` instaluje się do
  `~/.local/share/locale`. Nowy ciąg w kodzie = aktualizacja `.pot` i `.po`
  (komendy w README). Bez opcji wyboru języka w desklecie — bierze się z
  ustawień sesji.

## Konwencje

- Kod w JavaScript (GJS/CJS), zgodny ze stylem istniejących desletów
  Cinnamon Spices (patrz przykłady linkowane w PLAN.md).
- Skrypty pomocnicze (tworzenie notatki, manipulacja gsettings) w Bash lub
  Python 3 — cokolwiek krótsze dla danego zadania, bez frameworków.
- Bez dodawania zależności npm/pip — GJS ma dostęp do GLib/Gio (odczyt/zapis
  plików, JSON) i Gio.Settings (gsettings) natywnie, to wystarcza.
