import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../test/test-utils';
import Help from './Help';

describe('Help Page', () => {
  it('should render the page heading', () => {
    render(<Help />);
    expect(screen.getByRole('heading', { level: 1, name: /how to play/i })).toBeInTheDocument();
  });

  it('should render all section titles', () => {
    render(<Help />);
    expect(screen.getByRole('button', { name: /game overview/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /getting started/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /game flow/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /action resolution phases/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /token mechanics/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /key terms/i })).toBeInTheDocument();
  });

  it('should have the first section expanded by default', () => {
    render(<Help />);
    const overviewButton = screen.getByRole('button', { name: /game overview/i });
    expect(overviewButton).toHaveAttribute('aria-expanded', 'true');
  });

  it('should have other sections collapsed by default', () => {
    render(<Help />);
    const tokenButton = screen.getByRole('button', { name: /token mechanics/i });
    expect(tokenButton).toHaveAttribute('aria-expanded', 'false');
  });

  it('should toggle section visibility when clicking header', async () => {
    const user = userEvent.setup();
    render(<Help />);

    const tokenButton = screen.getByRole('button', { name: /token mechanics/i });
    expect(tokenButton).toHaveAttribute('aria-expanded', 'false');

    await user.click(tokenButton);
    expect(tokenButton).toHaveAttribute('aria-expanded', 'true');

    await user.click(tokenButton);
    expect(tokenButton).toHaveAttribute('aria-expanded', 'false');
  });

  it('should display token results when Token Mechanics section is opened', async () => {
    const user = userEvent.setup();
    render(<Help />);

    await user.click(screen.getByRole('button', { name: /token mechanics/i }));
    expect(screen.getByText(/triumph/i)).toBeInTheDocument();
    expect(screen.getByText(/disaster/i)).toBeInTheDocument();
  });

  it('should display all action resolution phases when section is opened', async () => {
    const user = userEvent.setup();
    render(<Help />);

    await user.click(screen.getByRole('button', { name: /action resolution phases/i }));
    expect(screen.getByText('Proposal')).toBeInTheDocument();
    expect(screen.getByText('Argumentation')).toBeInTheDocument();
    expect(screen.getByText('Voting')).toBeInTheDocument();
    expect(screen.getByText('Resolution')).toBeInTheDocument();
    expect(screen.getByText('Narration')).toBeInTheDocument();
  });

  it('should display key terms when section is opened', async () => {
    const user = userEvent.setup();
    render(<Help />);

    await user.click(screen.getByRole('button', { name: /key terms/i }));
    expect(screen.getByText('Host')).toBeInTheDocument();
    expect(screen.getByText('Round')).toBeInTheDocument();
    expect(screen.getByText('Action')).toBeInTheDocument();
    expect(screen.getByText('Token')).toBeInTheDocument();
    expect(screen.getByText('Initiator')).toBeInTheDocument();
  });
});
