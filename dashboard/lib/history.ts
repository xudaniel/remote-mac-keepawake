export const HISTORY_RANGES = ["1h", "6h", "24h", "7d", "30d", "all", "custom"] as const;
export type HistoryRange = (typeof HISTORY_RANGES)[number];

export type HistoryBounds = {
  range: HistoryRange;
  from: string | null;
  to: string | null;
};

const RANGE_MILLISECONDS: Partial<Record<HistoryRange, number>> = {
  "1h": 60 * 60 * 1_000,
  "6h": 6 * 60 * 60 * 1_000,
  "24h": 24 * 60 * 60 * 1_000,
  "7d": 7 * 24 * 60 * 60 * 1_000,
  "30d": 30 * 24 * 60 * 60 * 1_000,
};

function toSqlTimestamp(value: Date) {
  return value.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
}

function validDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseHistoryBounds(url: URL, now = new Date()): HistoryBounds | null {
  const requested = url.searchParams.get("range") ?? "24h";
  if (!HISTORY_RANGES.includes(requested as HistoryRange)) return null;
  const range = requested as HistoryRange;
  if (range === "all") return { range, from: null, to: null };
  if (range === "custom") {
    const from = validDate(url.searchParams.get("from"));
    const to = validDate(url.searchParams.get("to"));
    if (!from || !to || from >= to) return null;
    return { range, from: toSqlTimestamp(from), to: toSqlTimestamp(to) };
  }
  const duration = RANGE_MILLISECONDS[range];
  if (!duration) return null;
  return {
    range,
    from: toSqlTimestamp(new Date(now.getTime() - duration)),
    to: toSqlTimestamp(now),
  };
}

export function historyWhere(bounds: HistoryBounds, cursor?: number | null) {
  const clauses: string[] = [];
  const values: Array<string | number> = [];
  if (bounds.from) {
    clauses.push("received_at >= ?");
    values.push(bounds.from);
  }
  if (bounds.to) {
    clauses.push("received_at <= ?");
    values.push(bounds.to);
  }
  if (cursor) {
    clauses.push("id < ?");
    values.push(cursor);
  }
  return {
    sql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    values,
  };
}

export function parsePageLimit(value: string | null, maximum = 500) {
  const parsed = Number(value ?? 180);
  if (!Number.isInteger(parsed) || parsed < 1) return null;
  return Math.min(parsed, maximum);
}

export function parseCursor(value: string | null) {
  if (!value) return null;
  if (!/^\d+$/.test(value)) return Number.NaN;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : Number.NaN;
}

