import React from 'react';
import { PartCategory, PartRecord, Language } from '../types';
import GlassSlidingDoorForm from './forms/GlassSlidingDoorForm';
import StandardPartForm from './forms/StandardPartForm';

interface InventoryFormProps {
  onSubmit: (records: PartRecord | PartRecord[]) => Promise<void>;
  preselectedCategory: PartCategory;
  allRecords: PartRecord[];
  quickTasks: string[];
  onUpdateQuickTasks: (tasks: string[]) => Promise<void>;
  language: Language;
}

const InventoryForm: React.FC<InventoryFormProps> = ({ 
  onSubmit, 
  preselectedCategory, 
  allRecords,
  quickTasks = [],
  onUpdateQuickTasks,
  language
}) => {
  switch (preselectedCategory) {
    case PartCategory.GlassSlidingDoor:
      return (
        <GlassSlidingDoorForm 
          onSubmit={onSubmit}
          allRecords={allRecords}
          quickTasks={quickTasks}
          onUpdateQuickTasks={onUpdateQuickTasks}
          language={language}
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
      return <div className="p-8 text-center text-zinc-500">Unknown Module</div>;
  }
};

export default InventoryForm;