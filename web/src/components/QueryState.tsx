import { useEffect, useState, type ReactNode } from 'react';
import { ApiError } from '@/api/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

/** After this long, we explain that the free server may be waking up. */
const SLOW_START_MS = 5000;

interface QueryStateProps {
  isLoading: boolean;
  error: unknown;
  /** Show this instead of the content when there is nothing to show. */
  emptyMessage?: string | undefined;
  /** If given, an error shows a "Try again" button. */
  onRetry?: () => void;
  children: ReactNode;
}

/**
 * Decides what a section of the page shows: a loading message, an error, an
 * empty message, or the content. Every page that loads data uses it, so they all behave the same.
 */
export function QueryState({ isLoading, error, emptyMessage, onRetry, children }: QueryStateProps) {
  if (isLoading) return <Loading />;
  if (error) return <ErrorMessage error={error} onRetry={onRetry} />;
  if (emptyMessage) return <p className="py-8 text-center text-muted-foreground">{emptyMessage}</p>;
  return <>{children}</>;
}

function Loading() {
  const isSlow = useIsSlow();

  return (
    <div role="status" className="space-y-3 py-4">
      <span className="sr-only">Loading</span>
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-2/3" />
      {isSlow && (
        <p className="text-sm text-muted-foreground">
          The free server is waking up. This can take up to a minute.
        </p>
      )}
    </div>
  );
}

/** True once the page has been loading for a while. */
function useIsSlow(): boolean {
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsSlow(true), SLOW_START_MS);
    return () => clearTimeout(timer);
  }, []);

  return isSlow;
}

function ErrorMessage({ error, onRetry }: { error: unknown; onRetry?: (() => void) | undefined }) {
  const message = error instanceof ApiError ? error.message : 'Something went wrong.';
  const requestId = error instanceof ApiError ? error.requestId : undefined;

  return (
    <Alert variant="destructive" role="alert">
      <AlertDescription className="space-y-2">
        <p>{message}</p>
        {requestId && <p className="text-xs">Reference: {requestId}</p>}
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
