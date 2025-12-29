
import React from 'react';
import { COLOR_MAP } from '../constants';
import { Member } from '../types';

interface MemberSelectorProps {
  members: Member[];
  selectedMemberIds?: string[]; // Array support
  onSelect: (ids: string[]) => void; // Array callback
  excludeNone?: boolean;
}

const MemberSelector: React.FC<MemberSelectorProps> = ({ members, selectedMemberIds = [], onSelect, excludeNone = false }) => {
  
  const handleToggle = (id: string) => {
      if (selectedMemberIds.includes(id)) {
          // Remove
          onSelect(selectedMemberIds.filter(mid => mid !== id));
      } else {
          // Add
          onSelect([...selectedMemberIds, id]);
      }
  };

  return (
    <div className="flex gap-2 items-center flex-wrap">
      {members.map((m) => {
        const isSelected = selectedMemberIds.includes(m.id);
        return (
            <button
            key={m.id}
            onClick={() => handleToggle(m.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all ${
                isSelected
                ? 'ring-2 ring-offset-1 ring-slate-400 border-transparent bg-slate-100 shadow-sm'
                : 'border-slate-200 hover:bg-slate-50 opacity-70 hover:opacity-100'
            }`}
            >
            <div className={`w-3 h-3 rounded-full ${COLOR_MAP[m.color] || 'bg-gray-400'}`} />
            <span className="text-sm font-medium">{m.name}</span>
            </button>
        );
      })}
    </div>
  );
};

export default MemberSelector;
