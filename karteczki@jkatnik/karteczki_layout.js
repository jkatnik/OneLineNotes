// Kotwiczenie karteczek przy krawędziach ekranu.
//
// Karteczka zapisana samym `x, y` od lewego górnego rogu po zmianie
// rozdzielczości (odłączony monitor, inny zestaw ekranów) albo wyjeżdża poza
// ekran, albo — jeśli leżała przy dolnej krawędzi — ląduje w połowie pulpitu.
// Dlatego karty stojące wyraźnie przy prawej lub dolnej krawędzi zapisują
// odległość OD TEJ krawędzi i przy starcie odtwarzają z niej pozycję.

// „Wyraźnie przy krawędzi" = środek karty w skrajnej jednej trzeciej ekranu.
var EDGE_FRACTION = 1 / 3;

// -> { right?, bottom? } w pikselach od danej krawędzi; brak osi = liczona
// od lewej/górnej, czyli tak jak dotąd.
function anchorFor(x, y, w, h, screenW, screenH) {
    let anchor = {};
    if (x + w / 2 > screenW * (1 - EDGE_FRACTION)) {
        anchor.right = Math.round(screenW - (x + w));
    }
    if (y + h / 2 > screenH * (1 - EDGE_FRACTION)) {
        anchor.bottom = Math.round(screenH - (y + h));
    }
    return anchor;
}

// Pozycja wyliczona z kotwicy. Osie bez kotwicy zostają nietknięte, więc
// karta zakotwiczona tylko w pionie nie przeskakuje w poziomie.
function positionFor(anchor, x, y, w, h, screenW, screenH) {
    return {
        x: anchor && typeof anchor.right === "number"
            ? Math.max(0, Math.round(screenW - anchor.right - w)) : x,
        y: anchor && typeof anchor.bottom === "number"
            ? Math.max(0, Math.round(screenH - anchor.bottom - h)) : y,
    };
}
