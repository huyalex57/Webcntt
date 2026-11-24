import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020.js';
import type { TopicCode } from '../contracts/events.js';
import examRankingOutputSchema from './schemas/ai-exam-ranking-output.v1.json';
import reviewSummaryOutputSchema from './schemas/ai-review-summary-output.v1.json';
import reviewSummaryRequestSchema from './schemas/ai-review-summary-request.v1.json';

export const SYSTEM_BOUNDARY_CANARY = 'AI_REVIEW_SYSTEM_BOUNDARY_V1';

export const AI_REVIEW_SUMMARY_REQUEST_SCHEMA = reviewSummaryRequestSchema;
export const AI_REVIEW_SUMMARY_OUTPUT_SCHEMA = reviewSummaryOutputSchema;
export const AI_EXAM_RANKING_OUTPUT_SCHEMA = examRankingOutputSchema;

export interface AiReviewSummaryRequestPayload {
  goal?: string;
  topics?: TopicCode[];
  roadmap_topic_ids?: string[];
}

export interface WeaknessInsightDto {
  topic: TopicCode;
  diagnosis: string;
  action_step: string;
}

export interface StudyPlanStepDto {
  step: number;
  title: string;
  focus_topics: TopicCode[];
  roadmap_topic_id?: string;
  reference_url?: string;
  estimated_minutes: number;
}

export interface AiReviewSummaryOutputPayload {
  summary: string;
  weakness_insights: WeaknessInsightDto[];
  study_plan: StudyPlanStepDto[];
}

export interface AiExamRankingOutputPayload {
  selected_question_ids: string[];
  rationale: string;
}

const ajv = new Ajv2020({
  strict: true,
  allErrors: true,
  useDefaults: false,
  removeAdditional: false,
  coerceTypes: false,
});

const validateSummaryOutputFn: ValidateFunction<AiReviewSummaryOutputPayload> =
  ajv.compile<AiReviewSummaryOutputPayload>(reviewSummaryOutputSchema);
const validateExamRankingOutputFn: ValidateFunction<AiExamRankingOutputPayload> =
  ajv.compile<AiExamRankingOutputPayload>(examRankingOutputSchema);

/**
 * Safe educational hosts allowed as fallback reference domains if a verified URL isn't directly provided.
 * Note: For study_plan[].reference_url we additionally enforce exact membership in ground-truth roadmap URLs!
 */
export const TRUSTED_REFERENCE_HOSTS: ReadonlySet<string> = new Set([
  'github.com',
  'roadmap.sh',
  'developer.mozilla.org',
  'postgresql.org',
  'www.postgresql.org',
  'web.dev',
  'kubernetes.io',
  'docs.python.org',
  'learn.microsoft.com',
  'devstudy.edu.vn',
]);

const CONTROL_CHARS_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/**
 * Sanitizes untrusted strings before inserting them into `<data untrusted="true">` blocks:
 * - strips ASCII control chars
 * - neutralizes `<data` / `</data>` / `<system` / `</system>` boundary breakout tags
 * - truncates safely to `maxLen`
 */
export function sanitizeUntrustedText(text: string, maxLen: number = 300): string {
  if (typeof text !== 'string') return '';
  return text
    .replace(CONTROL_CHARS_RE, ' ')
    .replace(/<\/?\s*data\b/gi, (m) => m.replace('<', '<\\'))
    .replace(/<\/?\s*system\b/gi, (m) => m.replace('<', '<\\'))
    .replace(/\r\n/g, '\n')
    .trim()
    .slice(0, maxLen);
}

function sanitizeDeep(value: unknown, maxStringLen: number): unknown {
  if (typeof value === 'string') {
    return sanitizeUntrustedText(value, maxStringLen);
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeDeep(item, maxStringLen));
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = sanitizeDeep(v, maxStringLen);
    }
    return out;
  }
  return value;
}

/**
 * Wraps untrusted user/DB/roadmap data inside an escaped `<data label="..." untrusted="true">` boundary.
 * Guarantees that no untrusted string can inject a closing `</data>` tag.
 */
export function wrapUntrustedData(
  label: string,
  payload: unknown,
  maxStringLen: number = 320
): string {
  const safeLabel = label.replace(/[^a-z0-9_-]/gi, '_');
  const sanitized = sanitizeDeep(payload, maxStringLen);
  const json = JSON.stringify(sanitized, null, 2).replace(/<\/data/gi, '<\\/data');
  return `<data label="${safeLabel}" untrusted="true">\n${json}\n</data>`;
}

