"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, ClinicDetail, UserReport } from "@/lib/api-client";
import KakaoMap from "@/components/KakaoMap";
import PriceReportForm, { ReportFormValues } from "@/components/PriceReportForm";
import { ChevronLeft } from "lucide-react";

const FRIENDLINESS_EMOJI = ["", "😠", "😕", "😐", "🙂", "😊"];

type PinState = { reportId: string; action: "edit" | "delete" };

export default function ClinicDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [clinic, setClinic] = useState<ClinicDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [editingReport, setEditingReport] = useState<ReportFormValues | null>(null);
  const [pinState, setPinState] = useState<PinState | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const [pinVerifying, setPinVerifying] = useState(false);

  async function loadData() {
    try {
      const data = await api.fetchClinic(id);
      setClinic(data);
    } catch (e) {
      console.error("[ClinicDetail] Failed to load:", e);
    }
    setLoading(false);
  }

  useEffect(() => { loadData(); }, [id]);

  function handleFormSuccess() {
    setShowForm(false);
    setEditingReport(null);
    setSubmitted(true);
    loadData();
  }

  async function openPinPrompt(reportId: string, action: "edit" | "delete") {
    if (action === "delete") {
      const { requiresPin } = await api.reportRequiresPin(reportId);
      if (!requiresPin) {
        await api.deleteReport(reportId, "");
        loadData();
        return;
      }
    }
    setPinState({ reportId, action });
    setPinInput("");
    setPinError(false);
  }

  async function handlePinSubmit() {
    if (!pinState || pinInput.length !== 4) return;
    setPinVerifying(true);
    setPinError(false);

    if (pinState.action === "delete") {
      const { ok } = await api.deleteReport(pinState.reportId, pinInput);
      if (!ok) { setPinError(true); setPinVerifying(false); return; }
      setPinState(null);
      setPinVerifying(false);
      loadData();
    } else {
      const { ok } = await api.verifyPin(pinState.reportId, pinInput);
      if (!ok) { setPinError(true); setPinVerifying(false); return; }
      const report = clinic?.userReports.find((r) => r.report_id === pinState.reportId);
      if (report) {
        setEditingReport({
          reportId: report.report_id,
          visitId: report.visit_id ?? undefined,
          treatmentId: report.treatment_id,
          price: report.price != null ? report.price.toLocaleString() : "",
          visitDate: report.visit_date ?? "",
          extraRecommended: report.extra_recommended,
          extraNote: report.extra_note ?? "",
          reviewText: report.review_text ?? "",
          friendlinessScore: report.friendliness_score,
          nickname: report.nickname ?? "",
        });
      }
      setPinState(null);
      setPinVerifying(false);
    }
  }

  if (loading) return <div className="text-center text-gray-400 py-20">불러오는 중...</div>;
  if (!clinic) return <div className="text-center text-gray-400 py-20">치과를 찾을 수 없습니다</div>;

  const userReports = clinic.userReports;
  const communityPrices = clinic.communityPrices;

  const visitGroups: Map<string, UserReport[]> = new Map();
  for (const r of userReports) {
    const key = r.visit_id ?? r.report_id;
    if (!visitGroups.has(key)) visitGroups.set(key, []);
    visitGroups.get(key)!.push(r);
  }
  const groupedVisits = [...visitGroups.values()];

  const totalReports = userReports.length;
  const noExtraTotal = userReports.filter((r) => !r.extra_recommended).length;
  const honestyPct = totalReports > 0 ? Math.round((noExtraTotal / totalReports) * 100) : null;
  const friendlinessScores = userReports.map((r) => r.friendliness_score).filter((s): s is number => s !== null);
  const avgFriendliness = friendlinessScores.length > 0
    ? Math.round((friendlinessScores.reduce((a, b) => a + b, 0) / friendlinessScores.length) * 10) / 10
    : null;

  return (
    <div>
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 px-4 py-2.5 rounded-xl transition mb-4 -ml-4"
      >
        <ChevronLeft size={20} strokeWidth={2.5} />
        뒤로가기
      </button>

      {clinic.lat && clinic.lng && (
        <div className="mb-4">
          <KakaoMap lat={clinic.lat} lng={clinic.lng} name={clinic.name} />
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <h1 className="text-xl font-bold text-gray-900">{clinic.name}</h1>
        <div className="text-sm text-gray-500 mt-1">{clinic.address}</div>
        {clinic.phone && (
          <a href={`tel:${clinic.phone}`} className="text-sm text-blue-500 mt-1 block">{clinic.phone}</a>
        )}
        <div className="text-xs text-gray-400 mt-1">{clinic.city} {clinic.district}</div>
        {clinic.lat && clinic.lng && (
          <a
            href={`https://map.kakao.com/link/map/${encodeURIComponent(clinic.name)},${clinic.lat},${clinic.lng}`}
            target="_blank" rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-sm bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-medium px-3 py-1.5 rounded-lg transition"
          >
            🗺️ 카카오맵에서 길찾기
          </a>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900">
            가격 & 경험 제보
            {groupedVisits.length > 0 && <span className="ml-2 text-sm font-normal text-gray-400">{groupedVisits.length}건</span>}
          </h2>
          <div className="flex items-center gap-2">
            {avgFriendliness !== null && (
              <span className="text-sm font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">
                {FRIENDLINESS_EMOJI[Math.round(avgFriendliness)]} 친절도 {avgFriendliness}
              </span>
            )}
            {honestyPct !== null && (
              <span className={`text-sm font-bold px-2.5 py-1 rounded-full ${
                honestyPct >= 80 ? "bg-green-500 text-white"
                  : honestyPct >= 50 ? "bg-orange-400 text-white"
                  : "bg-red-500 text-white"
              }`}>
                양심 지수 {honestyPct}%
              </span>
            )}
            {honestyPct === null && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-400">
                데이터 수집 중
              </span>
            )}
          </div>
        </div>

        {groupedVisits.length > 0 && (
          <ul className="space-y-2 mb-4">
            {groupedVisits.map((group) => {
              const first = group[0];
              const groupKey = first.visit_id ?? first.report_id;
              const treatments = group.map((r) => r.treatment_name).join(", ");
              const isEditing = editingReport?.reportId === first.report_id;
              const isPinTarget = pinState?.reportId === first.report_id;

              return (
                <li key={groupKey} className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm">
                  {isEditing ? (
                    <PriceReportForm
                      clinicId={clinic.clinic_id}
                      initialValues={editingReport}
                      onSuccess={handleFormSuccess}
                      onCancel={() => setEditingReport(null)}
                    />
                  ) : isPinTarget ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-700">
                        {pinState.action === "edit" ? "수정하려면" : "삭제하려면"} 비번 4자리를 입력하세요
                      </p>
                      <input
                        type="password"
                        inputMode="numeric"
                        value={pinInput}
                        onChange={(e) => { setPinInput(e.target.value.replace(/[^0-9]/g, "").slice(0, 4)); setPinError(false); }}
                        placeholder="숫자 4자리"
                        maxLength={4}
                        autoFocus
                        className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {pinError && <p className="text-xs text-red-500">비번이 틀렸습니다</p>}
                      <div className="flex gap-2">
                        <button onClick={() => setPinState(null)} className="flex-1 border border-gray-300 text-gray-600 text-sm font-medium py-2 rounded-xl hover:bg-gray-100 transition">취소</button>
                        <button
                          onClick={handlePinSubmit}
                          disabled={pinInput.length !== 4 || pinVerifying}
                          className={`flex-1 text-sm font-medium py-2 rounded-xl transition disabled:opacity-50 ${pinState.action === "delete" ? "bg-red-500 hover:bg-red-600 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"}`}
                        >
                          {pinVerifying ? "확인 중..." : pinState.action === "delete" ? "삭제" : "확인"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-800">{treatments}</span>
                          {first.price != null && <span className="text-blue-600 font-semibold">{first.price.toLocaleString()}원</span>}
                          {first.extra_recommended
                            ? <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded">추가권유 있음</span>
                            : <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">추가권유 없음</span>
                          }
                          {first.friendliness_score != null && (
                            <span className="text-xs text-gray-500">{FRIENDLINESS_EMOJI[first.friendliness_score]} {first.friendliness_score}점</span>
                          )}
                        </div>
                        {first.extra_note && <div className="text-xs text-gray-500">💬 권유내용: {first.extra_note}</div>}
                        {first.review_text && <div className="text-xs text-gray-600 mt-1 leading-relaxed">&ldquo;{first.review_text}&rdquo;</div>}
                        <div className="text-xs text-gray-400">
                          {first.nickname ?? "익명"}
                          {first.visit_date && ` · 진료 ${new Date(first.visit_date).toLocaleDateString("ko-KR")}`}
                          {` · 제보 ${new Date(first.created_at).toLocaleDateString("ko-KR")}`}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => openPinPrompt(first.report_id, "edit")} className="text-xs text-blue-500 hover:text-blue-700 px-2 py-1 rounded border border-blue-200 hover:border-blue-400 transition">수정</button>
                        <button onClick={() => openPinPrompt(first.report_id, "delete")} className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded border border-red-200 hover:border-red-400 transition">삭제</button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {!userReports.length && !showForm && (
          <p className="text-sm text-gray-400 text-center py-4 mb-4">
            아직 제보가 없습니다. 첫 번째 제보자가 되어보세요!
          </p>
        )}

        {submitted && (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3 mb-4">
            제보해 주셔서 감사합니다! 다른 분들께 큰 도움이 됩니다.
          </div>
        )}

        {showForm ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">경험 제보하기</h3>
              <button onClick={() => setShowForm(false)} className="text-sm text-gray-400 hover:text-gray-600">닫기</button>
            </div>
            <PriceReportForm clinicId={clinic.clinic_id} onSuccess={handleFormSuccess} />
          </div>
        ) : (
          !editingReport && (
            <button
              onClick={() => { setShowForm(true); setSubmitted(false); }}
              className="w-full border-2 border-dashed border-blue-300 hover:border-blue-500 text-blue-500 hover:text-blue-600 font-medium py-3 rounded-xl text-sm transition"
            >
              + 내 경험 제보하기
            </button>
          )
        )}
      </div>

      {communityPrices.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-bold text-gray-900 mb-3">
            가격 정보 <span className="ml-2 text-sm font-normal text-gray-400">커뮤니티 수집</span>
          </h2>
          <ul className="divide-y divide-gray-100">
            {communityPrices.map((p) => (
              <li key={p.report_id} className="py-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium text-gray-900">{p.treatment_name}</div>
                    {p.raw_text && <div className="text-sm text-gray-500 mt-0.5 line-clamp-2">{p.raw_text}</div>}
                    <div className="text-xs text-gray-400 mt-1">
                      {p.post_date && new Date(p.post_date).toLocaleDateString("ko-KR")}
                      {p.post_url && <> · <a href={p.post_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">출처</a></>}
                    </div>
                  </div>
                  <div className="text-lg font-bold text-blue-600 ml-4 shrink-0">{p.price.toLocaleString()}원</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
