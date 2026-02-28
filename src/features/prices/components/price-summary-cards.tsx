'use client';

import {
  IconBox,
  IconBuildingStore,
  IconDatabase,
  IconClockHour4
} from '@tabler/icons-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface SummaryData {
  total_items: number;
  total_categories: number;
  total_sources: number;
  last_updated: string;
}

export function PriceSummaryCards({ data }: { data: SummaryData | null }) {
  const cards = [
    {
      title: '品項總數',
      value: data?.total_items?.toLocaleString() ?? '—',
      icon: IconDatabase,
      href: '#section-items'
    },
    {
      title: '品類',
      value: data?.total_categories?.toString() ?? '—',
      icon: IconBox,
      href: '#section-categories'
    },
    {
      title: '供應通路',
      value: data?.total_sources?.toString() ?? '—',
      icon: IconBuildingStore,
      href: '#section-sources'
    },
    {
      title: '最近更新',
      value: data?.last_updated
        ? new Date(data.last_updated).toLocaleDateString('zh-TW')
        : '—',
      icon: IconClockHour4,
      href: undefined
    }
  ];

  return (
    <div className='grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4'>
      {cards.map((card) => {
        const content = (
          <Card
            className={
              card.href
                ? 'cursor-pointer transition-shadow hover:shadow-md'
                : ''
            }
          >
            <CardHeader className='flex flex-row items-center justify-between space-y-0 px-4 pt-4 pb-2 sm:px-6 sm:pt-6'>
              <CardTitle className='text-xs font-medium sm:text-sm'>
                {card.title}
              </CardTitle>
              <card.icon className='text-muted-foreground h-4 w-4' />
            </CardHeader>
            <CardContent className='px-4 pb-4 sm:px-6 sm:pb-6'>
              <div className='text-xl font-bold sm:text-2xl'>{card.value}</div>
            </CardContent>
          </Card>
        );

        if (card.href) {
          return (
            <a
              key={card.title}
              href={card.href}
              onClick={(e) => {
                e.preventDefault();
                document
                  .querySelector(card.href!)
                  ?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              {content}
            </a>
          );
        }

        return <div key={card.title}>{content}</div>;
      })}
    </div>
  );
}
