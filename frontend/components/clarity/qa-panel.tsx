"use client";

import { useState } from "react";
import { Send, CheckSquare, Loader2 } from "lucide-react";
import type { AnalysisData } from "@/lib/analysis-data";
import { ApiError, askDocumentQuestion } from "@/lib/api";

interface QAPanelProps {
  data: AnalysisData;
  documentId: string;
  /** Shown in the raw preview when a section is selected */
  rawPreview?: string;
}

interface QAItem {
  question: string;
  answer: string;
  refs: string[];
}

export function QAPanel({ data, documentId, rawPreview }: QAPanelProps) {
  const [input, setInput] = useState("");
  const [answers, setAnswers] = useState<QAItem[]>([]);
  const [pending, setPending] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);

  const handleAsk = async () => {
    const q = input.trim();
    if (!q || pending) return;
    setPending(true);
    setAskError(null);
    try {
      const res = await askDocumentQuestion(documentId, q);
      setAnswers((prev) => [
        ...prev,
        {
          question: q,
          answer: res.answer,
          refs: res.referencedSections ?? [],
        },
      ]);
      setInput("");
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Could not get an answer.";
      setAskError(msg);
    } finally {
      setPending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleAsk();
    }
  };

  const previewText =
    rawPreview?.trim() ||
    (data.sections[0]
      ? `${data.sections[0].title}\n\n${data.sections[0].evidence || data.sections[0].summary}`
      : "Select a section to preview its source text, or ask a question about the full document.");

  return (
    <aside className="w-72 shrink-0 flex flex-col gap-4">
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ask a question</p>
        </div>

        <div className="p-3 border-b border-border">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about this document…"
              rows={2}
              disabled={pending}
              className="flex-1 resize-none text-sm text-foreground placeholder:text-muted-foreground bg-secondary/40 border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/40 leading-relaxed disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => void handleAsk()}
              disabled={!input.trim() || pending}
              className="self-end p-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-40 hover:opacity-90 transition-opacity"
              aria-label="Send"
            >
              {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </button>
          </div>
          {askError ? <p className="text-xs text-destructive mt-2">{askError}</p> : null}
        </div>

        {answers.length > 0 ? (
          <div className="divide-y divide-border max-h-80 overflow-y-auto">
            {answers.map((item, i) => (
              <div key={i} className="p-4">
                <p className="text-xs font-semibold text-foreground mb-1.5">{item.question}</p>
                <p className="text-xs text-muted-foreground leading-relaxed mb-2">{item.answer}</p>
                <div className="flex flex-wrap gap-1">
                  {item.refs.map((ref) => (
                    <span key={ref} className="text-xs bg-accent text-accent-foreground px-2 py-0.5 rounded-full">
                      {ref}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4">
            <p className="text-xs text-muted-foreground">
              Ask anything about the document — rights, obligations, risk, or plain-language explanations.
            </p>
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <CheckSquare className="w-3.5 h-3.5 text-primary" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">What to do next</p>
        </div>
        <ul className="p-4 space-y-3">
          {data.nextSteps.map((step, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="mt-0.5 w-4 h-4 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <p className="text-xs text-foreground leading-relaxed">{step}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Section source preview</p>
        </div>
        <div className="p-4 h-36 overflow-y-auto">
          <p className="text-xs text-muted-foreground leading-relaxed font-mono whitespace-pre-wrap">{previewText}</p>
        </div>
      </div>
    </aside>
  );
}
