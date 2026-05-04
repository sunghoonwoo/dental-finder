"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import NearbyMap from "@/components/NearbyMap";

type Clinic = {
  clinic_id: string;
  name: string;
  address: string;
  city: string;
  district: string;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  distance?: number;
  reportSummary?: ReportSummary;
};

type ReportSummary = {
  count: number;
  noExtraCount: number;
};

type Tab = "nearby" | "region";

const CITIES = ["서울", "경기", "부산", "인천", "대구", "광주", "대전", "울산", "세종", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"];
const PAGE_SIZE = 20;
const LOCATION_CACHE_KEY = "dental_user_location";
const LOCATION_CACHE_TTL = 24 * 60 * 60 * 1000; // 24시간

function calcDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
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

type ReportRecord = {
  clinic_id: string;
  extra_recommended: boolean;
};

function computeReportSummaries(reports: ReportRecord[]): Map<string, ReportSummary> {
  const map = new Map<string, ReportSummary>();
  for (const r of reports) {
    const existing = map.get(r.clinic_id);
    if (existing) {
      existing.count++;
      if (!r.extra_recommended) existing.noExtraCount++;
    } else {
      map.set(r.clinic_id, { count: 1, noExtraCount: r.extra_recommended ? 0 : 1 });
    }
  }
  return map;
}

function getReportBadge(summary?: ReportSummary) {
  if (!summary || summary.count === 0) {
    return { color: "bg-gray-300", label: "제보없음" };
  }
  const pct = summary.noExtraCount / summary.count;
  if (pct >= 0.8) return { color: "bg-green-500", label: `양심 ${Math.round(pct * 100)}%` };
  if (pct >= 0.5) return { color: "bg-yellow-400", label: `보통 ${Math.round(pct * 100)}%` };
  return { color: "bg-red-500", label: `주의 ${Math.round(pct * 100)}%` };
}

function getBadgeHex(summary?: ReportSummary): string {
  if (!summary || summary.count === 0) return "#d1d5db";
  const pct = summary.noExtraCount / summary.count;
  if (pct >= 0.8) return "#22c55e";
  if (pct >= 0.5) return "#facc15";
  return "#ef4444";
}

export default function ClinicsPage() {
  const [tab, setTab] = useState<Tab>("nearby");

  // 내 위치
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);

  // 지역 선택
  const [city, setCity] = useState("서울");
  const [district, setDistrict] = useState("");
  const [districts, setDistricts] = useState<string[]>([]);

  // 공통
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [priceReportOnly, setPriceReportOnly] = useState(false);
  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null);

  // 캐시된 위치 복원
  useEffect(() => {
    try {
      const cached = localStorage.getItem(LOCATION_CACHE_KEY);
      if (cached) {
        const { lat, lng, ts } = JSON.parse(cached);
        if (Date.now() - ts < LOCATION_CACHE_TTL) {
          setUserPos({ lat, lng });
        }
      }
    } catch {}
  }, []);

  // 구/군 목록 로드
  useEffect(() => {
    supabase
      .rpc("get_districts", { p_city: city })
      .then(({ data }) => {
        setDistricts((data ?? []).map((r: { district: string }) => r.district));
        setDistrict("");
      });
  }, [city]);

  // 위치 가져오기
  function requestLocation() {
    if (!navigator.geolocation) {
      setGeoError("이 브라우저는 위치 서비스를 지원하지 않습니다");
      return;
    }
    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserPos(location);
        setGeoLoading(false);
        try {
          localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify({ ...location, ts: Date.now() }));
        } catch {}
      },
      () => {
        setGeoError("위치 권한이 거부됐습니다. 지역으로 찾기를 이용해주세요.");
        setGeoLoading(false);
      }
    );
  }


  // 데이터 로드
  useEffect(() => {
    setPage(0);
    setClinics([]);
  }, [tab, city, district, search, userPos, priceReportOnly]);

  useEffect(() => {
    if (tab === "nearby" && !userPos) return;

    setLoading(true);

    // 일반 탐색 5km, 제보필터 10km
    const NEARBY_KM = priceReportOnly ? 10 : 5;
    const delta = NEARBY_KM / 111;

    const withDistances = (items: Clinic[]): Clinic[] =>
      items
        .map((c) => ({ ...c, distance: c.lat && c.lng && userPos ? calcDistance(userPos.lat, userPos.lng, c.lat, c.lng) : 999 }))
        .filter((c) => (c.distance ?? 999) <= NEARBY_KM)
        .sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999));

    const loadClinics = async () => {
      // 제보 있는 곳만 필터
      if (priceReportOnly) {
        const { data: rdata } = await supabase
          .from("user_price_reports")
          .select("clinic_id, extra_recommended");

        const reports = (rdata ?? []) as ReportRecord[];
        const summaries = computeReportSummaries(reports);
        const clinicIds = [...summaries.keys()];

        if (clinicIds.length === 0) { setClinics([]); setLoading(false); return; }

        let q = supabase
          .from("clinics")
          .select("clinic_id, name, address, city, district, phone, lat, lng")
          .eq("is_active", true)
          .in("clinic_id", clinicIds);

        if (tab === "nearby" && userPos) {
          q = q.gte("lat", userPos.lat - delta).lte("lat", userPos.lat + delta)
               .gte("lng", userPos.lng - delta).lte("lng", userPos.lng + delta);
        } else if (tab === "region") {
          q = q.eq("city", city);
          if (district) q = q.eq("district", district);
        }
        if (search.trim()) q = q.ilike("name", `%${search.trim()}%`);

        const { data } = await q;
        let withSummary: Clinic[] = (data ?? []).map((c: any) => ({ ...c, reportSummary: summaries.get(c.clinic_id) }));
        if (tab === "nearby") withSummary = withDistances(withSummary);

        setClinics(withSummary);
        setLoading(false);
        return;
      }

      if (tab === "nearby" && userPos) {
        let query = supabase
          .from("clinics")
          .select("clinic_id, name, address, city, district, phone, lat, lng")
          .eq("is_active", true)
          .gte("lat", userPos.lat - delta).lte("lat", userPos.lat + delta)
          .gte("lng", userPos.lng - delta).lte("lng", userPos.lng + delta);

        if (search.trim()) query = query.ilike("name", `%${search.trim()}%`);

        const { data } = await query;
        const sorted = withDistances(data ?? []);

        const clinicIds = sorted.map((c) => c.clinic_id);
        const reports = clinicIds.length > 0
          ? await supabase.from("user_price_reports").select("clinic_id, extra_recommended").in("clinic_id", clinicIds).then(({ data }) => data ?? [])
          : [];

        const summaries = computeReportSummaries(reports as ReportRecord[]);
        setClinics(sorted.map((c) => ({ ...c, reportSummary: summaries.get(c.clinic_id) })));
        setLoading(false);
      } else {
        let query = supabase
          .from("clinics")
          .select("clinic_id, name, address, city, district, phone, lat, lng")
          .eq("is_active", true)
          .eq("city", city)
          .order("name")
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        if (district) query = query.eq("district", district);
        if (search.trim()) query = query.ilike("name", `%${search.trim()}%`);

        const { data } = await query;
        const clinicIds = (data ?? []).map((c) => c.clinic_id);
        const reports = clinicIds.length > 0
          ? await supabase.from("user_price_reports").select("clinic_id, extra_recommended").in("clinic_id", clinicIds).then(({ data }) => data ?? [])
          : [];

        const summaries = computeReportSummaries(reports as ReportRecord[]);
        setClinics((data ?? []).map((c) => ({ ...c, reportSummary: summaries.get(c.clinic_id) })));
        setLoading(false);
      }
    };

    loadClinics();
  }, [tab, userPos, city, district, search, page, priceReportOnly]);

  const pagedClinics = tab === "nearby" && !priceReportOnly
    ? clinics.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
    : clinics;

  return (
    <div>
      {/* 탭 */}
      <div className="flex rounded-xl bg-gray-100 p-1 mb-4">
        <button
          onClick={() => setTab("nearby")}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
            tab === "nearby" ? "bg-white shadow text-gray-900" : "text-gray-500"
          }`}
        >
          📍 내 위치 근처
        </button>
        <button
          onClick={() => setTab("region")}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
            tab === "region" ? "bg-white shadow text-gray-900" : "text-gray-500"
          }`}
        >
          🗺️ 지역으로 찾기
        </button>
      </div>

      {/* 지역 선택 */}
      {tab === "region" && (
        <div className="mb-4 flex gap-2">
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="flex-1 border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {CITIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            className="flex-1 border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">전체 구/군</option>
            {districts.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      )}

      {/* 내 위치 근처 지도 */}
      {tab === "nearby" && userPos && (
        <div className="mb-4">
          <NearbyMap
            userPos={userPos}
            clinics={clinics
              .filter((c) => c.lat != null && c.lng != null)
              .map((c) => ({
                clinic_id: c.clinic_id,
                name: c.name,
                lat: c.lat!,
                lng: c.lng!,
                color: getBadgeHex(c.reportSummary),
              }))}
            selectedId={selectedClinicId}
            onSelect={(id) => {
              setSelectedClinicId(id);
              document
                .getElementById(`clinic-${id}`)
                ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }}
          />
        </div>
      )}

      {/* 위치 오류 */}
      {tab === "nearby" && geoError && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4 text-sm text-yellow-800 space-y-2">
          <div>{geoError}</div>
          <div className="text-xs text-yellow-700">
            Safari 주소창 왼쪽 <strong>AA 버튼 → 웹사이트 설정 → 위치 → 물어보기</strong>로 변경 후 다시 시도하세요.
          </div>
          <div className="flex gap-3 pt-1">
            <button
              onClick={() => { setGeoError(null); }}
              className="underline font-medium"
            >
              다시 시도
            </button>
            <button
              onClick={() => setTab("region")}
              className="underline font-medium"
            >
              지역으로 찾기 →
            </button>
          </div>
        </div>
      )}

      {/* 위치 버튼 / 로딩 */}
      {tab === "nearby" && !userPos && !geoError && (
        <div className="flex flex-col items-center py-16 gap-4">
          <div className="text-gray-400 text-sm">내 주변 치과를 찾으려면 위치 권한이 필요합니다</div>
          <button
            onClick={requestLocation}
            disabled={geoLoading}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-xl transition disabled:opacity-50"
          >
            {geoLoading ? "위치를 가져오는 중..." : "📍 내 위치 사용하기"}
          </button>
        </div>
      )}

      {/* 검색 + 필터 */}
      {(tab === "region" || userPos) && (
        <div className="mb-4 space-y-2">
          {tab === "nearby" && userPos && (
            <div className="flex justify-end">
              <button
                onClick={requestLocation}
                disabled={geoLoading}
                className="text-xs text-gray-400 hover:text-blue-500 transition disabled:opacity-50"
              >
                {geoLoading ? "위치 가져오는 중..." : "📍 위치 새로고침"}
              </button>
            </div>
          )}
          <input
            type="text"
            placeholder="치과명으로 검색 (선택)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => setPriceReportOnly((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition ${
              priceReportOnly
                ? "bg-orange-500 text-white border-orange-500"
                : "bg-white text-orange-500 border-orange-300 hover:border-orange-500"
            }`}
          >
            <span>📋</span>
            <span>{priceReportOnly ? "제보 있는 곳만 ✕" : "제보 있는 곳만"}</span>
          </button>
        </div>
      )}

      {/* 목록 */}
      {loading ? (
        <div className="text-center text-gray-400 py-20">불러오는 중...</div>
      ) : pagedClinics.length === 0 && (tab === "region" || userPos) ? (
        <div className="text-center text-gray-400 py-20">검색 결과가 없습니다</div>
      ) : (
        <ul className="space-y-2">
          {pagedClinics.map((c) => {
            const badge = getReportBadge(c.reportSummary);
            return (
              <li key={c.clinic_id} id={`clinic-${c.clinic_id}`}>
                <Link
                  href={`/clinics/${c.clinic_id}`}
                  onClick={() => setSelectedClinicId(c.clinic_id)}
                  className={`flex justify-between items-start bg-white rounded-xl border px-4 py-3 hover:border-blue-400 hover:shadow-sm transition ${
                    selectedClinicId === c.clinic_id
                      ? "border-blue-400 shadow-sm bg-blue-50"
                      : "border-gray-200"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${badge.color}`} title={badge.label} />
                      <span className="font-semibold text-gray-900">{c.name}</span>
                      {c.reportSummary && c.reportSummary.count > 0 && (
                        <span className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded font-medium">제보 {c.reportSummary.count}건</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 mt-0.5 truncate">{c.address}</div>
                    {c.phone && (
                      <div className="text-sm text-gray-400 mt-0.5">{c.phone}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    {c.distance !== undefined && (
                      <div className="text-sm font-medium text-blue-500">
                        {c.distance < 1
                          ? `${Math.round(c.distance * 1000)}m`
                          : `${c.distance.toFixed(1)}km`}
                      </div>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {/* 페이지네이션 */}
      {pagedClinics.length > 0 && (
        <div className="flex justify-center gap-3 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-4 py-2 text-sm rounded-lg border border-gray-300 disabled:opacity-30 hover:bg-gray-100"
          >
            이전
          </button>
          <span className="px-4 py-2 text-sm text-gray-600">{page + 1}페이지</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={
              tab === "nearby"
                ? (page + 1) * PAGE_SIZE >= clinics.length
                : clinics.length < PAGE_SIZE
            }
            className="px-4 py-2 text-sm rounded-lg border border-gray-300 disabled:opacity-30 hover:bg-gray-100"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}
