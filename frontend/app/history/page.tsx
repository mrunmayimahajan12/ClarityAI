"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/clarity/navbar";
import { RiskBadge } from "@/components/clarity/risk-badge";
import { FileText, ChevronRight, Plus, Loader2 } from "lucide-react";
import { ApiError, fetchDocumentHistory, type HistoryDocumentDto } from "@/lib/api";
import { documentTypeLabel } from "@/lib/document-types";
import type { Risk } from "@/lib/analysis-data";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function riskOrLow(r: string | null): Risk {
  const x = (r || "low").toLowerCase();
  if (x === "high" || x === "medium" || x === "low") return x;
  return "low";
}

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryDocumentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const docs = await fetchDocumentHistory();
        if (!cancelled) {
          setItems(docs);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof ApiError ? e.message : "Could not load history.";
          setError(msg);
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const completed = items.filter((d) => d.status === "completed");

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-3xl mx-auto px-6 pt-12 pb-24">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Document history</h1>
            <p className="text-muted-foreground text-sm mt-1">Documents processed by Clarity on this machine</p>
          </div>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm font-medium bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            New analysis
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-12 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading…
          </div>
        ) : error ? (
          <p className="text-sm text-destructive py-8 text-center">{error}</p>
        ) : completed.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">
            No completed analyses yet. Upload a document from the home page.
          </p>
        ) : (
          <div className="space-y-3">
            {completed.map((doc) => (
              <Link
                key={doc.documentId}
                href={`/analysis?documentId=${encodeURIComponent(doc.documentId)}`}
                className="flex items-center gap-4 bg-card border border-border rounded-xl p-4 hover:border-primary/30 hover:shadow-sm transition-all group"
              >
                <div className="w-10 h-10 rounded-lg bg-secondary border border-border flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-foreground truncate">{doc.documentTitle}</p>
                    <RiskBadge risk={riskOrLow(doc.overallRisk)} size="sm" />
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {doc.summary || "Analysis complete."}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {doc.documentKind ? `${documentTypeLabel(doc.documentKind)} · ` : ""}
                    {doc.totalSections} sections · {formatDate(doc.createdAt)}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
