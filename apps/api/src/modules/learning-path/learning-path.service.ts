import { MilestoneStatus } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { GeminiPathService } from './gemini-path.service.js';
import {
  GenerateLearningPathRequest,
  EvaluateMilestoneRequest,
  EvaluateMilestoneResponse,
} from '@devstudy/shared';

export class LearningPathService {
  /**
   * Tạo lộ trình học tập cá nhân hoá bằng AI cho khoá học
   */
  static async generatePath(userId: string, courseId: string, input: GenerateLearningPathRequest) {
    // 1. Kiểm tra khoá học có tồn tại
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        sections: {
          orderBy: { order: 'asc' },
          include: {
            lessons: { orderBy: { order: 'asc' } },
          },
        },
      },
    });

    if (!course) {
      throw { status: 404, message: 'Không tìm thấy khoá học', code: 'COURSE_NOT_FOUND' };
    }

    // 2. Lấy hồ sơ năng lực học viên
    const skillProfiles = await prisma.skillProfile.findMany({
      where: { userId },
      select: { topic: true, accuracy: true, weak: true },
    });

    // 3. Gọi Gemini 4 Hydrogen Medium
    const generated = await GeminiPathService.generatePersonalizedPath(course, skillProfiles, input);

    // 4. Lưu vết token vào AiUsage
    await prisma.aiUsage.create({
      data: {
        userId,
        feature: 'learning_path_generation',
        modelName: generated.modelName,
        promptTokens: generated.promptTokens,
        completionTokens: generated.completionTokens,
        latencyMs: generated.latencyMs,
      },
    });

    // 5. Huỷ hoặc ghi đè lộ trình cũ của user cho khoá này (nếu có)
    const existing = await prisma.learningPath.findFirst({
      where: { userId, courseId },
    });

    if (existing) {
      await prisma.learningPath.delete({ where: { id: existing.id } });
    }

    // 6. Tạo LearningPath và các Milestones
    const learningPath = await prisma.learningPath.create({
      data: {
        userId,
        courseId,
        targetGoal: input.targetGoal,
        currentLevel: input.currentLevel,
        hoursPerWeek: input.hoursPerWeek,
        aiSummary: generated.aiSummary,
        modelName: generated.modelName,
        progressPercent: 0,
        milestones: {
          create: generated.milestones.map((m, index) => ({
            orderIndex: m.orderIndex,
            title: m.title,
            description: m.description,
            estimatedHours: m.estimatedHours,
            passingScore: m.passingScore,
            status: index === 0 ? MilestoneStatus.IN_PROGRESS : MilestoneStatus.LOCKED,
            lessonIds: m.lessonIds,
            quizJson: m.quizQuestions as any,
          })),
        },
      },
      include: {
        course: { select: { title: true } },
        milestones: {
          orderBy: { orderIndex: 'asc' },
          include: {
            remediations: {
              where: { resolved: false },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    return this.formatLearningPath(learningPath);
  }

  /**
   * Lấy lộ trình hiện tại của sinh viên trong khoá học
   */
  static async getPath(userId: string, courseId: string) {
    const path = await prisma.learningPath.findFirst({
      where: { userId, courseId },
      include: {
        course: { select: { title: true } },
        milestones: {
          orderBy: { orderIndex: 'asc' },
          include: {
            remediations: {
              where: { resolved: false },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    if (!path) {
      return null;
    }

    return this.formatLearningPath(path);
  }

  /**
   * Đánh giá kết quả làm bài kiểm tra của một Milestone & Tự động thích ứng
   */
  static async evaluateMilestone(
    userId: string,
    milestoneId: string,
    input: EvaluateMilestoneRequest
  ): Promise<EvaluateMilestoneResponse> {
    const milestone = await prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: {
        learningPath: {
          include: {
            milestones: { orderBy: { orderIndex: 'asc' } },
            course: {
              include: {
                sections: {
                  include: { lessons: true },
                },
              },
            },
          },
        },
      },
    });

    if (!milestone || milestone.learningPath.userId !== userId) {
      throw { status: 404, message: 'Không tìm thấy chặng học tập', code: 'MILESTONE_NOT_FOUND' };
    }

    const quizQuestions: any[] = (milestone.quizJson as any[]) || [];
    if (quizQuestions.length === 0) {
      throw { status: 400, message: 'Chặng này chưa có bài kiểm tra', code: 'NO_QUIZ_AVAILABLE' };
    }

    // Chấm điểm
    let correctCount = 0;
    const wrongQuestions: any[] = [];

    for (const q of quizQuestions) {
      const selected = input.answers[q.id];
      if (selected !== undefined && selected === q.correctIndex) {
        correctCount++;
      } else {
        wrongQuestions.push({
          prompt: q.prompt,
          conceptTag: q.conceptTag,
          explanation: q.explanation,
          selectedAnswer: selected !== undefined ? q.options[selected] || 'Chưa chọn' : 'Chưa chọn',
          correctAnswer: q.options[q.correctIndex],
        });
      }
    }

    const score = Math.round((correctCount / quizQuestions.length) * 100);
    const passed = score >= milestone.passingScore;

    // Lưu MilestoneAttempt
    const attempt = await prisma.milestoneAttempt.create({
      data: {
        milestoneId,
        userId,
        score,
        passed,
        answersJson: input.answers as any,
        wrongConcepts: wrongQuestions.map((w) => w.conceptTag || 'Chung'),
      },
    });

    if (passed) {
      // 1. Đánh dấu Milestone COMPLETED
      await prisma.milestone.update({
        where: { id: milestoneId },
        data: { status: MilestoneStatus.COMPLETED },
      });

      // 2. Mở khoá Milestone kế tiếp (nếu có)
      const nextMilestone = milestone.learningPath.milestones.find(
        (m) => m.orderIndex === milestone.orderIndex + 1
      );

      if (nextMilestone && nextMilestone.status === MilestoneStatus.LOCKED) {
        await prisma.milestone.update({
          where: { id: nextMilestone.id },
          data: { status: MilestoneStatus.IN_PROGRESS },
        });
      }

      // 3. Tính toán lại progressPercent của lộ trình
      const allMilestones = milestone.learningPath.milestones;
      const completedCount = allMilestones.filter(
        (m) => m.id === milestoneId || m.status === MilestoneStatus.COMPLETED
      ).length;
      const progressPercent = Math.round((completedCount / allMilestones.length) * 100);

      await prisma.learningPath.update({
        where: { id: milestone.learningPathId },
        data: { progressPercent },
      });

      // 4. Nếu có remediation cũ thì đánh dấu resolved
      await prisma.milestoneRemediation.updateMany({
        where: { milestoneId, resolved: false },
        data: { resolved: true },
      });

      return {
        milestoneId,
        score,
        passingScore: milestone.passingScore,
        passed: true,
        status: MilestoneStatus.COMPLETED,
        feedback: `Tuyệt vời! Bạn đã đạt ${score}% (yêu cầu tối thiểu ${milestone.passingScore}%). Chặng tiếp theo đã được mở khoá.`,
        nextMilestoneId: nextMilestone?.id || null,
        remediation: null,
      };
    } else {
      // CHƯA ĐẠT MỤC TIÊU: Gọi Gemini 4 Hydrogen Medium phân tích điểm yếu & đề xuất bổ trợ
      const allLessons = milestone.learningPath.course.sections.flatMap((s) => s.lessons);
      const remediationData = await GeminiPathService.analyzeFailedMilestone(
        milestone.title,
        wrongQuestions,
        allLessons
      );

      // Lưu AiUsage
      await prisma.aiUsage.create({
        data: {
          userId,
          feature: 'milestone_remediation_analysis',
          modelName: remediationData.modelName,
          promptTokens: remediationData.promptTokens,
          completionTokens: remediationData.completionTokens,
          latencyMs: remediationData.latencyMs,
        },
      });

      // Lưu MilestoneRemediation
      const remediation = await prisma.milestoneRemediation.create({
        data: {
          milestoneId,
          attemptId: attempt.id,
          weaknessAnalysis: remediationData.weaknessAnalysis,
          recommendedLessonsJson: remediationData.recommendedLessons as any,
          remedialQuestionsJson: remediationData.remedialQuestions as any,
          resolved: false,
        },
      });

      // Chuyển trạng thái Milestone sang NEEDS_REVIEW
      await prisma.milestone.update({
        where: { id: milestoneId },
        data: { status: MilestoneStatus.NEEDS_REVIEW },
      });

      return {
        milestoneId,
        score,
        passingScore: milestone.passingScore,
        passed: false,
        status: MilestoneStatus.NEEDS_REVIEW,
        feedback: `Bạn đạt ${score}% (chưa đạt ngưỡng yêu cầu ${milestone.passingScore}%). AI Gemini đã phân tích điểm yếu và chuẩn bị các bài học bổ trợ dưới đây để giúp bạn nắm vững kiến thức.`,
        nextMilestoneId: null,
        remediation: {
          id: remediation.id,
          milestoneId,
          weaknessAnalysis: remediation.weaknessAnalysis,
          recommendedLessons: remediationData.recommendedLessons,
          remedialQuestions: remediationData.remedialQuestions,
          resolved: false,
          createdAt: remediation.createdAt.toISOString(),
        },
      };
    }
  }

  /**
   * Đánh dấu học viên đã hoàn thành gói bổ trợ
   */
  static async completeRemediation(userId: string, remediationId: string) {
    const rem = await prisma.milestoneRemediation.findUnique({
      where: { id: remediationId },
      include: {
        milestone: {
          include: { learningPath: true },
        },
      },
    });

    if (!rem || rem.milestone.learningPath.userId !== userId) {
      throw { status: 404, message: 'Không tìm thấy bản ghi bổ trợ', code: 'REMEDIATION_NOT_FOUND' };
    }

    await prisma.milestoneRemediation.update({
      where: { id: remediationId },
      data: { resolved: true },
    });

    // Chuyển Milestone lại thành IN_PROGRESS để cho phép làm lại bài quiz
    await prisma.milestone.update({
      where: { id: rem.milestoneId },
      data: { status: MilestoneStatus.IN_PROGRESS },
    });

    return { message: 'Đã hoàn thành ôn tập bổ trợ. Bạn có thể làm lại bài kiểm tra của chặng này.' };
  }

  private static formatLearningPath(path: any) {
    return {
      id: path.id,
      courseId: path.courseId,
      courseTitle: path.course?.title,
      userId: path.userId,
      targetGoal: path.targetGoal,
      currentLevel: path.currentLevel,
      hoursPerWeek: path.hoursPerWeek,
      aiSummary: path.aiSummary,
      modelName: path.modelName,
      progressPercent: path.progressPercent,
      createdAt: path.createdAt.toISOString(),
      updatedAt: path.updatedAt.toISOString(),
      milestones: path.milestones.map((m: any) => {
        const activeRemediation = m.remediations?.[0];
        return {
          id: m.id,
          learningPathId: m.learningPathId,
          orderIndex: m.orderIndex,
          title: m.title,
          description: m.description,
          estimatedHours: m.estimatedHours,
          passingScore: m.passingScore,
          status: m.status,
          lessonIds: m.lessonIds,
          quizQuestions: m.quizJson || [],
          remediation: activeRemediation
            ? {
                id: activeRemediation.id,
                milestoneId: activeRemediation.milestoneId,
                weaknessAnalysis: activeRemediation.weaknessAnalysis,
                recommendedLessons: activeRemediation.recommendedLessonsJson || [],
                remedialQuestions: activeRemediation.remedialQuestionsJson || [],
                resolved: activeRemediation.resolved,
                createdAt: activeRemediation.createdAt.toISOString(),
              }
            : null,
        };
      }),
    };
  }
}
