import difflib
import json
import re
from typing import Any

from openai import OpenAI
from pydantic import BaseModel, Field, field_validator

from app.config import get_settings


class SectionLLMOut(BaseModel):
    reasoning: str = ""  # internal CoT — not stored or shown to users
    summary: str
    risk_level: str = Field(description="low, medium, or high")
    why_it_matters: str
    evidence_snippet: str
    suggested_action: str
    category: str
    risk_factors: list[str] = Field(default_factory=list)

    @field_validator("risk_level")
    @classmethod
    def normalize_risk(cls, v: str) -> str:
        x = (v or "").strip().lower()
        if x in ("low", "medium", "high"):
            return x
        return "medium"


class AggregateProseLLMOut(BaseModel):
    summary: str
    key_concerns: list[str]
    next_steps: list[str]


class AggregateLLMOut(BaseModel):
    summary: str
    overall_risk: str
    key_concerns: list[str]
    next_steps: list[str]

    @field_validator("overall_risk")
    @classmethod
    def normalize_risk(cls, v: str) -> str:
        x = (v or "").strip().lower()
        if x in ("low", "medium", "high"):
            return x
        return "medium"


class AnswerLLMOut(BaseModel):
    answer: str
    referenced_section_titles: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Strict JSON schemas — enforced by OpenAI at generation time.
# The model cannot return unexpected fields or invalid enum values.
# ---------------------------------------------------------------------------

_SECTION_SCHEMA: dict[str, Any] = {
    "type": "object",
    # reasoning is listed FIRST so the model generates it before risk_level.
    # This is the Chain-of-Thought mechanism — the model must reason through
    # the clause before it can commit to a risk label.
    "properties": {
        "reasoning": {"type": "string"},
        "summary": {"type": "string"},
        "risk_level": {"type": "string", "enum": ["low", "medium", "high"]},
        "why_it_matters": {"type": "string"},
        "evidence_snippet": {"type": "string"},
        "suggested_action": {"type": "string"},
        "category": {"type": "string"},
        "risk_factors": {"type": "array", "items": {"type": "string"}},
    },
    "required": [
        "reasoning",
        "summary",
        "risk_level",
        "why_it_matters",
        "evidence_snippet",
        "suggested_action",
        "category",
        "risk_factors",
    ],
    "additionalProperties": False,
}

_AGGREGATE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "summary": {"type": "string"},
        "key_concerns": {"type": "array", "items": {"type": "string"}},
        "next_steps": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["summary", "key_concerns", "next_steps"],
    "additionalProperties": False,
}

_ANSWER_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "answer": {"type": "string"},
        "referenced_section_titles": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["answer", "referenced_section_titles"],
    "additionalProperties": False,
}


_openai_client: OpenAI | None = None


def _client() -> OpenAI:
    global _openai_client
    if _openai_client is None:
        _openai_client = OpenAI(api_key=get_settings().openai_api_key)
    return _openai_client


def _complete_json(
    system: str,
    user: str,
    *,
    schema_name: str,
    schema: dict[str, Any],
) -> dict[str, Any]:
    s = get_settings()
    client = _client()
    resp = client.chat.completions.create(
        model=s.openai_model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        response_format={
            "type": "json_schema",
            "json_schema": {
                "name": schema_name,
                "strict": True,
                "schema": schema,
            },
        },
        temperature=0,
    )
    content = resp.choices[0].message.content or "{}"
    return json.loads(content)


def find_best_evidence(candidate: str, raw_text: str) -> str | None:
    """
    Return a verified evidence string that is grounded in raw_text.

    1. Exact (case-insensitive) substring match → return candidate as-is.
    2. Fuzzy match against sentences in raw_text → return best match if
       similarity ratio >= 0.5.
    3. No good match → return None (caller should store null, not a fake quote).
    """
    candidate = (candidate or "").strip()
    if not candidate or len(candidate) < 3:
        return None

    # Exact match
    if candidate in raw_text or candidate.lower() in raw_text.lower():
        return candidate

    # Split into sentences and find closest match
    sentences = [
        s.strip()
        for s in re.split(r"(?<=[.!?])\s+|\n+", raw_text)
        if len(s.strip()) > 20
    ]
    if not sentences:
        return None

    best_ratio = 0.0
    best_sentence: str | None = None
    for sent in sentences:
        ratio = difflib.SequenceMatcher(None, candidate.lower(), sent.lower()).ratio()
        if ratio > best_ratio:
            best_ratio = ratio
            best_sentence = sent

    if best_ratio >= 0.5 and best_sentence:
        return best_sentence[:500]

    return None


def evidence_in_text(evidence: str, raw_text: str) -> bool:
    ev = (evidence or "").strip()
    if len(ev) < 3:
        return False
    return ev in raw_text or ev.lower() in raw_text.lower()


