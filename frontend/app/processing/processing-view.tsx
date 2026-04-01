"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/clarity/navbar";
import { CheckCircle2, Circle, Loader2, FileText, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiError, fetchDocument, type DocumentApiPayload } from "@/lib/api";

const STEPS = [
  { id: 1, label: "Extracting text" },
  { id: 2, label: "Segmenting sections" },
  { id: 3, label: "Analyzing clauses" },
  { id: 4, label: "Generating summary" },
];

function stepState(status: string): { doneThrough: number; active: number | null } {
  const s = status;
  const step1Done = !["uploaded", "extracting_text"].includes(s);
  const step2Done = ["segmented", "analyzing_sections", "aggregating", "completed"].includes(s);
  const step3Done = ["aggregating", "completed"].includes(s);
  const step4Done = s === "completed";

  let active: number | null = null;
  if (!step1Done) active = 1;
  else if (!step2Done) active = 2;
  else if (!step3Done) active = 3;
  else if (!step4Done) active = 4;

  let doneThrough = 0;
  if (step1Done) doneThrough = 1;
  if (step2Done) doneThrough = 2;
  if (step3Done) doneThrough = 3;
  if (step4Done) doneThrough = 4;

  return { doneThrough, active };
}

function ProcessingMissingId() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-lg mx-auto px-6 pt-20 pb-24 text-center">
        <p className="text-sm text-muted-foreground mb-4">No document to process. Start from the home page.</p>
        <Link href="/" className="text-sm font-medium text-primary hover:underline">
          Back to upload
        </Link>
      </main>
    </div>
  );
}

function ProcessingContent({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [payload, setPayload] = useState<DocumentApiPayload | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const data = await fetchDocument(documentId);
        if (cancelled) return;
        setPayload(data);
        setFetchError(null);
        if (data.progress.status === "completed") {
          router.replace(`/analysis?documentId=${encodeURIComponent(documentId)}`);
          return;
        }
        if (data.progress.status === "failed") {
          return;
        }
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof ApiError ? e.message : "Could not load document status.";
        setFetchError(msg);
      }
    };

    void poll();
    const t = window.setInterval(() => void poll(), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [documentId, router]);

  const { uiSteps } = useMemo(() => {
    const status = payload?.progress.status ?? "uploaded";
    const { doneThrough, active } = stepState(status);
    const uiSteps = STEPS.map((step, index) => {
      const n = index + 1;
      let state: "pending" | "active" | "done" = "pending";
      if (n <= doneThrough) state = "done";
      if (active === n) state = "active";
      return { ...step, state };
    });
    return { uiSteps };
  }, [payload?.progress.status]);

  const progress = payload?.progress;
  const totalSections = Math.max(progress?.totalSections ?? 0, 1);
  const analyzedSections = progress?.analyzedSections ?? 0;
  const pct =
    progress?.status === "completed"
      ? 100
      : Math.min(100, Math.round((analyzedSections / totalSections) * 100));

  const title = payload?.documentTitle ?? "Document";
  const failed = progress?.status === "failed";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-lg mx-auto px-6 pt-20 pb-24">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-secondary border border-border flex items-center justify-center shrink-0">
              <FileText className="w-4.5 h-4.5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{title}</p>
              <p className="text-xs text-muted-foreground">
                {failed ? "Processing stopped" : "Analysis in progress"}
              </p>
            </div>
          </div>
          <span
            className={cn(
              "flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full shrink-0",
              failed ? "text-destructive bg-destructive/10" : "text-primary bg-accent"
            )}
          >
            {failed ? <AlertCircle className="w-3 h-3" /> : <Loader2 className="w-3 h-3 animate-spin" />}
            {failed ? "Failed" : "Analyzing"}
          </span>
        </div>

        {fetchError ? (
          <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {fetchError}
          </div>
        ) : null}

        {failed && progress?.errorMessage ? (
          <div className="mb-6 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            {progress.errorMessage}
          </div>
        ) : null}

        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="px-6 pt-6 pb-2 border-b border-border">
            <h2 className="text-base font-semibold text-foreground">Processing your document</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              This can take a minute for longer documents (OpenAI calls per section).
            </p>
          </div>

          <div className="p-6 space-y-4">
            {uiSteps.map((step) => {
              const status = step.state;
              return (
                <div key={step.id} className="flex items-center gap-4">
                  <div className="shrink-0 w-7 h-7 flex items-center justify-center">
                    {status === "done" ? (
                      <CheckCircle2 className="w-5 h-5 text-[var(--risk-low)]" />
                    ) : status === "active" ? (
                      <Loader2 className="w-5 h-5 text-primary animate-spin" />
                    ) : (
                      <Circle className="w-5 h-5 text-border" />
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          "text-sm font-medium transition-colors",
                          status === "done"
                            ? "text-[var(--risk-low)]"
                            : status === "active"
                              ? "text-foreground"
                              : "text-muted-foreground"
                        )}
                      >
                        {step.label}
                      </span>
                      {status === "done" && <span className="text-xs text-muted-foreground">Done</span>}
                      {status === "active" && (
                        <span className="text-xs text-primary font-medium">In progress…</span>
                      )}
                    </div>

                    {status !== "pending" && (
                      <div className="mt-1.5 h-1 rounded-full bg-secondary overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            status === "done" ? "bg-[var(--risk-low)] w-full" : "bg-primary w-3/5 animate-pulse"
                          )}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-6 bg-card border border-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-foreground">Sections analyzed</span>
            <span className="text-sm text-muted-foreground">
              {analyzedSections} of {progress?.totalSections ?? "—"}
            </span>
          </div>
          <div className="h-2 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">{pct}% complete</p>
        </div>

        {failed ? (
          <div className="mt-8 flex justify-center">
            <Link
              href="/"
              className="text-sm font-medium bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:opacity-90"
            >
              Try again
            </Link>
          </div>
        ) : null}
      </main>
    </div>
  );
}

export function ProcessingView() {
  const searchParams = useSearchParams();
  const documentId = searchParams.get("documentId");
  if (!documentId) {
    return <ProcessingMissingId />;
  }
  return <ProcessingContent documentId={documentId} />;
}
