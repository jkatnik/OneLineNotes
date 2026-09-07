const Desklet = imports.ui.desklet;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Clutter = imports.gi.Clutter;
const GdkPixbuf = imports.gi.GdkPixbuf;
const Cogl = imports.gi.Cogl;
const Cinnamon = imports.gi.Cinnamon;
const Lang = imports.lang;
const Main = imports.ui.main;
const Util = imports.misc.util;
const PopupMenu = imports.ui.popupMenu;
const ModalDialog = imports.ui.modalDialog;
const ByteArray = imports.byteArray;

const UUID = "karteczki@jkatnik";
const DESKLET_ROOT = imports.ui.deskletManager.deskletMeta[UUID].path;
imports.searchPath.unshift(DESKLET_ROOT);
const Markdown = imports.karteczki_markdown;

const DATA_DIR = GLib.get_home_dir() + "/.local/share/karteczki";
const IMG_DIR = DESKLET_ROOT + "/img";
// Wymiary awaryjne: normalnie karta ma rozmiar swojego pliku tła.
const CARD_WIDTH = 350;
const CARD_HEIGHT = 100;
const DEFAULT_BACKGROUND = "karteczka-bristol-4.png";
const DEFAULT_FONT = "Caveat 20";
const FONT_SIZES = [
    { name: "Mała", size: 16 },
    { name: "Średnia", size: 20 },
    { name: "Duża", size: 24 },
];
const DEFAULT_COLOR = "#112971";
const INK_COLORS = [
    { name: "Czarny", hex: "#1a1a1a" },
    { name: "Czerwony", hex: "#a51d2d" },
    { name: "Niebieski", hex: DEFAULT_COLOR },
    { name: "Zielony", hex: "#26653b" },
];
// Ściągawka w oknie „Formatowanie": [składnia, jak wygląda po zrenderowaniu].
const FORMATTING_HELP = [
    ["**pogrubienie**", "<b>pogrubienie</b>"],
    ["*kursywa*", "<i>kursywa</i>"],
    ["__podkreślenie__", "<u>podkreślenie</u>"],
    ["~~przekreślenie~~", "<s>przekreślenie</s>"],
    ["[tekst](https://adres)", '<span underline="single" foreground="#1a5fb4">tekst</span>'],
];
// bottom: 15 podnosi tekst o 7,5 px. Papier na grafice kończy się w ~85/100
// (niżej jest wtopiony cień), a font ma długie wydłużenia dolne — bez tego
// tekst jest wyśrodkowany geometrycznie, ale optycznie siedzi za nisko.
const TEXT_PADDING = { top: 0, right: 16, bottom: 15, left: 16 };

// Tło renderowane 1:1 — rozmiar karty bierze się z pliku, nie odwrotnie.
function loadImageActor(path) {
    let pixbuf = GdkPixbuf.Pixbuf.new_from_file(path);
    let image = new Clutter.Image();
    image.set_data(
        pixbuf.get_pixels(),
        pixbuf.get_has_alpha() ? Cogl.PixelFormat.RGBA_8888 : Cogl.PixelFormat.RGB_888,
        pixbuf.get_width(), pixbuf.get_height(),
        pixbuf.get_rowstride()
    );
    let actor = new Clutter.Actor({ width: pixbuf.get_width(), height: pixbuf.get_height() });
    actor.set_content(image);
    return actor;
}

function listBackgrounds() {
    let names = [];
    let enumerator = Gio.file_new_for_path(IMG_DIR).enumerate_children(
        "standard::name", Gio.FileQueryInfoFlags.NONE, null
    );
    let info;
    while ((info = enumerator.next_file(null)) !== null) {
        if (info.get_name().endsWith(".png")) names.push(info.get_name());
    }
    enumerator.close(null);
    return names.sort();
}

// Pole `font` to pełny opis Pango ("Caveat 20"). Starsze pliki notatek mają
// samą rodzinę bez rozmiaru — takie wartości zastępujemy domyślną, zamiast
// pozwolić Pango zejść do własnego (drobnego) rozmiaru bazowego.
function fontSpec(font) {
    return /\d$/.test(font || "") ? font : DEFAULT_FONT;
}

