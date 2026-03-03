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
import type { Material } from '../types';

export function RagMaterialsTable({ materials }: { materials: Material[] }) {
  if (materials.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>材料資料</CardTitle>
        <CardDescription>來自 PostgreSQL 的真實資料</CardDescription>
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
            {materials.map((material) => (
              <TableRow key={material.id}>
                <TableCell className='font-medium'>{material.name}</TableCell>
                <TableCell>{material.spec || '-'}</TableCell>
                <TableCell>{material.unit}</TableCell>
                <TableCell className='text-right'>${material.price}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
