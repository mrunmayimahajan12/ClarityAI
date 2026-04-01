"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

export function Navbar() {
  const pathname = usePathname();
  const isAnalysisPage = pathname.startsWith("/analysis");

  return (
    <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-sm border-b border-border">
      <nav className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <Image src="/clarity_ai_logo.png" alt="Clarity AI" width={50} height={50} className="rounded" />
          <span className="font-semibold text-base tracking-tight text-foreground">Clarity</span>
        </Link>

        <div className="flex items-center gap-2">
          {isAnalysisPage && (
            <Link
              href="/"
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
            >
              <Plus className="w-3.5 h-3.5" />
              New analysis
            </Link>
          )}
          <Link
            href="/history"
            className={cn(
              "text-sm px-3 py-1.5 rounded-md transition-colors",
              pathname === "/history"
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            )}
          >
            History
          </Link>
        </div>
      </nav>
    </header>
  );
}
