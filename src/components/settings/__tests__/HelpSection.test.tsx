import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import HelpSection from '../HelpSection';

describe('HelpSection', () => {
  it('is the Help group, open from the start', () => {
    render(<HelpSection />);

    expect(screen.getByRole('region', { name: 'Help' })).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it.each([
    ['GitHub Repository', 'https://github.com/spartDev/My-Prompt-Manager'],
    ['Report an Issue', 'https://github.com/spartDev/My-Prompt-Manager/issues'],
    ['Documentation', 'https://github.com/spartDev/My-Prompt-Manager/wiki']
  ])('links to %s in a new tab, safely', (name, href) => {
    render(<HelpSection />);

    const link = screen.getByRole('link', { name });
    expect(link).toHaveAttribute('href', href);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('states the license and the author', () => {
    render(<HelpSection />);

    expect(screen.getByText('MIT · Thomas Roux')).toBeInTheDocument();
  });
});
