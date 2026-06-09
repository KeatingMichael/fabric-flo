/** Plan D — cross-check OCR fields against production inventory. */

import {
  joinLabelFields,
  looksLikeWeakFabricLine,
  looksLikeWeakJobLine,
  looksLikeWeakSizeLine,
  type LabelOcrFields,
} from "@/lib/labelOcr";
import { getHandwrittenMarks, normalizeLabelText, rankLabelMatches } from "@/lib/labelText";
import type { InventoryItem, Production } from "@/types";

export type LabelValidationResult = {
  fields: LabelOcrFields;
  corrected: boolean;
  hint?: string;
  matchedItem?: InventoryItem;
};

function extractJobFromMark(mark: string): string | null {
  const firstLine = mark.split(/[\n/]/)[0]?.trim() ?? mark.trim();
  const digits = firstLine.replace(/[Oo]/g, "0").replace(/[Il|]/g, "1").replace(/\D/g, "");
  if (digits.length >= 5 && digits.length <= 8) return digits;
  return null;
}

function inventoryJobNumbers(item: InventoryItem): string[] {
  const jobs = new Set<string>();
  for (const mark of getHandwrittenMarks(item)) {
    const job = extractJobFromMark(mark);
    if (job) jobs.add(job);
  }
  return [...jobs];
}

function findItemsByJob(production: Production, job: string): InventoryItem[] {
  const digits = job.replace(/\D/g, "");
  if (digits.length < 4) return [];
  return production.items.filter((item) => inventoryJobNumbers(item).includes(digits));
}

function fieldsFromItem(item: InventoryItem): LabelOcrFields {
  const jobs = inventoryJobNumbers(item);
  return {
    job: jobs[0] ?? "",
    fabric: item.name.trim().toUpperCase(),
    size: (item.size ?? "").trim(),
  };
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + cost);
    }
  }
  return dp[m]![n]!;
}

/**
 * Correct weak OCR using inventory marks, names, and sizes.
 */
export function validateLabelFieldsAgainstInventory(
  production: Production,
  fields: LabelOcrFields
): LabelValidationResult {
  let job = fields.job.trim();
  let fabric = fields.fabric.trim();
  let size = fields.size.trim();
  let corrected = false;
  let matchedItem: InventoryItem | undefined;

  const labelText = joinLabelFields(job, fabric, size);
  const matches = rankLabelMatches(production, labelText, 5);
  if (matches[0] && matches[0].score >= 85) {
    matchedItem = matches[0].item;
  }

  const byJob = findItemsByJob(production, job);
  if (byJob.length === 1) {
    matchedItem = byJob[0];
  } else if (byJob.length > 1 && matchedItem && byJob.some((i) => i.id === matchedItem!.id)) {
    // keep ranked match
  } else if (byJob.length > 1) {
    matchedItem = byJob[0];
  }

  if (!matchedItem && job) {
    for (const item of production.items) {
      for (const knownJob of inventoryJobNumbers(item)) {
        if (levenshtein(job.replace(/\D/g, ""), knownJob) <= 1) {
          matchedItem = item;
          if (knownJob !== job.replace(/\D/g, "")) {
            job = knownJob;
            corrected = true;
          }
          break;
        }
      }
      if (matchedItem) break;
    }
  }

  if (matchedItem) {
    const expected = fieldsFromItem(matchedItem);
    if (looksLikeWeakJobLine(job) && expected.job) {
      job = expected.job;
      corrected = true;
    }
    if (looksLikeWeakFabricLine(fabric) && expected.fabric) {
      fabric = expected.fabric;
      corrected = true;
    }
    if (looksLikeWeakSizeLine(size) && expected.size) {
      size = expected.size;
      corrected = true;
    }

    const jobDigits = job.replace(/\D/g, "");
    const expectedJob = expected.job.replace(/\D/g, "");
    if (
      expectedJob &&
      jobDigits &&
      jobDigits !== expectedJob &&
      levenshtein(jobDigits, expectedJob) <= 2
    ) {
      job = expected.job;
      corrected = true;
    }

    const fabricNorm = normalizeLabelText(fabric);
    const expectedFabricNorm = normalizeLabelText(expected.fabric);
    if (
      expectedFabricNorm &&
      fabricNorm &&
      fabricNorm !== expectedFabricNorm &&
      (expectedFabricNorm.includes(fabricNorm) || levenshtein(fabricNorm, expectedFabricNorm) <= 2)
    ) {
      fabric = expected.fabric;
      corrected = true;
    }
  }

  const result: LabelValidationResult = {
    fields: { job, fabric, size },
    corrected,
    matchedItem,
  };

  if (corrected && matchedItem) {
    result.hint = `Matched inventory — ${matchedItem.name}${matchedItem.size ? ` · ${matchedItem.size}` : ""}.`;
  } else if (matchedItem && !corrected) {
    result.hint = undefined;
  } else if (
    hasAnyField(fields) &&
    !matchedItem &&
    production.items.length > 0 &&
    (looksLikeWeakJobLine(job) || looksLikeWeakFabricLine(fabric))
  ) {
    result.hint = "Not in this production’s inventory — check fields or add the piece.";
  }

  return result;
}

function hasAnyField(fields: LabelOcrFields): boolean {
  return Boolean(fields.job || fields.fabric || fields.size);
}
