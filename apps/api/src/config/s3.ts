import {
  S3Client,
  HeadBucketCommand,
  CreateBucketCommand,
  PutBucketCorsCommand,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import {
  ALLOWED_RESOURCE_MIME_TYPES,
  MAX_RESOURCE_FILE_SIZE_BYTES,
} from '@devstudy/shared';
import { env } from './env.js';
import { logger } from './logger.js';

export const s3Client = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET_KEY,
  },
  forcePathStyle: true,
});

let bucketInitialized = false;

export async function ensureBucketExists(): Promise<void> {
  if (bucketInitialized) return;
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
  } catch {
    try {
      await s3Client.send(new CreateBucketCommand({ Bucket: env.S3_BUCKET }));
      logger.info(`Created S3 bucket: ${env.S3_BUCKET}`);
    } catch (createErr: any) {
      // Bucket may already exist from a race condition
      if (createErr?.name !== 'BucketAlreadyOwnedByYou' && createErr?.name !== 'BucketAlreadyExists') {
        logger.warn({ err: createErr }, 'Could not auto-create S3 bucket');
      }
    }
  }

  try {
    await s3Client.send(
      new PutBucketCorsCommand({
        Bucket: env.S3_BUCKET,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedHeaders: ['*'],
              AllowedMethods: ['GET', 'PUT', 'HEAD'],
              AllowedOrigins: [env.CLIENT_URL, 'http://localhost:5173', 'http://localhost:3000'],
              ExposeHeaders: ['ETag'],
              MaxAgeSeconds: 3600,
            },
          ],
        },
      })
    );
  } catch (corsErr) {
    logger.debug({ err: corsErr }, 'S3 PutBucketCors skipped or unsupported');
  }

  bucketInitialized = true;
}

function sanitizeFileName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() || 'file';
  return base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120);
}

export interface PresignUploadInput {
  fileName: string;
  contentType: string;
  fileSize: number;
  userId: string;
}

export async function createPresignedUploadUrl(input: PresignUploadInput) {
  if (!ALLOWED_RESOURCE_MIME_TYPES.includes(input.contentType as any)) {
    throw {
      status: 400,
      code: 'INVALID_MIME_TYPE',
      message: 'Định dạng file không được hỗ trợ. Chỉ chấp nhận PDF, DOCX, ZIP.',
    };
  }

  if (input.fileSize <= 0 || input.fileSize > MAX_RESOURCE_FILE_SIZE_BYTES) {
    throw {
      status: 400,
      code: 'FILE_TOO_LARGE',
      message: 'Kích thước file vượt quá giới hạn tối đa 50MB.',
    };
  }

  await ensureBucketExists();

  const safeName = sanitizeFileName(input.fileName);
  const uniquePrefix = crypto.randomBytes(6).toString('hex');
  const fileKey = `resources/${input.userId}/${Date.now()}-${uniquePrefix}-${safeName}`;
  const expiresIn = 900; // 15 minutes

  const command = new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: fileKey,
    ContentType: input.contentType,
    ContentLength: input.fileSize,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn });

  return {
    uploadUrl,
    fileKey,
    bucket: env.S3_BUCKET,
    expiresIn,
  };
}

export async function createPresignedDownloadUrl(fileKey: string, downloadFileName?: string) {
  await ensureBucketExists();

  const expiresIn = 300; // 5 minutes
  const command = new GetObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: fileKey,
    ...(downloadFileName
      ? {
          ResponseContentDisposition: `attachment; filename="${sanitizeFileName(downloadFileName)}"`,
        }
      : {}),
  });

  const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn });

  return {
    downloadUrl,
    expiresIn,
  };
}
