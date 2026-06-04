"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

type CopyReferenceButtonProps = {
  label?: string;
  value: string;
};

export function CopyReferenceButton({
  label = "Copier la reference",
  value,
}: CopyReferenceButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button
      aria-label={label}
      className="size-7 shrink-0 bg-white/10 p-0 text-white hover:bg-white/15"
      onClick={(event) => {
        event.stopPropagation();
        void handleCopy();
      }}
      title={label}
      type="button"
    >
      {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
    </Button>
  );
}
