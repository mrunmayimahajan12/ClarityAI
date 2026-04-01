"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/clarity/navbar";
import { Upload, FileText, AlignLeft, ChevronRight, Shield, BarChart2, Lightbulb, Loader2, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiError, createDocumentFromFile, createDocumentFromText } from "@/lib/api";
import { DOCUMENT_TYPES, type DocumentTypeId, documentTypeLabel } from "@/lib/document-types";

const EXAMPLE_TO_TYPE: Record<string, DocumentTypeId> = {
  "Job Offer": "employment",
  "Lease Agreement": "lease",
  "Insurance Policy": "generic",
  "Terms of Service": "saas_terms",
  NDA: "nda",
};

const FEATURES = [
  {
    icon: BarChart2,
    title: "Structured analysis",
    description: "Every clause broken down into clear, readable sections.",
  },
  {
    icon: Shield,
    title: "Risk insights",
    description: "Rule-based signals plus AI explanations, grounded in your text.",
  },
  {
    icon: Lightbulb,
    title: "Actionable recommendations",
    description: "Know exactly what to ask, change, or watch out for.",
  },
];

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [flowStep, setFlowStep] = useState<1 | 2>(1);
  const [documentType, setDocumentType] = useState<DocumentTypeId | null>(null);
  const [mode, setMode] = useState<"upload" | "paste">("upload");
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [selectedExample, setSelectedExample] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (!dropped) return;
    setFile(dropped);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const picked = input.files?.[0];
    if (!picked) return;
    setFile(picked);
    setTimeout(() => {
      input.value = "";
    }, 0);
  };

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleExampleClick = (label: string) => {
    const tid = EXAMPLE_TO_TYPE[label] ?? "generic";
    setSelectedExample(label === selectedExample ? null : label);
    setDocumentType(tid);
    setMode("paste");
    setFlowStep(2);
    setText(`[Sample ${label} text would be pasted here for analysis]`);
  };

  const handleSubmit = async () => {
    if (!documentType) return;
    setSubmitError(null);
    if (mode === "upload" && file) {
      const maxBytes = 15 * 1024 * 1024;
      if (file.size > maxBytes) {
        setSubmitError("File is too large (max 15 MB).");
        return;
      }
      setSubmitting(true);
      try {
        const res = await createDocumentFromFile(file, documentType);
        router.push(`/processing?documentId=${encodeURIComponent(res.documentId)}`);
      } catch (e) {
        const msg = e instanceof ApiError ? e.message : "Upload failed. Is the API running?";
        setSubmitError(msg);
      } finally {
        setSubmitting(false);
      }
      return;
    }
    if (mode === "paste" && text.trim()) {
      setSubmitting(true);
      try {
        const title = selectedExample ? `${selectedExample} (pasted)` : undefined;
        const res = await createDocumentFromText(text.trim(), title, documentType);
        router.push(`/processing?documentId=${encodeURIComponent(res.documentId)}`);
      } catch (e) {
        const msg = e instanceof ApiError ? e.message : "Could not start analysis. Is the API running?";
        setSubmitError(msg);
      } finally {
        setSubmitting(false);
      }
    }
  };

  const canSubmit =
    !submitting &&
    documentType != null &&
    ((mode === "upload" && !!file) || (mode === "paste" && text.trim().length > 0));

  const canContinueToUpload = documentType != null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-2xl mx-auto px-6 pt-20 pb-24">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight text-foreground text-balance leading-tight mb-4">
            Understand important documents{" "}
            <span className="text-primary">with clarity</span>
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed">
            Choose a document type, then upload a PDF or paste text. Clarity applies tailored checks, flags risks, and
            explains what to do next.
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={handleFileChange}
          aria-label="Choose a PDF file to analyze"
          tabIndex={-1}
          className="pointer-events-none fixed bottom-0 right-0 z-0 m-0 h-px w-px min-h-0 min-w-0 overflow-hidden border-0 p-0 opacity-0"
        />

        {flowStep === 1 ? (
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm p-6 space-y-5">
            <div>
              <p className="text-sm font-medium text-foreground mb-1">Step 1 of 2</p>
              <h2 className="text-lg font-semibold text-foreground">What kind of document is this?</h2>
              <p className="text-sm text-muted-foreground mt-1">
                This sets the analysis profile. Pick &ldquo;Other&rdquo; if you are unsure.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {DOCUMENT_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setDocumentType(t.id)}
                  className={cn(
                    "text-left rounded-lg border px-4 py-3 transition-colors",
                    documentType === t.id
                      ? "border-primary bg-accent/40 ring-1 ring-primary/20"
                      : "border-border hover:border-primary/40 hover:bg-secondary/50"
                  )}
                >
                  <p className="text-sm font-medium text-foreground">{t.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={!canContinueToUpload}
              onClick={() => setFlowStep(2)}
              className={cn(
                "w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium text-sm transition-all",
                canContinueToUpload
                  ? "bg-primary text-primary-foreground hover:opacity-90"
                  : "bg-secondary text-muted-foreground cursor-not-allowed"
              )}
            >
              Continue
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border bg-secondary/20">
              <button
                type="button"
                onClick={() => setFlowStep(1)}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-4 h-4" />
                Change type
              </button>
              <p className="text-xs text-muted-foreground truncate">
                <span className="font-medium text-foreground">{documentTypeLabel(documentType!)}</span>
              </p>
            </div>
            <div className="flex border-b border-border">
              <button
                type="button"
                onClick={() => setMode("upload")}
                className={cn(
                  "flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors",
                  mode === "upload"
                    ? "text-primary border-b-2 border-primary bg-accent/30"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Upload className="w-4 h-4" />
                Upload PDF
              </button>
              <button
                type="button"
                onClick={() => setMode("paste")}
                className={cn(
                  "flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors",
                  mode === "paste"
                    ? "text-primary border-b-2 border-primary bg-accent/30"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <AlignLeft className="w-4 h-4" />
                Paste text
              </button>
            </div>

            <div className="p-6">
              {mode === "upload" ? (
                <div
                  role="button"
                  tabIndex={0}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => openFilePicker()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openFilePicker();
                    }
                  }}
                  className={cn(
                    "relative rounded-lg border-2 border-dashed transition-colors cursor-pointer",
                    "flex flex-col items-center justify-center gap-3 py-14 px-6 text-center outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    isDragging
                      ? "border-primary bg-accent/40"
                      : file
                      ? "border-[var(--risk-low)] bg-[var(--risk-low-bg)]"
                      : "border-border hover:border-primary/50 hover:bg-secondary/50"
                  )}
                >
                  {file ? (
                    <>
                      <div className="w-12 h-12 rounded-lg bg-[var(--risk-low)]/10 flex items-center justify-center">
                        <FileText className="w-6 h-6 text-[var(--risk-low)]" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{file.name}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {(file.size / 1024).toFixed(1)} KB — ready to analyze
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">Click to change file</p>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center">
                        <Upload className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Drop your PDF here</p>
                        <p className="text-sm text-muted-foreground mt-0.5">or click to browse files</p>
                      </div>
                      <p className="text-xs text-muted-foreground">Supports PDF files up to 15 MB</p>
                    </>
                  )}
                </div>
              ) : null}
              {mode === "paste" ? (
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Paste the document text here…"
                  className="w-full h-52 resize-none rounded-lg border border-border bg-secondary/40 p-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 leading-relaxed"
                />
              ) : null}

              {submitError ? (
                <p className="mt-3 text-sm text-destructive" role="alert">
                  {submitError}
                </p>
              ) : null}

              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={!canSubmit}
                className={cn(
                  "mt-4 w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium text-sm transition-all",
                  canSubmit
                    ? "bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.99]"
                    : "bg-secondary text-muted-foreground cursor-not-allowed"
                )}
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {submitting ? "Starting…" : "Analyze Document"}
                {!submitting ? <ChevronRight className="w-4 h-4" /> : null}
              </button>
            </div>
          </div>
        )}

        <div className="mt-6">
          <p className="text-xs text-muted-foreground mb-3 text-center">Try an example (paste mode)</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {Object.keys(EXAMPLE_TO_TYPE).map((chip) => (
              <button
                key={chip}
                onClick={() => handleExampleClick(chip)}
                className={cn(
                  "text-xs px-3 py-1.5 rounded-full border transition-colors font-medium",
                  selectedExample === chip
                    ? "bg-accent text-accent-foreground border-primary/30"
                    : "bg-card border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                )}
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-16 grid grid-cols-3 gap-6">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div key={title} className="text-center">
              <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center mx-auto mb-3">
                <Icon className="w-4.5 h-4.5 text-accent-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">{title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
