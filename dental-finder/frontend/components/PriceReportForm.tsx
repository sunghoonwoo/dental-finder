"use client";

import { useState, useEffect } from "react";
import { api, TreatmentType } from "@/lib/api-client";

export type ReportFormValues = {
  reportId?: string;
  visitId?: string;
  treatmentId: number;
  price: string;
  visitDate: string;
  extraRecommended: boolean | null;
  extraNote: string;
  reviewText: string;
  friendlinessScore: number | null;
  nickname: string;
  consultationType: string;
  overtreatmentOtherTeeth: boolean | null;
  overtreatmentDiscountPressure: boolean | null;
  consultationTime: string;
  tags: string[];
  receiptImageUrl: string;
};

type Props = {
  clinicId: string;
  initialValues?: ReportFormValues;
  onSuccess: (reportIds: string[]) => void;
  onCancel?: () => void;
};

const FRIENDLINESS_OPTIONS = [
  { score: 5, label: "매우 친절", emoji: "😊" },
  { score: 4, label: "친절",     emoji: "🙂" },
  { score: 3, label: "보통",     emoji: "😐" },
  { score: 2, label: "불친절",   emoji: "😕" },
  { score: 1, label: "매우 불친절", emoji: "😠" },
];

const CONSULTATION_OPTIONS = [
  { value: "doctor", label: "의사" },
  { value: "coordinator", label: "코디네이터" },
  { value: "both", label: "둘 다" },
];

const CONSULTATION_TIME_OPTIONS = [
  { value: "under_5", label: "5분 미만" },
  { value: "5_to_10", label: "5~10분" },
  { value: "over_10", label: "10분 초과" },
];

const TAG_OPTIONS = [
  { value: "HonestDiagnosis", label: "#정직한진단" },
  { value: "NoPressure", label: "#압박없음" },
  { value: "DetailedExplanation", label: "#상세설명" },
  { value: "DoctorLed", label: "#의사직접" },
];

const INPUT_CLS = "w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 font-medium placeholder:text-gray-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-500";

