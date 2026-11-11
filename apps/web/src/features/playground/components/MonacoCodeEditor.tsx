import { useCallback, useRef } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type { CodeLanguage } from '@devstudy/shared';

export interface MonacoCodeEditorProps {
  language: CodeLanguage;
  value: string;
  onChange: (value: string) => void;
  onRun?: () => void;
  theme?: 'vs-dark' | 'light';
  fontSize?: number;
  tabSize?: number;
  height?: string;
  readOnly?: boolean;
}

const MONACO_LANG_MAP: Record<CodeLanguage, string> = {
  cpp: 'cpp',
  c: 'c',
  python: 'python',
  java: 'java',
  go: 'go',
};

export function MonacoCodeEditor({
  language,
  value,
  onChange,
  onRun,
  theme = 'vs-dark',
  fontSize = 14,
  tabSize = 4,
  height = '420px',
  readOnly = false,
}: MonacoCodeEditorProps) {
  const monacoLang = MONACO_LANG_MAP[language] || 'plaintext';
  const editorRef = useRef<unknown>(null);

  const handleEditorMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;

      // Add Ctrl+Enter / Cmd+Enter shortcut to execute code
      if (onRun) {
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
          onRun();
        });
      }
    },
    [onRun]
  );

  return (
    <div className="relative overflow-hidden rounded-md border border-border shadow-inner">
      <Editor
        height={height}
        language={monacoLang}
        value={value}
        theme={theme}
        onChange={(val) => onChange(val ?? '')}
        onMount={handleEditorMount}
        loading={
          <div className="flex h-full items-center justify-center bg-slate-900 text-sm text-slate-400">
            Đang khởi tạo Monaco Editor…
          </div>
        }
        options={{
          fontSize,
          tabSize,
          readOnly,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          cursorBlinking: 'smooth',
          bracketPairColorization: { enabled: true },
          formatOnPaste: true,
          fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, Consolas, monospace",
          renderLineHighlight: 'all',
          padding: { top: 12, bottom: 12 },
        }}
      />
    </div>
  );
}
