import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET() {
  try {
    const [docCount, matResult] = await Promise.all([
      sql`SELECT count(*)::int as count FROM documents`,
      sql`SELECT * FROM materials ORDER BY name LIMIT 10`
    ]);

    return NextResponse.json({
      success: true,
      stats: {
        documents: docCount[0].count,
        materials: matResult.length
      },
      materials: matResult
    });
  } catch (err) {
    console.error('Stats API 錯誤:', err);
    const message = err instanceof Error ? err.message : '未知錯誤';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
