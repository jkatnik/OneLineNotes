# Karteczki

Desklet Cinnamona z karteczkami samoprzylepnymi na pulpicie. Każda
karteczka to osobna instancja desletu i osobny plik JSON w
`~/.local/share/karteczki/`.

Szczegóły projektowe: [PLAN.md](PLAN.md), zasady pracy nad kodem:
[AGENTS.md](AGENTS.md).

## Instalacja

Projekt działa prosto z katalogu deweloperskiego — nie ma paczki .deb.

```bash
git clone <repo> ~/code/linux/karteczki      # albo dowolna inna ścieżka
cd ~/code/linux/karteczki

# 1. desklet widoczny dla Cinnamona
ln -s "$PWD/karteczki@jkatnik" ~/.local/share/cinnamon/desklets/

# 2. czcionka Caveat (zbundlowana w repo)
mkdir -p ~/.local/share/fonts
cp assets/fonts/Caveat-*.ttf ~/.local/share/fonts/
fc-cache -f

# 3. tłumaczenia (interfejs jest po angielsku, polski w po/pl.po)
for po in karteczki@jkatnik/po/*.po; do
    lang=$(basename "$po" .po)
    mkdir -p ~/.local/share/locale/$lang/LC_MESSAGES
    msgfmt "$po" -o ~/.local/share/locale/$lang/LC_MESSAGES/karteczki@jkatnik.mo
done

# 4. "Dodaj karteczkę" w menu kontekstowym pulpitu
mkdir -p ~/.local/share/nemo/actions
sed "s|__KARTECZKI__|$PWD|" dodaj-karteczke.nemo_action \
    > ~/.local/share/nemo/actions/dodaj-karteczke.nemo_action
```

Potem restart powłoki Cinnamona: `Alt+F2`, wpisz `r`, Enter. Jest
**wymagany po instalacji czcionki** — działający proces Cinnamona nie widzi
nowo dodanych fontów (Pango trzyma listę w pamięci od startu).

Pierwsza karteczka: prawoklik na pulpicie → „Dodaj karteczkę", albo
`bin/karteczki-nowa` z terminala.

## Obsługa

| Akcja | Efekt |
|---|---|
| Dwuklik w karteczkę | wejście w edycję (widać surowy Markdown) |
| Enter | zapis i wyjście z edycji |
| Escape | wyjście bez zapisu |
| Klik poza karteczką | zapis i wyjście z edycji |
| Przeciągnięcie | zmiana pozycji (zapisywana od razu) |
| Ctrl+klik w link | otwarcie w przeglądarce (`xdg-open`) |
| Prawoklik | menu: kolor atramentu, tło, rozmiar tekstu, język, formatowanie, usuń, nowa karteczka |

„Usuń" pyta o potwierdzenie; checkbox **Nie pytaj ponownie** wyłącza pytanie
na stałe (zapisywane w `settings.json`, wspólne dla wszystkich karteczek).
Zaznaczenie go i kliknięcie „Anuluj" nic nie zmienia — liczy się dopiero
potwierdzone usunięcie. Żeby przywrócić pytanie, usuń z pliku pole
`skipRemoveConfirmation`.

Nowa karteczka pojawia się tam, gdzie rozwinięto menu kontekstowe.

Karteczka stojąca **wyraźnie przy prawej lub dolnej krawędzi swojego
monitora** (środek w skrajnej ⅓ tego monitora) zapamiętuje odległość od tej
krawędzi zamiast od lewego górnego rogu pulpitu — w polu `anchor`. Po
odpięciu monitora albo zmianie rozdzielczości taka karteczka zostaje przy
swojej krawędzi zamiast wyjechać poza ekran czy wylądować w połowie pulpitu;
dzieje się to od razu, bez restartu powłoki. Oś bez kotwicy nie jest ruszana,
a kotwicę dostaje każda karta przy krawędzi — także te utworzone wcześniej.

Przeciągać da się za obszar karteczki **poza tekstem** — klik w sam tekst
przechwytuje Clutter. Przy krótkiej treści marginesu jest dużo, przy długiej
mało.

### Formatowanie treści

```markdown
**pogrubienie**   *kursywa*   __podkreślenie__   ~~przekreślenie~~
[tekst linku](https://example.com)
```

Bez zagnieżdżania (`**__oba naraz__**` nie zadziała), bez nagłówków, list i
cytatów. W pliku JSON zapisywany jest zawsze surowy Markdown. Tę samą
ściągawkę pokazuje pozycja „Formatowanie" w menu kontekstowym.

### Wygląd karteczki

- **Tło** — podmenu „Tło" listuje pliki PNG z `karteczki@jkatnik/img/`.
  Karteczka przyjmuje rozmiar swojego tła (dziś: 350×100 i 395×158), więc
  własny asset wystarczy wrzucić do tego katalogu w docelowym rozmiarze, z
  przezroczystym tłem. Skalowanie spłaszcza fakturę papieru — lepiej
  przygotować plik 1:1 niż liczyć na pomniejszanie.
- **Rozmiar tekstu** — podmenu Mała / Średnia / Duża (16/20/24).
- **Obrót** — każda karteczka dostaje przy tworzeniu losowy kąt ±3°, żeby
  wyglądały na rozrzucone. Kąt siedzi w polu `rotation` i nie zmienia się
  między restartami; `"rotation": 0` prostuje karteczkę.
