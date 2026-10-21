export const ui = {
  page: "flex h-full min-h-0 flex-col gap-4",
  header: "border-b border-white/10 pb-3",
  eyebrow: "text-xs uppercase tracking-wide text-slate-500",
  title: "text-xl font-semibold text-white",
  subtitle: "text-sm text-slate-400",
  panel: "rounded-md border border-white/10 bg-slate-900/50",
  panelHeader: "border-b border-white/10 px-4 py-3",
  panelBody: "p-4",
  input: "h-9 border-white/10 bg-slate-900",
  /** Conteneur scrollable pour tableaux (horizontal + vertical). */
  tableWrap:
    "max-h-[min(calc(100vh-14rem),56rem)] overflow-x-auto overflow-y-auto [scrollbar-gutter:stable]",
  tablePanel: "flex min-h-0 flex-1 flex-col ring-0",
  tablePanelBody: "min-h-0 flex-1 overflow-hidden p-4",
  btnPrimary: "bg-red-600 text-white hover:bg-red-700",
  btnSecondary: "border border-white/10 bg-slate-800 text-white hover:bg-slate-700",
} as const;
