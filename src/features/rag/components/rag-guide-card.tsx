'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { IconInfoCircle, IconChevronDown } from '@tabler/icons-react';

export function RagGuideCard() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className='hover:bg-muted/50 flex w-full items-center justify-between rounded-lg px-6 py-4 text-left transition-colors'
      >
        <div className='flex items-center gap-2'>
          <IconInfoCircle className='text-muted-foreground size-5' />
          <span className='text-sm font-medium'>系統功能介紹與使用指南</span>
        </div>
        <IconChevronDown
          className={`text-muted-foreground size-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen && (
        <CardContent className='border-t pt-4'>
          <div className='prose prose-sm dark:prose-invert max-w-none'>
            <p className='text-muted-foreground'>
              本系統是一套<strong>檢索增強生成（RAG）引擎</strong>
              ，結合向量語意搜尋、規則比對與 AI
              合成，將散落在判斷卡、材料資料庫、工率表中的專業知識統一匯聚，讓你用一句自然語言就能取得精準答案。
            </p>

            <h4>你可以問什麼？</h4>
            <ul>
              <li>
                <strong>材料價格查詢</strong> — 「EMT 導管 28mm 單價」「XLPE 3C
                100mm² 電纜價格」
              </li>
              <li>
                <strong>技術規格</strong> — 「2.0mm² 電線安培容量」「PVC
                管耐溫幾度」
              </li>
              <li>
                <strong>材料比較</strong> — 「XLPE 和 PVC 差別」「士林和台芝 NFB
                比較」
              </li>
              <li>
                <strong>費率與工率</strong> — 「管銷費率怎麼算」「穿線工率多少」
              </li>
              <li>
                <strong>判斷規則</strong> — 「二線控怎麼報價」「五金費怎麼抓」
              </li>
              <li>
                <strong>選型建議</strong> — 「NFB 怎麼選」「變壓器容量怎麼算」
              </li>
            </ul>

            <h4>系統如何運作？</h4>
            <ol>
              <li>
                <strong>規則比對</strong> —
                優先從萬筆對答規則中精確匹配，命中即直接回答（最快、最準）
              </li>
              <li>
                <strong>材料三層搜尋</strong> — SQL 精確匹配 → 分詞模糊匹配 →
                向量相似度搜尋，層層遞進
              </li>
              <li>
                <strong>知識庫語意搜尋</strong> — 使用 bge-m3
                向量模型在知識庫中找出語意最接近的內容
              </li>
              <li>
                <strong>AI 合成</strong> — 若規則未命中，將檢索結果交由 AI
                綜合分析後產生回答
              </li>
            </ol>

            <h4>回答品質標籤說明</h4>
            <ul>
              <li>
                <Badge className='bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'>
                  規則匹配
                </Badge>{' '}
                — 直接命中預建規則，準確度最高
              </li>
              <li>
                <Badge className='bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'>
                  規則+材料
                </Badge>{' '}
                — 規則搭配材料資料庫查詢
              </li>
              <li>
                <Badge className='bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'>
                  AI 合成
                </Badge>{' '}
                — AI 從多來源綜合推理，建議人工覆核
              </li>
            </ul>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