const INJECTION_SIGNAL_RULES: ReadonlyArray<{ name: string; re: RegExp }> = [
  {
    name: 'instruction_override_en',
    re: /\b(?:ignore|disregard|forget|override|bypass)\s+(?:all\s+)?(?:previous|prior|above|system|earlier)\s+(?:instructions?|prompts?|rules?|directives?)\b/i,
  },
  {
    name: 'instruction_override_vi',
    re: /(?:bỏ\s*qua|quên\s*hết|phớt\s*lờ|ghi\s*đè)\s+(?:mọi|tất\s*cả|các)?\s*(?:hướng\s*dẫn|chỉ\s*dẫn|quy\s*tắc|lệnh)\s*(?:trước|hệ\s*thống)?/i,
  },
  {
    name: 'prompt_or_secret_exfil',
    re: /\b(?:reveal|print|dump|show|output|leak|exfiltrate)\b.{0,40}\b(?:system\s*prompt|api[_\s-]?key|x-goog-api-key|secret|token|password|env|credentials?)\b/i,
  },
  {
    name: 'prompt_or_secret_exfil_vi',
    re: /(?:tiết\s*lộ|in\s*ra|xuất\s*ra|cho\s*xem).{0,35}(?:system\s*prompt|khóa\s*api|api\s*key|bí\s*mật|mật\s*khẩu|biến\s*môi\s*trường)/i,
  },
  {
    name: 'tag_breakout',
    re: /<\/?\s*(?:data|system|assistant|instruction)\b|###\s*SYSTEM\b|\[SYSTEM\]/i,
  },
  {
    name: 'jailbreak_roleplay',
    re: /\b(?:you\s+are\s+now\s+dan|developer\s+mode|jailbreak|do\s+anything\s+now|act\s+as\s+(?:root|admin|system))\b/i,
  },
  {
    name: 'student_override_attempt',
    re: /\b(?:switch|change|impersonate|override|use)\b.{0,30}\b(?:student_id|user_id|another\s+student|other\s+user)\b/i,
  },
  {
    name: 'answer_key_exfil',
    re: /\b(?:correctIndex|correct_index|reveal\s+(?:the\s+)?correct\s+answers?)\b|(?:tiết\s*lộ|cho\s*biết|lộ)\s+đáp\s*án(?:\s+đúng)?/i,
  },
  {
    name: 'script_or_phishing_scheme',
    re: /(?:javascript:|data:text\/html|<\s*script\b|vbscript:)/i,
  },
  {
    name: 'fake_id_command',
    re: /\b(?:return\s+only|invent|fabricate|make\s+up)\b.{0,30}\b(?:question\s*ids?|exam_ids?|fake\s+ids?)\b/i,
  },
];

/**
 * Scans untrusted inputs for known prompt-injection signals so they can be recorded
 * in non-PII `audit_events` for security monitoring.
 */
export function detectInjectionSignals(texts: Array<string | undefined | null>): string[] {
  const combined = texts.filter((t): t is string => typeof t === 'string' && t.length > 0).join('\n');
  if (!combined) return [];
  const hits: string[] = [];
  for (const rule of INJECTION_SIGNAL_RULES) {
    if (rule.re.test(combined)) {
      hits.push(rule.name);
    }
  }
  return hits;
}

/**
 * Strips optional Markdown code fences and returns raw JSON candidate text.
 */
export function cleanLlmJson(raw: string): string {
  if (!raw) return '';
  let text = raw.trim();
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced?.[1]) {
    text = fenced[1].trim();
  }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }
  return text;
}

/**
 * Checks if a URL is strictly HTTPS, has no embedded credentials/IP/localhost,
 * and is either in the exact ground-truth roadmap URL set or (when `requireExactMatch` is false)
 * on the trusted reference host allowlist.
 */
export function isAllowedReferenceUrl(
  rawUrl: string,
  allowedGroundTruthUrls: ReadonlySet<string>,
  requireExactMatch: boolean = true
): boolean {
  if (typeof rawUrl !== 'string' || rawUrl.trim().length === 0) return false;
  const trimmed = rawUrl.trim();

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:') return false;
  if (parsed.username || parsed.password) return false;

  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) ||
    host.includes(':')
  ) {
    return false;
  }

  if (allowedGroundTruthUrls.has(trimmed)) {
    return true;
  }

  if (requireExactMatch) {
    return false;
  }

  return TRUSTED_REFERENCE_HOSTS.has(host);
}

const OUTPUT_LEAK_RULES: ReadonlyArray<{ reason: string; re: RegExp }> = [
  { reason: 'API_KEY_LEAK', re: /AIza[0-9A-Za-z_-]{20,}|x-goog-api-key|AI_REVIEW_LLM_API_KEY/i },
  { reason: 'SECRET_LEAK', re: /AI_REVIEW_TOKEN_SECRET|eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}|Bearer\s+[A-Za-z0-9._-]{16,}/ },
  { reason: 'EMAIL_PII_LEAK', re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/ },
  {
    reason: 'ANSWER_KEY_LEAK',
    re: /\b(?:correctIndex|correct_index)\b|(?:đáp\s*án\s*đúng\s*(?:là|:)\s*[A-D0-3]\b)|(?:the\s+correct\s+answer\s+is\s+[A-D0-3]\b)/i,
  },
  {
    reason: 'SYSTEM_PROMPT_LEAK',
    re: new RegExp(`${SYSTEM_BOUNDARY_CANARY}|untrusted="true"`, 'i'),
  },
  {
    reason: 'XSS_OR_DANGEROUS_SCHEME',
    re: /(?:<\s*script\b|javascript:|data:text\/html|onerror\s*=|onload\s*=)/i,
  },
];

