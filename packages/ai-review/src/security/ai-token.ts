import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

export const AI_TOKEN_ISSUER = 'devstudy-ai-review';
export const AI_TOKEN_AUDIENCE = 'ai-review-internal';
export const AI_TOKEN_MAX_TTL_SEC = 300; // Tối đa 5 phút

export type AiTokenScope = 'student:read' | 'attempts:read' | 'examset:create';

export interface AiTokenClaims {
  iss: string;
  aud: string;
  sub: string;
  jti: string;
  scope: AiTokenScope[];
  iat: number;
  exp: number;
}

export class AiTokenError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'AiTokenError';
    this.status = status;
    this.code = code;
  }
}

export function mintAiToken(params: {
  userId: string;
  scopes: AiTokenScope[];
  secret: string;
  ttlSec?: number;
}): { token: string; jti: string; expiresAt: Date } {
  const ttlSec = params.ttlSec ?? AI_TOKEN_MAX_TTL_SEC;
  if (!Number.isInteger(ttlSec) || ttlSec <= 0 || ttlSec > AI_TOKEN_MAX_TTL_SEC) {
    throw new Error(`AI token TTL must be between 1 and ${AI_TOKEN_MAX_TTL_SEC} seconds`);
  }
  if (!params.secret || params.secret.length < 32) {
    throw new Error('AI token secret must be at least 32 characters');
  }
  if (params.scopes.length === 0) {
    throw new Error('AI token must have at least one scope');
  }

  const jti = crypto.randomUUID();
  const token = jwt.sign(
    {
      scope: params.scopes,
    },
    params.secret,
    {
      algorithm: 'HS256',
      issuer: AI_TOKEN_ISSUER,
      audience: AI_TOKEN_AUDIENCE,
      subject: params.userId,
      jwtid: jti,
      expiresIn: ttlSec,
    }
  );

  return {
    token,
    jti,
    expiresAt: new Date(Date.now() + ttlSec * 1000),
  };
}

export function verifyAiToken(
  token: string,
  options: { secret: string; requiredScope: AiTokenScope }
): AiTokenClaims {
  let decoded: jwt.JwtPayload;
  try {
    const raw = jwt.verify(token, options.secret, {
      algorithms: ['HS256'],
      issuer: AI_TOKEN_ISSUER,
      audience: AI_TOKEN_AUDIENCE,
    });
    if (typeof raw === 'string') {
      throw new AiTokenError('AI token không hợp lệ', 401, 'INVALID_AI_TOKEN');
    }
    decoded = raw;
  } catch (err: any) {
    if (err instanceof AiTokenError) throw err;
    if (err?.name === 'TokenExpiredError') {
      throw new AiTokenError('AI token đã hết hạn', 401, 'AI_TOKEN_EXPIRED');
    }
    throw new AiTokenError('AI token không hợp lệ', 401, 'INVALID_AI_TOKEN');
  }

  const sub = decoded.sub;
  const jti = decoded.jti;
  const scope = Array.isArray(decoded.scope) ? (decoded.scope as AiTokenScope[]) : [];

  if (!sub || !jti) {
    throw new AiTokenError('AI token thiếu trường định danh bắt buộc', 401, 'INVALID_AI_TOKEN');
  }

  if (!scope.includes(options.requiredScope)) {
    throw new AiTokenError(
      `AI token thiếu quyền scope "${options.requiredScope}"`,
      403,
      'INSUFFICIENT_SCOPE'
    );
  }

  return {
    iss: String(decoded.iss),
    aud: String(decoded.aud),
    sub,
    jti,
    scope,
    iat: Number(decoded.iat),
    exp: Number(decoded.exp),
  };
}
