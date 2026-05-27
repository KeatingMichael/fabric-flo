import type { InventoryItem, Production } from "@/types";
import { parseFabricFloPayload } from "@/lib/qrPayload";

/** Normalize rental-house handwriting / stickers for comparison. */
export function normalizeLabelText(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .toUpperCase();
}

/** Plain-text marks on cases (not Fabric Flo JSON QR payloads). */
export function getHandwrittenMarks(item: InventoryItem): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const alias of item.qrAliases) {
    const t = alias.trim();
    if (!t || parseFabricFloPayload(t)) continue;
    const key = normalizeLabelText(t);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

function tokenize(text: string): string[] {
  const n = normalizeLabelText(text);
  if (!n) return [];
  return n
    .split(/[\s,;/|]+/)
    .map((t) => t.replace(/[^A-Z0-9'"#\-./]/gi, ""))
    .filter((t) => t.length >= 2 || /^\d/.test(t));
}

export type LabelMatch = {
  item: InventoryItem;
  score: number;
  reason: string;
};

function scoreItemAgainstQuery(item: InventoryItem, queryNorm: string, tokens: string[]): LabelMatch | null {
  if (!queryNorm) return null;
  let score = 0;
  const reasons: string[] = [];

  for (const mark of getHandwrittenMarks(item)) {
    const m = normalizeLabelText(mark);
    if (m === queryNorm) {
      score = Math.max(score, 100);
      reasons.push("exact sticker / handwritten ID");
    } else if (m.includes(queryNorm) || queryNorm.includes(m)) {
      score = Math.max(score, 88);
      reasons.push("sticker ID contains match");
    }
  }

  const nameN = normalizeLabelText(item.name);
  if (nameN === queryNorm) {
    score = Math.max(score, 92);
    reasons.push("exact name");
  } else if (nameN && (nameN.includes(queryNorm) || queryNorm.includes(nameN))) {
    score = Math.max(score, 78);
    reasons.push("name match");
  }

  if (item.size) {
    const sizeN = normalizeLabelText(item.size);
    if (sizeN === queryNorm) {
      score = Math.max(score, 86);
      reasons.push("exact size");
    } else if (sizeN.includes(queryNorm) || queryNorm.includes(sizeN)) {
      score = Math.max(score, 72);
      reasons.push("size match");
    }
  }

  if (item.notes) {
    const notesN = normalizeLabelText(item.notes);
    if (notesN.includes(queryNorm)) {
      score = Math.max(score, 65);
      reasons.push("notes match");
    }
  }

  const itemTokens = new Set([
    ...tokenize(item.name),
    ...tokenize(item.size ?? ""),
    ...getHandwrittenMarks(item).flatMap(tokenize),
  ]);
  let tokenHits = 0;
  for (const t of tokens) {
    if (itemTokens.has(t)) tokenHits++;
  }
  if (tokens.length > 0 && tokenHits > 0) {
    const tokenScore = 50 + Math.round((tokenHits / tokens.length) * 35);
    score = Math.max(score, tokenScore);
    reasons.push(`${tokenHits} word/number overlap`);
  }

  if (score < 55) return null;
  return { item, score, reason: reasons[0] ?? "similar text" };
}

/** Rank inventory rows that might match scanned / typed label text. */
export function rankLabelMatches(
  production: Production,
  raw: string,
  limit = 5
): LabelMatch[] {
  const queryNorm = normalizeLabelText(raw);
  if (!queryNorm) return [];
  const tokens = tokenize(raw);
  const matches: LabelMatch[] = [];
  for (const item of production.items) {
    const m = scoreItemAgainstQuery(item, queryNorm, tokens);
    if (m) matches.push(m);
  }
  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, limit);
}

export function bestLabelMatch(
  production: Production,
  raw: string
): LabelMatch | undefined {
  return rankLabelMatches(production, raw, 1)[0];
}
