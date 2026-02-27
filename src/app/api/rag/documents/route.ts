import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const limit = Math.min(Number(searchParams.get('limit') || 100), 500);

    let rows;

    if (category) {
      rows = await sql`
        SELECT id, content, metadata, created_at
        FROM documents
        WHERE metadata->>'category' = ${category}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
    } else {
      rows = await sql`
        SELECT id, content, metadata, created_at
        FROM documents
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
    }

    return NextResponse.json({
      success: true,
      data: rows
    });
  } catch (err) {
    console.error('Documents API 錯誤:', err);
    const message = err instanceof Error ? err.message : '未知錯誤';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
