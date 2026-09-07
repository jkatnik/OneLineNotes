// Karteczki — desklet Cinnamona z karteczkami samoprzylepnymi.
// Copyright (C) 2026 Jarosław Kątnik
//
// Ten program jest wolnym oprogramowaniem: możesz go rozpowszechniać dalej
// i/lub modyfikować na warunkach Powszechnej Licencji Publicznej GNU (GPL),
// wydanej przez Free Software Foundation, w wersji 3 lub (według twojego
// wyboru) dowolnej późniejszej. Pełny tekst licencji: plik LICENSE.
//
// Program rozpowszechniany jest w nadziei, że będzie użyteczny, ale BEZ
// JAKIEJKOLWIEK GWARANCJI. Czcionki w assets/fonts/ mają własną licencję
// (SIL Open Font License 1.1) — patrz assets/fonts/OFL.txt.

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
const CheckBox = imports.ui.checkBox;
const ByteArray = imports.byteArray;

const Gettext = imports.gettext;
const PangoCairo = imports.gi.PangoCairo;

const UUID = "onelinenotes@jkatnik";
const DESKLET_ROOT = imports.ui.deskletManager.deskletMeta[UUID].path;

imports.searchPath.unshift(DESKLET_ROOT);
const Markdown = imports.onelinenotes_markdown;
const Layout = imports.onelinenotes_layout;
const I18n = imports.onelinenotes_i18n;

const DATA_DIR = GLib.get_home_dir() + "/.local/share/onelinenotes";
const IMG_DIR = DESKLET_ROOT + "/img";
const PO_DIR = DESKLET_ROOT + "/po";
// Skrypty leżą wewnątrz xleta — poza repo deweloperskim nie ma nic obok niego.
const BIN_DIR = DESKLET_ROOT + "/bin";
// Ustawienia wspólne dla wszystkich karteczek (język, potwierdzanie usuwania)
// — jeden plik obok notatek.
const SETTINGS_PATH = DATA_DIR + "/settings.json";
// Wymiary awaryjne: normalnie karta ma rozmiar swojego pliku tła.
const CARD_WIDTH = 350;
const CARD_HEIGHT = 100;
const DEFAULT_BACKGROUND = "paper-strip.png";
const DEFAULT_FONT = "Caveat 20";
const DEFAULT_COLOR = "#112971";
const MAX_ROTATION = 3;  // stopnie w każdą stronę — karteczki mają wyglądać na rzucone, nie przekrzywione

// Tłumaczenia instalują się do ~/.local/share/locale (tak robi
// cinnamon-spices-makepot --install i tam szukają ich pozostałe xlety).
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

// Moduł jest ładowany raz na cały proces, więc te dwie zmienne są wspólne dla
// wszystkich karteczek — na tym opiera się globalny wybór języka.
let settings = null;
let forcedTranslations = null;   // null = trzymamy się języka sesji (gettext)

// Projekt nazywał się wcześniej "karteczki" — notatki sprzed zmiany nazwy
// leżą w starym katalogu. Przenosimy je raz, żeby nikt nie stracił treści.
function migrateDataDir() {
    let stary = GLib.get_home_dir() + "/.local/share/karteczki";
    if (GLib.file_test(DATA_DIR, GLib.FileTest.EXISTS)) return;
    if (!GLib.file_test(stary, GLib.FileTest.IS_DIR)) return;
    if (Gio.file_new_for_path(stary).move(Gio.file_new_for_path(DATA_DIR), Gio.FileCopyFlags.NONE, null, null)) {
        global.log(UUID + ": przeniesiono dane z " + stary + " do " + DATA_DIR);
    }
}

function getSettings() {
    if (!settings) {
        migrateDataDir();
        settings = readJson(SETTINGS_PATH) || {};
    }
    return settings;
}

function saveSettings() {
    writeJson(SETTINGS_PATH, getSettings());
}

function loadLanguage() {
    let lang = getSettings().language || "system";
    if (lang === "system") {
        forcedTranslations = null;
    } else if (lang === "en") {
        forcedTranslations = {};     // msgid już są po angielsku
    } else {
        let po = readText(PO_DIR + "/" + lang + ".po");
        forcedTranslations = po ? I18n.parsePo(po) : null;
    }
}

