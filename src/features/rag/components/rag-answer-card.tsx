'use client';

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter
} from '@/components/ui/card';
import { IconBolt } from '@tabler/icons-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SourceBadge } from './source-badge';
import type { AnswerSource, MatchedRule } from '../types';

interface RagAnswerCardProps {
  answer: string;
  source: AnswerSource;
  confidence: number;
  matchedRule: MatchedRule | null;
  materialCount: number;
  sourceCount: number;
}

export function RagAnswerCard({
  answer,
  source,
  confidence,
  matchedRule,
  materialCount,
  sourceCount
}: RagAnswerCardProps) {
  if (!answer) return null;

  const isLlm = source === 'llm';

  return (
    <Card
      className={
        isLlm
          ? 'border-purple-200 bg-purple-50/50 dark:border-purple-800 dark:bg-purple-950/20'
          : 'border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20'
      }
    >
      <CardHeader>
        <CardTitle className='flex items-center gap-2 text-lg'>
          <IconBolt
            className={
              isLlm ? 'size-5 text-purple-600' : 'size-5 text-green-600'
            }
          />
          {isLlm ? 'AI 合成回答' : '規則匹配回答'}
          <SourceBadge source={source} confidence={confidence} />
        </CardTitle>
        {matchedRule && (
          <CardDescription>
            Rule #{matchedRule.ruleId} [{matchedRule.type}
            {matchedRule.subtype ? `/${matchedRule.subtype}` : ''}]
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className='prose prose-sm dark:prose-invert max-w-none'>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            table: ({ children }) => (
              <div className='not-prose my-3 overflow-x-auto rounded-lg border'>
                <table className='w-full text-sm'>{children}</table>
              </div>
            ),
            thead: ({ children }) => (
              <thead className='bg-muted/50 border-b'>{children}</thead>
            ),
            th: ({ children, style }) => (
              <th
                className='px-3 py-2 text-left text-xs font-medium tracking-wider'
                style={style}
              >
                {children}
              </th>
            ),
            td: ({ children, style }) => {
              const isNumeric =
                typeof children === 'string'
                  ? /^\$[\d,]+$/.test(children.trim())
                  : Array.isArray(children) &&
                    children.some(
                      (c) =>
                        typeof c === 'string' && /^\$[\d,]+$/.test(c.trim())
                    );
              return (
                <td
                  className={`px-3 py-2 ${isNumeric ? 'font-mono font-semibold' : ''}`}
                  style={style}
                >
                  {children}
                </td>
              );
            },
            tr: ({ children }) => (
              <tr className='even:bg-muted/30 border-b last:border-0'>
                {children}
              </tr>
            )
          }}
        >
          {answer}
        </ReactMarkdown>
      </CardContent>
      <CardFooter className='text-muted-foreground border-t pt-3 text-xs'>
        {isLlm
          ? `AI 合成 | ${materialCount} 筆材料 + ${sourceCount} 個知識庫來源`
          : `規則直接匹配 | 分數 ${matchedRule ? (matchedRule.score * 100).toFixed(0) : 0}%`}
      </CardFooter>
    </Card>
  );
}
