/**
 * SummaryCard Component Tests
 *
 * Tests that SummaryCard properly renders metrics, handles loading states,
 * and applies appropriate styling.
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import SummaryCard from '../SummaryCard';

const TestIcon = () => (
  <svg data-testid="test-icon" viewBox="0 0 24 24">
    <path d="M12 4v16m8-8H4" />
  </svg>
);

describe('SummaryCard', () => {
  describe('Rendering', () => {
    it('should render label and value', () => {
      render(
        <SummaryCard
          label="Total Uses"
          value={42}
          icon={<TestIcon />}
        />
      );

      expect(screen.getByText('Total Uses')).toBeInTheDocument();
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('should render string value', () => {
      render(
        <SummaryCard
          label="Platform"
          value="Claude"
          icon={<TestIcon />}
        />
      );

      expect(screen.getByText('Claude')).toBeInTheDocument();
    });

    it('should render subtitle when provided', () => {
      render(
        <SummaryCard
          label="Total Uses"
          value={42}
          subtitle="prompts inserted"
          icon={<TestIcon />}
        />
      );

      expect(screen.getByText('prompts inserted')).toBeInTheDocument();
    });

    it('should render icon', () => {
      render(
        <SummaryCard
          label="Test"
          value={0}
          icon={<TestIcon />}
        />
      );

      expect(screen.getByTestId('test-icon')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should render loading skeleton when loading', () => {
      const { container } = render(
        <SummaryCard
          label="Total Uses"
          value={42}
          icon={<TestIcon />}
          loading={true}
        />
      );

      // Should have animate-pulse class for skeleton
      const skeleton = container.querySelector('.animate-pulse');
      expect(skeleton).toBeInTheDocument();

      // Should not render actual content
      expect(screen.queryByText('Total Uses')).not.toBeInTheDocument();
      expect(screen.queryByText('42')).not.toBeInTheDocument();
    });

    it('should render content when not loading', () => {
      render(
        <SummaryCard
          label="Total Uses"
          value={42}
          icon={<TestIcon />}
          loading={false}
        />
      );

      expect(screen.getByText('Total Uses')).toBeInTheDocument();
      expect(screen.getByText('42')).toBeInTheDocument();
    });
  });

  describe('Trend Indicator', () => {
    it('should render up arrow for positive trend', () => {
      render(
        <SummaryCard
          label="Growth"
          value={10}
          icon={<TestIcon />}
          trend="up"
        />
      );

      expect(screen.getByText('↑')).toBeInTheDocument();
    });

    it('should render down arrow for negative trend', () => {
      render(
        <SummaryCard
          label="Decline"
          value={-5}
          icon={<TestIcon />}
          trend="down"
        />
      );

      expect(screen.getByText('↓')).toBeInTheDocument();
    });

    it('should not render trend arrow when neutral', () => {
      render(
        <SummaryCard
          label="Stable"
          value={0}
          icon={<TestIcon />}
          trend="neutral"
        />
      );

      expect(screen.queryByText('↑')).not.toBeInTheDocument();
      expect(screen.queryByText('↓')).not.toBeInTheDocument();
    });

    it('should not render trend arrow when no trend specified', () => {
      render(
        <SummaryCard
          label="Total"
          value={100}
          icon={<TestIcon />}
        />
      );

      expect(screen.queryByText('↑')).not.toBeInTheDocument();
      expect(screen.queryByText('↓')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible aria-label with label and value', () => {
      render(
        <SummaryCard
          label="Total Uses"
          value={42}
          icon={<TestIcon />}
        />
      );

      const card = screen.getByRole('article');
      expect(card).toHaveAttribute('aria-label', 'Total Uses: 42');
    });

    it('should include subtitle in aria-label when provided', () => {
      render(
        <SummaryCard
          label="Total Uses"
          value={42}
          subtitle="prompts inserted"
          icon={<TestIcon />}
        />
      );

      const card = screen.getByRole('article');
      expect(card).toHaveAttribute('aria-label', 'Total Uses: 42, prompts inserted');
    });

    it('should have icon marked as aria-hidden', () => {
      render(
        <SummaryCard
          label="Test"
          value={0}
          icon={<TestIcon />}
        />
      );

      const iconContainer = screen.getByTestId('test-icon').closest('div[aria-hidden="true"]');
      expect(iconContainer).toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('should have glassmorphism styling', () => {
      const { container } = render(
        <SummaryCard
          label="Test"
          value={0}
          icon={<TestIcon />}
        />
      );

      const card = container.querySelector('article');
      expect(card).toHaveClass('bg-white/70');
      expect(card).toHaveClass('backdrop-blur-sm');
      expect(card).toHaveClass('rounded-xl');
    });

    it('should have hover state classes', () => {
      const { container } = render(
        <SummaryCard
          label="Test"
          value={0}
          icon={<TestIcon />}
        />
      );

      const card = container.querySelector('article');
      expect(card).toHaveClass('hover:bg-white/90');
      expect(card).toHaveClass('transition-all');
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero value', () => {
      render(
        <SummaryCard
          label="Count"
          value={0}
          icon={<TestIcon />}
        />
      );

      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('should handle large numbers', () => {
      render(
        <SummaryCard
          label="Total"
          value={1234567}
          icon={<TestIcon />}
        />
      );

      expect(screen.getByText('1234567')).toBeInTheDocument();
    });

    it('should handle long labels', () => {
      render(
        <SummaryCard
          label="Very Long Label That Should Still Work"
          value={42}
          icon={<TestIcon />}
        />
      );

      expect(screen.getByText('Very Long Label That Should Still Work')).toBeInTheDocument();
    });

    it('should truncate long subtitle with title attribute', () => {
      const longSubtitle = 'This is a very long subtitle that might need truncation';
      render(
        <SummaryCard
          label="Test"
          value={42}
          subtitle={longSubtitle}
          icon={<TestIcon />}
        />
      );

      const subtitle = screen.getByText(longSubtitle);
      expect(subtitle).toHaveAttribute('title', longSubtitle);
      expect(subtitle).toHaveClass('truncate');
    });
  });
});
