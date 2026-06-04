"use client";

import { FileDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { exportTablePdf, type PdfTableSection } from "@/lib/pdf-export";

type ExportPdfButtonProps = {
  className?: string;
  disabled?: boolean;
  filename: string;
  sections: PdfTableSection[];
  subtitle: string;
  title: string;
};

export function ExportPdfButton({
  className,
  disabled = false,
  filename,
  sections,
  subtitle,
  title,
}: ExportPdfButtonProps) {
  const hasRows = sections.some((section) => section.rows.length > 0);

  return (
    <Button
      className={className ?? "h-11 bg-[#ff2f45] text-white hover:bg-[#ff2f45]/90"}
      disabled={disabled || !hasRows}
      onClick={() =>
        void exportTablePdf({
          filename,
          sections,
          subtitle,
          title,
        })
      }
      type="button"
    >
      <FileDown className="size-4" />
      Exporter PDF
    </Button>
  );
}
