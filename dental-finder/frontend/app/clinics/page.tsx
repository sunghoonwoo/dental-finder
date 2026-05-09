"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback, Suspense, useRef } from "react";
import { api } from "@/lib/api-client";
import NearbyMap, { NearbyMapHandle } from "@/components/NearbyMap";
import { useClinics } from "@/hooks/useClinics";
import { getBadgeHex } from "@/lib/clinicUtils";
import HospitalList from "@/components/HospitalList";

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

  const [search, setSearch] = useState(() => searchParams.get("q") || "");
  const [inputValue, setInputValue] = useState(() => searchParams.get("q") || "");

  const [priceReportOnly, setPriceReportOnly] = useState(() => searchParams.get("reportOnly") === "true");
  const [page, setPage] = useState(0);
  const [mapBounds, setMapBounds] = useState<{ sw: { lat: number; lng: number }; ne: { lat: number; lng: number } } | null>(null);

  // Sync map bounds whenever map moves
  const handleBoundsChange = useCallback((bounds: { sw: { lat: number; lng: number }; ne: { lat: number; lng: number } }) => {
    setMapBounds(bounds);
  }, []);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const mapRef = useRef<NearbyMapHandle>(null);

  const effectiveCity = city === "전국" ? "" : city;

  const { clinics, loading, pagedClinics } = useClinics({
    tab, userPos, city: effectiveCity, district, search, page, priceReportOnly, bounds: tab === "nearby" ? mapBounds : null
  });

  // URL 동기화
  useEffect(() => {
    const q = searchParams.get("q") || "";
    const cityParam = searchParams.get("city") || "전국";
    const districtParam = searchParams.get("district") || "";
    const tabParam = (searchParams.get("tab") as Tab) || "nearby";
    const reportOnlyParam = searchParams.get("reportOnly") === "true";

    if (q !== search) setSearch(q);
    if (q !== inputValue) setInputValue(q);
    if (cityParam !== city) {
      setCity(cityParam);
      if (cityParam === "전국") setDistrict("");
    }
    if (districtParam !== district) setDistrict(districtParam);
    if (tabParam !== tab) setTab(tabParam);
    if (reportOnlyParam !== priceReportOnly) setPriceReportOnly(reportOnlyParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // 검색어 디바운스
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
  }, [inputValue, search, searchParams, router]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 구/군 목록
  useEffect(() => {
    if (city === "전국") {
      setDistricts([]);
      setDistrict("");
      return;
    }
    api.fetchDistricts(city).then(setDistricts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city]);

  useEffect(() => { setPage(0); }, [tab, city, district, search, userPos, priceReportOnly]);

  // Search Near Me
  const handleSearchNearMe = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError("이 브라우저는 위치 서비스를 지원하지 않습니다");
      return;
    }
    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        // Update userPos but DON'T reset mapBounds - keep current map view
        setUserPos(location);
        setGeoLoading(false);
        try { localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify({ ...location, ts: Date.now() })); } catch {}
        setTimeout(() => {
          if (mapRef.current) {
            mapRef.current.panTo(location.lat, location.lng);
            // Update mapBounds after panning to new location
            const bounds = mapRef.current.getBounds();
            if (bounds) setMapBounds(bounds);
          }
        }, 100);
      },
      () => {
        setGeoError("위치 권한이 거부됐습니다.");
        setGeoLoading(false);
      }
    );
  }, []);

  // Search in this Area
  function handleSearchInThisArea() {
    const map = mapRef.current;
    if (!map) return;
    const bounds = map.getBounds();
    if (bounds) {
      setMapBounds(bounds);
    } else {
      const center = map.getCenter();
      if (center) {
        const delta = 0.045;
        setMapBounds({
          sw: { lat: center.lat - delta, lng: center.lng - delta },
          ne: { lat: center.lat + delta, lng: center.lng + delta },
        });
      }
    }
  }

  const handleClinicClick = useCallback((clinicId: string) => {
    router.push(`/clinics/${clinicId}`);
  }, [router]);

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
    <div className="px-4 md:px-8">
      {/* 탭 */}
      <div className="flex rounded-[40px] bg-white p-1 mb-6" style={{boxShadow: '0 4px 20px rgba(99,102,241,0.08)'}}>
        {(["nearby", "region"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              updateURL({ tab: t, page: "" });
            }}
            className={`flex-1 py-3 rounded-[36px] text-sm font-semibold transition-all duration-200 ${
              tab === t 
                ? "bg-gradient-to-r from-[#818CF8] to-[#6366F1] text-white shadow-lg shadow-indigo-200/50" 
                : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            {t === "nearby" ? "내 위치" : "지역검색"}
          </button>
        ))}
      </div>

      {/* 지역 선택 (region 탭) */}
      {tab === "region" && (
        <div className="mb-4 flex gap-3">
          <select
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              updateURL({ city: e.target.value, district: "", page: "" });
            }}
            className="flex-1 border-0 bg-white rounded-[40px] px-5 py-3 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#818CF8]"
            style={{boxShadow: '0 4px 20px rgba(99,102,241,0.08)'}}
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
              className="flex-1 border-0 bg-white rounded-[40px] px-5 py-3 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#818CF8]"
              style={{boxShadow: '0 4px 20px rgba(99,102,241,0.08)'}}
            >
              <option value="">전체 구/군</option>
              {districts.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
        </div>
      )}

      {/* 위치 오류 */}
      {tab === "nearby" && geoError && (
        <div className="bg-yellow-50/90 backdrop-blur-sm border border-yellow-200 rounded-[40px] p-4 mb-4 text-sm text-yellow-800 space-y-2">
          <div className="font-medium">{geoError}</div>
          <div className="text-xs text-yellow-600">Safari <strong>AA → 웹사이트 설정 → 위치 → 물어보기</strong></div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setGeoError(null)} className="underline font-medium text-sm">다시 시도</button>
            <button onClick={() => { setTab("region"); updateURL({ tab: "region" }); }} className="underline font-medium text-sm">지역으로 찾기 →</button>
          </div>
        </div>
      )}

      {/* 위치 버튼 (nearby탭, 위치 없음) */}
      {tab === "nearby" && !userPos && !geoError && (
        <div className="flex flex-col items-center py-16 gap-4">
          <div className="text-gray-400 text-sm font-medium">내 주변 치과를 찾으려면 위치 권한이 필요합니다</div>
          <button onClick={handleSearchNearMe} disabled={geoLoading} className="flex items-center gap-2 bg-gradient-to-r from-[#818CF8] to-[#6366F1] hover:from-[#6366F1] hover:to-[#4F46E5] text-white font-semibold px-8 py-3.5 rounded-[40px] text-sm transition disabled:opacity-50 whitespace-nowrap"
            style={{boxShadow: '0 8px 25px rgba(99,102,241,0.25)'}}
          >
            {geoLoading ? "위치를 가져오는 중..." : "내 위치 사용하기"}
          </button>
        </div>
      )}

      {/* 지도 + 통합 검색 버튼 (nearby탭, 위치 있음) */}
      {tab === "nearby" && userPos && (
        <div className="mb-6 relative" style={{ height: '35vh' }}>
          <div className="rounded-[32px] overflow-hidden h-full" style={{boxShadow: '0 8px 30px rgba(0,0,0,0.04)'}}>
            <NearbyMap
              ref={mapRef}
              userPos={userPos}
              clinics={clinics.filter((c) => c.lat != null && c.lng != null).map((c) => ({
                clinic_id: c.clinic_id, name: c.name, lat: c.lat!, lng: c.lng!,
                color: getBadgeHex(c.reportSummary),
              }))}
              selectedId={selectedMarkerId}
              onSelect={(id) => setSelectedMarkerId((prev) => prev === id ? null : id)}
              onDoubleClick={(id) => router.push(`/clinics/${id}`)}
              onBoundsChange={handleBoundsChange}
            />
          </div>
          {/* 통합 검색 버튼 - 지도 위에 고정 */}
          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-50 pointer-events-none">
            <div className="pointer-events-auto">
              <button
                onClick={handleSearchNearMe}
                disabled={geoLoading}
                className="flex items-center gap-1.5 px-3 sm:px-5 py-2.5 bg-white/95 backdrop-blur-md text-[#6366F1] font-semibold rounded-[32px] text-xs hover:bg-white transition-all duration-200 whitespace-nowrap"
                style={{boxShadow: '0 4px 20px rgba(99,102,241,0.15)'}}
              >
                {geoLoading ? "위치 중..." : "내 위치"}
              </button>
            </div>
            <div className="pointer-events-auto">
              <button
                onClick={handleSearchInThisArea}
                className="flex items-center gap-1.5 px-3 sm:px-5 py-2.5 bg-white/95 backdrop-blur-md text-[#6366F1] font-semibold rounded-[32px] text-xs hover:bg-white transition-all duration-200 whitespace-nowrap"
                style={{boxShadow: '0 4px 20px rgba(99,102,241,0.15)'}}
              >
                이 지역
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 검색 + 필터 */}
      {(tab === "region" || (tab === "nearby" && userPos)) && (
        <div className="mb-4 space-y-3">
          <div className="flex flex-row items-center gap-2 w-full max-w-full overflow-hidden">
            <input
              type="text"
              placeholder="검색"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="flex-1 min-w-0 h-11 px-3 py-2 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm"
            />
            <button
              onClick={() => {
                const newValue = !priceReportOnly;
                setPriceReportOnly(newValue);
                updateURL({ reportOnly: newValue ? "true" : "", page: "" });
              }}
              className={`shrink-0 h-11 px-3 rounded-xl font-bold text-sm transition-all shadow-md flex items-center justify-center ${
                priceReportOnly 
                  ? "bg-[#FF9800] text-white" 
                  : "bg-white text-[#FF9800] hover:bg-orange-50"
              }`}
            >
              {priceReportOnly ? "경험 공유 ✕" : "경험 공유"}
            </button>
          </div>
        </div>
      )}

      {/* 병원 목록 */}
      {tab === "nearby" && userPos && (
        <HospitalList
          clinics={clinics}
          loading={loading}
          pagedClinics={pagedClinics}
          page={page}
          totalClinics={clinics.length}
          onClinicClick={(id) => router.push(`/clinics/${id}`)}
          onPageChange={(newPage) => {
            setPage(newPage);
            updateURL({ page: newPage.toString() });
          }}
          PAGE_SIZE={PAGE_SIZE}
        />
      )}

      {/* 지역 모드 목록 */}
      {tab === "region" && (
        <HospitalList
          clinics={clinics}
          loading={loading}
          pagedClinics={pagedClinics}
          page={page}
          totalClinics={clinics.length}
          onClinicClick={(id) => router.push(`/clinics/${id}`)}
          onPageChange={(newPage) => {
            setPage(newPage);
            updateURL({ page: newPage.toString() });
          }}
          PAGE_SIZE={PAGE_SIZE}
        />
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
