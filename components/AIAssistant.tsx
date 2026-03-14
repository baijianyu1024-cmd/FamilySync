
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Part, Content } from "@google/genai";
import { Mic, Send, X, Bot, Volume2, VolumeX, Loader2, BrainCircuit, Terminal, Wifi, WifiOff, Sparkles, PlusCircle, Clock, Plus, MessageSquare, Calendar, Cat, Star, CheckSquare, ClipboardList } from 'lucide-react';
import { ChatMessage, Member, CalendarEvent, ToDoTask } from '../types';
import { toolsSchema, SYSTEM_INSTRUCTION } from '../services/geminiService';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

interface Recommendation {
    title: string;
    description: string;
    category: 'event' | 'task';
    suggestedAssigneeId?: string;
    data: any;
}

interface ConfirmationRequest {
    actionType: "delete" | "update";
    targetType: "events" | "tasks";
    message: string;
    items: {
        id: string;
        title: string;
        subtitle: string;
        memberIds?: string[];
        iconType?: "event" | "chore" | "shopping" | "general";
    }[];
}

interface AIAssistantProps {
  members: Member[];
  events: CalendarEvent[];
  tasks: ToDoTask[];
  onAddEvent: (e: any) => void;
  onUpdateEvent: (id: string, e: any) => void;
  onDeleteEvent: (id: string) => void;
  onAddTask: (t: any) => void;
  onUpdateTask: (id: string, t: any) => void;
  onDeleteTask: (id: string) => void;
  onAddMember: (name: string, color?: string) => void;
  onUpdateMember: (id: string, updates: Partial<Member>) => void;
  onDeleteMember: (id: string) => void;
}

interface ChatSession {
    id: string;
    title: string;
    messages: ChatMessage[];
    date: number;
}

const defaultWelcomeMessage: ChatMessage = { id: 'welcome', role: 'model', text: "Hi! I'm FamilyBot, your smart organizer. I can handle multi-step requests like: 'I'm Leo, schedule swimming for tomorrow, delete any game sessions this week, and suggest some fun weekend plans!'" };

