// Sprawdza readJson/writeJson oraz parsowanie koloru z desklet.js
// (uruchom: gjs tests/test_desklet_json.gjs)
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

print("OK: test_desklet_json.gjs");
