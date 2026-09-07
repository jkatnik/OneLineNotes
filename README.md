# Sticky Notes (karteczki@jkatnik)

A Cinnamon desklet that puts sticky notes on your desktop. Each note is a
separate desklet instance backed by its own JSON file in
`~/.local/share/karteczki/`.

The note looks like a real piece of paper because it *is* a photo of one —
the background is a PNG rendered 1:1, not drawn programmatically.

Design notes and working agreements live in [PLAN.md](PLAN.md) and
[AGENTS.md](AGENTS.md) — both in Polish, the project's working language.

## Installation

The desklet runs straight from the development directory; there is no .deb.

```bash
git clone <repo> ~/code/linux/karteczki      # any path works
cd ~/code/linux/karteczki

# 1. make the desklet visible to Cinnamon
ln -s "$PWD/karteczki@jkatnik" ~/.local/share/cinnamon/desklets/

# 2. fonts (optional but recommended — see "Appearance" below)
mkdir -p ~/.local/share/fonts
cp assets/fonts/*.ttf ~/.local/share/fonts/
fc-cache -f

# 3. translations (the interface is English; Polish lives in po/pl.po)
for po in karteczki@jkatnik/po/*.po; do
    lang=$(basename "$po" .po)
    mkdir -p ~/.local/share/locale/$lang/LC_MESSAGES
    msgfmt "$po" -o ~/.local/share/locale/$lang/LC_MESSAGES/karteczki@jkatnik.mo
done
```

Then restart the Cinnamon shell: `Alt+F2`, type `r`, Enter. This is
**required after installing fonts** — a running Cinnamon process does not see
newly added ones, because Pango caches the family list at startup.

Add the desklet through *System Settings → Desklets*, or create the first note
from a terminal with `karteczki@jkatnik/bin/karteczki-nowa`.

The **"Add note" entry in the desktop context menu installs itself**: on its
first run the desklet writes the action into `~/.local/share/nemo/actions/`.
That menu belongs to Nemo rather than to the Cinnamon shell, which is why the
desklet cannot provide it from the inside. If you delete the action it stays
deleted — the desklet records that its one-time install already happened.

## Usage

| Action | Result |
|---|---|
| Double-click a note | edit it (raw Markdown becomes visible) |
| Enter | save and leave edit mode |
| Escape | leave without saving |
| Click outside the note | save and leave edit mode |
| Drag | move the note (position saved immediately) |
| Ctrl+click a link | open it in the browser (`xdg-open`) |
| Right-click | menu: new note, remove — then, below a separator, appearance settings |

A new note appears where the context menu was opened.

**Remove** asks for confirmation; the **Don't ask again** checkbox disables the
prompt for good (stored in `settings.json`, shared by all notes). Ticking it
and then pressing Cancel changes nothing — only a confirmed removal counts. To
bring the prompt back, delete the `skipRemoveConfirmation` field from that file.

A note sitting **clearly against the right or bottom edge of its monitor** (its
centre within the outer third) remembers its distance from that edge instead of
from the desktop's top-left corner, in the `anchor` field. When a monitor is
unplugged or the resolution changes, such a note stays at its edge rather than
sliding off-screen or landing in the middle of the desktop — and it happens
immediately, without restarting the shell. The unanchored axis is left alone,
and every note near an edge gets an anchor, including ones created earlier.

Dragging works from the part of the note **outside the text** — a click on the
text itself is captured by Clutter. Short notes leave plenty of margin, long
ones leave little.

### Text formatting

```markdown
**bold**   *italic*   __underline__   ~~strikethrough~~
[link text](https://example.com)
```

No nesting (`**__both at once__**` will not work), no headings, lists or
quotes. The JSON file always stores raw Markdown. The same cheat sheet is
available from the **Formatting** entry in the context menu.

### Appearance

- **Background** — the *Background* submenu lists the PNG files in
  `karteczki@jkatnik/img/`. A note takes the size of its background (currently
  354×104 and 395×158), so adding your own is a matter of dropping a
  transparent PNG of the target size into that directory. Scaling flattens the
  paper texture, so prepare the file 1:1 instead of relying on downscaling.
- **Font** — the *Font* submenu lists the typefaces bundled in `assets/fonts/`:
  Architects Daughter, Caveat, Gloria Hallelujah, Indie Flower, Shadows Into
  Light. All of them cover Polish diacritics. Only the ones actually installed
  are listed, so skipping step 2 of the installation simply means fewer entries.

  Only Caveat ships a real bold face — in the other typefaces `**bold**` is
  synthesised by Pango, and it shows.
- **Text size** — Small / Medium / Large (16/20/24). Family and size share a
  single `font` field (a Pango description such as `"Caveat 20"`), so changing
  one keeps the other; a family typed in by hand also survives a size change.
- **Ink colour** — black, red, blue (default) or green.
- **Rotation** — every note gets a random angle of ±3° when created, so they
  look scattered rather than aligned to a grid. The angle lives in `rotation`
  and does not change between restarts; `"rotation": 0` straightens a note out.

## Translations

The interface is English; translations live in `karteczki@jkatnik/po/`
(currently `pl.po`).

