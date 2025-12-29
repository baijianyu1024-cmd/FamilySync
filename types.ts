
export enum ViewType {
  MONTH = 'month',
  WEEK = 'week',
  AGENDA = 'agenda'
}

export enum TaskType {
  SHOPPING = 'shopping',
  CHORES = 'chores',
  GENERAL = 'general'
}

export type RecurrenceRule = 'daily' | 'weekly' | 'monthly' | null;

export interface Member {
  id: string;
  name: string;
  avatar: string; // URL or Initials
  color: string; // Tailwind color key (e.g., 'blue', 'rose')
  hex: string; // Actual hex for inline styles if needed
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  memberIds: string[]; // Changed to array
  location?: string;
  isRecurring?: boolean;
  recurringRule?: RecurrenceRule;
  recurrenceEnd?: Date;
}

export interface ToDoTask {
  id: string;
  seriesId?: string; // Links recurring instances together
  title: string;
  type: TaskType;
  assigneeIds: string[]; // Changed to array
  isCompleted: boolean;
  dueDate?: Date;
  isRecurring?: boolean;
  recurringRule?: RecurrenceRule; 
  recurrenceEnd?: Date;
}

export interface NaturalLanguageResult {
  type: 'event' | 'task';
  event?: Partial<CalendarEvent>;
  task?: Partial<ToDoTask>;
}

export interface ToolLog {
  name: string;
  args: any;
  result?: any;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  isProcessing?: boolean;
  thoughts?: string; // Chain of thought text
  toolLogs?: ToolLog[]; // Record of tools used during this turn
}
