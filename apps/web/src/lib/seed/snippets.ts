import type { CodeSnippet } from '@devstudy/shared';

export const SNIPPETS: CodeSnippet[] = [
  { id: 's1', title: 'binary_search_tree.cpp', language: 'cpp', code: '#include <bits/stdc++.h>\nusing namespace std;\nstruct Node { int val; Node *l, *r; };\nNode* insert(Node* root, int v) {\n  if (!root) return new Node{v, nullptr, nullptr};\n  if (v < root->val) root->l = insert(root->l, v);\n  else root->r = insert(root->r, v);\n  return root;\n}\nint main() { cout << "BST OK\\n"; }', createdAt: '2026-10-08', lastRunStatus: 'AC' },
  { id: 's2', title: 'fast_api_auth.py', language: 'python', code: 'from fastapi import FastAPI\napp = FastAPI()\n\n@app.get("/health")\ndef health():\n    return {"status": "ok"}', createdAt: '2026-10-07', lastRunStatus: 'AC' },
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
