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

- **Desklet** (`desklet.js`, `metadata.json` z `"multiInstance": true`) —
  jedna instancja = jedna karteczka. `decoration: false`, żeby nie było
  paska tytułowego Cinnamona nad zdjęciem kartonika.
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
  wyszukiwanie po nazwie rodziny (`font_name: "Caveat 16"` w
  `desklet.js`). Uwaga: proces Cinnamona musi zostać zrestartowany po
  instalacji nowego pliku fontu — już działający proces nie widzi nowo
  dodanych czcionek bez restartu (fontconfig cache'uje listę w pamięci).
- **Format `enabled-desklets`** to lista stringów `"UUID:instance_id:X:Y"`
  — potwierdzone eksperymentalnie (Faza 0): tymczasowe ustawienie
  `gsettings set org.cinnamon enabled-desklets
  "['clock@cinnamon.org:1:100:100']"` zostało przyjęte przez Cinnamona bez
  normalizacji. `bin/karteczki_common.py` generuje wpisy w tym formacie.

## Czego NIE robimy (świadomie, YAGNI)

- Kolor atramentu wybierany z menu kontekstowego (4 kolory na stałe), ale
  bez palety/color pickera. Wybór tła i czcionki: zaprojektowany w PLAN.md
  (Faza 6), jeszcze nie zaimplementowany — do tego czasu pola `background`
  i `font` w JSON są zapisywane, ale przez desklet ignorowane.
- Brak zagnieżdżonego formatowania Markdown, nagłówków, list i cytatów —
  tylko pogrubienie, kursywa, podkreślenie, przekreślenie i link.
- Brak własnego mechanizmu przeciągania — używamy wbudowanego drag
  desklecików Cinnamona.
- Brak instalatora/paczki .deb — projekt uruchamiany z katalogu
  deweloperskiego przez symlink do `~/.local/share/cinnamon/desklets/`.

## Konwencje

- Kod w JavaScript (GJS/CJS), zgodny ze stylem istniejących desletów
  Cinnamon Spices (patrz przykłady linkowane w PLAN.md).
- Skrypty pomocnicze (tworzenie notatki, manipulacja gsettings) w Bash lub
  Python 3 — cokolwiek krótsze dla danego zadania, bez frameworków.
- Bez dodawania zależności npm/pip — GJS ma dostęp do GLib/Gio (odczyt/zapis
  plików, JSON) i Gio.Settings (gsettings) natywnie, to wystarcza.
