import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/client';
import { QueryState } from './QueryState';

describe('QueryState', () => {
  it('shows the content when everything is fine', () => {
    render(
      <QueryState isLoading={false} error={null}>
        <p>All good</p>
      </QueryState>,
    );

    expect(screen.getByText('All good')).toBeInTheDocument();
  });

  it('shows a loading message while loading, and not the content', () => {
    render(
      <QueryState isLoading error={null}>
        <p>All good</p>
      </QueryState>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Loading');
    expect(screen.queryByText('All good')).not.toBeInTheDocument();
  });

  it('shows the error message in plain words, and not the content', () => {
    render(
      <QueryState
        isLoading={false}
        error={
          new ApiError(
            500,
            'INTERNAL_ERROR',
            'Something went wrong. Please try again.',
            [],
            'req-1',
          )
        }
      >
        <p>All good</p>
      </QueryState>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
    expect(screen.getByRole('alert')).toHaveTextContent('req-1');
    expect(screen.queryByText('All good')).not.toBeInTheDocument();
  });

  it('shows a Try again button that calls onRetry', async () => {
    const onRetry = vi.fn();
    render(
      <QueryState
        isLoading={false}
        error={new ApiError(500, 'INTERNAL_ERROR', 'Oops', [])}
        onRetry={onRetry}
      >
        <p>All good</p>
      </QueryState>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('has no Try again button when there is nothing to retry', () => {
    render(
      <QueryState isLoading={false} error={new ApiError(404, 'NOT_FOUND', 'Not here', [])}>
        <p>All good</p>
      </QueryState>,
    );

    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });

  it('shows a message for an error that is not an ApiError', () => {
    render(
      <QueryState isLoading={false} error={new Error('boom')}>
        <p>All good</p>
      </QueryState>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong.');
    expect(screen.getByRole('alert')).not.toHaveTextContent('boom');
  });

  it('shows the empty message when there is nothing to show', () => {
    render(
      <QueryState isLoading={false} error={null} emptyMessage="No employees match your filters.">
        <p>All good</p>
      </QueryState>,
    );

    expect(screen.getByText('No employees match your filters.')).toBeInTheDocument();
    expect(screen.queryByText('All good')).not.toBeInTheDocument();
  });

  describe('a slow start', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('explains that the free server may be waking up, but only after 5 seconds', () => {
      render(
        <QueryState isLoading error={null}>
          <p>All good</p>
        </QueryState>,
      );
      expect(screen.queryByText(/waking up/i)).not.toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(screen.getByText(/waking up/i)).toBeInTheDocument();
    });
  });
});
