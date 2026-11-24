import pino, { type DestinationStream, type Logger } from 'pino';

/**
 * Redaction paths enforced on all @devstudy/ai-review logs so tokens, API keys,
 * secrets, PII (email, studentId) and message contents never leak to log sinks.
 */
export const AI_REVIEW_REDACT_PATHS: string[] = [
  'authorization',
  'Authorization',
  'token',
  'accessToken',
  'refreshToken',
  'apiKey',
  'api_key',
  'secret',
  'password',
  'email',
  'studentId',
  'student_id',
  'cookie',
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-goog-api-key"]',
  'headers.authorization',
  'headers.cookie',
  'headers["x-goog-api-key"]',
  '*.authorization',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.apiKey',
  '*.api_key',
  '*.secret',
  '*.password',
  '*.email',
  '*.studentId',
  '*.student_id',
  'messages[*].content',
  '*.messages[*].content',
];

export interface ModuleLoggerOptions {
  level?: string;
  destination?: DestinationStream;
}

export function createModuleLogger(options: ModuleLoggerOptions = {}): Logger {
  const level =
    options.level ??
    (process.env.NODE_ENV === 'test' ? 'silent' : process.env.LOG_LEVEL || 'info');

  const pinoOptions: pino.LoggerOptions = {
    name: 'ai-review',
    level,
    redact: {
      paths: AI_REVIEW_REDACT_PATHS,
      censor: '[REDACTED]',
    },
  };

  return options.destination ? pino(pinoOptions, options.destination) : pino(pinoOptions);
}
