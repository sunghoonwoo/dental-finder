"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

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
};

type Tab = "nearby" | "region";

const CITIES = ["서울", "경기"];
const PAGE_SIZE = 20;

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

  // 구/군 목록 로드
  useEffect(() => {
    supabase
      .from("clinics")
      .select("district")
      .eq("city", city)
      .order("district")
      .then(({ data }) => {
        const unique = [...new Set((data ?? []).map((r) => r.district))];
        setDistricts(unique);
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
        setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoLoading(false);
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
  }, [tab, city, district, search, userPos]);

  useEffect(() => {
    if (tab === "nearby" && !userPos) return;

    setLoading(true);

    if (tab === "nearby" && userPos) {
      // 반경 ~5km 바운딩 박스
      const delta = 0.045;
      let query = supabase
        .from("clinics")
        .select("clinic_id, name, address, city, district, phone, lat, lng")
        .gte("lat", userPos.lat - delta)
        .lte("lat", userPos.lat + delta)
        .gte("lng", userPos.lng - delta)
        .lte("lng", userPos.lng + delta);

      if (search.trim()) query = query.ilike("name", `%${search.trim()}%`);

      query.then(({ data }) => {
        const sorted = (data ?? [])
          .map((c) => ({
            ...c,
            distance:
              c.lat && c.lng
                ? calcDistance(userPos.lat, userPos.lng, c.lat, c.lng)
                : 999,
          }))
          .sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999));
        setClinics(sorted);
        setLoading(false);
      });
    } else {
      let query = supabase
        .from("clinics")
        .select("clinic_id, name, address, city, district, phone, lat, lng")
        .eq("city", city)
        .order("name")
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (district) query = query.eq("district", district);
      if (search.trim()) query = query.ilike("name", `%${search.trim()}%`);

      query.then(({ data }) => {
        setClinics(data ?? []);
        setLoading(false);
      });
    }
  }, [tab, userPos, city, district, search, page]);

  const pagedClinics = tab === "nearby" ? clinics.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE) : clinics;

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
        <div className="mb-4 space-y-3">
          <div className="flex gap-2">
            {CITIES.map((c) => (
              <button
                key={c}
                onClick={() => setCity(c)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
                  city === c
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setDistrict("")}
              className={`px-3 py-1.5 rounded-full text-sm border transition ${
                district === ""
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
              }`}
            >
              전체
            </button>
            {districts.map((d) => (
              <button
                key={d}
                onClick={() => setDistrict(d)}
                className={`px-3 py-1.5 rounded-full text-sm border transition ${
                  district === d
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
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

      {/* 검색 */}
      {(tab === "region" || userPos) && (
        <input
          type="text"
          placeholder="치과명으로 검색 (선택)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      )}

      {/* 목록 */}
      {loading ? (
        <div className="text-center text-gray-400 py-20">불러오는 중...</div>
      ) : pagedClinics.length === 0 && (tab === "region" || userPos) ? (
        <div className="text-center text-gray-400 py-20">검색 결과가 없습니다</div>
      ) : (
        <ul className="space-y-2">
          {pagedClinics.map((c) => (
            <li key={c.clinic_id}>
              <Link
                href={`/clinics/${c.clinic_id}`}
                className="flex justify-between items-start bg-white rounded-xl border border-gray-200 px-4 py-3 hover:border-blue-400 hover:shadow-sm transition"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-gray-900">{c.name}</div>
                  <div className="text-sm text-gray-500 mt-0.5 truncate">{c.address}</div>
                  {c.phone && (
                    <div className="text-sm text-gray-400 mt-0.5">{c.phone}</div>
                  )}
                </div>
                {c.distance !== undefined && (
                  <div className="text-sm font-medium text-blue-500 ml-3 shrink-0">
                    {c.distance < 1
                      ? `${Math.round(c.distance * 1000)}m`
                      : `${c.distance.toFixed(1)}km`}
                  </div>
                )}
              </Link>
            </li>
          ))}
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
