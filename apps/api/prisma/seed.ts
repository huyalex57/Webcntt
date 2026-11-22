import {
  PrismaClient,
  Role,
  PlanTier,
  SubscriptionStatus,
  ResourceStatus,
  ResourceTopic,
  ResourceType,
  ResourceLevel,
  ResourceSource,
  ReportReason,
  ReportStatus,
  RunStatus,
} from '@prisma/client';
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

const QUICKSORT_CPP = `#include <bits/stdc++.h>
using namespace std;
// DevStudy Hub • Sandbox C++ (GCC)
int partition(vector<int>& arr, int low, int high) {
  int pivot = arr[high];
  int i = low - 1;
  for (int j = low; j < high; j++) {
    if (arr[j] < pivot) { i++; swap(arr[i], arr[j]); }
  }
  swap(arr[i + 1], arr[high]);
  return i + 1;
}
void quickSort(vector<int>& arr, int low, int high) {
  if (low < high) {
    int pi = partition(arr, low, high);
    quickSort(arr, low, pi - 1);
    quickSort(arr, pi + 1, high);
  }
}
int main() {
  vector<int> data = {64, 34, 25, 12, 22, 11, 90};
  cout << "[INFO] Test array initialized\\n";
  quickSort(data, 0, (int)data.size() - 1);
  cout << "[RESULT] Sorted array: [";
  for (size_t i = 0; i < data.size(); ++i)
    cout << data[i] << (i + 1 < data.size() ? ", " : "]\\n");
  return 0;
}`;

const seedLanguages = [
  {
    slug: 'cpp',
    name: 'C++ (GCC 9.2 / 13.2)',
    judge0Id: 54,
    monacoLanguage: 'cpp',
    extension: 'cpp',
    starterCode: QUICKSORT_CPP,
  },
  {
    slug: 'c',
    name: 'C (GCC 9.2 / 13.2)',
    judge0Id: 50,
    monacoLanguage: 'c',
    extension: 'c',
    starterCode: `#include <stdio.h>
// DevStudy Hub • C (GCC)
int main() {
    printf("Hello, DevStudy Hub!\\n");
    return 0;
}`,
  },
  {
    slug: 'python',
    name: 'Python 3',
    judge0Id: 71,
    monacoLanguage: 'python',
    extension: 'py',
    starterCode: `# DevStudy Hub • Python 3
def main():
    print("Hello, DevStudy Hub!")

if __name__ == "__main__":
    main()`,
  },
  {
    slug: 'java',
    name: 'Java (OpenJDK)',
    judge0Id: 62,
    monacoLanguage: 'java',
    extension: 'java',
    starterCode: `// DevStudy Hub • Java
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, DevStudy Hub!");
    }
}`,
  },
  {
    slug: 'go',
    name: 'Go',
    judge0Id: 60,
    monacoLanguage: 'go',
    extension: 'go',
    starterCode: `package main
// DevStudy Hub • Go
import "fmt"

func main() {
    fmt.Println("Hello, DevStudy Hub!")
}`,
  },
];

