
import { Member, CalendarEvent, ToDoTask, TaskType } from './types';
import { addDays } from 'date-fns';

export const FAMILY_MEMBERS: Member[] = [
  { id: 'm1', name: 'Mom', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mom', color: 'rose', hex: '#fb7185' },
  { id: 'm2', name: 'Dad', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Dad', color: 'blue', hex: '#60a5fa' },
  { id: 'm3', name: 'Leo', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Leo', color: 'green', hex: '#4ade80' },
  { id: 'm4', name: 'Mia', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mia', color: 'purple', hex: '#c084fc' },
];

const getToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}

const setTime = (date: Date, hours: number) => {
    const d = new Date(date);
    d.setHours(hours, 0, 0, 0);
    return d;
}

const today = getToday();

export const INITIAL_EVENTS: CalendarEvent[] = [
  {
    id: 'e1',
    title: 'Yoga Class',
    start: setTime(today, 9),
    end: setTime(today, 10),
    memberIds: ['m1'],
    location: 'Community Center'
  },
  {
    id: 'e2',
    title: 'Work Meeting',
    start: setTime(today, 14),
    end: setTime(today, 15),
    memberIds: ['m2'],
    location: 'Office'
  },
  {
    id: 'e3',
    title: 'Soccer Practice',
    start: setTime(addDays(today, 1), 16),
    end: setTime(addDays(today, 1), 17),
    memberIds: ['m3'],
    location: 'School Field'
  },
  {
    id: 'e4',
    title: 'Piano Lesson',
    start: setTime(addDays(today, 2), 15),
    end: setTime(addDays(today, 2), 16),
    memberIds: ['m4'],
    location: 'Home'
  },
  {
    id: 'e5',
    title: 'Family Dinner',
    start: setTime(addDays(today, 0), 19),
    end: setTime(addDays(today, 0), 20),
    memberIds: ['m1', 'm2', 'm3', 'm4'], 
    location: 'Home'
  }
];

export const INITIAL_TASKS: ToDoTask[] = [
  {
    id: 't1',
    title: 'Buy Milk',
    type: TaskType.SHOPPING,
    isCompleted: false,
    dueDate: addDays(today, 1),
    assigneeIds: ['m1']
  },
  {
    id: 't2',
    title: 'Take out Trash',
    type: TaskType.CHORES,
    assigneeIds: ['m3'], // Leo
    isCompleted: false,
    dueDate: today,
    isRecurring: true,
    recurringRule: 'weekly',
    seriesId: 'series-trash-1'
  },
  {
    id: 't3',
    title: 'Water Plants',
    type: TaskType.CHORES,
    assigneeIds: ['m4'], // Mia
    isCompleted: true,
    dueDate: today
  },
  {
    id: 't4',
    title: 'Pay Electricity Bill',
    type: TaskType.GENERAL,
    assigneeIds: ['m2'], // Dad
    isCompleted: false,
    dueDate: addDays(today, 3)
  }
];

export const COLOR_MAP: Record<string, string> = {
  rose: 'bg-rose-500',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  purple: 'bg-purple-500',
  orange: 'bg-orange-500',
  teal: 'bg-teal-500',
  indigo: 'bg-indigo-500',
  pink: 'bg-pink-500',
  gray: 'bg-gray-500'
};

export const HEX_MAP: Record<string, string> = {
  rose: '#fb7185',
  blue: '#60a5fa',
  green: '#4ade80',
  purple: '#c084fc',
  orange: '#fb923c',
  teal: '#2dd4bf',
  indigo: '#818cf8',
  pink: '#f472b6',
  gray: '#9ca3af'
};

export const LIGHT_COLOR_MAP: Record<string, string> = {
  rose: 'bg-rose-100 text-rose-800 border-rose-200',
  blue: 'bg-blue-100 text-blue-800 border-blue-200',
  green: 'bg-green-100 text-green-800 border-green-200',
  purple: 'bg-purple-100 text-purple-800 border-purple-200',
  orange: 'bg-orange-100 text-orange-800 border-orange-200',
  teal: 'bg-teal-100 text-teal-800 border-teal-200',
  indigo: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  pink: 'bg-pink-100 text-pink-800 border-pink-200',
  gray: 'bg-gray-100 text-gray-800 border-gray-200'
};
