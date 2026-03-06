'use client';

import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FilterChipProps {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  showRemove?: boolean;
  onClick: () => void;
}

export function FilterChip({
  label,
  selected = false,
  disabled = false,
  showRemove = false,
  onClick
}: FilterChipProps) {
  return (
    <button
      type='button'
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium sm:min-h-0',
        'transition-all duration-150',
        'focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none',
        'disabled:pointer-events-none disabled:opacity-50',
        selected
          ? 'border-primary bg-primary/10 text-primary hover:bg-primary/20 dark:bg-primary/20 dark:hover:bg-primary/30'
          : 'border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground'
      )}
    >
      {selected && (
        <Check
          className='animate-in fade-in zoom-in-75 size-3 shrink-0 duration-150'
          strokeWidth={3}
        />
      )}
      <span>{label}</span>
      {showRemove && (
        <X className='size-3 shrink-0 opacity-60 hover:opacity-100' />
      )}
    </button>
  );
}
