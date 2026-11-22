import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TerminalOutput } from '../TerminalOutput';

describe('TerminalOutput Component', () => {
  it('renders loading spinner while execution is pending', () => {
    render(<TerminalOutput result={null} isPending={true} />);
    expect(screen.getByText(/Đang biên dịch/i)).toBeInTheDocument();
  });

  it('renders AC stdout, execution time, and memory usage', () => {
    render(
      <TerminalOutput
        isPending={false}
        result={{
          status: 'AC',
          stdout: 'Hello, DevStudy Hub!',
          stderr: '',
          exitCode: 0,
          timeMs: 42,
          memoryKb: 12288,
          memoryMb: 12,
        }}
      />
    );

    expect(screen.getByText(/AC · Thành công/i)).toBeInTheDocument();
    expect(screen.getByText('Hello, DevStudy Hub!')).toBeInTheDocument();
    expect(screen.getByText(/42 ms/i)).toBeInTheDocument();
    expect(screen.getByText(/12\.00 MB/i)).toBeInTheDocument();
  });

  it('renders Compile Error (CE) compiler output clearly', () => {
    render(
      <TerminalOutput
        isPending={false}
        result={{
          status: 'CE',
          stdout: '',
          stderr: '',
          compileOutput: "main.cpp:4:5: error: expected ';'",
          exitCode: 1,
          timeMs: 0,
          memoryKb: 0,
          memoryMb: 0,
        }}
      />
    );

    expect(screen.getByText(/CE · Lỗi biên dịch/i)).toBeInTheDocument();
    expect(screen.getByText(/COMPILER OUTPUT/i)).toBeInTheDocument();
    expect(screen.getByText(/expected ';'/i)).toBeInTheDocument();
  });

  it('renders TLE status badge and stderr', () => {
    render(
      <TerminalOutput
        isPending={false}
        result={{
          status: 'TLE',
          stdout: '',
          stderr: 'Time limit exceeded',
          exitCode: 124,
          timeMs: 2001,
          memoryKb: 14000,
          memoryMb: 13.67,
        }}
      />
    );

    expect(screen.getByText(/TLE · Quá thời gian/i)).toBeInTheDocument();
    expect(screen.getByText(/Time limit exceeded/i)).toBeInTheDocument();
  });
});
