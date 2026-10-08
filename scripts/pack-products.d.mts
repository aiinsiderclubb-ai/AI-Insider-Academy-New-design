export interface PackedFile {
  filename: string;
  labelRu: string;
  labelEn: string;
  mime: string;
  body: string;
}

export function packProducts(): Record<string, PackedFile[]>;
export function serialise(packs: Record<string, unknown>): string;

export interface BundledFile {
  path: string;
  body: string;
}

export function packBundles(): Record<string, BundledFile[]>;
