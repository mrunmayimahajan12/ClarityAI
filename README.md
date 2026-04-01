# ClarityAI

ClarityAI is an AI-powered document analysis tool that helps you understand complex legal and professional documents. Upload a PDF or paste text, select the document type, and get a structured breakdown of every clause with risk ratings, plain-English explanations, evidence quotes, and concrete next steps.

## What It Does

Most people sign contracts without fully understanding them. ClarityAI changes that by:

- **Segmenting** the document into meaningful sections automatically
- **Analyzing each clause** using a hybrid approach: deterministic rule-based scoring plus GPT-4o-mini with Chain-of-Thought reasoning
- **Rating risk** at the section level (low / medium / high) with evidence quoted directly from the text
- **Generating a document summary** with overall risk, key concerns, and actionable recommendations
- **Answering follow-up questions** about the document in context

## Supported Document Types

Each type has a tailored analysis rubric that guides the AI to focus on what matters most:

| Type | What It Flags |
|---|---|
| **Employment contract** | Equity vesting, bonus discretion, non-competes, at-will terms, clawbacks |
| **NDA** | One-sided obligations, indefinite duration, overbroad definitions, missing carve-outs |
| **Lease agreement** | Rent escalation caps, early termination fees, maintenance responsibilities, auto-renewal |
| **SaaS / Terms of Service** | Unilateral changes, data ownership, liability caps, indemnification, SLA terms |
| **Privacy policy** | Third-party data sharing, retention periods, deletion rights, cross-border transfers |
| **Generic** | Universal risk rubric for any other document type |

## Tech Stack

**Backend**
- [FastAPI](https://fastapi.tiangolo.com/) — REST API
- [PostgreSQL](https://www.postgresql.org/) — document and analysis storage
- [SQLAlchemy](https://www.sqlalchemy.org/) + [Alembic](https://alembic.sqlalchemy.org/) — ORM and migrations
- [OpenAI API](https://platform.openai.com/) (`gpt-4o-mini`) — LLM analysis with structured JSON output
- [pypdf](https://pypdf.readthedocs.io/) — PDF text extraction
- Docker + Docker Compose

**Frontend**
- [Next.js 16](https://nextjs.org/) + React 19
- [Tailwind CSS v4](https://tailwindcss.com/)
- TypeScript

## How the Analysis Pipeline Works

1. **Upload** — PDF is saved to disk; pasted text is stored directly
2. **Extraction** — PDF text is extracted and normalized
3. **Segmentation** — Document is split into logical sections using heading and numbered-list detection, with a 12K character cap per chunk
4. **Parallel analysis** — Up to 8 sections are analyzed concurrently via a `ThreadPoolExecutor`. For each section:
   - A deterministic rule engine runs pattern matching first — flagging specific risk keywords, missing material terms, discretionary language, and one-sided clauses — and assigns a baseline risk tier
   - The rule findings are injected into the LLM prompt so the model must acknowledge and build on them, not contradict them
   - GPT-4o-mini applies a **document-type rubric** specific to the selected document kind (employment, NDA, lease, etc.), guiding it to focus on the clause patterns that matter most for that contract type
   - Before assigning a risk level, the model produces a **Chain-of-Thought reasoning trace** — working through what each party is committed to, whether material terms are missing, and how the clause interacts with others. The risk label can only be assigned after this reasoning is written, preventing the model from jumping to conclusions
   - All output is constrained by a strict JSON schema enforced at generation time — the model cannot hallucinate fields, invent clauses, or return unexpected values
   - Evidence snippets are verified against the original text; if the quote doesn't exist verbatim, it is replaced with the closest fuzzy match or discarded entirely
   - The final risk level is the higher of the rule engine tier and the LLM tier — the rule engine acts as a floor the LLM cannot undercut
5. **Aggregation** — A final LLM call synthesizes the overall document summary, key concerns list, and next steps based on all section briefs, with the overall risk level fixed by the rule engine as a constraint the model must explain rather than decide
6. **Real-time progress** — The frontend polls every 2 seconds and shows per-section progress as results arrive

## Project Structure

```
ClarityAI/
├── backend/
│   ├── app/
│   │   ├── api/          # FastAPI routes (documents, health)
│   │   ├── db/           # SQLAlchemy session and base
│   │   ├── models/       # Document, Section, FollowUpQuestion ORM models
│   │   ├── schemas/      # Pydantic request/response schemas
│   │   ├── services/
│   │   │   ├── pipeline.py        # Orchestrates the full analysis job
│   │   │   ├── openai_analysis.py # LLM calls with structured output
│   │   │   ├── risk_engine.py     # Deterministic rule-based scoring
│   │   │   ├── segment.py         # Document segmentation
│   │   │   ├── pdf_extract.py     # PDF text extraction
│   │   │   └── document_kinds.py  # Per-type rubrics and risk guidelines
│   │   ├── config.py     # Pydantic settings (env-based)
│   │   └── main.py       # App entry point, CORS, lifespan
│   ├── alembic/          # Database migrations
│   ├── tests/
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── entrypoint.sh     # Runs migrations then starts uvicorn
│   └── requirements.txt
└── frontend/
    ├── app/
    │   ├── page.tsx           # Upload flow (document type → upload/paste)
    │   ├── processing/        # Real-time analysis progress page
    │   ├── analysis/          # Full results view with section breakdown
    │   └── history/           # Past documents
    ├── components/clarity/    # Navbar, risk badges, Q&A panel, sidebars
    └── lib/
        ├── api.ts             # Typed API client
        ├── document-types.ts  # Document type definitions
        └── analysis-data.ts   # TypeScript types for analysis responses
```

## Getting Started

### Prerequisites

- [Docker](https://www.docker.com/) and Docker Compose
- An [OpenAI API key](https://platform.openai.com/api-keys)
- Node.js 18+ (for the frontend)

### Backend

```bash
cd backend
cp .env.example .env
```

Edit `.env` and fill in:
- `OPENAI_API_KEY` — your OpenAI key
- `POSTGRES_PASSWORD` — choose a password
- `DATABASE_URL` — update to match your chosen password

```bash
docker compose up --build
```

The API will be available at `http://localhost:8000`.
Alembic migrations run automatically on startup.

### Frontend

```bash
cd frontend
cp .env.example .env
# NEXT_PUBLIC_API_URL defaults to http://127.0.0.1:8000 — change if deploying remotely
npm install
npm run dev
```

The app will be available at `http://localhost:3000`.

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENAI_API_KEY` | Yes | — | OpenAI API key |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `POSTGRES_USER` | Yes | — | Database user (used by Docker) |
| `POSTGRES_PASSWORD` | Yes | — | Database password (used by Docker) |
| `POSTGRES_DB` | Yes | — | Database name (used by Docker) |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | OpenAI model to use |
| `MAX_UPLOAD_MB` | No | `15` | Maximum PDF upload size in MB |
| `CORS_ORIGINS` | No | `http://localhost:3000` | Comma-separated allowed origins |
| `UPLOAD_DIR` | No | `./uploads` | Directory for uploaded PDFs |

### Frontend (`frontend/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | No | `http://127.0.0.1:8000` | Backend API base URL |

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/documents` | Upload PDF (`multipart/form-data`) or paste text (`application/json`) |
| `GET` | `/api/documents` | List all documents (with status and metadata) |
| `GET` | `/api/documents/{id}` | Get document with full analysis and real-time progress |
| `POST` | `/api/documents/{id}/questions` | Ask a follow-up question about the document |
| `GET` | `/health` | Health check (tests DB connectivity) |

## Running Tests

```bash
cd backend
pip install -r requirements.txt
pytest
```
