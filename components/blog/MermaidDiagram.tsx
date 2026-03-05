"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

const MermaidDiagramImpl = dynamic(() => import("./MermaidDiagramImpl"), {
  ssr: false,
  loading: () => (
    <div className="my-4 flex items-center justify-center rounded-lg border border-border bg-zinc-900 p-8 text-sm text-muted-foreground">
      Loading diagram...
    </div>
  ),
});

export function MermaidDiagram({ chart }: { chart: ReactNode }) {
  return <MermaidDiagramImpl chart={chart} />;
}
