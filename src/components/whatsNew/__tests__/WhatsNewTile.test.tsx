import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { CriticalFixItem, FeatureItem } from '../../../whatsNew/types';
import { WhatsNewTile } from '../WhatsNewTile';

const hero: FeatureItem = {
  kind: 'feature',
  title: 'Fill in Variables',
  description: 'Type each value once, then insert.',
  icon: 'variables',
  destination: 'prompt-editor-new',
  example: 'Summarize {{topic}} for {{audience}}.'
};

const fix: CriticalFixItem = { kind: 'critical-fix', title: 'Prompts kept on sync', description: 'No Prompt is lost.' };

describe('WhatsNewTile', () => {
  it('hero: the example sentence with each {{word}} as a pill, then the title and the description', () => {
    render(<WhatsNewTile item={hero} hero position={0} tileNumber={1} onOpen={vi.fn()} />);

    const button = screen.getByRole('button', { name: 'Fill in Variables Type each value once, then insert.' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveAttribute('data-whats-new-tile', 'hero');
    expect(button).toHaveAttribute('data-whats-new-tile-index', '1');
    expect(button).toHaveTextContent('Summarize topic for audience.');
    const pills = [screen.getByText('topic'), screen.getByText('audience')];
    for (const pill of pills) {
      expect(pill).toHaveClass('rounded-full', 'bg-accent-selected', 'text-accent', 'font-bold');
    }
    expect(screen.queryByText(/\{\{/)).toBeNull();
    expect(button.querySelector('[data-icon-glyph]')).toBeNull();
  });

  it('hero without an example: the title and the description only', () => {
    render(<WhatsNewTile item={{ ...hero, example: undefined }} hero position={0} onOpen={vi.fn()} />);

    expect(screen.getByRole('button')).toHaveTextContent(/^Fill in VariablesType each value once, then insert\.$/);
  });

  it('a Feature: its icon square, its title, its description; pressing it opens its destination', async () => {
    const onOpen = vi.fn();
    const item: FeatureItem = { ...hero, example: undefined, destination: 'categories', icon: 'category' };
    render(<WhatsNewTile item={item} position={1} tileNumber={2} onOpen={onOpen} />);

    const button = screen.getByRole('button', { name: /Fill in Variables.*Type each value once/ });
    expect(button).toHaveAttribute('data-whats-new-tile', 'feature');
    expect(button.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(button).toHaveClass('active:scale-[.97]', 'hover:bg-accent-selected', 'transition-tile', 'focus-primary');

    await userEvent.click(button);
    expect(onOpen).toHaveBeenCalledWith('categories', item);
  });

  it('a Feature without destination: the same look, not a button, no focus', () => {
    const item: FeatureItem = { ...hero, example: undefined, destination: undefined };
    const { container } = render(<WhatsNewTile item={item} position={1} onOpen={vi.fn()} />);

    expect(screen.queryByRole('button')).toBeNull();
    const tile = container.querySelector('[data-whats-new-tile="feature"]');
    expect(tile).not.toHaveAttribute('tabindex');
    expect(tile).not.toHaveAttribute('data-whats-new-tile-index');
    expect(tile?.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(tile).not.toHaveClass('hover:bg-accent-selected');
  });

  it('a Critical fix: the Fixed pill in success colors in place of the icon, not a button', async () => {
    const onOpen = vi.fn();
    const { container } = render(<WhatsNewTile item={fix} position={2} onOpen={onOpen} />);

    expect(screen.queryByRole('button')).toBeNull();
    const pill = screen.getByText('Fixed');
    expect(pill).toHaveClass('bg-success-subtle', 'text-success', 'rounded-full');
    expect(container.querySelector('[data-icon-glyph]')).toBeNull();
    expect(container.querySelector('[data-whats-new-tile="critical-fix"]')).not.toHaveAttribute('tabindex');

    await userEvent.click(screen.getByText('Prompts kept on sync'));
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('a Critical fix shown as hero stays a Critical fix: only a Feature can be the hero', () => {
    const { container } = render(<WhatsNewTile item={fix} hero position={0} onOpen={vi.fn()} />);

    expect(container.querySelector('[data-whats-new-tile="critical-fix"]')).not.toBeNull();
    expect(screen.getByText('Fixed')).toBeInTheDocument();
  });

  it('every tile is a lilac, rounded, left-aligned card that rises', () => {
    const { container } = render(
      <>
        <WhatsNewTile item={hero} hero position={0} onOpen={vi.fn()} />
        <WhatsNewTile item={fix} position={1} onOpen={vi.fn()} />
      </>
    );

    for (const tile of container.querySelectorAll('[data-whats-new-tile]')) {
      expect(tile).toHaveClass('bg-subtle', 'rounded-tile', 'p-[13px]', 'text-left', 'animate-tile-rise');
    }
  });
});