export default function PriceReportForm({ clinicId, initialValues, onSuccess, onCancel }: Props) {
  const isEdit = !!initialValues?.reportId;

  const [treatments, setTreatments] = useState<TreatmentType[]>([]);
  const [treatmentIds, setTreatmentIds] = useState<number[]>(
    initialValues?.treatmentId ? [initialValues.treatmentId] : []
  );
  const [price, setPrice] = useState(initialValues?.price ?? "");
  const [visitDate, setVisitDate] = useState(initialValues?.visitDate ?? "");
  const [extraRecommended, setExtraRecommended] = useState<boolean | null>(initialValues?.extraRecommended ?? null);
  const [extraNote, setExtraNote] = useState(initialValues?.extraNote ?? "");
  const [reviewText, setReviewText] = useState(initialValues?.reviewText ?? "");
  const [friendlinessScore, setFriendlinessScore] = useState<number | null>(initialValues?.friendlinessScore ?? null);
  const [nickname, setNickname] = useState(initialValues?.nickname ?? "");
  const [consultationType, setConsultationType] = useState(initialValues?.consultationType ?? "");
  const [overtreatmentOtherTeeth, setOvertreatmentOtherTeeth] = useState<boolean | null>(initialValues?.overtreatmentOtherTeeth ?? null);
  const [overtreatmentDiscountPressure, setOvertreatmentDiscountPressure] = useState<boolean | null>(initialValues?.overtreatmentDiscountPressure ?? null);
  const [consultationTime, setConsultationTime] = useState(initialValues?.consultationTime ?? "");
  const [tags, setTags] = useState<string[]>(initialValues?.tags ?? []);
  const [receiptImageUrl, setReceiptImageUrl] = useState(initialValues?.receiptImageUrl ?? "");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.fetchTreatments().then(setTreatments).catch(() => {});
  }, []);

  function handlePriceChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/[^0-9]/g, "");
    setPrice(digits ? parseInt(digits).toLocaleString() : "");
  }

  function handlePinChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPin(e.target.value.replace(/[^0-9]/g, "").slice(0, 4));
  }

  function toggleTag(value: string) {
    setTags((prev) =>
      prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]
    );
  }

  async function handleReceiptUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setReceiptFile(file);
    // Preview immediately
    setReceiptImageUrl(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (treatmentIds.length === 0) { setError("치료 종류를 선택해주세요"); return; }
    if (extraRecommended === null) { setError("추가 권유 여부를 선택해주세요"); return; }
    if (!isEdit && pin.length !== 4) { setError("4자리 비번을 입력해주세요"); return; }

    setSubmitting(true);
    setError(null);

    const parsedPrice = price ? parseInt(price.replace(/,/g, "")) : null;

    if (isEdit && initialValues?.reportId) {
      try {
        await api.updateReport({
          reportId: initialValues.reportId,
          treatmentId: treatmentIds[0],
          price: parsedPrice,
          visitDate: visitDate || null,
          extraRecommended: extraRecommended!,
          extraNote: extraNote.trim() || null,
          reviewText: reviewText.trim() || null,
          friendlinessScore: friendlinessScore,
          nickname: nickname.trim() || null,
        });
        setSubmitting(false);
        onSuccess([initialValues.reportId]);
      } catch {
        setError("수정 중 오류가 발생했습니다.");
        setSubmitting(false);
      }
    } else {
      try {
        const { reportIds } = await api.createReport({
          clinicId,
          treatmentIds,
          price: parsedPrice,
          visitDate: visitDate || null,
          extraRecommended: extraRecommended!,
          extraNote: extraNote.trim() || null,
          reviewText: reviewText.trim() || null,
          friendlinessScore: friendlinessScore,
          nickname: nickname.trim() || null,
          pin,
          consultationType: consultationType || undefined,
          overtreatmentOtherTeeth: overtreatmentOtherTeeth ?? undefined,
          overtreatmentDiscountPressure: overtreatmentDiscountPressure ?? undefined,
          consultationTime: consultationTime || undefined,
          tags: tags.length > 0 ? tags : undefined,
          receiptImageUrl: receiptImageUrl || undefined,
        });
        setSubmitting(false);
        onSuccess(reportIds);
      } catch {
        setError("제보 중 오류가 발생했습니다. 다시 시도해주세요.");
        setSubmitting(false);
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">
          어떤 치료를 받으셨나요? *{" "}
          {!isEdit && <span className="text-xs text-gray-400 font-normal">복수 선택 가능</span>}
        </p>
        <div className="flex flex-wrap gap-2">
          {treatments.map((t) => (
            <button
              key={t.treatment_id}
              type="button"
              onClick={() => {
                if (isEdit) {
                  setTreatmentIds([t.treatment_id]);
                } else {
                  setTreatmentIds((prev) =>
                    prev.includes(t.treatment_id)
                      ? prev.filter((id) => id !== t.treatment_id)
                      : [...prev, t.treatment_id]
                  );
                }
              }}
              className={`px-3 py-1.5 rounded-full text-sm border transition ${
                treatmentIds.includes(t.treatment_id)
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">언제 진료 받으셨나요? (선택)</p>
        <input
          type="date"
          value={visitDate}
          onChange={(e) => setVisitDate(e.target.value)}
          max={new Date().toISOString().split("T")[0]}
          className={INPUT_CLS}
        />
      </div>

      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">
          얼마 내셨나요? (선택)
          {treatmentIds.length > 1 && <span className="text-xs text-gray-400 font-normal ml-1">— 전체 합산 금액</span>}
        </p>
        <div className="relative">
          <input
            type="text"
            inputMode="numeric"
            value={price}
            onChange={handlePriceChange}
            placeholder="예: 50,000"
            className={INPUT_CLS + " pr-8"}
          />
          <span className="absolute right-3 top-2.5 text-sm text-gray-400">원</span>
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">추가 치료를 권유받으셨나요? *</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setExtraRecommended(false)}
            className={`flex-1 py-3 rounded-xl text-sm font-medium border-2 transition ${
              extraRecommended === false
                ? "border-green-500 bg-green-50 text-green-700"
                : "border-gray-200 bg-white text-gray-500 hover:border-green-300"
            }`}
          >
            ✅ 없었어요
          </button>
          <button
            type="button"
            onClick={() => setExtraRecommended(true)}
            className={`flex-1 py-3 rounded-xl text-sm font-medium border-2 transition ${
              extraRecommended === true
                ? "border-orange-500 bg-orange-50 text-orange-700"
                : "border-gray-200 bg-white text-gray-500 hover:border-orange-300"
            }`}
          >
            ⚠️ 있었어요
          </button>
        </div>
      </div>

      {extraRecommended === true && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">어떤 치료를 권유받으셨나요? (선택)</p>
          <input
            type="text"
            value={extraNote}
            onChange={(e) => setExtraNote(e.target.value)}
            placeholder="예: 신경치료 + 크라운 2개"
            maxLength={200}
            className={INPUT_CLS}
          />
        </div>
      )}

      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">후기 (선택)</p>
        <textarea
          value={reviewText}
          onChange={(e) => setReviewText(e.target.value)}
          placeholder="진료 경험을 자유롭게 작성해 주세요"
          maxLength={500}
          rows={3}
          className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 font-medium placeholder:text-gray-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">직원/의사 친절도 (선택)</p>
        <div className="flex gap-2">
          {FRIENDLINESS_OPTIONS.map((opt) => (
            <button
              key={opt.score}
              type="button"
              onClick={() => setFriendlinessScore(friendlinessScore === opt.score ? null : opt.score)}
              className={`flex-1 flex flex-col items-center py-2 rounded-xl border-2 text-xs transition ${
                friendlinessScore === opt.score
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-200 bg-white text-gray-500 hover:border-blue-300"
              }`}
            >
              <span className="text-lg">{opt.emoji}</span>
              <span className="mt-0.5 leading-tight text-center">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">치료 계획은 누가 설명했나요?</p>
        <div className="flex gap-3">
          {CONSULTATION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setConsultationType(consultationType === opt.value ? "" : opt.value)}
              className={`flex-1 py-3 rounded-xl text-sm font-medium border-2 transition ${
                consultationType === opt.value
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-200 bg-white text-gray-500 hover:border-blue-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">
          통증 없는 다른 치아도 치료를 권유했나요?
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setOvertreatmentOtherTeeth(overtreatmentOtherTeeth === false ? null : false)}
            className={`flex-1 py-3 rounded-xl text-sm font-medium border-2 transition ${
              overtreatmentOtherTeeth === false
                ? "border-green-500 bg-green-50 text-green-700"
                : "border-gray-200 bg-white text-gray-500 hover:border-green-300"
            }`}
          >
            ✅ 아니요
          </button>
          <button
            type="button"
            onClick={() => setOvertreatmentOtherTeeth(overtreatmentOtherTeeth === true ? null : true)}
            className={`flex-1 py-3 rounded-xl text-sm font-medium border-2 transition ${
              overtreatmentOtherTeeth === true
                ? "border-orange-500 bg-orange-50 text-orange-700"
                : "border-gray-200 bg-white text-gray-500 hover:border-orange-300"
            }`}
          >
            ⚠️ 네
          </button>
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">
          여러 치료를 동시에 하면 할인을 제안했나요?
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setOvertreatmentDiscountPressure(overtreatmentDiscountPressure === false ? null : false)}
            className={`flex-1 py-3 rounded-xl text-sm font-medium border-2 transition ${
              overtreatmentDiscountPressure === false
                ? "border-green-500 bg-green-50 text-green-700"
                : "border-gray-200 bg-white text-gray-500 hover:border-green-300"
            }`}
          >
            ✅ 아니요
          </button>
          <button
            type="button"
            onClick={() => setOvertreatmentDiscountPressure(overtreatmentDiscountPressure === true ? null : true)}
            className={`flex-1 py-3 rounded-xl text-sm font-medium border-2 transition ${
              overtreatmentDiscountPressure === true
                ? "border-orange-500 bg-orange-50 text-orange-700"
                : "border-gray-200 bg-white text-gray-500 hover:border-orange-300"
            }`}
          >
            ⚠️ 네
          </button>
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">의사와의 상담 시간</p>
        <select
          value={consultationTime}
          onChange={(e) => setConsultationTime(e.target.value)}
          className={INPUT_CLS}
        >
          <option value="">선택해주세요</option>
          {CONSULTATION_TIME_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">태그 (복수 선택)</p>
        <div className="flex flex-wrap gap-2">
          {TAG_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggleTag(opt.value)}
              className={`px-3 py-1.5 rounded-full text-sm border transition ${
                tags.includes(opt.value)
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">영수증 사진 (선택)</p>
        <div className="flex items-center gap-3">
          <label className="flex-1 cursor-pointer">
            <div className="border-2 border-dashed border-gray-300 rounded-xl px-4 py-3 text-center text-sm text-gray-400 hover:border-blue-400 hover:text-blue-500 transition">
              {receiptFile ? receiptFile.name : "사진 선택"}
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={handleReceiptUpload}
              className="hidden"
            />
          </label>
          {receiptImageUrl && (
            <button
              type="button"
              onClick={() => { setReceiptFile(null); setReceiptImageUrl(""); }}
              className="text-sm text-red-500 hover:underline shrink-0"
            >
              삭제
            </button>
          )}
        </div>
        {receiptImageUrl && (
          <img
            src={receiptImageUrl}
            alt="영수증"
            className="mt-2 max-h-40 rounded-xl object-cover border"
          />
        )}
      </div>

      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">닉네임 (선택)</p>
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="익명"
          maxLength={30}
          className={INPUT_CLS}
        />
      </div>

      {!isEdit && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">
            비번 4자리 *{" "}
            <span className="text-xs text-gray-400 font-normal">나중에 수정/삭제 시 사용</span>
          </p>
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={handlePinChange}
            placeholder="숫자 4자리"
            maxLength={4}
            className={INPUT_CLS}
          />
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 border border-gray-300 text-gray-600 font-semibold py-3 rounded-xl transition hover:bg-gray-50"
          >
            취소
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition disabled:opacity-50"
        >
          {submitting ? (isEdit ? "수정 중..." : "제보 중...") : (isEdit ? "수정하기" : "제보하기")}
        </button>
      </div>
    </form>
  );
}
