import { PrismaClient, Role, PlanTier, SubscriptionStatus } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

const demoUsers = [
  {
    email: 'huy.nd@edu.vn',
    password: 'password123',
    displayName: 'Nguyễn Đức Huy',
    role: Role.STUDENT,
    plan: PlanTier.FREE,
    studentId: '20210001',
    university: 'ĐH Bách Khoa Hà Nội',
    major: 'Khoa học Máy tính',
  },
  {
    email: 'linh.tt@edu.vn',
    password: 'password123',
    displayName: 'Trần Thị Linh',
    role: Role.STUDENT,
    plan: PlanTier.PREMIUM,
    studentId: '20210002',
    university: 'ĐH Công nghệ — ĐHQGHN',
    major: 'Kỹ thuật Phần mềm',
  },
  {
    email: 'tuan.tm@hust.edu.vn',
    password: 'password123',
    displayName: 'TS. Trần Minh Tuấn',
    role: Role.LECTURER,
    plan: PlanTier.FREE,
    studentId: 'GV201501',
    university: 'ĐH Bách Khoa Hà Nội',
    major: 'Khoa học Máy tính',
  },
  {
    email: 'bao.tq@hust.edu.vn',
    password: 'password123',
    displayName: 'ThS. Tạ Quang Bảo',
    role: Role.LECTURER,
    plan: PlanTier.PREMIUM,
    studentId: 'GV201802',
    university: 'ĐH Bách Khoa Hà Nội',
    major: 'Hệ thống Thông tin',
  },
  {
    email: 'mod@devstudy.edu.vn',
    password: 'password123',
    displayName: 'Ban Kiểm Duyệt Nội Dung',
    role: Role.MODERATOR,
    plan: PlanTier.FREE,
    university: 'DevStudy Hub',
    major: 'Kiểm duyệt',
  },
  {
    email: 'admin@devstudy.edu.vn',
    password: 'password123',
    displayName: 'Quản Trị Viên Hệ Thống',
    role: Role.ADMIN,
    plan: PlanTier.PREMIUM,
    university: 'DevStudy Hub',
    major: 'Vận hành hệ thống',
  },
];

async function main() {
  console.log('🌱 Seeding database...');

  for (const user of demoUsers) {
    const passwordHash = await argon2.hash(user.password);

    const createdUser = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        displayName: user.displayName,
        role: user.role,
        emailVerified: true,
      },
      create: {
        email: user.email,
        passwordHash,
        displayName: user.displayName,
        role: user.role,
        emailVerified: true,
        profile: {
          create: {
            studentId: user.studentId,
            university: user.university,
            major: user.major,
          },
        },
      },
    });

    await prisma.subscription.upsert({
      where: { userId: createdUser.id },
      update: {
        tier: user.plan,
        status: SubscriptionStatus.ACTIVE,
        expiresAt: user.plan === PlanTier.PREMIUM ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) : null,
      },
      create: {
        userId: createdUser.id,
        tier: user.plan,
        status: SubscriptionStatus.ACTIVE,
        expiresAt: user.plan === PlanTier.PREMIUM ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) : null,
      },
    });

    console.log(`✓ Seeded user: ${user.email} (${user.role} - ${user.plan})`);
  }

  console.log('✅ Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
