"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import NearbyMap from "@/components/NearbyMap";
import { useClinics } from "@/hooks/useClinics";
import { getReportBadge, getBadgeHex } from "@/lib/clinicUtils";

type Tab = "nearby" | "region";

const CITIES = ["전국", "서울", "경기", "부산", "인천", "대구", "광주", "대전", "울산", "세종", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"];
const PAGE_SIZE = 20;
const LOCATION_CACHE_KEY = "dental_user_location";
const LOCATION_CACHE_TTL = 24 * 60 * 60 * 1000;

function ClinicsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>(() => (searchParams.get("tab") as Tab) || "nearby");
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [city, setCity] = useState(() => searchParams.get("city") || "전국");
  const [district, setDistrict] = useState(() => searchParams.get("district") || "");
  const [districts, setDistricts] = useState<string[]>([]);

  // URL에서 검색어 읽기 (새로고침 시 유지)
  const [search, setSearch] = useState(() => searchParams.get("q") || "");
  const [inputValue, setInputValue] = useState(() => searchParams.get("q") || "");

  const [priceReportOnly, setPriceReportOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [mapBounds, setMapBounds] = useState<{ sw: { lat: number; lng: number }; ne: { lat: number; lng: number } } | null>(null);

  const handleBoundsChanged = useCallback((bounds: { sw: { lat: number; lng: number }; ne: { lat: number; lng: number } }) => {
    setMapBounds(bounds);
  }, []);

  // "전국" 선택 시 city 값을 빈 문자열로 처리
  const effectiveCity = city === "전국" ? "" : city;

  const { clinics, loading, pagedClinics } = useClinics({
    tab, userPos, city: effectiveCity, district, search, page, priceReportOnly, bounds: tab === "nearby" ? mapBounds : null
  });

  // URL 쿼리 동기화 (뒤로가기/앞으로가기 지원)
  useEffect(() => {
    const q = searchParams.get("q") || "";
    const cityParam = searchParams.get("city") || "전국";
    const districtParam = searchParams.get("district") || "";
    const tabParam = (searchParams.get("tab") as Tab) || "nearby";

    if (q !== search) setSearch(q);
    if (q !== inputValue) setInputValue(q);
    if (cityParam !== city) setCity(cityParam);
    if (districtParam !== district) setDistrict(districtParam);
    if (tabParam !== tab) setTab(tabParam);
  }, [searchParams]);

  // 검색어 디바운스 (입력 후 300ms 뒤에 반영)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputValue !== search) {
        setSearch(inputValue);
        const params = new URLSearchParams(searchParams.toString());
        if (inputValue) {
          params.set("q", inputValue);
        } else {
          params.delete("q");
        }
        params.delete("page");
        router.replace(`/clinics?${params.toString()}`, { scroll: false });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue]);

  // 캐시된 위치 복원
  useEffect(() => {
    try {
      const cached = localStorage.getItem(LOCATION_CACHE_KEY);
      if (cached) {
        const { lat, lng, ts } = JSON.parse(cached);
        if (Date.now() - ts < LOCATION_CACHE_TTL) setUserPos({ lat, lng });
      }
    } catch {}
  }, []);

  // 구/군 목록 로드 ("전국"일 때는 빈 배열)
  useEffect(() => {
    if (city === "전국") {
      setDistricts([]);
      setDistrict("");
      return;
    }
    supabase
      .rpc("get_districts", { p_city: city })
      .then(({ data }) => {
        setDistricts((data ?? []).map((r: { district: string }) => r.district));
        if (!districts.includes(district)) setDistrict("");
      });
  }, [city]);

  // 페이지 리셋
  useEffect(() => { setPage(0); }, [tab, city, district, search, userPos, priceReportOnly]);

  function requestLocation() {
    if (!navigator.geolocation) { setGeoError("이 브라우저는 위치 서비스를 지원하지 않습니다"); return; }
    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserPos(location);
        setGeoLoading(false);
        try { localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify({ ...location, ts: Date.now() })); } catch {}
      },
      () => { setGeoError("위치 권한이 거부됐습니다. 지역으로 찾기를 이용해주세요."); setGeoLoading(false); }
    );
  }

  const handleClinicClick = useCallback((clinicId: string) => {
    router.push(`/clinics/${clinicId}`);
  }, [router]);

  // 탭/지역 변경 시 URL 업데이트
  const updateURL = useCallback((params: Record<string, string>) => {
    const newParams = new URLSearchParams(searchParams.toString());
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        newParams.set(key, value);
      } else {
        newParams.delete(key);
      }
    });
    router.replace(`/clinics?${newParams.toString()}`, { scroll: false });
  }, [searchParams, router]);

  return (
    <div>
      {/* 탭 */}
      <div className="flex rounded-xl bg-gray-100 p-1 mb-4">
        {(["nearby", "region"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              updateURL({ tab: t, page: "" });
            }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${tab === t ? "bg-white shadow text-gray-900" : "text-gray-500"}`}
          >
            {t === "nearby" ? "📍 내 위치 근처" : "🗺️ 지역으로 찾기"}
          </button>
        ))}
      </div>

      {/* 지역 선택 */}
      {tab === "region" && (
        <div className="mb-4 flex gap-2">
          <select
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              updateURL({ city: e.target.value, district: "", page: "" });
            }}
            className="flex-1 border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {city !== "전국" && (
            <select
              value={district}
              onChange={(e) => {
                setDistrict(e.target.value);
                updateURL({ district: e.target.value, page: "" });
              }}
              className="flex-1 border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">전체 구/군</option>
              {districts.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
        </div>
      )}

      {/* 지도 - userPos가 있을 때만 표시, NearbyMap 컴포넌트 수정 필요 */}
      {tab === "nearby" && userPos && (
        <div className="mb-4">
          <NearbyMap
            userPos={userPos}
            clinics={clinics.filter((c) => c.lat != null && c.lng != null).map((c) => ({
              clinic_id: c.clinic_id, name: c.name, lat: c.lat!, lng: c.lng!,
              color: getBadgeHex(c.reportSummary),
            }))}
            selectedId={null}
            onSelect={(id) => handleClinicClick(id)}
          />
        </div>
      )}

      {/* 위치 오류 */}
      {tab === "nearby" && geoError && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4 text-sm text-yellow-800 space-y-2">
          <div>{geoError}</div>
          <div className="text-xs text-yellow-700">Safari 주소창 왼쪽 <strong>AA 버튼 → 웹사이트 설정 → 위치 → 물어보기</strong>로 변경 후 다시 시도하세요.</div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setGeoError(null)} className="underline font-medium">다시 시도</button>
            <button onClick={() => { setTab("region"); updateURL({ tab: "region" }); }} className="underline font-medium">지역으로 찾기 →</button>
          </div>
        </div>
      )}

      {/* 위치 버튼 */}
      {tab === "nearby" && !userPos && !geoError && (
        <div className="flex flex-col items-center py-16 gap-4">
          <div className="text-gray-400 text-sm">내 주변 치과를 찾으려면 위치 권한이 필요합니다</div>
          <button onClick={requestLocation} disabled={geoLoading} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-xl transition disabled:opacity-50">
            {geoLoading ? "위치를 가져오는 중..." : "📍 내 위치 사용하기"}
          </button>
        </div>
      )}

      {/* 검색 + 필터 */}
      {(tab === "region" || userPos) && (
        <div className="mb-4 space-y-2">
          {tab === "nearby" && userPos && (
            <div className="flex justify-end">
              <button onClick={requestLocation} disabled={geoLoading} className="text-xs text-gray-400 hover:text-blue-500 transition disabled:opacity-50">
                {geoLoading ? "위치 가져오는 중..." : "📍 위치 새로고침"}
              </button>
            </div>
          )}
          <input
            type="text"
            placeholder="치과명으로 검색 (선택)"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => setPriceReportOnly((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition ${priceReportOnly ? "bg-orange-500 text-white border-orange-500" : "bg-white text-orange-500 border-orange-300 hover:border-orange-500"}`}
          >
            <span>📋</span><span>{priceReportOnly ? "제보 있는 곳만 ✕" : "제보 있는 곳만"}</span>
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
                <div
                  onClick={() => handleClinicClick(c.clinic_id)}
                  className="flex justify-between items-start bg-white rounded-xl border px-4 py-3 hover:border-blue-400 hover:shadow-sm transition cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {badge.color && <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${badge.color}`} title={badge.label} />}
                      <span className="font-semibold text-gray-900">{c.name}</span>
                      {c.reportSummary && c.reportSummary.count > 0 && (
                        <span className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded font-medium">제보 {c.reportSummary.count}건</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 mt-0.5 truncate">{c.address}</div>
                    {c.phone && <div className="text-sm text-gray-400 mt-0.5">{c.phone}</div>}
                  </div>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    {c.distance !== undefined && (
                      <div className="text-sm font-medium text-blue-500">
                        {c.distance < 1 ? `${Math.round(c.distance * 1000)}m` : `${c.distance.toFixed(1)}km`}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* 페이지네이션 */}
      {pagedClinics.length > 0 && (
        <div className="flex justify-center gap-3 mt-6">
          <button onClick={() => { setPage((p) => Math.max(0, p - 1)); updateURL({ page: (page - 1).toString() }); }} disabled={page === 0} className="px-4 py-2 text-sm rounded-lg border border-gray-300 disabled:opacity-30 hover:bg-gray-100">이전</button>
          <span className="px-4 py-2 text-sm text-gray-600">{page + 1}페이지</span>
          <button
            onClick={() => { setPage((p) => p + 1); updateURL({ page: (page + 1).toString() }); }}
            disabled={tab === "nearby" ? (page + 1) * PAGE_SIZE >= clinics.length : clinics.length < PAGE_SIZE}
            className="px-4 py-2 text-sm rounded-lg border border-gray-300 disabled:opacity-30 hover:bg-gray-100"
          >다음</button>
        </div>
      )}
    </div>
  );
}

export default function ClinicsPage() {
  return (
    <Suspense fallback={<div className="text-center text-gray-400 py-20">불러오는 중...</div>}>
      <ClinicsPageContent />
    </Suspense>
  );
}
