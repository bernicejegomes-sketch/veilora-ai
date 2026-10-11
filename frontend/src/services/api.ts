import { type SemaphoreProof } from '@semaphore-protocol/core';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

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

export async function checkHealth(): Promise<HealthResponse> {
  const res = await fetch(`${BASE_URL}/health`);
  if (!res.ok) throw new Error('Backend health check failed');
  return res.json();
}

export async function requestOtp(rollNo: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`${BASE_URL}/request-otp`, {
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
  const res = await fetch(`${BASE_URL}/enroll`, {
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
  const res = await fetch(`${BASE_URL}/complaint-context`);
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
  const res = await fetch(`${BASE_URL}/semaphore-group`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch semaphore group');
  }
  return data;
}

export async function submitComplaint(payload: SubmitRequest): Promise<SubmitResponse> {
  const res = await fetch(`${BASE_URL}/submit`, {
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
