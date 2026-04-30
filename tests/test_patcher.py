import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from scripts.patcher import apply_rules


class TestPatcher(unittest.TestCase):
    def test_apply_rules_rewrites_and_drops_and_appends(self) -> None:
        with TemporaryDirectory() as td:
            root = Path(td)
            unpacked = root / "unpacked"
            (unpacked / "assets/public/static/js").mkdir(parents=True)
            (unpacked / "assets/public/static/css").mkdir(parents=True)
            (unpacked / "assets/public/images").mkdir(parents=True)

            js = unpacked / "assets/public/static/js/main.js"
            js.write_text("function initAds(){return 1}; initAds()", encoding="utf-8")

            css = unpacked / "assets/public/static/css/main.css"
            css.write_text("body{}", encoding="utf-8")

            ad_img = unpacked / "assets/public/images/custom_ad.png"
            ad_img.write_bytes(b"123")

            ad_rules = root / "ad.json"
            ui_rules = root / "ui.json"
            ad_rules.write_text(
                json.dumps(
                    {
                        "file_globs": ["assets/public/static/js/*.js"],
                        "string_blocklist": ["ad"],
                        "regex_rewrites": [{"name": "x", "pattern": "initAds\\s*\\(", "replace": "noop("}],
                        "resource_drop_globs": ["assets/public/images/custom_ad.*"],
                    }
                ),
                encoding="utf-8",
            )
            ui_rules.write_text(json.dumps({"css_append": [{"glob": "assets/public/static/css/*.css", "append": "X"}]}), encoding="utf-8")

            report = apply_rules(unpacked, ad_rules, ui_rules)

            self.assertEqual(report.rewritten_files, 1)
            self.assertEqual(report.dropped_files, 1)
            self.assertEqual(report.appended_css_files, 1)
            self.assertIn("noop(", js.read_text(encoding="utf-8"))
            self.assertIn("X", css.read_text(encoding="utf-8"))
            self.assertFalse(ad_img.exists())
