import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import type { RagStats } from '../types';

export function RagStatsBar({ stats }: { stats: RagStats }) {
  return (
    <div className='grid grid-cols-1 gap-4 md:grid-cols-5'>
      <Card>
        <CardHeader className='pb-2'>
          <CardDescription>對答規則</CardDescription>
          <CardTitle className='text-2xl'>
            {stats.qaRules.toLocaleString()}
          </CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader className='pb-2'>
          <CardDescription>知識庫 Chunks</CardDescription>
          <CardTitle className='text-2xl'>{stats.documents}</CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader className='pb-2'>
          <CardDescription>材料項目</CardDescription>
          <CardTitle className='text-2xl'>{stats.materials}</CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader className='pb-2'>
          <CardDescription>向量維度</CardDescription>
          <CardTitle className='text-2xl'>1024</CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader className='pb-2'>
          <CardDescription>Embedding 模型</CardDescription>
          <CardTitle className='text-lg'>bge-m3</CardTitle>
        </CardHeader>
      </Card>
    </div>
  );
}
