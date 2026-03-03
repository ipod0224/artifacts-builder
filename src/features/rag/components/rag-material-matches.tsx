import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { IconDatabase } from '@tabler/icons-react';
import type { MaterialMatch } from '../types';

export function RagMaterialMatches({ matches }: { matches: MaterialMatch[] }) {
  if (matches.length === 0) return null;

  return (
    <Card className='border-green-200 dark:border-green-800'>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <IconDatabase className='size-5 text-green-600' />
          材料匹配結果
        </CardTitle>
        <CardDescription>
          從材料資料庫精確匹配到 {matches.length} 筆資料
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>材料名稱</TableHead>
              <TableHead>規格</TableHead>
              <TableHead>單位</TableHead>
              <TableHead className='text-right'>單價</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {matches.map((m) => (
              <TableRow key={m.code}>
                <TableCell className='font-medium'>{m.name}</TableCell>
                <TableCell>{m.spec}</TableCell>
                <TableCell>{m.unit}</TableCell>
                <TableCell className='text-right'>
                  {m.unit_price != null ? `$${m.unit_price}` : '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
