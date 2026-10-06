from datetime import date, datetime
from django.test import SimpleTestCase
from openpyxl.utils.datetime import to_excel
from .excel_dates import parse_excel_date
from .importers import fixed_legacy_preview
from .template_import import _convert


class ExcelDateTests(SimpleTestCase):
    def test_supported_dates(self):
        for value in (20260612, 20260612.0, "20260612", " 20260612 ", "2026-06-12", date(2026, 6, 12), datetime(2026, 6, 12), to_excel(datetime(2026, 6, 12))):
            with self.subTest(value=value):
                self.assertEqual(parse_excel_date(value), "2026-06-12")
                self.assertEqual(_convert("current_file_date", value), "2026-06-12")
                self.assertEqual(_convert("build_date", value), "2026-06-12")
                grid = [[None] * 15 for _ in range(32)]
                grid[4][14] = value
                self.assertEqual(fixed_legacy_preview("현행화", grid)["data"]["current_file_date"], "2026-06-12")

    def test_invalid_dates_are_clear_errors(self):
        for value in (20260230, 20261301, 999999999, float("nan"), float("inf"), -1):
            with self.subTest(value=value), self.assertRaisesRegex(ValueError, "YYYYMMDD"):
                parse_excel_date(value, "현행화 일자 (O5)")
        self.assertEqual(parse_excel_date(20240229), "2024-02-29")
        for value in (None, "", " - "):
            self.assertIsNone(parse_excel_date(value))
