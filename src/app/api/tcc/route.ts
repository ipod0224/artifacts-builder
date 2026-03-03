import { NextResponse } from 'next/server';
import { readFile, stat, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { TccGroup } from '@/features/tcc/constants';

export const dynamic = 'force-dynamic';

const HOME = process.env.HOME || '/tmp';
const TCC_PATH = resolve(HOME, 'seec-mcp/data/curves/tcc-data-all.json');

// Singleton cache with mtime detection
let _cache: Record<string, TccGroup> | null = null;
let _mtime = 0;

function validateTccData(data: unknown): Record<string, TccGroup> {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error('TCC data must be a non-null object');
  }
  // Spot-check first 3 entries for structural integrity
  for (const [key, group] of Object.entries(
    data as Record<string, unknown>
  ).slice(0, 3)) {
    const g = group as Partial<TccGroup>;
    if (
      !Array.isArray(g?.models) ||
      !Array.isArray(g?.min_curve) ||
      !Array.isArray(g?.max_curve)
    ) {
      throw new Error(`Invalid TccGroup structure for key: ${key}`);
    }
  }
  return data as Record<string, TccGroup>;
}

async function loadTccData(): Promise<Record<string, TccGroup>> {
  // Path safety: ensure resolved path is under expected directory
  const resolved = resolve(TCC_PATH);
  if (!resolved.startsWith(resolve(HOME, 'seec-mcp/'))) {
    throw new Error('Invalid TCC data path');
  }

  try {
    await access(resolved);
  } catch {
    throw new Error('TCC data file not found');
  }

  const { mtimeMs: currentMtime } = await stat(resolved);

  if (_cache && currentMtime === _mtime) {
    return _cache;
  }

  const raw = await readFile(resolved, 'utf-8');
  const data = validateTccData(JSON.parse(raw));
  _cache = data;
  _mtime = currentMtime;

  return data;
}

export async function GET() {
  try {
    const groups = await loadTccData();

    let totalModels = 0;
    let totalPoints = 0;

    for (const g of Object.values(groups)) {
      totalModels += g.models.length;
      totalPoints += g.min_curve.length + g.max_curve.length;
    }

    return NextResponse.json({
      success: true,
      data: {
        groups,
        meta: {
          totalGroups: Object.keys(groups).length,
          totalModels,
          totalPoints
        }
      }
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