const INLINE_URL_RE = /\bhttps?:\/\/[^\s"'<>)\]]+/gi;

function collectStrings(value: unknown, out: string[]): void {
  if (typeof value === 'string') {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out);
  } else if (value && typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) {
      collectStrings(v, out);
    }
  }
}

export function scanOutputForLeaks(
  obj: unknown,
  allowedGroundTruthUrls: ReadonlySet<string>,
  skipUrlValues?: ReadonlySet<string>
): string | null {
  const strings: string[] = [];
  collectStrings(obj, strings);

  for (const s of strings) {
    for (const rule of OUTPUT_LEAK_RULES) {
      if (rule.re.test(s)) {
        return rule.reason;
      }
    }

    if (skipUrlValues?.has(s)) {
      continue;
    }

    // Any inline URL embedded inside prose must be grounded or trusted HTTPS
    INLINE_URL_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = INLINE_URL_RE.exec(s)) !== null) {
      const cleanedUrl = match[0].replace(/[.,;:!?]+$/, '');
      if (!isAllowedReferenceUrl(cleanedUrl, allowedGroundTruthUrls, false)) {
        return 'UNTRUSTED_INLINE_URL';
      }
    }
  }

  return null;
}

export type OutputGuardResult<T> =
  | { ok: true; data: T; warnings: string[] }
  | { ok: false; reason: string };

/**
 * Validates and guards LLM JSON output for AI Review Summary:
 * 1. Strict JSON parse + Ajv Draft 2020-12 schema check (`additionalProperties: false`).
 * 2. Anti-leak scan (secrets, JWTs, PII email, answer keys, system prompt boundary, XSS).
 * 3. Grounding check: `reference_url` MUST match a verified ground-truth roadmap URL (else rejected),
 *    and `roadmap_topic_id` must exist in the provided candidate roadmap set (else stripped with warning).
 */
export function guardReviewSummaryOutput(
  rawText: string,
  context: {
    allowedRoadmapTopicIds: ReadonlySet<string>;
    allowedGroundTruthUrls: ReadonlySet<string>;
  }
): OutputGuardResult<AiReviewSummaryOutputPayload> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleanLlmJson(rawText));
  } catch {
    return { ok: false, reason: 'INVALID_JSON' };
  }

  if (!validateSummaryOutputFn(parsed)) {
    return { ok: false, reason: 'SCHEMA_MISMATCH' };
  }

  const data = parsed as AiReviewSummaryOutputPayload;
  const warnings: string[] = [];
  const checkedRefUrls = new Set<string>();

  for (const step of data.study_plan) {
    if (step.reference_url !== undefined) {
      if (!isAllowedReferenceUrl(step.reference_url, context.allowedGroundTruthUrls, true)) {
        return { ok: false, reason: 'UNTRUSTED_REFERENCE_URL' };
      }
      checkedRefUrls.add(step.reference_url);
    }

    if (step.roadmap_topic_id !== undefined) {
      if (!context.allowedRoadmapTopicIds.has(step.roadmap_topic_id)) {
        delete step.roadmap_topic_id;
        warnings.push('HALLUCINATED_ROADMAP_ID_STRIPPED');
      }
    }
  }

  const leakReason = scanOutputForLeaks(data, context.allowedGroundTruthUrls, checkedRefUrls);
  if (leakReason) {
    return { ok: false, reason: leakReason };
  }

  return { ok: true, data, warnings };
}

/**
 * Validates and guards LLM JSON output for Exam-Set candidate ranking:
 * 1. Strict JSON parse + Ajv Draft 2020-12 schema check.
 * 2. Anti-leak scan (secrets, PII, answer keys, untrusted URLs, XSS).
 * Note: ID membership against APPROVED DB pool is additionally enforced by ExamSetBuilder!
 */
export function guardExamRankingOutput(
  rawText: string
): OutputGuardResult<AiExamRankingOutputPayload> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleanLlmJson(rawText));
  } catch {
    return { ok: false, reason: 'INVALID_JSON' };
  }

  if (!validateExamRankingOutputFn(parsed)) {
    return { ok: false, reason: 'SCHEMA_MISMATCH' };
  }

  const data = parsed as AiExamRankingOutputPayload;
  const leakReason = scanOutputForLeaks(data, new Set());
  if (leakReason) {
    return { ok: false, reason: leakReason };
  }

  return { ok: true, data, warnings: [] };
}
