import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import SectionHeader from '../SectionHeader';

describe('SectionHeader', () => {
  it('shows the Eyebrow over the title, the one h1', () => {
    render(<SectionHeader title="Categories" eyebrow="3 categories" />);

    const heading = screen.getByRole('heading', { level: 1, name: 'Categories' });
    const eyebrow = screen.getByText('3 categories');
    expect(eyebrow.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(heading).toHaveClass('text-[27px]', 'font-extrabold', 'text-primary');
    expect(eyebrow).toHaveClass('text-[12.5px]', 'font-semibold', 'text-tertiary');
  });

  it('has no icon square', () => {
    render(<SectionHeader title="Analytics" eyebrow="Last 30 days of usage" />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('announces a live Eyebrow only when asked', () => {
    const { rerender } = render(<SectionHeader title="Categories" eyebrow="3 categories" />);
    expect(screen.getByText('3 categories')).not.toHaveAttribute('aria-live');

    rerender(<SectionHeader title="Categories" eyebrow="3 categories" eyebrowLive />);
    expect(screen.getByText('3 categories')).toHaveAttribute('aria-live', 'polite');
  });

  it('puts the actions after the title and the leading element before it', () => {
    render(
      <SectionHeader title="Analytics" eyebrow="Last 30 days" leading={<button type="button">Back</button>}>
        <button type="button">Close</button>
      </SectionHeader>
    );

    const buttons = screen.getAllByRole('button').map(button => button.textContent);
    expect(buttons).toEqual(['Back', 'Close']);
  });

  it('is seamless until the content scrolls under it', () => {
    render(<SectionHeader title="Settings" eyebrow="My Prompt Manager 1.0.0" />);

    expect(screen.getByRole('banner')).toHaveClass('bg-app', 'border-transparent', 'scroll-edge-top');
  });
});
