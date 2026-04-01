"use client";

import { RiskBadge, RiskDot } from "./risk-badge";
import type { Section, Risk } from "@/lib/analysis-data";
import { cn } from "@/lib/utils";
import { FileText } from "lucide-react";

interface AnalysisSidebarProps {
  documentTitle: string;
  overallRisk: Risk;
  sections: Section[];
  activeSection: string | null;
  onSelectSection: (id: string) => void;
}

export function AnalysisSidebar({
  documentTitle,
  overallRisk,
  sections,
  activeSection,
  onSelectSection,
}: AnalysisSidebarProps) {
  return (
    <aside className="w-56 shrink-0 flex flex-col gap-4">
      {/* Document card */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded bg-secondary border border-border flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">{documentTitle}</p>
            <p className="text-xs text-muted-foreground">18 pages · 7 sections</p>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Overall risk</span>
          <RiskBadge risk={overallRisk} size="sm" />
        </div>
      </div>

      {/* Sections list */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sections</p>
        </div>
        <nav className="py-1">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => onSelectSection(section.id)}
              className={cn(
                "w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors",
                activeSection === section.id
                  ? "bg-accent/60 text-foreground"
                  : "hover:bg-secondary/60 text-muted-foreground hover:text-foreground"
              )}
            >
              <RiskDot risk={section.risk} />
              <span className="text-xs font-medium truncate">{section.title}</span>
            </button>
          ))}
        </nav>
      </div>
    </aside>
  );
}
