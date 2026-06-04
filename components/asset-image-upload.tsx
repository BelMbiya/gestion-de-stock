"use client";

import { ImagePlus, Loader2, Trash2, Upload } from "lucide-react";
import {
  type DragEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { AssetImageThumb } from "@/components/asset-image-thumb";
import { Button } from "@/components/ui/button";
import { validateAssetImageFile } from "@/lib/asset-image-upload";
import { cn } from "@/lib/utils";

type AssetImageUploadProps = {
  alt: string;
  className?: string;
  disabled?: boolean;
  imageUrl: string | null;
  onImageUrlChange: (url: string | null) => void;
};

export function AssetImageUpload({
  alt,
  className,
  disabled = false,
  imageUrl,
  onImageUrlChange,
}: AssetImageUploadProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(imageUrl);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localBlobUrl, setLocalBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!localBlobUrl) {
      setPreviewUrl(imageUrl);
    }
  }, [imageUrl, localBlobUrl]);

  useEffect(() => {
    return () => {
      if (localBlobUrl) {
        URL.revokeObjectURL(localBlobUrl);
      }
    };
  }, [localBlobUrl]);

  async function uploadFile(file: File) {
    const validationError = validateAssetImageFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsUploading(true);

    const blobUrl = URL.createObjectURL(file);
    if (localBlobUrl) {
      URL.revokeObjectURL(localBlobUrl);
    }
    setLocalBlobUrl(blobUrl);
    setPreviewUrl(blobUrl);

    try {
      const body = new FormData();
      body.append("file", file);

      const response = await fetch("/api/uploads/asset-image", {
        method: "POST",
        body,
      });

      const payload = (await response.json()) as { error?: string; url?: string };

      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? "Echec du televersement");
      }

      onImageUrlChange(payload.url);
      setPreviewUrl(payload.url);
      URL.revokeObjectURL(blobUrl);
      setLocalBlobUrl(null);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Impossible d'envoyer l'image",
      );
      setPreviewUrl(imageUrl);
      URL.revokeObjectURL(blobUrl);
      setLocalBlobUrl(null);
    } finally {
      setIsUploading(false);
    }
  }

  function handleFiles(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) {
      return;
    }

    void uploadFile(file);
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    if (!disabled && !isUploading) {
      setIsDragging(true);
    }
  }

  function handleDragLeave(event: DragEvent) {
    event.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    setIsDragging(false);

    if (disabled || isUploading) {
      return;
    }

    handleFiles(event.dataTransfer.files);
  }

  function handleRemove() {
    if (localBlobUrl) {
      URL.revokeObjectURL(localBlobUrl);
      setLocalBlobUrl(null);
    }
    setPreviewUrl(null);
    setError(null);
    onImageUrlChange(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  const hasImage = Boolean(previewUrl);

  return (
    <div className={cn("space-y-2", className)}>
      <div
        className={cn(
          "flex flex-col gap-4 rounded-xl border border-dashed p-4 transition-colors sm:flex-row sm:items-center",
          isDragging
            ? "border-[#6fb6ff] bg-[#6fb6ff]/10"
            : "border-white/15 bg-white/4",
          disabled && "pointer-events-none opacity-60",
        )}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <AssetImageThumb alt={alt} imageUrl={previewUrl} size="md" />

        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-sm font-medium text-white">Photo du materiel</p>
            <p className="text-xs text-slate-400">
              Glissez-deposez une image ou cliquez pour parcourir (JPG, PNG, WebP,
              GIF — max 5 Mo).
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              className="bg-white/10 text-white hover:bg-white/15"
              disabled={disabled || isUploading}
              onClick={() => inputRef.current?.click()}
              type="button"
            >
              {isUploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              {isUploading ? "Envoi..." : "Choisir une image"}
            </Button>
            {hasImage ? (
              <Button
                className="bg-[#ff2f45]/20 text-[#ff9aa5] hover:bg-[#ff2f45]/30"
                disabled={disabled || isUploading}
                onClick={handleRemove}
                type="button"
              >
                <Trash2 className="size-4" />
                Retirer
              </Button>
            ) : null}
          </div>

          <input
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            disabled={disabled || isUploading}
            id={inputId}
            onChange={(event) => handleFiles(event.target.files)}
            ref={inputRef}
            type="file"
          />
        </div>

        {!hasImage && !isUploading ? (
          <ImagePlus className="hidden size-8 shrink-0 text-slate-500 sm:block" />
        ) : null}
      </div>

      {error ? <p className="text-xs text-[#ff9aa5]">{error}</p> : null}
    </div>
  );
}
