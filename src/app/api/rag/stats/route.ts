import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET() {
  try {
    const [docCount, matResult, qaRulesCount] = await Promise.all([
      sql`SELECT count(*)::int as count FROM documents`,
      sql`SELECT * FROM materials ORDER BY name LIMIT 10`,
      sql`SELECT count(*)::int as count FROM qa_rules`.catch(() => [
        { count: 0 }
      ])
    ]);

    return NextResponse.json({
      success: true,
      stats: {
        documents: docCount[0].count,
        materials: matResult.length,
        qaRules: qaRulesCount[0].count
      },
      materials: matResult
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知錯誤';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
