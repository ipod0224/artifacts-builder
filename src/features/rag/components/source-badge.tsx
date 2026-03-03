import type { AnswerSource } from '../types';
import { SOURCE_CONFIG } from '../constants';

export function SourceBadge({
  source,
  confidence
}: {
  source: AnswerSource;
  confidence: number;
}) {
  if (!source) return null;
  const { color, label } = SOURCE_CONFIG[source];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}
    >
      {label}
      <span className='opacity-60'>({(confidence * 100).toFixed(0)}%)</span>
    </span>
  );
}
