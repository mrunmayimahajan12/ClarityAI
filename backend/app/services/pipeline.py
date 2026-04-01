import logging
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy.orm import Session, selectinload

from app.db.session import SessionLocal
from app.models.document import Document
from app.models.section import Section
from app.services import openai_analysis
from app.services.document_kinds import build_rubric
from app.services.pdf_extract import extract_text_from_pdf
from app.services.risk_engine import compute_overall_risk, max_tier, score_document_level, score_section
from app.services.segment import segment_text

logger = logging.getLogger(__name__)


def run_pipeline_job(document_id: uuid.UUID) -> None:
    db = SessionLocal()
    try:
        process_document(db, document_id)
    finally:
        db.close()


def process_document(db: Session, document_id: uuid.UUID) -> None:
    doc = db.get(Document, document_id)
    if not doc:
        logger.warning("process_document: missing document %s", document_id)
        return

    t_total = time.time()

    try:
        if doc.upload_type == "pdf":
            doc.status = "extracting_text"
            db.commit()
            if not doc.storage_path:
                raise ValueError("PDF upload missing storage_path")
            path = Path(doc.storage_path)
            if not path.is_file():
                raise FileNotFoundError(str(path))
            t = time.time()
            raw = extract_text_from_pdf(path)
            logger.info("[timing] pdf_extract: %.2fs", time.time() - t)
            if not raw.strip():
                raise ValueError(
                    "No extractable text in PDF (scanned pages need OCR, not supported in MVP)."
                )
            doc.raw_text = raw
            doc.status = "text_extracted"
            db.commit()
        else:
            if not (doc.raw_text or "").strip():
                raise ValueError("Pasted document has no text")
            doc.status = "text_extracted"
            db.commit()

        doc.status = "segmenting"
        db.commit()

        db.query(Section).filter(Section.document_id == doc.id).delete(synchronize_session=False)
        t = time.time()
        drafts = segment_text(doc.raw_text or "")
        logger.info("[timing] segmentation: %.2fs  →  %d sections", time.time() - t, len(drafts))
        if not drafts:
            raise ValueError("Segmentation produced no sections")

        for d in drafts:
            db.add(
                Section(
                    document_id=doc.id,
                    order_index=d.order_index,
                    title=d.title[:512],
                    raw_text=d.body,
                )
            )
        doc.status = "segmented"
        db.commit()

        sections = (
            db.query(Section)
            .filter(Section.document_id == doc.id)
            .order_by(Section.order_index)
            .all()
        )

        doc.status = "analyzing_sections"
        db.commit()

        kind = doc.document_kind or "generic"
        rubric = build_rubric(kind)
        full_text = doc.raw_text or ""

        t = time.time()
        doc_factors, doc_tier = score_document_level(full_text, kind)
        logger.info("[timing] score_document_level: %.2fs", time.time() - t)

        # --- parallel section analysis -----------------------------------------
        # LLM calls are pure I/O — run up to 8 at a time.
        # IMPORTANT: SQLAlchemy ORM objects must never cross thread boundaries.
        # Extract plain strings before threading; all DB writes stay in the
        # main thread via as_completed.
        # -----------------------------------------------------------------------

        @dataclass
        class _SectionResult:
            index: int
            llm_out: openai_analysis.SectionLLMOut
            verified_evidence: str | None
            final_risk: str
            merged_factors: list[str]

        # Snapshot plain strings from ORM objects before any threading
        section_inputs = [
            (i, sec.title, sec.raw_text or "")
            for i, sec in enumerate(sections)
        ]

        def _analyze_one(idx: int, title: str, raw_text: str) -> _SectionResult:
            t_sec = time.time()
            rule = score_section(raw_text)
            llm_out = openai_analysis.analyze_section(
                title,
                raw_text,
                document_kind=kind,
                rule_tier=rule.tier,
                rule_factors=list(rule.factors),
                rubric_text=rubric,
            )
            verified_evidence = openai_analysis.find_best_evidence(
                llm_out.evidence_snippet, raw_text
            )
            final_risk = max_tier(rule.tier, llm_out.risk_level)
            rule_factor_set = {f.lower() for f in rule.factors}
            merged_factors = list(rule.factors) + [
                f for f in (llm_out.risk_factors or [])
                if f.lower() not in rule_factor_set
            ]
            logger.info(
                "[timing] section %d/%d (%s): %.2fs",
                idx + 1,
                len(section_inputs),
                title[:40],
                time.time() - t_sec,
            )
            return _SectionResult(
                index=idx,
                llm_out=llm_out,
                verified_evidence=verified_evidence,
                final_risk=final_risk,
                merged_factors=merged_factors,
            )

        t_sections = time.time()
        results: list[_SectionResult] = [None] * len(sections)  # type: ignore[list-item]
        with ThreadPoolExecutor(max_workers=8) as pool:
            futures = {
                pool.submit(_analyze_one, idx, title, raw_text): idx
                for idx, title, raw_text in section_inputs
            }
            for future in as_completed(futures):
                res = future.result()  # re-raises any exception from the thread
                results[res.index] = res
                # Write to DB as each result arrives so the frontend polling
                # sees the analyzed-section count increment in real time.
                sec = sections[res.index]
                sec.summary = res.llm_out.summary
                sec.risk_level = res.final_risk
                sec.why_it_matters = res.llm_out.why_it_matters
                sec.evidence_snippet = res.verified_evidence
                sec.suggested_action = res.llm_out.suggested_action
                sec.category = res.llm_out.category
                sec.risk_factors = res.merged_factors if res.merged_factors else None
                db.commit()

        logger.info(
            "[timing] all sections total: %.2fs  (avg %.2fs each)",
            time.time() - t_sections,
            (time.time() - t_sections) / max(len(sections), 1),
        )

        # Build briefs in section order for the aggregate call
        briefs: list[dict[str, str]] = []
        section_tiers: list[str] = []
        for res in results:
            section_tiers.append(res.final_risk)
            briefs.append(
                {
                    "title": sections[res.index].title,
                    "risk": res.final_risk,
                    "category": res.llm_out.category or "",
                    "summary": res.llm_out.summary or "",
                    "why": res.llm_out.why_it_matters or "",
                    "rule_factors": "; ".join(res.merged_factors) if res.merged_factors else "",
                }
            )

        doc.status = "aggregating"
        db.commit()

        overall = compute_overall_risk(section_tiers, doc_tier)

        t = time.time()
        agg = openai_analysis.aggregate_document(
            briefs,
            fixed_overall_risk=overall,
            document_kind=kind,
            document_level_factors=doc_factors,
        )
        logger.info("[timing] aggregate_document: %.2fs", time.time() - t)
        doc.summary = agg.summary
        doc.overall_risk = agg.overall_risk
        concerns = list(agg.key_concerns or [])
        for f in doc_factors:
            if f and f not in concerns:
                concerns.insert(0, f)
        doc.key_concerns = concerns[:12]
        doc.next_steps = agg.next_steps
        doc.status = "completed"
        doc.error_message = None
        db.commit()
        logger.info("[timing] total pipeline: %.2fs", time.time() - t_total)
    except Exception as e:
        logger.exception("Pipeline error for document %s", document_id)
        doc = db.get(Document, document_id)
        if doc:
            doc.status = "failed"
            doc.error_message = str(e)[:2000]
            db.commit()


def count_analyzed_sections(db: Session, document_id: uuid.UUID) -> int:
    return (
        db.query(Section)
        .filter(Section.document_id == document_id, Section.summary.isnot(None))
        .count()
    )


def load_document_for_response(db: Session, document_id: uuid.UUID) -> Document | None:
    return (
        db.query(Document)
        .options(selectinload(Document.sections))
        .filter(Document.id == document_id)
        .first()
    )
