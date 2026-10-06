import math
import re
from datetime import date, datetime

from openpyxl.utils.datetime import from_excel


def parse_excel_date(value, label="날짜"):
    """Accept calendar dates before attempting Excel serial-date conversion."""
    if value is None or str(value).strip() in ("", "-"):
        return None
    try:
        if isinstance(value, datetime):
            return value.date().isoformat()
        if isinstance(value, date):
            return value.isoformat()
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            if not math.isfinite(value):
                raise ValueError()
            text = str(int(value)) if value == int(value) else str(value)
        else:
            text = str(value).strip()
        if re.fullmatch(r"[0-9]{8}", text):
            return datetime.strptime(text, "%Y%m%d").date().isoformat()
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            if value < 1:
                raise ValueError()
            converted = from_excel(value)
            if not isinstance(converted, datetime):
                raise ValueError()
            return converted.date().isoformat()
        return date.fromisoformat(text).isoformat()
    except (ValueError, OverflowError, TypeError):
        raise ValueError(f"{label}: 유효한 날짜를 YYYYMMDD 또는 YYYY-MM-DD 형식으로 입력하세요. (입력값: {value})") from None
