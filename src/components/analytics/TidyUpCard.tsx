import type { FC } from 'react';

export interface TidyUpCardProps {
  /** Prompts never inserted */
  neverUsed: number;
  /** Duplicate pairs, or null while they are being looked for or could not be */
  duplicatePairs: number | null;
  onReviewNeverUsed: () => void;
  onReviewDuplicates: () => void;
}

const plural = (count: number, one: string, many: string): string => `${String(count)} ${count === 1 ? one : many}`;

/**
 * The Tidy up callout of Analytics (Atelier 1C): the Never used Prompts and the Duplicate pairs, each
 * with a Review button that opens the Library on them. A line with nothing to review is hidden, and
 * the card with it when both are.
 */
const TidyUpCard: FC<TidyUpCardProps> = ({ neverUsed, duplicatePairs, onReviewNeverUsed, onReviewDuplicates }) => {
  const pairs = duplicatePairs ?? 0;
  if (neverUsed === 0 && pairs === 0) {
    return null;
  }

  const lines = [
    { key: 'never-used', count: neverUsed, text: plural(neverUsed, 'prompt never used', 'prompts never used'), onReview: onReviewNeverUsed },
    { key: 'duplicates', count: pairs, text: plural(pairs, 'duplicate pair', 'duplicate pairs'), onReview: onReviewDuplicates }
  ].filter(line => line.count > 0);

  return (
    <section
      aria-labelledby="tidy-up-title"
      data-testid="tidy-up"
      className="mt-2.5 p-3.5 rounded-group bg-callout border-[1.5px] border-warning animate-card-rise"
    >
      <h2 id="tidy-up-title" className="text-sm font-extrabold text-callout">Tidy up</h2>
      <ul className="mt-2.5 flex flex-col gap-2">
        {lines.map(line => (
          <li key={line.key} data-testid={`tidy-up-${line.key}`} className="flex items-center gap-2.5">
            <span className="flex-1 text-[13px] text-callout">{line.text}</span>
            <button
              type="button"
              onClick={line.onReview}
              aria-label={`Review the ${line.text}`}
              className="h-[30px] px-3 rounded-full bg-card text-warning text-[12.5px] font-bold hover:bg-muted transition-colors focus-interactive"
            >
              Review
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default TidyUpCard;
