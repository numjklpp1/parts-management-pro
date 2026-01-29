
import React from 'react';
import { PartCategory, PartRecord } from '../types';
import GlassSlidingDoorForm from './forms/GlassSlidingDoorForm';
import StandardPartForm from './forms/StandardPartForm';

interface InventoryFormProps {
  onSubmit: (records: PartRecord | PartRecord[]) => Promise<void>;
  preselectedCategory: PartCategory;
  allRecords: PartRecord[];
  quickTasks: string[];
  onUpdateQuickTasks: (tasks: string[]) => Promise<void>;
}

const InventoryForm: React.FC<InventoryFormProps> = ({ 
  onSubmit, 
  preselectedCategory, 
  allRecords,
  quickTasks = [],
  onUpdateQuickTasks
}) => {
  // 根據類別分發到不同的模組
  switch (preselectedCategory) {
    case PartCategory.GlassSlidingDoor:
      return (
        <GlassSlidingDoorForm 
          onSubmit={onSubmit}
          allRecords={allRecords}
          quickTasks={quickTasks}
          onUpdateQuickTasks={onUpdateQuickTasks}
        />
      );
      
    case PartCategory.IronSlidingDoor:
      return <StandardPartForm category={preselectedCategory} icon="🏗️" onSubmit={async (r) => onSubmit(r)} />;
      
    case PartCategory.Drawer:
      return <StandardPartForm category={preselectedCategory} icon="📥" onSubmit={async (r) => onSubmit(r)} />;
      
    case PartCategory.CabinetBody:
      return <StandardPartForm category={preselectedCategory} icon="📦" onSubmit={async (r) => onSubmit(r)} />;
      
    case PartCategory.Paint:
      return <StandardPartForm category={preselectedCategory} icon="🎨" onSubmit={async (r) => onSubmit(r)} />;

    default:
      return (
        <div className="p-8 text-center text-zinc-500">
          未知的分類模組
        </div>
      );
  }
};

export default InventoryForm;
