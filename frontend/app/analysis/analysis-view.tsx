"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/clarity/navbar";
import { AnalysisSidebar } from "@/components/clarity/analysis-sidebar";
import { SectionCard } from "@/components/clarity/section-card";
import { QAPanel } from "@/components/clarity/qa-panel";
import { RiskBadge } from "@/components/clarity/risk-badge";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { ApiError, fetchDocument, toAnalysisData } from "@/lib/api";
import type { AnalysisData } from "@/lib/analysis-data";
import { documentTypeLabel } from "@/lib/document-types";

function AnalysisNoId() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-lg mx-auto px-6 pt-20 text-center">
        <p className="text-sm text-muted-foreground mb-4">No document selected.</p>
        <Link href="/" className="text-sm font-medium text-primary hover:underline">
          Upload a document
        </Link>
      </main>
    </div>
  );
}

function AnalysisContent({ documentId }: { documentId: string }) {
  const [data, setData] = useState<AnalysisData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await fetchDocument(documentId);
        if (cancelled) return;
        if (p.progress.status !== "completed") {
          setError(
            "This document is not finished processing yet. Stay on the processing page or try again shortly."
          );
          setData(null);
          return;
        }
        setData(toAnalysisData(p));
        setError(null);
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof ApiError ? e.message : "Could not load analysis.";
        setError(msg);
        setData(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [documentId]);

  if (error && !data) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="max-w-lg mx-auto px-6 pt-20 text-center space-y-4">
          <p className="text-sm text-destructive">{error}</p>
          <div className="flex gap-3 justify-center">
            <Link
              href={`/processing?documentId=${encodeURIComponent(documentId)}`}
              className="text-sm font-medium text-primary hover:underline"
            >
              Go to processing
            </Link>
            <Link href="/" className="text-sm font-medium text-muted-foreground hover:underline">
              Home
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="max-w-lg mx-auto px-6 pt-20 text-center">
          <p className="text-sm text-muted-foreground">Loading analysis…</p>
        </main>
      </div>
    );
  }

  const highRiskSections = data.sections.filter((s) => s.risk === "high");
  const allSections = data.sections;
  const activeRaw =
    activeSection != null ? data.sections.find((s) => s.id === activeSection)?.rawText : undefined;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="max-w-[1320px] mx-auto px-6 py-6 flex gap-6 items-start">
        <AnalysisSidebar
          documentTitle={data.documentTitle}
          overallRisk={data.overallRisk}
          sections={data.sections}
          activeSection={activeSection}
          onSelectSection={(id) => setActiveSection(id === activeSection ? null : id)}
        />

        <main className="flex-1 min-w-0 space-y-5">
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 pt-5 pb-4 border-b border-border flex items-start justify-between gap-4">
              <div>
                <h1 className="text-base font-semibold text-foreground">{data.documentTitle}</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {documentTypeLabel(data.documentKind)} · Overall analysis summary
                </p>
              </div>
              <RiskBadge risk={data.overallRisk} />
            </div>

            <div className="p-6 space-y-5">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Summary</p>
                <p className="text-sm text-foreground leading-relaxed">{data.summary}</p>
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Key concerns
                </p>
                <ul className="space-y-2">
                  {data.keyConcerns.map((concern, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-[var(--risk-medium)] shrink-0 mt-0.5" />
                      <span className="text-sm text-foreground">{concern}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Suggested next steps
                </p>
                <ul className="space-y-1.5">
                  {data.nextSteps.slice(0, 3).map((step, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                      <ChevronRight className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                      {step}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {highRiskSections.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-[var(--risk-high)]" />
                <h2 className="text-sm font-semibold text-foreground">Needs attention</h2>
                <span className="text-xs text-muted-foreground ml-1">({highRiskSections.length} high-risk)</span>
              </div>
              <div className="space-y-3">
                {highRiskSections.map((section) => (
                  <SectionCard
                    key={section.id}
                    section={section}
                    isHighlighted={activeSection === section.id}
                    onClick={() => setActiveSection(section.id === activeSection ? null : section.id)}
                  />
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="text-sm font-semibold text-foreground mb-3">All sections</h2>
            <div className="space-y-3">
              {allSections.map((section) => (
                <SectionCard
                  key={section.id}
                  section={section}
                  isHighlighted={activeSection === section.id}
                  onClick={() => setActiveSection(section.id === activeSection ? null : section.id)}
                />
              ))}
            </div>
          </section>
        </main>

        <QAPanel data={data} documentId={documentId} rawPreview={activeRaw} />
      </div>
    </div>
  );
}

export function AnalysisView() {
  const searchParams = useSearchParams();
  const documentId = searchParams.get("documentId");
  if (!documentId) {
    return <AnalysisNoId />;
  }
  return <AnalysisContent documentId={documentId} />;
}
