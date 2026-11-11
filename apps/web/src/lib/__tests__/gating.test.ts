import { describe, expect, it } from 'vitest';
import {
  canCreateCourse,
  canCreateExam,
  canCreateResource,
  canDownload,
  canJoinExam,
  canModerate,
  canPractice,
  canUsePlayground,
  examCreateBlockReason,
  isAdmin,
  aiQuotaLimit,
  runQuotaLimit,
  snippetLimit,
  type Session,
} from '../gating';

describe('Feature Gating & Permissions (gating.ts)', () => {
  const guest: Session = null;
  const studentFree: Session = { role: 'STUDENT', plan: 'FREE' };
  const studentPremium: Session = { role: 'STUDENT', plan: 'PREMIUM' };
  const lecturerFree: Session = { role: 'LECTURER', plan: 'FREE' };
  const lecturerPremium: Session = { role: 'LECTURER', plan: 'PREMIUM' };
  const moderator: Session = { role: 'MODERATOR', plan: 'FREE' };
  const admin: Session = { role: 'ADMIN', plan: 'FREE' };

  it('correctly gates basic permissions for guests vs logged-in users', () => {
    expect(canDownload(guest)).toBe(false);
    expect(canDownload(studentFree)).toBe(true);

    expect(canPractice(guest)).toBe(false);
    expect(canPractice(studentFree)).toBe(true);

    expect(canUsePlayground(guest)).toBe(false);
    expect(canUsePlayground(studentFree)).toBe(true);

    expect(canJoinExam(guest)).toBe(false);
    expect(canJoinExam(studentFree)).toBe(true);
  });

  it('restricts resource and course creation to LECTURER or ADMIN', () => {
    expect(canCreateResource(guest)).toBe(false);
    expect(canCreateResource(studentPremium)).toBe(false);
    expect(canCreateResource(lecturerFree)).toBe(true);
    expect(canCreateResource(admin)).toBe(true);

    expect(canCreateCourse(guest)).toBe(false);
    expect(canCreateCourse(studentPremium)).toBe(false);
    expect(canCreateCourse(lecturerFree)).toBe(true);
    expect(canCreateCourse(admin)).toBe(true);
  });

  it('strictly enforces LECTURER + PREMIUM requirement for exam creation', () => {
    expect(canCreateExam(guest)).toBe(false);
    expect(canCreateExam(studentFree)).toBe(false);
    expect(canCreateExam(studentPremium)).toBe(false); // Student Premium cannot create exams
    expect(canCreateExam(lecturerFree)).toBe(false); // Lecturer Free cannot create exams
    expect(canCreateExam(lecturerPremium)).toBe(true); // Lecturer Premium CAN create exams

    expect(examCreateBlockReason(guest)).toContain('đăng nhập');
    expect(examCreateBlockReason(studentPremium)).toContain('Chỉ giảng viên');
    expect(examCreateBlockReason(lecturerFree)).toContain('Premium');
    expect(examCreateBlockReason(lecturerPremium)).toBeNull();
  });

  it('checks moderator and admin permissions', () => {
    expect(canModerate(guest)).toBe(false);
    expect(canModerate(studentFree)).toBe(false);
    expect(canModerate(moderator)).toBe(true);
    expect(canModerate(admin)).toBe(true);

    expect(isAdmin(moderator)).toBe(false);
    expect(isAdmin(admin)).toBe(true);
  });

  it('calculates correct quotas based on PlanTier', () => {
    expect(aiQuotaLimit(studentFree)).toBe(10);
    expect(aiQuotaLimit(studentPremium)).toBe(Infinity);

    expect(runQuotaLimit(studentFree)).toBe(30);
    expect(runQuotaLimit(studentPremium)).toBe(200);

    expect(snippetLimit(studentFree)).toBe(3);
    expect(snippetLimit(studentPremium)).toBe(50);
  });
});
