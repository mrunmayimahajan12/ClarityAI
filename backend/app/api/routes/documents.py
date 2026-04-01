import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_db
from app.config import get_settings
from app.models.document import Document
from app.models.follow_up import FollowUpQuestion
from app.schemas.document import (
    DocumentCreatePaste,
    QuestionCreate,
    QuestionResponse,
    document_to_analysis_response,
)
from app.services import openai_analysis
from app.services.document_kinds import normalize_document_kind
from app.services.pipeline import (
    count_analyzed_sections,
    load_document_for_response,
    run_pipeline_job,
)

router = APIRouter()


def _json_response(model) -> JSONResponse:
    return JSONResponse(content=model.model_dump(mode="json", by_alias=True))


@router.post("")
async def create_document(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    settings = get_settings()
    max_bytes = settings.max_upload_mb * 1024 * 1024
    upload_root = Path(settings.upload_dir)
    upload_root.mkdir(parents=True, exist_ok=True)

    content_type = request.headers.get("content-type", "")

    if "application/json" in content_type:
        data = await request.json()
        body = DocumentCreatePaste.model_validate(data)
        if not body.text.strip():
            raise HTTPException(status_code=400, detail="Field 'text' is required")
        text_value = body.text.strip()
        if len(text_value.encode("utf-8")) > max_bytes:
            raise HTTPException(status_code=413, detail="Text too large")
        doc = Document(
            filename=body.title or "Pasted document",
            upload_type="paste",
            storage_path=None,
            raw_text=text_value,
            status="uploaded",
            document_kind=normalize_document_kind(body.document_type),
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)
        background_tasks.add_task(run_pipeline_job, doc.id)
        analyzed = count_analyzed_sections(db, doc.id)
        full = load_document_for_response(db, doc.id)
        assert full is not None
        return _json_response(document_to_analysis_response(full, analyzed))

    if "multipart/form-data" in content_type:
        form = await request.form()
        file_item = form.get("file")
        if file_item is None or not hasattr(file_item, "read"):
            raise HTTPException(
                status_code=400,
                detail="Multipart form must include a 'file' field (PDF)",
            )
        uf = file_item
        filename = uf.filename or "upload.pdf"
        if not filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Only PDF uploads are supported")
        raw = await uf.read()
        if len(raw) > max_bytes:
            raise HTTPException(status_code=413, detail="File too large")
        dt = form.get("documentType") or form.get("document_type")
        kind = normalize_document_kind(str(dt) if dt else None)
        doc = Document(
            filename=filename,
            upload_type="pdf",
            storage_path=None,
            raw_text=None,
            status="uploaded",
            document_kind=kind,
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)
        path = upload_root / f"{doc.id}.pdf"
        path.write_bytes(raw)
        doc.storage_path = str(path.resolve())
        db.commit()
        background_tasks.add_task(run_pipeline_job, doc.id)
        analyzed = count_analyzed_sections(db, doc.id)
        full = load_document_for_response(db, doc.id)
        assert full is not None
        return _json_response(document_to_analysis_response(full, analyzed))

    raise HTTPException(
        status_code=415,
        detail="Use Content-Type: application/json or multipart/form-data",
    )


@router.get("")
def list_documents(db: Session = Depends(get_db)):
    docs = (
        db.query(Document)
        .options(selectinload(Document.sections))
        .order_by(Document.created_at.desc())
        .limit(50)
        .all()
    )
    items: list[dict] = []
    for d in docs:
        summary = (d.summary or "").strip()
        if len(summary) > 160:
            summary = summary[:157] + "…"
        items.append(
            {
                "documentId": str(d.id),
                "documentTitle": d.filename or "Pasted document",
                "documentKind": (d.document_kind or "generic").lower(),
                "status": d.status,
                "overallRisk": (d.overall_risk or "low").lower() if d.overall_risk else None,
                "createdAt": d.created_at.isoformat() if d.created_at else "",
                "totalSections": len(d.sections),
                "summary": summary,
            }
        )
    return JSONResponse(content={"documents": items})


@router.get("/{document_id}")
def get_document(document_id: uuid.UUID, db: Session = Depends(get_db)):
    doc = load_document_for_response(db, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    analyzed = count_analyzed_sections(db, document_id)
    return _json_response(document_to_analysis_response(doc, analyzed))


@router.post("/{document_id}/questions")
def ask_question(
    document_id: uuid.UUID,
    payload: QuestionCreate,
    db: Session = Depends(get_db),
):
    doc = load_document_for_response(db, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.status != "completed":
        raise HTTPException(status_code=409, detail="Document analysis not completed yet")

    sections = sorted(doc.sections, key=lambda s: s.order_index)
    parts: list[str] = []
    for s in sections:
        parts.append(
            f"## {s.title} (risk: {s.risk_level})\n"
            f"Summary: {s.summary}\nWhy it matters: {s.why_it_matters}\n"
            f"Evidence: {s.evidence_snippet}\nExcerpt:\n{s.raw_text[:1200]}"
        )
    ctx = "\n\n".join(parts)
    summary = doc.summary or ""
    out = openai_analysis.answer_question(payload.question.strip(), summary, ctx)
    row = FollowUpQuestion(
        document_id=doc.id,
        question=payload.question.strip(),
        answer=out.answer,
        referenced_sections=out.referenced_section_titles,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _json_response(
        QuestionResponse(
            id=str(row.id),
            question=row.question,
            answer=row.answer,
            referenced_sections=list(row.referenced_sections or []),
        )
    )
