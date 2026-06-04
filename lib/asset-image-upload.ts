export const ASSET_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export const ASSET_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export type AssetImageMimeType = (typeof ASSET_IMAGE_MIME_TYPES)[number];

const extensionByMime: Record<AssetImageMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function isAllowedAssetImageMime(type: string): type is AssetImageMimeType {
  return ASSET_IMAGE_MIME_TYPES.includes(type as AssetImageMimeType);
}

export function getAssetImageExtension(mimeType: AssetImageMimeType) {
  return extensionByMime[mimeType];
}

export function validateAssetImageFile(file: File): string | null {
  if (!isAllowedAssetImageMime(file.type)) {
    return "Format accepte : JPG, PNG, WebP ou GIF";
  }

  if (file.size > ASSET_IMAGE_MAX_BYTES) {
    return "Image trop volumineuse (max 5 Mo)";
  }

  return null;
}
