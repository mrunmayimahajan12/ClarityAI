from __future__ import annotations

from pydantic import AliasChoices, BaseModel, ConfigDict, Field

from app.models.document import Document
from app.models.section import Section


class SectionResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    title: str
    risk: str
    summary: str
    why_it_matters: str = Field(serialization_alias="whyItMatters")
    evidence: str
    suggested_action: str = Field(serialization_alias="suggestedAction")
    raw_text: str = Field(default="", serialization_alias="rawText")
    risk_factors: list[str] = Field(default_factory=list, serialization_alias="riskFactors")


class DocumentProgress(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    status: str
    total_sections: int = Field(serialization_alias="totalSections")
    analyzed_sections: int = Field(serialization_alias="analyzedSections")
    error_message: str | None = Field(default=None, serialization_alias="errorMessage")


class AnalysisDataResponse(BaseModel):
    """Aligned with frontend AnalysisData (camelCase via serialization_alias)."""

    model_config = ConfigDict(populate_by_name=True)

    document_id: str = Field(serialization_alias="documentId")
    document_title: str = Field(serialization_alias="documentTitle")
    document_kind: str = Field(serialization_alias="documentKind")
    overall_risk: str = Field(serialization_alias="overallRisk")
    summary: str
    key_concerns: list[str] = Field(serialization_alias="keyConcerns")
    next_steps: list[str] = Field(serialization_alias="nextSteps")
    sections: list[SectionResponse]
    progress: DocumentProgress


class DocumentCreatePaste(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    text: str
    title: str | None = None
    document_type: str | None = Field(
        default=None,
        validation_alias=AliasChoices("document_type", "documentType"),
    )


class QuestionCreate(BaseModel):
    question: str


class QuestionResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    question: str
    answer: str
    referenced_sections: list[str] = Field(serialization_alias="referencedSections")


def section_to_response(s: Section) -> SectionResponse:
    raw = s.raw_text or ""
    if len(raw) > 8000:
        raw = raw[:8000] + "…"
    rf = s.risk_factors if isinstance(s.risk_factors, list) else []
    factors = [str(x) for x in rf if x]
    return SectionResponse(
        id=str(s.id),
        title=s.title,
        risk=(s.risk_level or "low").lower(),
        summary=s.summary or "",
        why_it_matters=s.why_it_matters or "",
        evidence=s.evidence_snippet or "",
        suggested_action=s.suggested_action or "",
        raw_text=raw,
        risk_factors=factors,
    )


def document_to_analysis_response(doc: Document, analyzed_count: int) -> AnalysisDataResponse:
    sections = sorted(doc.sections, key=lambda x: x.order_index)
    total = len(sections)
    progress = DocumentProgress(
        status=doc.status,
        total_sections=total,
        analyzed_sections=analyzed_count,
        error_message=doc.error_message,
    )
    title = doc.filename or "Pasted document"
    return AnalysisDataResponse(
        document_id=str(doc.id),
        document_title=title,
        document_kind=(doc.document_kind or "generic").lower(),
        overall_risk=(doc.overall_risk or "low").lower(),
        summary=doc.summary or "",
        key_concerns=list(doc.key_concerns or []),
        next_steps=list(doc.next_steps or []),
        sections=[section_to_response(s) for s in sections],
        progress=progress,
    )
