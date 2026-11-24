import {
  PrismaClient,
  QuestionDifficulty,
  QuestionLevel,
  QuestionStatus,
  QuestionType,
  ResourceTopic,
} from '@prisma/client';

export interface SeedQuestionItem {
  id: string;
  topic: ResourceTopic;
  level: QuestionLevel;
  type: QuestionType;
  difficulty: QuestionDifficulty;
  prompt: string;
  code?: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  tags: string[];
  status?: QuestionStatus;
  estimatedTimeSec?: number;
}

export const SEED_QUESTIONS: SeedQuestionItem[] = [
  // ==========================================
  // 1. CTDL (Cấu trúc dữ liệu & Giải thuật) — 16 câu APPROVED
  // ==========================================
  {
    id: 'q-ctdl-1',
    topic: ResourceTopic.CTDL,
    level: QuestionLevel.CO_BAN,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.EASY,
    prompt:
      'Trong cây tìm kiếm nhị phân (BST) không tự cân bằng, thao tác tìm kiếm một khoá trong trường hợp xấu nhất có độ phức tạp là bao nhiêu?',
    options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'],
    correctIndex: 2,
    explanation:
      'Khi dữ liệu chèn vào đã có thứ tự tăng hoặc giảm dần, BST suy biến thành danh sách liên kết đơn (cây lệch) có chiều cao h = n, nên tìm kiếm mất O(n). Cây cân bằng (AVL, Red-Black) mới đảm bảo O(log n).',
    tags: ['dsa', 'bst', 'binary-tree', 'complexity'],
    estimatedTimeSec: 35,
  },
  {
    id: 'q-ctdl-2',
    topic: ResourceTopic.CTDL,
    level: QuestionLevel.CO_BAN,
    type: QuestionType.TRUE_FALSE,
    difficulty: QuestionDifficulty.EASY,
    prompt:
      'Cấu trúc dữ liệu Ngăn xếp (Stack) hoạt động theo nguyên tắc FIFO (First-In, First-Out — Vào trước ra trước).',
    options: ['Đúng', 'Sai'],
    correctIndex: 1,
    explanation:
      'Sai. Stack hoạt động theo nguyên tắc LIFO (Last-In, First-Out — Vào sau ra trước). Hàng đợi (Queue) mới hoạt động theo FIFO.',
    tags: ['dsa', 'stack', 'queue'],
    estimatedTimeSec: 25,
  },
  {
    id: 'q-ctdl-3',
    topic: ResourceTopic.CTDL,
    level: QuestionLevel.CO_BAN,
    type: QuestionType.FILL_BLANK,
    difficulty: QuestionDifficulty.EASY,
    prompt:
      'Điền biểu thức còn thiếu vào thuật toán Tìm kiếm nhị phân (Binary Search) dưới đây để tránh tràn số nguyên (integer overflow) khi tính chỉ số giữa:',
    code: 'int binarySearch(const vector<int>& a, int target) {\n  int l = 0, r = (int)a.size() - 1;\n  while (l <= r) {\n    int mid = ____;\n    if (a[mid] == target) return mid;\n    if (a[mid] < target) l = mid + 1;\n    else r = mid - 1;\n  }\n  return -1;\n}',
    options: ['l + (r - l) / 2', '(l + r) * 2', 'r + (r - l) / 2', '(r - l) / 2'],
    correctIndex: 0,
    explanation:
      'Viết l + (r - l) / 2 tương đương (l + r) / 2 về mặt toán học nhưng tránh bị tràn kiểu int 32-bit khi l + r > INT_MAX.',
    tags: ['dsa', 'binary-search', 'cpp'],
    estimatedTimeSec: 40,
  },
  {
    id: 'q-ctdl-4',
    topic: ResourceTopic.CTDL,
    level: QuestionLevel.TRUNG_BINH,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.MEDIUM,
    prompt:
      'Thuật toán Dijkstra dùng hàng đợi ưu tiên (Min-Heap) với danh sách kề có độ phức tạp thời gian tiệm cận là bao nhiêu?',
    options: ['O(V²)', 'O((V + E) log V)', 'O(E² log V)', 'O(V × E)'],
    correctIndex: 1,
    explanation:
      'Mỗi cạnh được xét tối đa một lần khi nới lỏng (relax) và mỗi thao tác push/pop trên Min-Heap tốn O(log V), do đó tổng thời gian là O((V + E) log V).',
    tags: ['dsa', 'graph', 'dijkstra', 'heap'],
    estimatedTimeSec: 45,
  },
  {
    id: 'q-ctdl-5',
    topic: ResourceTopic.CTDL,
    level: QuestionLevel.TRUNG_BINH,
    type: QuestionType.DEBUG,
    difficulty: QuestionDifficulty.MEDIUM,
    prompt:
      'Đoạn mã C++ sau gây lỗi bộ nhớ gì khi giải phóng mảng cấp phát động trên Heap?',
    code: 'int *ptr = new int[50];\nptr[0] = 42;\ndelete ptr; // <-- chú ý dòng này\nptr = nullptr;',
    options: [
      'Null pointer dereference',
      'Undefined Behavior / Rò rỉ bộ nhớ — phải dùng delete[] ptr',
      'Double free corruption',
      'Mã hoàn toàn hợp lệ',
    ],
    correctIndex: 1,
    explanation:
      'Mảng cấp phát bằng toán tử new[] bắt buộc phải giải phóng bằng delete[] ptr. Dùng delete đơn lẻ gây Undefined Behavior và không gọi destructor của các phần tử còn lại.',
    tags: ['dsa', 'cpp', 'memory', 'pointers'],
    estimatedTimeSec: 45,
  },
  {
    id: 'q-ctdl-6',
    topic: ResourceTopic.CTDL,
    level: QuestionLevel.TRUNG_BINH,
    type: QuestionType.READ_CODE,
    difficulty: QuestionDifficulty.MEDIUM,
    prompt:
      'Hàm đệ quy sau tính giá trị gì cho cây nhị phân có gốc là root (Node rỗng trả về 0)?',
    code: 'int solve(Node* root) {\n  if (!root) return 0;\n  return 1 + max(solve(root->left), solve(root->right));\n}',
    options: [
      'Tổng số nút của cây nhị phân',
      'Chiều cao (số mức nút tối đa từ gốc đến lá) của cây nhị phân',
      'Số nút lá của cây nhị phân',
      'Giá trị lớn nhất lưu trong cây',
    ],
    correctIndex: 1,
    explanation:
      'Tại mỗi nút, hàm lấy 1 cộng với chiều cao lớn hơn giữa cây con trái và cây con phải, chính là chiều cao (max depth) của cây nhị phân.',
    tags: ['dsa', 'binary-tree', 'recursion'],
    estimatedTimeSec: 40,
  },
  {
    id: 'q-ctdl-7',
    topic: ResourceTopic.CTDL,
    level: QuestionLevel.NANG_CAO,
    type: QuestionType.READ_CODE,
    difficulty: QuestionDifficulty.HARD,
    prompt:
      'Đoạn code QuickSort dưới đây luôn chọn pivot là phần tử cuối a[r]. Nếu mảng đầu vào đã sắp xếp tăng dần, độ phức tạp thời gian là bao nhiêu?',
    code: 'void quickSort(int a[], int l, int r) {\n  if (l < r) {\n    int p = partition(a, l, r); // pivot = a[r]\n    quickSort(a, l, p - 1);\n    quickSort(a, p + 1, r);\n  }\n}',
    options: ['O(n log n)', 'O(n)', 'O(n²)', 'O(n log² n)'],
    correctIndex: 2,
    explanation:
      'Trên mảng đã tăng dần, pivot = a[r] luôn là phần tử lớn nhất, chia mảng thành 2 phần lệch cực đại (n - 1 phần tử và 0 phần tử). Cây đệ quy suy biến sâu n tầng: (n-1) + (n-2) + ... + 1 = O(n²).',
    tags: ['dsa', 'sorting', 'quicksort', 'complexity'],
    estimatedTimeSec: 50,
  },
  {
    id: 'q-ctdl-8',
    topic: ResourceTopic.CTDL,
    level: QuestionLevel.NANG_CAO,
    type: QuestionType.FILL_BLANK,
    difficulty: QuestionDifficulty.HARD,
    prompt:
      'Trong cấu trúc Fenwick Tree (Binary Indexed Tree), biểu thức bitwise nào dùng để tách bit 1 thấp nhất (lowbit) của chỉ số i khi cập nhật hoặc truy vấn tổng tiền tố?',
    code: 'void add(int i, int delta) {\n  for (; i <= n; i += ____) bit[i] += delta;\n}',
    options: ['i & -i', 'i | -i', 'i ^ (i - 1)', 'i >> 1'],
    correctIndex: 0,
    explanation:
      'Trong biểu diễn bù 2 (two’s complement), -i = ~i + 1, nên phép toán i & -i giữ lại duy nhất bit 1 có trọng số thấp nhất của i.',
    tags: ['dsa', 'fenwick-tree', 'bitwise'],
    estimatedTimeSec: 55,
  },
  {
    id: 'q-ctdl-9',
    topic: ResourceTopic.CTDL,
    level: QuestionLevel.CO_BAN,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.EASY,
    prompt:
      'Phép duyệt cây nhị phân tìm kiếm (BST) nào luôn cho ra dãy các khoá theo thứ tự tăng dần?',
    options: [
      'Duyệt tiền thứ tự (Pre-order)',
      'Duyệt trung thứ tự (In-order)',
      'Duyệt hậu thứ tự (Post-order)',
      'Duyệt theo mức (Level-order / BFS)',
    ],
    correctIndex: 1,
    explanation:
      'Duyệt trung thứ tự (Trái → Gốc → Phải) trên BST luôn thăm các khoá nhỏ hơn trước gốc và lớn hơn sau gốc nên thu được dãy tăng dần.',
    tags: ['dsa', 'bst', 'tree-traversal'],
    estimatedTimeSec: 30,
  },
  {
    id: 'q-ctdl-10',
    topic: ResourceTopic.CTDL,
    level: QuestionLevel.CO_BAN,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.EASY,
    prompt:
      'Thuật toán sắp xếp nào sau đây có tính ổn định (stable sort) và luôn đảm bảo độ phức tạp thời gian O(n log n) trong mọi trường hợp?',
    options: ['QuickSort', 'HeapSort', 'MergeSort', 'SelectionSort'],
    correctIndex: 2,
    explanation:
      'MergeSort luôn chia đôi đều mảng thành hai nửa nên đạt O(n log n) ở cả trường hợp tốt nhất, trung bình và xấu nhất, đồng thời giữ nguyên thứ tự tương đối các phần tử bằng nhau (ổn định).',
    tags: ['dsa', 'sorting', 'mergesort', 'complexity'],
    estimatedTimeSec: 35,
  },
  {
    id: 'q-ctdl-11',
    topic: ResourceTopic.CTDL,
    level: QuestionLevel.TRUNG_BINH,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.MEDIUM,
    prompt:
      'Để tìm đường đi ngắn nhất (theo số cạnh) giữa hai đỉnh trên một đồ thị KHÔNG trọng số, thuật toán phù hợp nhất là gì?',
    options: [
      'DFS (Depth-First Search)',
      'BFS (Breadth-First Search)',
      'Thuật toán Kruskal',
      'Sắp xếp Tô-pô (Topological Sort)',
    ],
    correctIndex: 1,
    explanation:
      'BFS mở rộng từng lớp theo khoảng cách 0, 1, 2,... cạnh tính từ đỉnh nguồn nên đỉnh đích khi được thăm lần đầu tiên chắc chắn đi theo đường ngắn nhất theo số cạnh, với chi phí O(V + E).',
    tags: ['dsa', 'graph', 'bfs'],
    estimatedTimeSec: 35,
  },
  {
    id: 'q-ctdl-12',
    topic: ResourceTopic.CTDL,
    level: QuestionLevel.TRUNG_BINH,
    type: QuestionType.TRUE_FALSE,
    difficulty: QuestionDifficulty.MEDIUM,
    prompt:
      'Thuật toán Dijkstra vẫn luôn cho kết quả đường đi ngắn nhất chính xác khi đồ thị có cạnh trọng số âm nhưng không có chu trình âm.',
    options: ['Đúng', 'Sai'],
    correctIndex: 1,
    explanation:
      'Sai. Dijkstra dùng chiến lược tham lam (khi chốt đỉnh u đã lấy khỏi heap thì giả định không còn đường ngắn hơn tới u), điều này bị phá vỡ khi tồn tại cạnh âm. Cần dùng Bellman-Ford khi có cạnh trọng số âm.',
    tags: ['dsa', 'graph', 'dijkstra', 'bellman-ford'],
    estimatedTimeSec: 40,
  },
  {
    id: 'q-ctdl-13',
    topic: ResourceTopic.CTDL,
    level: QuestionLevel.TRUNG_BINH,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.MEDIUM,
    prompt:
      'Trong bảng băm (Hash Table) xử lý xung đột bằng phương pháp nối kết (Separate Chaining), hệ số tải (load factor) α = n / m càng lớn thì điều gì xảy ra?',
    options: [
      'Thời gian tìm kiếm trung bình tiến gần về O(1) hơn',
      'Chiều dài trung bình mỗi danh sách liên kết tăng lên, làm suy giảm hiệu năng tìm kiếm',
      'Bảng băm không thể chèn thêm phần tử mới khi α = 1',
      'Hàm băm tự động chuyển sang tìm kiếm nhị phân',
    ],
    correctIndex: 1,
    explanation:
      'Với Separate Chaining, mỗi bucket chứa trung bình α phần tử. Khi α tăng cao mà không rehash, thời gian tìm kiếm tăng theo O(1 + α).',
    tags: ['dsa', 'hash-table', 'complexity'],
    estimatedTimeSec: 40,
  },
  {
    id: 'q-ctdl-14',
    topic: ResourceTopic.CTDL,
    level: QuestionLevel.TRUNG_BINH,
    type: QuestionType.FILL_BLANK,
    difficulty: QuestionDifficulty.MEDIUM,
    prompt:
      'Trong kỹ thuật Quy hoạch động bài toán cái túi 0/1 (0/1 Knapsack) tối ưu bộ nhớ 1 chiều dp[w], vòng lặp trọng lượng w phải duyệt theo chiều nào để mỗi vật chỉ được chọn tối đa 1 lần?',
    code: 'for (int i = 0; i < n; i++) {\n  for (int w = W; w >= weight[i]; ____) {\n    dp[w] = max(dp[w], dp[w - weight[i]] + value[i]);\n  }\n}',
    options: ['w--', 'w++', 'w -= 2', 'w /= 2'],
    correctIndex: 0,
    explanation:
      'Duyệt ngược từ W về weight[i] (w--) đảm bảo dp[w - weight[i]] là trạng thái của hàng trước (chưa dùng vật i). Nếu duyệt xuôi w++, cùng một vật i sẽ bị cộng dồn nhiều lần (Unbounded Knapsack).',
    tags: ['dsa', 'dynamic-programming', 'knapsack'],
    estimatedTimeSec: 50,
  },
  {
    id: 'q-ctdl-15',
    topic: ResourceTopic.CTDL,
    level: QuestionLevel.NANG_CAO,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.HARD,
    prompt:
      'Cấu trúc Disjoint Set Union (Union-Find) khi áp dụng đồng thời Path Compression và Union by Rank có độ phức tạp khấu hao (amortized) cho mỗi thao tác find/union là bao nhiêu?',
    options: ['O(log n)', 'O(√n)', 'O(α(n)) với α là hàm Ackermann nghịch đảo', 'O(n)'],
    correctIndex: 2,
    explanation:
      'Kết hợp nén đường đi (Path Compression) và gộp theo hạng (Union by Rank/Size) đạt độ phức tạp khấu hao O(α(n)), gần như hằng số (α(n) ≤ 4 với mọi kích thước dữ liệu thực tế).',
    tags: ['dsa', 'dsu', 'graph', 'complexity'],
    estimatedTimeSec: 50,
  },
  {
    id: 'q-ctdl-16',
    topic: ResourceTopic.CTDL,
    level: QuestionLevel.NANG_CAO,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.HARD,
    prompt:
      'Trên một đồ thị có hướng (Directed Graph), thứ tự Sắp xếp Tô-pô (Topological Sort) tồn tại khi và chỉ khi đồ thị đó thoả mãn điều kiện nào?',
    options: [
      'Đồ thị phải liên thông mạnh',
      'Đồ thị không có chu trình có hướng (là một DAG — Directed Acyclic Graph)',
      'Mọi đỉnh đều có bậc vào bằng bậc ra',
      'Số cạnh bằng đúng V - 1',
    ],
    correctIndex: 1,
    explanation:
      'Nếu tồn tại chu trình A → B → ... → A thì không thể đặt A trước B đồng thời B trước A. Do đó sắp xếp tô-pô chỉ tồn tại trên đồ thị có hướng không chu trình (DAG).',
    tags: ['dsa', 'graph', 'dag', 'topological-sort'],
    estimatedTimeSec: 45,
  },

  // ==========================================
  // 2. OOP (Lập trình hướng đối tượng) — 16 câu APPROVED
  // ==========================================
  {
    id: 'q-oop-1',
    topic: ResourceTopic.OOP,
    level: QuestionLevel.CO_BAN,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.EASY,
    prompt:
      'Tính đa hình (Polymorphism) trong lập trình hướng đối tượng cho phép điều gì?',
    options: [
      'Mỗi lớp chỉ được phép khai báo một phương thức duy nhất',
      'Cùng một lời gọi phương thức trên kiểu cha/interface nhưng thực thi hành vi khác nhau tuỳ đối tượng thực tế lúc runtime',
      'Ẩn toàn bộ thuộc tính khỏi chính lớp đó',
      'Tự động giải phóng bộ nhớ không cần Garbage Collector',
    ],
    correctIndex: 1,
    explanation:
      'Đa hình runtime (Dynamic Dispatch / Method Overriding) cho phép gọi cùng một phương thức qua tham chiếu lớp cha hoặc interface, còn bản cài đặt chạy thực tế phụ thuộc vào lớp khởi tạo đối tượng.',
    tags: ['oop', 'polymorphism', 'java'],
    estimatedTimeSec: 35,
  },
  {
    id: 'q-oop-2',
    topic: ResourceTopic.OOP,
    level: QuestionLevel.CO_BAN,
    type: QuestionType.TRUE_FALSE,
    difficulty: QuestionDifficulty.EASY,
    prompt:
      'Trong Java, một lớp (class) có thể kế thừa trực tiếp nhiều lớp cha bằng từ khoá extends nhưng chỉ được implements một interface.',
    options: ['Đúng', 'Sai'],
    correctIndex: 1,
    explanation:
      'Sai. Ngược lại: Java chỉ cho phép đơn kế thừa lớp (extends 1 class) để tránh Diamond Problem, nhưng cho phép implements nhiều interface cùng lúc.',
    tags: ['oop', 'inheritance', 'interface', 'java'],
    estimatedTimeSec: 30,
  },
  {
    id: 'q-oop-3',
    topic: ResourceTopic.OOP,
    level: QuestionLevel.TRUNG_BINH,
    type: QuestionType.READ_CODE,
    difficulty: QuestionDifficulty.MEDIUM,
    prompt: 'Đoạn code Java sau in ra kết quả gì ra màn hình?',
    code: 'class A { String tag() { return "A"; } }\nclass B extends A { @Override String tag() { return "B"; } }\npublic class Main {\n  public static void main(String[] args) {\n    A obj = new B();\n    System.out.println(obj.tag());\n  }\n}',
    options: ['A', 'B', 'Lỗi biên dịch', 'ClassCastException'],
    correctIndex: 1,
    explanation:
      'Java sử dụng liên kết động (dynamic binding) cho phương thức non-static: dù kiểu khai báo của obj là A, đối tượng thực tế trên Heap là B nên B.tag() được gọi và in ra "B".',
    tags: ['oop', 'polymorphism', 'dynamic-binding', 'java'],
    estimatedTimeSec: 40,
  },
  {
    id: 'q-oop-4',
    topic: ResourceTopic.OOP,
    level: QuestionLevel.TRUNG_BINH,
    type: QuestionType.FILL_BLANK,
    difficulty: QuestionDifficulty.MEDIUM,
    prompt:
      'Điền từ khoá Java thích hợp để ngăn một phương thức ở lớp cha bị ghi đè (override) bởi các lớp con:',
    code: 'public class SecurityToken {\n  public ____ String getAlgorithm() {\n    return "RS256";\n  }\n}',
    options: ['final', 'static', 'abstract', 'transient'],
    correctIndex: 0,
    explanation:
      'Phương thức đánh dấu final không thể bị override bởi lớp con; lớp đánh dấu final không thể bị kế thừa.',
    tags: ['oop', 'java', 'modifiers'],
    estimatedTimeSec: 35,
  },
  {
    id: 'q-oop-5',
    topic: ResourceTopic.OOP,
    level: QuestionLevel.TRUNG_BINH,
    type: QuestionType.DEBUG,
    difficulty: QuestionDifficulty.MEDIUM,
    prompt:
      'Đoạn mã Java so sánh hai chuỗi dưới đây tiềm ẩn lỗi logic nào khi kiểm tra quyền người dùng?',
    code: 'String role = new String("ADMIN");\nif (role == "ADMIN") {\n  grantFullAccess();\n}',
    options: [
      'Toán tử == so sánh địa chỉ tham chiếu bộ nhớ thay vì nội dung chuỗi — cần dùng "ADMIN".equals(role)',
      'Không được truyền chuỗi vào hàm new String()',
      'Biến role phải khai báo kiểu char[]',
      'Không có lỗi nào, điều kiện luôn đúng',
    ],
    correctIndex: 0,
    explanation:
      'Trong Java, == trên kiểu Object/String so sánh tham chiếu địa chỉ bộ nhớ. new String("ADMIN") tạo đối tượng mới trên Heap khác địa chỉ với String Pool literal "ADMIN", nên điều kiện trả về false. Phải dùng "ADMIN".equals(role).',
    tags: ['oop', 'java', 'string-equality'],
    estimatedTimeSec: 40,
  },
  {
    id: 'q-oop-6',
    topic: ResourceTopic.OOP,
    level: QuestionLevel.NANG_CAO,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.HARD,
    prompt:
      'Nguyên lý nào trong bộ SOLID phát biểu rằng: "Các module cấp cao không nên phụ thuộc vào các module cấp thấp; cả hai nên phụ thuộc vào lớp trừu tượng (abstraction)"?',
    options: [
      'Single Responsibility Principle (SRP)',
      'Open/Closed Principle (OCP)',
      'Liskov Substitution Principle (LSP)',
      'Dependency Inversion Principle (DIP)',
    ],
    correctIndex: 3,
    explanation:
      'Dependency Inversion Principle (DIP) yêu cầu phụ thuộc vào Interface/Abstraction thay vì lớp cụ thể (Concrete Class), giúp dễ dàng thay thế implementation và viết Unit Test với Mock.',
    tags: ['oop', 'solid', 'architecture'],
    estimatedTimeSec: 45,
  },
  {
    id: 'q-oop-7',
    topic: ResourceTopic.OOP,
    level: QuestionLevel.NANG_CAO,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.HARD,
    prompt:
      'Design Pattern nào cho phép định nghĩa một họ các thuật toán, đóng gói từng thuật toán và giúp chúng có thể hoán đổi linh hoạt cho nhau lúc runtime (ví dụ: chọn cổng thanh toán VNPay, MoMo, Stripe)?',
    options: ['Singleton Pattern', 'Strategy Pattern', 'Decorator Pattern', 'Observer Pattern'],
    correctIndex: 1,
    explanation:
      'Strategy Pattern tách rời thuật toán/hành vi ra thành các lớp cài đặt chung một interface (PaymentStrategy), giúp Context chuyển đổi chiến lược linh hoạt mà không cần chuỗi if-else/switch phức tạp.',
    tags: ['oop', 'design-patterns', 'strategy'],
    estimatedTimeSec: 45,
  },
  {
    id: 'q-oop-8',
    topic: ResourceTopic.OOP,
    level: QuestionLevel.NANG_CAO,
    type: QuestionType.DEBUG,
    difficulty: QuestionDifficulty.HARD,
    prompt:
      'Khi ghi đè phương thức equals(Object o) trong một lớp Java dùng làm khoá của HashMap, nếu quên ghi đè phương thức nào sau đây sẽ làm HashMap hoạt động sai?',
    code: 'class StudentKey {\n  String id;\n  @Override public boolean equals(Object o) { /* so sánh id */ }\n  // Thiếu phương thức nào?\n}',
    options: ['toString()', 'hashCode()', 'clone()', 'compareTo()'],
    correctIndex: 1,
    explanation:
      'Hợp đồng Java quy định hai đối tượng bằng nhau theo equals() bắt buộc phải trả về cùng một giá trị hashCode(). Nếu không override hashCode(), HashMap sẽ băm hai đối tượng vào hai bucket khác nhau và tìm không thấy khoá.',
    tags: ['oop', 'java', 'hashmap', 'equals-hashcode'],
    estimatedTimeSec: 45,
  },
  {
    id: 'q-oop-9',
    topic: ResourceTopic.OOP,
    level: QuestionLevel.CO_BAN,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.EASY,
    prompt:
      'Tính đóng gói (Encapsulation) trong lập trình hướng đối tượng được thực hiện chủ yếu nhằm mục đích gì?',
    options: [
      'Cho phép mọi lớp khác sửa trực tiếp các biến thành viên của đối tượng',
      'Che giấu trạng thái nội bộ (private fields) và chỉ cho phép tương tác qua các phương thức công khai có kiểm soát',
      'Biến mọi phương thức thành static để không cần khởi tạo đối tượng',
      'Loại bỏ hoàn toàn nhu cầu viết constructor',
    ],
    correctIndex: 1,
    explanation:
      'Encapsulation bảo vệ bất biến (invariant) của đối tượng bằng cách ẩn dữ liệu nội bộ (private) và kiểm tra tính hợp lệ thông qua các phương thức công khai.',
    tags: ['oop', 'encapsulation'],
    estimatedTimeSec: 30,
  },
  {
    id: 'q-oop-10',
    topic: ResourceTopic.OOP,
    level: QuestionLevel.CO_BAN,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.EASY,
    prompt:
      'Sự khác biệt cơ bản giữa Method Overloading (nạp chồng) và Method Overriding (ghi đè) là gì?',
    options: [
      'Overloading xảy ra trong cùng một lớp với danh sách tham số khác nhau (compile-time); Overriding xảy ra ở lớp con với cùng chữ ký phương thức (runtime)',
      'Overloading chỉ dùng cho constructor, còn Overriding chỉ dùng cho biến static',
      'Overriding phải thay đổi tên phương thức còn Overloading giữ nguyên tham số',
      'Hai khái niệm hoàn toàn giống nhau',
    ],
    correctIndex: 0,
    explanation:
      'Overloading (đa hình biên dịch) định nghĩa nhiều phương thức trùng tên nhưng khác tham số; Overriding (đa hình runtime) cài đặt lại phương thức của lớp cha ở lớp con với cùng chữ ký.',
    tags: ['oop', 'overloading', 'overriding'],
    estimatedTimeSec: 35,
  },
  {
    id: 'q-oop-11',
    topic: ResourceTopic.OOP,
    level: QuestionLevel.TRUNG_BINH,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.MEDIUM,
    prompt:
      'Trong nguyên lý Liskov Substitution Principle (LSP — chữ L trong SOLID), ví dụ kinh điển nào thường được trích dẫn là VI PHẠM nguyên lý này?',
    options: [
      'Cho lớp Square (Hình vuông) kế thừa Rectangle (Hình chữ nhật) và ghi đè setWidth/setHeight làm thay đổi cả hai cạnh',
      'Tách PaymentService thành interface PaymentGateway',
      'Dùng Composition để gắn Logger vào OrderService',
      'Đóng gói danh sách phần tử bằng Collections.unmodifiableList',
    ],
    correctIndex: 0,
    explanation:
      'Client sử dụng Rectangle kỳ vọng setWidth(5) và setHeight(4) cho diện tích 20. Nếu thay bằng Square, diện tích lại thành 16 — phá vỡ hợp đồng hành vi của lớp cha, vi phạm LSP.',
    tags: ['oop', 'solid', 'lsp'],
    estimatedTimeSec: 45,
  },
  {
    id: 'q-oop-12',
    topic: ResourceTopic.OOP,
    level: QuestionLevel.TRUNG_BINH,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.MEDIUM,
    prompt:
      'Nguyên tắc thiết kế "Favor Composition over Inheritance" (Ưu tiên kết hợp hơn kế thừa) giúp giải quyết vấn đề nào?',
    options: [
      'Giảm sự phụ thuộc chặt (tight coupling) vào cây kế thừa cứng nhắc và dễ thay đổi hành vi linh hoạt lúc runtime',
      'Cấm sử dụng mọi interface trong hệ thống',
      'Tăng số lượng lớp cha cho mỗi lớp con',
      'Loại bỏ khả năng tái sử dụng mã nguồn',
    ],
    correctIndex: 0,
    explanation:
      'Kế thừa tạo khớp nối chặt giữa lớp con và chi tiết cài đặt của lớp cha (fragile base class). Composition (has-a) cho phép ghép các thành phần độc lập qua interface linh hoạt hơn.',
    tags: ['oop', 'composition', 'inheritance', 'design'],
    estimatedTimeSec: 40,
  },
  {
    id: 'q-oop-13',
    topic: ResourceTopic.OOP,
    level: QuestionLevel.TRUNG_BINH,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.MEDIUM,
    prompt:
      'Mẫu thiết kế Adapter Pattern (cũng dùng trong kiến trúc Ports & Adapters / Plug-and-play) có nhiệm vụ chính là gì?',
    options: [
      'Đảm bảo một lớp chỉ có duy nhất một thực thể toàn cục',
      'Chuyển đổi giao diện (interface) của một lớp/module sẵn có sang giao diện khác mà phía gọi (client) mong đợi mà không sửa mã gốc',
      'Tạo bản sao sâu (deep copy) của một đối tượng phức tạp',
      'Thông báo sự kiện đến nhiều đối tượng đăng ký lắng nghe',
    ],
    correctIndex: 1,
    explanation:
      'Adapter Pattern đóng vai trò lớp phiên dịch giữa hai interface không tương thích, cho phép tách biệt module độc lập khỏi chi tiết nội bộ của hệ thống host.',
    tags: ['oop', 'design-patterns', 'adapter', 'architecture'],
    estimatedTimeSec: 40,
  },
  {
    id: 'q-oop-14',
    topic: ResourceTopic.OOP,
    level: QuestionLevel.TRUNG_BINH,
    type: QuestionType.TRUE_FALSE,
    difficulty: QuestionDifficulty.MEDIUM,
    prompt:
      'Một lớp trừu tượng (abstract class) có thể chứa cả phương thức trừu tượng chưa cài đặt lẫn phương thức thường đã có phần thân và thuộc tính trạng thái.',
    options: ['Đúng', 'Sai'],
    correctIndex: 0,
    explanation:
      'Đúng. Abstract class có thể định nghĩa trường dữ liệu (fields), constructor và phương thức đã cài đặt để chia sẻ hành vi chung cho các lớp con, đồng thời ép lớp con cài đặt các phương thức abstract.',
    tags: ['oop', 'abstract-class'],
    estimatedTimeSec: 30,
  },
  {
    id: 'q-oop-15',
    topic: ResourceTopic.OOP,
    level: QuestionLevel.NANG_CAO,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.HARD,
    prompt:
      'Mẫu thiết kế nào phù hợp nhất khi bạn muốn bổ sung thêm trách nhiệm (như logging, caching, retry) cho một đối tượng `LLMProvider` lúc runtime mà KHÔNG làm bùng nổ số lượng lớp con kế thừa?',
    options: ['Decorator Pattern', 'Prototype Pattern', 'Memento Pattern', 'Flyweight Pattern'],
    correctIndex: 0,
    explanation:
      'Decorator Pattern bọc đối tượng gốc bằng các lớp cài đặt cùng interface (ví dụ RetryingLLMProvider bọc LoggingLLMProvider bọc GeminiProvider), cho phép xếp chồng tính năng linh hoạt.',
    tags: ['oop', 'design-patterns', 'decorator'],
    estimatedTimeSec: 45,
  },
  {
    id: 'q-oop-16',
    topic: ResourceTopic.OOP,
    level: QuestionLevel.NANG_CAO,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.HARD,
    prompt:
      'Nguyên lý Interface Segregation Principle (ISP) trong SOLID khuyến nghị điều gì?',
    options: [
      'Gộp tất cả các phương thức của hệ thống vào một interface duy nhất để dễ quản lý',
      'Không ép buộc client phải phụ thuộc vào các phương thức mà nó không sử dụng — hãy tách thành nhiều interface nhỏ, chuyên biệt',
      'Mỗi interface chỉ được có tối đa một lớp cài đặt',
      'Không bao giờ dùng interface cho tầng dữ liệu',
    ],
    correctIndex: 1,
    explanation:
      'ISP tránh tạo "fat interface" khiến lớp cài đặt phải viết nhiều hàm rỗng hoặc ném UnsupportedOperationException; thay vào đó tách thành các port/interface nhỏ gọn đúng nhu cầu từng consumer.',
    tags: ['oop', 'solid', 'isp'],
    estimatedTimeSec: 45,
  },

  // ==========================================
  // 3. CSDL (Cơ sở dữ liệu & SQL) — 16 câu APPROVED
  // ==========================================
  {
    id: 'q-csdl-1',
    topic: ResourceTopic.CSDL,
    level: QuestionLevel.CO_BAN,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.EASY,
    prompt:
      'Khoá chính (PRIMARY KEY) của một bảng quan hệ phải thỏa mãn tính chất nào sau đây?',
    options: [
      'Có thể chứa nhiều giá trị NULL',
      'Giá trị duy nhất (UNIQUE) và không được rỗng (NOT NULL)',
      'Bắt buộc phải là kiểu số nguyên tự tăng',
      'Chỉ được gồm đúng 1 cột duy nhất',
    ],
    correctIndex: 1,
    explanation:
      'PRIMARY KEY định danh duy nhất mỗi bộ (row) trong bảng, do đó bắt buộc UNIQUE và NOT NULL (có thể là khoá đơn hoặc khoá ghép từ nhiều cột).',
    tags: ['sql', 'database', 'primary-key'],
    estimatedTimeSec: 30,
  },
  {
    id: 'q-csdl-2',
    topic: ResourceTopic.CSDL,
    level: QuestionLevel.CO_BAN,
    type: QuestionType.TRUE_FALSE,
    difficulty: QuestionDifficulty.EASY,
    prompt:
      'Trong SQL, mệnh đề WHERE được thực thi trước mệnh đề GROUP BY, còn mệnh đề HAVING dùng để lọc các nhóm sau khi đã GROUP BY.',
    options: ['Đúng', 'Sai'],
    correctIndex: 0,
    explanation:
      'Đúng. Thứ tự thực thi logic của SQL: FROM/JOIN → WHERE (lọc từng dòng) → GROUP BY → HAVING (lọc nhóm/hàm tổng hợp) → SELECT → ORDER BY → LIMIT.',
    tags: ['sql', 'group-by', 'having'],
    estimatedTimeSec: 30,
  },
  {
    id: 'q-csdl-3',
    topic: ResourceTopic.CSDL,
    level: QuestionLevel.TRUNG_BINH,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.MEDIUM,
    prompt:
      'Một lược đồ quan hệ ở dạng chuẩn 2NF sẽ đạt dạng chuẩn 3NF khi thoả mãn thêm điều kiện nào?',
    options: [
      'Không có thuộc tính đa trị',
      'Mọi thuộc tính không khoá không phụ thuộc bắc cầu (transitive dependency) vào khoá chính',
      'Không có bất kỳ khoá ngoại nào',
      'Chỉ có tối đa 3 thuộc tính trong bảng',
    ],
    correctIndex: 1,
    explanation:
      '2NF loại bỏ phụ thuộc hàm bộ phận vào khoá chính; 3NF loại bỏ thêm phụ thuộc bắc cầu (X → Y → Z trong đó X là khoá, Y và Z là thuộc tính không khoá).',
    tags: ['database', 'normalization', '3nf'],
    estimatedTimeSec: 40,
  },
  {
    id: 'q-csdl-4',
    topic: ResourceTopic.CSDL,
    level: QuestionLevel.TRUNG_BINH,
    type: QuestionType.DEBUG,
    difficulty: QuestionDifficulty.MEDIUM,
    prompt:
      'Câu truy vấn tìm sinh viên trên 18 tuổi ở Hà Nội hoặc TP.HCM dưới đây bị lỗi logic gì?',
    code: "SELECT * FROM users\nWHERE age > 18 AND city = 'HCM' OR city = 'HN';",
    options: [
      'Không có lỗi nào',
      "Toán tử AND có độ ưu tiên cao hơn OR nên sẽ lấy cả người dưới 18 tuổi ở HN — cần bọc ngoặc (city = 'HCM' OR city = 'HN')",
      'Toán tử OR có độ ưu tiên cao hơn AND',
      'SQL không cho phép kết hợp AND và OR trong cùng mệnh đề WHERE',
    ],
    correctIndex: 1,
    explanation:
      "Vì AND ưu tiên hơn OR, câu lệnh được hiểu là (age > 18 AND city = 'HCM') OR (city = 'HN'). Phải viết: WHERE age > 18 AND (city = 'HCM' OR city = 'HN') hoặc WHERE age > 18 AND city IN ('HCM', 'HN').",
    tags: ['sql', 'where', 'debugging'],
    estimatedTimeSec: 40,
  },
  {
    id: 'q-csdl-5',
    topic: ResourceTopic.CSDL,
    level: QuestionLevel.TRUNG_BINH,
    type: QuestionType.FILL_BLANK,
    difficulty: QuestionDifficulty.MEDIUM,
    prompt:
      'Điền từ khoá SQL còn thiếu để lấy danh sách tất cả người dùng kèm gói dịch vụ của họ (kể cả người dùng chưa có bản ghi trong bảng subscriptions):',
    code: "SELECT u.id, u.email, COALESCE(s.tier, 'FREE') AS plan\nFROM users u\n____ subscriptions s ON s.user_id = u.id;",
    options: ['LEFT JOIN', 'INNER JOIN', 'CROSS JOIN', 'RIGHT EXCLUSIVE JOIN'],
    correctIndex: 0,
    explanation:
      'LEFT JOIN giữ lại toàn bộ bản ghi từ bảng bên trái (users) và gán NULL cho các cột của bảng subscriptions nếu người dùng chưa có subscription, rất phù hợp với quy tắc coi không có subscription là FREE.',
    tags: ['sql', 'join', 'postgresql'],
    estimatedTimeSec: 35,
  },
  {
    id: 'q-csdl-6',
    topic: ResourceTopic.CSDL,
    level: QuestionLevel.NANG_CAO,
    type: QuestionType.READ_CODE,
    difficulty: QuestionDifficulty.HARD,
    prompt: 'Truy vấn PostgreSQL tính bảng xếp hạng XP dưới đây trả về kết quả gì?',
    code: "SELECT u.id, u.display_name, COALESCE(SUM(x.xp_delta), 0) AS period_xp\nFROM users u\nJOIN xp_transactions x ON x.user_id = u.id\nWHERE x.awarded_at >= '2026-11-01' AND u.role = 'STUDENT'\nGROUP BY u.id, u.display_name\nORDER BY period_xp DESC\nLIMIT 10;",
    options: [
      'Top 10 sinh viên có tổng điểm XP tích luỹ cao nhất tính từ ngày 01/11/2026',
      'Danh sách 10 giao dịch XP gần nhất của mọi giảng viên',
      'Tổng XP của toàn hệ thống gộp làm 1 dòng duy nhất',
      'Lỗi cú pháp vì dùng SUM với GROUP BY',
    ],
    correctIndex: 0,
    explanation:
      'Truy vấn gom nhóm theo từng sinh viên (role = STUDENT), tính tổng xp_delta của các giao dịch từ 01/11/2026, sắp xếp giảm dần và lấy 10 sinh viên dẫn đầu.',
    tags: ['sql', 'postgresql', 'aggregation'],
    estimatedTimeSec: 45,
  },
  {
    id: 'q-csdl-7',
    topic: ResourceTopic.CSDL,
    level: QuestionLevel.NANG_CAO,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.HARD,
    prompt:
      'Trong PostgreSQL, khi bảng resources có chỉ mục ghép (Composite B-Tree Index) trên cặp cột (status, created_at), truy vấn nào dưới đây tận dụng chỉ mục hiệu quả nhất?',
    options: [
      "WHERE created_at > '2026-01-01' (không lọc status)",
      "WHERE status = 'PUBLISHED' ORDER BY created_at DESC LIMIT 20",
      "WHERE LOWER(description) LIKE '%sql%'",
      'WHERE downloads > 1000',
    ],
    correctIndex: 1,
    explanation:
      "Theo quy tắc tiền tố trái (Leftmost Prefix) của B-Tree Index (status, created_at), khi lọc bằng hằng số trên cột đầu tiên status = 'PUBLISHED' và sắp xếp theo cột thứ hai created_at, PostgreSQL đọc thẳng theo thứ tự index mà không cần bước Sort riêng.",
    tags: ['postgresql', 'indexing', 'performance'],
    estimatedTimeSec: 50,
  },
  {
    id: 'q-csdl-8',
    topic: ResourceTopic.CSDL,
    level: QuestionLevel.NANG_CAO,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.HARD,
    prompt:
      'Để đảm bảo khi webhook thanh toán gửi trùng 2 lần (retry) hệ thống không cộng tiền hoặc tạo gói Premium lặp, kỹ thuật nào ở tầng CSDL là bắt buộc?',
    options: [
      'Đặt ràng buộc UNIQUE trên cột idempotency_key / event_key và xử lý trong một ACID Transaction',
      'Chỉ kiểm tra bằng biến boolean ở phía React Frontend',
      'Tắt toàn bộ khoá ngoại của bảng payments',
      'Dùng lệnh SELECT không khoá trước khi INSERT mà không có UNIQUE constraint',
    ],
    correctIndex: 0,
    explanation:
      'Ràng buộc UNIQUE trên cột event_key/idempotency_key ở PostgreSQL kết hợp Transaction đảm bảo ngay cả khi 2 webhook đến đồng thời (race condition), chỉ đúng 1 giao dịch được ghi nhận.',
    tags: ['database', 'transaction', 'idempotency', 'postgresql'],
    estimatedTimeSec: 45,
  },
  {
    id: 'q-csdl-9',
    topic: ResourceTopic.CSDL,
    level: QuestionLevel.CO_BAN,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.EASY,
    prompt:
      'Chữ "A" (Atomicity — Tính nguyên tử) trong 4 tính chất ACID của giao dịch CSDL có ý nghĩa gì?',
    options: [
      'Mọi thao tác trong giao dịch phải cùng thành công hoàn toàn hoặc cùng huỷ bỏ (rollback) hoàn toàn nếu có lỗi',
      'Dữ liệu luôn được sao lưu tự động sang 3 trung tâm dữ liệu',
      'Mỗi bảng chỉ chứa giá trị đơn trị không tách nhỏ được nữa',
      'Các câu truy vấn chạy song song không bao giờ chờ khoá',
    ],
    correctIndex: 0,
    explanation:
      'Atomicity (all-or-nothing) đảm bảo một transaction không bao giờ dừng ở trạng thái dang dở một nửa khi xảy ra lỗi hoặc mất điện.',
    tags: ['database', 'acid', 'transaction'],
    estimatedTimeSec: 30,
  },
  {
    id: 'q-csdl-10',
    topic: ResourceTopic.CSDL,
    level: QuestionLevel.CO_BAN,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.EASY,
    prompt:
      'Trong SQL, kết quả của biểu thức `SELECT NULL = NULL;` trả về giá trị gì?',
    options: ['TRUE', 'FALSE', 'NULL (UNKNOWN)', '0'],
    correctIndex: 2,
    explanation:
      'Trong logic ba giá trị của SQL, mọi phép so sánh `=` hoặc `<>` với NULL đều cho kết quả NULL (UNKNOWN). Muốn kiểm tra NULL phải dùng `IS NULL` hoặc `IS NOT NULL`.',
    tags: ['sql', 'null'],
    estimatedTimeSec: 30,
  },
  {
    id: 'q-csdl-11',
    topic: ResourceTopic.CSDL,
    level: QuestionLevel.TRUNG_BINH,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.MEDIUM,
    prompt:
      'Sự khác biệt giữa `DELETE FROM logs` và `TRUNCATE TABLE logs` trong PostgreSQL là gì?',
    options: [
      'DELETE xoá từng dòng (có thể dùng WHERE, kích hoạt trigger ON DELETE theo dòng); TRUNCATE giải phóng nhanh toàn bộ bảng (không dùng WHERE)',
      'TRUNCATE không thể chạy bên trong transaction PostgreSQL',
      'DELETE xoá luôn cả cấu trúc bảng khỏi schema',
      'Hai lệnh hoàn toàn giống hệt nhau về cách thực thi',
    ],
    correctIndex: 0,
    explanation:
      'DELETE quét và đánh dấu xoá từng tuple kèm ghi WAL chi tiết và hỗ trợ WHERE; TRUNCATE thu hồi nhanh toàn bộ trang dữ liệu của bảng (lưu ý trong PostgreSQL TRUNCATE vẫn rollback được trong transaction).',
    tags: ['sql', 'postgresql', 'dml'],
    estimatedTimeSec: 40,
  },
  {
    id: 'q-csdl-12',
    topic: ResourceTopic.CSDL,
    level: QuestionLevel.TRUNG_BINH,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.MEDIUM,
    prompt:
      'Trong PostgreSQL, loại chỉ mục (Index) nào được thiết kế tối ưu cho cột mảng `TEXT[]` (như `tags`) hoặc cột `JSONB` và Full-Text Search (`tsvector`)?',
    options: ['B-Tree Index', 'GIN Index (Generalized Inverted Index)', 'Hash Index', 'BRIN Index'],
    correctIndex: 1,
    explanation:
      'GIN Index lập chỉ mục nghịch đảo cho từng phần tử bên trong giá trị phức hợp (mảng, JSONB, từ khoá tsvector), giúp các toán tử `@>`, `?`, `@@` chạy cực nhanh.',
    tags: ['postgresql', 'indexing', 'gin'],
    estimatedTimeSec: 40,
  },
  {
    id: 'q-csdl-13',
    topic: ResourceTopic.CSDL,
    level: QuestionLevel.TRUNG_BINH,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.MEDIUM,
    prompt:
      'Lỗi "N+1 Queries" thường xảy ra khi dùng ORM (như Prisma) như thế nào?',
    options: [
      'Chạy 1 truy vấn lấy N bản ghi cha, sau đó lặp qua từng bản ghi cha và chạy thêm N truy vấn riêng lẻ để lấy dữ liệu con',
      'Tạo quá N+1 chỉ mục trên cùng một bảng',
      'Mở N+1 kết nối PostgreSQL khi khởi động server',
      'Trả về nhiều hơn N+1 cột trong câu lệnh SELECT *',
    ],
    correctIndex: 0,
    explanation:
      'Thay vì chạy N+1 round-trip DB trong vòng lặp, cần dùng `include`/`JOIN` hoặc gộp ID bằng toán tử `WHERE id IN (...)` (batching).',
    tags: ['database', 'orm', 'performance', 'prisma'],
    estimatedTimeSec: 40,
  },
  {
    id: 'q-csdl-14',
    topic: ResourceTopic.CSDL,
    level: QuestionLevel.TRUNG_BINH,
    type: QuestionType.TRUE_FALSE,
    difficulty: QuestionDifficulty.MEDIUM,
    prompt:
      'Mức cô lập giao dịch mặc định của PostgreSQL là `READ COMMITTED`, giúp ngăn chặn hiện tượng Dirty Read.',
    options: ['Đúng', 'Sai'],
    correctIndex: 0,
    explanation:
      'Đúng. PostgreSQL mặc định dùng READ COMMITTED: mỗi câu lệnh chỉ nhìn thấy dữ liệu đã commit trước khi câu lệnh bắt đầu, nên không bao giờ xảy ra Dirty Read.',
    tags: ['postgresql', 'isolation-level', 'transaction'],
    estimatedTimeSec: 35,
  },
  {
    id: 'q-csdl-15',
    topic: ResourceTopic.CSDL,
    level: QuestionLevel.NANG_CAO,
    type: QuestionType.FILL_BLANK,
    difficulty: QuestionDifficulty.HARD,
    prompt:
      'Trong câu lệnh PostgreSQL đếm quota nguyên tử (atomic upsert), điền mệnh đề còn thiếu để chỉ cộng dồn khi tổng mới không vượt quá hạn mức `$limit`:',
    code: 'INSERT INTO usage_counters (user_id, metric, period_key, used)\nVALUES ($1, $2, $3, $4)\nON CONFLICT (user_id, metric, period_key)\nDO UPDATE SET used = usage_counters.used + EXCLUDED.used\n____ usage_counters.used + EXCLUDED.used <= $5\nRETURNING used;',
    options: ['WHERE', 'HAVING', 'IF', 'CHECK'],
    correctIndex: 0,
    explanation:
      'PostgreSQL hỗ trợ mệnh đề `WHERE` ngay sau `DO UPDATE SET ...` để thực hiện cập nhật có điều kiện ngay trong khoá dòng nguyên tử; nếu điều kiện sai thì không cập nhật và `RETURNING` trả về 0 dòng.',
    tags: ['postgresql', 'upsert', 'concurrency', 'quota'],
    estimatedTimeSec: 50,
  },
  {
    id: 'q-csdl-16',
    topic: ResourceTopic.CSDL,
    level: QuestionLevel.NANG_CAO,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.HARD,
    prompt:
      'Khi thiết kế phân trang trên bảng lớn (hàng triệu dòng) có dữ liệu chèn mới liên tục, vì sao Cursor-based Pagination (Keyset) vượt trội hơn `OFFSET / LIMIT`?',
    options: [
      'OFFSET lớn buộc DB vẫn phải quét và bỏ qua toàn bộ các dòng trước đó (O(offset)), đồng thời dễ bị lặp/sót bản ghi khi có dòng mới chèn vào',
      'OFFSET không hoạt động với mệnh đề ORDER BY',
      'Cursor-based Pagination tự động nén dữ liệu JSON xuống 10 lần',
      'PostgreSQL không hỗ trợ từ khoá OFFSET',
    ],
    correctIndex: 0,
    explanation:
      'Keyset pagination lọc trực tiếp bằng index (`WHERE (created_at, id) < ($c_time, $c_id) LIMIT 20`), giữ độ phức tạp ổn định O(log N + limit) ở mọi trang và không bị trôi trang.',
    tags: ['postgresql', 'pagination', 'performance'],
    estimatedTimeSec: 50,
  },

  // ==========================================
  // 4. MANG (Mạng máy tính & An toàn thông tin) — 16 câu APPROVED
  // ==========================================
  {
    id: 'q-mang-1',
    topic: ResourceTopic.MANG,
    level: QuestionLevel.CO_BAN,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.EASY,
    prompt:
      'Giao thức nào ở tầng Giao vận (Transport Layer) đảm bảo truyền dữ liệu tin cậy, đúng thứ tự và có kiểm soát tắc nghẽn?',
    options: ['UDP', 'TCP', 'IP', 'ICMP'],
    correctIndex: 1,
    explanation:
      'TCP (Transmission Control Protocol) thiết lập kết nối qua bắt tay 3 bước (3-way handshake), đánh số thứ tự byte, xác nhận ACK, truyền lại gói mất và điều khiển luồng/tắc nghẽn.',
    tags: ['networking', 'tcp', 'transport-layer'],
    estimatedTimeSec: 30,
  },
  {
    id: 'q-mang-2',
    topic: ResourceTopic.MANG,
    level: QuestionLevel.CO_BAN,
    type: QuestionType.TRUE_FALSE,
    difficulty: QuestionDifficulty.EASY,
    prompt:
      'Hệ thống DNS (Domain Name System) có nhiệm vụ phân giải tên miền (như devstudy.edu.vn) sang địa chỉ IP.',
    options: ['Đúng', 'Sai'],
    correctIndex: 0,
    explanation:
      'Đúng. DNS đóng vai trò danh bạ của Internet, ánh xạ tên miền dễ nhớ sang địa chỉ IPv4 (bản ghi A) hoặc IPv6 (bản ghi AAAA).',
    tags: ['networking', 'dns'],
    estimatedTimeSec: 25,
  },
  {
    id: 'q-mang-3',
    topic: ResourceTopic.MANG,
    level: QuestionLevel.TRUNG_BINH,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.MEDIUM,
    prompt:
      'Một mạng con IPv4 có địa chỉ 192.168.10.0/24 có tối đa bao nhiêu địa chỉ IP có thể gán cho các máy trạm (host)?',
    options: ['254', '256', '255', '126'],
    correctIndex: 0,
    explanation:
      'Prefix /24 dành 8 bit cho phần host → 2^8 = 256 địa chỉ. Trừ đi 1 địa chỉ mạng (.0) và 1 địa chỉ quảng bá broadcast (.255), còn lại 254 địa chỉ host khả dụng.',
    tags: ['networking', 'ipv4', 'subnetting'],
    estimatedTimeSec: 40,
  },
  {
    id: 'q-mang-4',
    topic: ResourceTopic.MANG,
    level: QuestionLevel.TRUNG_BINH,
    type: QuestionType.FILL_BLANK,
    difficulty: QuestionDifficulty.MEDIUM,
    prompt:
      'Điền tên cờ (flag) TCP còn thiếu trong quy trình bắt tay 3 bước (3-Way Handshake): Client gửi SYN → Server phản hồi ____ → Client gửi ACK.',
    options: ['SYN-ACK', 'FIN-ACK', 'RST', 'PSH-ACK'],
    correctIndex: 0,
    explanation:
      'Quy trình 3-Way Handshake của TCP gồm 3 gói tin: (1) Client gửi SYN, (2) Server trả lời SYN-ACK, (3) Client xác nhận ACK.',
    tags: ['networking', 'tcp', 'handshake'],
    estimatedTimeSec: 30,
  },
  {
    id: 'q-mang-5',
    topic: ResourceTopic.MANG,
    level: QuestionLevel.TRUNG_BINH,
    type: QuestionType.READ_CODE,
    difficulty: QuestionDifficulty.MEDIUM,
    prompt:
      'Khi cấu hình Docker Compose cho dịch vụ chấm code Judge0 như dưới đây, mục đích bảo mật chính là gì?',
    code: 'ENABLE_NETWORK: "false"\nALLOW_ENABLE_NETWORK: "false"\nread_only: true',
    options: [
      'Ngăn mã nguồn của người dùng mở kết nối mạng ra ngoài (chống SSRF/DDoS/reverse shell) và chặn ghi đè hệ thống file gốc',
      'Tăng tốc độ tải thư viện npm từ Internet',
      'Cho phép sinh viên SSH trực tiếp vào máy chủ chấm bài',
      'Tắt kiểm tra giới hạn bộ nhớ RAM',
    ],
    correctIndex: 0,
    explanation:
      'Sandbox chạy code người dùng bắt buộc phải cô lập mạng (no network) và dùng filesystem read-only (trừ thư mục tạm tmpfs) để ngăn tấn công mạng hoặc phá hoại host.',
    tags: ['security', 'docker', 'sandbox'],
    estimatedTimeSec: 40,
  },
  {
    id: 'q-mang-6',
    topic: ResourceTopic.MANG,
    level: QuestionLevel.NANG_CAO,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.HARD,
    prompt:
      'Cải tiến quan trọng nào của giao thức bảo mật TLS 1.3 so với TLS 1.2 giúp vừa giảm độ trễ vừa tăng tính an toàn?',
    options: [
      'Loại bỏ trao đổi khoá tĩnh RSA (bắt buộc Forward Secrecy với Ephemeral Diffie-Hellman) và rút gọn Handshake từ 2-RTT xuống 1-RTT',
      'Thay thế mã hoá AES bằng DES 56-bit',
      'Bỏ hoàn toàn bước kiểm tra chứng chỉ số X.509',
      'Tăng số vòng bắt tay lên 4-RTT',
    ],
    correctIndex: 0,
    explanation:
      'TLS 1.3 loại bỏ các cipher suite yếu (RSA key transport không có Forward Secrecy, CBC mode, SHA-1) và tối ưu hoá quá trình bắt tay chỉ còn 1-RTT (hỗ trợ cả 0-RTT resumption).',
    tags: ['networking', 'security', 'tls'],
    estimatedTimeSec: 50,
  },
  {
    id: 'q-mang-7',
    topic: ResourceTopic.MANG,
    level: QuestionLevel.NANG_CAO,
    type: QuestionType.DEBUG,
    difficulty: QuestionDifficulty.HARD,
    prompt:
      'Đoạn mã Node.js kiểm tra chữ ký Webhook thanh toán dưới đây dễ bị tấn công loại nào?',
    code: 'function verifyWebhook(payload, signatureFromHeader, secret) {\n  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");\n  return expected === signatureFromHeader; // <-- chú ý phép so sánh chuỗi\n}',
    options: [
      'Timing Attack — phép so sánh === dừng ngay ở ký tự sai đầu tiên; nên dùng crypto.timingSafeEqual()',
      'SQL Injection',
      'Buffer Overflow',
      'Cross-Site Scripting (XSS)',
    ],
    correctIndex: 0,
    explanation:
      'Toán tử === so sánh từng byte từ trái sang phải và thoát sớm khi gặp ký tự khác biệt, cho phép kẻ tấn công đo thời gian phản hồi để đoán từng byte chữ ký. Cần dùng crypto.timingSafeEqual() để so sánh trong thời gian hằng số.',
    tags: ['security', 'cryptography', 'hmac', 'timing-attack'],
    estimatedTimeSec: 50,
  },
  {
    id: 'q-mang-8',
    topic: ResourceTopic.MANG,
    level: QuestionLevel.NANG_CAO,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.HARD,
    prompt:
      'Trong cơ chế Refresh Token Rotation, nếu hệ thống phát hiện một Refresh Token đã bị thu hồi (revoked) lại được gửi lên lần nữa, hành động bảo mật đúng đắn là gì?',
    options: [
      'Thu hồi (revoke) ngay lập tức toàn bộ phiên/refresh token của người dùng đó và buộc đăng nhập lại',
      'Cấp lại access token mới như bình thường',
      'Xoá vĩnh viễn tài khoản người dùng khỏi cơ sở dữ liệu',
      'Gia hạn thêm 30 ngày cho token đã bị thu hồi',
    ],
    correctIndex: 0,
    explanation:
      'Khi một refresh token đã xoay vòng (rotated) bị dùng lại, khả năng cao token đã bị đánh cắp (Token Reuse Detection). Hệ thống phải lập tức huỷ toàn bộ refresh token thuộc chuỗi phiên của user đó.',
    tags: ['security', 'auth', 'jwt', 'refresh-token'],
    estimatedTimeSec: 45,
  },
  {
    id: 'q-mang-9',
    topic: ResourceTopic.MANG,
    level: QuestionLevel.CO_BAN,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.EASY,
    prompt:
      'Cổng (port) mặc định của giao thức HTTPS và HTTP lần lượt là cặp số nào?',
    options: ['443 và 80', '80 và 443', '22 và 8080', '53 và 25'],
    correctIndex: 0,
    explanation:
      'HTTPS chạy mặc định trên cổng TCP 443 (HTTP bọc trên TLS), còn HTTP không mã hoá chạy mặc định trên cổng TCP 80.',
    tags: ['networking', 'http', 'https'],
    estimatedTimeSec: 25,
  },
  {
    id: 'q-mang-10',
    topic: ResourceTopic.MANG,
    level: QuestionLevel.CO_BAN,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.EASY,
    prompt:
      'Mã trạng thái HTTP `401 Unauthorized` khác gì với `403 Forbidden`?',
    options: [
      '401 nghĩa là chưa xác thực danh tính (hoặc token hết hạn/sai); 403 nghĩa là đã xác thực nhưng không đủ quyền truy cập tài nguyên',
      '401 dùng cho lỗi máy chủ, còn 403 dùng cho không tìm thấy URL',
      '403 nghĩa là chưa đăng nhập, còn 401 là sai mật khẩu',
      'Hai mã trạng thái này hoàn toàn đồng nghĩa',
    ],
    correctIndex: 0,
    explanation:
      '401 (Unauthenticated) yêu cầu client đăng nhập/làm mới chứng chỉ xác thực; 403 (Forbidden) xác nhận danh tính đã rõ nhưng chính sách phân quyền từ chối thao tác.',
    tags: ['networking', 'http', 'security', 'auth'],
    estimatedTimeSec: 30,
  },
  {
    id: 'q-mang-11',
    topic: ResourceTopic.MANG,
    level: QuestionLevel.TRUNG_BINH,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.MEDIUM,
    prompt:
      'Thuộc tính cookie `SameSite=Lax` hoặc `SameSite=Strict` được dùng chủ yếu để giảm thiểu loại tấn công web nào?',
    options: [
      'CSRF (Cross-Site Request Forgery)',
      'SQL Injection',
      'DNS Cache Poisoning',
      'ARP Spoofing',
    ],
    correctIndex: 0,
    explanation:
      'Thuộc tính SameSite kiểm soát việc trình duyệt có tự động đính kèm cookie trong các yêu cầu xuất phát từ trang web khác (cross-site) hay không, giúp ngăn chặn CSRF hiệu quả.',
    tags: ['security', 'csrf', 'cookie', 'http'],
    estimatedTimeSec: 40,
  },
  {
    id: 'q-mang-12',
    topic: ResourceTopic.MANG,
    level: QuestionLevel.TRUNG_BINH,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.MEDIUM,
    prompt:
      'Vì sao mật khẩu người dùng cần được băm bằng thuật toán như Argon2id hoặc bcrypt kèm salt ngẫu nhiên thay vì dùng SHA-256 thuần?',
    options: [
      'Argon2id/bcrypt cố ý chậm và tốn bộ nhớ (memory-hard), kết hợp salt riêng cho mỗi user giúp chống lại brute-force bằng GPU và Rainbow Table',
      'SHA-256 có thể giải mã ngược trực tiếp về mật khẩu gốc',
      'Argon2id giúp mật khẩu rút ngắn xuống 4 byte',
      'SHA-256 không hỗ trợ ký tự Unicode',
    ],
    correctIndex: 0,
    explanation:
      'SHA-256 được thiết kế để chạy cực nhanh nên kẻ tấn công có thể thử hàng tỷ mật khẩu mỗi giây trên GPU. Argon2id (memory-hard) + salt ngẫu nhiên làm chi phí dò mật khẩu tăng gấp nhiều bậc.',
    tags: ['security', 'password', 'argon2', 'cryptography'],
    estimatedTimeSec: 40,
  },
  {
    id: 'q-mang-13',
    topic: ResourceTopic.MANG,
    level: QuestionLevel.TRUNG_BINH,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.MEDIUM,
    prompt:
      'Trong mô hình OSI 7 tầng, thiết bị Router (bộ định tuyến) hoạt động chủ yếu ở tầng nào và căn cứ vào địa chỉ nào để chuyển tiếp gói tin?',
    options: [
      'Tầng 2 (Data Link) — địa chỉ MAC',
      'Tầng 3 (Network) — địa chỉ IP',
      'Tầng 4 (Transport) — số hiệu cổng (Port)',
      'Tầng 1 (Physical) — tín hiệu điện',
    ],
    correctIndex: 1,
    explanation:
      'Router hoạt động ở tầng Mạng (Layer 3), đọc địa chỉ IP đích và tra bảng định tuyến (Routing Table) để quyết định chặng kế tiếp (next hop). Switch tầng 2 mới dùng địa chỉ MAC.',
    tags: ['networking', 'osi', 'routing'],
    estimatedTimeSec: 35,
  },
  {
    id: 'q-mang-14',
    topic: ResourceTopic.MANG,
    level: QuestionLevel.TRUNG_BINH,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.MEDIUM,
    prompt:
      'Tấn công IDOR (Insecure Direct Object Reference / Broken Object Level Authorization) xảy ra trong tình huống nào sau đây?',
    options: [
      'Người dùng A đổi tham số `/attempts/102` thành `/attempts/103` và xem được bài làm của người dùng B vì backend không kiểm tra quyền sở hữu',
      'Người dùng gõ sai đường dẫn nên nhận lỗi 404',
      'Máy chủ bật nén Gzip cho phản hồi JSON',
      'API giới hạn tốc độ 60 request/phút',
    ],
    correctIndex: 0,
    explanation:
      'IDOR/BOLA đứng đầu OWASP API Security Top 10: backend phải luôn kiểm tra đối tượng được truy xuất thuộc về `req.user.userId` (hoặc role hợp lệ), tuyệt đối không tin `student_id` do client tự truyền.',
    tags: ['security', 'owasp', 'idor', 'authorization'],
    estimatedTimeSec: 40,
  },
  {
    id: 'q-mang-15',
    topic: ResourceTopic.MANG,
    level: QuestionLevel.NANG_CAO,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.HARD,
    prompt:
      'Giao thức HTTP/3 sử dụng QUIC chạy trên UDP nhằm khắc phục nhược điểm cố hữu nào của HTTP/2 trên TCP?',
    options: [
      'TCP Head-of-Line (HoL) Blocking: mất 1 gói tin TCP làm nghẽn toàn bộ các luồng HTTP/2 ghép kênh trên cùng kết nối',
      'HTTP/2 không hỗ trợ mã hoá TLS',
      'TCP không hỗ trợ địa chỉ IPv6',
      'HTTP/2 không nén được header',
    ],
    correctIndex: 0,
    explanation:
      'Dù HTTP/2 ghép nhiều stream trên một kết nối TCP, tầng TCP vẫn buộc giao byte theo thứ tự nên mất 1 gói chặn toàn bộ stream khác. QUIC quản lý các stream độc lập trên UDP nên loại bỏ HoL blocking ở tầng vận chuyển.',
    tags: ['networking', 'http3', 'quic', 'tcp'],
    estimatedTimeSec: 50,
  },
  {
    id: 'q-mang-16',
    topic: ResourceTopic.MANG,
    level: QuestionLevel.NANG_CAO,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.HARD,
    prompt:
      'Khi gọi một API bên ngoài cần khoá bí mật (như Gemini API Key), vì sao truyền API Key qua HTTP Header (vd `x-goog-api-key`) an toàn hơn truyền qua URL Query String (`?key=...`)?',
    options: [
      'URL Query String thường bị ghi lại dạng văn bản thuần trong access log của proxy/CDN/web server, lịch sử trình duyệt và header Referer',
      'URL Query String không được mã hoá khi chạy trên HTTPS',
      'HTTP Header tự động chuyển API Key thành chữ ký RSA',
      'Query String bị giới hạn tối đa 8 ký tự',
    ],
    correctIndex: 0,
    explanation:
      'Dù HTTPS mã hoá cả URL lẫn header trên đường truyền, các hệ thống trung gian (reverse proxy, error tracker, access log) mặc định ghi lại full URL kèm query string, khiến key dễ bị rò rỉ.',
    tags: ['security', 'api-key', 'http', 'logging'],
    estimatedTimeSec: 45,
  },

  // ==========================================
  // 5. HDH (Hệ điều hành) — 16 câu APPROVED
  // ==========================================
  {
    id: 'q-hdh-1',
    topic: ResourceTopic.HDH,
    level: QuestionLevel.CO_BAN,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.EASY,
    prompt: 'Hiện tượng khoá chết (Deadlock) trong hệ điều hành xảy ra khi nào?',
    options: [
      'Khi CPU hoạt động ở mức 100% công suất',
      'Khi một tập các tiến trình đều giữ tài nguyên và chờ vô hạn tài nguyên đang bị tiến trình khác trong tập nắm giữ theo vòng tròn',
      'Khi ổ cứng hết dung lượng trống',
      'Khi một chương trình có lỗi cú pháp lúc biên dịch',
    ],
    correctIndex: 1,
    explanation:
      'Deadlock xảy ra khi hội tụ đủ 4 điều kiện Coffman: Loại trừ tương hỗ (Mutual Exclusion), Giữ và chờ (Hold and Wait), Không cưỡng chế thu hồi (No Preemption) và Chờ đợi vòng tròn (Circular Wait).',
    tags: ['os', 'deadlock', 'concurrency'],
    estimatedTimeSec: 35,
  },
  {
    id: 'q-hdh-2',
    topic: ResourceTopic.HDH,
    level: QuestionLevel.CO_BAN,
    type: QuestionType.TRUE_FALSE,
    difficulty: QuestionDifficulty.EASY,
    prompt:
      'Các luồng (threads) thuộc cùng một tiến trình (process) chia sẻ chung không gian địa chỉ bộ nhớ Heap và biến toàn cục, nhưng mỗi luồng có ngăn xếp (Stack) và thanh ghi riêng.',
    options: ['Đúng', 'Sai'],
    correctIndex: 0,
    explanation:
      'Đúng. Các luồng trong cùng tiến trình dùng chung vùng Code, Data và Heap, nhưng mỗi luồng có Stack và bộ đếm chương trình (Program Counter / Registers) độc lập để thực thi.',
    tags: ['os', 'threads', 'process', 'memory'],
    estimatedTimeSec: 30,
  },
  {
    id: 'q-hdh-3',
    topic: ResourceTopic.HDH,
    level: QuestionLevel.TRUNG_BINH,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.MEDIUM,
    prompt:
      'Thuật toán lập lịch CPU nào dưới đây có nguy cơ gây ra hiện tượng đói tài nguyên (Starvation) cho các tiến trình có thời gian chạy dài?',
    options: [
      'Round Robin (RR)',
      'First-Come, First-Served (FCFS)',
      'Shortest Job First (SJF) / Shortest Remaining Time First',
      'Lập lịch tuần tự FIFO',
    ],
    correctIndex: 2,
    explanation:
      'SJF luôn ưu tiên tiến trình có thời gian thực thi ngắn nhất. Nếu các tiến trình ngắn liên tục đến hệ thống, tiến trình dài sẽ bị đẩy lùi vô thời hạn (Starvation). Khắc phục bằng kỹ thuật Aging (tăng dần độ ưu tiên theo thời gian chờ).',
    tags: ['os', 'cpu-scheduling', 'starvation'],
    estimatedTimeSec: 40,
  },
  {
    id: 'q-hdh-4',
    topic: ResourceTopic.HDH,
    level: QuestionLevel.TRUNG_BINH,
    type: QuestionType.DEBUG,
    difficulty: QuestionDifficulty.MEDIUM,
    prompt:
      'Hai luồng cùng thực thi hàm tăng biến đếm toàn cục counter++ mà không có đồng bộ hoá như dưới đây gây ra lỗi gì?',
    code: 'int counter = 0;\nvoid* worker(void* arg) {\n  for (int i = 0; i < 100000; i++) {\n    counter++; // đọc -> cộng 1 -> ghi\n  }\n  return NULL;\n}',
    options: [
      'Race Condition (Điều kiện tranh chấp) làm kết quả cuối cùng thường nhỏ hơn 200000',
      'Lỗi biên dịch vì biến toàn cục không dùng được trong hàm con',
      'Tràn bộ nhớ Stack (Stack Overflow)',
      'Không có vấn đề gì vì phép ++ luôn là nguyên tử (atomic)',
    ],
    correctIndex: 0,
    explanation:
      'Phép counter++ gồm 3 lệnh máy (Load, Increment, Store), không phải thao tác nguyên tử. Hai luồng xen kẽ nhau sẽ ghi đè kết quả của nhau (Race Condition). Cần dùng pthread_mutex_lock hoặc std::atomic<int>.',
    tags: ['os', 'concurrency', 'race-condition', 'c'],
    estimatedTimeSec: 40,
  },
  {
    id: 'q-hdh-5',
    topic: ResourceTopic.HDH,
    level: QuestionLevel.TRUNG_BINH,
    type: QuestionType.FILL_BLANK,
    difficulty: QuestionDifficulty.MEDIUM,
    prompt:
      'Điền hàm POSIX Threads còn thiếu để giải phóng khoá Mutex sau khi luồng đã thực hiện xong đoạn găng (Critical Section):',
    code: 'pthread_mutex_lock(&lock);\nshared_balance += amount;\n____(&lock);',
    options: ['pthread_mutex_unlock', 'pthread_mutex_destroy', 'pthread_exit', 'pthread_join'],
    correctIndex: 0,
    explanation:
      'Sau khi vào vùng găng bằng pthread_mutex_lock(&lock), luồng bắt buộc phải gọi pthread_mutex_unlock(&lock) để nhường quyền truy cập cho các luồng khác.',
    tags: ['os', 'pthreads', 'mutex', 'linux'],
    estimatedTimeSec: 30,
  },
  {
    id: 'q-hdh-6',
    topic: ResourceTopic.HDH,
    level: QuestionLevel.NANG_CAO,
    type: QuestionType.READ_CODE,
    difficulty: QuestionDifficulty.HARD,
    prompt:
      'Với một Mutex mặc định (PTHREAD_MUTEX_NORMAL) trong C, chuyện gì xảy ra khi cùng một luồng gọi đoạn code sau?',
    code: 'pthread_mutex_lock(&m);\n// xử lý bước 1\npthread_mutex_lock(&m); // gọi lock lần 2 trên cùng mutex m',
    options: [
      'Hàm trả về ngay mà không chặn',
      'Self-Deadlock — luồng tự treo chính nó vì chờ mutex đang do chính nó nắm giữ được mở khoá',
      'Mutex tự động mở khoá và chạy tiếp',
      'Biên dịch báo lỗi cú pháp',
    ],
    correctIndex: 1,
    explanation:
      'Mutex thường không cho phép khoá đệ quy (non-recursive). Khi luồng đã giữ khoá m lại tiếp tục gọi lock(&m) mà chưa unlock, nó sẽ tự chờ chính mình vô hạn (Self-Deadlock).',
    tags: ['os', 'pthreads', 'deadlock', 'mutex'],
    estimatedTimeSec: 45,
  },
  {
    id: 'q-hdh-7',
    topic: ResourceTopic.HDH,
    level: QuestionLevel.NANG_CAO,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.HARD,
    prompt:
      'Trong cơ chế quản lý bộ nhớ ảo phân trang (Paging), bộ đệm TLB (Translation Lookaside Buffer) có vai trò gì?',
    options: [
      'Lưu trữ vĩnh viễn các file thực thi trên đĩa cứng',
      'Bộ nhớ đệm phần cứng tốc độ cao lưu ánh xạ từ số hiệu trang ảo (Virtual Page) sang khung trang vật lý (Physical Frame) gần nhất',
      'Tự động sửa lỗi cú pháp chương trình C++',
      'Nén dung lượng ảnh và video',
    ],
    correctIndex: 1,
    explanation:
      'TLB là phần cứng cache nằm trong MMU giúp dịch địa chỉ ảo sang địa chỉ vật lý chỉ trong 1 chu kỳ xung nhịp khi TLB Hit, tránh phải đọc bảng trang (Page Table) nhiều cấp trong RAM.',
    tags: ['os', 'virtual-memory', 'paging', 'tlb'],
    estimatedTimeSec: 45,
  },
  {
    id: 'q-hdh-8',
    topic: ResourceTopic.HDH,
    level: QuestionLevel.NANG_CAO,
    type: QuestionType.READ_CODE,
    difficulty: QuestionDifficulty.HARD,
    prompt:
      'Bao nhiêu tiến trình (kể cả tiến trình gốc ban đầu) sẽ được tạo ra sau khi thực thi đoạn mã C trên Linux dưới đây (giả sử mọi lời gọi fork() đều thành công)?',
    code: '#include <unistd.h>\nint main() {\n  fork();\n  fork();\n  fork();\n  return 0;\n}',
    options: ['3 tiến trình', '4 tiến trình', '6 tiến trình', '8 tiến trình'],
    correctIndex: 3,
    explanation:
      'Mỗi lệnh fork() nhân đôi số tiến trình hiện tại đang chạy tiếp từ dòng lệnh đó. Sau n = 3 lần gọi fork() liên tiếp không điều kiện, tổng số tiến trình là 2^3 = 8.',
    tags: ['os', 'linux', 'fork', 'process'],
    estimatedTimeSec: 45,
  },
  {
    id: 'q-hdh-9',
    topic: ResourceTopic.HDH,
    level: QuestionLevel.CO_BAN,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.EASY,
    prompt:
      'Chuyển ngữ cảnh (Context Switch) giữa hai tiến trình xảy ra khi hệ điều hành thực hiện thao tác nào?',
    options: [
      'Lưu trạng thái (thanh ghi, bộ đếm chương trình, con trỏ ngăn xếp) của tiến trình hiện tại vào PCB và nạp trạng thái của tiến trình kế tiếp',
      'Biên dịch lại mã nguồn chương trình sang mã máy',
      'Tắt máy và khởi động lại nhân Linux',
      'Xoá toàn bộ dữ liệu trong bộ nhớ Heap',
    ],
    correctIndex: 0,
    explanation:
      'Kernel lưu ngữ cảnh của tiến trình cũ vào Process Control Block (PCB) và khôi phục PCB của tiến trình mới để CPU tiếp tục thực thi chính xác từ điểm tạm dừng.',
    tags: ['os', 'process', 'context-switch'],
    estimatedTimeSec: 35,
  },
  {
    id: 'q-hdh-10',
    topic: ResourceTopic.HDH,
    level: QuestionLevel.CO_BAN,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.EASY,
    prompt:
      'Lời gọi hệ thống (System Call) đóng vai trò gì trong kiến trúc hệ điều hành hiện đại?',
    options: [
      'Giao diện chuẩn để chương trình ở chế độ người dùng (User Mode) yêu cầu nhân hệ điều hành (Kernel Mode) thực hiện dịch vụ đặc quyền như đọc/ghi file, cấp phát bộ nhớ, mở socket',
      'Trình biên dịch chuyển mã C sang Assembly',
      'Giao thức truyền tệp giữa hai máy tính qua Internet',
      'Phần mềm diệt virus chạy ở tầng ứng dụng',
    ],
    correctIndex: 0,
    explanation:
      'Để bảo vệ hệ thống, ứng dụng User Mode không được truy cập trực tiếp phần cứng mà phải đi qua System Call để chuyển có kiểm soát sang Kernel Mode.',
    tags: ['os', 'system-call', 'kernel'],
    estimatedTimeSec: 35,
  },
  {
    id: 'q-hdh-11',
    topic: ResourceTopic.HDH,
    level: QuestionLevel.TRUNG_BINH,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.MEDIUM,
    prompt:
      'Hiện tượng Thrashing (giật trang) trong quản lý bộ nhớ ảo xảy ra khi nào?',
    options: [
      'Hệ thống dành phần lớn thời gian để hoán đổi trang (paging in/out) giữa RAM và đĩa thay vì thực thi lệnh hữu ích do tổng working set vượt quá RAM vật lý',
      'CPU quá nhàn rỗi không có tiến trình nào chạy',
      'Ổ cứng SSD có quá nhiều dung lượng trống',
      'Tất cả các tiến trình đều hoàn tất ngay lập tức',
    ],
    correctIndex: 0,
    explanation:
      'Khi quá nhiều tiến trình tranh giành khung trang ít ỏi, page fault liên tục xảy ra khiến CPU chờ I/O đĩa gần như liên tục, thông lượng hệ thống sụp đổ.',
    tags: ['os', 'virtual-memory', 'thrashing'],
    estimatedTimeSec: 40,
  },
  {
    id: 'q-hdh-12',
    topic: ResourceTopic.HDH,
    level: QuestionLevel.TRUNG_BINH,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.MEDIUM,
    prompt:
      'Trong Linux, tiến trình "Zombie" (trạng thái Z) là gì?',
    options: [
      'Tiến trình đang chạy chiếm 100% CPU không thể dừng',
      'Tiến trình con đã kết thúc thực thi nhưng vẫn còn bản ghi trong bảng tiến trình vì tiến trình cha chưa gọi wait()/waitpid() để thu hồi mã thoát',
      'Tiến trình chưa từng được cấp phát PID',
      'Tiến trình hệ thống của nhân Linux (PID 1)',
    ],
    correctIndex: 1,
    explanation:
      'Tiến trình Zombie không còn dùng RAM hay CPU, nhưng vẫn giữ một slot PID trong bảng tiến trình để trả exit status cho cha cho tới khi cha gọi wait().',
    tags: ['os', 'linux', 'process', 'zombie'],
    estimatedTimeSec: 40,
  },
  {
    id: 'q-hdh-13',
    topic: ResourceTopic.HDH,
    level: QuestionLevel.TRUNG_BINH,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.MEDIUM,
    prompt:
      'Điểm khác biệt cơ bản giữa Semaphore đếm (Counting Semaphore) và Mutex là gì?',
    options: [
      'Mutex có khái niệm quyền sở hữu (chỉ luồng khoá mới được mở) cho 1 tài nguyên độc quyền; Counting Semaphore cho phép tối đa N luồng cùng truy cập và có thể dùng báo hiệu giữa các luồng khác nhau',
      'Semaphore chỉ dùng được trên Windows, còn Mutex chỉ có trên Linux',
      'Mutex không thể dùng để bảo vệ vùng găng',
      'Semaphore luôn có giá trị âm',
    ],
    correctIndex: 0,
    explanation:
      'Mutex (Mutual Exclusion) gắn với ownership để loại trừ tương hỗ; Semaphore quản lý bộ đếm N suất tài nguyên hoặc đồng bộ tín hiệu (Producer-Consumer).',
    tags: ['os', 'concurrency', 'semaphore', 'mutex'],
    estimatedTimeSec: 45,
  },
  {
    id: 'q-hdh-14',
    topic: ResourceTopic.HDH,
    level: QuestionLevel.TRUNG_BINH,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.MEDIUM,
    prompt:
      'Trong lập lịch Round Robin (RR), nếu chọn lượng tử thời gian (time quantum) quá nhỏ sẽ dẫn tới hệ quả gì?',
    options: [
      'Chi phí chuyển ngữ cảnh (Context Switch overhead) tăng rất cao, làm giảm hiệu suất thực thi thực tế của CPU',
      'Thuật toán suy biến thành FCFS',
      'Các tiến trình ngắn phải chờ lâu nhất',
      'Không còn xảy ra chuyển ngữ cảnh nào',
    ],
    correctIndex: 0,
    explanation:
      'Time quantum quá nhỏ khiến CPU liên tục ngắt để chuyển ngữ cảnh (overhead chiếm tỷ trọng lớn); ngược lại quá lớn sẽ làm RR suy biến gần giống FCFS, giảm tính tương tác.',
    tags: ['os', 'cpu-scheduling', 'round-robin'],
    estimatedTimeSec: 40,
  },
  {
    id: 'q-hdh-15',
    topic: ResourceTopic.HDH,
    level: QuestionLevel.NANG_CAO,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.HARD,
    prompt:
      'Kỹ thuật Copy-on-Write (CoW) khi gọi `fork()` trên Linux giúp tối ưu hiệu năng bằng cách nào?',
    options: [
      'Tiến trình cha và con chia sẻ chung các trang vật lý ở chế độ chỉ đọc; chỉ khi một bên ghi dữ liệu vào trang nào thì nhân mới sao chép riêng trang đó',
      'Sao chép toàn bộ RAM của tiến trình cha sang đĩa cứng trước khi tạo con',
      'Cho phép tiến trình con ghi đè trực tiếp dữ liệu của tiến trình cha',
      'Bỏ qua hoàn toàn việc tạo không gian địa chỉ ảo cho tiến trình con',
    ],
    correctIndex: 0,
    explanation:
      'Nhờ CoW, `fork()` (thường theo ngay sau bởi `exec()`) không lãng phí thời gian sao chép hàng trăm MB bộ nhớ không bao giờ bị sửa đổi.',
    tags: ['os', 'linux', 'copy-on-write', 'virtual-memory'],
    estimatedTimeSec: 45,
  },
  {
    id: 'q-hdh-16',
    topic: ResourceTopic.HDH,
    level: QuestionLevel.NANG_CAO,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.HARD,
    prompt:
      'Để phá vỡ điều kiện "Chờ đợi vòng tròn" (Circular Wait) phòng tránh Deadlock khi nhiều luồng cần chiếm đồng thời 2 khoá Mutex A và B, cách đơn giản và hiệu quả nhất là gì?',
    options: [
      'Quy ước thứ tự toàn phần cố định: mọi luồng bắt buộc phải lock A trước rồi mới lock B',
      'Cho luồng này lock A → B còn luồng kia lock B → A để chia đều tải',
      'Không bao giờ mở khoá Mutex sau khi sử dụng',
      'Tăng số lượng luồng lên gấp đôi',
    ],
    correctIndex: 0,
    explanation:
      'Áp đặt thứ tự chiếm tài nguyên nghiêm ngặt (Lock Ordering) khiến đồ thị chờ đợi không bao giờ tạo được chu trình khép kín, loại bỏ hoàn toàn khả năng Deadlock.',
    tags: ['os', 'deadlock', 'concurrency'],
    estimatedTimeSec: 45,
  },

  // ==========================================
  // 6. AI_DS (Trí tuệ nhân tạo & Data Science) — 16 câu APPROVED
  // ==========================================
  {
    id: 'q-aids-1',
    topic: ResourceTopic.AI_DS,
    level: QuestionLevel.CO_BAN,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.EASY,
    prompt:
      'Hiện tượng quá khớp (Overfitting) trong học máy (Machine Learning) có biểu hiện nào sau đây?',
    options: [
      'Mô hình có độ chính xác thấp trên cả tập huấn luyện (train) lẫn tập kiểm thử (test)',
      'Mô hình đạt độ chính xác rất cao trên tập huấn luyện nhưng dự đoán kém trên dữ liệu mới chưa từng gặp (tập test)',
      'Mô hình có tốc độ huấn luyện quá nhanh',
      'Tập dữ liệu không có nhãn',
    ],
    correctIndex: 1,
    explanation:
      'Overfitting xảy ra khi mô hình quá phức tạp và học thuộc cả nhiễu (noise) của tập train, dẫn đến khả năng tổng quát hoá kém trên tập test. Khắc phục bằng Regularization (L1/L2), Dropout, Cross-Validation hoặc thu thập thêm dữ liệu.',
    tags: ['ml', 'overfitting', 'data-science'],
    estimatedTimeSec: 35,
  },
  {
    id: 'q-aids-2',
    topic: ResourceTopic.AI_DS,
    level: QuestionLevel.CO_BAN,
    type: QuestionType.TRUE_FALSE,
    difficulty: QuestionDifficulty.EASY,
    prompt:
      'Đối với bài toán phân loại dữ liệu mất cân bằng nghiêm trọng (ví dụ: 99% giao dịch bình thường, 1% gian lận), chỉ số Accuracy đơn thuần không phản ánh đúng chất lượng mô hình mà cần dùng Precision, Recall và F1-Score.',
    options: ['Đúng', 'Sai'],
    correctIndex: 0,
    explanation:
      'Đúng. Nếu một mô hình luôn đoán 100% là "bình thường", Accuracy vẫn đạt 99% nhưng Recall của lớp "gian lận" bằng 0%. Do đó bắt buộc phải đánh giá qua Precision, Recall, F1-Score hoặc PR-AUC.',
    tags: ['ml', 'metrics', 'imbalanced-data'],
    estimatedTimeSec: 35,
  },
  {
    id: 'q-aids-3',
    topic: ResourceTopic.AI_DS,
    level: QuestionLevel.TRUNG_BINH,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.MEDIUM,
    prompt:
      'Hàm kích hoạt (Activation Function) nào thường được chọn làm mặc định ở các lớp ẩn (hidden layers) của mạng nơ-ron sâu để giảm thiểu hiện tượng triệt tiêu đạo hàm (Vanishing Gradient)?',
    options: ['Sigmoid', 'ReLU (Rectified Linear Unit)', 'Hàm bước nhảy Heaviside', 'Linear (y = x)'],
    correctIndex: 1,
    explanation:
      'Hàm ReLU(x) = max(0, x) có đạo hàm bằng 1 với mọi x > 0, tính toán cực nhanh và giúp hạn chế hiện tượng đạo hàm tiến về 0 khi lan truyền ngược qua nhiều lớp sâu (so với Sigmoid/Tanh).',
    tags: ['deep-learning', 'activation', 'relu'],
    estimatedTimeSec: 35,
  },
  {
    id: 'q-aids-4',
    topic: ResourceTopic.AI_DS,
    level: QuestionLevel.TRUNG_BINH,
    type: QuestionType.DEBUG,
    difficulty: QuestionDifficulty.MEDIUM,
    prompt:
      'Đoạn mã tiền xử lý dữ liệu với scikit-learn dưới đây mắc lỗi nghiêm trọng nào trong quy trình Học máy?',
    code: 'scaler = StandardScaler()\nX_scaled = scaler.fit_transform(X_all) # chuẩn hoá trên toàn bộ dữ liệu\nX_train, X_test, y_train, y_test = train_test_split(X_scaled, y, test_size=0.2)',
    options: [
      'Data Leakage (Rò rỉ dữ liệu): tính mean/std trên cả tập test trước khi chia dữ liệu; phải chia train/test trước rồi chỉ fit() trên X_train',
      'test_size=0.2 là không hợp lệ trong Python',
      'StandardScaler chỉ dùng được cho dữ liệu văn bản',
      'Không có lỗi nào',
    ],
    correctIndex: 0,
    explanation:
      'Gọi fit_transform trên toàn bộ dữ liệu trước khi chia làm thông tin thống kê (mean, variance) của tập test bị rò rỉ vào quá trình huấn luyện (Data Leakage). Quy trình chuẩn: chia train/test trước, gọi scaler.fit_transform(X_train) và chỉ gọi scaler.transform(X_test).',
    tags: ['ml', 'data-leakage', 'sklearn', 'python'],
    estimatedTimeSec: 45,
  },
  {
    id: 'q-aids-5',
    topic: ResourceTopic.AI_DS,
    level: QuestionLevel.TRUNG_BINH,
    type: QuestionType.FILL_BLANK,
    difficulty: QuestionDifficulty.MEDIUM,
    prompt:
      'Điền lời gọi phương thức PyTorch còn thiếu trong vòng lặp huấn luyện để xoá đạo hàm tích luỹ của bước trước trước khi lan truyền ngược (backpropagation):',
    code: 'for inputs, labels in dataloader:\n    optimizer.____()\n    outputs = model(inputs)\n    loss = criterion(outputs, labels)\n    loss.backward()\n    optimizer.step()',
    options: ['zero_grad', 'reset_weights', 'clear_loss', 'step_back'],
    correctIndex: 0,
    explanation:
      'PyTorch mặc định cộng dồn (accumulate) gradient vào thuộc tính .grad sau mỗi lần gọi loss.backward(). Do đó phải gọi optimizer.zero_grad() ở đầu mỗi bước cập nhật.',
    tags: ['deep-learning', 'pytorch', 'backpropagation'],
    estimatedTimeSec: 40,
  },
  {
    id: 'q-aids-6',
    topic: ResourceTopic.AI_DS,
    level: QuestionLevel.NANG_CAO,
    type: QuestionType.READ_CODE,
    difficulty: QuestionDifficulty.HARD,
    prompt:
      'Trong kiến trúc AI Service, đoạn mã TypeScript dưới đây thực hiện cơ chế kỹ thuật bắt buộc nào khi nhận kết quả từ LLM?',
    code: 'const rawJson = await llmClient.generate({ prompt, responseFormat: "json_object" });\nconst parsed = PracticeSetResponseSchema.safeParse(JSON.parse(rawJson));\nif (!parsed.success) {\n  return retryWithSchemaErrorFeedback(prompt, parsed.error);\n}',
    options: [
      'Ép LLM trả về JSON theo cấu trúc và kiểm tra nghiêm ngặt bằng Zod Schema kèm cơ chế retry nếu sai định dạng',
      'Huấn luyện lại toàn bộ trọng số của mô hình LLM trên trình duyệt',
      'Bỏ qua kiểm tra dữ liệu để tăng tốc độ phản hồi',
      'Mã hoá đầu ra bằng thuật toán RSA',
    ],
    correctIndex: 0,
    explanation:
      'Đầu ra của LLM không bao giờ được tin cậy tuyệt đối: backend bắt buộc phải yêu cầu JSON theo schema, validate nghiêm ngặt bằng Zod/JSON Schema và có cơ chế retry hoặc fallback tất định.',
    tags: ['llm', 'structured-output', 'validation'],
    estimatedTimeSec: 45,
  },
  {
    id: 'q-aids-7',
    topic: ResourceTopic.AI_DS,
    level: QuestionLevel.NANG_CAO,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.HARD,
    prompt:
      'Khi sinh viên tải lên slide/giáo trình PDF để AI sinh bộ câu hỏi ôn tập bám sát nội dung môn học, kiến trúc nào hạn chế tốt nhất hiện tượng ảo giác (Hallucination) của LLM?',
    options: [
      'RAG (Retrieval-Augmented Generation): chia nhỏ giáo trình thành các đoạn (chunks), truy xuất các đoạn liên quan nhất đưa vào ngữ cảnh prompt và yêu cầu LLM chỉ đặt câu hỏi dựa trên ngữ cảnh đó',
      'Tăng tham số temperature của LLM lên 2.0',
      'Chỉ gửi tiêu đề file PDF mà không gửi nội dung bài học',
      'Xoá toàn bộ prompt hệ thống (system prompt)',
    ],
    correctIndex: 0,
    explanation:
      'RAG neo giữ câu trả lời của LLM vào nguồn học liệu thực tế đã được truy xuất (grounding), kết hợp temperature thấp giúp câu hỏi và lời giải bám sát giáo trình mà không bịa thông tin.',
    tags: ['llm', 'rag', 'hallucination'],
    estimatedTimeSec: 45,
  },
  {
    id: 'q-aids-8',
    topic: ResourceTopic.AI_DS,
    level: QuestionLevel.NANG_CAO,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.HARD,
    prompt:
      'Trong thuật toán Self-Attention của kiến trúc Transformer: Attention(Q, K, V) = softmax((Q × K^T) / sqrt(d_k)) × V, việc chia cho hệ số căn bậc hai sqrt(d_k) có tác dụng gì?',
    options: [
      'Ngăn tích vô hướng Q × K^T phình quá lớn khi số chiều d_k cao, tránh đẩy hàm softmax vào vùng bão hoà có đạo hàm cực nhỏ',
      'Giảm số lượng từ vựng trong từ điển xuống một nửa',
      'Thay thế hoàn toàn mạng truyền thẳng Feed-Forward',
      'Biến ma trận không vuông thành ma trận đơn vị',
    ],
    correctIndex: 0,
    explanation:
      'Khi chiều vector d_k lớn, phương sai của tích vô hướng Q × K^T tăng theo d_k, làm các giá trị đầu vào softmax quá lớn và đẩy gradient của softmax về gần 0. Chia cho sqrt(d_k) chuẩn hoá phương sai về 1.',
    tags: ['deep-learning', 'transformer', 'attention'],
    estimatedTimeSec: 55,
  },
  {
    id: 'q-aids-9',
    topic: ResourceTopic.AI_DS,
    level: QuestionLevel.CO_BAN,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.EASY,
    prompt:
      'Thuật toán K-Means thuộc nhóm bài toán học máy nào sau đây?',
    options: [
      'Học có giám sát — Hồi quy (Supervised Regression)',
      'Học không giám sát — Phân cụm (Unsupervised Clustering)',
      'Học tăng cường (Reinforcement Learning)',
      'Học có giám sát — Phân loại nhị phân',
    ],
    correctIndex: 1,
    explanation:
      'K-Means phân nhóm các điểm dữ liệu chưa có nhãn thành K cụm dựa trên khoảng cách tới tâm cụm (centroid), là thuật toán kinh điển của học không giám sát.',
    tags: ['ml', 'clustering', 'k-means'],
    estimatedTimeSec: 30,
  },
  {
    id: 'q-aids-10',
    topic: ResourceTopic.AI_DS,
    level: QuestionLevel.CO_BAN,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.EASY,
    prompt:
      'Trong bài toán phân loại nhị phân, chỉ số Precision (Độ chính xác dương tính) được định nghĩa bằng công thức nào?',
    options: ['TP / (TP + FP)', 'TP / (TP + FN)', '(TP + TN) / (TP + TN + FP + FN)', 'FP / (FP + TN)'],
    correctIndex: 0,
    explanation:
      'Precision = TP / (TP + FP) đo tỷ lệ mẫu thực sự dương tính trong số các mẫu mà mô hình dự đoán là dương tính. Recall mới là TP / (TP + FN).',
    tags: ['ml', 'metrics', 'precision-recall'],
    estimatedTimeSec: 35,
  },
  {
    id: 'q-aids-11',
    topic: ResourceTopic.AI_DS,
    level: QuestionLevel.TRUNG_BINH,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.MEDIUM,
    prompt:
      'Kỹ thuật Cross-Validation (K-Fold) dùng trong huấn luyện mô hình Học máy mang lại lợi ích chính là gì?',
    options: [
      'Ước lượng hiệu năng tổng quát hoá của mô hình ổn định hơn, tránh phụ thuộc may rủi vào một lần chia train/validation duy nhất',
      'Giảm thời gian huấn luyện xuống K lần',
      'Tự động gán nhãn cho dữ liệu chưa có nhãn',
      'Loại bỏ hoàn toàn nhu cầu có tập test độc lập',
    ],
    correctIndex: 0,
    explanation:
      'K-Fold chia tập train thành K phần, xoay vòng mỗi phần làm validation 1 lần và lấy trung bình kết quả, giúp chọn siêu tham số tin cậy hơn đặc biệt khi tập dữ liệu vừa/nhỏ.',
    tags: ['ml', 'cross-validation', 'evaluation'],
    estimatedTimeSec: 40,
  },
  {
    id: 'q-aids-12',
    topic: ResourceTopic.AI_DS,
    level: QuestionLevel.TRUNG_BINH,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.MEDIUM,
    prompt:
      'Sự khác biệt đáng chú ý giữa Regularization L1 (Lasso) và L2 (Ridge) đối với trọng số (weights) của mô hình tuyến tính là gì?',
    options: [
      'L1 có xu hướng ép nhiều trọng số về đúng 0 (tạo mô hình thưa — feature selection); L2 thu nhỏ đều các trọng số về gần 0 nhưng hiếm khi bằng đúng 0',
      'L2 xoá bỏ toàn bộ đặc trưng còn L1 tăng giá trị trọng số',
      'L1 chỉ dùng cho mạng tích chập CNN',
      'Cả L1 và L2 đều làm tăng Overfitting',
    ],
    correctIndex: 0,
    explanation:
      'Hình học của chuẩn L1 (hình thoi có góc nhọn trên trục toạ độ) khiến nghiệm tối ưu dễ nằm trên trục (trọng số = 0), giúp chọn lọc đặc trưng tự động.',
    tags: ['ml', 'regularization', 'l1-l2'],
    estimatedTimeSec: 45,
  },
  {
    id: 'q-aids-13',
    topic: ResourceTopic.AI_DS,
    level: QuestionLevel.TRUNG_BINH,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.MEDIUM,
    prompt:
      'Trong hệ thống gợi ý ôn tập sử dụng ước lượng Bayesian smoothing `m = (Σ w·c + α·p0) / (Σ w + α)`, vai trò của thành phần prior `α·p0` là gì?',
    options: [
      'Tránh đánh giá cực đoan 0% hoặc 100% khi học sinh mới làm rất ít câu (cold start), kéo ước lượng mềm về mức kỳ vọng p0 cho đến khi đủ dữ liệu',
      'Loại bỏ toàn bộ lịch sử làm bài cũ của học sinh',
      'Tăng ngẫu nhiên độ chính xác của học sinh lên 100%',
      'Chỉ dùng để tính thời gian làm bài trung bình',
    ],
    correctIndex: 0,
    explanation:
      'Nếu học sinh mới làm đúng 1 câu, độ chính xác thô là 100% (hoặc sai 1 câu là 0%). Bayesian prior làm mượt ước lượng ở giai đoạn ít mẫu và giảm dần ảnh hưởng khi lượng bằng chứng `Σ w` tăng lên.',
    tags: ['data-science', 'bayesian', 'recommender'],
    estimatedTimeSec: 45,
  },
  {
    id: 'q-aids-14',
    topic: ResourceTopic.AI_DS,
    level: QuestionLevel.TRUNG_BINH,
    type: QuestionType.TRUE_FALSE,
    difficulty: QuestionDifficulty.MEDIUM,
    prompt:
      'Trong các mô hình ngôn ngữ lớn (LLM), tham số `temperature` càng tiến gần về 0 thì đầu ra càng mang tính tất định (ít ngẫu nhiên) hơn.',
    options: ['Đúng', 'Sai'],
    correctIndex: 0,
    explanation:
      'Đúng. Temperature thấp làm phân phối xác suất softmax sắc nhọn hơn, ưu tiên chọn token có xác suất cao nhất — rất phù hợp khi cần sinh JSON theo schema hoặc trích xuất dữ liệu.',
    tags: ['llm', 'decoding', 'temperature'],
    estimatedTimeSec: 30,
  },
  {
    id: 'q-aids-15',
    topic: ResourceTopic.AI_DS,
    level: QuestionLevel.NANG_CAO,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.HARD,
    prompt:
      'Khi ứng dụng LLM cho phép AI đề xuất danh sách `question_ids` từ kho đề, biện pháp phòng vệ nào ở backend là chắc chắn nhất chống Hallucination và Prompt Injection?',
    options: [
      'Đối chiếu mọi ID LLM trả về với tập ứng viên hợp lệ (APPROVED) từ DB, loại bỏ ID không tồn tại/ngoài pool và luôn có fallback rule-based; đồng thời không cho LLM truyền `student_id`',
      'Chỉ cần thêm câu "Xin đừng bịa ID" vào cuối system prompt là đủ đảm bảo 100%',
      'Cho phép LLM thực thi trực tiếp câu lệnh SQL do nó tự viết lên DB production',
      'Tăng max_output_tokens lên 100.000',
    ],
    correctIndex: 0,
    explanation:
      'Prompt chỉ giảm xác suất sai sót chứ không phải rào chắn bảo mật. Mọi bất biến (quyền truy cập theo `student_id` phiên hiện tại, tính hợp lệ của ID trong pool) bắt buộc phải được backend kiểm soát tất định.',
    tags: ['llm', 'security', 'prompt-injection', 'hallucination'],
    estimatedTimeSec: 45,
  },
  {
    id: 'q-aids-16',
    topic: ResourceTopic.AI_DS,
    level: QuestionLevel.NANG_CAO,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.HARD,
    prompt:
      'Tấn công "Indirect Prompt Injection" trong hệ thống AI đọc dữ liệu từ cơ sở dữ liệu hoặc tài liệu ngoài xảy ra như thế nào?',
    options: [
      'Chỉ thị độc hại được cấy sẵn bên trong dữ liệu đọc về (như mô tả roadmap hoặc nội dung câu hỏi) khiến LLM hiểu nhầm dữ liệu đó là mệnh lệnh hệ thống',
      'Người dùng tắt JavaScript trên trình duyệt',
      'Máy chủ hết hạn mức GPU khi huấn luyện',
      'Mạng bị mất kết nối giữa chừng khi gọi API',
    ],
    correctIndex: 0,
    explanation:
      'Indirect Prompt Injection lợi dụng việc LLM không phân biệt rạch ròi giữa chỉ thị và dữ liệu. Cần tách biệt ranh giới dữ liệu (`untrusted`), giới hạn quyền công cụ (least privilege) và kiểm tra đầu ra ở tầng backend.',
    tags: ['llm', 'security', 'prompt-injection'],
    estimatedTimeSec: 45,
  },

  // ==========================================
  // 7. WEB_CLOUD (Công nghệ Web & Cloud) — 16 câu APPROVED
  // ==========================================
  {
    id: 'q-web-1',
    topic: ResourceTopic.WEB_CLOUD,
    level: QuestionLevel.CO_BAN,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.EASY,
    prompt:
      'Theo thiết kế bảo mật ứng dụng SPA hiện đại, cặp JWT Access Token và Refresh Token nên được lưu trữ như thế nào?',
    options: [
      'Lưu cả hai token trong localStorage để không bao giờ bị mất khi tải lại trang',
      'Access Token sống ngắn (15 phút) lưu trong bộ nhớ (in-memory) của FE; Refresh Token lưu trong cookie httpOnly + Secure + SameSite',
      'Truyền cả hai token trực tiếp trên thanh địa chỉ URL query string',
      'Lưu mật khẩu gốc trong sessionStorage để tự động đăng nhập lại',
    ],
    correctIndex: 1,
    explanation:
      'Lưu Access Token in-memory và Refresh Token trong httpOnly cookie giúp ngăn chặn mã độc JavaScript (XSS) đọc trộm Refresh Token thông qua document.cookie hoặc localStorage.',
    tags: ['web', 'security', 'jwt', 'auth'],
    estimatedTimeSec: 35,
  },
  {
    id: 'q-web-2',
    topic: ResourceTopic.WEB_CLOUD,
    level: QuestionLevel.CO_BAN,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.EASY,
    prompt:
      'Khi sinh viên gói FREE đã sử dụng hết hạn mức lượt tạo đề AI hoặc lượt chạy code trong ngày, REST API cần trả về mã trạng thái HTTP nào?',
    options: [
      '200 OK',
      '401 Unauthorized',
      '429 Too Many Requests (kèm mã lỗi QUOTA_EXCEEDED và header Retry-After)',
      '502 Bad Gateway',
    ],
    correctIndex: 2,
    explanation:
      'Mã HTTP 429 Too Many Requests là chuẩn RFC dùng khi người dùng vượt quá giới hạn rate limit hoặc hạn mức quota trong khoảng thời gian quy định, nên kèm header Retry-After.',
    tags: ['web', 'rest-api', 'http', 'quota'],
    estimatedTimeSec: 30,
  },
  {
    id: 'q-web-3',
    topic: ResourceTopic.WEB_CLOUD,
    level: QuestionLevel.CO_BAN,
    type: QuestionType.TRUE_FALSE,
    difficulty: QuestionDifficulty.EASY,
    prompt:
      'Việc ẩn nút "Tạo kỳ thi" trên giao diện React đối với tài khoản STUDENT là đủ để bảo mật, backend không cần kiểm tra lại role và gói dịch vụ.',
    options: ['Đúng', 'Sai'],
    correctIndex: 1,
    explanation:
      'Sai. Người dùng có thể gọi trực tiếp REST API qua curl/Postman. Backend luôn là chốt chặn kiểm tra quyền cuối cùng qua chuỗi middleware requireAuth → requireRole → requirePlan.',
    tags: ['web', 'security', 'rbac'],
    estimatedTimeSec: 25,
  },
  {
    id: 'q-web-4',
    topic: ResourceTopic.WEB_CLOUD,
    level: QuestionLevel.TRUNG_BINH,
    type: QuestionType.FILL_BLANK,
    difficulty: QuestionDifficulty.MEDIUM,
    prompt:
      'Điền thứ tự middleware Express 5 đúng chuẩn Feature Gating cho endpoint Tạo kỳ thi lập trình (chỉ dành cho LECTURER có gói PREMIUM):',
    code: "router.post(\n  '/exams',\n  requireAuth,\n  requireRole('LECTURER', 'ADMIN'),\n  ____('PREMIUM'),\n  createExamController\n);",
    options: ['requirePlan', 'optionalAuth', 'checkCors', 'allowGuest'],
    correctIndex: 0,
    explanation:
      'Quyền tạo kỳ thi lập trình đòi hỏi cả hai điều kiện độc lập: Role là LECTURER (requireRole) và gói dịch vụ đang hoạt động là PREMIUM (requirePlan).',
    tags: ['web', 'express', 'middleware', 'rbac'],
    estimatedTimeSec: 35,
  },
  {
    id: 'q-web-5',
    topic: ResourceTopic.WEB_CLOUD,
    level: QuestionLevel.TRUNG_BINH,
    type: QuestionType.DEBUG,
    difficulty: QuestionDifficulty.MEDIUM,
    prompt:
      'Đoạn mã truy vấn tìm kiếm tài liệu bằng Prisma dưới đây có lỗ hổng bảo mật nghiêm trọng nào?',
    code: 'const keyword = req.query.q;\nconst rows = await prisma.$queryRawUnsafe(\n  `SELECT * FROM resources WHERE title ILIKE \'%${keyword}%\'`\n);',
    options: [
      'SQL Injection — nối chuỗi trực tiếp input người dùng vào $queryRawUnsafe; phải dùng tagged template prisma.$queryRaw`...` có tham số hoá',
      'Lỗi tràn bộ nhớ đệm trong trình duyệt',
      'PostgreSQL không hỗ trợ toán tử ILIKE',
      'Không có lỗ hổng nào',
    ],
    correctIndex: 0,
    explanation:
      'Tuyệt đối không dùng $queryRawUnsafe với chuỗi nối từ input của người dùng. Phải sử dụng Prisma Client API hoặc tagged template prisma.$queryRaw`SELECT ... WHERE title ILIKE ${pattern}` để tham số hoá truy vấn.',
    tags: ['web', 'security', 'sql-injection', 'prisma'],
    estimatedTimeSec: 40,
  },
  {
    id: 'q-web-6',
    topic: ResourceTopic.WEB_CLOUD,
    level: QuestionLevel.TRUNG_BINH,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.MEDIUM,
    prompt:
      'Tại sao việc tải lên (upload) và tải xuống (download) tài liệu PDF/ZIP dung lượng lớn nên sử dụng cơ chế S3 Presigned URL thay vì truyền toàn bộ luồng byte đi qua máy chủ Express API?',
    options: [
      'Giảm tải băng thông, RAM và kết nối đồng thời cho máy chủ API; trình duyệt tải trực tiếp lên/xuống S3 với URL có chữ ký và thời hạn ngắn',
      'Vì S3 Presigned URL không cần kết nối mạng Internet',
      'Vì Express không thể đọc được định dạng JSON',
      'Để bỏ qua hoàn toàn việc kiểm tra định dạng MIME và dung lượng file',
    ],
    correctIndex: 0,
    explanation:
      'Backend API chỉ kiểm tra quyền hạn, loại file (MIME), kích thước rồi ký một Presigned URL có thời hạn ngắn. Client truyền tải file trực tiếp với S3/MinIO giúp API server nhẹ và dễ mở rộng.',
    tags: ['cloud', 's3', 'architecture', 'performance'],
    estimatedTimeSec: 40,
  },
  {
    id: 'q-web-7',
    topic: ResourceTopic.WEB_CLOUD,
    level: QuestionLevel.NANG_CAO,
    type: QuestionType.READ_CODE,
    difficulty: QuestionDifficulty.HARD,
    prompt:
      'Đoạn mã kiểm tra hạn mức (Quota) bằng Redis dưới đây giải quyết bài toán gì trong hệ thống?',
    code: 'const key = `quota:${feature}:${userId}:${todayStr}`;\nconst current = await redis.incr(key);\nif (current === 1) {\n  await redis.expire(key, secondsUntilMidnight);\n}\nif (current > limit) {\n  throw new QuotaExceededError(limit, current);\n}',
    options: [
      'Đếm nguyên tử (atomic counter) số lượt sử dụng tính năng theo ngày cho từng người dùng và tự động hết hạn (reset) vào nửa đêm',
      'Lưu trữ mật khẩu người dùng dưới dạng văn bản thuần trong Redis',
      'Xoá toàn bộ cơ sở dữ liệu PostgreSQL vào lúc nửa đêm',
      'Chặn tất cả tài khoản Premium sử dụng hệ thống',
    ],
    correctIndex: 0,
    explanation:
      'Lệnh INCR trong Redis là thao tác nguyên tử (atomic), kết hợp EXPIRE tới cuối ngày giúp kiểm soát chính xác quota ngày ngay cả khi người dùng gửi nhiều request song song.',
    tags: ['web', 'redis', 'quota', 'concurrency'],
    estimatedTimeSec: 45,
  },
  {
    id: 'q-web-8',
    topic: ResourceTopic.WEB_CLOUD,
    level: QuestionLevel.NANG_CAO,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.HARD,
    prompt:
      'Trong luồng mua khoá học trả phí, khi người dùng thanh toán xong và được cổng thanh toán redirect về trang Frontend với tham số ?status=success, hệ thống phải xử lý thế nào?',
    options: [
      'Chỉ hiển thị trạng thái đang chờ xác nhận; tuyệt đối không tự kích hoạt Enrollment từ URL redirect mà phải chờ Webhook có chữ ký hợp lệ từ cổng thanh toán gọi về Backend',
      'Lập tức cập nhật Order thành PAID và tạo Enrollment ngay từ tham số trên URL của trình duyệt',
      'Cho phép người dùng tự sửa localStorage để mở khoá toàn bộ video',
      'Tự động nâng cấp role của người dùng từ STUDENT lên ADMIN',
    ],
    correctIndex: 0,
    explanation:
      'URL redirect phía trình duyệt có thể bị người dùng giả mạo dễ dàng. Chỉ tin cậy Webhook từ cổng thanh toán sau khi đã xác thực chữ ký số và kiểm tra idempotency key ở Backend.',
    tags: ['web', 'payment', 'webhook', 'security'],
    estimatedTimeSec: 45,
  },
  {
    id: 'q-web-9',
    topic: ResourceTopic.WEB_CLOUD,
    level: QuestionLevel.CO_BAN,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.EASY,
    prompt:
      'Trong React, hook `useEffect` có mảng phụ thuộc rỗng `[]` sẽ chạy hàm effect vào thời điểm nào?',
    options: [
      'Sau mọi lần component re-render',
      'Chỉ một lần sau lần render đầu tiên (mount) và chạy hàm cleanup khi component unmount',
      'Trước khi JSX được biên dịch sang JavaScript',
      'Không bao giờ chạy',
    ],
    correctIndex: 1,
    explanation:
      'Mảng phụ thuộc rỗng `[]` báo cho React rằng effect không phụ thuộc vào props hay state nào, nên chỉ thực thi khi mount và dọn dẹp khi unmount (trong StrictMode dev sẽ chạy kiểm tra 2 lần).',
    tags: ['web', 'react', 'hooks'],
    estimatedTimeSec: 30,
  },
  {
    id: 'q-web-10',
    topic: ResourceTopic.WEB_CLOUD,
    level: QuestionLevel.CO_BAN,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.EASY,
    prompt:
      'Trong thiết kế REST API, phương thức HTTP nào sau đây có tính luỹ đẳng (idempotent) theo chuẩn RFC — nghĩa là gọi lặp lại nhiều lần cùng một request vẫn cho trạng thái tài nguyên giống như gọi 1 lần?',
    options: ['POST', 'PUT và DELETE', 'CONNECT', 'Chỉ POST'],
    correctIndex: 1,
    explanation:
      'GET, HEAD, PUT, DELETE mang tính idempotent theo đặc tả HTTP; còn POST mặc định KHÔNG idempotent (mỗi lần gọi có thể tạo thêm tài nguyên mới) nên cần bổ sung header `Idempotency-Key` khi muốn chống tạo trùng.',
    tags: ['web', 'rest-api', 'http', 'idempotency'],
    estimatedTimeSec: 35,
  },
  {
    id: 'q-web-11',
    topic: ResourceTopic.WEB_CLOUD,
    level: QuestionLevel.TRUNG_BINH,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.MEDIUM,
    prompt:
      'Lợi ích chính của kỹ thuật Multi-stage Build trong Dockerfile là gì?',
    options: [
      'Tách giai đoạn biên dịch (chứa SDK, devDependencies, compiler) khỏi image chạy production cuối cùng, giúp image nhỏ gọn hơn và giảm bề mặt tấn công bảo mật',
      'Cho phép một container chạy đồng thời cả Windows và Linux',
      'Tự động tăng dung lượng RAM vật lý cho máy chủ',
      'Loại bỏ hoàn toàn nhu cầu dùng biến môi trường',
    ],
    correctIndex: 0,
    explanation:
      'Multi-stage Dockerfile chỉ sao chép bản build (`dist/`) và production dependencies sang base image tối giản (như node:22-alpine), giảm kích thước image hàng trăm MB và bớt lỗ hổng CVE.',
    tags: ['cloud', 'docker', 'devops'],
    estimatedTimeSec: 40,
  },
  {
    id: 'q-web-12',
    topic: ResourceTopic.WEB_CLOUD,
    level: QuestionLevel.TRUNG_BINH,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.MEDIUM,
    prompt:
      'Cơ chế CORS (Cross-Origin Resource Sharing) được thực thi bởi thành phần nào?',
    options: [
      'Trình duyệt web (Browser) kiểm tra các header `Access-Control-Allow-*` do server trả về trước khi cho mã JavaScript đọc phản hồi từ origin khác',
      'Hệ quản trị cơ sở dữ liệu PostgreSQL',
      'Công cụ dòng lệnh curl',
      'Trình biên dịch TypeScript lúc build',
    ],
    correctIndex: 0,
    explanation:
      'CORS là chính sách bảo vệ phía trình duyệt mở rộng từ Same-Origin Policy; server khai báo origin được phép qua header và trình duyệt thực thi việc chặn/cho phép.',
    tags: ['web', 'cors', 'browser', 'security'],
    estimatedTimeSec: 35,
  },
  {
    id: 'q-web-13',
    topic: ResourceTopic.WEB_CLOUD,
    level: QuestionLevel.TRUNG_BINH,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.MEDIUM,
    prompt:
      'Trong hệ thống phân tán, mục đích của header `Idempotency-Key` trên yêu cầu `POST /exam-sets` là gì?',
    options: [
      'Giúp client an toàn thử lại (retry) khi mạng chập chờn mà không tạo ra hai bộ đề trùng lặp và không bị trừ quota hai lần',
      'Thay thế hoàn toàn JWT Access Token để đăng nhập',
      'Nén thân yêu cầu JSON bằng thuật toán Brotli',
      'Bỏ qua bước kiểm tra JSON Schema',
    ],
    correctIndex: 0,
    explanation:
      'Backend lưu kết quả gắn với cặp `(userId, Idempotency-Key)` cùng hash của payload: retry cùng key & body sẽ trả về đúng kết quả ban đầu mà không tạo mới hay trừ quota lại; khác body trả 409 Conflict.',
    tags: ['web', 'rest-api', 'idempotency', 'distributed-systems'],
    estimatedTimeSec: 40,
  },
  {
    id: 'q-web-14',
    topic: ResourceTopic.WEB_CLOUD,
    level: QuestionLevel.TRUNG_BINH,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.MEDIUM,
    prompt:
      'Trong React + Vite, vì sao việc dùng `React.lazy()` kết hợp `Suspense` cho từng trang hoặc feature theo feature flag giúp cải thiện tốc độ tải trang ban đầu?',
    options: [
      'Tách mã nguồn thành các chunk độc lập (code-splitting) chỉ tải về khi người dùng thực sự truy cập trang/tính năng đó',
      'Tự động chuyển mã React sang ngôn ngữ Rust',
      'Tắt hoàn toàn quá trình kiểm tra kiểu của TypeScript',
      'Lưu toàn bộ cơ sở dữ liệu vào trình duyệt',
    ],
    correctIndex: 0,
    explanation:
      'Code-splitting giảm kích thước JavaScript bundle ban đầu (Initial JS), rút ngắn thời gian parse/hydrate và giúp tính năng bị tắt bởi feature flag không bị tải thừa.',
    tags: ['web', 'react', 'vite', 'performance'],
    estimatedTimeSec: 35,
  },
  {
    id: 'q-web-15',
    topic: ResourceTopic.WEB_CLOUD,
    level: QuestionLevel.NANG_CAO,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.HARD,
    prompt:
      'Sự khác biệt giữa endpoint `/health` (Liveness Probe) và `/ready` (Readiness Probe) trong triển khai Cloud/Kubernetes là gì?',
    options: [
      '/health kiểm tra tiến trình còn sống hay bị treo (nếu fail thì restart container); /ready kiểm tra dịch vụ đã sẵn sàng nhận traffic (kết nối DB/Redis ổn định, nếu fail thì tạm rút khỏi Load Balancer)',
      '/health xoá cache Redis còn /ready khởi động lại PostgreSQL',
      'Hai endpoint phải luôn trả về mã 500 khi chạy ở môi trường production',
      '/ready chỉ dùng cho ứng dụng Frontend tĩnh',
    ],
    correctIndex: 0,
    explanation:
      'Tách Liveness và Readiness tránh hiệu ứng dây chuyền (cascading restart): nếu DB tạm gián đoạn, pod chỉ fail `/ready` để ngừng nhận request mới thay vì bị Kubernetes kill/restart liên tục.',
    tags: ['cloud', 'kubernetes', 'observability', 'devops'],
    estimatedTimeSec: 45,
  },
  {
    id: 'q-web-16',
    topic: ResourceTopic.WEB_CLOUD,
    level: QuestionLevel.NANG_CAO,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.HARD,
    prompt:
      'Trong kiến trúc ứng dụng Web có chia gói FREE/PREMIUM, vì sao không nên chỉ dựa vào trường `plan` nằm trong JWT Access Token (sống 15 phút) khi quyết định hạn mức quota hoặc quyền tính năng trả phí?',
    options: [
      'JWT là stateless nên sau khi user nâng cấp hoặc hạ/hết hạn gói, claim trong token cũ vẫn giữ giá trị cũ tới khi hết hạn 15 phút; cần đọc trạng thái Subscription từ DB (có thể cache ngắn và invalidate khi đổi gói)',
      'JWT không thể chứa chuỗi ký tự trong payload',
      'Trình duyệt tự động đổi giá trị `plan` trong JWT mỗi phút',
      'Express không đọc được trường `plan` từ `req.user`',
    ],
    correctIndex: 0,
    explanation:
      'Đọc `Subscription` thật từ DB (kết hợp cache TTL ngắn + event `subscription.changed` để invalidate) đảm bảo user nâng gói được hưởng hạn mức mới ngay và user hết hạn bị áp hạn mức mới kịp thời.',
    tags: ['web', 'jwt', 'architecture', 'subscription'],
    estimatedTimeSec: 45,
  },

  // ==========================================
  // Câu hỏi ở trạng thái DRAFT (2 câu — kiểm thử lọc trạng thái)
  // ==========================================
  {
    id: 'q-draft-ctdl-1',
    topic: ResourceTopic.CTDL,
    level: QuestionLevel.TRUNG_BINH,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.MEDIUM,
    prompt: '[DRAFT] Câu hỏi đang biên soạn về Segment Tree (chưa phê duyệt).',
    options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'],
    correctIndex: 1,
    explanation: 'Câu hỏi nháp phục vụ kiểm thử quy trình lọc chỉ lấy câu APPROVED.',
    tags: ['dsa', 'segment-tree', 'draft'],
    status: QuestionStatus.DRAFT,
    estimatedTimeSec: 45,
  },
  {
    id: 'q-draft-csdl-1',
    topic: ResourceTopic.CSDL,
    level: QuestionLevel.NANG_CAO,
    type: QuestionType.MCQ,
    difficulty: QuestionDifficulty.HARD,
    prompt: '[DRAFT] Câu hỏi đang biên soạn về MVCC và VACUUM trong PostgreSQL (chưa phê duyệt).',
    options: ['Option A', 'Option B', 'Option C', 'Option D'],
    correctIndex: 0,
    explanation: 'Câu hỏi nháp phục vụ kiểm thử quy trình lọc chỉ lấy câu APPROVED.',
    tags: ['postgresql', 'mvcc', 'draft'],
    status: QuestionStatus.DRAFT,
    estimatedTimeSec: 50,
  },
];

