"""CRUD karteczek: plik JSON na notatkę + wpis w gsettings enabled-desklets."""
import ast
import json
import subprocess
import uuid
from datetime import datetime, timezone
from pathlib import Path

DESKLET_UUID = "karteczki@jkatnik"
DATA_DIR = Path.home() / ".local/share/karteczki"
DEFAULT_CONTENT = "Lorem ipsum"
DEFAULT_COLOR = "#112971"
DEFAULT_FONT = "Caveat 20"  # pełny opis Pango: rodzina + rozmiar
DEFAULT_BACKGROUND = "karteczka-bristol-4.png"  # plik z karteczki@jkatnik/img/
POSITION_STEP = 30
BASE_X = 100
BASE_Y = 100


def gsettings_get_desklets(run=subprocess.run):
    out = run(
        ["gsettings", "get", "org.cinnamon", "enabled-desklets"],
        capture_output=True, text=True, check=True,
    ).stdout.strip()
    if out == "@as []":
        return []
    return list(ast.literal_eval(out))


def gsettings_set_desklets(entries, run=subprocess.run):
    value = "[" + ", ".join(f"'{e}'" for e in entries) + "]" if entries else "[]"
    run(["gsettings", "set", "org.cinnamon", "enabled-desklets", value], check=True)


def _next_instance_id(entries):
    ids = [int(e.split(":")[1]) for e in entries if e.startswith(DESKLET_UUID + ":")]
    return max(ids, default=0) + 1


def _mapping_path(data_dir):
    return data_dir / "instances.json"


def _load_mapping(data_dir):
    p = _mapping_path(data_dir)
    return json.loads(p.read_text()) if p.exists() else {}


def _save_mapping(mapping, data_dir):
    _mapping_path(data_dir).write_text(json.dumps(mapping, indent=2, ensure_ascii=False))


def create_note(data_dir=DATA_DIR, run=subprocess.run, position=None):
    """position=(x, y) — lewy górny róg karteczki; None = kaskada od BASE_X/Y.

    Bez sprawdzania granic ekranu: karteczka rzucona tuż przy krawędzi
    wystaje poza nią i trzeba ją przeciągnąć.
    """
    data_dir.mkdir(parents=True, exist_ok=True)
    entries = gsettings_get_desklets(run)
    instance_id = _next_instance_id(entries)
    if position is not None:
        x, y = int(position[0]), int(position[1])
    else:
        offset = sum(1 for e in entries if e.startswith(DESKLET_UUID + ":"))
        x, y = BASE_X + POSITION_STEP * offset, BASE_Y + POSITION_STEP * offset

    note_uuid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).astimezone().isoformat()
    note = {
        "id": note_uuid,
        "content": DEFAULT_CONTENT,
        "color": DEFAULT_COLOR,
        "font": DEFAULT_FONT,
        "background": DEFAULT_BACKGROUND,
        "position": {"x": x, "y": y},
        "created_at": now,
        "modified_at": now,
    }
    (data_dir / f"{note_uuid}.json").write_text(
        json.dumps(note, indent=2, ensure_ascii=False)
    )

    entries.append(f"{DESKLET_UUID}:{instance_id}:{x}:{y}")
    gsettings_set_desklets(entries, run)

    mapping = _load_mapping(data_dir)
    mapping[str(instance_id)] = note_uuid
    _save_mapping(mapping, data_dir)

    return instance_id, note_uuid


def delete_note(instance_id, data_dir=DATA_DIR, run=subprocess.run):
    entries = gsettings_get_desklets(run)
    entries = [
        e for e in entries if not e.startswith(f"{DESKLET_UUID}:{instance_id}:")
    ]
    gsettings_set_desklets(entries, run)

    mapping = _load_mapping(data_dir)
    note_uuid = mapping.pop(str(instance_id), None)
    _save_mapping(mapping, data_dir)

    if note_uuid:
        (data_dir / f"{note_uuid}.json").unlink(missing_ok=True)
