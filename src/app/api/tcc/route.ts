import { NextResponse } from 'next/server';
import { loadTccData, computeTccMeta } from '@/features/tcc/lib/load-tcc-data';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const groups = await loadTccData();
    const meta = computeTccMeta(groups);

    return NextResponse.json({
      success: true,
      data: { groups, meta }
    });
  } catch (error) {
    process.stderr.write(
      `[api/tcc] ${error instanceof Error ? error.message : error}\n`
    );
    return NextResponse.json(
      { success: false, error: 'Failed to load TCC data' },
      { status: 500 }
    );
  }
}
