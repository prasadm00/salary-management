import type { ReactNode } from 'react';

/**
 * A table that scrolls sideways when the screen is too narrow for it.
 * The box can be reached with the Tab key, so keyboard users can scroll it with the arrow keys.
 */
export function ScrollableTable({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className="overflow-x-auto rounded-lg border focus-visible:ring-2 focus-visible:ring-ring"
    >
      <table className="w-full caption-bottom text-sm">{children}</table>
    </div>
  );
}
