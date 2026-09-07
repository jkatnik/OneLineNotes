// Sprawdza readJson/writeJson oraz parsowanie koloru z desklet.js
// plus konwersję Markdown → Pango markup (realny moduł, nie kopia)
// (uruchom: gjs tests/test_desklet.gjs)
imports.searchPath.unshift("/home/jkatnik/code/linux/karteczki/onelinenotes@jkatnik");
const Markdown = imports.onelinenotes_markdown;
const Layout = imports.onelinenotes_layout;
const I18n = imports.onelinenotes_i18n;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Clutter = imports.gi.Clutter;
const GdkPixbuf = imports.gi.GdkPixbuf;
const Cogl = imports.gi.Cogl;
const ByteArray = imports.byteArray;

Clutter.init(null);

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

function hexToClutterColor(hex) {
    let [ok, color] = Clutter.Color.from_string(hex);
    return ok ? color : new Clutter.Color({ red: 17, green: 41, blue: 113, alpha: 255 });
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

function assert(cond, msg) {
    if (!cond) throw new Error("FAIL: " + msg);
}

let tmpDir = GLib.dir_make_tmp("karteczki-test-XXXXXX");
let path = tmpDir + "/note.json";

assert(readJson(path) === null, "brak pliku -> null");

writeJson(path, { content: "próba ąćę", color: "#112971" });
let loaded = readJson(path);
assert(loaded.content === "próba ąćę", "treść z polskimi znakami przetrwała zapis/odczyt");
assert(loaded.color === "#112971", "kolor zachowany");

GLib.unlink(path);
GLib.rmdir(tmpDir);

let validColor = hexToClutterColor("#112971");
assert(validColor.red === 17 && validColor.green === 41 && validColor.blue === 113,
    "poprawny hex zamieniony na RGB");

let fallbackColor = hexToClutterColor("nie-jest-kolorem");
assert(fallbackColor.red === 17 && fallbackColor.green === 41 && fallbackColor.blue === 113,
    "nieprawidłowy hex spada na domyślny kolor atramentu");

let imgActor = loadImageActor(
    "/home/jkatnik/code/linux/karteczki/assets/karteczka-bristol.png", 350, 100
);
assert(imgActor.get_content() !== null, "tło karteczki ładuje się jako Clutter.Image");

// --- Markdown → Pango markup ---

assert(Markdown.render("**gruby**").markup === "<b>gruby</b>", "pogrubienie");
assert(Markdown.render("*skos*").markup === "<i>skos</i>", "kursywa");
assert(Markdown.render("__pod__").markup === "<u>pod</u>", "podkreślenie");
assert(Markdown.render("~~precz~~").markup === "<s>precz</s>", "przekreślenie");
assert(Markdown.render("~~a~~ i **b**").markup === "<s>a</s> i <b>b</b>",
    "przekreślenie nie zjada sąsiednich znaczników");
assert(Markdown.render("zwykły tekst").markup === "zwykły tekst", "tekst bez znaczników bez zmian");
assert(Markdown.render("a < b & c").markup === "a &lt; b &amp; c",
    "znaki specjalne markupu wyescape'owane (inaczej Pango odrzuca całość)");
assert(Markdown.render("**a** i *b*").markup === "<b>a</b> i <i>b</i>", "kilka znaczników w linii");
assert(Markdown.render("snake_case_nazwa").markup === "snake_case_nazwa",
    "pojedynczy podkreślnik nie jest znacznikiem");

let link = Markdown.render("zobacz [stronę](https://example.com/a_b) tutaj");
assert(link.visible === "zobacz stronę tutaj", "widoczny tekst linku bez składni MD");
assert(link.links.length === 1 && link.links[0].url === "https://example.com/a_b", "URL wyłuskany");
// "zobacz " to 7 bajtów; "stronę" ma 7 bajtów (ę = 2), więc koniec na 14.
assert(link.links[0].start === 7 && link.links[0].end === 14,
    "offsety linku liczone w bajtach, nie znakach");
assert(Markdown.linkAt(link.links, 7) === "https://example.com/a_b", "trafienie w początek linku");
assert(Markdown.linkAt(link.links, 13) === "https://example.com/a_b", "trafienie w koniec linku");
assert(Markdown.linkAt(link.links, 14) === null, "pozycja tuż za linkiem to już nie link");
assert(Markdown.linkAt(link.links, 0) === null, "tekst przed linkiem to nie link");

// Markup musi być poprawny dla Pango — inaczej Clutter odrzuci CAŁY tekst.
let tricky = Markdown.render("**a<b>** [x&y](http://q) *k*");
let [parsed] = imports.gi.Pango.parse_markup(tricky.markup, -1, "\0");
assert(parsed === true, "wygenerowany markup parsuje się w Pango");

// --- kotwiczenie przy krawędziach monitora ---

const KARTA_W = 350, KARTA_H = 100;
// Realny układ z tej maszyny: laptop i monitor 28" obok siebie.
const LAPTOP = { x: 0, y: 0, width: 2560, height: 1440, index: 0 };
const DUZY = { x: 2560, y: 133, width: 1920, height: 1200, index: 1 };

let lewaGora = Layout.anchorFor(100, 100, KARTA_W, KARTA_H, LAPTOP);
assert(Object.keys(lewaGora).length === 0, "karta w lewym górnym rogu nie dostaje kotwicy");

// Przypadek, który zawiódł przy liczeniu względem całego pulpitu: karta przy
// prawej krawędzi lewego monitora jest w skali 4480 px mniej więcej pośrodku.
let przyPrawejLaptopa = Layout.anchorFor(2100, 275, KARTA_W, KARTA_H, LAPTOP);
assert(przyPrawejLaptopa.right === 110 && przyPrawejLaptopa.monitor === 0,
    "karta przy prawej krawędzi lewego monitora kotwiczy się do tego monitora");
assert(przyPrawejLaptopa.bottom === undefined, "oś pionowa bez kotwicy");

let przyDole = Layout.anchorFor(300, 1300, KARTA_W, KARTA_H, LAPTOP);
assert(przyDole.bottom === 40 && przyDole.right === undefined,
    "karta przy dolnej krawędzi kotwiczy się tylko w pionie");

// Monitor z przesunięciem (x=2560, y=133) — offset musi być odjęty.
let naDuzym = Layout.anchorFor(4000, 1150, KARTA_W, KARTA_H, DUZY);
assert(naDuzym.right === 130 && naDuzym.bottom === 83 && naDuzym.monitor === 1,
    "kotwica na drugim monitorze liczona względem jego własnego prostokąta");

let poPrzeliczeniu = Layout.positionFor({ right: 130, bottom: 83, monitor: 1 },
    0, 0, KARTA_W, KARTA_H, DUZY);
assert(poPrzeliczeniu.x === 4000 && poPrzeliczeniu.y === 1150,
    "pozycja odtworzona z kotwicy wraca na to samo miejsce");

// Odpięty monitor 28": karta z kotwicą monitora 1 ląduje przy prawej krawędzi laptopa.
let poOdpieciu = Layout.positionFor({ right: 130, monitor: 1 }, 4000, 300, KARTA_W, KARTA_H, LAPTOP);
assert(poOdpieciu.x === 2080, "po odpięciu ekranu karta trzyma się prawej krawędzi tego, co zostało");
assert(poOdpieciu.y === 300, "oś bez kotwicy zostaje nietknięta");

let ciasno = Layout.positionFor({ right: 130 }, 4300, 300, KARTA_W, KARTA_H,
    { x: 0, y: 0, width: 400, height: 800, index: 0 });
assert(ciasno.x === 0, "przy monitorze węższym niż karta pozycja nie wychodzi przed jego krawędź");

assert(Layout.positionFor(undefined, 10, 20, KARTA_W, KARTA_H, LAPTOP).x === 10,
    "brak kotwicy zostawia pozycję bez zmian");

// Wybór monitora: zapisany indeks wygrywa, dopóki taki monitor istnieje.
assert(Layout.monitorFor({ right: 10, monitor: 1 }, 100, 100, KARTA_W, KARTA_H, [LAPTOP, DUZY], 0) === DUZY,
    "kotwica wskazuje monitor po indeksie");
assert(Layout.monitorFor({ right: 10, monitor: 1 }, 100, 100, KARTA_W, KARTA_H, [LAPTOP], 0) === LAPTOP,
    "gdy zapisany monitor zniknął, liczy się ten, na którym karta leży");
assert(Layout.monitorFor(null, 3000, 500, KARTA_W, KARTA_H, [LAPTOP, DUZY], 0) === DUZY,
    "bez kotwicy monitor ustalany po położeniu karty");
assert(Layout.monitorFor(null, 9000, 9000, KARTA_W, KARTA_H, [LAPTOP, DUZY], 0) === LAPTOP,
    "karta poza wszystkimi monitorami spada na monitor główny");

// --- wybór języka: parser .po ---

let po = I18n.parsePo([
    '# komentarz tłumacza',
    'msgid ""',
    'msgstr ""',
    '"Content-Type: text/plain; charset=UTF-8\\n"',
    '',
    'msgid "Remove"',
    'msgstr "Usuń"',
    '',
    '#: desklet.js:1',
    'msgid "Markers do not nest.\\nCtrl+click opens a link."',
    'msgstr "Znaczniki się nie zagnieżdżają.\\nCtrl+klik otwiera link."',
    '',
    'msgid "Long one"',
    'msgstr ""',
    '"pierwsza część "',
    '"i druga"',
    '',
    'msgid "Nieprzetłumaczone"',
    'msgstr ""',
].join("\n"));

assert(po["Remove"] === "Usuń", "prosty wpis .po");
assert(po[""] === undefined, "nagłówek .po nie trafia do tłumaczeń");
assert(po["Markers do not nest.\nCtrl+click opens a link."] ===
    "Znaczniki się nie zagnieżdżają.\nCtrl+klik otwiera link.", "sekwencja \\n rozwinięta");
assert(po["Long one"] === "pierwsza część i druga", "msgstr sklejony z kilku linii");
assert(po["Nieprzetłumaczone"] === undefined, "pusty msgstr pomijany (zostaje msgid)");

assert(I18n.availableLanguages(["pl.po", "de.po", "onelinenotes@jkatnik.pot", "readme.txt"]).join(",") === "de,pl",
    "lista języków tylko z plików .po, posortowana");
assert(I18n.languageName("pl") === "Polski" && I18n.languageName("xx") === "xx",
    "nazwa języka własna, nieznany kod zwracany bez zmian");

print("OK: test_desklet.gjs");
