// Wertpapier-Listen mit gemeinsamem Kategorien-Grundgerüst.
// Die Ober-/Unterkategorien sind für alle Listen identisch; nur die
// Wertpapiere (securities.dataset) sind je Liste getrennt.

export const DATASETS = [
  { key: "EIX_B", label: "EIX B" },
  { key: "EIX_M", label: "EIX M" },
  { key: "HAM", label: "HAM" },
] as const;

export type DatasetKey = (typeof DATASETS)[number]["key"];

export const DEFAULT_DATASET: DatasetKey = "EIX_B";

export function isDatasetKey(v: string | null | undefined): v is DatasetKey {
  return DATASETS.some((d) => d.key === v);
}

export function datasetLabel(key: string): string {
  return DATASETS.find((d) => d.key === key)?.label ?? key;
}
