
import React, { useMemo } from 'react';
import { 
  format, 
  addDays, 
  endOfMonth, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  isToday,
  getHours,
  getMinutes,
  isWithinInterval,
  addWeeks,
  isBefore,
  isAfter
} from 'date-fns';
import { ChevronLeft, ChevronRight, MapPin, CheckSquare, Users } from 'lucide-react';
import { CalendarEvent, ViewType, Member, ToDoTask } from '../types';
import { COLOR_MAP } from '../constants';

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

const setHours = (date: Date, hours: number) => {
    const d = new Date(date);
    d.setHours(hours);
    return d;
};

interface CalendarViewProps {
  events: CalendarEvent[];
  tasks: ToDoTask[];
  members: Member[];
  viewMode: ViewType;
  currentDate: Date;
  selectedMemberId?: string; // New: Filter
  onDateChange: (date: Date) => void;
  onAddEvent: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
  onEventDrop: (eventId: string, newStart: Date) => void; // New: Drag Drop
  onFilterChange: (id: string | undefined) => void; // New: Filter Change
}

const CalendarView: React.FC<CalendarViewProps> = ({ 
  events, 
  tasks,
  members,
  viewMode, 
  currentDate, 
  selectedMemberId,
  onDateChange,
  onAddEvent,
  onEventClick,
  onEventDrop,
  onFilterChange
}) => {

  // Expand Recurring Events for the current view range
  const expandedEvents = useMemo(() => {
    let rangeStart: Date, rangeEnd: Date;
    
    // Determine the broader range needed for the view
    if (viewMode === ViewType.MONTH) {
        rangeStart = startOfWeek(startOfMonth(currentDate));
        rangeEnd = endOfWeek(endOfMonth(currentDate));
    } else if (viewMode === ViewType.WEEK) {
        rangeStart = startOfWeek(currentDate);
        rangeEnd = endOfWeek(currentDate);
    } else {
        // Agenda
        rangeStart = new Date();
        rangeStart.setHours(0,0,0,0);
        rangeEnd = addDays(rangeStart, 7);
    }

    const expanded: CalendarEvent[] = [];

    events.forEach(event => {
        // 1. Add if it's a normal non-recurring event within range
        if (!event.isRecurring) {
            if (isWithinInterval(event.start, { start: rangeStart, end: rangeEnd }) || 
                isWithinInterval(event.end, { start: rangeStart, end: rangeEnd })) {
                expanded.push(event);
            }
            return;
        }

        // 2. Expand recurring events
        const rule = event.recurringRule;
        const recurrenceEnd = event.recurrenceEnd ? new Date(event.recurrenceEnd) : addMonths(rangeEnd, 1); // Cap infinite loops
        
        let currentInstanceStart = new Date(event.start);
        const duration = event.end.getTime() - event.start.getTime();

        // Safety Break
        let count = 0;
        
        while (count < 365) { // Safety limit for instances
             // Stop if we passed the recurrence end date
             if (event.recurrenceEnd && isAfter(currentInstanceStart, recurrenceEnd)) break;
             
             // Stop if we passed the view range (with buffer)
             if (isAfter(currentInstanceStart, rangeEnd)) break;

             // Add if within view range
             if (!isBefore(currentInstanceStart, rangeStart)) {
                 expanded.push({
                     ...event,
                     id: `${event.id}_inst_${count}`, // Virtual ID for instances
                     start: new Date(currentInstanceStart),
                     end: new Date(currentInstanceStart.getTime() + duration)
                 });
             }

             // Next Instance
             if (rule === 'daily') currentInstanceStart = addDays(currentInstanceStart, 1);
             else if (rule === 'weekly') currentInstanceStart = addWeeks(currentInstanceStart, 1);
             else if (rule === 'monthly') currentInstanceStart = addMonths(currentInstanceStart, 1);
             else break; 
             
             count++;
        }
    });

    return expanded;
  }, [events, viewMode, currentDate]);

  // Filter Data
  const filteredEvents = useMemo(() => {
    return selectedMemberId 
        ? expandedEvents.filter(e => e.memberIds.includes(selectedMemberId))
        : expandedEvents;
  }, [expandedEvents, selectedMemberId]);

  const filteredTasks = useMemo(() => {
    return selectedMemberId 
        ? tasks.filter(t => t.assigneeIds.includes(selectedMemberId))
        : tasks;
  }, [tasks, selectedMemberId]);

  const getEventStyle = (memberIds: string[]) => {
      // Find members
      const involvedMembers = members.filter(m => memberIds.includes(m.id));
      
      if (involvedMembers.length === 0) {
          return { className: 'bg-gray-100 text-gray-800 border-gray-200 border' };
      }

      if (involvedMembers.length === 1) {
          // Single member style
          const colorKey = involvedMembers[0].color;
          // Map to light tailwind classes manually or construct
          // Using inline style for robustness if needed, but classes are cleaner
          // Let's use a mapping approach or return inline styles for colors
          const baseColor = involvedMembers[0].hex;
          return { 
              style: { 
                  backgroundColor: `${baseColor}20`, // 12% opacity roughly 
                  color: baseColor,
                  borderColor: `${baseColor}50`
              },
              className: 'border'
          };
      } else {
          // Multi member gradient
          const gradientColors = involvedMembers.map(m => m.hex).join(', ');
          return {
              style: {
                  background: `linear-gradient(135deg, ${gradientColors})`,
                  color: 'white',
              },
              className: 'text-shadow-sm'
          };
      }
  };

  // --- Drag and Drop Handlers ---
  const handleDragStart = (e: React.DragEvent, eventId: string) => {
    if (eventId.includes('_inst_')) {
        e.preventDefault();
        return;
    }
    e.dataTransfer.setData("eventId", eventId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, date: Date) => {
    e.preventDefault();
    const eventId = e.dataTransfer.getData("eventId");
    if (eventId) {
      onEventDrop(eventId, date);
    }
  };

  // --- Header Controls ---
  const renderHeader = () => {
    const dateFormat = viewMode === ViewType.MONTH ? "MMMM yyyy" : "MMMM yyyy";
    
    const next = () => {
      if (viewMode === ViewType.MONTH) onDateChange(addMonths(currentDate, 1));
      else onDateChange(addDays(currentDate, 7));
    };
    
    const prev = () => {
      if (viewMode === ViewType.MONTH) onDateChange(addMonths(currentDate, -1)); 
      else onDateChange(addDays(currentDate, -7));
    };

    return (
      <div className="flex flex-col gap-4 mb-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-800">
            {format(currentDate, dateFormat)}
            </h2>
            <div className="flex items-center gap-2">
            <button onClick={() => onDateChange(new Date())} className="text-sm font-semibold text-blue-600 hover:bg-blue-50 px-3 py-1 rounded">Today</button>
            <button onClick={prev} className="p-1 hover:bg-slate-200 rounded-full"><ChevronLeft className="w-6 h-6" /></button>
            <button onClick={next} className="p-1 hover:bg-slate-200 rounded-full"><ChevronRight className="w-6 h-6" /></button>
            </div>
          </div>
          
          {/* Member Filter Bar */}
          <div className="flex items-center gap-2 overflow-x-auto p-1 custom-scrollbar">
             <button 
                onClick={() => onFilterChange(undefined)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors whitespace-nowrap ${!selectedMemberId ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
             >
                All Family
             </button>
             {members.map(m => (
                 <button
                    key={m.id}
                    onClick={() => onFilterChange(m.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-colors whitespace-nowrap ${selectedMemberId === m.id ? 'ring-2 ring-blue-500 border-transparent bg-white' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                 >
                    <div className={`w-2 h-2 rounded-full ${COLOR_MAP[m.color]}`} />
                    <span className="text-xs font-semibold">{m.name}</span>
                 </button>
             ))}
          </div>
      </div>
    );
  };

  // --- Month View ---
  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const rows = [];
    let days = [];
    let day = startDate;
    let formattedDate = "";

    while (day <= endDate) {
      for (let i = 7; i > 0; i--) {
        if (days.length === 7) break;
        formattedDate = format(day, "d");
        const cloneDay = day;
        
        const dayEvents = filteredEvents.filter(e => isSameDay(e.start, cloneDay));
        const dayTasks = filteredTasks.filter(t => t.dueDate && isSameDay(new Date(t.dueDate), cloneDay) && !t.isCompleted);
        const isCurrentMonth = isSameMonth(day, monthStart);
        
        days.push(
          <div
            key={day.toString()}
            className={`min-h-[100px] border border-slate-100 p-1 relative group cursor-pointer hover:bg-slate-50 transition-colors ${!isCurrentMonth ? "bg-slate-50/50 text-slate-400" : "bg-white"}`}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, cloneDay)}
            onClick={(e) => {
                if(e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('day-number')) {
                    const d = new Date(cloneDay);
                    d.setHours(9, 0, 0, 0);
                    onAddEvent(d);
                }
            }}
          >
            <div className={`day-number text-right font-semibold mb-1 ${isToday(day) ? "text-blue-600" : ""}`}>
              {isToday(day) ? <span className="bg-blue-100 px-1.5 rounded-full">{formattedDate}</span> : formattedDate}
            </div>
            
            <div className="flex flex-col gap-1 overflow-hidden">
              {dayTasks.map(t => (
                  <div key={t.id} className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-slate-500 bg-slate-100 rounded border border-slate-200 truncate">
                      <CheckSquare size={10} /> {t.title}
                  </div>
              ))}
              {dayEvents.slice(0, 4).map(e => {
                 const styleProps = getEventStyle(e.memberIds);
                 return (
                 <div 
                    key={e.id} 
                    draggable={!e.id.includes('_inst_')}
                    onDragStart={(ev) => handleDragStart(ev, e.id)}
                    onClick={(ev) => {
                        ev.stopPropagation();
                        onEventClick(e); 
                    }}
                    className={`text-xs px-1.5 py-0.5 rounded truncate font-medium text-left w-full cursor-move hover:brightness-90 transition-all ${e.id.includes('_inst_') ? 'opacity-80 border-dashed' : ''} ${styleProps.className}`}
                    style={styleProps.style}
                 >
                   <span>{e.title}</span>
                   {e.location && <span className="opacity-75 ml-1 font-normal text-[10px] inline-flex items-center gap-0.5"><MapPin size={8} className="inline" /> {e.location}</span>}
                 </div>
              )})}
              {dayEvents.length > 4 && (
                <div className="text-xs text-slate-500 font-medium pl-1">
                  +{dayEvents.length - 4} more
                </div>
              )}
            </div>
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div className="grid grid-cols-7" key={day.toString()}>
          {days}
        </div>
      );
      days = [];
    }

    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-full flex flex-col">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 flex-none">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="py-2 text-center font-bold text-slate-500 text-sm uppercase tracking-wider">
              {d}
            </div>
          ))}
        </div>
        <div className="overflow-y-auto flex-1 custom-scrollbar">
           {rows}
        </div>
      </div>
    );
  };

  // --- Week View ---
  const renderWeekView = () => {
    const startDate = startOfWeek(currentDate);
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startDate, i));
    const hours = Array.from({ length: 24 }, (_, i) => i);
    
    const now = new Date();
    const currentMinutes = getHours(now) * 60 + getMinutes(now);
    
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
        {/* Header */}
        <div className="grid grid-cols-8 border-b border-slate-200 bg-slate-50 flex-none">
           <div className="py-3 text-center text-xs text-slate-400">Time</div>
           {weekDays.map(day => (
             <div key={day.toString()} className={`py-2 text-center border-l border-slate-100 ${isToday(day) ? 'bg-blue-50/50' : ''}`}>
               <div className={`text-xs font-bold uppercase tracking-wider ${isToday(day) ? 'text-blue-600' : 'text-slate-500'}`}>{format(day, 'EEE')}</div>
               <div className={`text-xl font-bold ${isToday(day) ? 'text-blue-600' : 'text-slate-700'}`}>{format(day, 'd')}</div>
               
               {/* Daily Task Summary */}
               <div className="min-h-[20px] px-1">
                   {filteredTasks.filter(t => t.dueDate && isSameDay(new Date(t.dueDate), day) && !t.isCompleted).length > 0 && (
                       <div className="text-[10px] bg-yellow-100 text-yellow-800 rounded px-1 py-0.5 mt-1 truncate">
                           {filteredTasks.filter(t => t.dueDate && isSameDay(new Date(t.dueDate), day)).length} Tasks
                       </div>
                   )}
               </div>
             </div>
           ))}
        </div>

        {/* Scrollable Grid */}
        <div className="overflow-y-auto flex-1 relative custom-scrollbar">
            <div className="grid grid-cols-8 relative">
                <div className="col-span-1 border-r border-slate-100 bg-slate-50">
                    {hours.map(h => (
                        <div key={h} className="h-14 text-xs text-slate-400 text-right pr-2 pt-1 relative">
                            {format(setHours(new Date(), h), 'ha')}
                        </div>
                    ))}
                </div>
                
                {weekDays.map((day, dayIdx) => (
                    <div key={day.toString()} className="col-span-1 border-r border-slate-100 relative group">
                        {hours.map(h => (
                             <div 
                                key={h} 
                                className="h-14 border-b border-slate-50 hover:bg-slate-50 cursor-pointer"
                                onDragOver={handleDragOver}
                                onDrop={(e) => {
                                    const dropTime = new Date(day);
                                    dropTime.setHours(h);
                                    handleDrop(e, dropTime);
                                }}
                                onClick={() => {
                                    const clickTime = new Date(day);
                                    clickTime.setHours(h);
                                    onAddEvent(clickTime);
                                }}
                             ></div>
                        ))}

                        {/* Events */}
                        {filteredEvents
                            .filter(e => isSameDay(e.start, day))
                            .map(e => {
                                const startMin = getHours(e.start) * 60 + getMinutes(e.start);
                                const endMin = getHours(e.end) * 60 + getMinutes(e.end);
                                const duration = Math.max(endMin - startMin, 30);
                                const top = (startMin / 60) * 3.5; 
                                const height = (duration / 60) * 3.5;
                                const styleProps = getEventStyle(e.memberIds);

                                return (
                                    <div 
                                        key={e.id}
                                        draggable={!e.id.includes('_inst_')}
                                        onDragStart={(ev) => handleDragStart(ev, e.id)}
                                        onClick={(ev) => {
                                            ev.stopPropagation();
                                            onEventClick(e);
                                        }}
                                        className={`absolute left-0.5 right-0.5 rounded p-1 text-xs overflow-hidden shadow-sm cursor-move hover:brightness-95 z-10 transition-all ${e.id.includes('_inst_') ? 'opacity-90 border-dashed border' : ''} ${styleProps.className}`}
                                        style={{ top: `${top}rem`, height: `${height}rem`, ...styleProps.style }}
                                    >
                                        <div className="font-bold truncate leading-tight">{e.title}</div>
                                        <div className="flex flex-wrap items-center gap-1 opacity-90 text-[10px] leading-tight mt-0.5">
                                           <span>{format(e.start, 'h:mm')}</span>
                                           {e.location && (
                                              <>
                                                <span>•</span>
                                                <span className="truncate flex-1 flex items-center gap-0.5"><MapPin size={8} /> {e.location}</span>
                                              </>
                                           )}
                                        </div>
                                    </div>
                                )
                            })
                        }
                        
                         {isToday(day) && (
                            <div 
                                className="absolute left-0 right-0 border-t-2 border-red-500 z-20 pointer-events-none"
                                style={{ top: `${(currentMinutes / 60) * 3.5}rem` }}
                            >
                                <div className="w-2 h-2 bg-red-500 rounded-full -mt-1.5 -ml-1"></div>
                            </div>
                         )}
                    </div>
                ))}
            </div>
        </div>
      </div>
    );
  };

  // --- Agenda View ---
  const renderAgendaView = () => {
    const today = new Date();
    const agendaDays = [0, 1, 2].map(offset => addDays(today, offset));
    
    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-full flex flex-col">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex-none">
                <h3 className="font-bold text-slate-700">Next 3 Days</h3>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-6 custom-scrollbar">
                {agendaDays.map(day => {
                    const dayEvents = filteredEvents.filter(e => isSameDay(e.start, day)).sort((a,b) => a.start.getTime() - b.start.getTime());
                    const dayTasks = filteredTasks.filter(t => t.dueDate && isSameDay(new Date(t.dueDate), day));

                    return (
                        <div key={day.toString()}>
                             <h4 className={`font-bold text-lg mb-3 flex items-center gap-2 ${isToday(day) ? 'text-blue-600' : 'text-slate-800'}`}>
                                {isToday(day) ? 'Today' : format(day, 'EEEE')} 
                                <span className="text-sm font-normal text-slate-500">{format(day, 'MMM d')}</span>
                             </h4>
                             
                             {dayEvents.length === 0 && dayTasks.length === 0 ? (
                                 <p className="text-slate-400 italic text-sm pl-4">No events or tasks</p>
                             ) : (
                                 <div className="space-y-2 pl-2 border-l-2 border-slate-100">
                                     {dayTasks.map(t => (
                                         <div key={t.id} className="flex gap-4 items-center bg-yellow-50/50 p-2 rounded-lg border border-yellow-100">
                                             <div className="w-14 flex justify-center"><CheckSquare size={16} className="text-yellow-600"/></div>
                                             <div className="flex-1 text-sm font-medium text-slate-700">{t.title}</div>
                                             {/* Avatars for task */}
                                             <div className="flex -space-x-1.5">
                                                 {t.assigneeIds.map(mid => {
                                                     const m = members.find(mem => mem.id === mid);
                                                     if(!m) return null;
                                                     return (
                                                         <img key={mid} src={m.avatar} className="w-5 h-5 rounded-full border border-white" title={m.name} />
                                                     )
                                                 })}
                                             </div>
                                         </div>
                                     ))}

                                     {dayEvents.map(e => {
                                        const involvedMembers = members.filter(m => e.memberIds.includes(m.id));
                                        return (
                                            <div 
                                                key={e.id} 
                                                onClick={() => onEventClick(e)}
                                                className="flex gap-4 items-center bg-slate-50 p-3 rounded-lg hover:bg-white hover:shadow-md transition-all border border-transparent hover:border-slate-100 cursor-pointer"
                                            >
                                                <div className="flex flex-col items-center w-14 text-slate-600">
                                                    <span className="text-xs font-bold">{format(e.start, 'h:mm')}</span>
                                                    <span className="text-[10px] uppercase">{format(e.start, 'a')}</span>
                                                </div>
                                                
                                                {involvedMembers.length > 1 ? (
                                                    <div className="w-1 h-8 rounded-full bg-slate-400"></div>
                                                ) : (
                                                    <div className={`w-1 h-8 rounded-full ${involvedMembers[0] ? COLOR_MAP[involvedMembers[0].color] : 'bg-gray-400'}`}></div>
                                                )}

                                                <div className="flex-1">
                                                    <div className="font-bold text-slate-800">{e.title}</div>
                                                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                                                        {e.location && <span className="flex items-center gap-1"><MapPin size={10} /> {e.location}</span>}
                                                        
                                                        <div className="flex items-center -space-x-1">
                                                            {involvedMembers.map(m => (
                                                                <img key={m.id} src={m.avatar} alt={m.name} className="w-4 h-4 rounded-full border border-white" />
                                                            ))}
                                                            <span className="ml-2 text-[10px] text-slate-400">
                                                                {involvedMembers.map(m => m.name).join(', ')}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                     })}
                                 </div>
                             )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {renderHeader()}
      <div className="flex-1 overflow-hidden">
        {viewMode === ViewType.MONTH && renderMonthView()}
        {viewMode === ViewType.WEEK && renderWeekView()}
        {viewMode === ViewType.AGENDA && renderAgendaView()}
      </div>
    </div>
  );
};

export default CalendarView;
