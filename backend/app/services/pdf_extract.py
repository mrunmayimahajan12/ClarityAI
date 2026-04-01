from pathlib import Path

from pypdf import PdfReader


def extract_text_from_pdf(path: str | Path) -> str:
    p = Path(path)
    reader = PdfReader(str(p))
    parts: list[str] = []
    for page in reader.pages:
        t = page.extract_text()
        if t:
            parts.append(t)
    text = "\n\n".join(parts)
    return _normalize_whitespace(text)


def _normalize_whitespace(text: str) -> str:
    lines = [ln.strip() for ln in text.splitlines()]
    return "\n".join(lines).strip()