function _(str) {
    if (forcedTranslations) return forcedTranslations[str] || str;
    return Gettext.dgettext(UUID, str);
}

// Etykiety powstają przy każdym budowaniu menu, nie raz przy ładowaniu
// modułu — inaczej przełączenie języka nie miałoby na nie wpływu.
function inkColors() {
    return [
        { name: _("Black"), hex: "#1a1a1a" },
        { name: _("Red"), hex: "#a51d2d" },
        { name: _("Blue"), hex: DEFAULT_COLOR },
        { name: _("Green"), hex: "#26653b" },
    ];
}

// Rodziny zbundlowane w assets/fonts/. Nazwy własne, więc nie tłumaczymy —
// listy fontów systemowych świadomie nie ma (setki pozycji w menu karteczki).
const FONT_FAMILIES = [
    "Architects Daughter",
    "Caveat",
    "Gloria Hallelujah",
    "Indie Flower",
    "Shadows Into Light",
];

function fontFamily(spec) {
    return fontSpec(spec).replace(/\s+\d+$/, "");
}

// Menu pokazuje tylko kroje faktycznie zainstalowane: paczka ze Spices nie
// wozi plików .ttf (zakaz binariów poza obrazami), więc użytkownik może mieć
// tylko część z nich. Gdy nie ma żadnego — pokazujemy pełną listę, żeby menu
// nie zostało puste, a Pango i tak podstawi zamiennik.
function availableFontFamilies() {
    let zainstalowane = {};
    PangoCairo.FontMap.get_default().list_families().forEach(function (rodzina) {
        zainstalowane[rodzina.get_name()] = true;
    });
    let lista = FONT_FAMILIES.filter(function (rodzina) { return zainstalowane[rodzina]; });
    return lista.length ? lista : FONT_FAMILIES;
}

function fontSizeOf(spec) {
    let match = /(\d+)$/.exec(fontSpec(spec));
    return match ? parseInt(match[1], 10) : 20;
}

function fontSizes() {
    return [
        { name: _("Small"), size: 16 },
        { name: _("Medium"), size: 20 },
        { name: _("Large"), size: 24 },
    ];
}
// Ściągawka w oknie „Formatowanie": [składnia, jak wygląda po zrenderowaniu].
// Przykładowe słowa są tłumaczone — składnia znaczników rzecz jasna nie.
function formattingHelp() {
    return [
        ["**" + _("bold") + "**", "<b>" + _("bold") + "</b>"],
        ["*" + _("italic") + "*", "<i>" + _("italic") + "</i>"],
        ["__" + _("underline") + "__", "<u>" + _("underline") + "</u>"],
        ["~~" + _("strikethrough") + "~~", "<s>" + _("strikethrough") + "</s>"],
        ["[" + _("text") + "](https://" + _("address") + ")",
            '<span underline="single" foreground="#1a5fb4">' + _("text") + "</span>"],
    ];
}
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

// Nazwy plików teł są własne i polskie; menu pokazuje tłumaczone etykiety,
// a plik dorzucony przez użytkownika — swoją nazwę bez rozszerzenia.
function backgroundLabel(file) {
    if (file === "paper-strip.png") return _("Paper strip");
    if (file === "paper-tall.png") return _("Tall paper");
    return file.replace(/\.png$/, "");
}

function listFiles(dir, suffix) {
    let names = [];
    let file = Gio.file_new_for_path(dir);
    if (!file.query_exists(null)) return names;
    let enumerator = file.enumerate_children("standard::name", Gio.FileQueryInfoFlags.NONE, null);
    let info;
    while ((info = enumerator.next_file(null)) !== null) {
        if (info.get_name().endsWith(suffix)) names.push(info.get_name());
    }
    enumerator.close(null);
    return names.sort();
}

function listBackgrounds() {
    return listFiles(IMG_DIR, ".png");
}

function listPoFiles() {
    return listFiles(PO_DIR, ".po");
}

