// Wybór języka niezależny od locale sesji.
//
// gettext zawsze tłumaczy na język procesu — a Cinnamon to jeden proces dla
// całego pulpitu, więc wymuszenie polskiego przez setlocale przestawiłoby
// też panel i menu systemowe. Dlatego przy wymuszonym języku czytamy plik
// `po/<lang>.po` wprost. Pliki .po zostają jedynym źródłem tłumaczeń, więc
// tłumacze i tak pracują normalnie (i wymóg Spices jest spełniony).

// Minimalny parser .po: msgid/msgstr, w tym łamane na kilka linii.
// Bez form mnogich i kontekstów — w tym desklecie nie występują.
function parsePo(text) {
    let translations = {};
    let msgid = null;
    let target = null;      // "id" | "str" | null — do czego dopisuje kolejny literał
    let buffer = { id: "", str: "" };

    function flush() {
        if (msgid && buffer.str) translations[msgid] = buffer.str;
        msgid = null;
        buffer = { id: "", str: "" };
    }

    text.split("\n").forEach(function (line) {
        line = line.trim();
        if (line.startsWith("#")) return;
        if (line.startsWith("msgid ")) {
            flush();
            target = "id";
            buffer.id = unquote(line.slice(6));
        } else if (line.startsWith("msgstr ")) {
            target = "str";
            msgid = buffer.id;
            buffer.str = unquote(line.slice(7));
        } else if (line.startsWith('"') && target) {
            buffer[target] += unquote(line);
        } else if (line === "") {
            flush();
            target = null;
        }
    });
    flush();
    delete translations[""];   // nagłówek .po
    return translations;
}

function unquote(literal) {
    let match = /^"([\s\S]*)"$/.exec(literal.trim());
    if (!match) return "";
    return match[1]
        .replace(/\\n/g, "\n")
        .replace(/\\t/g, "\t")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\");
}

// Kody języków z plików po/*.po, posortowane.
function availableLanguages(fileNames) {
    return fileNames
        .filter(function (name) { return name.endsWith(".po"); })
        .map(function (name) { return name.slice(0, -3); })
        .sort();
}

// Nazwa języka pokazywana w menu — własna, nie tłumaczona (tak robią
// przełączniki języka wszędzie: „Polski" zostaje „Polski" w każdym UI).
var LANGUAGE_NAMES = {
    en: "English",
    pl: "Polski",
};

function languageName(code) {
    return LANGUAGE_NAMES[code] || code;
}
