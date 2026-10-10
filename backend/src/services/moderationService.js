/**
 * Deterministic MVP Moderation Service.
 *
 * Checks:
 * - Extremely short text (< 10 chars) -> REJECT
 * - Excessive repeated characters (e.g. "aaaaaaa", "!!!!!!!") -> REJECT
 * - Excessive repeated words (e.g. "spam spam spam spam") -> REJECT
 * - Obvious spam links (http://, https://, www., spam TLDs) -> REJECT
 * - Potential self-identifying statements -> WARN
 * - Legitimate complaints -> ALLOW
 *
 * CRITICAL PRIVACY & CRYPTO RULES:
 * - Does NOT modify, normalize, or sanitize the text.
 * - Does NOT log complaint text.
 * - Returns structured { action: "ALLOW" | "WARN" | "REJECT", reasons: [...] }.
 *
 * @param {string} text
 * @returns {{ action: "ALLOW" | "WARN" | "REJECT", reasons: string[] }}
 */
export function moderateComplaintText(text) {
  if (typeof text !== 'string') {
    return {
      action: 'REJECT',
      reasons: ['Complaint text must be a valid string']
    };
  }

  const trimmed = text.trim();
  const reasons = [];

  // 1. Extremely short meaningless text (< 10 characters)
  if (trimmed.length < 10) {
    return {
      action: 'REJECT',
      reasons: ['Complaint text is too short to be meaningful (minimum 10 characters required)']
    };
  }

  // 2. Obvious spam links (URLs)
  const urlPattern = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.(com|xyz|top|biz|ru|cn|click|link)(\/[^\s]*)?)/i;
  if (urlPattern.test(text)) {
    return {
      action: 'REJECT',
      reasons: ['Complaint text contains external links or URLs, which are not permitted']
    };
  }

  // 3. Repeated nonsense characters (e.g., 6 or more identical consecutive characters)
  if (/(.)\1{5,}/i.test(text)) {
    return {
      action: 'REJECT',
      reasons: ['Complaint text contains excessive repeated characters']
    };
  }

  // 4. Excessive repeated words (e.g., same word repeated 4+ times consecutively)
  if (/\b(\w+)\b(?:\s+\1\b){3,}/i.test(text)) {
    return {
      action: 'REJECT',
      reasons: ['Complaint text contains excessive repeated words']
    };
  }

  // 5. Check for potential self-identifying disclosures (WARN only - does NOT reject)
  const warnPatterns = [
    /\bi\s+was\s+the\s+only\s+student\b/i,
    /\bmy\s+name\s+is\b/i,
    /\bmy\s+roll\s+(?:no|number)\s+is\b/i,
    /\bmy\s+phone\s+number\s+is\b/i,
    /\bmy\s+email\s+is\b/i
  ];

  for (const pattern of warnPatterns) {
    if (pattern.test(text)) {
      reasons.push('Complaint text may contain self-identifying statements');
      break;
    }
  }

  if (reasons.length > 0) {
    return {
      action: 'WARN',
      reasons
    };
  }

  return {
    action: 'ALLOW',
    reasons: []
  };
}
