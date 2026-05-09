"use client";

type Props = {
  onSearchNearMe: () => void;
  onSearchInThisArea: () => void;
  geoLoading: boolean;
};

export default function SearchButtons({ onSearchNearMe, onSearchInThisArea, geoLoading }: Props) {
  return (
    <div className="flex justify-center gap-3">
      <button
        type="button"
        onClick={onSearchNearMe}
        disabled={geoLoading}
        className="flex items-center gap-2 px-5 py-2.5 text-sm bg-gradient-to-r from-[#818CF8] to-[#6366F1] hover:from-[#6366F1] hover:to-[#4F46E5] text-white font-semibold rounded-[40px] transition disabled:opacity-50 whitespace-nowrap"
        style={{boxShadow: '0 4px 20px rgba(99,102,241,0.3)'}}
      >
        {geoLoading ? "위치 중..." : "내 위치"}
      </button>
      <button
        type="button"
        onClick={onSearchInThisArea}
        className="flex items-center gap-2 px-5 py-2.5 text-sm bg-white hover:bg-gray-50 text-[#6366F1] font-semibold rounded-[40px] transition whitespace-nowrap"
        style={{boxShadow: '0 4px 20px rgba(99,102,241,0.08)'}}
      >
        이 지역
      </button>
    </div>
  );
}
