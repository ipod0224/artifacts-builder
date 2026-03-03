import { loadTccData, computeTccMeta } from '@/features/tcc/lib/load-tcc-data';
import { TccClientPage } from '@/features/tcc/components/tcc-client-page';

export default async function TccPage() {
  let groups;
  let meta;
  let error: string | null = null;

  try {
    groups = await loadTccData();
    meta = computeTccMeta(groups);
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load TCC data';
  }

  return (
    <div className='space-y-4 p-4 sm:space-y-6 sm:p-6'>
      {/* Header */}
      <div>
        <h2 className='text-xl font-bold tracking-tight sm:text-2xl'>
          TCC 曲線
        </h2>
        <p className='text-muted-foreground text-xs sm:text-sm'>
          士林電機 MCCB/MCB 時間-電流特性曲線（取代 ETAP 簡易保護協調）
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className='rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-400'>
          {error}
        </div>
      )}

      {groups && meta && <TccClientPage groups={groups} meta={meta} />}
    </div>
  );
}
