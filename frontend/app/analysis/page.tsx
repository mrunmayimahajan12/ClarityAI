import { Suspense } from "react";
import { AnalysisView } from "./analysis-view";

function AnalysisFallback() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <p className="text-sm text-muted-foreground">Loading…</p>
    </div>
  );
}

export default function AnalysisPage() {
  return (
    <Suspense fallback={<AnalysisFallback />}>
      <AnalysisView />
    </Suspense>
  );
}