The language is chosen from the note's context menu (*Language*). *System
language* follows the session (`LANGUAGE`/`LANG`) through gettext, while a
specific language can be forced regardless of the system setting. The choice is
shared by every note — it is stored in
`~/.local/share/karteczki/settings.json` and repaints them immediately, with no
shell restart.

Under *System language* the translations come from `~/.local/share/locale`
through gettext, so after editing a `.po` file the `.mo` has to be rebuilt (the
loop from installation step 3). A forced language is read straight from the
`.po` file in the desklet's directory: gettext can only translate into the
process locale, and the whole desktop shares a single Cinnamon process.

After adding a new string to the code, refresh the template and translations:

```bash
xgettext --language=JavaScript --keyword=_ --from-code=UTF-8 --no-wrap \
    -o karteczki@jkatnik/po/karteczki@jkatnik.pot karteczki@jkatnik/*.js
msgmerge -U karteczki@jkatnik/po/pl.po karteczki@jkatnik/po/karteczki@jkatnik.pot
```

`cinnamon-xlet-makepot` does the same and additionally collects
`name`/`description` from `metadata.json`, but it needs the `python3-polib`
package, which is not installed here — those two strings are appended to the
`.pot` by hand.

## Scripts

```bash
karteczki@jkatnik/bin/karteczki-nowa            # new note under the pointer
karteczki@jkatnik/bin/karteczki-nowa 800 400    # new note at a screen position
karteczki@jkatnik/bin/karteczki-usun 7          # remove the note with that instance_id
```

The scripts live inside the xlet because that is the only directory shipped to
users; the desklet calls them by a path relative to itself.

`instance_id` shows up in `gsettings get org.cinnamon enabled-desklets` and in
`~/.local/share/karteczki/instances.json`, which maps it to the note's UUID.

## Tests

```bash
python3 -m unittest discover -s tests -q    # CRUD, gsettings mocked out
gjs tests/test_desklet_json.gjs             # JSON, colours, Markdown, layout, .po parser
```

**Syntax-check `desklet.js` before every change** — an error in desklet code
can take down the whole Cinnamon shell (it happened twice, SIGSEGV) instead of
merely throwing:

```bash
gjs -c "$(printf 'function __check(){\n%s\n}\nprint("PARSE OK");' "$(cat karteczki@jkatnik/desklet.js)")"
```

If the shell does go down anyway: `DISPLAY=:0 cinnamon --replace &` from a
terminal (Guake, a TTY, or ssh).

### Manual test scenario

Worth walking through after changing the desklet:

1. Right-click the desktop → *Add note* — a note appears where you clicked,
   containing "Lorem ipsum".
2. Double-click it, type `**test** [link](https://example.com)`, press Enter —
   the bold text and the blue link render immediately.
3. Hover the link: the cursor turns into a hand; Ctrl+click opens the page.
4. Drag the note somewhere else.
5. Right-click → *Ink colour* → Red, then *Background* → the other pattern,
   *Font* → another typeface and *Text size* → Large. Colour, card size and
   lettering change at once, and the dot follows the active entry. Select text
   while editing — it has to stay readable (white on the ink colour).
6. Right-click → *New note* — the second note appears where the menu was opened.
7. `Alt+F2`, `r` — after the shell restarts both notes return to their
   positions with their content, colour and **rotation angle** intact.
8. Right-click → *Remove* on both — they disappear from the desktop, and their
   files from `~/.local/share/karteczki/`.

## Publishing to Cinnamon Spices

The repository keeps a convenient layout for development, while Spices requires
a fixed one. Rather than reshaping the repository, the package is built on
demand:

```bash
tools/build-spice          # writes build/karteczki@jkatnik/
```

The script also checks the requirements that are easy to trip over: `files/`
containing nothing but the UUID directory, the presence of `screenshot.png`,
the required `metadata.json` fields, and the absence of `.ttf` files — Spices
forbids pre-compiled blobs other than images, which is why the fonts stay out
of the package and the desklet falls back to whatever is installed.

## Licence

Code: **GPL-3.0-or-later**, full text in [LICENSE](LICENSE).

The fonts in `assets/fonts/` carry **their own licence** — SIL Open Font
License 1.1 (`assets/fonts/OFL.txt`); copyright: The Caveat Project Authors
(Caveat) and Kimberly Geswein (Architects Daughter, Gloria Hallelujah, Indie
Flower, Shadows Into Light). This is not a conflict: the OFL does not cover the
program that ships a font, so the two licences simply coexist here. Worth
remembering when redistributing — a font may not be sold on its own, and every
copy must carry its copyright notice and the full licence text, hence `OFL.txt`
next to the `.ttf` files.

The note photographs in `assets/*.png` are the author's own work, under the
same licence as the code.

## Limitations

- A note dropped near a screen edge can stick out past it; a position outside
  the desktop area gets snapped by Cinnamon to a 25 px grid.
- The font menu only offers the typefaces bundled with the project; any other
  system font has to be typed into the note's `font` field by hand.
- The drop shadow is baked into the background PNG rather than rendered by the
  GPU, so it rotates together with the paper.