// Pole `font` to pełny opis Pango ("Caveat 20"). Starsze pliki notatek mają
// samą rodzinę bez rozmiaru — takie wartości zastępujemy domyślną, zamiast
// pozwolić Pango zejść do własnego (drobnego) rozmiaru bazowego.
function fontSpec(font) {
    return /\d$/.test(font || "") ? font : DEFAULT_FONT;
}

// "Dodaj karteczkę" w menu tła pulpitu należy do Nemo, nie do powłoki, więc
// desklet musi położyć plik akcji poza swoim katalogiem. Robi to raz —
// skasowanie akcji przez użytkownika ma zostać skasowaniem, nie zaproszeniem
// do odtworzenia jej przy każdym starcie.
function installNemoAction() {
    let wzorzec = readText(DESKLET_ROOT + "/add-note.nemo_action");
    if (!wzorzec) return;

    let cel = GLib.get_home_dir() + "/.local/share/nemo/actions/add-note.nemo_action";
    let oczekiwana = wzorzec.replace(/__ONELINENOTES__/g, DESKLET_ROOT);
    let obecna = readText(cel);

    if (obecna === oczekiwana) return;

    // Brak pliku po naszej instalacji = użytkownik go skasował. Nie wracamy
    // z akcją przy każdym starcie.
    if (obecna === null && getSettings().nemoActionInstalled) return;

    // Każda inna różnica (zmieniona ścieżka po przeniesieniu repo, nowa nazwa
    // albo ikona w kolejnej wersji xleta) to nieaktualny wpis — nadpisujemy,
    // bo inaczej pozycja w menu pulpitu po cichu przestaje działać albo
    // zostaje ze starym opisem.
    GLib.mkdir_with_parents(GLib.get_home_dir() + "/.local/share/nemo/actions", 0o755);
    GLib.file_set_contents(cel, oczekiwana);
    global.log(UUID + ": " + (obecna === null ? "zainstalowano" : "zaktualizowano") + " akcję Nemo w " + cel);
    getSettings().nemoActionInstalled = true;
    saveSettings();
}

// amount 0 = bez zmian, 1 = biel.
function lighten(color, amount) {
    return new Clutter.Color({
        red: Math.round(color.red + (255 - color.red) * amount),
        green: Math.round(color.green + (255 - color.green) * amount),
        blue: Math.round(color.blue + (255 - color.blue) * amount),
        alpha: 255,
    });
}

function randomRotation() {
    return Math.round((Math.random() * 2 - 1) * MAX_ROTATION * 100) / 100;
}

function readText(path) {
    let file = Gio.file_new_for_path(path);
    if (!file.query_exists(null)) return null;
    let [ok, contents] = file.load_contents(null);
    return ok ? ByteArray.toString(contents) : null;
}

