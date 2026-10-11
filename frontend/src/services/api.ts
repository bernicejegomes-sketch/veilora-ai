import { type SemaphoreProof } from '@semaphore-protocol/core';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

/**
 * Wrapper around fetch that converts low-level network failures (backend down,
 * DNS/connection refused, CORS) into a single friendly, user-facing message.
 * HTTP error responses still flow through so callers can read their JSON body.
 */
async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw new Error(
      'Could not reach the server. Please check that the backend is running and try again.'
    );
  }
}

export interface HealthResponse {
  ok: boolean;
  service?: string;
}

export interface ComplaintContextResponse {
  ok: boolean;
  serverDay: string;
  topics: string[];
}

export interface SemaphoreGroupResponse {
  ok: boolean;
  members: string[];
  error?: string;
}

export interface EnrollRequest {
  rollNo: string;
  otp: string;
  dob: string;
  name: string;
  commitment: string;
}

export interface EnrollResponse {
  ok: boolean;
  error?: string;
}

export interface SubmitRequest {
  proof: SemaphoreProof;
  topicId: string;
  text: string;
}

export interface SubmitResponse {
  ok: boolean;
  trackingCode?: string;
  error?: string;
  reasons?: string[];
}

export interface InsightTopic {
  topic_id: string;
  server_day: string;
  submission_count: number;
  warn_count: number;
}

export interface InsightTheme {
  topic_id: string;
  server_day: string;
  theme_key: string;
  theme_label: string;
  support_count: number;
  summary: string | null;
}

export interface InsightsResponse {
  ok: boolean;
  threshold: number;
  demoMode?: boolean;
  topics: InsightTopic[];
  themes: InsightTheme[];
  error?: string;
}

export async function checkHealth(): Promise<HealthResponse> {
  const res = await apiFetch(`${BASE_URL}/health`);
  if (!res.ok) throw new Error('Backend health check failed');
  return res.json();
}

export async function requestOtp(rollNo: string): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`${BASE_URL}/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rollNo }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to request OTP');
  }
  return data;
}

export async function enrollStudent(payload: EnrollRequest): Promise<EnrollResponse> {
  const res = await apiFetch(`${BASE_URL}/enroll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Enrollment failed');
  }
  return data;
}

export async function getComplaintContext(): Promise<ComplaintContextResponse> {
  const res = await apiFetch(`${BASE_URL}/complaint-context`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch complaint context');
  }
  return data;
}

/**
 * Fetch the public Semaphore group commitments in exact backend database order.
 * Endpoint: GET /api/semaphore-group
 */
export async function getSemaphoreGroup(): Promise<SemaphoreGroupResponse> {
  const res = await apiFetch(`${BASE_URL}/semaphore-group`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch semaphore group');
  }
  return data;
}

export async function submitComplaint(payload: SubmitRequest): Promise<SubmitResponse> {
  const res = await apiFetch(`${BASE_URL}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorMsg = data.error || (data.reasons ? data.reasons.join(', ') : 'Submission rejected');
    const err = new Error(errorMsg);
    (err as any).status = res.status;
    (err as any).data = data;
    throw err;
  }
  return data;
}

/**
 * Fetch privacy-safe aggregate insights. The backend already suppresses any
 * bucket/theme below the k-anonymity threshold, so the response never exposes
 * a single submission or any raw complaint content.
 * Endpoint: GET /api/insights
 */
export async function getInsights(): Promise<InsightsResponse> {
  const res = await apiFetch(`${BASE_URL}/insights`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch insights');
  }
  return data;
}
