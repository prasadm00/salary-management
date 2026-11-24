import type { SummaryResponse } from '@acme/shared';
import { Card, CardContent } from '@/components/ui/card';

/** How many people there are: in total, and (when amounts are not converted) in each currency. */
export function HeadcountCards({ summary }: { summary: SummaryResponse }) {
  return (
    <section aria-labelledby="headcount-heading" className="space-y-3">
      <h2 id="headcount-heading" className="text-lg font-semibold">
        Headcount
      </h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Count label="Employees" value={summary.headcount} />
        {/* In the US dollar view everyone is in one currency, so there is nothing to split. */}
        {summary.view === 'local' &&
          summary.groups.map((group) => (
            <Count
              key={group.currency}
              label={`Paid in ${group.currency}`}
              value={group.headcount}
            />
          ))}
      </div>
    </section>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <Card size="sm">
      <CardContent>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tabular-nums">{value.toLocaleString('en-US')}</p>
      </CardContent>
    </Card>
  );
}
