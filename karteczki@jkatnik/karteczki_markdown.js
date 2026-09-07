// Markdown → Pango markup dla Clutter.Text.
//
// Obsługiwane (bez zagnieżdżania — jeden znacznik na fragment):
//   **pogrubienie**   *kursywa*   __podkreślenie__   ~~przekreślenie~~
//   [tekst](url)
//
// Świadomie NIE ma `_kursywa_` — kolidowałoby ze snake_case w treści
// i z `__podkreślenie__`. Nagłówki, listy i cytaty: patrz AGENTS.md (YAGNI).
//
// `render()` zwraca też pozycje linków liczone w BAJTACH widocznego tekstu,
// bo Clutter.coords_to_position() zwraca indeks bajtowy w tekście layoutu
// (przy polskich znakach różni się od indeksu znakowego).

var LINK_COLOR = "#1a5fb4";

// Kolejność alternatyw ma znaczenie: dłuższe znaczniki (** , __) muszą być
// próbowane przed krótszymi (*), inaczej `**x**` złapie się jako pusta kursywa.
const TOKEN = /\[([^\]\n]+)\]\(([^)\s]+)\)|\*\*([^*\n]+)\*\*|__([^_\n]+)__|~~([^~\n]+)~~|\*([^*\n]+)\*/g;

function escapeMarkup(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function byteLength(text) {
    return new TextEncoder().encode(text).length;
}

// -> { markup, visible, links: [{ start, end, url }] }
function render(text) {
    let markup = "";
    let visible = "";
    let links = [];
    let last = 0;
    let match;

    TOKEN.lastIndex = 0;
    while ((match = TOKEN.exec(text)) !== null) {
        let before = text.slice(last, match.index);
        markup += escapeMarkup(before);
        visible += before;

        if (match[1] !== undefined) {
            let start = byteLength(visible);
            visible += match[1];
            links.push({ start: start, end: byteLength(visible), url: match[2] });
            markup += '<span underline="single" foreground="' + LINK_COLOR + '">' +
                escapeMarkup(match[1]) + "</span>";
        } else if (match[3] !== undefined) {
            markup += "<b>" + escapeMarkup(match[3]) + "</b>";
            visible += match[3];
        } else if (match[4] !== undefined) {
            markup += "<u>" + escapeMarkup(match[4]) + "</u>";
            visible += match[4];
        } else if (match[5] !== undefined) {
            markup += "<s>" + escapeMarkup(match[5]) + "</s>";
            visible += match[5];
        } else {
            markup += "<i>" + escapeMarkup(match[6]) + "</i>";
            visible += match[6];
        }
        last = match.index + match[0].length;
    }

    let rest = text.slice(last);
    return { markup: markup + escapeMarkup(rest), visible: visible + rest, links: links };
}

// Bajtowa pozycja w widocznym tekście -> URL albo null.
function linkAt(links, position) {
    for (let i = 0; i < links.length; i++) {
        if (position >= links[i].start && position < links[i].end) return links[i].url;
    }
    return null;
}
