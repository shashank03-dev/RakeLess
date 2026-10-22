import { PATCH_IDS, type PatchId } from './schema';

export type Region = { id: PatchId; left: number; top: number; width: number; height: number };

/** Integer boundaries; last row/column reaches the edge exactly. Covers the image once. */
export function gridRegions(width: number, height: number): Region[] {
  const xs = [0, Math.floor(width / 3), Math.floor((2 * width) / 3), width];
  const ys = [0, Math.floor(height / 3), Math.floor((2 * height) / 3), height];
  return PATCH_IDS.map((id, i) => {
    const r = Math.floor(i / 3);
    const c = i % 3;
    return { id, left: xs[c], top: ys[r], width: xs[c + 1] - xs[c], height: ys[r + 1] - ys[r] };
  });
}

/** Percent geometry for browser overlays, relative to the normalized image. */
export function regionPercent(region: Region, width: number, height: number) {
  return {
    left: (region.left / width) * 100,
    top: (region.top / height) * 100,
    width: (region.width / width) * 100,
    height: (region.height / height) * 100,
  };
}