def analyze_section(
    title: str,
    raw_text: str,
    *,
    document_kind: str,
    rule_tier: str,
    rule_factors: list[str],
    rubric_text: str,
) -> SectionLLMOut:
    factors_block = (
        "Rule-based findings (deterministic; do not contradict—explain in your own words):\n"
        + (f"- Tier from rules: {rule_tier}\n")
        + (
            "\n".join(f"- {f}" for f in rule_factors)
            if rule_factors
            else "- (No rule factors in this section.)"
        )
    )
    system = (
        f"{rubric_text}\n\n"
        "You are a careful document analyst. Output a JSON object with these keys in order:\n"
        "1. reasoning: Think through the clause before labeling it. Work through: "
        "(a) What does this clause actually commit each party to? "
        "(b) Are material terms missing — amounts, timelines, metrics, approval criteria? "
        "(c) Is this standard boilerplate or genuinely one-sided/ambiguous? "
        "(d) Does this clause interact with others — e.g. a bonus with no clawback, "
        "equity with no vesting details, termination with no notice period? "
        "Be specific. This reasoning drives the risk_level you assign next.\n"
        "2. summary: One-sentence plain-English summary of what this section says.\n"
        "3. risk_level: low, medium, or high — based on your reasoning above.\n"
        "4. why_it_matters: Why this risk level matters to the reader.\n"
        "5. evidence_snippet: A short verbatim quote from the section text that supports "
        "your assessment. Copy it exactly — do not paraphrase or invent.\n"
        "6. suggested_action: One concrete thing the reader should do or ask about.\n"
        "7. category: Short label for the clause type (e.g. compensation, termination).\n"
        "8. risk_factors: Array of short strings, one per distinct risk pattern found. "
        "Empty array if none.\n\n"
        "Do not invent clauses. If language is ambiguous, discretionary, or missing "
        "material terms, use medium or high when the rubric supports it.\n\n"
        f"{factors_block}"
    )
    user = (
        f"Document type (user-selected): {document_kind}\n"
        f"Section title: {title}\n\nSection text:\n{raw_text}"
    )
    data = _complete_json(system, user, schema_name="section_analysis", schema=_SECTION_SCHEMA)
    return SectionLLMOut.model_validate(data)


def aggregate_document(
    section_briefs: list[dict[str, str]],
    *,
    fixed_overall_risk: str,
    document_kind: str,
    document_level_factors: list[str],
) -> AggregateLLMOut:
    fr = (fixed_overall_risk or "low").strip().lower()
    if fr not in ("low", "medium", "high"):
        fr = "medium"
    doc_factors = (
        "\n".join(f"- {f}" for f in document_level_factors)
        if document_level_factors
        else "- (None.)"
    )
    system = (
        "You write the document-level narrative for an analysis product. "
        "Output JSON with keys: summary (string), key_concerns (array of strings), "
        "next_steps (array of actionable strings). "
        f"The overall risk level has ALREADY been determined as: {fr}. "
        "Do not contradict that level; explain it. "
        "Incorporate document-level rule factors where relevant. "
        "Be concise and practical. Do not claim legal certainty.\n\n"
        f"Document type: {document_kind}\n"
        f"Document-level rule factors:\n{doc_factors}"
    )
    lines = []
    for i, b in enumerate(section_briefs, start=1):
        lines.append(
            f"{i}. [{b.get('title', '')}] risk={b.get('risk', '')} category={b.get('category', '')}\n"
            f"   summary: {b.get('summary', '')}\n"
            f"   why: {b.get('why', '')}\n"
            f"   rule_factors: {b.get('rule_factors', '')}"
        )
    user = "Sections:\n" + "\n".join(lines)
    data = _complete_json(system, user, schema_name="aggregate_analysis", schema=_AGGREGATE_SCHEMA)
    prose = AggregateProseLLMOut.model_validate(data)
    return AggregateLLMOut(
        summary=prose.summary,
        overall_risk=fr,
        key_concerns=prose.key_concerns,
        next_steps=prose.next_steps,
    )


def answer_question(
    question: str,
    document_summary: str,
    sections_context: str,
) -> AnswerLLMOut:
    system = (
        "You answer questions about a document using only the provided context. "
        "Output JSON with keys: answer (string), referenced_section_titles (array of strings). "
        "If the context is insufficient, say so. No legal advice disclaimer tone is ok in one short line."
    )
    user = (
        f"Document summary:\n{document_summary}\n\n"
        f"Section analyses and excerpts:\n{sections_context}\n\n"
        f"Question: {question}"
    )
    data = _complete_json(system, user, schema_name="question_answer", schema=_ANSWER_SCHEMA)
    return AnswerLLMOut.model_validate(data)