function readJson(path) {
    let file = Gio.file_new_for_path(path);
    if (!file.query_exists(null)) return null;
    let [ok, contents] = file.load_contents(null);
    if (!ok) return null;
    return JSON.parse(ByteArray.toString(contents));
}

function writeJson(path, data) {
    GLib.file_set_contents(path, JSON.stringify(data, null, 2));
}

function MyDesklet(metadata, desklet_id) {
    this._init(metadata, desklet_id);
}

function main(metadata, desklet_id) {
    return new MyDesklet(metadata, desklet_id);
}

MyDesklet.prototype = {
    __proto__: Desklet.Desklet.prototype,

    _init: function (metadata, desklet_id) {
        Desklet.Desklet.prototype._init.call(this, metadata, desklet_id);

        this.notePath = null;
        this.note = null;
        this._loadNote();
        this._buildUI();
        this._buildContextMenu();

        this._draggable.connect("drag-end", Lang.bind(this, this._onDragEnd));
    },

    _loadNote: function () {
        let mapping = readJson(DATA_DIR + "/instances.json") || {};
        let noteUuid = mapping[String(this.instance_id)];
        if (noteUuid) {
            this.notePath = DATA_DIR + "/" + noteUuid + ".json";
            this.note = readJson(this.notePath);
        }
        if (!this.note) {
            // brak mapowania (np. instancja dodana ręcznie, z pominięciem
            // skryptu karteczki-nowa) — karteczka bez trwałego zapisu.
            this.note = {
                content: "(brak danych karteczki — usuń i dodaj ponownie z menu pulpitu)",
                color: DEFAULT_COLOR,
            };
        }
        // Notatki sprzed Fazy 6 wskazują tło, którego nie ma w img/ — bez tego
        // menu nie zaznaczałoby żadnej pozycji jako aktywnej.
        if (!this.note.background ||
            !GLib.file_test(IMG_DIR + "/" + this.note.background, GLib.FileTest.EXISTS)) {
            this.note.background = DEFAULT_BACKGROUND;
        }
    },

    _buildUI: function () {
        this._container = new Clutter.Actor({
            reactive: true,
            layout_manager: new Clutter.BinLayout(),
        });
        this._background = null;
        this._applyBackground();

        this._text = new Clutter.Text({
            editable: false,
            selectable: false,
            single_line_mode: false,
            line_wrap: true,
            // Poza edycją klik musi dojść do deskletu; reactive Text
            // przechwytuje go, zanim on_desklet_clicked() zdąży wystartować modal.
            reactive: false,
            font_name: fontSpec(this.note.font),
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.CENTER,
            margin_top: TEXT_PADDING.top,
            margin_right: TEXT_PADDING.right,
            margin_bottom: TEXT_PADDING.bottom,
            margin_left: TEXT_PADDING.left,
        });
        this._fitTextWidth();
        this._container.add_child(this._text);

        this._editing = false;
        this._stageClickId = null;
        this._links = [];
        this._linkCursor = false;
        this._renderContent();

        this._container.connect("motion-event", Lang.bind(this, this._onMotion));
        // Kursor jest globalny, więc karta musi go oddać przy zjeździe z niej —
        // inaczej rączka zostaje na całym pulpicie.
        this._container.connect("leave-event", Lang.bind(this, function () {
            this._setLinkCursor(false);
            return Clutter.EVENT_PROPAGATE;
        }));

        this._text.connect("key-press-event", Lang.bind(this, function (actor, event) {
            let key = event.get_key_symbol();
            if (key === Clutter.KEY_Escape) {
                this._stopEditing(false);
                return Clutter.EVENT_STOP;
            }
            if (key === Clutter.KEY_Return || key === Clutter.KEY_KP_Enter || key === Clutter.KEY_ISO_Enter) {
                this._stopEditing(true);
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        }));

        this.setContent(this._container);
    },

    on_desklet_clicked: function (event) {
        // Cinnamon woła to tylko dla "prawdziwego" kliknięcia (bez
        // przekroczenia progu przeciągnięcia) i już z pominięciem
        // prawoklika (patrz desklet.js bazowego Desklet: _onButtonReleaseEvent).
        // Wcześniejsza wersja łapała "button-press-event" bezpośrednio na
        // kontenerze karteczki i zawsze zwracała STOP — to blokowało
        // zdarzenie przed dotarciem do wbudowanego mechanizmu D&D
        // (nasłuchuje na tym samym "button-press-event", ale na `this.actor`,
        // czyli rodzicu kontenera) i do obsługi menu kontekstowego, więc i
        // przeciąganie, i prawoklik przestawały działać.
        if (event.get_button() !== 1) return;
        if (event.get_state() & Clutter.ModifierType.CONTROL_MASK) {
            // Ctrl+klik otwiera link. Zwykły klik nie może tego robić: przy
            // dwukliku Clutter emituje najpierw zdarzenie z click_count 1,
            // więc wejście w edycję nad linkiem odpalałoby przeglądarkę.
            this._openLinkAt(event);
            return;
        }
        if (event.get_click_count() !== 2) return;
        // Kliknięcie w karteczkę nie przenosi fokusu klawiatury X11 na
        // powłokę Cinnamona (to okno typu "desktop", nie dostaje go przez
        // zwykłe click-to-focus WM) — bez pushModal wpisywane znaki lecą
        // do ostatnio aktywnego okna (np. przeglądarki), mimo że Clutter
        // wewnętrznie zaznacza fokus na tym aktorze.
        this._startEditing();
    },

    on_desklet_added_to_desktop_internal: function (userEnabled) {
        // Bazowy Flashspot przez chwilę blokuje pierwszy klik nowej karteczki.
        this.on_desklet_added_to_desktop(userEnabled);
    },

    on_desklet_added_to_desktop: function () {
        // Nemo może być nad nowym deskletem zanim Cinnamon zacznie śledzić
        // jego aktor myszy. Bez tego nie docierają ani klik, ani prawoklik.
        this._trackMouse();
    },

    _applyBackground: function () {
        if (this._background) this._background.destroy();
        this._background = null;
        // Nazwa pliku, nie ścieżka — JSON notatki ma przetrwać przeniesienie repo.
        let names = [this.note.background, DEFAULT_BACKGROUND];
        for (let i = 0; i < names.length; i++) {
            if (!names[i]) continue;
            try {
                this._background = loadImageActor(IMG_DIR + "/" + names[i]);
                break;
            } catch (e) {
                global.logWarning("karteczki: nie wczytano tła " + names[i] + " (" + e + ")");
            }
        }
        if (this._background) {
            this._container.insert_child_below(this._background, null);
            this._container.set_size(this._background.get_width(), this._background.get_height());
        } else {
            this._container.set_size(CARD_WIDTH, CARD_HEIGHT);
        }
    },

    _fitTextWidth: function () {
        this._text.set_width(this._container.get_width() - TEXT_PADDING.left - TEXT_PADDING.right);
    },

    _setBackground: function (name) {
        this.note.background = name;
        this._saveNote();
        this._applyBackground();
        this._fitTextWidth();
    },

    _setFontSize: function (size) {
        this.note.font = fontSpec(this.note.font).replace(/\d+$/, String(size));
        this._saveNote();
        this._text.set_font_name(this.note.font);
    },

    // Poza edycją treść jest renderowana jako Pango markup; w edycji widać
    // surowy Markdown, bo to on jest zapisywany w JSON.
    _renderContent: function () {
        let rendered = Markdown.render(this.note.content || "");
        this._links = rendered.links;
        this._text.set_markup(rendered.markup);
        this._applyInkColor(this.note.color || DEFAULT_COLOR);
    },

    _applyInkColor: function (hex) {
        let ink = this._hexToClutterColor(hex);
        this._text.set_color(ink);
        // Domyślne tło zaznaczenia w Clutterze jest w tym samym, ciemnym
        // odcieniu co atrament — zaznaczony tekst robił się nieczytelny.
        // Tło zaznaczenia = kolor atramentu, sam tekst na biało.
        this._text.set_selection_color(ink);
        this._text.set_selected_text_color(new Clutter.Color({ red: 255, green: 255, blue: 255, alpha: 255 }));
    },

    _linkAtEvent: function (event) {
        if (this._editing || !this._links.length) return null;
        let [stageX, stageY] = event.get_coords();
        let [ok, x, y] = this._text.transform_stage_point(stageX, stageY);
        // Pango dociąga punkt do najbliższego znaku w linii, więc bez
        // sprawdzenia prostokąta tekstu miejsce obok linku liczyłoby się jako link.
        if (!ok || x < 0 || y < 0 || x > this._text.get_width() || y > this._text.get_height()) return null;
        return Markdown.linkAt(this._links, this._text.coords_to_position(x, y));
    },

    _openLinkAt: function (event) {
        let url = this._linkAtEvent(event);
        if (url) Util.spawnCommandLine("xdg-open " + GLib.shell_quote(url));
    },

    _onMotion: function (actor, event) {
        this._setLinkCursor(this._linkAtEvent(event) !== null);
        return Clutter.EVENT_PROPAGATE;
    },

    _setLinkCursor: function (over) {
        if (over === this._linkCursor) return;
        this._linkCursor = over;
        if (over) global.set_cursor(Cinnamon.Cursor.POINTING_HAND);
        else global.unset_cursor();
    },

    _startEditing: function () {
        if (this._editing || Main.deskletContainer.actor.get_children().some(function (actor) {
            return actor._desklet && actor._desklet !== this && actor._desklet._editing;
        }, this) || !Main.pushModal(this._text)) return;
        this._editing = true;
        this._setLinkCursor(false);
        this._text.set_use_markup(false);
        this._text.set_text(this.note.content || "");
        this._text.set_editable(true);
        this._text.set_selectable(true);
        this._text.set_reactive(true);
        this._text.grab_key_focus();
        // Main.pushModal() przechwytuje także mysz, więc klik poza kartą
        // musi być obsłużony na scenie, aby zakończyć i zapisać edycję.
        this._stageClickId = global.stage.connect("captured-event", Lang.bind(this, function (actor, event) {
            let source = event.get_source();
            if (event.type() === Clutter.EventType.BUTTON_PRESS && source !== this.actor && !this.actor.contains(source)) {
                this._stopEditing(true);
            }
            return Clutter.EVENT_PROPAGATE;
        }));
    },

    _stopEditing: function (save) {
        if (!this._editing) return;
        this._editing = false;
        // Odczyt PRZED przywróceniem markupu — po set_markup() get_text()
        // zwraca tekst bez znaczników, czyli nie to, co zapisujemy.
        let edited = this._text.get_text();
        global.stage.disconnect(this._stageClickId);
        this._stageClickId = null;
        Main.popModal(this._text);
        this._text.set_editable(false);
        this._text.set_selectable(false);
        this._text.set_reactive(false);
        global.stage.set_key_focus(null);
        if (save) {
            this.note.content = edited;
            this._saveNote();
        }
        this._renderContent();
    },

    _hexToClutterColor: function (hex) {
        let [ok, color] = Clutter.Color.from_string(hex);
        return ok ? color : new Clutter.Color({ red: 17, green: 41, blue: 113, alpha: 255 });
    },

    // Kolor, tło i rozmiar to ten sam wzorzec podmenu z kropką przy aktywnej
    // pozycji — jedna metoda zamiast trzech kopii tego samego kodu.
    _addChoiceMenu: function (title, options, isActive, onSelect) {
        let submenu = new PopupMenu.PopupSubMenuMenuItem(title);
        let items = options.map(Lang.bind(this, function (option) {
            let item = new PopupMenu.PopupMenuItem(option.name);
            item.setShowDot(isActive(option.value));
            item.connect("activate", function () {
                onSelect(option.value);
                items.forEach(function (other, i) { other.setShowDot(isActive(options[i].value)); });
            });
            submenu.menu.addMenuItem(item);
            return item;
        }));
        this._menu.addMenuItem(submenu);
    },

    _buildContextMenu: function () {
        // Punkt rozwinięcia menu, nie punkt kliknięcia w jego pozycję — nowa
        // karteczka ma wyjść tam, gdzie użytkownik otworzył menu.
        this._menuPoint = null;
        this._menu.connect("open-state-changed", Lang.bind(this, function (menu, open) {
            if (open) {
                let [x, y] = global.get_pointer();
                this._menuPoint = [x, y];
            }
        }));

        this._addChoiceMenu("Kolor atramentu",
            INK_COLORS.map(function (ink) { return { name: ink.name, value: ink.hex }; }),
            Lang.bind(this, function (hex) { return (this.note.color || DEFAULT_COLOR) === hex; }),
            Lang.bind(this, function (hex) {
                this.note.color = hex;
                this._saveNote();
                this._applyInkColor(hex);
            }));

        this._addChoiceMenu("Tło",
            listBackgrounds().map(function (file) {
                return { name: file.replace(/\.png$/, ""), value: file };
            }),
            Lang.bind(this, function (file) { return (this.note.background || DEFAULT_BACKGROUND) === file; }),
            Lang.bind(this, this._setBackground));

        this._addChoiceMenu("Rozmiar tekstu",
            FONT_SIZES.map(function (f) { return { name: f.name, value: f.size }; }),
            Lang.bind(this, function (size) { return fontSpec(this.note.font).endsWith(" " + size); }),
            Lang.bind(this, this._setFontSize));

        let helpItem = new PopupMenu.PopupMenuItem("Formatowanie");
        helpItem.connect("activate", Lang.bind(this, this._showFormattingHelp));
        this._menu.addMenuItem(helpItem);

        let removeItem = new PopupMenu.PopupMenuItem("Usuń");
        removeItem.connect("activate", Lang.bind(this, this._onRemoveClicked));
        this._menu.addMenuItem(removeItem);

        let newItem = new PopupMenu.PopupMenuItem("Nowa karteczka");
        newItem.connect("activate", Lang.bind(this, this._onNewClicked));
        this._menu.addMenuItem(newItem);
    },

    _showFormattingHelp: function () {
        let dialog = new ModalDialog.ModalDialog();
        let box = new St.BoxLayout({ vertical: true, style: "spacing: 6px; padding: 12px;" });
        box.add_child(new St.Label({
            text: "Formatowanie treści karteczki",
            style: "font-weight: bold; padding-bottom: 8px;",
        }));

        FORMATTING_HELP.forEach(function (row) {
            let line = new St.BoxLayout({ style: "spacing: 20px;" });
            line.add_child(new St.Label({
                text: row[0],
                style: "font-family: monospace; width: 210px;",
            }));
            let rendered = new St.Label();
            rendered.clutter_text.set_markup(row[1]);
            line.add_child(rendered);
            box.add_child(line);
        });

        box.add_child(new St.Label({
            text: "Znaczniki nie zagnieżdżają się. Ctrl+klik otwiera link.\n" +
                  "Dwuklik wchodzi w edycję, Enter zapisuje, Escape anuluje.",
            style: "padding-top: 10px;",
        }));

        dialog.contentLayout.add_child(box);
        dialog.setButtons([{
            label: "Zamknij",
            action: function () { dialog.close(); },
            key: Clutter.KEY_Escape,
            default: true,
        }]);
        dialog.open();
    },

    _saveNote: function () {
        if (!this.notePath) return;
        this.note.modified_at = new Date().toISOString();
        writeJson(this.notePath, this.note);
    },

    _onDragEnd: function () {
        let [x, y] = this.actor.get_position();
        this.note.position = { x: x, y: y };
        this._saveNote();
    },

    _onRemoveClicked: function () {
        Util.spawnCommandLine(
            DESKLET_ROOT + "/../bin/karteczki-usun " + this.instance_id
        );
    },

    _onNewClicked: function () {
        let cmd = DESKLET_ROOT + "/../bin/karteczki-nowa";
        if (this._menuPoint) cmd += " " + this._menuPoint[0] + " " + this._menuPoint[1];
        Util.spawnCommandLine(cmd);
    },
};
