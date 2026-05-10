"use client";

import { useCallback } from "react";
import { getReportBadge, ReportSummary } from "@/lib/clinicUtils";

export type ClinicItem = {
  clinic_id: string;
  name: string;
  address: string;
  phone: string | null;
  distance?: number;
  reportSummary?: ReportSummary;
};

type Props = {
  clinics: ClinicItem[];
  loading: boolean;
  pagedClinics: ClinicItem[];
  page: number;
  totalClinics: number;
  onClinicClick: (id: string) => void;
  onPageChange: (newPage: number) => void;
  PAGE_SIZE: number;
};

export default function HospitalList({
  clinics, loading, pagedClinics, page, totalClinics, onClinicClick, onPageChange, PAGE_SIZE
}: Props) {
  const handlePrev = useCallback(() => {
    if (page > 0) onPageChange(page - 1);
  }, [page, onPageChange]);

  const handleNext = useCallback(() => {
    if (pagedClinics.length > 0) onPageChange(page + 1);
  }, [page, pagedClinics, onPageChange]);

  if (loading && pagedClinics.length === 0 && clinics.length === 0) {
    return null;
  }

  if (!loading && pagedClinics.length === 0 && clinics.length === 0) {
    return <div className="text-center text-[14px] text-gray-400 py-10">검색 결과가 없습니다</div>;
  }

  return (
    <>
      <ul className="space-y-4">
        {pagedClinics.map((c) => {
          const badge = getReportBadge(c.reportSummary);
          const honestyPct = c.reportSummary && c.reportSummary.count > 0 
            ? Math.round((c.reportSummary.noExtraCount / c.reportSummary.count) * 100)
            : null;
          return (
            <li key={c.clinic_id} id={`clinic-${c.clinic_id}`}>
              <div
                onClick={() => onClinicClick(c.clinic_id)}
                className="relative bg-white rounded-3xl overflow-hidden cursor-pointer active:scale-[0.98] transition-all duration-200"
                style={{boxShadow: '0 8px 30px rgba(0,0,0,0.04)'}}
              >
                {/* Left accent border - pastel color */}
                <div className={`absolute left-0 top-0 bottom-0 w-2.5 rounded-l-3xl ${(badge as any).accentColor || 'bg-gray-200'}`} />
                
                <div className="pl-5 pr-5 py-4">
                  {/* First row: Name (left) + Distance (right) - flex justify-between */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <span className="text-[18px] font-bold text-gray-900 truncate flex-1 min-w-0">{c.name}</span>
                    {c.distance !== undefined && (
                      <span className="text-[14px] font-bold text-[#3F51B5] bg-[#E8EAF6] px-3 py-1 rounded-full whitespace-nowrap flex-shrink-0">
                        {c.distance < 1
                          ? `${Math.round(c.distance * 1000)}m`
                          : `${c.distance.toFixed(1)}km`}
                      </span>
                    )}
                  </div>
                 
                  {/* Second row: Address + Phone */}
                  <div className="text-[14px] text-gray-500 truncate">{c.address}</div>
                  {c.phone && <div className="text-[14px] text-gray-400 mt-1 flex items-center gap-1">📞 {c.phone}</div>}
                  
                  {/* Third row: Badges (Honesty Score + Experience Count) - flex gap-2 */}
                  {(honestyPct !== null || (c.reportSummary && c.reportSummary.count > 0)) && (
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      {honestyPct !== null && (
                        <span className={`text-[14px] font-bold px-3 py-1 rounded-full ${
                          honestyPct >= 80 ? 'bg-[#E8F5E9] text-[#2E7D32]' :
                          honestyPct >= 50 ? 'bg-[#FFF3E0] text-[#E65100]' :
                          'bg-[#FFEBEE] text-[#C62828]'
                        }`}>
                          양심 지수 {honestyPct}%
                        </span>
                      )}
                      {honestyPct === null && (
                        <span className="text-[14px] font-medium px-3 py-1 rounded-full bg-gray-50 text-gray-400">
                          데이터 수집 중
                        </span>
                      )}
                      {c.reportSummary && c.reportSummary.count > 0 && (
                        <span className="text-[14px] font-medium bg-[#FFF3E0] text-[#E65100] px-2.5 py-1 rounded-full border border-orange-100/50">
                          📋 {c.reportSummary.count}건
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Pagination */}
      {pagedClinics.length > 0 && (
        <div className="flex justify-center gap-4 mt-8">
          <button
            onClick={handlePrev}
            disabled={page === 0}
            className="px-6 py-3 text-[14px] rounded-[32px] bg-white hover:shadow-lg disabled:opacity-30 active:bg-gray-50 font-medium transition-all duration-200 min-w-[100px]"
            style={{boxShadow: '0 4px 16px rgba(99,102,241,0.08)'}}
          >
            ← 이전
          </button>
          <span className="px-6 py-3 text-[14px] text-gray-500 font-medium">{page + 1}페이지</span>
          <button
            onClick={handleNext}
            disabled={totalClinics < PAGE_SIZE}
            className="px-6 py-3 text-[14px] rounded-[32px] bg-white hover:shadow-lg disabled:opacity-30 active:bg-gray-50 font-medium transition-all duration-200 min-w-[100px]"
            style={{boxShadow: '0 4px 16px rgba(99,102,241,0.08)'}}
          >
            다음 →
          </button>
        </div>
      )}
    </>
  );
}
