// Sprawdza readJson/writeJson oraz parsowanie koloru z desklet.js
// plus konwersję Markdown → Pango markup (realny moduł, nie kopia)
// (uruchom: gjs tests/test_desklet_json.gjs)
imports.searchPath.unshift("/home/jkatnik/code/linux/karteczki/karteczki@jkatnik");
const Markdown = imports.karteczki_markdown;
const Layout = imports.karteczki_layout;
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

// --- kotwiczenie przy krawędziach ekranu ---

const EKRAN_W = 4480, EKRAN_H = 1440, KARTA_W = 350, KARTA_H = 100;

let lewaGora = Layout.anchorFor(100, 100, KARTA_W, KARTA_H, EKRAN_W, EKRAN_H);
assert(Object.keys(lewaGora).length === 0, "karta w lewym górnym rogu nie dostaje kotwicy");

let przyPrawej = Layout.anchorFor(4000, 200, KARTA_W, KARTA_H, EKRAN_W, EKRAN_H);
assert(przyPrawej.right === 130 && przyPrawej.bottom === undefined,
    "karta przy prawej krawędzi kotwiczy się tylko w poziomie");

let przyDole = Layout.anchorFor(300, 1300, KARTA_W, KARTA_H, EKRAN_W, EKRAN_H);
assert(przyDole.bottom === 40 && przyDole.right === undefined,
    "karta przy dolnej krawędzi kotwiczy się tylko w pionie");

let rog = Layout.anchorFor(4000, 1300, KARTA_W, KARTA_H, EKRAN_W, EKRAN_H);
assert(rog.right === 130 && rog.bottom === 40, "prawy dolny róg kotwiczy się w obu osiach");

// Odłączony monitor: ekran kurczy się z 4480 na 2560, karta ma zostać przy prawej.
let poZmianie = Layout.positionFor({ right: 130 }, 4000, 200, KARTA_W, KARTA_H, 2560, EKRAN_H);
assert(poZmianie.x === 2080, "kotwica prawa przelicza x na węższym ekranie");
assert(poZmianie.y === 200, "oś bez kotwicy zostaje nietknięta");

let niższyEkran = Layout.positionFor({ bottom: 40 }, 300, 1300, KARTA_W, KARTA_H, EKRAN_W, 1080);
assert(niższyEkran.y === 940 && niższyEkran.x === 300, "kotwica dolna przelicza y na niższym ekranie");

let ciasno = Layout.positionFor({ right: 130 }, 4000, 200, KARTA_W, KARTA_H, 400, EKRAN_H);
assert(ciasno.x === 0, "przy ekranie węższym niż karta pozycja nie schodzi poniżej zera");

assert(Layout.positionFor(undefined, 10, 20, KARTA_W, KARTA_H, EKRAN_W, EKRAN_H).x === 10,
    "brak kotwicy zostawia pozycję bez zmian");

print("OK: test_desklet_json.gjs");
