import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import type { Achievement } from '../../types/analytics';
import { AchievementCard } from '../AchievementCard';

describe('AchievementCard', () => {
  it('should render unlocked achievement', () => {
    const achievement: Achievement = {
      id: 'prompt_10',
      name: 'Prompt Novice',
      description: 'Insert 10 prompts',
      tier: 'bronze',
      category: 'usage',
      icon: '📝',
      requirement: 10,
      unlockedAt: Date.now(),
      progress: 10
    };

    render(<AchievementCard achievement={achievement} />);

    expect(screen.getByText('Prompt Novice')).toBeInTheDocument();
    expect(screen.getByText('Insert 10 prompts')).toBeInTheDocument();
    expect(screen.getByText('📝')).toBeInTheDocument();
  });

  it('should render locked achievement with progress', () => {
    const achievement: Achievement = {
      id: 'prompt_50',
      name: 'Prompt Enthusiast',
      description: 'Insert 50 prompts',
      tier: 'silver',
      category: 'usage',
      icon: '⚡',
      requirement: 50,
      progress: 25
    };

    render(<AchievementCard achievement={achievement} locked />);

    expect(screen.getByText('Prompt Enthusiast')).toBeInTheDocument();
    expect(screen.getByText('25 / 50')).toBeInTheDocument();
  });

  it('should show grayscale styling for locked achievements', () => {
    const achievement: Achievement = {
      id: 'prompt_100',
      name: 'Prompt Master',
      description: 'Insert 100 prompts',
      tier: 'gold',
      category: 'usage',
      icon: '🏆',
      requirement: 100,
      progress: 50
    };

    const { container } = render(<AchievementCard achievement={achievement} locked />);
    const card = container.firstChild as HTMLElement;

    expect(card.className).toContain('grayscale');
    expect(card.className).toContain('opacity-50');
  });

  it('should show tier-colored border for unlocked achievements', () => {
    const achievement: Achievement = {
      id: 'prompt_500',
      name: 'Prompt Legend',
      description: 'Insert 500 prompts',
      tier: 'platinum',
      category: 'usage',
      icon: '👑',
      requirement: 500,
      unlockedAt: Date.now(),
      progress: 500
    };

    const { container } = render(<AchievementCard achievement={achievement} />);
    const card = container.firstChild as HTMLElement;

    expect(card.style.borderColor).toBeTruthy();
  });

  it('should display progress bar for locked achievements', () => {
    const achievement: Achievement = {
      id: 'streak_7',
      name: 'Week Warrior',
      description: 'Use prompts for 7 consecutive days',
      tier: 'silver',
      category: 'streak',
      icon: '💪',
      requirement: 7,
      progress: 3
    };

    render(<AchievementCard achievement={achievement} locked />);

    expect(screen.getByText('3 / 7')).toBeInTheDocument();
    expect(screen.getByText('43%')).toBeInTheDocument();
  });

  it('should display unlock date for unlocked achievements', () => {
    const unlockDate = new Date('2025-01-15');
    const achievement: Achievement = {
      id: 'first_prompt',
      name: 'Getting Started',
      description: 'Insert your first prompt',
      tier: 'bronze',
      category: 'usage',
      icon: '🎯',
      requirement: 1,
      unlockedAt: unlockDate.getTime(),
      progress: 1
    };

    render(<AchievementCard achievement={achievement} />);

    expect(screen.getByText(/Unlocked/)).toBeInTheDocument();
  });
});
