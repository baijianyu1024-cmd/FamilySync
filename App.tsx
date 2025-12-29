
import React, { useState, useMemo } from 'react';
import { Calendar as CalendarIcon, Settings } from 'lucide-react';
import { 
    format, 
    endOfMonth, 
    endOfWeek, 
    addDays, 
    isWithinInterval, 
    isSameDay, 
    addWeeks,
    addMonths,
    isAfter
} from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

import CalendarView from './components/CalendarView';
import TodoView from './components/TodoView';
import MemberSelector from './components/MemberSelector';
import SettingsModal from './components/SettingsModal';
import EventModal from './components/EventModal';
import AIAssistant from './components/AIAssistant';

import { 
    CalendarEvent, 
    ToDoTask, 
    ViewType, 
    TaskType,
    Member,
    RecurrenceRule
} from './types';

import { 
    INITIAL_EVENTS, 
    INITIAL_TASKS, 
    FAMILY_MEMBERS,
    COLOR_MAP,
    HEX_MAP
} from './constants';

// Helpers for missing date-fns exports
const startOfWeek = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
};

const startOfMonth = (date: Date) => {
    const d = new Date(date);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
};

function App() {
  // --- Global State ---
  const [members, setMembers] = useState<Member[]>(FAMILY_MEMBERS);
  const [events, setEvents] = useState<CalendarEvent[]>(INITIAL_EVENTS);
  const [tasks, setTasks] = useState<ToDoTask[]>(INITIAL_TASKS);
  
  // --- View State ---
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState<ViewType>(ViewType.WEEK);
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string | undefined>(undefined);
  
  // --- Modal States ---
  const [showSettings, setShowSettings] = useState(false);
  const [eventModalState, setEventModalState] = useState<{isOpen: boolean, isEditing: boolean, event: Partial<CalendarEvent>}>({
      isOpen: false,
      isEditing: false,
      event: {}
  });
  
  // Updated Task Modal State to support Editing
  const [taskModalState, setTaskModalState] = useState<{isOpen: boolean, isEditing: boolean, task: Partial<ToDoTask>}>({
      isOpen: false,
      isEditing: false,
      task: {}
  });

  // --- Handlers: Calendar ---

  const handleAddEvent = (eventData: Partial<CalendarEvent>) => {
     const newEvent: CalendarEvent = {
         id: uuidv4(),
         title: eventData.title || 'New Event',
         start: eventData.start || new Date(),
         end: eventData.end || new Date(new Date().getTime() + 3600000),
         location: eventData.location || '',
         memberIds: eventData.memberIds || (members.length > 0 ? [members[0].id] : []),
         isRecurring: eventData.isRecurring,
         recurringRule: eventData.recurringRule,
         recurrenceEnd: eventData.recurrenceEnd
     };
     setEvents(prev => [...prev, newEvent]);
  };

  const handleUpdateEvent = (id: string, updates: Partial<CalendarEvent>) => {
      // If updating a virtual instance (contains _inst_), we currently do nothing or need advanced logic.
      if (id.includes('_inst_')) return; 

      setEvents(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
  };

  const handleDeleteEvent = (id: string) => {
      setEvents(prev => prev.filter(e => e.id !== id));
  };

  const handleEventDrop = (eventId: string, newStart: Date) => {
      // Prevent drag drop of virtual instances
      if (eventId.includes('_inst_')) return;

      const event = events.find(e => e.id === eventId);
      if (event) {
          // Calculate duration to preserve it
          const duration = event.end.getTime() - event.start.getTime();
          const newEnd = new Date(newStart.getTime() + duration);
          handleUpdateEvent(eventId, { start: newStart, end: newEnd });
      }
  };

  // --- Handlers: ToDo ---

  const handleAddTask = (taskData: Partial<ToDoTask>) => {
      if(!taskData.assigneeIds || taskData.assigneeIds.length === 0) {
          alert("A task must be assigned to at least one family member.");
          return;
      }
      
      const newId = uuidv4();
      const newTask: ToDoTask = {
          id: newId,
          seriesId: taskData.recurringRule ? (taskData.seriesId || newId) : undefined,
          title: taskData.title || 'New Task',
          type: taskData.type || TaskType.GENERAL,
          isCompleted: false,
          assigneeIds: taskData.assigneeIds,
          dueDate: taskData.dueDate,
          isRecurring: !!taskData.recurringRule,
          recurringRule: taskData.recurringRule as RecurrenceRule,
          recurrenceEnd: taskData.recurrenceEnd
      };
      setTasks(prev => [...prev, newTask]);
  };

  const handleUpdateTask = (id: string, updates: Partial<ToDoTask>) => {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const handleDeleteTask = (id: string) => {
      setTasks(prev => prev.filter(t => t.id !== id));
  };

  const handleToggleTask = (id: string) => {
      const task = tasks.find(t => t.id === id);
      if(!task) return;

      const newStatus = !task.isCompleted;
      
      // If task is recurring and we are completing it, create the next instance
      if (newStatus === true && task.recurringRule && task.dueDate) {
          let nextDate = new Date(task.dueDate);
          
          if (task.recurringRule === 'daily') {
              nextDate = addDays(nextDate, 1);
          } else if (task.recurringRule === 'weekly') {
              nextDate = addWeeks(nextDate, 1);
          } else if (task.recurringRule === 'monthly') {
              nextDate = addMonths(nextDate, 1);
          }

          // Check Recurrence End
          if (!task.recurrenceEnd || !isAfter(nextDate, new Date(task.recurrenceEnd))) {
              const nextTask: ToDoTask = {
                ...task,
                id: uuidv4(),
                seriesId: task.seriesId || task.id, 
                dueDate: nextDate,
                isCompleted: false
              };
              setTasks(prev => [...prev, nextTask]);
          }
      }

      handleUpdateTask(id, { isCompleted: newStatus });
  };

  // --- Handlers: Members ---
  
  const handleUpdateMembers = (updatedMembers: Member[]) => {
      setMembers(updatedMembers);
      // Clean up filters if the selected member was deleted
      if (selectedMemberFilter && !updatedMembers.find(m => m.id === selectedMemberFilter)) {
          setSelectedMemberFilter(undefined);
      }
  };

  const handleAddMember = (name: string, color?: string) => {
      // Determine color
      let colorToUse = color;
      if (!colorToUse || !COLOR_MAP[colorToUse]) {
          const usedColors = members.map(m => m.color);
          const availableColors = Object.keys(COLOR_MAP).filter(c => !usedColors.includes(c));
          colorToUse = availableColors.length > 0 
            ? availableColors[0] 
            : Object.keys(COLOR_MAP)[Math.floor(Math.random() * Object.keys(COLOR_MAP).length)];
      }

      const newMember: Member = {
          id: uuidv4(),
          name,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
          color: colorToUse,
          hex: HEX_MAP[colorToUse] || '#cccccc'
      };
      setMembers(prev => [...prev, newMember]);
  };

  const handleUpdateMember = (id: string, updates: Partial<Member>) => {
      setMembers(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
  };

  const handleDeleteMember = (id: string) => {
      setMembers(prev => prev.filter(m => m.id !== id));
      if (selectedMemberFilter === id) setSelectedMemberFilter(undefined);
  };

  // --- Filter Logic ---
  const { visibleTasks, dateRangeLabel } = useMemo(() => {
    let start: Date, end: Date, label: string;

    if (calendarView === ViewType.MONTH) {
        start = startOfMonth(currentDate);
        end = endOfMonth(currentDate);
        label = format(currentDate, 'MMMM yyyy');
    } else if (calendarView === ViewType.WEEK) {
        start = startOfWeek(currentDate);
        end = endOfWeek(currentDate);
        label = `Week of ${format(start, 'MMM d')}`;
    } else {
        // Agenda - Next 3 days
        start = new Date(); // Today
        start.setHours(0,0,0,0);
        end = addDays(start, 3);
        label = 'Next 3 Days';
    }

    const filtered = tasks.filter(t => {
        // 1. Always show tasks without a due date (Backlog)
        if (!t.dueDate) return true;
        
        const due = new Date(t.dueDate);
        
        // 2. Show if within range
        const inRange = isWithinInterval(due, { start, end });
        if (inRange) return true;

        // 3. Show if overdue (due date < start date) AND not completed
        if (due < start && !t.isCompleted) return true;

        return false;
    });

    return { visibleTasks: filtered, dateRangeLabel: label };
  }, [tasks, currentDate, calendarView]);

  // --- Render Task Modal ---
  const renderTaskModal = () => {
    if (!taskModalState.isOpen) return null;
    
    const isEdit = taskModalState.isEditing;
    const data = taskModalState.task;
    
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in max-h-[90vh] overflow-y-auto">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-slate-800">{isEdit ? 'Edit Task' : 'New Task'}</h3>
                    <button onClick={() => setTaskModalState({ ...taskModalState, isOpen: false })} className="text-slate-400 hover:text-slate-600">✕</button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Title</label>
                        <input 
                            type="text" 
                            className="w-full border rounded-lg p-2 focus:ring-2 ring-blue-500 outline-none" 
                            autoFocus
                            value={data.title || ''}
                            onChange={(e) => setTaskModalState({...taskModalState, task: {...data, title: e.target.value}})}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Type</label>
                        <div className="flex gap-2">
                            {[TaskType.SHOPPING, TaskType.CHORES, TaskType.GENERAL].map(t => (
                                <button 
                                    key={t}
                                    onClick={() => setTaskModalState({...taskModalState, task: {...data, type: t}})}
                                    className={`px-3 py-1 rounded-full text-xs font-bold capitalize border ${data.type === t ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-white border-slate-200'}`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Assign To <span className="text-red-500">*</span></label>
                        <MemberSelector 
                            members={members}
                            selectedMemberIds={data.assigneeIds} 
                            onSelect={(ids) => setTaskModalState({...taskModalState, task: {...data, assigneeIds: ids}})}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Due Date</label>
                            <input type="date" className="w-full border rounded-lg p-2 text-sm" 
                                value={data.dueDate ? format(new Date(data.dueDate), 'yyyy-MM-dd') : ''}
                                onChange={(e) => setTaskModalState({...taskModalState, task: {...data, dueDate: new Date(e.target.value)}})}
                            />
                        </div>
                        <div>
                             <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Repeat</label>
                             <select 
                                className="w-full border rounded-lg p-2 text-sm bg-white"
                                value={data.recurringRule || ''}
                                onChange={(e) => setTaskModalState({...taskModalState, task: {...data, recurringRule: e.target.value as RecurrenceRule || null}})}
                             >
                                 <option value="">Never</option>
                                 <option value="daily">Daily</option>
                                 <option value="weekly">Weekly</option>
                                 <option value="monthly">Monthly</option>
                             </select>
                        </div>
                    </div>
                    {data.recurringRule && (
                        <div>
                             <label className="block text-xs font-bold text-slate-500 uppercase mb-1">End Repeat</label>
                             <input type="date" className="w-full border rounded-lg p-2 text-sm" 
                                value={data.recurrenceEnd ? format(new Date(data.recurrenceEnd), 'yyyy-MM-dd') : ''}
                                onChange={(e) => setTaskModalState({...taskModalState, task: {...data, recurrenceEnd: new Date(e.target.value)}})}
                             />
                        </div>
                    )}
                </div>
                <div className="p-4 bg-slate-50 flex justify-end gap-2">
                    <button onClick={() => setTaskModalState({ ...taskModalState, isOpen: false })} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg">Cancel</button>
                    <button 
                        onClick={() => {
                            if (!data.assigneeIds || data.assigneeIds.length === 0) {
                                alert("Please select at least one family member.");
                                return;
                            }
                            if (isEdit && data.id) {
                                handleUpdateTask(data.id, data);
                            } else {
                                handleAddTask(data);
                            }
                            setTaskModalState({ ...taskModalState, isOpen: false });
                        }}
                        className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-md"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col bg-slate-100">
      {/* Top Navigation / Dashboard Header */}
      <header className="flex-none bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm z-20">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-white p-2 rounded-lg">
             <CalendarIcon size={24} />
          </div>
          <div>
              <h1 className="text-xl font-black text-slate-800 tracking-tight">FamilySync</h1>
              <p className="text-xs text-slate-500 font-medium">{format(new Date(), 'EEEE, MMMM do')}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
            {/* View Switcher */}
            <div className="bg-slate-100 p-1 rounded-lg flex text-sm font-semibold">
                {[ViewType.MONTH, ViewType.WEEK, ViewType.AGENDA].map((v) => (
                    <button
                        key={v}
                        onClick={() => setCalendarView(v)}
                        className={`px-3 py-1.5 rounded-md capitalize transition-all ${calendarView === v ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        {v}
                    </button>
                ))}
            </div>
            
            <button 
                onClick={() => setShowSettings(true)}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-blue-600 transition-colors"
            >
                <Settings size={20} />
            </button>
        </div>
      </header>

      {/* Main Content Dashboard Grid */}
      <main className="flex-1 overflow-hidden p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 relative">
        
        {/* Left Panel: Unified Calendar */}
        <section className="lg:col-span-8 h-full flex flex-col min-h-[400px]">
           <CalendarView 
                events={events}
                tasks={tasks} // Pass tasks for Week View header summary
                members={members}
                viewMode={calendarView}
                currentDate={currentDate}
                selectedMemberId={selectedMemberFilter}
                onDateChange={setCurrentDate}
                onAddEvent={(date) => {
                    setEventModalState({ isOpen: true, isEditing: false, event: { start: date, end: new Date(date.getTime() + 3600000), memberIds: selectedMemberFilter ? [selectedMemberFilter] : [] } });
                }}
                onEventClick={(event) => {
                    setEventModalState({ isOpen: true, isEditing: true, event: event });
                }}
                onEventDrop={handleEventDrop}
                onFilterChange={setSelectedMemberFilter}
           />
        </section>

        {/* Right Panel: Smart To-Do */}
        <section className="lg:col-span-4 h-full min-h-[400px]">
           <TodoView 
                tasks={visibleTasks} 
                allTasks={tasks} // Pass ALL tasks for history lookup
                members={members}
                selectedMemberId={selectedMemberFilter}
                dateRangeLabel={dateRangeLabel}
                onToggleTask={handleToggleTask}
                onAddTask={(type) => {
                    setTaskModalState({ isOpen: true, isEditing: false, task: { type, assigneeIds: selectedMemberFilter ? [selectedMemberFilter] : [] } });
                }}
                onEditTask={(task) => {
                    setTaskModalState({ isOpen: true, isEditing: true, task: task });
                }}
                onDeleteTask={handleDeleteTask}
           />
        </section>

      </main>

      {/* Modals & Overlays */}
      {renderTaskModal()}
      
      <EventModal 
        isOpen={eventModalState.isOpen}
        isEditing={eventModalState.isEditing}
        event={eventModalState.event}
        members={members}
        onClose={() => setEventModalState(prev => ({ ...prev, isOpen: false }))}
        onSave={(data) => {
            if (eventModalState.isEditing && eventModalState.event.id) {
                handleUpdateEvent(eventModalState.event.id, data);
            } else {
                handleAddEvent(data);
            }
        }}
        onDelete={handleDeleteEvent}
      />

      {showSettings && (
        <SettingsModal 
            members={members}
            onUpdateMembers={handleUpdateMembers}
            onClose={() => setShowSettings(false)}
        />
      )}

      {/* Floating AI Assistant */}
      <AIAssistant 
        members={members}
        events={events}
        tasks={tasks}
        onAddEvent={handleAddEvent}
        onUpdateEvent={handleUpdateEvent}
        onDeleteEvent={handleDeleteEvent}
        onAddTask={handleAddTask}
        onUpdateTask={handleUpdateTask}
        onDeleteTask={handleDeleteTask}
        onAddMember={handleAddMember}
        onUpdateMember={handleUpdateMember}
        onDeleteMember={handleDeleteMember}
      />

    </div>
  );
}

export default App;
