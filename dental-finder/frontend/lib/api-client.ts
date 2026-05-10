import { config } from "./config";
import { ReportSummary } from "./clinicUtils";

const BASE = config.api.baseUrl;

export type Clinic = {
  clinic_id: string;
  name: string;
  address: string;
  city: string;
  district: string;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  reportSummary?: ReportSummary;
};

export type ClinicDetail = Clinic & {
  communityPrices: CommunityPrice[];
  userReports: UserReport[];
};

export type CommunityPrice = {
  report_id: string;
  treatment_name: string;
  price: number;
  raw_text: string | null;
  post_url: string | null;
  post_date: string | null;
};

export type UserReport = {
  report_id: string;
  visit_id: string | null;
  treatment_id: number;
  treatment_name: string;
  price: number | null;
  visit_date: string | null;
  extra_recommended: boolean;
  extra_note: string | null;
  review_text: string | null;
  friendliness_score: number | null;
  nickname: string | null;
  created_at: string;
};

export type TreatmentType = {
  treatment_id: number;
  name: string;
};

type FetchClinicsParams = {
  sw_lat?: string;
  sw_lng?: string;
  ne_lat?: string;
  ne_lng?: string;
  city?: string;
  district?: string;
  search?: string;
  page?: string;
  priceReportOnly?: string;
};

type FetchClinicsResult = {
  clinics: Clinic[];
  loading?: boolean;
};

async function get<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE}${path}`, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== "") url.searchParams.set(k, v);
    });
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status} ${path}: ${body}`);
  }
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const url = new URL(`${BASE}${path}`, window.location.origin);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status} ${path}: ${text}`);
  }
  return res.json();
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const url = new URL(`${BASE}${path}`, window.location.origin);
  const res = await fetch(url.toString(), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status} ${path}: ${text}`);
  }
  return res.json();
}

export const api = {
  fetchClinics(params: FetchClinicsParams): Promise<FetchClinicsResult> {
    return get<FetchClinicsResult>("/api/clinics", params as Record<string, string>);
  },

  fetchClinic(id: string): Promise<ClinicDetail> {
    return get<ClinicDetail>(`/api/clinics/${id}`);
  },

  fetchTreatments(): Promise<TreatmentType[]> {
    return get<TreatmentType[]>("/api/treatments");
  },

  fetchDistricts(city: string): Promise<string[]> {
    return get<string[]>("/api/districts", { city });
  },

  createReport(body: {
    clinicId: string;
    treatmentIds: number[];
    price: number | null;
    visitDate: string | null;
    extraRecommended: boolean;
    extraNote: string | null;
    reviewText: string | null;
    friendlinessScore: number | null;
    nickname: string | null;
    pin: string;
  }): Promise<{ reportIds: string[] }> {
    return post<{ reportIds: string[] }>("/api/reports", body);
  },

  updateReport(body: {
    reportId: string;
    treatmentIds: number[];
    price: number | null;
    visitDate: string | null;
    extraRecommended: boolean;
    extraNote: string | null;
    reviewText: string | null;
    friendlinessScore: number | null;
    nickname: string | null;
  }): Promise<{ success: boolean }> {
    return put<{ success: boolean }>("/api/reports", body);
  },

  verifyPin(reportId: string, pin: string): Promise<{ ok: boolean }> {
    return post<{ ok: boolean }>("/api/reports/verify", { reportId, pin });
  },

  deleteReport(reportId: string, pin: string): Promise<{ ok: boolean; visitId?: string }> {
    return post<{ ok: boolean; visitId?: string }>("/api/reports/delete", { reportId, pin });
  },

  reportRequiresPin(reportId: string): Promise<{ requiresPin: boolean }> {
    return post<{ requiresPin: boolean }>("/api/reports/requires-pin", { reportId });
  },

  fetchReportSummaries(clinicIds: string[]): Promise<{ reports: { clinic_id: string; report_id: string; visit_id: string | null; extra_recommended: boolean }[] }> {
    return get("/api/reports/summaries", { ids: clinicIds.join(",") });
  },

  updateReview(body: {
    reportId: string;
    pin: string;
    treatmentIds: number[];
    price: number | null;
    visitDate: string | null;
    extraRecommended: boolean;
    extraNote: string | null;
    reviewText: string | null;
    friendlinessScore: number | null;
    nickname: string | null;
  }): Promise<{ success: boolean }> {
    return post<{ success: boolean }>("/api/reviews/update", body);
  },
};
