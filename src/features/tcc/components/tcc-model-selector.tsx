'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  type TccData,
  MCCB_GROUPS,
  MCB_GROUPS,
  GROUP_LABELS,
  MAX_OVERLAY
} from '../constants';

interface TccModelSelectorProps {
  groups: TccData;
  selected: string[];
  onToggle: (key: string) => void;
}

function GroupItem({
  groupKey,
  models,
  minPoints,
  maxPoints,
  checked,
  disabled,
  onToggle
}: {
  groupKey: string;
  models: string[];
  minPoints: number;
  maxPoints: number;
  checked: boolean;
  disabled: boolean;
  onToggle: (key: string) => void;
}) {
  const label = GROUP_LABELS[groupKey] || groupKey;
  const totalPoints = minPoints + maxPoints;

  return (
    <label
      className={`flex items-start gap-2 rounded-md border p-2 transition-colors ${
        checked
          ? 'border-primary bg-primary/5'
          : disabled
            ? 'cursor-not-allowed opacity-50'
            : 'hover:bg-muted/50 cursor-pointer'
      }`}
    >
      <Checkbox
        checked={checked}
        disabled={disabled && !checked}
        onCheckedChange={() => onToggle(groupKey)}
        className='mt-0.5'
      />
      <div className='min-w-0 flex-1'>
        <div className='text-sm leading-tight font-medium'>{label}</div>
        <div className='text-muted-foreground mt-0.5 flex flex-wrap gap-1 text-[10px]'>
          <span>{models.length} 型號</span>
          <span>·</span>
          <span>{totalPoints} 點</span>
        </div>
        {models.length <= 4 && (
          <div className='mt-1 flex flex-wrap gap-0.5'>
            {models.map((m) => (
              <Badge key={m} variant='secondary' className='px-1 text-[9px]'>
                {m}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </label>
  );
}

function GroupList({
  groupKeys,
  groups,
  selected,
  onToggle
}: {
  groupKeys: readonly string[];
  groups: TccData;
  selected: string[];
  onToggle: (key: string) => void;
}) {
  const atLimit = selected.length >= MAX_OVERLAY;

  return (
    <div className='grid gap-1.5'>
      {groupKeys.map((key) => {
        const g = groups[key];
        if (!g) return null;
        const isChecked = selected.includes(key);
        return (
          <GroupItem
            key={key}
            groupKey={key}
            models={g.models}
            minPoints={g.min_curve.length}
            maxPoints={g.max_curve.length}
            checked={isChecked}
            disabled={atLimit && !isChecked}
            onToggle={onToggle}
          />
        );
      })}
    </div>
  );
}

export function TccModelSelector({
  groups,
  selected,
  onToggle
}: TccModelSelectorProps) {
  return (
    <Card>
      <CardHeader className='px-4 pt-4 pb-2 sm:px-6 sm:pt-6'>
        <CardTitle className='text-sm sm:text-base'>
          型號選擇
          <span className='text-muted-foreground ml-2 text-xs font-normal'>
            {selected.length}/{MAX_OVERLAY}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className='px-4 pt-0 sm:px-6'>
        <Tabs defaultValue='mccb'>
          <TabsList className='mb-2 w-full'>
            <TabsTrigger value='mccb' className='flex-1 text-xs'>
              MCCB ({MCCB_GROUPS.length})
            </TabsTrigger>
            <TabsTrigger value='mcb' className='flex-1 text-xs'>
              MCB ({MCB_GROUPS.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value='mccb' className='max-h-[420px] overflow-y-auto'>
            <GroupList
              groupKeys={MCCB_GROUPS}
              groups={groups}
              selected={selected}
              onToggle={onToggle}
            />
          </TabsContent>
          <TabsContent value='mcb' className='max-h-[420px] overflow-y-auto'>
            <GroupList
              groupKeys={MCB_GROUPS}
              groups={groups}
              selected={selected}
              onToggle={onToggle}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
