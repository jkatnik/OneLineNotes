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
const CARD_WIDTH = 350;
const CARD_HEIGHT = 100;
const TEXT_PADDING = { top: 0, right: 30, bottom: 0, left: 30 };
const TEXTURE_SHARPEN_FACTOR = 6;
const TEXTURE_SHARPEN_RADIUS = 2;

// Silne pomniejszenie zdjęcia (2172×724 → ~256×100) uśrednia sąsiednie
// piksele i wygładza subtelną fakturę papieru do niemal płaskiej barwy.
// Prawdziwy unsharp mask: rozmyj (box blur, separowalny — pozioma potem
// pionowa średnia krocząca) jako lokalne "tło", potem wzmocnij różnicę
// piksel-minus-tło. Wersja z jedną globalną średnią zamiast lokalnego
// rozmycia obcinała jasne piksele karteczki do bieli, bo cień na brzegu
// karty ciągnął średnią w dół.
function boostTexture(pixbuf, factor, radius) {
    let px = pixbuf.get_pixels();
    let hasAlpha = pixbuf.get_has_alpha();
    let channels = hasAlpha ? 4 : 3;
    let rowstride = pixbuf.get_rowstride();
    let width = pixbuf.get_width();
    let height = pixbuf.get_height();
    let n = height * rowstride;

    let rowBlur = new Float32Array(n);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            for (let c = 0; c < 3; c++) {
                let sum = 0, cnt = 0;
                for (let dx = -radius; dx <= radius; dx++) {
                    let xx = x + dx;
                    if (xx < 0 || xx >= width) continue;
                    sum += px[y * rowstride + xx * channels + c];
                    cnt++;
                }
                rowBlur[y * rowstride + x * channels + c] = sum / cnt;
            }
        }
    }

    let blurred = new Float32Array(n);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            for (let c = 0; c < 3; c++) {
                let sum = 0, cnt = 0;
                for (let dy = -radius; dy <= radius; dy++) {
                    let yy = y + dy;
                    if (yy < 0 || yy >= height) continue;
                    sum += rowBlur[yy * rowstride + x * channels + c];
                    cnt++;
                }
                blurred[y * rowstride + x * channels + c] = sum / cnt;
            }
        }
    }

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let i = y * rowstride + x * channels;
            if (hasAlpha && px[i + 3] < 10) continue;
            for (let c = 0; c < 3; c++) {
                let idx = i + c;
                let v = px[idx] + (px[idx] - blurred[idx]) * (factor - 1);
                px[idx] = Math.max(0, Math.min(255, Math.round(v)));
            }
        }
    }
}

function loadImageActor(path, width, height) {
    let pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(path, width, height, true);
    boostTexture(pixbuf, TEXTURE_SHARPEN_FACTOR, TEXTURE_SHARPEN_RADIUS);
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
        let imgPath = DESKLET_ROOT + "/img/karteczka-bristol-2.png";
        this._container = new Clutter.Actor({
            width: CARD_WIDTH,
            height: CARD_HEIGHT,
            reactive: true,
            layout_manager: new Clutter.BinLayout(),
        });
        this._container.add_child(loadImageActor(imgPath, CARD_WIDTH, CARD_HEIGHT));

        this._text = new Clutter.Text({
            text: this.note.content,
            editable: true,
            selectable: true,
            single_line_mode: false,
            line_wrap: true,
            reactive: true,
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
            if (event.get_key_symbol() === Clutter.KEY_Escape) {
                this._stopEditing();
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
        // Kliknięcie w karteczkę nie przenosi fokusu klawiatury X11 na
        // powłokę Cinnamona (to okno typu "desktop", nie dostaje go przez
        // zwykłe click-to-focus WM) — bez pushModal wpisywane znaki lecą
        // do ostatnio aktywnego okna (np. przeglądarki), mimo że Clutter
        // wewnętrznie zaznacza fokus na tym aktorze.
        this._startEditing();
    },

    _startEditing: function () {
        if (this._editing) return;
        this._editing = true;
        Main.pushModal(this._text);
        // pushModal grabuje CAŁY input X11 (klawiatura+mysz), więc bez tego
        // nasłuchu kliknięcie poza karteczką nigdy by go nie zwolniło —
        // użytkownik zostałby zablokowany na edycji do końca sesji.
        this._stageClickId = global.stage.connect("captured-event", Lang.bind(this, function (actor, event) {
            if (event.type() === Clutter.EventType.BUTTON_PRESS && !this._container.contains(event.get_source())) {
                this._stopEditing();
            }
            return Clutter.EVENT_PROPAGATE;
        }));
    },

    _stopEditing: function () {
        if (!this._editing) return;
        this._editing = false;
        global.stage.disconnect(this._stageClickId);
        this._stageClickId = null;
        Main.popModal(this._text);
        global.stage.set_key_focus(null);
        this._saveContent();
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