- **Rodzina czcionki** — pole `font` w pliku notatki to pełny opis Pango
  (`"Caveat 20"`); wpisana ręcznie inna rodzina przeżyje zmianę rozmiaru
  z menu. Font musi być zainstalowany w systemie, a Cinnamon zrestartowany
  po jego instalacji.

## Tłumaczenia

Interfejs jest po angielsku, tłumaczenia leżą w `karteczki@jkatnik/po/`
(dziś: `pl.po`).

Język wybiera się w menu kontekstowym karteczki („Język"): *Język systemu*
bierze go z sesji (`LANGUAGE`/`LANG`) przez gettext, a konkretny język można
wymusić niezależnie od ustawień systemu. Wybór jest wspólny dla wszystkich
karteczek — zapisuje się w `~/.local/share/karteczki/settings.json` i
przemalowuje je od razu, bez restartu powłoki.

Przy „języku systemu" tłumaczenia czyta gettext z `~/.local/share/locale`,
więc po każdej zmianie `.po` trzeba przebudować `.mo` (pętla z kroku 3
instalacji). Wymuszony język czyta plik `.po` wprost z katalogu desletu —
gettext nie potrafi tłumaczyć na język inny niż locale procesu, a proces jest
jeden dla całego pulpitu.

Po dopisaniu nowego ciągu w kodzie zaktualizuj szablon i tłumaczenia:

```bash
xgettext --language=JavaScript --keyword=_ --from-code=UTF-8 --no-wrap \
    -o karteczki@jkatnik/po/karteczki@jkatnik.pot karteczki@jkatnik/*.js
msgmerge -U karteczki@jkatnik/po/pl.po karteczki@jkatnik/po/karteczki@jkatnik.pot
```

`cinnamon-xlet-makepot` robi to samo i dodatkowo zbiera `name`/`description`
z `metadata.json`, ale wymaga pakietu `python3-polib`, którego nie ma w tym
systemie — te dwa ciągi są w `.pot` dopisane ręcznie.

## Skrypty

```bash
bin/karteczki-nowa            # nowa karteczka pod kursorem
bin/karteczki-nowa 800 400    # nowa karteczka w danym punkcie ekranu
bin/karteczki-usun 7          # usuwa karteczkę o danym instance_id
```

`instance_id` widać w `gsettings get org.cinnamon enabled-desklets` oraz w
`~/.local/share/karteczki/instances.json` (mapowanie na UUID pliku notatki).

## Testy

```bash
python3 -m unittest discover -s tests -q    # CRUD, gsettings zamockowane
gjs tests/test_desklet_json.gjs             # JSON, kolory, Markdown → Pango
```

**Przed każdą zmianą w `desklet.js` uruchom kontrolę składni** — błąd w
kodzie desletu potrafi ubić całą powłokę Cinnamona (zdarzyło się dwa razy,
SIGSEGV), a nie tylko rzucić wyjątkiem:

```bash
gjs -c "$(printf 'function __check(){\n%s\n}\nprint("PARSE OK");' "$(cat karteczki@jkatnik/desklet.js)")"
```

Ratunek, gdy powłoka jednak padnie: `DISPLAY=:0 cinnamon --replace &`
z terminala (Guake, TTY, ssh).

### Ręczny scenariusz testowy

Po zmianach w desklecie warto przejść całą ścieżkę:

1. Prawoklik na pulpicie → „Dodaj karteczkę" — karteczka pojawia się w
   miejscu kliknięcia, z treścią „Lorem ipsum".
2. Dwuklik → wpisz `**test** [link](https://example.com)` → Enter —
   pogrubienie i niebieski link renderują się od razu.
3. Najedź na link — kursor zmienia się w rączkę; Ctrl+klik otwiera stronę.
4. Przeciągnij karteczkę w inne miejsce.
5. Prawoklik → „Kolor atramentu" → Czerwony, potem „Tło" → drugi wzór i
   „Rozmiar tekstu" → Duża: kolor, rozmiar karty i wielkość pisma zmieniają
   się od razu, kropka przeskakuje przy aktywnej pozycji. Zaznacz tekst w
   edycji — ma zostać czytelny (biały na kolorze atramentu).
6. Prawoklik → „Nowa karteczka" — druga karteczka wychodzi w miejscu, gdzie
   rozwinięto menu.
7. `Alt+F2`, `r` — po restarcie powłoki obie karteczki wracają na swoje
   pozycje, z zachowaną treścią, kolorem i **tym samym kątem obrotu**.
8. Prawoklik → „Usuń" na obu — znikają z pulpitu, a ich pliki z
   `~/.local/share/karteczki/`.

## Ograniczenia

- Karteczka rzucona przy krawędzi ekranu może częściowo z niego wystawać;
  pozycję spoza obszaru pulpitu Cinnamon przestawia na siatkę 25 px.
- Rodziny czcionki nie wybiera się z menu — tylko rozmiar (reszta w JSON).
- `dodaj-karteczke.nemo_action` zawiera bezwzględną ścieżkę do
  `bin/karteczki-nowa` — po przeniesieniu repo trzeba go wygenerować
  ponownie (krok 3 instalacji).
