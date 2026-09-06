const Desklet = imports.ui.desklet;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Clutter = imports.gi.Clutter;
const GdkPixbuf = imports.gi.GdkPixbuf;
const Cogl = imports.gi.Cogl;
const Lang = imports.lang;
const Main = imports.ui.main;
const Util = imports.misc.util;
const PopupMenu = imports.ui.popupMenu;
const ByteArray = imports.byteArray;

const UUID = "karteczki@jkatnik";
const DESKLET_ROOT = imports.ui.deskletManager.deskletMeta[UUID].path;
const DATA_DIR = GLib.get_home_dir() + "/.local/share/karteczki";
const CARD_WIDTH = 395;
const CARD_HEIGHT = 158;
const TEXT_PADDING = { top: 0, right: 30, bottom: 0, left: 30 };

function loadImageActor(path, width, height) {
    let pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(path, width, height, true);
    let image = new Clutter.Image();
    image.set_data(
        pixbuf.get_pixels(),
        pixbuf.get_has_alpha() ? Cogl.PixelFormat.RGBA_8888 : Cogl.PixelFormat.RGB_888,
        pixbuf.get_width(), pixbuf.get_height(),
        pixbuf.get_rowstride()
    );
    let actor = new Clutter.Actor({ width: width, height: height });
    actor.set_content(image);
    return actor;
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
                color: "#112971",
            };
        }
    },

    _buildUI: function () {
        let imgPath = DESKLET_ROOT + "/img/karteczka-bristol-3.png";
        this._container = new Clutter.Actor({
            width: CARD_WIDTH,
            height: CARD_HEIGHT,
            reactive: true,
            layout_manager: new Clutter.BinLayout(),
        });
        this._container.add_child(loadImageActor(imgPath, CARD_WIDTH, CARD_HEIGHT));

        this._text = new Clutter.Text({
            text: this.note.content,
            editable: false,
            selectable: false,
            single_line_mode: false,
            line_wrap: true,
            // Poza edycją klik musi dojść do deskletu; reactive Text
            // przechwytuje go, zanim on_desklet_clicked() zdąży wystartować modal.
            reactive: false,
            font_name: "Caveat 16",
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.CENTER,
            margin_top: TEXT_PADDING.top,
            margin_right: TEXT_PADDING.right,
            margin_bottom: TEXT_PADDING.bottom,
            margin_left: TEXT_PADDING.left,
        });
        this._text.set_color(this._hexToClutterColor(this.note.color || "#112971"));
        this._text.set_width(CARD_WIDTH - TEXT_PADDING.left - TEXT_PADDING.right);
        this._container.add_child(this._text);

        this._editing = false;
        this._stageClickId = null;

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
        if (event.get_button() !== 1 || event.get_click_count() !== 2) return;
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

    _startEditing: function () {
        if (this._editing || Main.deskletContainer.actor.get_children().some(function (actor) {
            return actor._desklet && actor._desklet !== this && actor._desklet._editing;
        }, this) || !Main.pushModal(this._text)) return;
        this._editing = true;
        this._editContent = this._text.get_text();
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
        if (!save) this._text.set_text(this._editContent);
        global.stage.disconnect(this._stageClickId);
        this._stageClickId = null;
        Main.popModal(this._text);
        this._text.set_editable(false);
        this._text.set_selectable(false);
        this._text.set_reactive(false);
        global.stage.set_key_focus(null);
        if (save) this._saveContent();
    },

    _hexToClutterColor: function (hex) {
        let [ok, color] = Clutter.Color.from_string(hex);
        return ok ? color : new Clutter.Color({ red: 17, green: 41, blue: 113, alpha: 255 });
    },

    _buildContextMenu: function () {
        let removeItem = new PopupMenu.PopupMenuItem("Usuń");
        removeItem.connect("activate", Lang.bind(this, this._onRemoveClicked));
        this._menu.addMenuItem(removeItem);

        let newItem = new PopupMenu.PopupMenuItem("Nowa karteczka");
        newItem.connect("activate", Lang.bind(this, this._onNewClicked));
        this._menu.addMenuItem(newItem);
    },

    _saveContent: function () {
        if (!this.notePath) return;
        this.note.content = this._text.get_text();
        this.note.modified_at = new Date().toISOString();
        writeJson(this.notePath, this.note);
    },

    _onDragEnd: function () {
        if (!this.notePath) return;
        let [x, y] = this.actor.get_position();
        this.note.position = { x: x, y: y };
        this.note.modified_at = new Date().toISOString();
        writeJson(this.notePath, this.note);
    },

    _onRemoveClicked: function () {
        Util.spawnCommandLine(
            DESKLET_ROOT + "/../bin/karteczki-usun " + this.instance_id
        );
    },

    _onNewClicked: function () {
        Util.spawnCommandLine(DESKLET_ROOT + "/../bin/karteczki-nowa");
    },
};
