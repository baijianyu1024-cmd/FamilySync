
import React, { useState, useMemo } from 'react';
import { ToDoTask, TaskType, Member } from '../types';
import { COLOR_MAP } from '../constants';
import { Check, Clock, Repeat, ShoppingCart, Home, List, Plus, User, Layers, CalendarDays, History, Pencil, Trash2 } from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';
import TaskHistoryModal from './TaskHistoryModal';

interface TodoViewProps {
  tasks: ToDoTask[]; // Visible tasks based on date filter
  allTasks: ToDoTask[]; // All tasks for history lookup
  members: Member[];
  selectedMemberId?: string;
  dateRangeLabel?: string;
  onToggleTask: (id: string) => void;
  onAddTask: (type: TaskType) => void;
  onEditTask?: (task: ToDoTask) => void;
  onDeleteTask?: (id: string) => void;
}

const TodoView: React.FC<TodoViewProps> = ({ 
  tasks, 
  allTasks, 
  members, 
  selectedMemberId, 
  dateRangeLabel, 
  onToggleTask, 
  onAddTask,
  onEditTask,
  onDeleteTask
}) => {
  const [activeTab, setActiveTab] = useState<TaskType | 'ALL'>('ALL');
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);

  const tabs = [
    { id: 'ALL', label: 'All', icon: Layers },
    { id: TaskType.SHOPPING, label: 'Shopping', icon: ShoppingCart },
    { id: TaskType.CHORES, label: 'Chores', icon: Home },
    { id: TaskType.GENERAL, label: 'General', icon: List },
  ];

  // 1. Filter by Tab and Member
  const filteredTasks = useMemo(() => {
      let filtered = activeTab === 'ALL' ? tasks : tasks.filter(t => t.type === activeTab);
      if (selectedMemberId) {
          filtered = filtered.filter(t => t.assigneeIds.includes(selectedMemberId));
      }
      // Initial Sort (completed last, then by date)
      return filtered.sort((a, b) => {
        if (a.isCompleted === b.isCompleted) {
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        }
        return a.isCompleted ? 1 : -1;
      });
  }, [tasks, activeTab, selectedMemberId]);

  // 2. Group by Series (Show only the latest/active card for recurring tasks)
  const displayTasks = useMemo(() => {
    const seriesSeen = new Set<string>();
    const result: ToDoTask[] = [];

    // Prioritize showing: Uncompleted first, then Latest Date.
    // However, filteredTasks is already sorted by Completion (Uncompleted first) and then Date.
    
    for (const task of filteredTasks) {
        if (task.seriesId) {
            if (!seriesSeen.has(task.seriesId)) {
                seriesSeen.add(task.seriesId);
                result.push(task);
            }
        } else {
            result.push(task);
        }
    }
    return result;
  }, [filteredTasks]);

  const handleOpenHistory = (task: ToDoTask) => {
      if (task.seriesId) {
          setSelectedSeriesId(task.seriesId);
          setHistoryModalOpen(true);
      }
  };

  // Get tasks for the history modal (all tasks with same seriesId)
  const historyTasks = useMemo(() => {
      if (!selectedSeriesId) return [];
      return allTasks.filter(t => t.seriesId === selectedSeriesId);
  }, [allTasks, selectedSeriesId]);

  const selectedSeriesTitle = useMemo(() => {
      if (!historyTasks.length) return '';
      return historyTasks[0].title;
  }, [historyTasks]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 h-full flex flex-col overflow-hidden">
      {/* Header Tabs */}
      <div className="flex border-b border-slate-100">
        {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as TaskType | 'ALL')}
                    className={`flex-1 py-4 flex items-center justify-center gap-2 font-bold text-sm transition-colors relative ${
                        isActive ? 'text-blue-600 bg-blue-50/30' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                    }`}
                >
                    <Icon size={16} />
                    {tab.label}
                    {isActive && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600" />}
                </button>
            )
        })}
      </div>

      {/* Info Bar if filtered */}
      {(selectedMemberId || dateRangeLabel) && (
          <div className="bg-blue-50 px-4 py-2 text-xs font-bold text-blue-600 flex items-center gap-3 flex-wrap">
              {dateRangeLabel && (
                  <span className="flex items-center gap-1.5 bg-white/50 px-2 py-0.5 rounded shadow-sm">
                      <CalendarDays size={12} /> {dateRangeLabel}
                  </span>
              )}
              {selectedMemberId && (
                  <span className="flex items-center gap-1.5 bg-white/50 px-2 py-0.5 rounded shadow-sm">
                      <User size={12} /> {members.find(m => m.id === selectedMemberId)?.name || 'Member'}
                  </span>
              )}
          </div>
      )}

      {/* Task List */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {displayTasks.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-300">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                    <Check size={32} />
                  </div>
                  <p>No tasks for this period!</p>
              </div>
          ) : (
            <div className="space-y-3">
                {displayTasks.map(task => {
                    const assignees = members.filter(m => task.assigneeIds.includes(m.id));
                    const isOverdue = task.dueDate && isPast(new Date(task.dueDate)) && !isToday(new Date(task.dueDate)) && !task.isCompleted;

                    return (
                        <div key={task.id} className={`group flex items-center p-3 rounded-xl border transition-all ${
                            task.isCompleted 
                                ? 'bg-slate-50 border-transparent opacity-60' 
                                : 'bg-white border-slate-100 hover:border-blue-200 hover:shadow-md'
                        }`}>
                            {/* Checkbox */}
                            <label className="checkbox-wrapper cursor-pointer relative flex items-center justify-center w-6 h-6 mr-3">
                                <input 
                                    type="checkbox" 
                                    checked={task.isCompleted} 
                                    onChange={() => onToggleTask(task.id)}
                                    className="peer appearance-none w-full h-full"
                                />
                                <div className="w-6 h-6 border-2 border-slate-300 rounded-lg flex items-center justify-center transition-colors bg-white">
                                    <Check size={14} className="text-white hidden" strokeWidth={4} />
                                </div>
                            </label>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <div className={`font-semibold text-slate-800 truncate ${task.isCompleted ? 'strikethrough text-slate-500' : ''}`}>
                                        {task.title}
                                    </div>
                                    {/* History Button for Series */}
                                    {task.seriesId && (
                                        <button 
                                            onClick={() => handleOpenHistory(task)}
                                            className="text-slate-300 hover:text-blue-500 p-1 rounded-full hover:bg-blue-50 transition-colors"
                                            title="View Cycle History"
                                        >
                                            <History size={12} />
                                        </button>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-xs">
                                    {/* Type Badge (Only in ALL view) */}
                                    {activeTab === 'ALL' && (
                                        <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase text-[10px] font-bold">
                                            {task.type}
                                        </span>
                                    )}
                                    
                                    {task.dueDate && (
                                        <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-500 font-bold' : 'text-slate-400'}`}>
                                            <Clock size={10} />
                                            {format(new Date(task.dueDate), 'MMM d')}
                                        </span>
                                    )}
                                    {task.recurringRule && (
                                        <span className="flex items-center gap-1 text-blue-500 font-medium bg-blue-50 px-1.5 rounded">
                                            <Repeat size={10} />
                                            <span className="capitalize">{task.recurringRule}</span>
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Actions & Assignees */}
                            <div className="flex items-center gap-2 ml-2">
                                {/* Edit Actions (Visible on Hover) */}
                                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                                    {onEditTask && (
                                        <button onClick={() => onEditTask(task)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                                            <Pencil size={14} />
                                        </button>
                                    )}
                                    {onDeleteTask && (
                                        <button onClick={() => onDeleteTask(task.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded">
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                                
                                <div className="flex -space-x-2">
                                    {assignees.map(assignee => (
                                        <div key={assignee.id} className="relative group/avatar hover:z-10 transition-transform hover:scale-110">
                                            <div className={`w-8 h-8 rounded-full border-2 border-white shadow-sm overflow-hidden ${COLOR_MAP[assignee.color] || 'bg-gray-400'}`} title={assignee.name}>
                                                <img src={assignee.avatar} alt={assignee.name} className="w-full h-full object-cover opacity-90" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
          )}
      </div>

      {/* Add Button */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/50">
        <button 
            onClick={() => onAddTask(activeTab === 'ALL' ? TaskType.GENERAL : activeTab)}
            className="w-full py-3 bg-white border border-slate-200 border-dashed rounded-xl text-slate-500 font-bold flex items-center justify-center gap-2 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all"
        >
            <Plus size={20} />
            Add {activeTab === 'ALL' ? 'Item' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1) + ' Item'}
        </button>
      </div>
      
      {/* History Modal */}
      <TaskHistoryModal 
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        tasks={historyTasks}
        members={members}
        title={selectedSeriesTitle}
      />
    </div>
  );
};

export default TodoView;
