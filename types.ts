export enum PartCategory {
  GlassSlidingDoor = '玻璃拉門',
  IronSlidingDoor = '鐵拉門',
  Drawer = '抽屜',
  CabinetBody = '桶身',
  Paint = '噴漆'
}

export type Language = 'zh-TW' | 'vi' | 'id';

export interface PartRecord {
  id: string;
  timestamp: string;
  category: PartCategory;
  name: string;
  specification: string;
  quantity: number;
  note: string;
}

export interface DashboardStats {
  totalItems: number;
  totalQuantity: number;
  categoryDistribution: { name: string; value: number }[];
  recentActivity: PartRecord[];
}