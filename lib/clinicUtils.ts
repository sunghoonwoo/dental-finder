export type ReportSummary = {
  count: number;
  noExtraCount: number;
};

export type ReportRecord = {
  clinic_id: string;
  report_id: string;
  extra_recommended: boolean;
  visit_id: string | null;
};

export function calcDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function computeReportSummaries(reports: ReportRecord[]): Map<string, ReportSummary> {
  const map = new Map<string, ReportSummary>();
  const seenReportIds = new Set<string>();

  for (const r of reports) {
    // 같은 report_id는 중복 카운트하지 않음
    if (seenReportIds.has(r.report_id)) continue;
    seenReportIds.add(r.report_id);

    const existing = map.get(r.clinic_id);
    if (existing) {
      existing.count++;
      if (!r.extra_recommended) existing.noExtraCount++;
    } else {
      map.set(r.clinic_id, {
        count: 1,
        noExtraCount: r.extra_recommended ? 0 : 1,
      });
    }
  }
  return map;
}

export function getReportBadge(summary?: ReportSummary) {
  if (!summary || summary.count === 0) return { color: "bg-gray-300", label: "제보없음" };
  const pct = summary.noExtraCount / summary.count;
  if (pct >= 0.8) return { color: "bg-green-500", label: `양심 ${Math.round(pct * 100)}%` };
  if (pct >= 0.5) return { color: "bg-yellow-400", label: `보통 ${Math.round(pct * 100)}%` };
  return { color: "bg-red-500", label: `주의 ${Math.round(pct * 100)}%` };
}

export function getBadgeHex(summary?: ReportSummary): string {
  if (!summary || summary.count === 0) return "#d1d5db";
  const pct = summary.noExtraCount / summary.count;
  if (pct >= 0.8) return "#22c55e";
  if (pct >= 0.5) return "#facc15";
  return "#ef4444";
}
