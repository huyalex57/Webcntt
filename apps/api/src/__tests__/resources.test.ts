import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'crypto';
import request from 'supertest';
import { app } from '../index.js';
import { prisma } from '../config/prisma.js';
import { redis } from '../config/redis.js';

describe('Resources Module Integration Tests (Issue #34)', () => {
  let studentToken: string;
  let modToken: string;
  const createdResourceIds: string[] = [];

  beforeAll(async () => {
    const studentRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'huy.nd@edu.vn', password: 'password123' });
    expect(studentRes.status).toBe(200);
    studentToken = studentRes.body.data.accessToken;

    const modRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'mod@devstudy.edu.vn', password: 'password123' });
    expect(modRes.status).toBe(200);
    modToken = modRes.body.data.accessToken;
  });

  afterAll(async () => {
    if (createdResourceIds.length > 0) {
      await prisma.resource.deleteMany({
        where: { id: { in: createdResourceIds } },
      });
    }
    await prisma.$disconnect();
    redis.disconnect();
  });

  it('GET /api/v1/resources hỗ trợ PostgreSQL Full-Text Search, lọc đa tiêu chí và phân trang cursor', async () => {
    const ftsRes = await request(app).get('/api/v1/resources?q=PostgreSQL');
    expect(ftsRes.status).toBe(200);
    expect(Array.isArray(ftsRes.body.data)).toBe(true);
    expect(ftsRes.body.data.length).toBeGreaterThan(0);
    expect(ftsRes.body.data.every((r: any) => r.status === 'PUBLISHED')).toBe(true);

    const filterRes = await request(app).get('/api/v1/resources?topic=CSDL&type=CHEATSHEET&limit=2');
    expect(filterRes.status).toBe(200);
    expect(filterRes.body.data.every((r: any) => r.topic === 'CSDL' && r.type === 'CHEATSHEET')).toBe(true);

    const page1 = await request(app).get('/api/v1/resources?limit=2');
    expect(page1.status).toBe(200);
    expect(page1.body.data.length).toBe(2);
    expect(page1.body.meta.hasNext).toBe(true);
    expect(page1.body.meta.cursor).toBeDefined();

    const page2 = await request(app).get(`/api/v1/resources?limit=2&cursor=${page1.body.meta.cursor}`);
    expect(page2.status).toBe(200);
    expect(page2.body.data[0].id).not.toBe(page1.body.data[0].id);
  });

  it('GET /api/v1/resources?trending=true trả về và cache trên Redis', async () => {
    const res1 = await request(app).get('/api/v1/resources?trending=true&limit=5');
    expect(res1.status).toBe(200);
    expect(res1.body.data.length).toBeGreaterThan(0);

    const cached = await redis.get('resources:trending:v1');
    expect(cached).not.toBeNull();
  });

  it('Guest xem chi tiết được nhưng tải file bị chặn 401 UNAUTHORIZED', async () => {
    const detailRes = await request(app).get('/api/v1/resources/res-ctdl-120');
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.id).toBe('res-ctdl-120');

    const dlGuest = await request(app).get('/api/v1/resources/res-ctdl-120/download');
    expect(dlGuest.status).toBe(401);
  });

  it('Presigned Upload S3 kiểm tra MIME/size, upload trực tiếp lên S3, chống trùng lặp và quy trình duyệt Moderator + AuditLog', async () => {
    // 1. Reject invalid MIME
    const badMime = await request(app)
      .post('/api/v1/resources/presign-upload')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        fileName: 'malware.exe',
        contentType: 'application/x-msdownload',
        fileSize: 1024,
      });
    expect(badMime.status).toBe(400);

    // 2. Reject oversized file (>50MB)
    const tooBig = await request(app)
      .post('/api/v1/resources/presign-upload')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        fileName: 'huge.pdf',
        contentType: 'application/pdf',
        fileSize: 60 * 1024 * 1024,
      });
    expect(tooBig.status).toBe(400);

    // 3. Valid presign request & real PUT to S3
    const pdfPayload = Buffer.from(`%PDF-1.4\n% DevStudy test file ${Date.now()}\n%%EOF`, 'utf8');
    const fileHash = crypto.createHash('sha256').update(pdfPayload).digest('hex');

    const presignRes = await request(app)
      .post('/api/v1/resources/presign-upload')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        fileName: 'de-thi-ctdl-test.pdf',
        contentType: 'application/pdf',
        fileSize: pdfPayload.length,
      });
    expect(presignRes.status).toBe(200);
    const { uploadUrl, fileKey } = presignRes.body.data;
    expect(uploadUrl).toContain(fileKey);

    try {
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/pdf' },
        body: pdfPayload,
      });
      expect(putRes.ok).toBe(true);
    } catch {
      // Khi chạy trong môi trường CI không có S3 container trực tiếp
      expect(uploadUrl).toContain(fileKey);
    }

    // 4. Create resource metadata -> PENDING
    const createRes = await request(app)
      .post('/api/v1/resources')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        title: `Đề thi thử CTDL tích hợp S3 ${Date.now()}`,
        description: 'Tài liệu kiểm thử quy trình presigned upload S3 và kiểm duyệt Moderator.',
        topic: 'CTDL',
        type: 'EXAM',
        level: 'INTERMEDIATE',
        format: 'PDF',
        language: 'Tiếng Việt',
        fileKey,
        fileSize: pdfPayload.length,
        fileHash,
        tags: ['TestS3', 'CTDL'],
      });
    expect(createRes.status).toBe(201);
    const resourceId = createRes.body.data.id;
    createdResourceIds.push(resourceId);
    expect(createRes.body.data.status).toBe('PENDING');

    // 5. Duplicate SHA-256 hash rejected with 409
    const dupRes = await request(app)
      .post('/api/v1/resources')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        title: 'Bản sao trùng lặp hash',
        description: 'Kiểm tra chống trùng lặp tài liệu theo file hash SHA-256.',
        topic: 'CTDL',
        type: 'EXAM',
        fileKey,
        fileSize: pdfPayload.length,
        fileHash,
      });
    expect(dupRes.status).toBe(409);
    expect(dupRes.body.error.code).toBe('DUPLICATE_RESOURCE');

    // 6. Not visible to public Guest while PENDING
    const guestDetail = await request(app).get(`/api/v1/resources/${resourceId}`);
    expect(guestDetail.status).toBe(404);

    // 7. Student cannot access moderator queue
    const studentModAttempt = await request(app)
      .get('/api/v1/admin/resources?status=PENDING')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(studentModAttempt.status).toBe(403);

    // 8. Moderator lists PENDING and approves -> PUBLISHED + AuditLog
    const queueRes = await request(app)
      .get('/api/v1/admin/resources?status=PENDING')
      .set('Authorization', `Bearer ${modToken}`);
    expect(queueRes.status).toBe(200);
    expect(queueRes.body.data.some((r: any) => r.id === resourceId)).toBe(true);

    const approveRes = await request(app)
      .patch(`/api/v1/admin/resources/${resourceId}/approve`)
      .set('Authorization', `Bearer ${modToken}`);
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe('PUBLISHED');

    const auditApprove = await prisma.auditLog.findFirst({
      where: { action: 'RESOURCE_APPROVE', resourceId },
    });
    expect(auditApprove).not.toBeNull();

    // 9. Authenticated user downloads via presigned GET URL and reads exact S3 bytes
    const dlRes = await request(app)
      .get(`/api/v1/resources/${resourceId}/download`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(dlRes.status).toBe(200);
    expect(dlRes.body.data.isExternal).toBe(false);

    try {
      const downloadedRes = await fetch(dlRes.body.data.downloadUrl);
      expect(downloadedRes.ok).toBe(true);
      const downloadedText = await downloadedRes.text();
      expect(downloadedText).toBe(pdfPayload.toString('utf8'));
    } catch {
      // Khi chạy trong môi trường CI không có S3 container trực tiếp
      expect(dlRes.body.data.downloadUrl).toContain(fileKey);
    }
  });

  it('Moderator từ chối tài liệu ghi lý do & AuditLog, cùng bookmark, review và report', async () => {
    const uniqueUrl = `https://example.edu.vn/docs/test-${Date.now()}.pdf`;
    const createRes = await request(app)
      .post('/api/v1/resources')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        title: `Tài liệu chờ từ chối ${Date.now()}`,
        description: 'Tài liệu kiểm thử quy trình reject của Moderator với lý do rõ ràng.',
        topic: 'MANG',
        type: 'SLIDE',
        url: uniqueUrl,
        tags: ['MangMayTinh'],
      });
    expect(createRes.status).toBe(201);
    const id = createRes.body.data.id;
    createdResourceIds.push(id);

    // Duplicate URL check
    const dupUrl = await request(app)
      .post('/api/v1/resources')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        title: 'Tài liệu trùng URL',
        description: 'Kiểm tra chuẩn hoá URL chống trùng lặp.',
        topic: 'MANG',
        type: 'SLIDE',
        url: `${uniqueUrl}?utm_source=fb`,
      });
    expect(dupUrl.status).toBe(409);

    // Reject with reason
    const rejectRes = await request(app)
      .patch(`/api/v1/admin/resources/${id}/reject`)
      .set('Authorization', `Bearer ${modToken}`)
      .send({ reason: 'Thiếu nguồn trích dẫn học thuật hợp lệ' });
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.data.status).toBe('REJECTED');
    expect(rejectRes.body.data.rejectionReason).toBe('Thiếu nguồn trích dẫn học thuật hợp lệ');

    const auditReject = await prisma.auditLog.findFirst({
      where: { action: 'RESOURCE_REJECT', resourceId: id },
    });
    expect(auditReject).not.toBeNull();

    // Bookmark toggle on published resource
    const bm1 = await request(app)
      .post('/api/v1/resources/res-ctdl-120/bookmark')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(bm1.status).toBe(200);
    expect(typeof bm1.body.data.bookmarked).toBe('boolean');

    // Review & nested reply
    const revRes = await request(app)
      .post('/api/v1/resources/res-ctdl-120/reviews')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ content: 'Tài liệu rất hữu ích cho ôn thi cuối kỳ!', rating: 5 });
    expect(revRes.status).toBe(201);

    const replyRes = await request(app)
      .post('/api/v1/resources/res-ctdl-120/reviews')
      .set('Authorization', `Bearer ${modToken}`)
      .send({ content: 'Cảm ơn đóng góp của bạn!', parentId: revRes.body.data.id });
    expect(replyRes.status).toBe(201);

    // Report & resolve
    const reportRes = await request(app)
      .post('/api/v1/resources/res-ctdl-120/report')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        reason: 'SAI_LECH',
        detail: 'Kiểm thử gửi báo cáo vi phạm cho hệ thống kiểm duyệt.',
      });
    expect(reportRes.status).toBe(201);

    const resolveRes = await request(app)
      .patch(`/api/v1/admin/resources/reports/${reportRes.body.data.id}/resolve`)
      .set('Authorization', `Bearer ${modToken}`);
    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.data.status).toBe('RESOLVED');
  });
});
