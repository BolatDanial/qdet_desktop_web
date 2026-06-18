import {
  BarChart3,
  Boxes,
  ClipboardCheck,
  CreditCard,
  FileText,
  Heart,
  LayoutDashboard,
  Package,
  ReceiptText,
  Search,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Truck,
  Users,
  Warehouse,
  Zap,
} from 'lucide-react';

export const navSections = [
  {
    titleKey: 'sectionsMain',
    items: [
      { id: 'dashboard', labelKey: 'navDashboard', path: '/dashboard', icon: LayoutDashboard },
      { id: 'sales', labelKey: 'navSales', path: '/sales', icon: ShoppingBag, hidden: true },
      { id: 'tariff', labelKey: 'navTariff', path: '/tariff', icon: CreditCard, badge: 'NEW' },
      { id: 'purchases', labelKey: 'navPurchases', path: '/purchases', icon: Boxes, hidden: true },
      { id: 'products', labelKey: 'navProducts', path: '/products', icon: Package, hidden: true },
      { id: 'clients', labelKey: 'navClients', path: '/clients', icon: Users, hidden: true },
      { id: 'reports', labelKey: 'navReports', path: '/reports', icon: BarChart3, hidden: true },
    ],
  },
  {
    titleKey: 'sectionsWarehouse',
    items: [
      { id: 'warehouse', labelKey: 'navWarehouse', path: '/warehouse', icon: Warehouse, hidden: true },
      { id: 'audit', labelKey: 'navAudit', path: '/audit', icon: ClipboardCheck, hidden: true },
    ],
  },
  {
    titleKey: 'sectionsGov',
    items: [
      { id: 'nkt', labelKey: 'navNkt', path: '/nkt', icon: Search, badge: 'NEW' },
      { id: 'esf', labelKey: 'navEsf', path: '/esf', icon: FileText, badge: 'NEW', hidden: true },
      { id: 'snt', labelKey: 'navSnt', path: '/snt', icon: Truck, badge: 'NEW', hidden: true },
      { id: 'sono', labelKey: 'navSono', path: '/sono', icon: Zap, badge: 'NEW', hidden: true },
    ],
  },
  {
    titleKey: 'sectionsMarketplace',
    items: [
      { id: 'kaspi', labelKey: 'navKaspi', path: '/kaspi', icon: ShoppingCart, badge: 'NEW', hidden: true },
      { id: 'wb', labelKey: 'navWb', path: '/wb', icon: Heart, badge: 'SOON', badgeClass: 'soon', hidden: true },
    ],
  },
  {
    titleKey: 'sectionsSystem',
    items: [{ id: 'settings', labelKey: 'navSettings', path: '/settings', icon: Settings, hidden: true }],
  },
];

export const visibleNavSections = navSections
  .map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.hidden),
  }))
  .filter((section) => section.items.length > 0);

export const pageLabelKeys = Object.fromEntries(navSections.flatMap((section) => section.items.map((item) => [item.path, item.labelKey])));
