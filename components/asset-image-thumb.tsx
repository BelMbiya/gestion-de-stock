"use client";

import { Package } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

const sizeClasses = {
  sm: "h-9 w-9",
  md: "h-11 w-11",
  lg: "h-16 w-16",
} as const;

type AssetImageThumbProps = {
  alt: string;
  className?: string;
  imageUrl?: string | null;
  size?: keyof typeof sizeClasses;
};

export function AssetImageThumb({
  alt,
  className,
  imageUrl,
  size = "md",
}: AssetImageThumbProps) {
  const [failed, setFailed] = useState(false);
  const dim = sizeClasses[size];

  if (!imageUrl || failed) {
    return (
      <div
        className={cn(
          dim,
          "flex shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/6",
          className,
        )}
        title={alt}
      >
        <Package className="size-4 text-slate-500" aria-hidden />
      </div>
    );
  }

  return (
    <img
      alt={alt}
      className={cn(
        dim,
        "shrink-0 rounded-lg border border-white/10 object-cover",
        className,
      )}
      onError={() => setFailed(true)}
      src={imageUrl}
    />
  );
}
