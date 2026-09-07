#!/usr/bin/env bash
# OneLineNotes — installer for the Cinnamon desklet.
# Copyright (C) 2026 Jarosław Kątnik, GPL-3.0-or-later (see LICENSE).
#
#   curl -fsSL https://raw.githubusercontent.com/jkatnik/oneLineNotes/main/install.sh | bash
#
# Run from a clone (./install.sh) and it installs from that working copy
# instead of downloading anything.
#
# Everything lands under $HOME — no root, no system directories:
#   ~/.local/share/cinnamon/desklets/onelinenotes@jkatnik   the desklet
#   ~/.local/share/fonts/                                   bundled fonts
#   ~/.local/share/locale/<lang>/LC_MESSAGES/               translations
#
# The "Add OneLineNote" entry in the desktop menu is not installed here: the
# desklet creates it itself on first run.

set -euo pipefail

REPO="${ONELINENOTES_REPO:-jkatnik/oneLineNotes}"
BRANCH="${ONELINENOTES_BRANCH:-main}"
UUID="onelinenotes@jkatnik"

DESKLET_DIR="$HOME/.local/share/cinnamon/desklets"
FONT_DIR="$HOME/.local/share/fonts"
LOCALE_DIR="$HOME/.local/share/locale"

info()  { printf '  %s\n' "$*"; }
warn()  { printf '  ! %s\n' "$*" >&2; }
die()   { printf '\nOneLineNotes: %s\n' "$*" >&2; exit 1; }

command -v cinnamon >/dev/null 2>&1 || warn "Cinnamon not found — installing anyway."

# --- where do we take the files from -----------------------------------------
skrypt_dir=$(cd "$(dirname "${BASH_SOURCE[0]:-.}")" 2>/dev/null && pwd || echo "")
if [ -n "$skrypt_dir" ] && [ -d "$skrypt_dir/$UUID" ]; then
    SRC="$skrypt_dir"
    info "Installing from the local checkout: $SRC"
else
    command -v curl >/dev/null 2>&1 || command -v wget >/dev/null 2>&1 \
        || die "needs curl or wget to download the sources."
    command -v tar >/dev/null 2>&1 || die "needs tar to unpack the sources."

    TMP=$(mktemp -d)
    trap 'rm -rf "$TMP"' EXIT
    url="https://codeload.github.com/$REPO/tar.gz/refs/heads/$BRANCH"
    info "Downloading $REPO ($BRANCH)…"
    if command -v curl >/dev/null 2>&1; then
        curl -fsSL "$url" -o "$TMP/src.tar.gz" || die "download failed: $url"
    else
        wget -qO "$TMP/src.tar.gz" "$url" || die "download failed: $url"
    fi
    tar -xzf "$TMP/src.tar.gz" -C "$TMP"
    SRC=$(find "$TMP" -maxdepth 1 -mindepth 1 -type d | head -1)
    [ -d "$SRC/$UUID" ] || die "the downloaded archive has no $UUID directory."
fi

# --- the desklet itself -------------------------------------------------------
mkdir -p "$DESKLET_DIR"
cel="$DESKLET_DIR/$UUID"
if [ -L "$cel" ]; then
    # A symlink means a development checkout — overwriting it with a copy would
    # quietly detach the user's working tree from the installed desklet.
    info "$cel is a symlink (development setup) — leaving it alone."
else
    rm -rf "$cel"
    cp -r "$SRC/$UUID" "$cel"
    info "Desklet installed in $cel"
fi

# --- fonts --------------------------------------------------------------------
if compgen -G "$SRC/assets/fonts/*.ttf" >/dev/null; then
    mkdir -p "$FONT_DIR"
    cp "$SRC"/assets/fonts/*.ttf "$FONT_DIR/"
    if command -v fc-cache >/dev/null 2>&1; then
        fc-cache -f >/dev/null 2>&1 || true
    fi
    info "Fonts installed in $FONT_DIR"
else
    warn "No fonts in the sources — the desklet will fall back to a system font."
fi

# --- translations -------------------------------------------------------------
if command -v msgfmt >/dev/null 2>&1; then
    for po in "$SRC/$UUID"/po/*.po; do
        [ -e "$po" ] || continue
        lang=$(basename "$po" .po)
        mkdir -p "$LOCALE_DIR/$lang/LC_MESSAGES"
        msgfmt "$po" -o "$LOCALE_DIR/$lang/LC_MESSAGES/$UUID.mo"
        info "Translation installed: $lang"
    done
else
    warn "msgfmt not found (gettext) — the interface stays in English."
fi

cat <<'KONIEC'

Done. Two steps left, both on your side:

  1. Restart the Cinnamon shell so it picks up the desklet and the new fonts:
     press Alt+F2, type  r  and hit Enter.

  2. Add the desklet: System Settings -> Desklets -> OneLineNotes -> Add,
     or right-click the desktop and choose "Add OneLineNote".

To remove everything:
  rm -rf ~/.local/share/cinnamon/desklets/onelinenotes@jkatnik
  rm -f  ~/.local/share/nemo/actions/add-note.nemo_action
  rm -f  ~/.local/share/locale/*/LC_MESSAGES/onelinenotes@jkatnik.mo
Your notes stay in ~/.local/share/onelinenotes — delete that directory too if
you want them gone.
KONIEC
