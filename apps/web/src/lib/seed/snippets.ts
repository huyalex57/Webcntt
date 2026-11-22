import type { CodeSnippet } from '@devstudy/shared';

export const SNIPPETS: CodeSnippet[] = [
  {
    id: 's1',
    title: 'binary_search_tree.cpp',
    language: 'cpp',
    code: `#include <bits/stdc++.h>
using namespace std;

struct Node {
  int val;
  Node *l, *r;
};

Node* insert(Node* root, int v) {
  if (!root) return new Node{v, nullptr, nullptr};
  if (v < root->val) root->l = insert(root->l, v);
  else root->r = insert(root->r, v);
  return root;
}

void inorder(Node* root) {
  if (!root) return;
  inorder(root->l);
  cout << root->val << " ";
  inorder(root->r);
}

int main() {
  Node* root = nullptr;
  for (int x : {40, 20, 60, 10, 30, 50, 70}) root = insert(root, x);
  cout << "BST Inorder: ";
  inorder(root);
  cout << "\\n";
  return 0;
}`,
    isPublic: true,
    createdAt: '2026-11-10',
    lastRunStatus: 'AC',
  },
  {
    id: 's2',
    title: 'dijkstra_shortest_path.py',
    language: 'python',
    code: `import heapq

def dijkstra(n: int, edges: list[tuple[int, int, int]], start: int) -> list[int]:
    adj = [[] for _ in range(n + 1)]
    for u, v, w in edges:
        adj[u].append((v, w))
    dist = [10**18] * (n + 1)
    dist[start] = 0
    pq = [(0, start)]
    while pq:
        d, u = heapq.heappop(pq)
        if d > dist[u]:
            continue
        for v, w in adj[u]:
            if dist[u] + w < dist[v]:
                dist[v] = dist[u] + w
                heapq.heappush(pq, (dist[v], v))
    return dist[1:]

if __name__ == "__main__":
    sample_edges = [(1, 2, 2), (1, 3, 4), (2, 3, 1), (2, 4, 7), (3, 5, 3), (4, 5, 1)]
    print("Shortest distances:", dijkstra(5, sample_edges, 1))`,
    isPublic: true,
    createdAt: '2026-11-14',
    lastRunStatus: 'AC',
  },
  {
    id: 's3',
    title: 'LruCacheDemo.java',
    language: 'java',
    code: `import java.util.*;

public class Main {
    static class LRUCache<K, V> extends LinkedHashMap<K, V> {
        private final int capacity;
        public LRUCache(int capacity) {
            super(capacity, 0.75f, true);
            this.capacity = capacity;
        }
        @Override
        protected boolean removeEldestEntry(Map.Entry<K, V> eldest) {
            return size() > capacity;
        }
    }

    public static void main(String[] args) {
        LRUCache<Integer, String> cache = new LRUCache<>(2);
        cache.put(1, "CTDL");
        cache.put(2, "CSDL");
        cache.get(1);
        cache.put(3, "HDH");
        System.out.println("Active keys: " + cache.keySet());
    }
}`,
    isPublic: false,
    createdAt: '2026-11-18',
    lastRunStatus: 'AC',
  },
];

export const QUICKSORT_CPP = `#include <bits/stdc++.h>
using namespace std;
// DevStudy Hub • Sandbox C++20
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
