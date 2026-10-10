/**
 * Single authoritative source of truth for complaint topics in Incognito.
 */
export const TOPICS = Object.freeze([
  'FACULTY',
  'INFRASTRUCTURE',
  'OTHER',
]);

/**
 * Validate whether a given string is a supported topic ID.
 */
export function isValidTopic(topicId) {
  return typeof topicId === 'string' && TOPICS.includes(topicId);
}
