import type { AnalysisData, Risk, Section } from "@/lib/analysis-data";

const DEFAULT_API = "http://127.0.0.1:8000";

export function getApiBaseUrl(): string {
  const u = process.env.NEXT_PUBLIC_API_URL?.trim();
  return u && u.length > 0 ? u.replace(/\/$/, "") : DEFAULT_API;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function formatDetail(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((x: { msg?: string; loc?: unknown }) => x?.msg || JSON.stringify(x))
      .join("; ");
  }
  if (detail && typeof detail === "object" && "message" in detail) {
    return String((detail as { message: string }).message);
  }
  return "Request failed";
}

async function parseJsonResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new ApiError(text || res.statusText || "Invalid JSON", res.status);
  }
  if (!res.ok) {
    const d = data as { detail?: unknown };
    throw new ApiError(formatDetail(d?.detail ?? res.statusText), res.status);
  }
  return data as T;
}

export interface DocumentProgressDto {
  status: string;
  totalSections: number;
  analyzedSections: number;
  errorMessage?: string | null;
}

export interface DocumentApiPayload {
  documentId: string;
  documentTitle: string;
  documentKind: string;
  overallRisk: string;
  summary: string;
  keyConcerns: string[];
  nextSteps: string[];
  sections: Array<{
    id: string;
    title: string;
    risk: string;
    summary: string;
    whyItMatters: string;
    evidence: string;
    suggestedAction: string;
    rawText?: string;
    riskFactors?: string[];
  }>;
  progress: DocumentProgressDto;
}

export function toAnalysisData(payload: DocumentApiPayload): AnalysisData {
  const risk = (r: string): Risk => {
    const x = r.toLowerCase();
    if (x === "high" || x === "medium" || x === "low") return x;
    return "low";
  };

  const sections: Section[] = payload.sections.map((s) => ({
    id: s.id,
    title: s.title,
    risk: risk(s.risk),
    summary: s.summary,
    whyItMatters: s.whyItMatters,
    evidence: s.evidence,
    suggestedAction: s.suggestedAction,
    rawText: s.rawText,
    riskFactors: Array.isArray(s.riskFactors) ? s.riskFactors : [],
  }));

  return {
    documentTitle: payload.documentTitle,
    documentKind: (payload.documentKind || "generic").toLowerCase(),
    overallRisk: risk(payload.overallRisk),
    summary: payload.summary,
    keyConcerns: payload.keyConcerns,
    nextSteps: payload.nextSteps,
    sections,
  };
}

export async function createDocumentFromText(
  text: string,
  title?: string | null,
  documentType?: string | null
): Promise<DocumentApiPayload> {
  const res = await fetch(`${getApiBaseUrl()}/api/documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      title: title || undefined,
      documentType: documentType || undefined,
    }),
  });
  return parseJsonResponse<DocumentApiPayload>(res);
}

export async function createDocumentFromFile(
  file: File,
  documentType?: string | null
): Promise<DocumentApiPayload> {
  const fd = new FormData();
  fd.append("file", file);
  if (documentType) {
    fd.append("documentType", documentType);
  }
  const res = await fetch(`${getApiBaseUrl()}/api/documents`, {
    method: "POST",
    body: fd,
  });
  return parseJsonResponse<DocumentApiPayload>(res);
}

export async function fetchDocument(documentId: string): Promise<DocumentApiPayload> {
  const res = await fetch(`${getApiBaseUrl()}/api/documents/${documentId}`, {
    method: "GET",
    cache: "no-store",
  });
  return parseJsonResponse<DocumentApiPayload>(res);
}

export interface QuestionApiResponse {
  id: string;
  question: string;
  answer: string;
  referencedSections: string[];
}

export async function askDocumentQuestion(
  documentId: string,
  question: string
): Promise<QuestionApiResponse> {
  const res = await fetch(`${getApiBaseUrl()}/api/documents/${documentId}/questions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  return parseJsonResponse<QuestionApiResponse>(res);
}

export interface HistoryDocumentDto {
  documentId: string;
  documentTitle: string;
  documentKind?: string;
  status: string;
  overallRisk: string | null;
  createdAt: string;
  totalSections: number;
  summary: string;
}

export async function fetchDocumentHistory(): Promise<HistoryDocumentDto[]> {
  const res = await fetch(`${getApiBaseUrl()}/api/documents`, { cache: "no-store" });
  const data = await parseJsonResponse<{ documents: HistoryDocumentDto[] }>(res);
  return data.documents;
}
