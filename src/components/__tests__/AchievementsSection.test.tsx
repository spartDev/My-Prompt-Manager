import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import type { Achievement } from '../../types/analytics';
import { AchievementsSection } from '../AchievementsSection';

describe('AchievementsSection', () => {
  it('should render section with achievement count', () => {
    const unlockedAchievements: Achievement[] = [
      {
        id: 'first_prompt',
        name: 'Getting Started',
        description: 'Insert your first prompt',
        tier: 'bronze',
        category: 'usage',
        icon: '🎯',
        requirement: 1,
        unlockedAt: Date.now(),
        progress: 1
      },
      {
        id: 'prompt_10',
        name: 'Prompt Novice',
        description: 'Insert 10 prompts',
        tier: 'bronze',
        category: 'usage',
        icon: '📝',
        requirement: 10,
        unlockedAt: Date.now(),
        progress: 10
      }
    ];

    render(
      <AchievementsSection
        unlockedAchievements={unlockedAchievements}
        totalInsertions={10}
        currentStreak={0}
      />
    );

    expect(screen.getByText(/Achievements/)).toBeInTheDocument();
    expect(screen.getByText(/2 \/ 10/)).toBeInTheDocument();
  });

  it('should render all achievement definitions', () => {
    render(
      <AchievementsSection
        unlockedAchievements={[]}
        totalInsertions={0}
        currentStreak={0}
      />
    );

    expect(screen.getByText('Getting Started')).toBeInTheDocument();
    expect(screen.getByText('Prompt Novice')).toBeInTheDocument();
    expect(screen.getByText('Prompt Enthusiast')).toBeInTheDocument();
    expect(screen.getByText('Prompt Master')).toBeInTheDocument();
    expect(screen.getByText('Prompt Legend')).toBeInTheDocument();
    expect(screen.getByText('3-Day Streak')).toBeInTheDocument();
    expect(screen.getByText('Week Warrior')).toBeInTheDocument();
    expect(screen.getByText('Monthly Master')).toBeInTheDocument();
    expect(screen.getByText('Platform Explorer')).toBeInTheDocument();
    expect(screen.getByText('Organized Mind')).toBeInTheDocument();
  });

  it('should show correct progress for locked achievements', () => {
    render(
      <AchievementsSection
        unlockedAchievements={[]}
        totalInsertions={25}
        currentStreak={5}
      />
    );

    expect(screen.getByText('25 / 50')).toBeInTheDocument();
    expect(screen.getByText('5 / 7')).toBeInTheDocument();
  });

  it('should display unlocked achievements without grayscale', () => {
    const unlockedAchievements: Achievement[] = [
      {
        id: 'first_prompt',
        name: 'Getting Started',
        description: 'Insert your first prompt',
        tier: 'bronze',
        category: 'usage',
        icon: '🎯',
        requirement: 1,
        unlockedAt: Date.now(),
        progress: 1
      }
    ];

    const { container } = render(
      <AchievementsSection
        unlockedAchievements={unlockedAchievements}
        totalInsertions={1}
        currentStreak={0}
      />
    );

    const cards = container.querySelectorAll('[class*="grayscale"]');
    expect(cards.length).toBe(9);
  });

  it('should calculate usage achievement progress correctly', () => {
    render(
      <AchievementsSection
        unlockedAchievements={[]}
        totalInsertions={75}
        currentStreak={0}
      />
    );

    expect(screen.getByText('50 / 50')).toBeInTheDocument();
    expect(screen.getByText('75 / 100')).toBeInTheDocument();
  });

  it('should calculate streak achievement progress correctly', () => {
    render(
      <AchievementsSection
        unlockedAchievements={[]}
        totalInsertions={0}
        currentStreak={10}
      />
    );

    expect(screen.getByText('7 / 7')).toBeInTheDocument();
    expect(screen.getByText('10 / 30')).toBeInTheDocument();
  });
});
