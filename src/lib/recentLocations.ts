const STORAGE_KEY = "fabric-flo-recent-locs-v1";
const MAX_PER_PRODUCTION = 5;

type RecentMap = Record<string, string[]>;

function load(): RecentMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as RecentMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function save(map: RecentMap): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function rememberRecentLocation(productionId: string, locationId: string): void {
  const map = load();
  const prev = map[productionId] ?? [];
  const next = [locationId, ...prev.filter((id) => id !== locationId)].slice(0, MAX_PER_PRODUCTION);
  map[productionId] = next;
  save(map);
}

export function getRecentLocationIds(productionId: string): string[] {
  return load()[productionId] ?? [];
}

export function getLastLocationId(productionId: string): string | null {
  const ids = getRecentLocationIds(productionId);
  return ids[0] ?? null;
}
