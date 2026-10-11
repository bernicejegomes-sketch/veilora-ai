import { Identity } from '@semaphore-protocol/core';

const STORAGE_KEY_IDENTITY = 'incognito_identity_secret';
const STORAGE_KEY_COMMITMENT = 'incognito_commitment';
const STORAGE_KEY_ENROLLED = 'incognito_is_enrolled';
const STORAGE_KEY_KNOWN_COMMITMENTS = 'incognito_known_commitments';
const STORAGE_KEY_LANGUAGE = 'incognito_selected_language';

/**
 * Notice regarding local browser storage:
 * Browser localStorage is used strictly as an implementation convenience
 * during the client session and demo. It is not advertised as hardened
 * secure storage against device compromise.
 */

export function getOrCreateIdentity(): Identity {
  const savedSecret = localStorage.getItem(STORAGE_KEY_IDENTITY);
  if (savedSecret) {
    try {
      return new Identity(savedSecret);
    } catch {
      // If corrupted, generate fresh
    }
  }

  const identity = new Identity();
  localStorage.setItem(STORAGE_KEY_IDENTITY, identity.export());
  localStorage.setItem(STORAGE_KEY_COMMITMENT, identity.commitment.toString());
  return identity;
}

export function getSavedIdentity(): Identity | null {
  const savedSecret = localStorage.getItem(STORAGE_KEY_IDENTITY);
  if (!savedSecret) return null;
  try {
    return new Identity(savedSecret);
  } catch {
    return null;
  }
}

export function getSavedCommitment(): string | null {
  return localStorage.getItem(STORAGE_KEY_COMMITMENT);
}

export function setEnrolledStatus(enrolled: boolean) {
  if (enrolled) {
    localStorage.setItem(STORAGE_KEY_ENROLLED, 'true');
  } else {
    localStorage.removeItem(STORAGE_KEY_ENROLLED);
  }
}

export function isEnrolled(): boolean {
  return localStorage.getItem(STORAGE_KEY_ENROLLED) === 'true';
}

export function addKnownCommitment(commitment: string) {
  const current = getKnownCommitments();
  if (!current.includes(commitment)) {
    current.push(commitment);
    localStorage.setItem(STORAGE_KEY_KNOWN_COMMITMENTS, JSON.stringify(current));
  }
}

export function getKnownCommitments(): string[] {
  const raw = localStorage.getItem(STORAGE_KEY_KNOWN_COMMITMENTS);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getSavedLanguage(): string {
  return localStorage.getItem(STORAGE_KEY_LANGUAGE) || 'en';
}

export function setSavedLanguage(lang: string) {
  localStorage.setItem(STORAGE_KEY_LANGUAGE, lang);
}

export function clearClientSession() {
  localStorage.removeItem(STORAGE_KEY_IDENTITY);
  localStorage.removeItem(STORAGE_KEY_COMMITMENT);
  localStorage.removeItem(STORAGE_KEY_ENROLLED);
}