function readJson(path) {
    let text = readText(path);
    return text === null ? null : JSON.parse(text);
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

        loadLanguage();
        installNemoAction();
        this.notePath = null;
        this.note = null;
        this._loadNote();
        this._buildUI();
        // Punkt rozwinięcia menu, nie punkt kliknięcia w jego pozycję — nowa
        // karteczka ma wyjść tam, gdzie użytkownik otworzył menu. Podpięte raz,
        // bo menu przeżywa przebudowę pozycji po zmianie języka.
        this._menuPoint = null;
        this._menu.connect("open-state-changed", Lang.bind(this, function (menu, open) {
            if (open) this._menuPoint = global.get_pointer().slice(0, 2);
        }));
        this._buildContextMenu();

        this._draggable.connect("drag-end", Lang.bind(this, this._onDragEnd));
        // Odpięcie monitora nie przeładowuje deskletów, więc bez tego kotwica
        // zadziałałaby dopiero po restarcie powłoki.
        this._monitorsChangedId = Main.layoutManager.connect(
            "monitors-changed", Lang.bind(this, this._onMonitorsChanged));
    },

    on_desklet_removed: function () {
        if (this._monitorsChangedId) {
            Main.layoutManager.disconnect(this._monitorsChangedId);
            this._monitorsChangedId = 0;
        }
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
            // skryptu note-new) — karteczka bez trwałego zapisu.
            this.note = {
                content: _("(no note data — remove this one and add a new note from the desktop menu)"),
                color: DEFAULT_COLOR,
            };
        }
        // Notatki sprzed Fazy 6 wskazują tło, którego nie ma w img/ — bez tego
        // menu nie zaznaczałoby żadnej pozycji jako aktywnej.
        if (!this.note.background ||
            !GLib.file_test(IMG_DIR + "/" + this.note.background, GLib.FileTest.EXISTS)) {
            this.note.background = DEFAULT_BACKGROUND;
        }
        // Kąt losowany raz i zapisany — inaczej karteczki przeskakiwałyby przy
        // każdym restarcie powłoki. Zapis pomija modified_at: to nie jest
        // zmiana treści, tylko uzupełnienie brakującego pola.
        if (typeof this.note.rotation !== "number") {
            this.note.rotation = randomRotation();
            if (this.notePath) writeJson(this.notePath, this.note);
        }
    },

    _buildUI: function () {
        this._container = new Clutter.Actor({
            reactive: true,
            layout_manager: new Clutter.BinLayout(),
        });
        // Obrót na kontenerze, nie na this.actor — tamtym zarządza Cinnamon
        // przy przeciąganiu. Pivot ułamkowy trzyma oś w środku karty także
        // po zmianie tła na inny rozmiar.
        this._container.set_pivot_point(0.5, 0.5);
        this._container.set_rotation_angle(Clutter.RotateAxis.Z_AXIS, this.note.rotation || 0);
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
        // Kotwicę dostaje każda karta stojąca przy krawędzi, nie tylko ta
        // świeżo przeciągnięta — inaczej karteczki sprzed tej wersji nie
        // przetrwałyby odpięcia monitora.
        if (this.note.anchor) this._applyAnchoredPosition();
        else if (this._updateAnchor() && this.notePath) writeJson(this.notePath, this.note);
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
                // Log techniczny, nie interfejs — zostaje po angielsku.
                global.logWarning(UUID + ": failed to load background " + names[i] + " (" + e + ")");
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
        this._setFont(fontFamily(this.note.font), size);
    },

    _setFontFamily: function (family) {
        this._setFont(family, fontSizeOf(this.note.font));
    },

    // Rodzina i rozmiar mieszkają w jednym polu `font` (opis Pango), więc
    // zmiana jednego wymiaru musi zachować drugi.
    _setFont: function (family, size) {
        this.note.font = family + " " + size;
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
        // Jasne tło zaznaczenia, tekst w kolorze atramentu. Układ odwrotny
        // (ciemne tło + biały tekst) wyglądał dobrze tylko dopóki zaznaczenie
        // miało fokus — po zakończeniu zaznaczania Clutter rysuje tekst
        // zwykłym kolorem, więc granat znikał na granatowym tle.
        this._text.set_selection_color(lighten(ink, 0.78));
        this._text.set_selected_text_color(ink);
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

    // Kolor, tło, rozmiar i język to ten sam wzorzec podmenu z kropką przy
    // aktywnej pozycji — jedna metoda zamiast czterech kopii tego samego kodu.
    _addChoiceMenu: function (title, iconName, options, isActive, onSelect) {
        let submenu = new PopupMenu.PopupSubMenuMenuItem(title);
        // PopupSubMenuMenuItem nie przyjmuje ikony w konstruktorze. Ikona jako
        // osobny aktor dokłada pozycji kolumnę, a że szerokości kolumn są
        // wspólne dla całego menu, etykiety podmenu robiły się zerowej
        // szerokości. Dlatego ikona i tekst idą razem, w jednym aktorze.
        let label = submenu.label;
        submenu.removeActor(label);
        let box = new St.BoxLayout({ style: "spacing: 6px;" });
        box.add_child(new St.Icon({
            icon_name: iconName,
            icon_type: St.IconType.SYMBOLIC,
            style_class: "popup-menu-icon",
        }));
        box.add_child(label);
        submenu.addActor(box, { position: 0 });
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
        // Najpierw dwie akcje, których używa się najczęściej, potem separator
        // i ustawienia wyglądu — inaczej "Nowa karteczka" ginie pod podmenu.
        let newItem = new PopupMenu.PopupIconMenuItem(_("New note"), "list-add-symbolic", St.IconType.SYMBOLIC);
        newItem.connect("activate", Lang.bind(this, this._onNewClicked));
        this._menu.addMenuItem(newItem);

        let removeItem = new PopupMenu.PopupIconMenuItem(_("Remove"), "user-trash-symbolic", St.IconType.SYMBOLIC);
        removeItem.connect("activate", Lang.bind(this, this._onRemoveClicked));
        this._menu.addMenuItem(removeItem);

        this._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._addChoiceMenu(_("Ink color"), "color-select-symbolic",
            inkColors().map(function (ink) { return { name: ink.name, value: ink.hex }; }),
            Lang.bind(this, function (hex) { return (this.note.color || DEFAULT_COLOR) === hex; }),
            Lang.bind(this, function (hex) {
                this.note.color = hex;
                this._saveNote();
                this._applyInkColor(hex);
            }));

        this._addChoiceMenu(_("Background"), "image-x-generic-symbolic",
            listBackgrounds().map(function (file) {
                return { name: backgroundLabel(file), value: file };
            }),
            Lang.bind(this, function (file) { return (this.note.background || DEFAULT_BACKGROUND) === file; }),
            Lang.bind(this, this._setBackground));

        this._addChoiceMenu(_("Font"), "font-select-symbolic",
            availableFontFamilies().map(function (family) { return { name: family, value: family }; }),
            Lang.bind(this, function (family) { return fontFamily(this.note.font) === family; }),
            Lang.bind(this, this._setFontFamily));

        this._addChoiceMenu(_("Text size"), "font-x-generic-symbolic",
            fontSizes().map(function (f) { return { name: f.name, value: f.size }; }),
            Lang.bind(this, function (size) { return fontSpec(this.note.font).endsWith(" " + size); }),
            Lang.bind(this, this._setFontSize));

        // "system" = język sesji przez gettext; reszta to pliki po/*.po plus
        // angielski, który jest językiem samych msgid i pliku nie potrzebuje.
        let languages = [{ name: _("System language"), value: "system" }, { name: "English", value: "en" }];
        I18n.availableLanguages(listPoFiles()).forEach(function (code) {
            if (code !== "en") languages.push({ name: I18n.languageName(code), value: code });
        });
        this._addChoiceMenu(_("Language"), "preferences-desktop-locale-symbolic", languages,
            Lang.bind(this, function (code) { return (getSettings().language || "system") === code; }),
            Lang.bind(this, this._setLanguage));

        let helpItem = new PopupMenu.PopupIconMenuItem(_("Formatting"), "format-text-bold-symbolic", St.IconType.SYMBOLIC);
        helpItem.connect("activate", Lang.bind(this, this._showFormattingHelp));
        this._menu.addMenuItem(helpItem);
    },

    // Język jest ustawieniem wspólnym, więc po zmianie trzeba przemalować
    // menu i treść we wszystkich karteczkach, nie tylko w tej klikniętej.
    _setLanguage: function (code) {
        getSettings().language = code;
        saveSettings();
        loadLanguage();
        Main.deskletContainer.actor.get_children().forEach(function (actor) {
            if (actor._desklet && actor._desklet._applyLanguage) actor._desklet._applyLanguage();
        });
    },

    _applyLanguage: function () {
        this._menu.removeAll();
        this._buildContextMenu();
        this._renderContent();
    },

    _showFormattingHelp: function () {
        let dialog = new ModalDialog.ModalDialog();
        let box = new St.BoxLayout({ vertical: true, style: "spacing: 6px; padding: 12px;" });
        box.add_child(new St.Label({
            text: _("Note formatting"),
            style: "font-weight: bold; padding-bottom: 8px;",
        }));

        formattingHelp().forEach(function (row) {
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
            text: _("Markers do not nest. Ctrl+click opens a link.") + "\n" +
                  _("Double-click starts editing, Enter saves, Escape cancels."),
            style: "padding-top: 10px;",
        }));

        dialog.contentLayout.add_child(box);
        dialog.setButtons([{
            label: _("Close"),
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
        this._updateAnchor();
        this._saveNote();
    },

    _monitorFor: function () {
        let [x, y] = this.actor.get_position();
        let [w, h] = this._container.get_size();
        return Layout.monitorFor(this.note.anchor, x, y, w, h,
            Main.layoutManager.monitors, Main.layoutManager.primaryIndex);
    },

    // -> czy kotwica się zmieniła (żeby nie zapisywać pliku bez potrzeby).
    _updateAnchor: function () {
        let [x, y] = this.actor.get_position();
        let [w, h] = this._container.get_size();
        let anchor = Layout.anchorFor(x, y, w, h, this._monitorFor());
        let nowa = Object.keys(anchor).length ? anchor : null;
        if (JSON.stringify(nowa) === JSON.stringify(this.note.anchor || null)) return false;
        if (nowa) this.note.anchor = nowa;
        else delete this.note.anchor;
        return true;
    },

    // Cinnamon ustawia pozycję z gsettings tuż przed hookiem
    // on_desklet_added_to_desktop, więc to ostatni moment, żeby ją nadpisać
    // wartością wyliczoną z kotwicy. Wpisu w gsettings nie ruszamy — kotwica
    // jest źródłem prawdy i przelicza się przy każdym starcie oraz przy
    // każdej zmianie zestawu monitorów.
    _applyAnchoredPosition: function () {
        if (!this.note.anchor) return;
        let [x, y] = this.actor.get_position();
        let [w, h] = this._container.get_size();
        let pos = Layout.positionFor(this.note.anchor, x, y, w, h, this._monitorFor());
        if (pos.x === Math.round(x) && pos.y === Math.round(y)) return;
        this.actor.set_position(pos.x, pos.y);
        this.note.position = { x: pos.x, y: pos.y };
        this._saveNote();
    },

    _onMonitorsChanged: function () {
        // Cinnamon najpierw sam ściska deskleta do nowego układu ekranów —
        // nasze przeliczenie musi iść po jego ruchu, stąd idle.
        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, Lang.bind(this, function () {
            this._applyAnchoredPosition();
            return GLib.SOURCE_REMOVE;
        }));
    },

    _onRemoveClicked: function () {
        if (getSettings().skipRemoveConfirmation) {
            this._remove();
            return;
        }

        let dialog = new ModalDialog.ModalDialog();
        let box = new St.BoxLayout({ vertical: true, style: "spacing: 8px; padding: 12px;" });
        box.add_child(new St.Label({
            text: _("Remove this note?"),
            style: "font-weight: bold;",
        }));
        box.add_child(new St.Label({ text: _("Its file will be deleted permanently.") }));

        let skip = new CheckBox.CheckBox(_("Don't ask again"), null, false);
        box.add_child(skip.actor);
        dialog.contentLayout.add_child(box);

        dialog.setButtons([
            {
                label: _("Cancel"),
                action: function () { dialog.close(); },
                key: Clutter.KEY_Escape,
            },
            {
                label: _("Remove"),
                action: Lang.bind(this, function () {
                    // Zapamiętujemy dopiero po potwierdzeniu — zaznaczenie
                    // checkboxa i Anuluj nie ma wyłączać pytania.
                    if (skip.actor.checked) {
                        getSettings().skipRemoveConfirmation = true;
                        saveSettings();
                    }
                    dialog.close();
                    this._remove();
                }),
                default: true,
                destructive_action: true,
            },
        ]);
        dialog.open();
    },

    _remove: function () {
        Util.spawnCommandLine(
            BIN_DIR + "/note-remove " + this.instance_id
        );
    },

    _onNewClicked: function () {
        let cmd = BIN_DIR + "/note-new";
        if (this._menuPoint) cmd += " " + this._menuPoint[0] + " " + this._menuPoint[1];
        Util.spawnCommandLine(cmd);
    },
};
