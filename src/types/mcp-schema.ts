/**
 * MCP → shadcn/ui 組件 Schema
 *
 * 遵循 MCP Apps 規範：https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/
 * 定義 Claude/MCP 工具返回的 UI 組件格式
 */

// ============================================================
// MCP 基礎類型
// ============================================================

/** MCP 工具返回的內容類型 */
export type MCPContentType = 'text' | 'resource' | 'ui';

/** MCP 工具返回格式 */
export interface MCPToolResult {
  content: MCPContent[];
  isError?: boolean;
}

export interface MCPContent {
  type: MCPContentType;
  text?: string;
  resource?: MCPResource;
  ui?: MCPUIComponent;
}

export interface MCPResource {
  uri: string;
  mimeType: string;
  blob?: string; // Base64 encoded
}

// ============================================================
// MCP UI 組件定義
// ============================================================

/** 支援的 shadcn/ui 組件類型 */
export type ShadcnComponentType =
  | 'button'
  | 'card'
  | 'data-table'
  | 'dialog'
  | 'form'
  | 'input'
  | 'chart'
  | 'alert'
  | 'badge'
  | 'toast';

/** 組件變體 */
export type ComponentVariant =
  | 'default'
  | 'destructive'
  | 'outline'
  | 'secondary'
  | 'ghost'
  | 'link';

/** MCP UI 組件規範 */
export interface MCPUIComponent {
  /** 組件類型 */
  type: ShadcnComponentType;

  /** 組件變體 */
  variant?: ComponentVariant;

  /** 組件屬性 */
  props: Record<string, unknown>;

  /** 子組件 */
  children?: MCPUIComponent[];

  /** 事件處理（返回 MCP 工具呼叫） */
  actions?: MCPUIAction[];
}

export interface MCPUIAction {
  /** 觸發事件 */
  event: 'click' | 'submit' | 'change';

  /** 要呼叫的 MCP 工具 */
  tool: string;

  /** 工具參數模板 */
  params: Record<string, unknown>;
}

// ============================================================
// shadcn/ui 組件 Props 定義
// ============================================================

/** DataTable 組件 */
export interface DataTableProps {
  columns: DataTableColumn[];
  data: Record<string, unknown>[];
  pagination?: boolean;
  pageSize?: number;
  searchable?: boolean;
  searchColumn?: string;
}

export interface DataTableColumn {
  key: string;
  header: string;
  type?: 'text' | 'number' | 'date' | 'badge' | 'action';
  sortable?: boolean;
  width?: string;
}

/** Card 組件 */
export interface CardProps {
  title: string;
  description?: string;
  content: string | MCPUIComponent;
  footer?: string | MCPUIComponent;
  variant?: ComponentVariant;
}

/** Dialog 組件 */
export interface DialogProps {
  title: string;
  description?: string;
  content: MCPUIComponent;
  trigger: MCPUIComponent;
  confirmText?: string;
  cancelText?: string;
}

/** Form 組件 */
export interface FormProps {
  fields: FormField[];
  submitText?: string;
  onSubmit?: MCPUIAction;
}

export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'email' | 'password' | 'textarea' | 'select';
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[]; // for select
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
}

/** Chart 組件 */
export interface ChartProps {
  type: 'line' | 'bar' | 'pie' | 'area';
  data: ChartData[];
  xKey: string;
  yKey: string;
  title?: string;
}

export interface ChartData {
  [key: string]: string | number;
}

// ============================================================
// 組件映射表
// ============================================================

/** 組件類型到 Props 的映射 */
export interface ComponentPropsMap {
  'data-table': DataTableProps;
  card: CardProps;
  dialog: DialogProps;
  form: FormProps;
  chart: ChartProps;
  button: {
    text: string;
    variant?: ComponentVariant;
    size?: 'sm' | 'default' | 'lg';
  };
  input: { placeholder?: string; type?: string; value?: string };
  alert: {
    title: string;
    description?: string;
    variant?: 'default' | 'destructive';
  };
  badge: { text: string; variant?: ComponentVariant };
  toast: {
    title: string;
    description?: string;
    variant?: 'default' | 'destructive';
  };
}

// ============================================================
// 工廠函數類型
// ============================================================

/** 建立 MCP UI 組件的輔助函數 */
export function createMCPComponent<T extends ShadcnComponentType>(
  type: T,
  props: ComponentPropsMap[T],
  options?: {
    variant?: ComponentVariant;
    children?: MCPUIComponent[];
    actions?: MCPUIAction[];
  }
): MCPUIComponent {
  return {
    type,
    props: props as Record<string, unknown>,
    variant: options?.variant,
    children: options?.children,
    actions: options?.actions
  };
}

/** 建立 DataTable 組件 */
export function createDataTable(
  columns: DataTableColumn[],
  data: Record<string, unknown>[],
  options?: Partial<DataTableProps>
): MCPUIComponent {
  return createMCPComponent('data-table', {
    columns,
    data,
    pagination: options?.pagination ?? true,
    pageSize: options?.pageSize ?? 10,
    searchable: options?.searchable ?? false,
    searchColumn: options?.searchColumn
  });
}

/** 建立 Card 組件 */
export function createCard(
  title: string,
  content: string | MCPUIComponent,
  options?: Partial<CardProps>
): MCPUIComponent {
  return createMCPComponent('card', {
    title,
    content,
    description: options?.description,
    footer: options?.footer
  });
}

// ============================================================
// 驗證函數
// ============================================================

/** 驗證 MCP UI 組件是否符合規範 */
export function validateMCPComponent(component: MCPUIComponent): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // 檢查類型
  const validTypes: ShadcnComponentType[] = [
    'button',
    'card',
    'data-table',
    'dialog',
    'form',
    'input',
    'chart',
    'alert',
    'badge',
    'toast'
  ];

  if (!validTypes.includes(component.type)) {
    errors.push(`無效的組件類型: ${component.type}`);
  }

  // 檢查必要屬性
  if (!component.props) {
    errors.push('缺少 props');
  }

  // 遞迴驗證子組件
  if (component.children) {
    for (const child of component.children) {
      const childResult = validateMCPComponent(child);
      errors.push(...childResult.errors);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
