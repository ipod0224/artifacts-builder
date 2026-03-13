import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { requireWriteAuth } from '@/lib/api-auth';

const CLAUDE_PATH = (() => {
  const p = process.env.CLAUDE_PATH || '/Users/yen/.local/bin/claude';
  if (!p.startsWith('/') || p.includes('..'))
    throw new Error('Invalid CLAUDE_PATH');
  return p;
})();

interface SynthesizeInput {
  query: string;
  chunks: Array<{
    content: string;
    source: string;
    similarity: number;
    doc_type?: string;
  }>;
  materials: Array<{
    name: string;
    spec: string;
    unit: string;
    unit_price: number | null;
  }>;
}

const SYSTEM_PROMPT = `你是建築水電材料知識庫助手。根據提供的資料回答問題。
規則：
- 用繁體中文回答
- 簡潔清楚，重點優先
- 材料資料用表格呈現（名稱、規格、單位、單價）
- 知識庫引用附上來源編號 [1] [2] 等
- 如果資料不足以完整回答，明確說明缺少什麼
- 不要編造價格或規格
- 回答控制在 200 字以內`;

function buildUserPrompt(input: SynthesizeInput): string {
  const parts: string[] = [`問題：${input.query}`];

  if (input.materials.length > 0) {
    const rows = input.materials.map(
      (m) =>
        `| ${m.name} | ${m.spec} | ${m.unit} | ${m.unit_price != null ? `$${m.unit_price}` : '-'} |`
    );
    parts.push(
      `\n材料資料庫匹配結果：\n| 名稱 | 規格 | 單位 | 單價 |\n|------|------|------|------|\n${rows.join('\n')}`
    );
  }

  if (input.chunks.length > 0) {
    const refs = input.chunks.map(
      (c, i) =>
        `[${i + 1}] （來源：${c.source}，相似度 ${(c.similarity * 100).toFixed(0)}%）\n${c.content.slice(0, 500)}`
    );
    parts.push(`\n知識庫參考資料：\n${refs.join('\n\n')}`);
  }

  return parts.join('\n');
}

// 限制同時只能有 2 個 claude CLI 進程（防止 process explosion）
let activeSpawns = 0;
const MAX_CONCURRENT_SPAWNS = 2;

/**
 * 用 claude -p 走訂閱制 Opus 合成回答
 * 不需要 API key，直接用 Claude Code 訂閱認證
 */
function synthesizeWithClaudeCLI(input: SynthesizeInput): Promise<string> {
  if (activeSpawns >= MAX_CONCURRENT_SPAWNS) {
    return Promise.reject(
      new Error('CLAUDE_CLI_BUSY: too many concurrent requests')
    );
  }
  activeSpawns++;
  return new Promise((resolve, reject) => {
    const fullPrompt = `${SYSTEM_PROMPT}\n\n${buildUserPrompt(input)}`;

    // 清除 CLAUDECODE 避免巢狀偵測阻擋
    const { CLAUDECODE: _, ...restEnv } = process.env;
    void _;
    const cleanEnv = { ...restEnv, NO_COLOR: '1' };

    const proc = spawn(CLAUDE_PATH, ['-p', '--model', 'opus'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: cleanEnv
    });

    let stdout = '';
    let stderr = '';
    let killed = false;

    // spawn 不支援 timeout option，手動實作
    const timer = setTimeout(() => {
      killed = true;
      proc.kill('SIGTERM');
      setTimeout(() => {
        if (!proc.killed) proc.kill('SIGKILL');
      }, 5_000);
    }, 120_000);

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      activeSpawns--;
      clearTimeout(timer);
      if (killed) {
        reject(new Error('CLAUDE_CLI_TIMEOUT: exceeded 120s'));
      } else if (code === 0 && stdout.trim()) {
        resolve(stdout.trim());
      } else {
        reject(
          new Error(`CLAUDE_CLI_FAILED: exit ${code}, ${stderr.slice(0, 200)}`)
        );
      }
    });

    proc.on('error', (err) => {
      activeSpawns--;
      clearTimeout(timer);
      reject(new Error(`CLAUDE_CLI_ERROR: ${err.message}`));
    });

    // 透過 stdin 傳入 prompt（避免 shell injection）
    proc.stdin.write(fullPrompt);
    proc.stdin.end();
  });
}

function synthesizeStructured(input: SynthesizeInput): string {
  const parts: string[] = [];

  if (input.materials.length > 0) {
    // 摘要句
    const priced = input.materials.filter((m) => m.unit_price != null);
    const prices = priced.map((m) => m.unit_price!);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const specs = Array.from(
      new Set(input.materials.map((m) => m.spec).filter(Boolean))
    );

    if (priced.length > 0 && minPrice === maxPrice) {
      parts.push(
        `找到 **${input.materials.length}** 筆相關材料，單價 **$${minPrice.toLocaleString()}**。`
      );
    } else if (priced.length > 0) {
      parts.push(
        `找到 **${input.materials.length}** 筆相關材料，單價區間 **$${minPrice.toLocaleString()} ~ $${maxPrice.toLocaleString()}**。`
      );
    } else {
      parts.push(`找到 **${input.materials.length}** 筆相關材料。`);
    }

    if (specs.length > 0 && specs.length <= 5) {
      parts.push(`涵蓋規格：${specs.join('、')}。`);
    }

    // 結構化表格
    parts.push('');
    parts.push('| 材料名稱 | 規格 | 單位 | 單價 |');
    parts.push('|:---------|:-----|:----:|-----:|');
    for (const m of input.materials) {
      const price =
        m.unit_price != null ? `$${m.unit_price.toLocaleString()}` : '-';
      parts.push(`| ${m.name} | ${m.spec || '-'} | ${m.unit} | ${price} |`);
    }
  }

  if (input.chunks.length > 0) {
    const relevant = input.chunks.filter((c) => c.similarity >= 0.6);
    if (relevant.length > 0) {
      parts.push('');
      parts.push('**相關知識庫參考：**');
      relevant.forEach((c, i) => {
        parts.push(
          `- [${i + 1}] ${c.source}（${(c.similarity * 100).toFixed(0)}%）`
        );
      });
    }
  } else if (input.materials.length > 0) {
    parts.push('');
    parts.push('*知識庫中未找到高度相關的補充資料，以上價格僅供參考。*');
  }

  if (input.materials.length === 0 && input.chunks.length === 0) {
    parts.push('未找到匹配結果，建議使用更具體的材料名稱或規格搜尋。');
  }

  return parts.join('\n');
}

export async function POST(request: NextRequest) {
  const authError = requireWriteAuth(request);
  if (authError) return authError;

  try {
    const body: SynthesizeInput = await request.json();

    if (!body.query) {
      return NextResponse.json({ error: '缺少查詢參數' }, { status: 400 });
    }

    let answer: string;
    let provider: string;

    try {
      answer = await synthesizeWithClaudeCLI(body);
      provider = 'claude-opus';
    } catch {
      // Claude CLI 失敗 → 結構化 fallback
      answer = synthesizeStructured(body);
      provider = 'structured';
    }

    return NextResponse.json({
      success: true,
      answer,
      provider
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '合成失敗';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
