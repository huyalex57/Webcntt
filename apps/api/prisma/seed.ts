import crypto from 'crypto';
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
import { seedPracticeBankAndHistory } from './seed-questions.js';

const prisma = new PrismaClient();

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

interface SeedUserConfig {
  email: string;
  password: string;
  displayName: string;
  role: Role;
  plan: PlanTier;
  subscriptionStatus?: SubscriptionStatus;
  studentId?: string;
  university: string;
  major: string;
  bio: string;
}

const demoUsers: SeedUserConfig[] = [
  {
    email: 'huy.nd@edu.vn',
    password: 'password123',
    displayName: 'Nguyễn Đức Huy',
    role: Role.STUDENT,
    plan: PlanTier.FREE,
    subscriptionStatus: SubscriptionStatus.ACTIVE,
    studentId: '20210001',
    university: 'ĐH Bách Khoa Hà Nội',
    major: 'Khoa học Máy tính',
    bio: 'Sinh viên năm 3 KHMT — Đang ôn luyện CTDL & Giải thuật và CSDL PostgreSQL.',
  },
  {
    email: 'linh.tt@edu.vn',
    password: 'password123',
    displayName: 'Trần Thị Linh',
    role: Role.STUDENT,
    plan: PlanTier.PREMIUM,
    subscriptionStatus: SubscriptionStatus.ACTIVE,
    studentId: '20210002',
    university: 'ĐH Công nghệ — ĐHQGHN',
    major: 'Kỹ thuật Phần mềm',
    bio: 'Hội viên Student Premium — Quan tâm Fullstack TypeScript, DevOps và AI RAG.',
  },
  {
    email: 'trang.lt@edu.vn',
    password: 'password123',
    displayName: 'Lê Thuỳ Trang',
    role: Role.STUDENT,
    plan: PlanTier.FREE,
    subscriptionStatus: SubscriptionStatus.EXPIRED,
    studentId: '20220089',
    university: 'ĐH Khoa học Tự nhiên — ĐHQG TP.HCM',
    major: 'Khoa học Dữ liệu',
    bio: 'Sinh viên ngành Khoa học Dữ liệu — Gói Premium đã hết hạn, hệ thống tự động áp dụng hạn mức FREE (Business Flow §8).',
  },
  {
    email: 'tuan.tm@hust.edu.vn',
    password: 'password123',
    displayName: 'TS. Trần Minh Tuấn',
    role: Role.LECTURER,
    plan: PlanTier.FREE,
    subscriptionStatus: SubscriptionStatus.ACTIVE,
    studentId: 'GV201501',
    university: 'ĐH Bách Khoa Hà Nội',
    major: 'Khoa học Máy tính',
    bio: 'Giảng viên bộ môn Khoa học Máy tính — Phụ trách học phần OOP Java & Hệ điều hành.',
  },
  {
    email: 'bao.tq@hust.edu.vn',
    password: 'password123',
    displayName: 'ThS. Tạ Quang Bảo',
    role: Role.LECTURER,
    plan: PlanTier.PREMIUM,
    subscriptionStatus: SubscriptionStatus.ACTIVE,
    studentId: 'GV201802',
    university: 'ĐH Bách Khoa Hà Nội',
    major: 'Hệ thống Thông tin',
    bio: 'Giảng viên (Gói Premium) — Phụ trách Lập trình Web Fullstack, CTDL nâng cao và tổ chức thi lập trình trực tuyến.',
  },
  {
    email: 'viet.lh@devstudy.edu.vn',
    password: 'password123',
    displayName: 'KTS. Lê Hoàng Việt',
    role: Role.LECTURER,
    plan: PlanTier.PREMIUM,
    subscriptionStatus: SubscriptionStatus.ACTIVE,
    studentId: 'GV201905',
    university: 'ĐH Công nghệ — ĐHQGHN',
    major: 'Hệ thống Phân tán & Mạng',
    bio: 'Principal Solutions Architect & Giảng viên thỉnh giảng — Chuyên gia Go, Microservices & Cloud Native.',
  },
  {
    email: 'mod@devstudy.edu.vn',
    password: 'password123',
    displayName: 'Ban Kiểm Duyệt Nội Dung',
    role: Role.MODERATOR,
    plan: PlanTier.FREE,
    subscriptionStatus: SubscriptionStatus.ACTIVE,
    university: 'DevStudy Hub',
    major: 'Kiểm duyệt học liệu',
    bio: 'Moderator chuyên trách phê duyệt học liệu PENDING và xử lý báo cáo vi phạm bản quyền/nội dung.',
  },
  {
    email: 'admin@devstudy.edu.vn',
    password: 'password123',
    displayName: 'Quản Trị Viên Hệ Thống',
    role: Role.ADMIN,
    plan: PlanTier.PREMIUM,
    subscriptionStatus: SubscriptionStatus.ACTIVE,
    university: 'DevStudy Hub',
    major: 'Vận hành hệ thống',
    bio: 'Quản trị viên toàn quyền: quản lý role, gói dịch vụ, cấu hình quota, thanh toán và đối soát AuditLog.',
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

interface SeedResourceConfig {
  id: string;
  title: string;
  description: string;
  topic: ResourceTopic;
  type: ResourceType;
  level: ResourceLevel;
  format: string;
  language: string;
  authorName: string;
  authorEmail: string;
  sourceType: ResourceSource;
  status: ResourceStatus;
  rejectionReason?: string;
  downloads: number;
  rating: number;
  ratingCount: number;
  fileSize: number;
  fileSizeLabel: string;
  url: string;
  tags: string[];
}

const seedResources: SeedResourceConfig[] = [
  {
    id: 'res-ctdl-120',
    title: 'Đề cương & Ngân hàng 120 bài tập Cấu trúc dữ liệu & Giải thuật có lời giải chi tiết',
    description:
      'Bài tập cây nhị phân, cây cân bằng AVL/Red-Black, đồ thị (Dijkstra, BFS/DFS, Kruskal), sắp xếp và quy hoạch động kèm test case đối chứng bằng C++/Python.',
    topic: ResourceTopic.CTDL,
    type: ResourceType.EXERCISE,
    level: ResourceLevel.INTERMEDIATE,
    format: 'PDF',
    language: 'C++ / Python',
    authorName: 'Khoa KHMT — ĐHQG',
    authorEmail: 'admin@devstudy.edu.vn',
    sourceType: ResourceSource.OFFICIAL,
    status: ResourceStatus.PUBLISHED,
    downloads: 3420,
    rating: 4.9,
    ratingCount: 312,
    fileSize: 19084083,
    fileSizeLabel: '18.2 MB',
    url: 'https://devstudy.edu.vn/library/ctdl-120-bai-tap.pdf',
    tags: ['DSA', 'C++', 'Python', 'Giữa kỳ'],
  },
  {
    id: 'res-csdl-exam',
    title: 'Tuyển tập đề thi cuối kỳ Cơ sở dữ liệu & Thiết kế hệ thống (2021–2026)',
    description:
      'Tổng hợp 15 đề thi chính thức kèm đáp án: sơ đồ ERD, chuẩn hoá 1NF–BCNF, đại số quan hệ, tối ưu truy vấn SQL lồng và thiết kế Transaction/Isolation Level.',
    topic: ResourceTopic.CSDL,
    type: ResourceType.EXAM,
    level: ResourceLevel.INTERMEDIATE,
    format: 'PDF',
    language: 'SQL',
    authorName: 'Khoa KHMT — ĐHQG',
    authorEmail: 'admin@devstudy.edu.vn',
    sourceType: ResourceSource.OFFICIAL,
    status: ResourceStatus.PUBLISHED,
    downloads: 2850,
    rating: 4.8,
    ratingCount: 189,
    fileSize: 44564480,
    fileSizeLabel: '42.5 MB',
    url: 'https://devstudy.edu.vn/library/csdl-de-thi-2020-2024.pdf',
    tags: ['ERD', 'BCNF', 'SQL', 'Cuối kỳ'],
  },
  {
    id: 'res-sql-cheatsheet',
    title: 'Cheat-sheet tối ưu hoá câu lệnh SQL & thiết kế Index B-Tree / Hash Index',
    description:
      'Phân tích EXPLAIN ANALYZE trên PostgreSQL, chiến lược đánh chỉ mục composite, covering index, tránh full table scan và xử lý deadlock trong hệ thống tải cao.',
    topic: ResourceTopic.CSDL,
    type: ResourceType.CHEATSHEET,
    level: ResourceLevel.ADVANCED,
    format: 'PDF',
    language: 'PostgreSQL',
    authorName: 'Cộng đồng SV CNTT',
    authorEmail: 'huy.nd@edu.vn',
    sourceType: ResourceSource.COMMUNITY,
    status: ResourceStatus.PUBLISHED,
    downloads: 4120,
    rating: 5.0,
    ratingCount: 425,
    fileSize: 5033164,
    fileSizeLabel: '4.8 MB',
    url: 'https://devstudy.edu.vn/library/postgresql-index-cheatsheet.pdf',
    tags: ['PostgreSQL', 'Indexing', 'Performance'],
  },
  {
    id: 'res-oop-java',
    title: 'Slide bài giảng Lập trình hướng đối tượng với Java — Chương 1–10',
    description:
      'Đầy đủ lý thuyết và ví dụ thực hành: Đóng gói, Kế thừa, Đa hình, Trừu tượng, Interface, Generic, Collections Framework, Exception Handling và 5 nguyên lý SOLID.',
    topic: ResourceTopic.OOP,
    type: ResourceType.SLIDE,
    level: ResourceLevel.BEGINNER,
    format: 'PDF',
    language: 'Java',
    authorName: 'TS. Trần Minh Tuấn',
    authorEmail: 'tuan.tm@hust.edu.vn',
    sourceType: ResourceSource.LECTURER,
    status: ResourceStatus.PUBLISHED,
    downloads: 2640,
    rating: 4.7,
    ratingCount: 214,
    fileSize: 13002342,
    fileSizeLabel: '12.4 MB',
    url: 'https://devstudy.edu.vn/library/oop-java-ch1-8.pdf',
    tags: ['Java', 'OOP', 'SOLID', 'Slide'],
  },
  {
    id: 'res-oop-design-patterns',
    title: 'Sổ tay 23 mẫu thiết kế GoF (Design Patterns) minh hoạ bằng Java & TypeScript',
    description:
      'Phân tích chi tiết nhóm Creational (Singleton, Factory, Builder), Structural (Adapter, Decorator, Proxy) và Behavioral (Strategy, Observer, Command) kèm UML và source code.',
    topic: ResourceTopic.OOP,
    type: ResourceType.TEXTBOOK,
    level: ResourceLevel.ADVANCED,
    format: 'PDF',
    language: 'Java / TypeScript',
    authorName: 'TS. Trần Minh Tuấn',
    authorEmail: 'tuan.tm@hust.edu.vn',
    sourceType: ResourceSource.LECTURER,
    status: ResourceStatus.PUBLISHED,
    downloads: 1980,
    rating: 4.9,
    ratingCount: 165,
    fileSize: 22544384,
    fileSizeLabel: '21.5 MB',
    url: 'https://devstudy.edu.vn/library/gof-design-patterns-java-ts.pdf',
    tags: ['Design Patterns', 'UML', 'Java', 'TypeScript'],
  },
  {
    id: 'res-hdh-pthreads',
    title: 'Giáo trình Hệ điều hành: Tiến trình, luồng & Đồng bộ hoá (POSIX Threads)',
    description:
      'Quản lý tiến trình, lập lịch CPU (CFS, Round Robin), điều kiện Coffman gây deadlock, quản lý bộ nhớ ảo (Paging, TLB) và lập trình đa luồng trên Linux với C.',
    topic: ResourceTopic.HDH,
    type: ResourceType.TEXTBOOK,
    level: ResourceLevel.INTERMEDIATE,
    format: 'PDF',
    language: 'C',
    authorName: 'ĐH Bách Khoa Hà Nội',
    authorEmail: 'admin@devstudy.edu.vn',
    sourceType: ResourceSource.OFFICIAL,
    status: ResourceStatus.PUBLISHED,
    downloads: 1950,
    rating: 4.8,
    ratingCount: 152,
    fileSize: 26843545,
    fileSizeLabel: '25.6 MB',
    url: 'https://devstudy.edu.vn/library/hdh-posix-threads.pdf',
    tags: ['HĐH', 'Threads', 'Linux', 'C'],
  },
  {
    id: 'res-hdh-go-concurrency',
    title: 'Bài tập thực hành: Lập trình đồng thời với Goroutines, Channels & Mutex (Go)',
    description:
      'Bộ 15 bài lab thực hành xử lý đồng thời, phát hiện race condition với go test -race, worker pool pattern, context cancellation và so sánh với OS threads.',
    topic: ResourceTopic.HDH,
    type: ResourceType.EXERCISE,
    level: ResourceLevel.ADVANCED,
    format: 'ZIP',
    language: 'Go',
    authorName: 'KTS. Lê Hoàng Việt',
    authorEmail: 'viet.lh@devstudy.edu.vn',
    sourceType: ResourceSource.LECTURER,
    status: ResourceStatus.PUBLISHED,
    downloads: 1120,
    rating: 4.8,
    ratingCount: 84,
    fileSize: 3355443,
    fileSizeLabel: '3.2 MB',
    url: 'https://devstudy.edu.vn/library/go-concurrency-labs.zip',
    tags: ['Go', 'Concurrency', 'Goroutines'],
  },
  {
    id: 'res-mang-midterm',
    title: 'Đề thi giữa kỳ & cuối kỳ Mạng máy tính 2025–2026 + Đáp án chi tiết',
    description:
      'Mô hình OSI & TCP/IP, chia mạng con VLSM/CIDR, định tuyến OSPF/BGP, phân tích gói tin Wireshark, TCP congestion control, DNS và TLS 1.3 handshake.',
    topic: ResourceTopic.MANG,
    type: ResourceType.EXAM,
    level: ResourceLevel.INTERMEDIATE,
    format: 'PDF',
    language: 'Tiếng Việt',
    authorName: 'Khoa CNTT — PTIT',
    authorEmail: 'admin@devstudy.edu.vn',
    sourceType: ResourceSource.OFFICIAL,
    status: ResourceStatus.PUBLISHED,
    downloads: 2240,
    rating: 4.6,
    ratingCount: 138,
    fileSize: 9542041,
    fileSizeLabel: '9.1 MB',
    url: 'https://devstudy.edu.vn/library/mang-may-tinh-gk-2024.pdf',
    tags: ['Mạng', 'TCP/IP', 'Wireshark', 'Giữa kỳ'],
  },
  {
    id: 'res-ctdl-avl-video',
    title: 'Video bài giảng: Cây AVL & Red-Black Tree — Cân bằng cây tìm kiếm nhị phân',
    description:
      'Bài giảng video 45 phút kèm minh hoạ trực quan từng phép xoay đơn/kép (LL, RR, LR, RL), cài đặt chèn/xoá nút bằng C++ và phân tích độ phức tạp O(log n).',
    topic: ResourceTopic.CTDL,
    type: ResourceType.VIDEO,
    level: ResourceLevel.ADVANCED,
    format: 'MP4',
    language: 'Tiếng Việt / C++',
    authorName: 'ThS. Tạ Quang Bảo',
    authorEmail: 'bao.tq@hust.edu.vn',
    sourceType: ResourceSource.LECTURER,
    status: ResourceStatus.PUBLISHED,
    downloads: 1580,
    rating: 4.9,
    ratingCount: 104,
    fileSize: 152043520,
    fileSizeLabel: '145.0 MB',
    url: 'https://devstudy.edu.vn/library/video-avl-red-black-tree.mp4',
    tags: ['AVL', 'Red-Black Tree', 'DSA', 'Video'],
  },
  {
    id: 'res-ctdl-final-bank',
    title: 'Bộ đề ôn tập cuối kỳ CTDL: 200 câu trắc nghiệm + 30 bài code chuẩn ICPC',
    description:
      'Ngân hàng câu hỏi trắc nghiệm đánh giá độ phức tạp thuật toán, cấu trúc bảng băm, heap, đồ thị và 30 bài lập trình tự luyện có bộ test chuẩn.',
    topic: ResourceTopic.CTDL,
    type: ResourceType.EXAM,
    level: ResourceLevel.ADVANCED,
    format: 'PDF',
    language: 'C++',
    authorName: 'Khoa KHMT — ĐHQG',
    authorEmail: 'admin@devstudy.edu.vn',
    sourceType: ResourceSource.OFFICIAL,
    status: ResourceStatus.PUBLISHED,
    downloads: 3650,
    rating: 4.9,
    ratingCount: 295,
    fileSize: 12478054,
    fileSizeLabel: '11.9 MB',
    url: 'https://devstudy.edu.vn/library/ctdl-200-mcq-30-code.pdf',
    tags: ['DSA', 'Cuối kỳ', 'ICPC'],
  },
  {
    id: 'res-git-docker',
    title: 'Cheat-sheet Git Flow, Docker & CI/CD GitHub Actions cho sinh viên CNTT',
    description:
      'Tổng hợp lệnh Git rebase/cherry-pick, tối ưu multi-stage Dockerfile, cấu hình Docker Compose cho Postgres/Redis và pipeline kiểm thử tự động.',
    topic: ResourceTopic.WEB_CLOUD,
    type: ResourceType.CHEATSHEET,
    level: ResourceLevel.BEGINNER,
    format: 'PDF',
    language: 'Bash / YAML',
    authorName: 'Trần Thị Linh',
    authorEmail: 'linh.tt@edu.vn',
    sourceType: ResourceSource.COMMUNITY,
    status: ResourceStatus.PUBLISHED,
    downloads: 3150,
    rating: 4.8,
    ratingCount: 264,
    fileSize: 2202009,
    fileSizeLabel: '2.1 MB',
    url: 'https://devstudy.edu.vn/library/git-docker-cheatsheet.pdf',
    tags: ['Git', 'Docker', 'CI/CD'],
  },
  {
    id: 'res-ai-sklearn',
    title: 'Giáo trình Trí tuệ nhân tạo: Học máy cơ bản với Python & scikit-learn',
    description:
      'Hồi quy tuyến tính, Logistic Regression, SVM, Cây quyết định, Random Forest, K-Means, chống Overfitting và quy trình đánh giá mô hình Cross-Validation.',
    topic: ResourceTopic.AI_DS,
    type: ResourceType.TEXTBOOK,
    level: ResourceLevel.INTERMEDIATE,
    format: 'PDF',
    language: 'Python',
    authorName: 'ĐH Công nghệ Thông tin',
    authorEmail: 'bao.tq@hust.edu.vn',
    sourceType: ResourceSource.OFFICIAL,
    status: ResourceStatus.PUBLISHED,
    downloads: 1760,
    rating: 4.7,
    ratingCount: 145,
    fileSize: 32505856,
    fileSizeLabel: '31.0 MB',
    url: 'https://devstudy.edu.vn/library/ai-ml-sklearn.pdf',
    tags: ['AI', 'ML', 'Python'],
  },
  {
    id: 'res-ai-rag-source',
    title: 'Source code mẫu: Xây dựng trợ lý AI hỏi đáp giáo trình với RAG & Vector DB',
    description:
      'Dự án mẫu bằng Python + FastAPI + pgvector: bóc tách PDF giáo trình, tạo embedding, tìm kiếm ngữ nghĩa và sinh câu hỏi ôn tập theo schema JSON (Zod/Pydantic).',
    topic: ResourceTopic.AI_DS,
    type: ResourceType.SOURCE,
    level: ResourceLevel.ADVANCED,
    format: 'ZIP',
    language: 'Python',
    authorName: 'ThS. Tạ Quang Bảo',
    authorEmail: 'bao.tq@hust.edu.vn',
    sourceType: ResourceSource.LECTURER,
    status: ResourceStatus.PUBLISHED,
    downloads: 1430,
    rating: 4.9,
    ratingCount: 118,
    fileSize: 9122611,
    fileSizeLabel: '8.7 MB',
    url: 'https://devstudy.edu.vn/library/rag-pgvector-edu-assistant.zip',
    tags: ['RAG', 'LLM', 'FastAPI', 'pgvector'],
  },
  {
    id: 'res-web-fullstack',
    title: 'Slide: Lập trình Web Fullstack — React, Node.js, Express 5 & PostgreSQL',
    description:
      'Kiến trúc Monorepo, React Hook Form, TanStack Query, REST API chuẩn, xác thực JWT + Refresh Token Rotation, Prisma ORM và bảo mật OWASP Top 10.',
    topic: ResourceTopic.WEB_CLOUD,
    type: ResourceType.SLIDE,
    level: ResourceLevel.INTERMEDIATE,
    format: 'PDF',
    language: 'TypeScript',
    authorName: 'ThS. Tạ Quang Bảo',
    authorEmail: 'bao.tq@hust.edu.vn',
    sourceType: ResourceSource.LECTURER,
    status: ResourceStatus.PUBLISHED,
    downloads: 2940,
    rating: 4.9,
    ratingCount: 235,
    fileSize: 16462643,
    fileSizeLabel: '15.7 MB',
    url: 'https://devstudy.edu.vn/library/web-fullstack-react-node.pdf',
    tags: ['React', 'Node.js', 'TypeScript', 'Prisma'],
  },
  {
    id: 'res-python-pending',
    title: 'Bài tập lớn: Xây dựng hệ thống quản lý thư viện bằng Python & SQLite',
    description:
      'Đồ án môn học kèm source code, ERD, test case và hướng dẫn báo cáo chi tiết cho sinh viên năm 2 (đang chờ Moderator kiểm duyệt).',
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
    tags: ['Python', 'SQLite', 'Đồ án'],
  },
  {
    id: 'res-k8s-pending',
    title: 'Hướng dẫn triển khai Microservices lên Kubernetes Cluster với Helm & Ingress',
    description:
      'Tài liệu thực hành cấu hình Deployment, StatefulSet, ConfigMap, Secret và giám sát bằng Prometheus/Grafana do giảng viên gửi duyệt.',
    topic: ResourceTopic.WEB_CLOUD,
    type: ResourceType.EXERCISE,
    level: ResourceLevel.ADVANCED,
    format: 'PDF',
    language: 'YAML / Go',
    authorName: 'TS. Trần Minh Tuấn',
    authorEmail: 'tuan.tm@hust.edu.vn',
    sourceType: ResourceSource.LECTURER,
    status: ResourceStatus.PENDING,
    downloads: 0,
    rating: 0,
    ratingCount: 0,
    fileSize: 11744051,
    fileSizeLabel: '11.2 MB',
    url: 'https://devstudy.edu.vn/library/k8s-helm-microservices-lab.pdf',
    tags: ['Kubernetes', 'Docker', 'Microservices'],
  },
  {
    id: 'res-ai-prompt-pending',
    title: 'Cheat-sheet Kỹ thuật Prompt Engineering & Structured Outputs cho lập trình viên',
    description:
      'Tổng hợp mẫu prompt Few-shot, Chain-of-Thought, ép kiểu JSON Schema và phòng chống Prompt Injection khi tích hợp LLM vào ứng dụng web.',
    topic: ResourceTopic.AI_DS,
    type: ResourceType.CHEATSHEET,
    level: ResourceLevel.INTERMEDIATE,
    format: 'PDF',
    language: 'TypeScript / Python',
    authorName: 'Trần Thị Linh',
    authorEmail: 'linh.tt@edu.vn',
    sourceType: ResourceSource.COMMUNITY,
    status: ResourceStatus.PENDING,
    downloads: 0,
    rating: 0,
    ratingCount: 0,
    fileSize: 3670016,
    fileSizeLabel: '3.5 MB',
    url: 'https://devstudy.edu.vn/library/prompt-engineering-cheatsheet.pdf',
    tags: ['LLM', 'Prompt Engineering', 'JSON Schema'],
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
    rejectionReason: 'Thiếu thông tin trích dẫn bản quyền tác giả gốc và scan bị mờ ở chương 3–4.',
    downloads: 120,
    rating: 3.9,
    ratingCount: 12,
    fileSize: 8808038,
    fileSizeLabel: '8.4 MB',
    url: 'https://devstudy.edu.vn/library/attt-ma-hoa.pdf',
    tags: ['Bảo mật', 'Cryptography'],
  },
];

function slugifyTag(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'tag'
  );
}

async function main() {
  console.log('🌱 Seeding database according to DevStudy Hub Workflow & Business Flow...');

  // Clean up ephemeral test accounts left over by integration tests
  await prisma.user.deleteMany({
    where: {
      OR: [
        { email: { startsWith: 'quota_test_' } },
        { email: { startsWith: 'quota_code_' } },
        { email: { startsWith: 'playground_free_' } },
        { email: { startsWith: 'practice_p0_' } },
        { email: { startsWith: 'quota_p2_' } },
      ],
    },
  });

  // 1. Seed Users, Profiles & Subscriptions (Workflow §1.2, §5.1, §6.2 & Business Flow §8)
  const userMap = new Map<string, string>();
  const sharedPasswordHash = await argon2.hash('password123');

  for (const user of demoUsers) {
    const passwordHash =
      user.password === 'password123' ? sharedPasswordHash : await argon2.hash(user.password);
    const subStatus = user.subscriptionStatus ?? SubscriptionStatus.ACTIVE;

    const createdUser = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        displayName: user.displayName,
        role: user.role,
        emailVerified: true,
        profile: {
          upsert: {
            create: {
              studentId: user.studentId,
              university: user.university,
              major: user.major,
              bio: user.bio,
            },
            update: {
              studentId: user.studentId,
              university: user.university,
              major: user.major,
              bio: user.bio,
            },
          },
        },
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
            bio: user.bio,
          },
        },
      },
    });

    userMap.set(user.email, createdUser.id);

    const expiresAt =
      user.plan === PlanTier.PREMIUM && subStatus === SubscriptionStatus.ACTIVE
        ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        : subStatus === SubscriptionStatus.EXPIRED
        ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        : null;

    await prisma.subscription.upsert({
      where: { userId: createdUser.id },
      update: {
        tier: user.plan,
        status: subStatus,
        expiresAt,
      },
      create: {
        userId: createdUser.id,
        tier: user.plan,
        status: subStatus,
        expiresAt,
      },
    });

    console.log(`✓ Seeded user: ${user.email} (${user.role} · ${user.plan} · ${subStatus})`);
  }

  const studentFreeId = userMap.get('huy.nd@edu.vn')!;
  const studentPremiumId = userMap.get('linh.tt@edu.vn')!;
  const studentExpiredId = userMap.get('trang.lt@edu.vn')!;
  const lecturerFreeId = userMap.get('tuan.tm@hust.edu.vn')!;
  const lecturerPremiumId = userMap.get('bao.tq@hust.edu.vn')!;
  const lecturerGoId = userMap.get('viet.lh@devstudy.edu.vn')!;
  const modId = userMap.get('mod@devstudy.edu.vn')!;
  const adminId = userMap.get('admin@devstudy.edu.vn')!;

  // 2. Seed Programming Languages (Workflow §5.5 & Issue #36)
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

  // 3. Seed Learning Resources & Tags (Workflow §5.2 & Business Flow §4.1, §5.1, §6.1)
  for (const item of seedResources) {
    const authorId = userMap.get(item.authorEmail) ?? adminId;
    const isReviewed =
      item.status === ResourceStatus.PUBLISHED || item.status === ResourceStatus.REJECTED;
    const reviewedById = isReviewed
      ? item.sourceType === ResourceSource.OFFICIAL
        ? adminId
        : modId
      : null;
    const reviewedAt = isReviewed ? new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) : null;
    const fileHash = sha256(`devstudy-seed-resource:${item.id}`);

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
        downloads: item.downloads,
        rating: item.rating,
        ratingCount: item.ratingCount,
        fileSize: item.fileSize,
        fileSizeLabel: item.fileSizeLabel,
        fileHash,
        url: item.url,
        authorName: item.authorName,
        authorId,
        reviewedById,
        reviewedAt,
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
        fileHash,
        url: item.url,
        authorName: item.authorName,
        authorId,
        reviewedById,
        reviewedAt,
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
  console.log(`✓ Seeded ${seedResources.length} learning resources across all 7 topics & 7 types`);

  // 4. Seed Collections / Bookmarks (Workflow §5.2 & Business Flow §4.1)
  const seedBookmarks: Array<{ userId: string; resourceId: string }> = [
    { userId: studentFreeId, resourceId: 'res-ctdl-120' },
    { userId: studentFreeId, resourceId: 'res-csdl-exam' },
    { userId: studentFreeId, resourceId: 'res-oop-java' },
    { userId: studentPremiumId, resourceId: 'res-ctdl-120' },
    { userId: studentPremiumId, resourceId: 'res-sql-cheatsheet' },
    { userId: studentPremiumId, resourceId: 'res-web-fullstack' },
    { userId: studentPremiumId, resourceId: 'res-ai-rag-source' },
    { userId: studentPremiumId, resourceId: 'res-ctdl-avl-video' },
    { userId: lecturerFreeId, resourceId: 'res-hdh-pthreads' },
    { userId: lecturerFreeId, resourceId: 'res-ctdl-final-bank' },
  ];

  for (const bm of seedBookmarks) {
    await prisma.collection.upsert({
      where: {
        userId_resourceId: {
          userId: bm.userId,
          resourceId: bm.resourceId,
        },
      },
      update: {},
      create: bm,
    });
  }
  console.log(`✓ Seeded ${seedBookmarks.length} resource bookmarks (collections)`);

  // 5. Seed Threaded Resource Reviews & Replies (Workflow §5.2)
  await prisma.resourceReview.deleteMany({
    where: {
      id: {
        in: [
          'rev-seed-1',
          'rev-seed-1-reply',
          'rev-seed-2',
          'rev-seed-3',
          'rev-seed-3-reply',
          'rev-seed-4',
          'rev-seed-5',
          'rev-seed-5-reply',
          'rev-seed-6',
        ],
      },
    },
  });

  const existingReviewsCount = await prisma.resourceReview.count();
  if (existingReviewsCount <= 4) {
    await prisma.resourceReview.deleteMany({});
  }

  await prisma.resourceReview.upsert({
    where: { id: 'rev-seed-1' },
    update: {},
    create: {
      id: 'rev-seed-1',
      resourceId: 'res-ctdl-120',
      userId: studentFreeId,
      rating: 5,
      content:
        'Tài liệu cực kỳ chi tiết, phần đồ thị Dijkstra và quy hoạch động có test case đối chứng C++ và Python rất rõ ràng!',
    },
  });
  await prisma.resourceReview.upsert({
    where: { id: 'rev-seed-1-reply' },
    update: {},
    create: {
      id: 'rev-seed-1-reply',
      resourceId: 'res-ctdl-120',
      userId: lecturerFreeId,
      parentId: 'rev-seed-1',
      content:
        'Cảm ơn em đã đánh giá! Thầy và bộ môn sẽ bổ sung thêm chuyên đề Segment Tree & Fenwick Tree trong bản cập nhật tới.',
    },
  });
  await prisma.resourceReview.upsert({
    where: { id: 'rev-seed-2' },
    update: {},
    create: {
      id: 'rev-seed-2',
      resourceId: 'res-ctdl-120',
      userId: studentPremiumId,
      rating: 5,
      content:
        'Bộ bài tập cây cân bằng AVL giúp mình ôn thi giữa kỳ đạt điểm tuyệt đối. Đã lưu vào bộ sưu tập!',
    },
  });
  await prisma.resourceReview.upsert({
    where: { id: 'rev-seed-3' },
    update: {},
    create: {
      id: 'rev-seed-3',
      resourceId: 'res-sql-cheatsheet',
      userId: studentPremiumId,
      rating: 5,
      content:
        'Cách đọc EXPLAIN ANALYZE và tối ưu Composite Index B-Tree được tóm tắt rất dễ áp dụng cho đồ án PostgreSQL.',
    },
  });
  await prisma.resourceReview.upsert({
    where: { id: 'rev-seed-3-reply' },
    update: {},
    create: {
      id: 'rev-seed-3-reply',
      resourceId: 'res-sql-cheatsheet',
      userId: lecturerPremiumId,
      parentId: 'rev-seed-3',
      content:
        'Các em lưu ý thêm quy tắc Leftmost Prefix khi đánh chỉ mục ghép trên cặp (status, createdAt) nhé!',
    },
  });
  await prisma.resourceReview.upsert({
    where: { id: 'rev-seed-4' },
    update: {},
    create: {
      id: 'rev-seed-4',
      resourceId: 'res-oop-java',
      userId: studentExpiredId,
      rating: 5,
      content:
        'Slide giải thích 5 nguyên lý SOLID và sự khác biệt giữa Abstract Class vs Interface rất trực quan.',
    },
  });
  await prisma.resourceReview.upsert({
    where: { id: 'rev-seed-5' },
    update: {},
    create: {
      id: 'rev-seed-5',
      resourceId: 'res-web-fullstack',
      userId: studentFreeId,
      rating: 5,
      content:
        'Phần kiến trúc JWT Access Token in-memory kết hợp Refresh Token Rotation httpOnly cookie bám sát thực tế sản phẩm.',
    },
  });
  await prisma.resourceReview.upsert({
    where: { id: 'rev-seed-5-reply' },
    update: {},
    create: {
      id: 'rev-seed-5-reply',
      resourceId: 'res-web-fullstack',
      userId: lecturerPremiumId,
      parentId: 'rev-seed-5',
      content:
        'Đúng rồi em, kết hợp thêm Reuse Detection ở bảng RefreshToken sẽ chặn đứng nguy cơ đánh cắp phiên đăng nhập.',
    },
  });
  await prisma.resourceReview.upsert({
    where: { id: 'rev-seed-6' },
    update: {},
    create: {
      id: 'rev-seed-6',
      resourceId: 'res-ai-rag-source',
      userId: studentPremiumId,
      rating: 5,
      content:
        'Source code mẫu tích hợp Zod schema validation cho JSON đầu ra của LLM chạy rất ổn định, không bị lỗi parse.',
    },
  });
  console.log('✓ Seeded threaded resource reviews & lecturer replies');

  // 6. Seed Violation Reports (Workflow §5.2 & Business Flow §6.2)
  const seedReports = [
    {
      id: 'rep-seed-open-1',
      resourceId: 'res-git-docker',
      reporterId: lecturerFreeId,
      reason: ReportReason.SAI_LECH,
      detail:
        'Một số lệnh docker-compose v1 ở trang 2 đã cũ, cần cập nhật sang cú pháp docker compose v2 và bổ sung cờ read_only cho sandbox.',
      status: ReportStatus.OPEN,
      resolvedById: null,
      resolvedAt: null,
    },
    {
      id: 'rep-seed-open-2',
      resourceId: 'res-mang-midterm',
      reporterId: studentPremiumId,
      reason: ReportReason.SAI_LECH,
      detail:
        'Câu 14 phần chia mạng con VLSM đáp án tính nhầm địa chỉ broadcast của subnet thứ 3 (/26 thay vì /27).',
      status: ReportStatus.OPEN,
      resolvedById: null,
      resolvedAt: null,
    },
    {
      id: 'rep-seed-resolved-1',
      resourceId: 'res-sec-rejected',
      reporterId: lecturerPremiumId,
      reason: ReportReason.BAN_QUYEN,
      detail:
        'Tài liệu scan từ sách giáo khoa thương mại chưa có giấy phép chia sẻ công khai và thiếu trích dẫn tác giả.',
      status: ReportStatus.RESOLVED,
      resolvedById: modId,
      resolvedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
  ];

  for (const rep of seedReports) {
    await prisma.report.upsert({
      where: { id: rep.id },
      update: {
        reason: rep.reason,
        detail: rep.detail,
        status: rep.status,
        resolvedById: rep.resolvedById,
        resolvedAt: rep.resolvedAt,
      },
      create: rep,
    });
  }
  console.log(`✓ Seeded ${seedReports.length} content reports (OPEN & RESOLVED)`);

  // 7. Seed Code Snippets (Workflow §5.5 & Business Flow §4.4)
  // Note: Keep studentFreeId (huy.nd@edu.vn) at 2 snippets so they remain under the FREE limit of 3 snippets
  const seedSnippets = [
    {
      id: 'snip-huy-bst-cpp',
      title: 'binary_search_tree.cpp',
      languageId: languageMap.get('cpp')!,
      userId: studentFreeId,
      code: `#include <bits/stdc++.h>
using namespace std;
struct Node { int val; Node *l, *r; };
Node* insert(Node* root, int v) {
  if (!root) return new Node{v, nullptr, nullptr};
  if (v < root->val) root->l = insert(root->l, v);
  else root->r = insert(root->r, v);
  return root;
}
int main() {
  Node* root = nullptr;
  for (int x : {50, 30, 70, 20, 40}) root = insert(root, x);
  cout << "BST OK\\n";
  return 0;
}`,
      isPublic: true,
      lastRunStatus: RunStatus.AC,
    },
    {
      id: 'snip-huy-fib-py',
      title: 'fibonacci_dp.py',
      languageId: languageMap.get('python')!,
      userId: studentFreeId,
      code: `def fib(n: int) -> int:
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a

if __name__ == "__main__":
    print("Fib(10) =", fib(10))`,
      isPublic: false,
      lastRunStatus: RunStatus.AC,
    },
    {
      id: 'snip-linh-dijkstra-cpp',
      title: 'dijkstra_min_heap.cpp',
      languageId: languageMap.get('cpp')!,
      userId: studentPremiumId,
      code: `#include <bits/stdc++.h>
using namespace std;
using pii = pair<long long, int>;

int main() {
  int n = 5;
  vector<vector<pair<int, int>>> adj(n + 1);
  adj[1].push_back({2, 2}); adj[1].push_back({3, 4});
  adj[2].push_back({3, 1}); adj[3].push_back({5, 3});
  vector<long long> dist(n + 1, 1e18);
  priority_queue<pii, vector<pii>, greater<pii>> pq;
  dist[1] = 0; pq.push({0, 1});
  while (!pq.empty()) {
    auto [d, u] = pq.top(); pq.pop();
    if (d > dist[u]) continue;
    for (auto [v, w] : adj[u]) {
      if (dist[u] + w < dist[v]) {
        dist[v] = dist[u] + w;
        pq.push({dist[v], v});
      }
    }
  }
  cout << "Shortest to 5: " << dist[5] << "\\n";
  return 0;
}`,
      isPublic: true,
      lastRunStatus: RunStatus.AC,
    },
    {
      id: 'snip-linh-segtree-cpp',
      title: 'segment_tree_sum.cpp',
      languageId: languageMap.get('cpp')!,
      userId: studentPremiumId,
      code: `#include <bits/stdc++.h>
using namespace std;

struct SegTree {
  int n;
  vector<long long> tree;
  SegTree(int n) : n(n), tree(4 * n + 1, 0) {}
  void update(int node, int l, int r, int idx, int val) {
    if (l == r) { tree[node] += val; return; }
    int mid = l + (r - l) / 2;
    if (idx <= mid) update(node * 2, l, mid, idx, val);
    else update(node * 2 + 1, mid + 1, r, idx, val);
    tree[node] = tree[node * 2] + tree[node * 2 + 1];
  }
};

int main() {
  SegTree st(8);
  st.update(1, 1, 8, 3, 42);
  cout << "Root sum: " << st.tree[1] << "\\n";
}`,
      isPublic: true,
      lastRunStatus: RunStatus.AC,
    },
    {
      id: 'snip-linh-lru-java',
      title: 'LRUCache.java',
      languageId: languageMap.get('java')!,
      userId: studentPremiumId,
      code: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Map<Integer, String> cache = new LinkedHashMap<>(16, 0.75f, true);
        cache.put(1, "Page A");
        cache.put(2, "Page B");
        System.out.println("Loaded: " + cache.get(1));
    }
}`,
      isPublic: true,
      lastRunStatus: RunStatus.AC,
    },
    {
      id: 'snip-linh-worker-go',
      title: 'worker_pool.go',
      languageId: languageMap.get('go')!,
      userId: studentPremiumId,
      code: `package main

import (
    "fmt"
    "sync"
)

func main() {
    var wg sync.WaitGroup
    jobs := make(chan int, 5)
    for w := 1; w <= 2; w++ {
        wg.Add(1)
        go func(id int) {
            defer wg.Done()
            for j := range jobs {
                fmt.Printf("Worker %d processed job %d\\n", id, j)
            }
        }(w)
    }
    for j := 1; j <= 4; j++ {
        jobs <- j
    }
    close(jobs)
    wg.Wait()
}`,
      isPublic: true,
      lastRunStatus: RunStatus.AC,
    },
    {
      id: 'snip-linh-pthreads-c',
      title: 'posix_mutex_counter.c',
      languageId: languageMap.get('c')!,
      userId: studentPremiumId,
      code: `#include <stdio.h>
#include <pthread.h>

int counter = 0;
pthread_mutex_t lock = PTHREAD_MUTEX_INITIALIZER;

int main() {
    pthread_mutex_lock(&lock);
    counter += 100;
    pthread_mutex_unlock(&lock);
    printf("Counter = %d\\n", counter);
    return 0;
}`,
      isPublic: false,
      lastRunStatus: RunStatus.AC,
    },
    {
      id: 'snip-bao-judge-solution',
      title: 'exam_dijkstra_reference_solution.cpp',
      languageId: languageMap.get('cpp')!,
      userId: lecturerPremiumId,
      code: QUICKSORT_CPP,
      isPublic: false,
      lastRunStatus: RunStatus.AC,
    },
  ];

  // Clean up old random-id snippets for studentFreeId so their count stays deterministic (2 snippets)
  await prisma.codeSnippet.deleteMany({
    where: {
      userId: studentFreeId,
      id: { notIn: ['snip-huy-bst-cpp', 'snip-huy-fib-py'] },
    },
  });

  for (const snip of seedSnippets) {
    await prisma.codeSnippet.upsert({
      where: { id: snip.id },
      update: {
        title: snip.title,
        languageId: snip.languageId,
        code: snip.code,
        isPublic: snip.isPublic,
        lastRunStatus: snip.lastRunStatus,
      },
      create: snip,
    });
  }
  console.log(`✓ Seeded ${seedSnippets.length} code snippets across all 5 languages`);

  // 8. Seed RunLogs (Workflow §5.5 & Admin Stats todayCodeRuns)
  const seedRunLogs = [
    {
      id: 'runlog-seed-1',
      userId: studentFreeId,
      languageId: languageMap.get('cpp')!,
      status: RunStatus.AC,
      timeMs: 42,
      memoryKb: 12480,
      exitCode: 0,
      createdAt: new Date(),
    },
    {
      id: 'runlog-seed-2',
      userId: studentFreeId,
      languageId: languageMap.get('python')!,
      status: RunStatus.AC,
      timeMs: 65,
      memoryKb: 18240,
      exitCode: 0,
      createdAt: new Date(),
    },
    {
      id: 'runlog-seed-3',
      userId: studentFreeId,
      languageId: languageMap.get('cpp')!,
      status: RunStatus.CE,
      timeMs: 0,
      memoryKb: 0,
      exitCode: 1,
      createdAt: new Date(),
    },
    {
      id: 'runlog-seed-4',
      userId: studentPremiumId,
      languageId: languageMap.get('cpp')!,
      status: RunStatus.AC,
      timeMs: 38,
      memoryKb: 14120,
      exitCode: 0,
      createdAt: new Date(),
    },
    {
      id: 'runlog-seed-5',
      userId: studentPremiumId,
      languageId: languageMap.get('java')!,
      status: RunStatus.AC,
      timeMs: 145,
      memoryKb: 42800,
      exitCode: 0,
      createdAt: new Date(),
    },
    {
      id: 'runlog-seed-6',
      userId: studentPremiumId,
      languageId: languageMap.get('go')!,
      status: RunStatus.AC,
      timeMs: 28,
      memoryKb: 16400,
      exitCode: 0,
      createdAt: new Date(),
    },
    {
      id: 'runlog-seed-7',
      userId: studentPremiumId,
      languageId: languageMap.get('c')!,
      status: RunStatus.TLE,
      timeMs: 5000,
      memoryKb: 9600,
      exitCode: 124,
      createdAt: new Date(),
    },
    {
      id: 'runlog-seed-8',
      userId: lecturerPremiumId,
      languageId: languageMap.get('cpp')!,
      status: RunStatus.AC,
      timeMs: 31,
      memoryKb: 11200,
      exitCode: 0,
      createdAt: new Date(),
    },
  ];

  for (const log of seedRunLogs) {
    await prisma.runLog.upsert({
      where: { id: log.id },
      update: {
        status: log.status,
        timeMs: log.timeMs,
        memoryKb: log.memoryKb,
        exitCode: log.exitCode,
        createdAt: log.createdAt,
      },
      create: log,
    });
  }
  console.log(`✓ Seeded ${seedRunLogs.length} sandbox execution logs (RunLogs)`);

  // 9. Seed AuditLogs (Workflow §6.2, §12 & Business Flow §6.1, §6.2, §7.1, §7.2)
  const seedAuditLogs = [
    {
      id: 'audit-seed-1',
      userId: adminId,
      action: 'USER_ROLE_CHANGE',
      resource: 'User',
      resourceId: lecturerFreeId,
      metadata: {
        targetEmail: 'tuan.tm@hust.edu.vn',
        previousRole: 'STUDENT',
        newRole: 'LECTURER',
        note: 'Xác minh giảng viên bộ môn KHMT — ĐH Bách Khoa Hà Nội (Business Flow §7.1)',
      },
      ipAddress: '127.0.0.1',
      userAgent: 'DevStudy-AdminConsole/1.0',
    },
    {
      id: 'audit-seed-2',
      userId: adminId,
      action: 'SUBSCRIPTION_ACTIVATE',
      resource: 'Subscription',
      resourceId: lecturerPremiumId,
      metadata: {
        targetEmail: 'bao.tq@hust.edu.vn',
        previousTier: 'FREE',
        newTier: 'PREMIUM',
        provider: 'VNPAY_WEBHOOK',
        idempotencyKey: 'pay_vnp_20261101_baotq',
        note: 'Kích hoạt gói PREMIUM cho Giảng viên sau khi xác thực chữ ký webhook (Business Flow §7.2)',
      },
      ipAddress: '127.0.0.1',
      userAgent: 'VNPay-Webhook/2.1',
    },
    {
      id: 'audit-seed-3',
      userId: adminId,
      action: 'SUBSCRIPTION_ACTIVATE',
      resource: 'Subscription',
      resourceId: studentPremiumId,
      metadata: {
        targetEmail: 'linh.tt@edu.vn',
        previousTier: 'FREE',
        newTier: 'PREMIUM',
        provider: 'VNPAY_WEBHOOK',
        idempotencyKey: 'pay_vnp_20261105_linhtt',
      },
      ipAddress: '127.0.0.1',
      userAgent: 'VNPay-Webhook/2.1',
    },
    {
      id: 'audit-seed-4',
      userId: modId,
      action: 'RESOURCE_APPROVE',
      resource: 'Resource',
      resourceId: 'res-sql-cheatsheet',
      metadata: {
        previousStatus: 'PENDING',
        newStatus: 'PUBLISHED',
        title: 'Cheat-sheet tối ưu hoá câu lệnh SQL & thiết kế Index B-Tree / Hash Index',
      },
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0 (Moderator Review Queue)',
    },
    {
      id: 'audit-seed-5',
      userId: modId,
      action: 'RESOURCE_REJECT',
      resource: 'Resource',
      resourceId: 'res-sec-rejected',
      metadata: {
        previousStatus: 'PENDING',
        newStatus: 'REJECTED',
        title: 'Tài liệu: An toàn thông tin — mã hoá đối xứng & bất đối xứng',
        reason: 'Thiếu thông tin trích dẫn bản quyền tác giả gốc và scan bị mờ ở chương 3–4.',
      },
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0 (Moderator Review Queue)',
    },
    {
      id: 'audit-seed-6',
      userId: modId,
      action: 'REPORT_RESOLVE',
      resource: 'Report',
      resourceId: 'rep-seed-resolved-1',
      metadata: {
        targetResourceId: 'res-sec-rejected',
        reason: 'BAN_QUYEN',
        decision: 'Gỡ tài liệu vi phạm bản quyền và chuyển trạng thái REJECTED',
      },
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0 (Moderator Review Queue)',
    },
  ];

  for (const audit of seedAuditLogs) {
    await prisma.auditLog.upsert({
      where: { id: audit.id },
      update: {
        action: audit.action,
        resource: audit.resource,
        resourceId: audit.resourceId,
        metadata: audit.metadata,
      },
      create: audit,
    });
  }
  console.log(`✓ Seeded ${seedAuditLogs.length} audit log records`);

  // ==========================================
  // Seed Courses & Sections/Lessons for AI Learning Path
  // ==========================================
  const seedCoursesData = [
    {
      id: 'c1',
      slug: 'fullstack-web-react-nodejs-postgresql',
      title: 'Lập trình Web Fullstack với React, Node.js, Express 5 & PostgreSQL',
      description: 'Xây dựng nền tảng web hoàn chỉnh theo kiến trúc Monorepo: React + TypeScript, TanStack Query, REST API với Express 5, xác thực JWT + Refresh Token Rotation, Prisma ORM, Redis cache/quota và deploy Docker.',
      instructor: 'ThS. Tạ Quang Bảo',
      instructorRole: 'Giảng viên Hệ thống Thông tin · HUST',
      category: 'Frontend & Fullstack',
      price: 490000,
      originalPrice: 1250000,
      rating: 4.9,
      ratingCount: 1248,
      students: 4820,
      hours: 42,
      lessonsCount: 6,
      labs: 35,
      level: 'Trung cấp',
      tags: ['React', 'Node.js', 'Express 5', 'PostgreSQL', 'Prisma'],
      certificate: true,
      sections: [
        {
          id: 'c1-s1',
          title: 'Chương 1: Kiến trúc Monorepo, React & TypeScript',
          order: 1,
          lessons: [
            { id: 'c1-s1-l1', title: 'Thiết lập Monorepo & chia sẻ Zod Schema giữa FE/BE', durationMin: 25, free: true, order: 1 },
            { id: 'c1-s1-l2', title: 'Component Architecture, Custom Hooks & React Hook Form', durationMin: 32, free: true, order: 2 },
            { id: 'c1-s1-l3', title: 'Quản lý Server State với TanStack Query & StaleTime', durationMin: 28, free: true, order: 3 },
          ],
        },
        {
          id: 'c1-s2',
          title: 'Chương 2: Backend REST API với Node.js & Express 5',
          order: 2,
          lessons: [
            { id: 'c1-s2-l1', title: 'Thiết kế RESTful API chuẩn & Middleware Pipeline', durationMin: 30, free: false, order: 1 },
            { id: 'c1-s2-l2', title: 'Xác thực JWT ngắn hạn & Refresh Token Rotation với Cookie httpOnly', durationMin: 45, free: false, order: 2 },
            { id: 'c1-s2-l3', title: 'Tích hợp Prisma ORM, Migration & Transaction PostgreSQL', durationMin: 40, free: false, order: 3 },
          ],
        },
      ],
    },
    {
      id: 'c2',
      slug: 'cau-truc-du-lieu-giai-thuat-cpp',
      title: 'Cấu trúc Dữ liệu & Giải thuật Ứng dụng (C++ / Python)',
      description: 'Luyện tư duy thuật toán từ cơ bản đến nâng cao: mảng động, danh sách liên kết, cây nhị phân, heap, đồ thị BFS/DFS, quy hoạch động và các kỹ thuật tối ưu phỏng vấn Tech.',
      instructor: 'TS. Trần Minh Tuấn',
      instructorRole: 'Trưởng bộ môn Khoa học Máy tính · HUST',
      category: 'Giải thuật & Nền tảng',
      price: 390000,
      originalPrice: 950000,
      rating: 4.95,
      ratingCount: 2150,
      students: 6540,
      hours: 56,
      lessonsCount: 6,
      labs: 80,
      level: 'Cơ bản',
      tags: ['C++', 'Python', 'CTDL', 'Giải thuật', 'LeetCode'],
      certificate: true,
      sections: [
        {
          id: 'c2-s1',
          title: 'Chương 1: Phân tích độ phức tạp & Cấu trúc tuyến tính',
          order: 1,
          lessons: [
            { id: 'c2-s1-l1', title: 'Độ phức tạp thời gian/không gian Big-O & Kỹ thuật Two Pointers', durationMin: 30, free: true, order: 1 },
            { id: 'c2-s1-l2', title: 'Ngăn xếp (Stack) & Hàng đợi (Queue) trong bài toán thực tế', durationMin: 35, free: true, order: 2 },
            { id: 'c2-s1-l3', title: 'Bảng băm (Hash Table) & Xử lý xung đột', durationMin: 25, free: true, order: 3 },
          ],
        },
        {
          id: 'c2-s2',
          title: 'Chương 2: Cấu trúc phi tuyến tính & Đồ thị',
          order: 2,
          lessons: [
            { id: 'c2-s2-l1', title: 'Cây nhị phân tìm kiếm (BST) & Cây AVL cân bằng', durationMin: 40, free: false, order: 1 },
            { id: 'c2-s2-l2', title: 'Duyệt đồ thị BFS, DFS & Tìm đường đi ngắn nhất Dijkstra', durationMin: 50, free: false, order: 2 },
            { id: 'c2-s2-l3', title: 'Quy hoạch động (Dynamic Programming) kinh điển', durationMin: 55, free: false, order: 3 },
          ],
        },
      ],
    },
  ];

  for (const c of seedCoursesData) {
    const course = await prisma.course.upsert({
      where: { id: c.id },
      update: {
        title: c.title,
        description: c.description,
        instructor: c.instructor,
        instructorRole: c.instructorRole,
        category: c.category,
        price: c.price,
        originalPrice: c.originalPrice,
        rating: c.rating,
        ratingCount: c.ratingCount,
        students: c.students,
        hours: c.hours,
        lessonsCount: c.lessonsCount,
        labs: c.labs,
        level: c.level,
        tags: c.tags,
        certificate: c.certificate,
      },
      create: {
        id: c.id,
        slug: c.slug,
        title: c.title,
        description: c.description,
        instructor: c.instructor,
        instructorRole: c.instructorRole,
        category: c.category,
        price: c.price,
        originalPrice: c.originalPrice,
        rating: c.rating,
        ratingCount: c.ratingCount,
        students: c.students,
        hours: c.hours,
        lessonsCount: c.lessonsCount,
        labs: c.labs,
        level: c.level,
        tags: c.tags,
        certificate: c.certificate,
      },
    });

    for (const s of c.sections) {
      await prisma.section.upsert({
        where: { id: s.id },
        update: { title: s.title, order: s.order },
        create: {
          id: s.id,
          courseId: course.id,
          title: s.title,
          order: s.order,
        },
      });

      for (const l of s.lessons) {
        await prisma.lesson.upsert({
          where: { id: l.id },
          update: { title: l.title, durationMin: l.durationMin, free: l.free, order: l.order },
          create: {
            id: l.id,
            sectionId: s.id,
            title: l.title,
            durationMin: l.durationMin,
            free: l.free,
            order: l.order,
          },
        });
      }
    }
  }
  console.log(`✓ Seeded ${seedCoursesData.length} courses with sections & lessons`);

  // Seed SkillProfiles cho học viên
  const studentLinh = await prisma.user.findUnique({ where: { email: 'linh.tt@edu.vn' } });
  if (studentLinh) {
    const skills = [
      { topic: 'CTDL', accuracy: 85, answered: 40, weak: false },
      { topic: 'OOP', accuracy: 78, answered: 30, weak: false },
      { topic: 'CSDL', accuracy: 55, answered: 25, weak: true },
      { topic: 'HDH', accuracy: 50, answered: 20, weak: true },
      { topic: 'WEB_CLOUD', accuracy: 90, answered: 50, weak: false },
    ];
    for (const sk of skills) {
      await prisma.skillProfile.upsert({
        where: { userId_topic: { userId: studentLinh.id, topic: sk.topic } },
        update: { accuracy: sk.accuracy, answered: sk.answered, weak: sk.weak },
        create: { userId: studentLinh.id, ...sk },
      });
    }

    // Seed Enrollment cho linh.tt@edu.vn
    await prisma.enrollment.upsert({
      where: { userId_courseId: { userId: studentLinh.id, courseId: 'c1' } },
      update: { progress: 30, completedLessons: 2, totalLessons: 6 },
      create: { userId: studentLinh.id, courseId: 'c1', progress: 30, completedLessons: 2, totalLessons: 6 },
    });
    console.log(`✓ Seeded SkillProfiles & Enrollment for ${studentLinh.email}`);
  }

  // ==========================================
  // Phase 0 - Seed Question Bank & Practice Attempt History
  // ==========================================
  await seedPracticeBankAndHistory(prisma, userMap, adminId);

  console.log('✅ Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
