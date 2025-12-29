
import React, { useState } from 'react';
import { Member } from '../types';
import { COLOR_MAP, HEX_MAP } from '../constants';
import { X, Plus, Trash2, Save, User } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface SettingsModalProps {
  members: Member[];
  onUpdateMembers: (members: Member[]) => void;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ members, onUpdateMembers, onClose }) => {
  const [localMembers, setLocalMembers] = useState<Member[]>(members);
  const [newMemberName, setNewMemberName] = useState('');

  const handleAddMember = () => {
    if (!newMemberName.trim()) return;
    
    // Find a color that isn't used
    const usedColors = localMembers.map(m => m.color);
    const availableColors = Object.keys(COLOR_MAP).filter(c => !usedColors.includes(c));
    // If all colors used, recycle random, otherwise use first available
    const colorToUse = availableColors.length > 0 
        ? availableColors[0] 
        : Object.keys(COLOR_MAP)[Math.floor(Math.random() * Object.keys(COLOR_MAP).length)];

    const newMember: Member = {
      id: uuidv4(),
      name: newMemberName,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${newMemberName}`,
      color: colorToUse,
      hex: HEX_MAP[colorToUse] || '#cccccc' 
    };
    setLocalMembers([...localMembers, newMember]);
    setNewMemberName('');
  };

  const handleDeleteMember = (id: string) => {
    // Functional update ensures we are working with the latest state.
    // Removed window.confirm to prevent browser blocking; user can hit 'Cancel' on modal to revert.
    setLocalMembers(prev => prev.filter(m => m.id !== id));
  };

  const handleUpdateMemberName = (id: string, name: string) => {
    setLocalMembers(localMembers.map(m => m.id === id ? { ...m, name } : m));
  };

  const handleSave = () => {
    onUpdateMembers(localMembers);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2">
            <User size={20} /> Family Settings
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Manage Members</h4>
          
          <div className="space-y-3">
            {localMembers.map((member) => (
              <div key={member.id} className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-200">
                <img src={member.avatar} alt={member.name} className="w-10 h-10 rounded-full border-2 border-white shadow-sm" />
                <div className="flex-1">
                   <input 
                      type="text" 
                      value={member.name}
                      onChange={(e) => handleUpdateMemberName(member.id, e.target.value)}
                      className="w-full bg-transparent font-semibold text-slate-700 focus:bg-white focus:ring-2 ring-blue-500 rounded px-2 py-1 outline-none"
                   />
                </div>
                <div className={`w-6 h-6 rounded-full ${COLOR_MAP[member.color]} border-2 border-white shadow-sm`} title={member.color}></div>
                <button 
                  type="button"
                  onClick={() => handleDeleteMember(member.id)}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-6 flex gap-2">
             <input 
                type="text" 
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                placeholder="New member name..."
                className="flex-1 border border-slate-300 rounded-xl px-4 py-2 outline-none focus:border-blue-500"
                onKeyDown={(e) => e.key === 'Enter' && handleAddMember()}
             />
             <button 
                onClick={handleAddMember}
                disabled={!newMemberName.trim()}
                className="bg-slate-800 text-white px-4 py-2 rounded-xl font-bold hover:bg-slate-700 disabled:opacity-50"
             >
                <Plus size={20} />
             </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-200 rounded-xl">
            Cancel
          </button>
          <button onClick={handleSave} className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-md flex items-center gap-2">
            <Save size={18} /> Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
