import type { Exam } from '@devstudy/shared';

export const EXAMS: Exam[] = [
  {
    id: 'e1',
    title: 'Đề thi cuối kỳ: Cấu trúc dữ liệu & Giải thuật (IT202 — Học kỳ I 2026)',
    description:
      'Kỳ thi lập trình chính quy 90 phút gồm 3 bài toán: Cây nhị phân, Đường đi ngắn nhất Dijkstra và Quy hoạch động. Chấm tự động bằng Judge0 với bộ test mẫu (hiển thị) và test ẩn chống học tủ.',
    creator: 'ThS. Tạ Quang Bảo (LECTURER · Premium)',
    startsAt: '2026-11-24T07:00:00+07:00',
    endsAt: '2026-11-24T08:30:00+07:00',
    durationMin: 90,
    languages: ['cpp', 'python', 'java'],
    status: 'PUBLISHED',
    participants: 312,
    problems: [
      {
        id: 'e1-p1',
        title: 'Đảo ngược cây nhị phân (Invert Binary Tree)',
        statement:
          'Cho gốc của một cây nhị phân, hãy đảo ngược cây (hoán đổi cây con trái và cây con phải của mọi nút trong cây) và in ra dãy duyệt theo mức (level-order) của cây mới.\n\n- Input: Dãy giá trị các nút theo thứ tự level-order.\n- Output: Dãy level-order sau khi đã đảo ngược từng tầng.',
        points: 30,
        timeLimitMs: 1000,
        memoryLimitMb: 256,
        testCases: [
          {
            id: 'e1-p1-t1',
            input: '[4,2,7,1,3,6,9]',
            expectedOutput: '[4,7,2,9,6,3,1]',
            hidden: false,
            points: 10,
          },
          {
            id: 'e1-p1-t2',
            input: '[2,1,3]',
            expectedOutput: '[2,3,1]',
            hidden: false,
            points: 10,
          },
          {
            id: 'e1-p1-t3',
            input: '[10,5,15,2,7,12,20]',
            expectedOutput: '[10,15,5,20,12,7,2]',
            hidden: true,
            points: 10,
          },
        ],
      },
      {
        id: 'e1-p2',
        title: 'Đường đi ngắn nhất trên mạng máy chủ — Thuật toán Dijkstra',
        statement:
          'Cho đồ thị có hướng trọng số không âm gồm n đỉnh (1..n), m cạnh có hướng và đỉnh nguồn s.\nHãy tìm khoảng cách ngắn nhất từ đỉnh s đến tất cả các đỉnh từ 1 đến n. Nếu không tồn tại đường đi tới đỉnh i, in ra INF.\n\n- Ràng buộc: 1 ≤ n ≤ 100,000; 1 ≤ m ≤ 200,000; 0 ≤ w ≤ 10^9.',
        points: 40,
        timeLimitMs: 2000,
        memoryLimitMb: 256,
        testCases: [
          {
            id: 'e1-p2-t1',
            input: '5 6 1\n1 2 2\n1 3 4\n2 3 1\n2 4 7\n3 5 3\n4 5 1',
            expectedOutput: '0 2 3 9 6',
            hidden: false,
            points: 15,
          },
          {
            id: 'e1-p2-t2',
            input: '3 1 1\n1 2 5',
            expectedOutput: '0 5 INF',
            hidden: true,
            points: 10,
          },
          {
            id: 'e1-p2-t3',
            input: '4 4 1\n1 2 10\n1 3 3\n3 2 2\n2 4 1',
            expectedOutput: '0 5 3 6',
            hidden: true,
            points: 15,
          },
        ],
      },
      {
        id: 'e1-p3',
        title: 'Dãy con tăng dài nhất (Longest Increasing Subsequence)',
        statement:
          'Cho mảng số nguyên A gồm n phần tử. Tìm độ dài của dãy con tăng nghiêm ngặt dài nhất (không nhất thiết liên tiếp).\n\n- Ràng buộc: 1 ≤ n ≤ 100,000; |A[i]| ≤ 10^9.\n- Gợi ý: Sử dụng Quy hoạch động kết hợp Tìm kiếm nhị phân (std::lower_bound) để đạt độ phức tạp O(n log n).',
        points: 30,
        timeLimitMs: 1500,
        memoryLimitMb: 256,
        testCases: [
          {
            id: 'e1-p3-t1',
            input: '8\n10 9 2 5 3 7 101 18',
            expectedOutput: '4',
            hidden: false,
            points: 10,
          },
          {
            id: 'e1-p3-t2',
            input: '6\n0 1 0 3 2 3',
            expectedOutput: '4',
            hidden: true,
            points: 10,
          },
          {
            id: 'e1-p3-t3',
            input: '5\n7 7 7 7 7',
            expectedOutput: '1',
            hidden: true,
            points: 10,
          },
        ],
      },
    ],
  },
  {
    id: 'e2',
    title: 'Kỳ thi giữa kỳ CTDL — Khoá K22 (Phòng thi mở rộng)',
    description:
      'Thi lập trình 60 phút: Sắp xếp ổn định (Stable Sort), Tìm kiếm nhị phân và Kiểm tra ngoặc hợp lệ bằng Stack. Server tính deadline tự động và ghi nhận sự kiện chuyển tab.',
    creator: 'ThS. Tạ Quang Bảo (LECTURER · Premium)',
    startsAt: '2026-11-22T08:00:00+07:00',
    endsAt: '2026-11-22T22:00:00+07:00',
    durationMin: 60,
    languages: ['cpp', 'c', 'python'],
    status: 'PUBLISHED',
    participants: 188,
    problems: [
      {
        id: 'e2-p1',
        title: 'Phân hoạch Chẵn – Lẻ ổn định (Stable Even-Odd Partition)',
        statement:
          'Cho mảng gồm n số nguyên. Hãy sắp xếp lại mảng sao cho tất cả các số chẵn đứng trước tất cả các số lẻ, đồng thời giữ nguyên thứ tự xuất hiện tương đối ban đầu trong nhóm số chẵn và trong nhóm số lẻ.',
        points: 50,
        timeLimitMs: 1000,
        memoryLimitMb: 128,
        testCases: [
          {
            id: 'e2-p1-t1',
            input: '5\n3 2 4 1 6',
            expectedOutput: '2 4 6 3 1',
            hidden: false,
            points: 20,
          },
          {
            id: 'e2-p1-t2',
            input: '4\n1 3 5 7',
            expectedOutput: '1 3 5 7',
            hidden: true,
            points: 15,
          },
          {
            id: 'e2-p1-t3',
            input: '6\n8 -3 0 5 -2 9',
            expectedOutput: '8 0 -2 -3 5 9',
            hidden: true,
            points: 15,
          },
        ],
      },
      {
        id: 'e2-p2',
        title: 'Kiểm tra biểu thức dấu ngoặc hợp lệ (Valid Parentheses)',
        statement:
          'Cho chuỗi s chỉ chứa các ký tự ngoặc \'(\', \')\', \'{\', \'}\', \'[\', \']\'. Kiểm tra xem chuỗi ngoặc có đóng mở đúng thứ tự và đúng cặp hay không. In ra YES nếu hợp lệ, ngược lại in ra NO.',
        points: 50,
        timeLimitMs: 1000,
        memoryLimitMb: 128,
        testCases: [
          {
            id: 'e2-p2-t1',
            input: '{[()()]}',
            expectedOutput: 'YES',
            hidden: false,
            points: 20,
          },
          {
            id: 'e2-p2-t2',
            input: '([)]',
            expectedOutput: 'NO',
            hidden: false,
            points: 15,
          },
          {
            id: 'e2-p2-t3',
            input: '((({{{[[[]]]}}})))',
            expectedOutput: 'YES',
            hidden: true,
            points: 15,
          },
        ],
      },
    ],
  },
  {
    id: 'e3',
    title: 'Bài kiểm tra thực hành Lập trình Hệ thống & Đa luồng (Linux / C / Go)',
    description:
      'Đánh giá kỹ năng xử lý chuỗi hệ thống, lập trình đồng thời và tối ưu tài nguyên CPU/RAM trong giới hạn sandbox nghiêm ngặt.',
    creator: 'ThS. Tạ Quang Bảo (LECTURER · Premium)',
    startsAt: '2026-11-25T13:30:00+07:00',
    endsAt: '2026-11-25T15:00:00+07:00',
    durationMin: 90,
    languages: ['c', 'cpp', 'go'],
    status: 'PUBLISHED',
    participants: 145,
    problems: [
      {
        id: 'e3-p1',
        title: 'Mô phỏng lập lịch tiến trình Round Robin (CPU Scheduling)',
        statement:
          'Cho n tiến trình với thời gian thực thi (burst time) B[1..n] (cùng đến tại thời điểm 0) và lượng tử thời gian (time quantum) Q.\nHãy tính thời gian hoàn thành (turnaround time) của từng tiến trình theo thuật toán Round Robin.',
        points: 60,
        timeLimitMs: 1000,
        memoryLimitMb: 128,
        testCases: [
          {
            id: 'e3-p1-t1',
            input: '3 4\n10 5 8',
            expectedOutput: '23 13 21',
            hidden: false,
            points: 30,
          },
          {
            id: 'e3-p1-t2',
            input: '4 2\n4 3 2 1',
            expectedOutput: '9 10 6 7',
            hidden: true,
            points: 30,
          },
        ],
      },
      {
        id: 'e3-p2',
        title: 'Đếm tần suất từ khoá Log Hệ thống (Log Aggregation)',
        statement:
          'Cho n dòng log hệ thống có định dạng "[LEVEL] message" (trong đó LEVEL là INFO, WARN hoặc ERROR). Hãy đếm và in ra số lượng dòng log của từng mức theo thứ tự: INFO WARN ERROR.',
        points: 40,
        timeLimitMs: 1000,
        memoryLimitMb: 128,
        testCases: [
          {
            id: 'e3-p2-t1',
            input: '5\n[INFO] Server started\n[WARN] High memory\n[INFO] Request OK\n[ERROR] DB timeout\n[INFO] Shutdown',
            expectedOutput: '3 1 1',
            hidden: false,
            points: 20,
          },
          {
            id: 'e3-p2-t2',
            input: '2\n[ERROR] Disk full\n[ERROR] Panic',
            expectedOutput: '0 0 2',
            hidden: true,
            points: 20,
          },
        ],
      },
    ],
  },
  {
    id: 'e4',
    title: 'Kỳ thi sát hạch Lập trình hướng đối tượng & Thiết kế phần mềm (Java / C++)',
    description:
      'Kỳ thi đã kết thúc (CLOSED) — Giảng viên đã công bố bảng điểm và xuất báo cáo CSV. Sinh viên có thể xem lại đề bài và kết quả từng test case.',
    creator: 'ThS. Tạ Quang Bảo (LECTURER · Premium)',
    startsAt: '2026-11-10T09:00:00+07:00',
    endsAt: '2026-11-10T10:15:00+07:00',
    durationMin: 75,
    languages: ['java', 'cpp', 'python'],
    status: 'CLOSED',
    participants: 276,
    problems: [
      {
        id: 'e4-p1',
        title: 'Quản lý bảng điểm sinh viên & Xếp loại học lực',
        statement:
          'Cho danh sách n sinh viên gồm mã SV, điểm quá trình (trọng số 0.3) và điểm cuối kỳ (trọng số 0.7). Hãy sắp xếp danh sách theo điểm tổng kết giảm dần (nếu bằng nhau xếp theo mã SV từ điển tăng dần).',
        points: 50,
        timeLimitMs: 1500,
        memoryLimitMb: 256,
        testCases: [
          {
            id: 'e4-p1-t1',
            input: '3\nSV02 8.0 9.0\nSV01 8.0 9.0\nSV03 9.0 9.5',
            expectedOutput: 'SV03 9.35\nSV01 8.70\nSV02 8.70',
            hidden: false,
            points: 25,
          },
          {
            id: 'e4-p1-t2',
            input: '2\nSV10 5.0 5.0\nSV05 7.0 8.0',
            expectedOutput: 'SV05 7.70\nSV10 5.00',
            hidden: true,
            points: 25,
          },
        ],
      },
      {
        id: 'e4-p2',
        title: 'Mô phỏng bộ nhớ đệm LRU Cache',
        statement:
          'Thiết kế cấu trúc dữ liệu LRU Cache có sức chứa K. Hỗ trợ hai thao tác: PUT key value và GET key (trả về -1 nếu không tồn tại). Khi bộ đệm đầy, loại bỏ khoá ít được truy cập gần nhất.',
        points: 50,
        timeLimitMs: 1500,
        memoryLimitMb: 256,
        testCases: [
          {
            id: 'e4-p2-t1',
            input: '2 6\nPUT 1 10\nPUT 2 20\nGET 1\nPUT 3 30\nGET 2\nGET 3',
            expectedOutput: '10\n-1\n30',
            hidden: false,
            points: 25,
          },
          {
            id: 'e4-p2-t2',
            input: '1 3\nPUT 1 100\nPUT 2 200\nGET 1',
            expectedOutput: '-1',
            hidden: true,
            points: 25,
          },
        ],
      },
    ],
  },
  {
    id: 'e5',
    title: 'Mock Test Tuyển dụng Big Tech & ICPC Regional — Thuật toán Nâng cao',
    description:
      'Đề thi thử 120 phút (đang ở trạng thái DRAFT chờ Giảng viên xuất bản): 3 bài lập trình chuẩn phỏng vấn SWE & thi đấu thuật toán.',
    creator: 'ThS. Tạ Quang Bảo (LECTURER · Premium)',
    startsAt: '2026-12-05T09:00:00+07:00',
    endsAt: '2026-12-05T11:00:00+07:00',
    durationMin: 120,
    languages: ['cpp', 'python', 'java', 'go'],
    status: 'DRAFT',
    participants: 0,
    problems: [
      {
        id: 'e5-p1',
        title: 'Tổng hai số trên mảng đã sắp xếp (Two Sum II — Two Pointers)',
        statement:
          'Cho mảng số nguyên đã sắp xếp tăng dần A[0..n-1] và số nguyên target. Tìm hai chỉ số i < j sao cho A[i] + A[j] = target. In ra cặp chỉ số (i, j) đầu tiên tìm được, hoặc "-1 -1" nếu không tồn tại.',
        points: 30,
        timeLimitMs: 1000,
        memoryLimitMb: 256,
        testCases: [
          {
            id: 'e5-p1-t1',
            input: '5 9\n2 7 11 15 20',
            expectedOutput: '0 1',
            hidden: false,
            points: 15,
          },
          {
            id: 'e5-p1-t2',
            input: '4 10\n1 2 3 4',
            expectedOutput: '-1 -1',
            hidden: true,
            points: 15,
          },
        ],
      },
      {
        id: 'e5-p2',
        title: 'Truy vấn tổng đoạn & Cập nhật điểm (Segment Tree / Fenwick Tree)',
        statement:
          'Cho mảng n số nguyên và q truy vấn thuộc 2 loại:\n- "1 i v": Cộng thêm v vào phần tử thứ i (1-indexed).\n- "2 l r": Tính tổng các phần tử từ chỉ số l đến r.',
        points: 70,
        timeLimitMs: 2000,
        memoryLimitMb: 256,
        testCases: [
          {
            id: 'e5-p2-t1',
            input: '5 4\n1 2 3 4 5\n2 1 3\n1 2 10\n2 1 3\n2 2 5',
            expectedOutput: '6\n16\n24',
            hidden: false,
            points: 35,
          },
          {
            id: 'e5-p2-t2',
            input: '3 2\n10 20 30\n1 3 -10\n2 1 3',
            expectedOutput: '50',
            hidden: true,
            points: 35,
          },
        ],
      },
    ],
  },
];