const seedResources = [
  {
    id: 'res-ctdl-120',
    title: 'Đề cương & Ngân hàng 120 bài tập Cấu trúc dữ liệu & Giải thuật có lời giải chi tiết',
    description:
      'Bài tập cây nhị phân, đồ thị (Dijkstra, BFS/DFS), sắp xếp và quy hoạch động kèm test case đối chứng bằng C++/Python.',
    topic: ResourceTopic.CTDL,
    type: ResourceType.EXERCISE,
    level: ResourceLevel.INTERMEDIATE,
    format: 'PDF',
    language: 'C++ / Python',
    authorName: 'Khoa KHMT — ĐHQG',
    authorEmail: 'admin@devstudy.edu.vn',
    sourceType: ResourceSource.OFFICIAL,
    status: ResourceStatus.PUBLISHED,
    downloads: 3400,
    rating: 4.9,
    ratingCount: 310,
    fileSize: 19084083,
    fileSizeLabel: '18.2 MB',
    url: 'https://devstudy.edu.vn/library/ctdl-120-bai-tap.pdf',
    tags: ['DSA', 'C++', 'Giữa kỳ'],
  },
  {
    id: 'res-csdl-exam',
    title: 'Tuyển tập đề thi cuối kỳ Cơ sở dữ liệu & Thiết kế hệ thống (2020–2024)',
    description:
      'Sơ đồ ERD, chuẩn hoá 1NF–BCNF, đại số quan hệ và câu truy vấn SQL lồng phức tạp.',
    topic: ResourceTopic.CSDL,
    type: ResourceType.EXAM,
    level: ResourceLevel.INTERMEDIATE,
    format: 'PDF',
    language: 'SQL',
    authorName: 'Khoa KHMT — ĐHQG',
    authorEmail: 'admin@devstudy.edu.vn',
    sourceType: ResourceSource.OFFICIAL,
    status: ResourceStatus.PUBLISHED,
    downloads: 2800,
    rating: 4.8,
    ratingCount: 185,
    fileSize: 44564480,
    fileSizeLabel: '42.5 MB',
    url: 'https://devstudy.edu.vn/library/csdl-de-thi-2020-2024.pdf',
    tags: ['ERD', 'BCNF', 'SQL'],
  },
  {
    id: 'res-sql-cheatsheet',
    title: 'Cheat-sheet tối ưu hoá câu lệnh SQL & thiết kế Index B-Tree / Hash Index',
    description:
      'Phân tích EXPLAIN ANALYZE, chiến lược đánh chỉ mục cho cột lọc, tránh full table scan và xử lý deadlock.',
    topic: ResourceTopic.CSDL,
    type: ResourceType.CHEATSHEET,
    level: ResourceLevel.ADVANCED,
    format: 'PDF',
    language: 'PostgreSQL',
    authorName: 'Cộng đồng SV CNTT',
    authorEmail: 'huy.nd@edu.vn',
    sourceType: ResourceSource.COMMUNITY,
    status: ResourceStatus.PUBLISHED,
    downloads: 4100,
    rating: 5.0,
    ratingCount: 420,
    fileSize: 5033164,
    fileSizeLabel: '4.8 MB',
    url: 'https://devstudy.edu.vn/library/postgresql-index-cheatsheet.pdf',
    tags: ['PostgreSQL', 'Indexing'],
  },
  {
    id: 'res-oop-java',
    title: 'Slide bài giảng Lập trình hướng đối tượng với Java — Chương 1–8',
    description:
      'Lớp, đối tượng, kế thừa, đa hình, interface, abstract class và design pattern cơ bản.',
    topic: ResourceTopic.OOP,
    type: ResourceType.SLIDE,
    level: ResourceLevel.BEGINNER,
    format: 'PDF',
    language: 'Java',
    authorName: 'TS. Trần Minh Tuấn',
    authorEmail: 'tuan.tm@hust.edu.vn',
    sourceType: ResourceSource.LECTURER,
    status: ResourceStatus.PUBLISHED,
    downloads: 2600,
    rating: 4.7,
    ratingCount: 210,
    fileSize: 13002342,
    fileSizeLabel: '12.4 MB',
    url: 'https://devstudy.edu.vn/library/oop-java-ch1-8.pdf',
    tags: ['Java', 'OOP', 'Slide'],
  },
  {
    id: 'res-hdh-pthreads',
    title: 'Giáo trình Hệ điều hành: Tiến trình, luồng & Đồng bộ hoá (POSIX Threads)',
    description:
      'Quản lý tiến trình, lập lịch CPU, deadlock, bộ nhớ ảo và lập trình đa luồng.',
    topic: ResourceTopic.HDH,
    type: ResourceType.TEXTBOOK,
    level: ResourceLevel.INTERMEDIATE,
    format: 'PDF',
    language: 'C',
    authorName: 'ĐH Bách Khoa',
    authorEmail: 'admin@devstudy.edu.vn',
    sourceType: ResourceSource.OFFICIAL,
    status: ResourceStatus.PUBLISHED,
    downloads: 1900,
    rating: 4.8,
    ratingCount: 150,
    fileSize: 26843545,
    fileSizeLabel: '25.6 MB',
    url: 'https://devstudy.edu.vn/library/hdh-posix-threads.pdf',
    tags: ['HĐH', 'Threads'],
  },
  {
    id: 'res-mang-midterm',
    title: 'Đề thi giữa kỳ Mạng máy tính 2024 + đáp án chi tiết',
    description:
      'Mô hình OSI/TCP-IP, định tuyến, TCP congestion control, DNS và bảo mật mạng.',
    topic: ResourceTopic.MANG,
    type: ResourceType.EXAM,
    level: ResourceLevel.INTERMEDIATE,
    format: 'PDF',
    language: 'Tiếng Việt',
    authorName: 'Khoa CNTT — PTIT',
    authorEmail: 'admin@devstudy.edu.vn',
    sourceType: ResourceSource.OFFICIAL,
    status: ResourceStatus.PUBLISHED,
    downloads: 2200,
    rating: 4.6,
    ratingCount: 132,
    fileSize: 9542041,
    fileSizeLabel: '9.1 MB',
    url: 'https://devstudy.edu.vn/library/mang-may-tinh-gk-2024.pdf',
    tags: ['Mạng', 'Giữa kỳ'],
  },
  {
    id: 'res-python-pending',
    title: 'Bài tập lớn: Xây dựng hệ thống quản lý thư viện bằng Python & SQLite',
    description:
      'Đồ án môn học kèm source code, ERD, test case và hướng dẫn báo cáo chi tiết cho sinh viên năm 2.',
    topic: ResourceTopic.CSDL,
    type: ResourceType.SOURCE,
    level: ResourceLevel.BEGINNER,
    format: 'ZIP',
    language: 'Python',
    authorName: 'Nguyễn Đức Huy',
    authorEmail: 'huy.nd@edu.vn',
    sourceType: ResourceSource.COMMUNITY,
    status: ResourceStatus.PENDING,
    downloads: 0,
    rating: 0,
    ratingCount: 0,
    fileSize: 6606028,
    fileSizeLabel: '6.3 MB',
    url: 'https://devstudy.edu.vn/library/btl-quan-ly-thu-vien-python.zip',
    tags: ['Python', 'Đồ án'],
  },
  {
    id: 'res-git-docker',
    title: 'Cheat-sheet Git & Docker cho sinh viên năm 3',
    description:
      'Lệnh Git thường dùng, Dockerfile mẫu, docker-compose và quy trình CI cơ bản.',
    topic: ResourceTopic.WEB_CLOUD,
    type: ResourceType.CHEATSHEET,
    level: ResourceLevel.BEGINNER,
    format: 'PDF',
    language: 'Bash',
    authorName: 'Cộng đồng SV CNTT',
    authorEmail: 'linh.tt@edu.vn',
    sourceType: ResourceSource.COMMUNITY,
    status: ResourceStatus.PUBLISHED,
    downloads: 3100,
    rating: 4.8,
    ratingCount: 260,
    fileSize: 2202009,
    fileSizeLabel: '2.1 MB',
    url: 'https://devstudy.edu.vn/library/git-docker-cheatsheet.pdf',
    tags: ['Git', 'Docker'],
  },
  {
    id: 'res-ai-sklearn',
    title: 'Giáo trình Trí tuệ nhân tạo: Học máy cơ bản với Python & scikit-learn',
    description:
      'Hồi quy, phân loại, cây quyết định, đánh giá mô hình và bài tập thực hành.',
    topic: ResourceTopic.AI_DS,
    type: ResourceType.TEXTBOOK,
    level: ResourceLevel.INTERMEDIATE,
    format: 'PDF',
    language: 'Python',
    authorName: 'ĐH Công nghệ Thông tin',
    authorEmail: 'bao.tq@hust.edu.vn',
    sourceType: ResourceSource.OFFICIAL,
    status: ResourceStatus.PUBLISHED,
    downloads: 1700,
    rating: 4.7,
    ratingCount: 140,
    fileSize: 32505856,
    fileSizeLabel: '31.0 MB',
    url: 'https://devstudy.edu.vn/library/ai-ml-sklearn.pdf',
    tags: ['AI', 'ML'],
  },
  {
    id: 'res-web-fullstack',
    title: 'Slide: Lập trình Web Fullstack — React, Node.js & PostgreSQL',
    description:
      'Component, hooks, REST API, JWT auth, Prisma và deploy sản phẩm demo.',
    topic: ResourceTopic.WEB_CLOUD,
    type: ResourceType.SLIDE,
    level: ResourceLevel.INTERMEDIATE,
    format: 'PDF',
    language: 'TypeScript',
    authorName: 'ThS. Tạ Quang Bảo',
    authorEmail: 'bao.tq@hust.edu.vn',
    sourceType: ResourceSource.LECTURER,
    status: ResourceStatus.PUBLISHED,
    downloads: 2900,
    rating: 4.9,
    ratingCount: 230,
    fileSize: 16462643,
    fileSizeLabel: '15.7 MB',
    url: 'https://devstudy.edu.vn/library/web-fullstack-react-node.pdf',
    tags: ['React', 'Node.js'],
  },
  {
    id: 'res-sec-rejected',
    title: 'Tài liệu: An toàn thông tin — mã hoá đối xứng & bất đối xứng',
    description: 'AES, RSA, chữ ký số, TLS và các dạng tấn công phổ biến.',
    topic: ResourceTopic.MANG,
    type: ResourceType.TEXTBOOK,
    level: ResourceLevel.ADVANCED,
    format: 'PDF',
    language: 'Tiếng Việt',
    authorName: 'Học viện KTQS',
    authorEmail: 'huy.nd@edu.vn',
    sourceType: ResourceSource.COMMUNITY,
    status: ResourceStatus.REJECTED,
    rejectionReason: 'Thiếu thông tin trích dẫn bản quyền tác giả gốc',
    downloads: 120,
    rating: 3.9,
    ratingCount: 12,
    fileSize: 8808038,
    fileSizeLabel: '8.4 MB',
    url: 'https://devstudy.edu.vn/library/attt-ma-hoa.pdf',
    tags: ['Bảo mật'],
  },
];

