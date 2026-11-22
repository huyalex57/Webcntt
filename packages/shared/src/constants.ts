/** Gói Free: 10 câu AI/ngày; Premium: không giới hạn (workflow §5.4). */
export const FREE_AI_QUOTA_PER_DAY = 10;

/** Playground Free: 30 lần chạy/ngày, 3 snippet; Premium: 200 lần, 50 snippet. */
export const FREE_RUN_QUOTA_PER_DAY = 30;
export const FREE_SNIPPET_LIMIT = 3;
export const PREMIUM_SNIPPET_LIMIT = 50;

/** Premium limits (workflow §5.4). */
export const PREMIUM_RUN_QUOTA_PER_DAY = 200;
export const PREMIUM_AI_QUOTA_PER_DAY = 9999;
export const PREMIUM_AI_QUOTA = PREMIUM_AI_QUOTA_PER_DAY;

/** Sandbox resource limits (Issue #36 & Business Flow §4.4). */
export const FREE_CPU_LIMIT_S = 2;
export const FREE_WALL_TIME_LIMIT_S = 5;
export const FREE_MEMORY_LIMIT_KB = 128 * 1024; // 128 MB
export const FREE_STDIN_MAX_BYTES = 64 * 1024; // 64 KB

export const PREMIUM_CPU_LIMIT_S = 5;
export const PREMIUM_WALL_TIME_LIMIT_S = 10;
export const PREMIUM_MEMORY_LIMIT_KB = 512 * 1024; // 512 MB
export const PREMIUM_STDIN_MAX_BYTES = 1024 * 1024; // 1 MB

/** Resource file upload limits (Issue #34 & #35). */
export const MAX_RESOURCE_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
export const ALLOWED_RESOURCE_MIME_TYPES = [
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;
export const ALLOWED_RESOURCE_EXTENSIONS = ['.pdf', '.zip', '.docx'] as const;