interface SeedAttemptSpec {
  id: string;
  userEmail: string;
  topic: ResourceTopic | null;
  daysAgo: number;
  answers: Array<{
    questionId: string;
    correct: boolean;
    timeSpentMs: number;
  }>;
}

const SEED_PRACTICE_ATTEMPTS: SeedAttemptSpec[] = [
  {
    id: 'pa-seed-huy-1',
    userEmail: 'huy.nd@edu.vn',
    topic: ResourceTopic.CSDL,
    daysAgo: 12,
    answers: [
      { questionId: 'q-csdl-1', correct: true, timeSpentMs: 28000 },
      { questionId: 'q-csdl-2', correct: true, timeSpentMs: 22000 },
      { questionId: 'q-csdl-3', correct: false, timeSpentMs: 65000 },
      { questionId: 'q-csdl-4', correct: false, timeSpentMs: 74000 },
      { questionId: 'q-csdl-5', correct: true, timeSpentMs: 41000 },
    ],
  },
  {
    id: 'pa-seed-huy-2',
    userEmail: 'huy.nd@edu.vn',
    topic: ResourceTopic.CTDL,
    daysAgo: 3,
    answers: [
      { questionId: 'q-ctdl-1', correct: true, timeSpentMs: 31000 },
      { questionId: 'q-ctdl-2', correct: true, timeSpentMs: 18000 },
      { questionId: 'q-ctdl-3', correct: true, timeSpentMs: 36000 },
      { questionId: 'q-ctdl-4', correct: true, timeSpentMs: 49000 },
      { questionId: 'q-ctdl-7', correct: false, timeSpentMs: 88000 },
    ],
  },
  {
    id: 'pa-seed-linh-1',
    userEmail: 'linh.tt@edu.vn',
    topic: ResourceTopic.HDH,
    daysAgo: 10,
    answers: [
      { questionId: 'q-hdh-1', correct: true, timeSpentMs: 29000 },
      { questionId: 'q-hdh-3', correct: false, timeSpentMs: 72000 },
      { questionId: 'q-hdh-4', correct: false, timeSpentMs: 64000 },
      { questionId: 'q-hdh-6', correct: false, timeSpentMs: 91000 },
      { questionId: 'q-hdh-7', correct: true, timeSpentMs: 46000 },
    ],
  },
  {
    id: 'pa-seed-linh-2',
    userEmail: 'linh.tt@edu.vn',
    topic: ResourceTopic.WEB_CLOUD,
    daysAgo: 2,
    answers: [
      { questionId: 'q-web-1', correct: true, timeSpentMs: 25000 },
      { questionId: 'q-web-2', correct: true, timeSpentMs: 21000 },
      { questionId: 'q-web-4', correct: true, timeSpentMs: 33000 },
      { questionId: 'q-web-5', correct: true, timeSpentMs: 38000 },
      { questionId: 'q-web-8', correct: true, timeSpentMs: 44000 },
    ],
  },
];

