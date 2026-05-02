"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Clinic = {
  clinic_id: string;
  name: string;
  address: string;
  city: string;
  district: string;
  phone: string | null;
};

type PriceReport = {
  report_id: string;
  treatment_name: string;
  price: number;
  note: string | null;
  source_url: string | null;
  reported_at: string;
};

export default function ClinicDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [prices, setPrices] = useState<PriceReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from("clinics").select("*").eq("clinic_id", id).single(),
      supabase
        .from("price_reports")
        .select("report_id, treatment_name, price, note, source_url, reported_at")
        .eq("clinic_id", id)
        .order("reported_at", { ascending: false }),
    ]).then(([{ data: c }, { data: p }]) => {
      setClinic(c);
      setPrices(p ?? []);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <div className="text-center text-gray-400 py-20">불러오는 중...</div>;
  if (!clinic) return <div className="text-center text-gray-400 py-20">치과를 찾을 수 없습니다</div>;

  return (
    <div>
      <button
        onClick={() => router.back()}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1"
      >
        ← 목록으로
      </button>

      {/* 치과 기본 정보 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <h1 className="text-xl font-bold text-gray-900">{clinic.name}</h1>
        <div className="text-sm text-gray-500 mt-1">{clinic.address}</div>
        {clinic.phone && (
          <a href={`tel:${clinic.phone}`} className="text-sm text-blue-500 mt-1 block">
            {clinic.phone}
          </a>
        )}
        <div className="text-xs text-gray-400 mt-1">
          {clinic.city} {clinic.district}
        </div>
      </div>

      {/* 가격 정보 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-bold text-gray-900 mb-3">
          가격 정보
          <span className="ml-2 text-sm font-normal text-gray-400">커뮤니티 제보</span>
        </h2>
        {prices.length === 0 ? (
          <div className="text-sm text-gray-400 py-4 text-center">
            아직 가격 정보가 없습니다
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {prices.map((p) => (
              <li key={p.report_id} className="py-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium text-gray-900">{p.treatment_name}</div>
                    {p.note && (
                      <div className="text-sm text-gray-500 mt-0.5">{p.note}</div>
                    )}
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(p.reported_at).toLocaleDateString("ko-KR")}
                      {p.source_url && (
                        <>
                          {" · "}
                          <a
                            href={p.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:underline"
                          >
                            출처
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-lg font-bold text-blue-600 ml-4 shrink-0">
                    {p.price.toLocaleString()}원
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
