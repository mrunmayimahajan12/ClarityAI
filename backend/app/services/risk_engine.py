"""Deterministic pattern scoring between ingestion and the LLM."""

from __future__ import annotations

import re
from dataclasses import dataclass

TIER_ORDER = {"low": 0, "medium": 1, "high": 2}


def max_tier(*levels: str) -> str:
    valid = [x for x in levels if x in TIER_ORDER]
    if not valid:
        return "low"
    return max(valid, key=lambda t: TIER_ORDER[t])


def _score_to_tier(score: int) -> str:
    if score <= 3:
        return "low"
    if score <= 8:
        return "medium"
    return "high"


SECTION_PATTERNS: list[tuple[re.Pattern[str], int, str, str]] = [
    (
        re.compile(r"\b(at\s+the\s+)?sole\s+discretion\b", re.I),
        3,
        "Broad discretion to one party.",
        "discretion",
    ),
    (
        re.compile(r"\bsubject\s+to\s+(approval|acceptance)\b", re.I),
        2,
        "Depends on approval or acceptance not fully specified here.",
        "hedge",
    ),
    (
        re.compile(r"\bmay\s+be\s+(granted|offered)\b", re.I),
        2,
        "Conditional or non-guaranteed benefit ('may be granted/offered').",
        "hedge",
    ),
    (
        re.compile(r"\beligible\s+for\b", re.I),
        2,
        "Eligibility language—terms may be non-guaranteed.",
        "hedge",
    ),
    (
        re.compile(r"\bas\s+determined\s+by\b", re.I),
        2,
        "Terms determined by one party.",
        "hedge",
    ),
    (
        re.compile(r"\bfrom\s+time\s+to\s+time\b", re.I),
        1,
        "Vague timing ('from time to time').",
        "hedge",
    ),
    (
        re.compile(
            r"\bany\s+other\b.*\b(deemed\s+necessary|required|appropriate)\b",
            re.I | re.S,
        ),
        4,
        "Open-ended obligation or process ('any other … necessary').",
        "open",
    ),
    (
        re.compile(r"\b(deemed\s+necessary|as\s+deemed\s+necessary)\b", re.I),
        4,
        "Open-ended standard ('deemed necessary').",
        "open",
    ),
    (
        re.compile(
            r"\b(responsibilities?|duties?|role)\b.*\b(may\s+evolve|may\s+change|subject\s+to\s+change)\b",
            re.I | re.S,
        ),
        3,
        "Role or duties may change (scope creep risk).",
        "role",
    ),
    (
        re.compile(
            r"\bmay\s+be\s+modified\b.*\bwithout\s+(notice|your\s+consent)\b",
            re.I | re.S,
        ),
        4,
        "Possible change without notice or consent.",
        "unilateral",
    ),
]

CAT_CAPS: dict[str, int] = {
    "discretion": 5,
    "hedge": 6,
    "open": 8,
    "role": 5,
    "unilateral": 5,
}


@dataclass(frozen=True)
class SectionScore:
    score: int
    tier: str
    factors: tuple[str, ...]


def score_section(text: str) -> SectionScore:
    if not (text or "").strip():
        return SectionScore(0, "low", ())
    cat_contrib: dict[str, int] = {k: 0 for k in CAT_CAPS}
    factors: list[str] = []
    seen: set[str] = set()
    for pat, weight, msg, cat in SECTION_PATTERNS:
        if not pat.search(text):
            continue
        cap = CAT_CAPS.get(cat, 99)
        room = cap - cat_contrib[cat]
        if room <= 0:
            if msg not in seen:
                factors.append(msg)
                seen.add(msg)
            continue
        take = min(weight, room)
        cat_contrib[cat] += take
        if msg not in seen:
            factors.append(msg)
            seen.add(msg)
    total = sum(cat_contrib.values())
    return SectionScore(total, _score_to_tier(total), tuple(factors))


def score_document_level(full_text: str, document_kind: str) -> tuple[list[str], str]:
    """Cross-clause heuristics over the full document."""
    if not (full_text or "").strip():
        return [], "low"
    low = full_text.lower()
    factors: list[str] = []
    tier = "low"

    def bump(new: str) -> None:
        nonlocal tier
        tier = max_tier(tier, new)

    if re.search(r"signing\s+bonus|relocation\s+bonus|retention\s+bonus", low):
        if not re.search(r"repay|repayment|claw\s*back|forfeit|forfeiture", low):
            factors.append(
                "Bonus mentioned without repayment, clawback, or forfeiture language in the full document."
            )
            bump("medium")

    if re.search(r"stock\s+option|equity|rsu|restricted\s+stock", low):
        vague = bool(
            re.search(r"may\s+be\s+granted|subject\s+to\s+approval|at\s+discretion", low)
        )
        has_detail = bool(
            re.search(r"vest|strike\s+price|exercise\s+price|number\s+of\s+shares", low)
        )
        if vague and not has_detail:
            factors.append(
                "Equity or options described in discretionary terms without clear vesting, strike, or quantity."
            )
            bump("medium")

    if re.search(r"performance\s+bonus|eligible\s+for\s+.*\bbonus\b", low):
        if not re.search(r"\d+\s*%|percent|metric|target|objective|kpi", low):
            factors.append(
                "Bonus or incentive referenced without clear percentage, metrics, or targets."
            )
            bump("medium")

    if re.search(r"background|drug\s+test|reference\s+check", low):
        if re.search(r"any\s+other\s+check|other\s+investigation|deemed\s+necessary", low):
            factors.append("Screening section includes open-ended additional checks.")
            bump("medium")

    if document_kind == "employment":
        if re.search(r"non[\s-]?compete|noncompetition|non-competition", low):
            factors.append("Non-compete or restrictive covenant language present—review scope and duration.")
            bump("medium")

    return factors, tier


def compute_overall_risk(section_tiers: list[str], document_tier: str) -> str:
    base = max_tier(document_tier, *section_tiers) if section_tiers else document_tier
    medium_ct = sum(1 for s in section_tiers if s == "medium")
    if medium_ct >= 2:
        base = max_tier(base, "medium")
    return base