export async function seedPracticeBankAndHistory(
  prisma: PrismaClient,
  userMap: Map<string, string>,
  defaultAuthorId: string
): Promise<void> {
  const questionById = new Map<string, SeedQuestionItem>();

  for (const q of SEED_QUESTIONS) {
    questionById.set(q.id, q);
    await prisma.question.upsert({
      where: { id: q.id },
      update: {
        topic: q.topic,
        level: q.level,
        type: q.type,
        difficulty: q.difficulty,
        prompt: q.prompt,
        code: q.code ?? null,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        tags: q.tags,
        status: q.status ?? QuestionStatus.APPROVED,
        estimatedTimeSec: q.estimatedTimeSec ?? 45,
      },
      create: {
        id: q.id,
        topic: q.topic,
        level: q.level,
        type: q.type,
        difficulty: q.difficulty,
        prompt: q.prompt,
        code: q.code ?? null,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        tags: q.tags,
        status: q.status ?? QuestionStatus.APPROVED,
        estimatedTimeSec: q.estimatedTimeSec ?? 45,
        authorId: defaultAuthorId,
      },
    });
  }

  const approvedCount = SEED_QUESTIONS.filter(
    (q) => (q.status ?? QuestionStatus.APPROVED) === QuestionStatus.APPROVED
  ).length;
  console.log(
    `✓ Seeded ${SEED_QUESTIONS.length} questions (${approvedCount} APPROVED across 7 topics, ${SEED_QUESTIONS.length - approvedCount} DRAFT)`
  );

  for (const spec of SEED_PRACTICE_ATTEMPTS) {
    const userId = userMap.get(spec.userEmail);
    if (!userId) continue;

    const existing = await prisma.practiceAttempt.findUnique({ where: { id: spec.id } });
    if (existing) continue;

    const submittedAt = new Date(Date.now() - spec.daysAgo * 24 * 60 * 60 * 1000);
    const durationMs = spec.answers.reduce((acc, a) => acc + a.timeSpentMs, 0);
    const startedAt = new Date(submittedAt.getTime() - durationMs);
    const correctCount = spec.answers.filter((a) => a.correct).length;
    const score = Math.round((correctCount / spec.answers.length) * 100);

    await prisma.practiceAttempt.create({
      data: {
        id: spec.id,
        userId,
        topic: spec.topic,
        totalQuestions: spec.answers.length,
        correctCount,
        score,
        durationMs,
        startedAt,
        submittedAt,
        answers: {
          create: spec.answers.map((a) => {
            const q = questionById.get(a.questionId)!;
            const wrongIndex = (q.correctIndex + 1) % q.options.length;
            return {
              userId,
              questionId: q.id,
              topic: q.topic,
              difficulty: q.difficulty,
              selectedIndex: a.correct ? q.correctIndex : wrongIndex,
              isCorrect: a.correct,
              timeSpentMs: a.timeSpentMs,
              answeredAt: submittedAt,
            };
          }),
        },
      },
    });
  }

  console.log(`✓ Seeded ${SEED_PRACTICE_ATTEMPTS.length} sample practice attempts & answers`);
}