function slugifyTag(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'tag';
}

async function main() {
  console.log('🌱 Seeding database...');

  const userMap = new Map<string, string>();

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

    userMap.set(user.email, createdUser.id);

    await prisma.subscription.upsert({
      where: { userId: createdUser.id },
      update: {
        tier: user.plan,
        status: SubscriptionStatus.ACTIVE,
        expiresAt:
          user.plan === PlanTier.PREMIUM
            ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
            : null,
      },
      create: {
        userId: createdUser.id,
        tier: user.plan,
        status: SubscriptionStatus.ACTIVE,
        expiresAt:
          user.plan === PlanTier.PREMIUM
            ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
            : null,
      },
    });

    console.log(`✓ Seeded user: ${user.email} (${user.role} - ${user.plan})`);
  }

  // Seed Programming Languages (Issue #36)
  const languageMap = new Map<string, string>();
  for (const lang of seedLanguages) {
    const createdLang = await prisma.language.upsert({
      where: { slug: lang.slug },
      update: {
        name: lang.name,
        judge0Id: lang.judge0Id,
        monacoLanguage: lang.monacoLanguage,
        extension: lang.extension,
        starterCode: lang.starterCode,
        isActive: true,
      },
      create: lang,
    });
    languageMap.set(lang.slug, createdLang.id);
    console.log(`✓ Seeded language: ${lang.name} (judge0Id=${lang.judge0Id})`);
  }

  // Seed Sample Resources (Issue #34)
  for (const item of seedResources) {
    const authorId = userMap.get(item.authorEmail) ?? userMap.get('admin@devstudy.edu.vn')!;
    const resource = await prisma.resource.upsert({
      where: { id: item.id },
      update: {
        title: item.title,
        description: item.description,
        topic: item.topic,
        type: item.type,
        level: item.level,
        format: item.format,
        language: item.language,
        sourceType: item.sourceType,
        status: item.status,
        rejectionReason: item.rejectionReason ?? null,
        fileSize: item.fileSize,
        fileSizeLabel: item.fileSizeLabel,
        url: item.url,
        authorName: item.authorName,
      },
      create: {
        id: item.id,
        title: item.title,
        description: item.description,
        topic: item.topic,
        type: item.type,
        level: item.level,
        format: item.format,
        language: item.language,
        sourceType: item.sourceType,
        status: item.status,
        rejectionReason: item.rejectionReason ?? null,
        downloads: item.downloads,
        rating: item.rating,
        ratingCount: item.ratingCount,
        fileSize: item.fileSize,
        fileSizeLabel: item.fileSizeLabel,
        url: item.url,
        authorName: item.authorName,
        authorId,
      },
    });

    for (const tagName of item.tags) {
      const slug = slugifyTag(tagName);
      const tag = await prisma.tag.upsert({
        where: { slug },
        update: { name: tagName },
        create: { name: tagName, slug },
      });
      await prisma.resourceTag.upsert({
        where: { resourceId_tagId: { resourceId: resource.id, tagId: tag.id } },
        update: {},
        create: { resourceId: resource.id, tagId: tag.id },
      });
    }
  }
  console.log(`✓ Seeded ${seedResources.length} learning resources`);

  // Seed Sample Review & Report
  const studentId = userMap.get('huy.nd@edu.vn')!;
  const lecturerId = userMap.get('tuan.tm@hust.edu.vn')!;

  const existingReviews = await prisma.resourceReview.count({
    where: { resourceId: 'res-ctdl-120' },
  });
  if (existingReviews === 0) {
    const parent = await prisma.resourceReview.create({
      data: {
        resourceId: 'res-ctdl-120',
        userId: studentId,
        rating: 5,
        content: 'Tài liệu cực kỳ chi tiết, phần đồ thị Dijkstra và quy hoạch động có test case rất rõ ràng!',
      },
    });
    await prisma.resourceReview.create({
      data: {
        resourceId: 'res-ctdl-120',
        userId: lecturerId,
        parentId: parent.id,
        content: 'Cảm ơn em đã đánh giá, thầy sẽ bổ sung thêm phần Segment Tree trong bản cập nhật tới.',
      },
    });
  }

  const existingReports = await prisma.report.count();
  if (existingReports === 0) {
    await prisma.report.create({
      data: {
        resourceId: 'res-git-docker',
        reporterId: lecturerId,
        reason: ReportReason.SAI_LECH,
        detail: 'Một số lệnh docker-compose v1 đã cũ, cần cập nhật sang cú pháp docker compose v2.',
        status: ReportStatus.OPEN,
      },
    });
  }

  // Seed Sample Code Snippets for student
  const existingSnippets = await prisma.codeSnippet.count({
    where: { userId: studentId },
  });
  if (existingSnippets === 0) {
    await prisma.codeSnippet.createMany({
      data: [
        {
          title: 'binary_search_tree.cpp',
          languageId: languageMap.get('cpp')!,
          userId: studentId,
          code: `#include <bits/stdc++.h>
using namespace std;
struct Node { int val; Node *l, *r; };
Node* insert(Node* root, int v) {
  if (!root) return new Node{v, nullptr, nullptr};
  if (v < root->val) root->l = insert(root->l, v);
  else root->r = insert(root->r, v);
  return root;
}
int main() { cout << "BST OK\\n"; }`,
          isPublic: true,
          lastRunStatus: RunStatus.AC,
        },
        {
          title: 'hello_python.py',
          languageId: languageMap.get('python')!,
          userId: studentId,
          code: `def fib(n):
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a

print("Fib(10) =", fib(10))`,
          isPublic: false,
          lastRunStatus: RunStatus.AC,
        },
      ],
    });
    console.log('✓ Seeded sample code snippets');
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
