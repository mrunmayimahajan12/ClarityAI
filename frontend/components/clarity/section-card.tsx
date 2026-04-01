"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Quote, Zap } from "lucide-react";
import { RiskBadge } from "./risk-badge";
import type { Section } from "@/lib/analysis-data";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  section: Section;
  isHighlighted?: boolean;
  onClick?: () => void;
}

export function SectionCard({ section, isHighlighted, onClick }: SectionCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(
        "bg-card border rounded-xl overflow-hidden transition-all shadow-sm",
        isHighlighted ? "border-primary ring-1 ring-primary/20" : "border-border hover:border-border/80"
      )}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start gap-3 p-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
            <RiskBadge risk={section.risk} size="sm" />
          </div>
          <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{section.summary}</p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className="shrink-0 mt-0.5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border">
          {/* Why it matters */}
          {section.riskFactors && section.riskFactors.length > 0 ? (
            <div className="p-4 border-b border-border bg-secondary/20">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                Rule-based signals
              </p>
              <ul className="text-sm text-foreground list-disc pl-4 space-y-1">
                {section.riskFactors.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="p-4 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              Why it matters
            </p>
            <p className="text-sm text-foreground leading-relaxed">{section.whyItMatters}</p>
          </div>

          {/* Evidence */}
          <div className="p-4 border-b border-border bg-secondary/30">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
              <Quote className="w-3 h-3" />
              From the document
            </p>
            <blockquote className="text-sm text-foreground leading-relaxed italic border-l-2 border-primary/40 pl-3">
              {section.evidence}
            </blockquote>
          </div>

          {/* Suggested action */}
          <div className="p-4 bg-accent/30">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-primary" />
              Suggested action
            </p>
            <p className="text-sm text-foreground leading-relaxed">{section.suggestedAction}</p>
          </div>
        </div>
      )}
    </div>
  );
}
