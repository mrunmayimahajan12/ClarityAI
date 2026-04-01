import re
from dataclasses import dataclass

MAX_CHUNK_CHARS = 12_000
MIN_SECTION_CHARS = 80  # sections shorter than this are boilerplate noise (signatures, date lines)


@dataclass
class SegmentDraft:
    title: str
    body: str
    order_index: int


def segment_text(raw: str) -> list[SegmentDraft]:
    text = raw.strip()
    if not text:
        return []

    blocks = _split_into_blocks(text)
    drafts: list[SegmentDraft] = []
    for i, block in enumerate(blocks):
        title, body = _title_and_body(block, i)
        if len(body.strip()) < MIN_SECTION_CHARS:
            continue  # skip signature blocks, date lines, and other boilerplate
        for j, chunk in enumerate(_chunk_body(body)):
            drafts.append(
                SegmentDraft(
                    title=title if j == 0 else f"{title} (continued {j + 1})",
                    body=chunk,
                    order_index=len(drafts),
                )
            )
    return drafts


def _split_into_blocks(text: str) -> list[str]:
    lines = text.split("\n")
    blocks: list[list[str]] = []
    current: list[str] = []

    heading_re = re.compile(r"^\s*(#+\s+.+|[A-Z][A-Za-z0-9 \-/&]{2,60}$)")
    numbered_re = re.compile(
        r"^\s*(\d+[\.\)]\s+|[ivx]+[\.\)]\s+|\([a-z]\)\s+|[a-z][\.\)]\s+)",
        re.IGNORECASE,
    )

    for line in lines:
        stripped = line.strip()
        if not stripped:
            if current:
                blocks.append(current)
                current = []
            continue
        is_break = bool(numbered_re.match(line)) or bool(heading_re.match(stripped))
        if is_break and current:
            blocks.append(current)
            current = [line]
        else:
            current.append(line)

    if current:
        blocks.append(current)

    parts = ["\n".join(b).strip() for b in blocks if any(x.strip() for x in b)]
    if not parts:
        parts = [text]
    return [p for p in parts if p]


def _title_and_body(block: str, index: int) -> tuple[str, str]:
    lines = block.split("\n")
    first = lines[0].strip()
    if len(lines) == 1:
        return (f"Section {index + 1}", first)
    if len(first) <= 80 and not _looks_like_sentence(first):
        return (first, "\n".join(lines[1:]).strip())
    return (f"Section {index + 1}", block)


def _looks_like_sentence(s: str) -> bool:
    return s.endswith(".") and len(s) > 100


def _chunk_body(body: str) -> list[str]:
    body = body.strip()
    if len(body) <= MAX_CHUNK_CHARS:
        return [body]
    chunks: list[str] = []
    start = 0
    while start < len(body):
        end = min(start + MAX_CHUNK_CHARS, len(body))
        if end < len(body):
            cut = body.rfind("\n\n", start, end)
            if cut == -1 or cut < start + MAX_CHUNK_CHARS // 2:
                cut = body.rfind(" ", start, end)
            if cut > start:
                end = cut
        chunks.append(body[start:end].strip())
        start = end
    return [c for c in chunks if c]
