import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "karteczki@jkatnik" / "bin"))
from karteczki_common import create_note, delete_note, DESKLET_UUID


class FakeGsettings:
    """Symuluje `gsettings get/set org.cinnamon enabled-desklets` w pamięci."""

    def __init__(self, initial=None):
        self.entries = list(initial or [])

    def __call__(self, cmd, capture_output=False, text=False, check=False):
        if cmd[:3] == ["gsettings", "get", "org.cinnamon"]:
            value = (
                "@as []"
                if not self.entries
                else "[" + ", ".join(f"'{e}'" for e in self.entries) + "]"
            )
            return subprocess.CompletedProcess(cmd, 0, stdout=value)
        if cmd[:3] == ["gsettings", "set", "org.cinnamon"]:
            raw = cmd[-1]
            self.entries = (
                [] if raw == "[]" else [e.strip(" '") for e in raw[1:-1].split(",")]
            )
            return subprocess.CompletedProcess(cmd, 0)
        raise ValueError(f"nieoczekiwane wywołanie: {cmd}")


class KarteczkiCommonTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.data_dir = Path(self.tmp.name)
        self.gsettings = FakeGsettings()

    def tearDown(self):
        self.tmp.cleanup()

    def test_create_note_pisze_plik_json_i_wpis_gsettings(self):
        instance_id, note_uuid = create_note(self.data_dir, run=self.gsettings)

        self.assertEqual(instance_id, 1)
        note_path = self.data_dir / f"{note_uuid}.json"
        self.assertTrue(note_path.exists())
        note = json.loads(note_path.read_text())
        self.assertEqual(note["id"], note_uuid)
        self.assertEqual(note["content"], "Lorem ipsum")
        self.assertEqual(note["color"], "#112971")
        self.assertEqual(len(self.gsettings.entries), 1)
        self.assertTrue(self.gsettings.entries[0].startswith(f"{DESKLET_UUID}:1:"))

    def test_create_note_losuje_kat_w_zakresie(self):
        katy = set()
        for _ in range(20):
            _, note_uuid = create_note(self.data_dir, run=self.gsettings)
            kat = json.loads((self.data_dir / f"{note_uuid}.json").read_text())["rotation"]
            self.assertGreaterEqual(kat, -3)
            self.assertLessEqual(kat, 3)
            katy.add(kat)
        self.assertGreater(len(katy), 1, "kąt ma być losowy, nie stały")

    def test_create_note_uzywa_podanej_pozycji(self):
        _, note_uuid = create_note(self.data_dir, run=self.gsettings, position=(1234, 567))

        self.assertEqual(self.gsettings.entries[0], f"{DESKLET_UUID}:1:1234:567")
        note = json.loads((self.data_dir / f"{note_uuid}.json").read_text())
        self.assertEqual(note["position"], {"x": 1234, "y": 567})

    def test_create_note_bez_pozycji_kaskaduje(self):
        create_note(self.data_dir, run=self.gsettings)
        create_note(self.data_dir, run=self.gsettings)

        self.assertEqual(self.gsettings.entries[0], f"{DESKLET_UUID}:1:100:100")
        self.assertEqual(self.gsettings.entries[1], f"{DESKLET_UUID}:2:130:130")

    def test_create_note_zwieksza_instance_id(self):
        create_note(self.data_dir, run=self.gsettings)
        instance_id, _ = create_note(self.data_dir, run=self.gsettings)

        self.assertEqual(instance_id, 2)
        self.assertEqual(len(self.gsettings.entries), 2)

    def test_create_note_pomija_instancje_innych_desletow_przy_numeracji(self):
        self.gsettings.entries = ["clock@cinnamon.org:5:0:0"]

        instance_id, _ = create_note(self.data_dir, run=self.gsettings)

        self.assertEqual(instance_id, 1)

    def test_delete_note_kasuje_plik_i_wpis(self):
        instance_id, note_uuid = create_note(self.data_dir, run=self.gsettings)

        delete_note(instance_id, self.data_dir, run=self.gsettings)

        self.assertFalse((self.data_dir / f"{note_uuid}.json").exists())
        self.assertEqual(self.gsettings.entries, [])

    def test_delete_note_zachowuje_inne_wpisy(self):
        id1, uuid1 = create_note(self.data_dir, run=self.gsettings)
        id2, uuid2 = create_note(self.data_dir, run=self.gsettings)

        delete_note(id1, self.data_dir, run=self.gsettings)

        self.assertFalse((self.data_dir / f"{uuid1}.json").exists())
        self.assertTrue((self.data_dir / f"{uuid2}.json").exists())
        self.assertEqual(len(self.gsettings.entries), 1)
        self.assertTrue(self.gsettings.entries[0].startswith(f"{DESKLET_UUID}:{id2}:"))

    def test_delete_note_nieistniejacej_instancji_nie_wybucha(self):
        delete_note(999, self.data_dir, run=self.gsettings)


if __name__ == "__main__":
    unittest.main()
