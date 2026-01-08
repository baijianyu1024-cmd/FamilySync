
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Part, Content } from "@google/genai";
import { Mic, Send, X, Bot, Volume2, VolumeX, Loader2, BrainCircuit, Terminal, Wifi, WifiOff, Sparkles, PlusCircle } from 'lucide-react';
import { ChatMessage, Member, CalendarEvent, ToDoTask } from '../types';
import { toolsSchema, SYSTEM_INSTRUCTION } from '../services/geminiService';
import { format } from 'date-fns';

interface Recommendation {
    title: string;
    description: string;
    category: 'event' | 'task';
    suggestedAssigneeId?: string;
    data: any;
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
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'welcome', role: 'model', text: "Hi! I'm FamilyBot, your smart organizer. I can handle multi-step requests like: 'I'm Leo, schedule swimming for tomorrow, delete any game sessions this week, and suggest some fun weekend plans!'" }
  ]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  // Fix: Initialize isSpeaking using useState to correctly manage state and avoid "Type 'true' must have a '[Symbol.iterator]()' method" error.
  const [isSpeaking, setIsSpeaking] = useState(true);
  const [recommendations, setRecommendations] = useState<Record<string, Recommendation[]>>({});
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const hasApiKey = !!process.env.API_KEY;

  useEffect(() => {
    if (isOpen && chatEndRef.current) {
        chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isProcessing]);

  const speak = (text: string) => {
    if (!isSpeaking || !window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const niceVoice = voices.find(v => v.name.includes('Google US English')) || voices.find(v => v.lang === 'en-US');
    if (niceVoice) utterance.voice = niceVoice;
    window.speechSynthesis.speak(utterance);
  };

  const handleVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Speech recognition not supported.");
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    setIsListening(true);
    recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        handleSend(transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
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
              case 'update_event':
                  onUpdateEvent(safeArgs.id, { ...safeArgs, start: safeArgs.start ? new Date(safeArgs.start) : undefined, end: safeArgs.end ? new Date(safeArgs.end) : undefined });
                  return { status: "success" };
              case 'delete_event':
                  onDeleteEvent(safeArgs.id);
                  return { status: "success" };
              case 'list_tasks':
                    return tasks.map(t => ({ id: t.id, title: t.title, type: t.type, isCompleted: t.isCompleted, assigneeNames: members.filter(m => t.assigneeIds.includes(m.id)).map(m => m.name) }));
              case 'add_task':
                    const aIds = normalizeIds(safeArgs.assigneeIds, safeArgs.assignedTo);
                    if (aIds.length === 0) return { error: "No assignees provided." };
                    onAddTask({ ...safeArgs, dueDate: safeArgs.dueDate ? new Date(safeArgs.dueDate) : undefined, assigneeIds: aIds });
                    return { status: "success" };
              case 'update_task':
                    onUpdateTask(safeArgs.id, { ...safeArgs, dueDate: safeArgs.dueDate ? new Date(safeArgs.dueDate) : undefined });
                    return { status: "success" };
              case 'delete_task':
                    onDeleteTask(safeArgs.id);
                    return { status: "success" };
              default:
                  return { error: `Unknown function: ${name}` };
          }
      } catch (e) {
          return { error: String(e) };
      }
  };

  const handleAcceptRecommendation = (rec: Recommendation, turnId: string, index: number) => {
      if (rec.category === 'event') {
          onAddEvent({ ...rec.data, start: new Date(rec.data.start || Date.now()), end: new Date(rec.data.end || Date.now() + 3600000), memberIds: rec.data.memberIds || [rec.suggestedAssigneeId || members[0]?.id] });
      } else {
          onAddTask({ ...rec.data, dueDate: new Date(rec.data.dueDate || Date.now()), assigneeIds: rec.data.assigneeIds || [rec.suggestedAssigneeId || members[0]?.id] });
      }
      setRecommendations(prev => {
          const updated = [...(prev[turnId] || [])];
          updated.splice(index, 1);
          return { ...prev, [turnId]: updated };
      });
  };

  const handleSend = async (textOverride?: string) => {
    const userText = textOverride || input;
    if (!userText.trim()) return;

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const userMsgId = Date.now().toString();
    setMessages(prev => [...prev, { id: userMsgId, role: 'user', text: userText }]);
    setInput('');
    setIsProcessing(true);

    try {
        const history: Content[] = messages
            .filter(m => m.id !== 'welcome' && m.id !== 'err')
            .map(m => ({
                 role: m.role,
                 parts: [{ text: m.text || (m.thoughts ? `(Thought: ${m.thoughts})` : "Action completed.") }] 
            }));

        const chat = ai.chats.create({
             model: 'gemini-3-pro-preview',
             config: {
                 systemInstruction: `${SYSTEM_INSTRUCTION}\n\nToday: ${new Date().toString()}\nMembers: ${JSON.stringify(members.map(m => ({id: m.id, name: m.name})))}`,
                 tools: [{ functionDeclarations: toolsSchema }]
             },
             history: history
        });

        let currentPayload: any = { message: userText };
        let loop = true;
        let count = 0;

        while (loop && count < 8) {
            count++;
            const turnId = `${userMsgId}_turn_${count}`;
            setMessages(prev => [...prev, { id: turnId, role: 'model', text: '', isProcessing: true }]);

            const response = await chat.sendMessageStream(currentPayload);
            let text = "";
            let calls: any[] = [];

            for await (const chunk of response) {
                if (chunk.text) {
                    text += chunk.text;
                    setMessages(prev => prev.map(m => m.id === turnId ? { ...m, text: text } : m));
                }
                if (chunk.functionCalls) calls.push(...chunk.functionCalls);
            }

            if (calls.length > 0) {
                setMessages(prev => prev.map(m => m.id === turnId ? { ...m, thoughts: text, text: '', isProcessing: true } : m));
                const toolResponses: Part[] = [];
                for (const call of calls) {
                    setMessages(prev => prev.map(m => m.id === turnId ? { ...m, toolLogs: [...(m.toolLogs || []), { name: call.name, args: call.args }] } : m));
                    const result = executeTool(call.name, call.args, turnId);
                    toolResponses.push({ functionResponse: { name: call.name, response: { result }, id: call.id } });
                }
                currentPayload = { message: toolResponses };
                setMessages(prev => prev.map(m => m.id === turnId ? { ...m, isProcessing: false } : m));
            } else {
                speak(text);
                setMessages(prev => prev.map(m => m.id === turnId ? { ...m, isProcessing: false } : m));
                loop = false;
            }
        }
    } catch (error) {
        console.error(error);
        setMessages(prev => [...prev, { id: 'err', role: 'model', text: "I hit a snag. Please check your connection or request." }]);
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
        <div className="fixed bottom-24 right-6 w-[380px] h-[640px] bg-white rounded-3xl shadow-2xl border flex flex-col z-50 overflow-hidden animate-slide-up origin-bottom-right">
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
              <button onClick={() => setIsSpeaking(!isSpeaking)} className={`p-2 rounded-full ${isSpeaking ? 'text-blue-400 bg-white/5' : 'text-slate-500'}`}><Volume2 size={20} /></button>
           </div>

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
                      {recommendations[msg.id]?.map((rec, idx) => (
                          <div key={idx} className="mt-2 w-full bg-white border-l-4 border-blue-500 rounded-xl p-4 shadow-sm">
                              <div className="flex justify-between items-start gap-3">
                                  <div className="flex-1">
                                      <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">{rec.category}</span>
                                      <h4 className="font-bold text-slate-800 text-sm mt-1">{rec.title}</h4>
                                      <p className="text-xs text-slate-500">{rec.description}</p>
                                  </div>
                                  <button onClick={() => handleAcceptRecommendation(rec, msg.id, idx)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all"><PlusCircle size={20} /></button>
                              </div>
                          </div>
                      ))}
                  </div>
              ))}
              {isProcessing && <div className="flex items-center gap-2 text-slate-400 text-xs px-2"><Loader2 size={14} className="animate-spin" /> Thinking...</div>}
              <div ref={chatEndRef} />
           </div>

           <div className="p-4 bg-white border-t">
              <div className="flex items-center gap-2">
                 <button onClick={() => handleSend("Suggest some fun activities for this weekend!")} className="p-3 bg-slate-50 text-slate-400 hover:text-blue-600 rounded-2xl"><Sparkles size={20} /></button>
                 <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} placeholder="Ask FamilyBot..." className="flex-1 bg-slate-50 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-1 ring-blue-500" disabled={isProcessing} />
                 <button onClick={handleVoiceInput} disabled={isProcessing} className={`p-3 rounded-2xl ${isListening ? 'bg-red-500 text-white' : 'bg-slate-50 text-slate-500'}`}><Mic size={20} /></button>
                 <button onClick={() => handleSend()} disabled={!input.trim() || isProcessing} className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg transition-all active:scale-95"><Send size={20} /></button>
              </div>
           </div>
        </div>
      )}
    </>
  );
};

export default AIAssistant;
