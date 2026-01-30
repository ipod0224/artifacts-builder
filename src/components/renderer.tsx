'use client';

/**
 * MCP 組件渲染器
 *
 * 將 MCP JSON Schema 渲染為 shadcn/ui 組件
 */

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';

import type {
  MCPUIComponent,
  DataTableProps,
  CardProps,
  DialogProps,
  FormProps,
  ComponentVariant
} from '@/types/mcp-schema';

interface MCPRendererProps {
  component: MCPUIComponent;
  onAction?: (tool: string, params: Record<string, unknown>) => void;
}

/**
 * MCP 組件渲染器 - 主入口
 */
export function MCPRenderer({ component, onAction }: MCPRendererProps) {
  const handleAction = (tool: string, params: Record<string, unknown>) => {
    if (onAction) {
      onAction(tool, params);
    } else {
      console.log('MCP Action:', tool, params);
    }
  };

  switch (component.type) {
    case 'button':
      return <MCPButton component={component} onAction={handleAction} />;
    case 'card':
      return <MCPCard component={component} onAction={handleAction} />;
    case 'data-table':
      return <MCPDataTable component={component} />;
    case 'dialog':
      return <MCPDialog component={component} onAction={handleAction} />;
    case 'input':
      return <MCPInput component={component} />;
    case 'form':
      return <MCPForm component={component} onAction={handleAction} />;
    default:
      return <div className='text-red-500'>未知組件類型: {component.type}</div>;
  }
}

// ============================================================
// 個別組件實作
// ============================================================

function MCPButton({
  component,
  onAction
}: {
  component: MCPUIComponent;
  onAction: (tool: string, params: Record<string, unknown>) => void;
}) {
  const props = component.props as unknown as {
    text: string;
    size?: 'sm' | 'default' | 'lg';
  };
  const variant = component.variant || 'default';

  const handleClick = () => {
    const clickAction = component.actions?.find((a) => a.event === 'click');
    if (clickAction) {
      onAction(clickAction.tool, clickAction.params);
    }
  };

  return (
    <Button variant={variant} size={props.size} onClick={handleClick}>
      {props.text}
    </Button>
  );
}

function MCPCard({
  component,
  onAction
}: {
  component: MCPUIComponent;
  onAction: (tool: string, params: Record<string, unknown>) => void;
}) {
  const props = component.props as unknown as CardProps;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{props.title}</CardTitle>
        {props.description && (
          <CardDescription>{props.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {typeof props.content === 'string' ? (
          <p>{props.content}</p>
        ) : (
          <MCPRenderer
            component={props.content as MCPUIComponent}
            onAction={onAction}
          />
        )}
      </CardContent>
      {props.footer && (
        <CardFooter>
          {typeof props.footer === 'string' ? (
            <p>{props.footer}</p>
          ) : (
            <MCPRenderer
              component={props.footer as MCPUIComponent}
              onAction={onAction}
            />
          )}
        </CardFooter>
      )}
    </Card>
  );
}

function MCPDataTable({ component }: { component: MCPUIComponent }) {
  const props = component.props as unknown as DataTableProps;

  return (
    <div className='rounded-md border'>
      <Table>
        <TableHeader>
          <TableRow>
            {props.columns.map((col) => (
              <TableHead key={col.key} style={{ width: col.width }}>
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.data.map((row, rowIndex) => (
            <TableRow key={rowIndex}>
              {props.columns.map((col) => (
                <TableCell key={col.key}>
                  {String(row[col.key] ?? '')}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function MCPDialog({
  component,
  onAction
}: {
  component: MCPUIComponent;
  onAction: (tool: string, params: Record<string, unknown>) => void;
}) {
  const props = component.props as unknown as DialogProps;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <MCPRenderer component={props.trigger} onAction={onAction} />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{props.title}</DialogTitle>
          {props.description && (
            <DialogDescription>{props.description}</DialogDescription>
          )}
        </DialogHeader>
        <MCPRenderer component={props.content} onAction={onAction} />
      </DialogContent>
    </Dialog>
  );
}

function MCPInput({ component }: { component: MCPUIComponent }) {
  const props = component.props as unknown as {
    placeholder?: string;
    type?: string;
    value?: string;
  };

  return (
    <Input
      type={props.type || 'text'}
      placeholder={props.placeholder}
      defaultValue={props.value}
    />
  );
}

function MCPForm({
  component,
  onAction
}: {
  component: MCPUIComponent;
  onAction: (tool: string, params: Record<string, unknown>) => void;
}) {
  const props = component.props as unknown as FormProps;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    if (props.onSubmit) {
      onAction(props.onSubmit.tool, {
        ...props.onSubmit.params,
        formData: data
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className='space-y-4'>
      {props.fields.map((field) => (
        <div key={field.name} className='space-y-2'>
          <label htmlFor={field.name} className='text-sm font-medium'>
            {field.label}
            {field.required && <span className='text-red-500'>*</span>}
          </label>
          <Input
            id={field.name}
            name={field.name}
            type={field.type}
            placeholder={field.placeholder}
            required={field.required}
          />
        </div>
      ))}
      <Button type='submit'>{props.submitText || '送出'}</Button>
    </form>
  );
}