const AIAssistant: React.FC<AIAssistantProps> = ({
  members,
  events,
  tasks,
  onAddEvent,
  onUpdateEvent,
  onDeleteEvent,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onAddMember,
  onUpdateMember,
  onDeleteMember
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([defaultWelcomeMessage]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>(uuidv4());
  const [showHistory, setShowHistory] = useState(false);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  // Fix: Initialize isSpeaking using useState to correctly manage state and avoid "Type 'true' must have a '[Symbol.iterator]()' method" error.
  const [isSpeaking, setIsSpeaking] = useState(true);
  const [recommendations, setRecommendations] = useState<Record<string, Recommendation[]>>({});
  const [selectedRecommendations, setSelectedRecommendations] = useState<Record<string, number[]>>({});
  const [resolvedRecommendations, setResolvedRecommendations] = useState<Record<string, boolean>>({});
  const [confirmations, setConfirmations] = useState<Record<string, ConfirmationRequest>>({});
  const [resolvedConfirmations, setResolvedConfirmations] = useState<Record<string, boolean>>({});
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef('');
  const currentInputRef = useRef('');
  const hasApiKey = !!process.env.API_KEY;

  useEffect(() => {
    if (isOpen && chatEndRef.current && !showHistory) {
        chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isProcessing, showHistory]);

  useEffect(() => {
    if (!isOpen) {
        window.speechSynthesis?.cancel();
    }
  }, [isOpen]);

  useEffect(() => {
    setSessions(prev => {
        const existing = prev.find(s => s.id === activeSessionId);
        const title = messages.length > 1 ? (messages[1].text?.substring(0, 30) + '...') : 'New Conversation';
        if (existing) {
            return prev.map(s => s.id === activeSessionId ? { ...s, messages, title, date: Date.now() } : s);
        } else {
            return [{ id: activeSessionId, title, messages, date: Date.now() }, ...prev];
        }
    });
  }, [messages, activeSessionId]);

  const startNewChat = () => {
      setActiveSessionId(uuidv4());
      setMessages([defaultWelcomeMessage]);
      setShowHistory(false);
  };

  const switchChat = (sessionId: string) => {
      const session = sessions.find(s => s.id === sessionId);
      if (session) {
          setActiveSessionId(sessionId);
          setMessages(session.messages);
          setShowHistory(false);
      }
  };

  const speak = (text: string) => {
    if (!isSpeaking || !window.speechSynthesis || !text || !isOpen) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.25; // Speed up the voice
    const voices = window.speechSynthesis.getVoices();
    const niceVoice = voices.find(v => v.name.includes('Google US English')) || voices.find(v => v.lang === 'en-US');
    if (niceVoice) utterance.voice = niceVoice;
    window.speechSynthesis.speak(utterance);
  };

  const toggleVoiceInput = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Speech recognition not supported.");
    
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;
    finalTranscriptRef.current = '';
    currentInputRef.current = '';

    recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                final += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }
        finalTranscriptRef.current += final;
        const combined = finalTranscriptRef.current + interimTranscript;
        currentInputRef.current = combined;
        setInput(combined);
    };

    recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
    };

    recognition.onend = () => {
        setIsListening(false);
        currentInputRef.current = '';
    };

    recognitionRef.current = recognition;
    setIsListening(true);
    setInput('');
    recognition.start();
  };

  const executeTool = (name: string, args: any, turnId: string): any => {
      try {
          const safeArgs = args || {};
          const normalizeIds = (ids: any, singularId: any): string[] => {
              if (Array.isArray(ids)) return ids;
              if (typeof ids === 'string') return [ids];
              if (typeof singularId === 'string') return [singularId];
              return [];
          };

          switch (name) {
              case 'display_recommendations':
                  const recs = safeArgs.recommendations as Recommendation[];
                  setRecommendations(prev => ({ ...prev, [turnId]: recs }));
                  setSelectedRecommendations(prev => ({ ...prev, [turnId]: [] }));
                  return { status: "displayed", count: recs.length, info: "Recommendations are now visible to the user as cards for confirmation." };
              case 'list_members':
                  return members.map(m => ({ id: m.id, name: m.name, color: m.color }));
              case 'add_member':
                  onAddMember(safeArgs.name, safeArgs.color);
                  return { status: "success", message: `Added ${safeArgs.name}` };
              case 'update_member':
                  onUpdateMember(safeArgs.id, safeArgs);
                  return { status: "success" };
              case 'delete_member':
                  onDeleteMember(safeArgs.id);
                  return { status: "success" };
              case 'list_events':
                  return events.map(e => ({
                      id: e.id,
                      title: e.title,
                      start: e.start.toISOString(),
                      end: e.end.toISOString(),
                      memberNames: members.filter(m => e.memberIds.includes(m.id)).map(m => m.name)
                  }));
              case 'add_event':
                  const mIds = normalizeIds(safeArgs.memberIds, safeArgs.memberId);
                  if (mIds.length === 0) return { error: "No memberIds provided." };
                  onAddEvent({ ...safeArgs, start: new Date(safeArgs.start), end: new Date(safeArgs.end || new Date(new Date(safeArgs.start).getTime() + 3600000)), memberIds: mIds });
                  return { status: "success", message: "Event added." };
              case 'add_events':
                  if (Array.isArray(safeArgs.events)) {
                      safeArgs.events.forEach((evt: any) => {
                          const evtMIds = normalizeIds(evt.memberIds, evt.memberId);
                          if (evtMIds.length > 0) {
                              onAddEvent({ ...evt, start: new Date(evt.start), end: new Date(evt.end || new Date(new Date(evt.start).getTime() + 3600000)), memberIds: evtMIds });
                          }
                      });
                  }
                  return { status: "success", message: "Events added." };
              case 'request_confirmation':
                  const req = safeArgs as ConfirmationRequest;
                  setConfirmations(prev => ({ ...prev, [turnId]: req }));
                  return { status: "waiting_for_user_confirmation", info: "The confirmation card has been displayed to the user. Wait for their response." };
              case 'update_events':
                  if (Array.isArray(safeArgs.updates)) {
                      safeArgs.updates.forEach((update: any) => {
                          onUpdateEvent(update.id, { ...update, start: update.start ? new Date(update.start) : undefined, end: update.end ? new Date(update.end) : undefined });
                      });
                  }
                  return { status: "success" };
              case 'delete_events':
                  if (Array.isArray(safeArgs.ids)) {
                      safeArgs.ids.forEach((id: string) => onDeleteEvent(id));
                  }
                  return { status: "success" };
              case 'list_tasks':
                    return tasks.map(t => ({ id: t.id, title: t.title, type: t.type, isCompleted: t.isCompleted, assigneeNames: members.filter(m => t.assigneeIds.includes(m.id)).map(m => m.name) }));
              case 'add_task':
                    const aIds = normalizeIds(safeArgs.assigneeIds, safeArgs.assignedTo);
                    if (aIds.length === 0) return { error: "No assignees provided." };
                    onAddTask({ ...safeArgs, dueDate: safeArgs.dueDate ? new Date(safeArgs.dueDate) : undefined, assigneeIds: aIds });
                    return { status: "success" };
              case 'add_tasks':
                    if (Array.isArray(safeArgs.tasks)) {
                        safeArgs.tasks.forEach((tsk: any) => {
                            const tskAIds = normalizeIds(tsk.assigneeIds, tsk.assignedTo);
                            if (tskAIds.length > 0) {
                                onAddTask({ ...tsk, dueDate: tsk.dueDate ? new Date(tsk.dueDate) : undefined, assigneeIds: tskAIds });
                            }
                        });
                    }
                    return { status: "success" };
              case 'update_tasks':
                    if (Array.isArray(safeArgs.updates)) {
                        safeArgs.updates.forEach((update: any) => {
                            onUpdateTask(update.id, { ...update, dueDate: update.dueDate ? new Date(update.dueDate) : undefined });
                        });
                    }
                    return { status: "success" };
              case 'delete_tasks':
                    if (Array.isArray(safeArgs.ids)) {
                        safeArgs.ids.forEach((id: string) => onDeleteTask(id));
                    }
                    return { status: "success" };
              default:
                  return { error: `Unknown function: ${name}` };
          }
      } catch (e) {
          return { error: String(e) };
      }
  };

  const handleRecommendationsResponse = (msgId: string, confirmed: boolean) => {
      setResolvedRecommendations(prev => ({ ...prev, [msgId]: true }));
      
      if (!confirmed) {
          handleSend("No, these are not what I want. Please suggest something else.");
          return;
      }

      const selectedIndices = selectedRecommendations[msgId] || [];
      if (selectedIndices.length === 0) {
          handleSend("I didn't select any of the recommendations.");
          return;
      }

      const recs = recommendations[msgId] || [];
      const selectedRecs = selectedIndices.map(i => recs[i]);
      
      const eventsToAdd = selectedRecs.filter(r => r.category === 'event').map(r => ({ ...r.data, start: r.data.start || new Date().toISOString(), end: r.data.end || new Date(Date.now() + 3600000).toISOString(), memberIds: r.data.memberIds || (r.data.memberId ? [r.data.memberId] : [r.suggestedAssigneeId || members[0]?.id]) }));
      const tasksToAdd = selectedRecs.filter(r => r.category === 'task').map(r => ({ ...r.data, dueDate: r.data.dueDate || new Date().toISOString(), assigneeIds: r.data.assigneeIds || (r.data.assignedTo ? [r.data.assignedTo] : [r.suggestedAssigneeId || members[0]?.id]) }));

      const titles = selectedRecs.map(r => `"${r.title}"`).join(", ");
      
      let prompt = `I have confirmed the following recommendations: ${titles}. `;
      if (eventsToAdd.length > 0) {
          prompt += `Please call add_events with: ${JSON.stringify(eventsToAdd)}. `;
      }
      if (tasksToAdd.length > 0) {
          prompt += `Please call add_tasks with: ${JSON.stringify(tasksToAdd)}. `;
      }
      prompt += "After adding these, please check if there were any other tasks I asked you to do in my original request and continue executing them now.";
      handleSend(prompt);
  };

  const handleConfirmationResponse = (msgId: string, confirmed: boolean) => {
      setResolvedConfirmations(prev => ({ ...prev, [msgId]: true }));
      const text = confirmed ? "Yes, I confirm. Please proceed with the action. Also, please check if there were any other tasks I asked you to do in my original request and continue executing them now." : "No, please cancel the action. But please check if there were any other tasks I asked you to do in my original request and continue executing them now.";
      handleSend(text);
  };

  const handleSend = async (textOverride?: string) => {
    if (isListening && recognitionRef.current) {
        recognitionRef.current.stop();
        currentInputRef.current = ''; // Prevent onend from triggering another send
    }

    const userText = textOverride || input;
    if (!userText.trim()) return;

    setResolvedConfirmations(prev => {
        const next = { ...prev };
        Object.keys(confirmations).forEach(k => next[k] = true);
        return next;
    });
    setResolvedRecommendations(prev => {
        const next = { ...prev };
        Object.keys(recommendations).forEach(k => next[k] = true);
        return next;
    });

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { apiVersion: 'v1alpha' } });
    const userMsgId = Date.now().toString();
    setMessages(prev => [...prev, { id: userMsgId, role: 'user', text: userText }]);
    setInput('');
    if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
    }
    setIsProcessing(true);

    try {
        const history: Content[] = [];
        const filteredMessages = messages.filter(m => m.id !== 'welcome' && m.id !== 'err' && m.id !== userMsgId);
        
        for (const m of filteredMessages) {
            const text = m.text || (m.thoughts ? `(Thought: ${m.thoughts})` : "Action completed.");
            if (history.length > 0 && history[history.length - 1].role === m.role) {
                history[history.length - 1].parts[0].text += `\n${text}`;
            } else {
                history.push({ role: m.role, parts: [{ text }] });
            }
        }

        if (history.length > 0 && history[0].role === 'model') {
            history.unshift({ role: 'user', parts: [{ text: "Hello" }] });
        }

        const chat = ai.chats.create({
             model: 'gemini-3.1-pro-preview',
             config: {
                 systemInstruction: `${SYSTEM_INSTRUCTION}\n\nToday: ${new Date().toString()}\nTimezone Offset (minutes): ${new Date().getTimezoneOffset()}\nMembers: ${JSON.stringify(members.map(m => ({id: m.id, name: m.name})))}`,
                 tools: [{ functionDeclarations: toolsSchema }]
             },
             history: history
        });

        let currentPayload: any = { message: userText };
        let loop = true;
        let count = 0;
        let addedEvents: any[] = [];
        let addedTasks: any[] = [];

        while (loop && count < 15) {
            if (count > 0) {
                // Add a larger delay between turns to help mitigate burst rate limits (429)
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            count++;
            const turnId = `${userMsgId}_turn_${count}`;
            setMessages(prev => [...prev, { id: turnId, role: 'model', text: '', isProcessing: true }]);

            let text = "";
            let calls: any[] = [];
            let retryCount = 0;
            let success = false;
            let lastError: any = null;

            while (retryCount < 5 && !success) {
                try {
                    const response = await chat.sendMessageStream(currentPayload);
                    text = "";
                    calls = [];
                    for await (const chunk of response) {
                        if (chunk.text) {
                            text += chunk.text;
                            setMessages(prev => prev.map(m => m.id === turnId ? { ...m, text: text } : m));
                        }
                        if (chunk.functionCalls) calls.push(...chunk.functionCalls);
                    }
                    success = true;
                } catch (e: any) {
                    lastError = e;
                    const isRetryable = e?.status === 429 || e?.status === 503 || e?.status === 500 || 
                                        e?.message?.includes('429') || e?.message?.includes('503') || 
                                        e?.message?.includes('500') || e?.message?.includes('RESOURCE_EXHAUSTED') || 
                                        e?.message?.includes('quota') || e?.message?.includes('fetch failed');
                    if (isRetryable) {
                        retryCount++;
                        const delayMs = retryCount * 3000;
                        console.warn(`API error (${e?.message || e?.status}), retrying in ${delayMs / 1000}s...`);
                        await new Promise(resolve => setTimeout(resolve, delayMs));
                    } else {
                        throw e;
                    }
                }
            }

            if (!success) {
                throw new Error(`Failed after retries due to rate limits. Original error: ${lastError?.message || lastError?.status}`);
            }

            if (calls.length > 0) {
                setMessages(prev => prev.map(m => m.id === turnId ? { ...m, thoughts: text, text: '', isProcessing: true } : m));
                const toolResponses: Part[] = [];
                for (const call of calls) {
                    setMessages(prev => prev.map(m => m.id === turnId ? { ...m, toolLogs: [...(m.toolLogs || []), { name: call.name, args: call.args }] } : m));
                    const result = executeTool(call.name, call.args, turnId);
                    
                    if (call.name === 'add_event') addedEvents.push(call.args);
                    if (call.name === 'add_events' && Array.isArray(call.args.events)) {
                        addedEvents.push(...call.args.events);
                    }
                    if (call.name === 'add_task') addedTasks.push(call.args);
                    if (call.name === 'add_tasks' && Array.isArray(call.args.tasks)) {
                        addedTasks.push(...call.args.tasks);
                    }

                    toolResponses.push({ functionResponse: { name: call.name, response: result, id: call.id } });
                }
                currentPayload = { message: { role: 'function', parts: toolResponses } as any };
                setMessages(prev => prev.map(m => m.id === turnId ? { ...m, isProcessing: false } : m));
            } else {
                speak(text);
                setMessages(prev => prev.map(m => m.id === turnId ? { ...m, isProcessing: false, addedEvents, addedTasks } : m));
                loop = false;
            }
        }
    } catch (error: any) {
        console.error(error);
        let errorMessage = "I hit a snag. Please check your connection or request.";
        if (error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED') || error?.status === 429) {
            errorMessage = "I've hit my rate limit or quota for now. Please wait a moment and try again, or check your Gemini API billing details.";
        } else {
            errorMessage = `Error: ${error?.message || JSON.stringify(error)}`;
        }
        setMessages(prev => [...prev, { id: 'err', role: 'model', text: errorMessage }]);
    } finally {
        setIsProcessing(false);
    }
  };

  return (
    <>
      <button onClick={() => setIsOpen(!isOpen)} className={`fixed bottom-6 right-6 p-4 rounded-full shadow-2xl z-50 transition-all ${isOpen ? 'bg-slate-800' : 'bg-blue-600'} text-white`}>
        {isOpen ? <X size={24} /> : <Bot size={28} />}
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-6 w-[800px] max-w-[90vw] h-[75vh] max-h-[800px] bg-white rounded-3xl shadow-2xl border flex flex-col z-50 overflow-hidden animate-slide-up origin-bottom-right">
           <div className="bg-slate-900 p-5 flex items-center justify-between text-white">
               <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center"><Sparkles size={20} className="animate-pulse" /></div>
                 <div>
                    <h3 className="font-bold text-lg">FamilyBot</h3>
                    <div className="text-[10px] uppercase tracking-widest text-slate-400 flex items-center gap-1">
                        {hasApiKey ? <span className="text-green-400"><Wifi size={10} /> Online</span> : <span className="text-red-400"><WifiOff size={10} /> Offline</span>}
                    </div>
                 </div>
              </div>
              <div className="flex items-center gap-2">
                 <button onClick={() => setShowHistory(!showHistory)} className={`p-2 rounded-full ${showHistory ? 'text-blue-400 bg-white/10' : 'text-slate-400 hover:text-white'}`}><Clock size={20} /></button>
                 <button onClick={startNewChat} className="p-2 rounded-full text-slate-400 hover:text-white"><Plus size={20} /></button>
                 <button onClick={() => setIsSpeaking(!isSpeaking)} className={`p-2 rounded-full ${isSpeaking ? 'text-blue-400 bg-white/5' : 'text-slate-500'}`}><Volume2 size={20} /></button>
              </div>
           </div>

           {showHistory ? (
              <div className="flex-1 overflow-y-auto p-4 bg-slate-50 custom-scrollbar">
                  <div className="flex justify-between items-center mb-4">
                      <h4 className="font-bold text-slate-700">Chat History</h4>
                  </div>
                  <div className="space-y-2">
                      {sessions.map(s => (
                          <button key={s.id} onClick={() => switchChat(s.id)} className={`w-full text-left p-3 rounded-xl border transition-all ${s.id === activeSessionId ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                              <div className="font-medium text-sm text-slate-800 truncate flex items-center gap-2">
                                  <MessageSquare size={14} className={s.id === activeSessionId ? 'text-blue-500' : 'text-slate-400'} />
                                  {s.title}
                              </div>
                              <div className="text-xs text-slate-400 mt-1 ml-6">{new Date(s.date).toLocaleString()}</div>
                          </button>
                      ))}
                  </div>
              </div>
           ) : (
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 custom-scrollbar">
                  {messages.map((msg) => (
                  <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                      {msg.thoughts && (
                          <div className="max-w-[85%] mb-2 bg-indigo-50 text-indigo-600 p-3 rounded-2xl rounded-bl-none text-xs italic border border-indigo-100 flex gap-2">
                             <BrainCircuit size={14} className="flex-none mt-0.5" />
                             <div>{msg.thoughts}</div>
                          </div>
                      )}
                      {msg.toolLogs && (
                          <div className="mb-2 w-full max-w-[90%]">
                              {msg.toolLogs.map((log, idx) => (
                                  <div key={idx} className="bg-slate-800 text-slate-300 rounded-lg p-2 text-[10px] font-mono mb-1 border border-slate-700">
                                      <div className="flex items-center gap-2"><Terminal size={12} className="text-blue-400" /><span className="font-bold text-blue-300">{log.name}</span></div>
                                      <div className="pl-4 opacity-70 break-all text-[9px]">{JSON.stringify(log.args)}</div>
                                  </div>
                              ))}
                          </div>
                      )}
                      {msg.text && (
                          <div className={`max-w-[90%] p-4 rounded-2xl text-sm shadow-sm whitespace-pre-wrap ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-slate-800 border rounded-bl-none'}`}>
                              {msg.text}
                          </div>
                      )}
                      {msg.addedEvents && msg.addedEvents.length > 0 && (
                          <div className="mt-3 w-full max-w-[90%] bg-white rounded-3xl p-4 shadow-sm border border-slate-100">
                              <h4 className="font-bold text-slate-800 text-base mb-3">{msg.addedEvents.length} Event{msg.addedEvents.length > 1 ? 's' : ''} Added</h4>
                              <div className="space-y-2">
                                  {msg.addedEvents.map((event, idx) => {
                                      const colors = [
                                          { bg: 'bg-[#FDF8F3]', text: 'text-[#7A5C43]', icon: 'text-[#A68A73]', border: 'border-[#FDF8F3]' },
                                          { bg: 'bg-[#F0F4FF]', text: 'text-[#2A52BE]', icon: 'text-[#7D9CE8]', border: 'border-[#F0F4FF]' },
                                          { bg: 'bg-[#FFF8E7]', text: 'text-[#C27A29]', icon: 'text-[#E0B079]', border: 'border-[#FFF8E7]' }
                                      ];
                                      const theme = colors[idx % colors.length];
                                      const memberIds = Array.isArray(event.memberIds) ? event.memberIds : (typeof event.memberIds === 'string' ? [event.memberIds] : (typeof event.memberId === 'string' ? [event.memberId] : []));
                                      
                                      return (
                                          <div key={idx} className={`${theme.bg} rounded-2xl p-4 flex justify-between items-center`}>
                                              <div className="flex-1">
                                                  <h5 className={`font-bold ${theme.text} text-sm`}>{event.title || 'Calendar event'}</h5>
                                                  <div className={`flex items-center gap-1.5 mt-1 ${theme.icon} text-xs`}>
                                                      <Calendar size={14} className="flex-none" />
                                                      <span className="truncate max-w-[200px] sm:max-w-xs">
                                                          {event.start ? format(new Date(event.start), 'MMM d, yyyy, h:mm a') : 'No date'} 
                                                          {event.end ? ` - ${format(new Date(event.end), 'h:mm a')}` : ''}
                                                          {event.recurringRule ? ` • ${event.recurringRule}` : ''}
                                                      </span>
                                                  </div>
                                              </div>
                                              <div className="flex -space-x-2 ml-3">
                                                  {memberIds.slice(0, 3).map((id: string, i: number) => {
                                                      const member = members.find(m => m.id === id);
                                                      return member ? (
                                                          <div key={i} className={`w-8 h-8 flex items-center justify-center text-xs font-bold text-white border-2 ${theme.border} relative`} style={{ backgroundColor: member.hex || '#ccc', borderRadius: '40% 60% 70% 30% / 40% 50% 60% 50%', zIndex: 30 - i * 10 }}>
                                                              {member.name.charAt(0)}
                                                          </div>
                                                      ) : null;
                                                  })}
                                                  {memberIds.length > 3 && (
                                                      <div className={`w-8 h-8 flex items-center justify-center text-xs font-bold ${theme.text} bg-white/50 border-2 ${theme.border} relative`} style={{ borderRadius: '40% 60% 70% 30% / 40% 50% 60% 50%', zIndex: 0 }}>
                                                          +{memberIds.length - 3}
                                                      </div>
                                                  )}
                                              </div>
                                          </div>
                                      );
                                  })}
                              </div>
                          </div>
                      )}
                      {msg.addedTasks && msg.addedTasks.length > 0 && (
                          <div className="mt-3 w-full max-w-[90%] bg-white rounded-3xl p-4 shadow-sm border border-slate-100">
                              <h4 className="font-bold text-slate-800 text-base mb-3">{msg.addedTasks.length} Task{msg.addedTasks.length > 1 ? 's' : ''} Added</h4>
                              <div className="space-y-2">
                                  {msg.addedTasks.map((task, idx) => {
                                      const assigneeIds = Array.isArray(task.assigneeIds) ? task.assigneeIds : (typeof task.assigneeIds === 'string' ? [task.assigneeIds] : (typeof task.assignedTo === 'string' ? [task.assignedTo] : []));
                                      return (
                                          <div key={idx} className="bg-[#FDF8F3] rounded-2xl p-4 flex justify-between items-center">
                                              <div className="flex items-center gap-3">
                                                  <div className="w-12 h-12 bg-[#A68A73] rounded-2xl flex items-center justify-center text-white shadow-sm flex-none">
                                                      {task.type === 'chores' ? <Cat size={24} /> : <ClipboardList size={24} />}
                                                  </div>
                                                  <div>
                                                      <h5 className="font-bold text-[#7A5C43] text-sm flex items-center gap-1.5">
                                                          {task.title || 'Task'} <Star size={14} className="fill-yellow-400 text-yellow-400 ml-1" /> <span className="text-yellow-500/70 text-xs">5</span>
                                                      </h5>
                                                      <div className="flex items-center gap-1.5 mt-1 text-[#A68A73] text-xs">
                                                          <CheckSquare size={14} className="flex-none" />
                                                          <span className="truncate max-w-[200px] sm:max-w-xs">
                                                              {task.type || 'Chore'} • {task.dueDate ? format(new Date(task.dueDate), 'MMM d, yyyy') : 'No date'} {task.recurringRule ? `• ${task.recurringRule}` : ''}
                                                          </span>
                                                      </div>
                                                  </div>
                                              </div>
                                              <div className="flex -space-x-2 ml-3">
                                                  {assigneeIds.slice(0, 3).map((id: string, i: number) => {
                                                      const member = members.find(m => m.id === id);
                                                      return member ? (
                                                          <div key={i} className={`w-8 h-8 flex items-center justify-center text-xs font-bold text-white border-2 border-[#FDF8F3] relative`} style={{ backgroundColor: member.hex || '#ccc', borderRadius: '40% 60% 70% 30% / 40% 50% 60% 50%', zIndex: 30 - i * 10 }}>
                                                              {member.name.charAt(0)}
                                                          </div>
                                                      ) : null;
                                                  })}
                                              </div>
                                          </div>
                                      );
                                  })}
                              </div>
                          </div>
                      )}
                      {recommendations[msg.id] && recommendations[msg.id].length > 0 && (
                          <div className="mt-4 w-full bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                              <h4 className="font-bold text-slate-800 text-sm mb-3">Select Items</h4>
                              <div className="space-y-3">
                                  {recommendations[msg.id].map((rec, idx) => {
                                      const isSelected = selectedRecommendations[msg.id]?.includes(idx);
                                      const mIds = rec.data.memberIds || rec.data.assigneeIds || (rec.suggestedAssigneeId ? [rec.suggestedAssigneeId] : []);
                                      return (
                                          <div 
                                              key={idx} 
                                              onClick={() => {
                                                  if (resolvedRecommendations[msg.id]) return;
                                                  setSelectedRecommendations(prev => {
                                                      const current = prev[msg.id] || [];
                                                      if (current.includes(idx)) {
                                                          return { ...prev, [msg.id]: current.filter(i => i !== idx) };
                                                      } else {
                                                          return { ...prev, [msg.id]: [...current, idx] };
                                                      }
                                                  });
                                              }}
                                              className={`rounded-xl p-3 flex items-start gap-3 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 border border-blue-200' : 'bg-[#FAF6F0] border border-transparent'}`}
                                          >
                                              <div className="mt-1 shrink-0">
                                                  <div className={`w-5 h-5 rounded border flex items-center justify-center ${isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-300 bg-white'}`}>
                                                      {isSelected && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3 h-3"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                                                  </div>
                                              </div>
                                              <div className="flex-1 min-w-0">
                                                  <div className="flex items-center gap-2">
                                                      <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-white/50 text-slate-600">{rec.category}</span>
                                                      <h5 className="font-bold text-slate-800 text-sm truncate">{rec.title}</h5>
                                                  </div>
                                                  <p className="text-xs text-slate-500 mt-1">{rec.description}</p>
                                              </div>
                                              {mIds.length > 0 && (
                                                  <div className="flex -space-x-2 shrink-0">
                                                      {mIds.map((mId: string) => {
                                                          const m = members.find(x => x.id === mId);
                                                          if (!m) return null;
                                                          return (
                                                              <div key={mId} className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-[#FAF6F0]" style={{ backgroundColor: m.color }}>
                                                                  {m.name.charAt(0)}
                                                              </div>
                                                          );
                                                      })}
                                                  </div>
                                              )}
                                          </div>
                                      );
                                  })}
                              </div>
                              {!resolvedRecommendations[msg.id] && (
                                  <div className="flex justify-end gap-2 mt-4">
                                      <button 
                                          onClick={() => handleRecommendationsResponse(msg.id, false)}
                                          className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-sm hover:bg-slate-200 transition-colors"
                                      >
                                          Not What I Want
                                      </button>
                                      <button 
                                          onClick={() => handleRecommendationsResponse(msg.id, true)}
                                          className="px-4 py-2 rounded-xl bg-slate-800 text-white font-bold text-sm hover:bg-slate-900 transition-colors"
                                      >
                                          Confirm
                                      </button>
                                  </div>
                              )}
                          </div>
                      )}
                      {confirmations[msg.id] && (
                          <div className="mt-4 w-full bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                              <h4 className="font-bold text-slate-800 text-sm mb-3">{confirmations[msg.id].message}</h4>
                              <div className="space-y-3">
                                  {confirmations[msg.id].items.map((item, idx) => (
                                      <div key={idx} className="bg-[#FAF6F0] rounded-xl p-3 flex items-start gap-3">
                                          {item.iconType && (
                                              <div className="w-10 h-10 rounded-lg bg-[#B69D74] text-white flex items-center justify-center shrink-0">
                                                  {item.iconType === 'chore' ? <Cat size={20} /> : <Calendar size={20} />}
                                              </div>
                                          )}
                                          <div className="flex-1 min-w-0">
                                              <h5 className="font-bold text-slate-800 text-sm truncate">{item.title}</h5>
                                              <p className="text-xs text-slate-500 mt-1 truncate">{item.subtitle}</p>
                                          </div>
                                          {item.memberIds && item.memberIds.length > 0 && (
                                              <div className="flex -space-x-2 shrink-0">
                                                  {item.memberIds.map(mId => {
                                                      const m = members.find(x => x.id === mId);
                                                      if (!m) return null;
                                                      return (
                                                          <div key={mId} className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-[#FAF6F0]" style={{ backgroundColor: m.color }}>
                                                              {m.name.charAt(0)}
                                                          </div>
                                                      );
                                                  })}
                                              </div>
                                          )}
                                      </div>
                                  ))}
                              </div>
                              {!resolvedConfirmations[msg.id] && (
                                  <div className="flex justify-end gap-2 mt-4">
                                      <button 
                                          onClick={() => handleConfirmationResponse(msg.id, false)}
                                          className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-sm hover:bg-slate-200 transition-colors"
                                      >
                                          Cancel
                                      </button>
                                      <button 
                                          onClick={() => handleConfirmationResponse(msg.id, true)}
                                          className={`px-4 py-2 rounded-xl font-bold text-sm text-white transition-colors ${confirmations[msg.id].actionType === 'delete' ? 'bg-red-500 hover:bg-red-600' : 'bg-black hover:bg-slate-800'}`}
                                      >
                                          {confirmations[msg.id].actionType === 'delete' ? 'Delete' : 'Update'}
                                      </button>
                                  </div>
                              )}
                          </div>
                      )}
                  </div>
              ))}
              {isProcessing && <div className="flex items-center gap-2 text-slate-400 text-xs px-2"><Loader2 size={14} className="animate-spin" /> Thinking...</div>}
              <div ref={chatEndRef} />
           </div>
           )}

           <div className="p-4 bg-white border-t">
              <div className="flex items-end gap-2">
                 <button onClick={() => handleSend("Suggest some fun activities for this weekend!")} className="p-3 mb-1 bg-slate-50 text-slate-400 hover:text-blue-600 rounded-2xl"><Sparkles size={20} /></button>
                 <textarea 
                    ref={textareaRef}
                    value={input} 
                    onChange={(e) => {
                        setInput(e.target.value);
                        e.target.style.height = 'auto';
                        e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                    }} 
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                        }
                    }} 
                    placeholder="Ask FamilyBot..." 
                    className="flex-1 bg-slate-50 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-1 ring-blue-500 resize-none custom-scrollbar min-h-[44px]" 
                    rows={1}
                    disabled={isProcessing} 
                 />
                 <button onClick={toggleVoiceInput} disabled={isProcessing} className={`p-3 mb-1 rounded-2xl ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-50 text-slate-500'}`}><Mic size={20} /></button>
                 <button onClick={() => handleSend()} disabled={!input.trim() || isProcessing} className="p-3 mb-1 bg-blue-600 text-white rounded-2xl shadow-lg transition-all active:scale-95"><Send size={20} /></button>
              </div>
           </div>
        </div>
      )}
    </>
  );
};

export default AIAssistant;
