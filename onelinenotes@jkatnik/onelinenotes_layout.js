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

// Kotwiczenie karteczek przy krawędziach ekranu.
//
// Karteczka zapisana samym `x, y` od lewego górnego rogu po zmianie zestawu
// monitorów albo wyjeżdża poza ekran, albo — jeśli leżała przy dolnej
// krawędzi — ląduje w połowie pulpitu. Dlatego karty stojące wyraźnie przy
// prawej lub dolnej krawędzi zapisują odległość OD TEJ krawędzi.
//
// Wszystko liczone względem MONITORA, nie całego wirtualnego pulpitu: przy
// dwóch ekranach karta dosunięta do prawej krawędzi lewego monitora jest w
// skali pulpitu mniej więcej pośrodku i inaczej nigdy nie dostałaby kotwicy.

// „Wyraźnie przy krawędzi" = środek karty w skrajnej jednej trzeciej monitora.
var EDGE_FRACTION = 1 / 3;

// monitor: { x, y, width, height, index } — jak w Main.layoutManager.monitors.
// -> { right?, bottom?, monitor } w pikselach od danej krawędzi monitora;
// brak osi = liczona od lewej/górnej, czyli tak jak dotąd.
function anchorFor(x, y, w, h, monitor) {
    let anchor = {};
    let relX = x - monitor.x;
    let relY = y - monitor.y;
    if (relX + w / 2 > monitor.width * (1 - EDGE_FRACTION)) {
        anchor.right = Math.round(monitor.width - (relX + w));
    }
    if (relY + h / 2 > monitor.height * (1 - EDGE_FRACTION)) {
        anchor.bottom = Math.round(monitor.height - (relY + h));
    }
    if (Object.keys(anchor).length) anchor.monitor = monitor.index;
    return anchor;
}

// Pozycja wyliczona z kotwicy względem podanego monitora. Osie bez kotwicy
// zostają nietknięte, więc karta zakotwiczona tylko w pionie nie przeskakuje
// w poziomie.
function positionFor(anchor, x, y, w, h, monitor) {
    return {
        x: anchor && typeof anchor.right === "number"
            ? Math.max(monitor.x, Math.round(monitor.x + monitor.width - anchor.right - w))
            : x,
        y: anchor && typeof anchor.bottom === "number"
            ? Math.max(monitor.y, Math.round(monitor.y + monitor.height - anchor.bottom - h))
            : y,
    };
}

// Monitor, względem którego liczymy: ten zapisany w kotwicy, dopóki istnieje
// (odpięcie ekranu zmienia numerację), inaczej ten, na którym karta leży
// teraz, a w ostateczności główny.
function monitorFor(anchor, x, y, w, h, monitors, primaryIndex) {
    if (anchor && typeof anchor.monitor === "number" && monitors[anchor.monitor]) {
        return monitors[anchor.monitor];
    }
    let cx = x + w / 2;
    let cy = y + h / 2;
    for (let i = 0; i < monitors.length; i++) {
        let m = monitors[i];
        if (cx >= m.x && cx < m.x + m.width && cy >= m.y && cy < m.y + m.height) return m;
    }
    return monitors[primaryIndex] || monitors[0];
}
