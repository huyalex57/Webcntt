import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Button } from '../Button';

describe('Button Component', () => {
  it('renders button with children', () => {
    render(<Button>Nhấn vào đây</Button>);
    expect(screen.getByRole('button', { name: /nhấn vào đây/i })).toBeInTheDocument();
  });

  it('handles click events', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Bấm tôi</Button>);

    fireEvent.click(screen.getByRole('button', { name: /bấm tôi/i }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('respects disabled state', () => {
    const handleClick = vi.fn();
    render(
      <Button disabled onClick={handleClick}>
        Không bấm được
      </Button>
    );

    const btn = screen.getByRole('button', { name: /không bấm được/i });
    expect(btn).toBeDisabled();

    fireEvent.click(btn);
    expect(handleClick).not.toHaveBeenCalled();
  });
});
