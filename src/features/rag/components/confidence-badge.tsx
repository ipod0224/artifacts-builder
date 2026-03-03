import type { ConfidenceLevel } from '../types';
import { CONFIDENCE_CONFIG } from '../constants';

function getConfidenceLevel(similarity: number): ConfidenceLevel {
  if (similarity >= 0.75) return 'high';
  if (similarity >= 0.6) return 'medium';
  return 'low';
}

export function ConfidenceBadge({ score }: { score: number }) {
  const level = getConfidenceLevel(score);
  const { color, label } = CONFIDENCE_CONFIG[level];
  const pct = (score * 100).toFixed(0);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${color}`}
    >
      <span
        className={`inline-block size-2 rounded-full ${
          level === 'high'
            ? 'bg-green-500'
            : level === 'medium'
              ? 'bg-blue-500'
              : 'bg-amber-500'
        }`}
      />
      {pct}% {label}
    </span>
  );
}
