
import React, { useState, useEffect } from 'react';
import { CalendarEvent, Member, RecurrenceRule } from '../types';
import MemberSelector from './MemberSelector';
import { X, Calendar, MapPin, Trash2, Check, Repeat } from 'lucide-react';
import { format } from 'date-fns';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: Partial<CalendarEvent>;
  isEditing: boolean;
  onSave: (event: Partial<CalendarEvent>) => void;
  onDelete?: (id: string) => void;
  members: Member[];
}

const EventModal: React.FC<EventModalProps> = ({ 
  isOpen, 
  onClose, 
  event, 
  isEditing, 
  onSave, 
  onDelete,
  members 
}) => {
  const [formData, setFormData] = useState<Partial<CalendarEvent>>({});

  useEffect(() => {
    if (isOpen) {
      setFormData({
          ...event,
          start: event.start || new Date(),
          end: event.end || new Date(new Date().getTime() + 60*60*1000),
          isRecurring: event.isRecurring || false,
          recurringRule: event.recurringRule || null,
          recurrenceEnd: event.recurrenceEnd || undefined,
          memberIds: event.memberIds || (members.length > 0 ? [members[0].id] : [])
      });
    }
  }, [isOpen, event, members]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!formData.title || !formData.start || !formData.end) return;
    if (!formData.memberIds || formData.memberIds.length === 0) {
        alert("Please select at least one member.");
        return;
    }
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in scale-in max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
            <Calendar size={18} className="text-blue-600" />
            {isEditing ? 'Edit Event' : 'New Event'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={22} />
          </button>
        </div>

        <div className="p-6 space-y-5">
           {/* Title Input */}
           <div className="relative">
              <input 
                type="text" 
                className="w-full text-xl font-bold border-b-2 border-slate-200 py-2 focus:border-blue-500 outline-none bg-transparent placeholder:text-slate-300" 
                placeholder="Event Title"
                autoFocus
                value={formData.title || ''}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
              />
           </div>

           {/* Date & Time */}
           <div className="grid grid-cols-2 gap-4">
              <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Starts</label>
                  <input 
                    type="datetime-local" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm focus:ring-2 ring-blue-500 outline-none" 
                    value={formData.start ? format(formData.start, "yyyy-MM-dd'T'HH:mm") : ''}
                    onChange={(e) => setFormData({...formData, start: new Date(e.target.value)})}
                  />
              </div>
              <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ends</label>
                  <input 
                    type="datetime-local" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm focus:ring-2 ring-blue-500 outline-none" 
                    value={formData.end ? format(formData.end, "yyyy-MM-dd'T'HH:mm") : ''}
                    onChange={(e) => setFormData({...formData, end: new Date(e.target.value)})}
                  />
              </div>
           </div>

           {/* Recurrence */}
           <div className="space-y-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                   <Repeat size={16} className="text-blue-500"/> Repeat
                </label>
                <select 
                   className="bg-white border border-slate-200 rounded px-2 py-1 text-sm outline-none"
                   value={formData.recurringRule || ''}
                   onChange={(e) => {
                       const val = e.target.value;
                       setFormData({
                           ...formData, 
                           recurringRule: val ? (val as RecurrenceRule) : null,
                           isRecurring: !!val
                       });
                   }}
                >
                    <option value="">Never</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                </select>
              </div>
              
              {formData.isRecurring && (
                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">End Repeat</label>
                      <input 
                        type="date" 
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm outline-none" 
                        value={formData.recurrenceEnd ? format(formData.recurrenceEnd, "yyyy-MM-dd") : ''}
                        onChange={(e) => setFormData({...formData, recurrenceEnd: new Date(e.target.value)})}
                      />
                  </div>
              )}
           </div>

           {/* Location */}
           <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Location</label>
              <div className="relative">
                <MapPin size={16} className="absolute left-3 top-3 text-slate-400" />
                <input 
                    type="text" 
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 ring-blue-500 outline-none"
                    placeholder="Where is it?"
                    value={formData.location || ''}
                    onChange={(e) => setFormData({...formData, location: e.target.value})}
                />
              </div>
           </div>

           {/* Member Assignment */}
           <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">For Who?</label>
              <MemberSelector 
                  members={members}
                  selectedMemberIds={formData.memberIds} 
                  onSelect={(ids) => setFormData({...formData, memberIds: ids})}
              />
           </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
           <div>
             {isEditing && onDelete && (
                 <button 
                    onClick={() => { onDelete(formData.id!); onClose(); }}
                    className="text-red-500 hover:bg-red-50 px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-1 transition-colors"
                 >
                    <Trash2 size={16} /> Delete
                 </button>
             )}
           </div>
           <div className="flex gap-2">
                <button onClick={onClose} className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-lg">
                    Cancel
                </button>
                <button 
                    onClick={handleSave}
                    disabled={!formData.title}
                    className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Check size={18} /> {isEditing ? 'Update' : 'Create'}
                </button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default EventModal;
