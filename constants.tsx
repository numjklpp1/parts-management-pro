
import React from 'react';

export const CATEGORIES = [
  '玻璃拉門',
  '鐵拉門',
  '抽屜',
  '桶身',
  '噴漆'
] as const;

export const UNITS = ['組', '個', '件', '米', '才', '公升'] as const;

// 玻璃拉門專用配置：更新組別名稱與生產流程順序
export const GLASS_DOOR_GROUPS = ['完成', '框_完成', '框', '框_未噴', '玻璃條', '玻璃'] as const;

export const GLASS_DOOR_MODELS = [
  '樹德4尺-L', '樹德4尺-R', '樹德3尺-L', '樹德3尺-R',
  'UG3A-L', 'UG3A-R', 'UG2A-L', 'UG2A-R',
  'AK3U-L', 'AK3U-R', 'AK2U-L', 'AK2U-R',
  'AK3B-L', 'AK3B-R', 'AK2B-L', 'AK2B-R',
  '4尺88-L', '4尺88-R', '3尺88-L', '3尺88-R',
  '4尺106-L', '4尺106-R', '4尺74-L', '4尺74-R'
] as const;

export const APP_CONFIG = {
  SHEET_RANGE: 'A1:J1000',
  DEFAULT_SHEET_NAME: 'PartInventory',
};
