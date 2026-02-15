import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Skeleton, SkeletonText, SkeletonGameCard, SkeletonActionCard } from './Skeleton';

describe('Skeleton Components', () => {
  describe('Skeleton', () => {
    it('should render with default classes', () => {
      const { container } = render(<Skeleton />);
      const skeleton = container.firstChild as HTMLElement;

      expect(skeleton).toHaveClass('animate-pulse');
      expect(skeleton).toHaveClass('rounded-md');
      expect(skeleton).toHaveClass('bg-muted');
    });

    it('should accept custom className', () => {
      const { container } = render(<Skeleton className="h-10 w-full" />);
      const skeleton = container.firstChild as HTMLElement;

      expect(skeleton).toHaveClass('h-10');
      expect(skeleton).toHaveClass('w-full');
      expect(skeleton).toHaveClass('animate-pulse');
    });
  });

  describe('SkeletonText', () => {
    it('should render multiple lines by default', () => {
      const { container } = render(<SkeletonText />);
      const skeletons = container.querySelectorAll('.animate-pulse');

      expect(skeletons.length).toBe(3); // default is 3 lines
    });

    it('should render specified number of lines', () => {
      const { container } = render(<SkeletonText lines={5} />);
      const skeletons = container.querySelectorAll('.animate-pulse');

      expect(skeletons.length).toBe(5);
    });
  });

  describe('SkeletonGameCard', () => {
    it('should render card structure', () => {
      const { container } = render(<SkeletonGameCard />);

      // Should have multiple skeleton elements for title, description, etc.
      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should have border styling', () => {
      const { container } = render(<SkeletonGameCard />);
      const card = container.firstChild as HTMLElement;

      expect(card).toHaveClass('border');
      expect(card).toHaveClass('rounded-lg');
    });
  });

  describe('SkeletonActionCard', () => {
    it('should render action card structure', () => {
      const { container } = render(<SkeletonActionCard />);
      const skeletons = container.querySelectorAll('.animate-pulse');

      expect(skeletons.length).toBeGreaterThan(0);
    });
  });
});
