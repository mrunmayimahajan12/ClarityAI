import { Suspense } from "react";
import { ProcessingView } from "./processing-view";

function ProcessingFallback() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <p className="text-sm text-muted-foreground">Loading…</p>
    </div>
  );
}

export default function ProcessingPage() {
  return (
    <Suspense fallback={<ProcessingFallback />}>
      <ProcessingView />
    </Suspense>
  );
}
