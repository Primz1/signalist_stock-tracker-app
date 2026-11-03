/**
 * Checks AI prose against the evidence it was given. Any number not in the evidence,
 * or any buy/sell instruction, rejects the text. Rejected text is never shown.
 */

export type ValidationResult = { ok: boolean; uncited: string[]; advice: string[] };

type Unit = 'pct' | 'ratio' | 'usd' | 'any';
type EvidenceNumber = { value: number; unit: Unit };

/** Numbers like 4.2, -0.8%, $214.20, 2.3x, 1,234.5. */
const NUMBER = /[-+−]?\$?\d{1,3}(?:,\d{3})+(?:\.\d+)?|[-+−]?\$?\d+(?:\.\d+)?/g;
const CLOCK_TIME = /\b\d{1,2}:\d{2}\b/g;
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T/;

const ADVICE = [
  /\b(?:buy|sell)\b(?!-?off)/i,
  /\bshort(?:ing)?\s+(?:the\s+)?(?:stock|shares|position|it)\b/i,
  /\bgo(?:ing)?\s+long\b/i,
  /\b(?:enter|open|close|add\s+to|exit)\s+(?:a|the|your)?\s*positions?\b/i,
  /\btake\s+profits?\b/i,
  /\btaking\s+profits?\b/i,
  /\bstop[- ]loss\b/i,
  /\byou\s+should\b/i,
  /\bwe\s+recommend\b/i,
  /\bguarantee[ds]?\b/i,
  /\bprice\s+target\b/i,
];

/** The unit a field holds, from its name. Unknown fields match any unit. */
function unitOf(key: string | undefined): Unit {
  if (!key) return 'any';
  if (/pct$/i.test(key)) return 'pct';
  if (/^(relative|relativeVolume|volatilityRatio)$/.test(key)) return 'ratio';
  if (/^(start|current|keyLevel|vwap|level|close|price)$/.test(key)) return 'usd';
  return 'any';
}

const parse = (token: string) => Math.abs(Number(token.replace(/[$,−+]/g, '').replace(/^-/, '')));

/** Every number that appears anywhere in the evidence, with the unit its field implies. */
export function evidenceNumbers(evidence: unknown): EvidenceNumber[] {
  const out: EvidenceNumber[] = [];
  const walk = (value: unknown, key?: string) => {
    if (typeof value === 'number' && Number.isFinite(value)) out.push({ value: Math.abs(value), unit: unitOf(key) });
    else if (typeof value === 'string') {
      // Timestamps and links hold digits that aren't facts the prose may cite
      if (key === 'url' || ISO_TIME.test(value)) return;
      for (const match of value.match(NUMBER) ?? []) out.push({ value: parse(match), unit: 'any' });
    } else if (Array.isArray(value)) value.forEach((v) => walk(v, key));
    else if (value && typeof value === 'object') Object.entries(value).forEach(([k, v]) => walk(v, k));
  };
  walk(evidence);
  // Counts the AI may reasonably mention
  if (evidence && typeof evidence === 'object') {
    const e = evidence as { events?: unknown[]; news?: unknown[] };
    if (Array.isArray(e.events)) out.push({ value: e.events.length, unit: 'any' });
    if (Array.isArray(e.news)) out.push({ value: e.news.length, unit: 'any' });
  }
  return out;
}

const decimals = (text: string) => (text.includes('.') ? text.split('.')[1].length : 0);

/** Cited if an evidence number of the same unit rounds to it at the precision the text used. */
function isCited(token: string, unit: Unit, allowed: EvidenceNumber[]) {
  const value = parse(token);
  if (!Number.isFinite(value)) return true;
  const tolerance = 0.5 * 10 ** -decimals(token.replace(/[$,]/g, '')) + 1e-9;
  return allowed.some((a) => (unit === 'any' || a.unit === unit || a.unit === 'any') && Math.abs(a.value - value) <= tolerance);
}

export function validateExplanation(text: string, evidence: unknown): ValidationResult {
  const allowed = evidenceNumbers(evidence);
  const advice = ADVICE.filter((re) => re.test(text)).map((re) => text.match(re)?.[0] ?? re.source);

  // Clock times aren't in the evidence and are easy to get wrong across time zones
  const uncited = [...(text.match(CLOCK_TIME) ?? [])];
  const prose = text.replace(CLOCK_TIME, ' ');

  for (const match of prose.matchAll(NUMBER)) {
    const token = match[0];
    const end = (match.index ?? 0) + token.length;
    const next = prose.slice(end, end + 1);
    const unit: Unit = token.includes('$') ? 'usd' : next === '%' ? 'pct' : next === 'x' || next === '×' ? 'ratio' : 'any';
    const bare = token.replace(/[$,−+-]/g, '');
    // Small whole numbers in prose ("two of three") are structure, not statistics
    const structural = /^\d+$/.test(bare) && Number(bare) <= 5 && unit === 'any';
    if (!structural && !isCited(token, unit, allowed)) uncited.push(token);
  }
  return { ok: uncited.length === 0 && advice.length === 0, uncited, advice };
}
