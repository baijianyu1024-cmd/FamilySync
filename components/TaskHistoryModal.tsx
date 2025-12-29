
import React from 'react';
import { ToDoTask, Member } from '../types';
import { X, CheckCircle2, Circle, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { COLOR_MAP } from '../constants';

interface TaskHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: ToDoTask[];
  members: Member[];
  title: string;
}

const TaskHistoryModal: React.FC<TaskHistoryModalProps> = ({ isOpen, onClose, tasks, members, title }) => {
  if (!isOpen) return null;

  // Sort tasks by due date descending (newest first)
  const sortedTasks = [...tasks].sort((a, b) => {
      const dateA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
      const dateB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
      return dateB - dateA;
  });

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in scale-in">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-lg text-slate-800">{title}</h3>
            <p className="text-xs text-slate-500">History & Cycles</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={22} />
          </button>
        </div>

        <div className="p-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
            {sortedTasks.length === 0 ? (
                <p className="text-center text-slate-400 py-4">No history found.</p>
            ) : (
                <div className="space-y-3">
                    {sortedTasks.map(task => {
                        const assignees = members.filter(m => task.assigneeIds.includes(m.id));
                        return (
                            <div key={task.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <div className={task.isCompleted ? "text-green-500" : "text-slate-300"}>
                                    {task.isCompleted ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                        <Calendar size={12} className="text-slate-400" />
                                        {task.dueDate ? format(new Date(task.dueDate), 'MMM d, yyyy') : 'No Date'}
                                    </div>
                                    <div className={`text-xs ${task.isCompleted ? 'text-green-600 font-medium' : 'text-slate-400'}`}>
                                        {task.isCompleted ? 'Completed' : 'Pending'}
                                    </div>
                                </div>
                                <div className="flex -space-x-2">
                                    {assignees.map(member => (
                                        <div key={member.id} title={member.name} className={`w-6 h-6 rounded-full border border-white shadow-sm ${COLOR_MAP[member.color]}`}>
                                            <img src={member.avatar} className="w-full h-full rounded-full opacity-90" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
        
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
             <button onClick={onClose} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 font-bold hover:bg-slate-100 rounded-lg text-sm shadow-sm">
                Close
             </button>
        </div>
      </div>
    </div>
  );
};

export default TaskHistoryModal;
