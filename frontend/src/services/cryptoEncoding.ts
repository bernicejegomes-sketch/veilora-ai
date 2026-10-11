export const VALID_TOPICS = ['FACULTY', 'INFRASTRUCTURE', 'OTHER'] as const;
export type Topic = (typeof VALID_TOPICS)[number];

export function isValidTopic(topic: string): topic is Topic {
  return VALID_TOPICS.includes(topic as Topic);
}

/**
 * Deterministically bind complaint text to a Semaphore proof message.
 *
 * Contract:
 * exact complaint text
 * → UTF-8 bytes
 * → SHA-256
 * → unsigned 256-bit BigInt
 * → decimal string
 */
export async function encodeComplaintMessage(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  const messageBigInt = BigInt('0x' + hex);
  return messageBigInt.toString();
}

/**
 * Deterministically bind topicId and serverDay to a Semaphore proof scope.
 *
 * Contract:
 * topicId + ":" + serverDay
 * → UTF-8 bytes
 * → SHA-256
 * → unsigned 256-bit BigInt
 * → decimal string
 */
export async function encodeScope(topicId: string, serverDay: string): Promise<string> {
  if (!isValidTopic(topicId)) {
    throw new Error(`Invalid topic: '${topicId}'`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(serverDay)) {
    throw new Error(`Invalid serverDay format: '${serverDay}'`);
  }

  const raw = `${topicId}:${serverDay}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  const scopeBigInt = BigInt('0x' + hex);
  return scopeBigInt.toString();
}
