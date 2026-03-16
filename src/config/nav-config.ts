import { NavItem } from '@/types';

/**
 * Navigation configuration with RBAC support
 *
 * This configuration is used for both the sidebar navigation and Cmd+K bar.
 *
 * RBAC Access Control:
 * Each navigation item can have an `access` property that controls visibility
 * based on permissions, plans, features, roles, and organization context.
 *
 * Examples:
 *
 * 1. Require organization:
 *    access: { requireOrg: true }
 *
 * 2. Require specific permission:
 *    access: { requireOrg: true, permission: 'org:teams:manage' }
 *
 * 3. Require specific plan:
 *    access: { plan: 'pro' }
 *
 * 4. Require specific feature:
 *    access: { feature: 'premium_access' }
 *
 * 5. Require specific role:
 *    access: { role: 'admin' }
 *
 * 6. Multiple conditions (all must be true):
 *    access: { requireOrg: true, permission: 'org:teams:manage', plan: 'pro' }
 *
 * Note: The `visible` function is deprecated but still supported for backward compatibility.
 * Use the `access` property for new items.
 */
export const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    url: '/dashboard/overview',
    icon: 'dashboard',
    isActive: false,
    shortcut: ['d', 'd'],
    items: []
  },
  {
    title: 'RAG 知識庫',
    url: '/dashboard/rag',
    icon: 'search',
    isActive: false,
    shortcut: ['r', 'r'],
    items: []
  },
  {
    title: '價格情報',
    url: '/dashboard/prices',
    icon: 'priceIntel',
    isActive: false,
    shortcut: ['p', 'r'],
    items: []
  },
  {
    title: '互動配置器',
    url: '/dashboard/prices/configurator',
    icon: 'configurator',
    isActive: false,
    shortcut: ['c', 'f'],
    items: []
  },
  {
    title: 'TCC 曲線',
    url: '/dashboard/tcc',
    icon: 'tcc',
    isActive: false,
    shortcut: ['t', 'c'],
    items: []
  },
  {
    title: '原物料指數',
    url: '/dashboard/commodities',
    icon: 'commodity',
    isActive: false,
    shortcut: ['c', 'm'],
    items: []
  }
  // --- 以下暫時隱藏，有新功能時再啟用 ---
  // { title: '語錄', url: '/dashboard/quotes', icon: 'quote', isActive: false, shortcut: ['q', 't'], items: [] },
  // { title: 'Workspaces', url: '/dashboard/workspaces', icon: 'workspace', isActive: false, items: [] },
  // { title: 'Teams', url: '/dashboard/workspaces/team', icon: 'teams', isActive: false, items: [], access: { requireOrg: true } },
  // { title: 'Product', url: '/dashboard/product', icon: 'product', shortcut: ['p', 'p'], isActive: false, items: [] },
  // { title: 'Kanban', url: '/dashboard/kanban', icon: 'kanban', shortcut: ['k', 'k'], isActive: false, items: [] },
  // { title: 'Pro', url: '#', icon: 'pro', isActive: true, items: [{ title: 'Exclusive', url: '/dashboard/exclusive', icon: 'exclusive', shortcut: ['m', 'm'] }] },
  // { title: 'Account', url: '#', icon: 'account', isActive: true, items: [{ title: 'Profile', url: '/dashboard/profile', icon: 'profile', shortcut: ['m', 'm'] }, { title: 'Billing', url: '/dashboard/billing', icon: 'billing', shortcut: ['b', 'b'], access: { requireOrg: true } }, { title: 'Login', shortcut: ['l', 'l'], url: '/', icon: 'login' }] }
];
