
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Part, Content } from "@google/genai";
import { Mic, Send, X, Bot, Volume2, VolumeX, Loader2, BrainCircuit, Terminal, Wifi, WifiOff, Sparkles, PlusCircle, CheckCircle } from 'lucide-react';
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
    { id: 'welcome', role: 'model', text: "Hi! I'm FamilyBot. I can help manage your calendar and tasks. Try saying 'Add a meeting' or click the ✨ for suggestions!" }
  ]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
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
    utterance.rate = 1.0;
    
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
        const niceVoice = voices.find(v => v.name.includes('Google US English')) || 
                          voices.find(v => v.name.includes('Samantha')) ||
                          voices.find(v => v.lang === 'en-US');
        if (niceVoice) utterance.voice = niceVoice;
    }
    
    window.speechSynthesis.speak(utterance);
  };

  const handleVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("Voice input is not supported in this browser.");
        return;
    }
    
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

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
      console.log(`Executing tool: ${name}`, args);
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
                  return { status: "displayed", count: recs.length };
              case 'list_members':
                  return members.map(m => ({ id: m.id, name: m.name, color: m.color }));
              case 'add_member':
                  if (!safeArgs.name) return { error: "Missing 'name'." };
                  onAddMember(safeArgs.name, safeArgs.color);
                  return { status: "success", message: `Added member ${safeArgs.name}` };
              case 'update_member':
                  if (!safeArgs.id) return { error: "Missing 'id'." };
                  onUpdateMember(safeArgs.id, {
                      ...(safeArgs.name && { name: safeArgs.name }),
                      ...(safeArgs.color && { color: safeArgs.color })
                  });
                  return { status: "success", message: "Updated member." };
              case 'delete_member':
                  if (!safeArgs.id) return { error: "Missing 'id'." };
                  onDeleteMember(safeArgs.id);
                  return { status: "success", message: "Deleted member." };
              case 'list_events':
                  return events.map(e => ({
                      id: e.id,
                      title: e.title,
                      start: format(e.start, "yyyy-MM-dd'T'HH:mm:ss"),
                      end: format(e.end, "yyyy-MM-dd'T'HH:mm:ss"),
                      members: members.filter(m => e.memberIds.includes(m.id)).map(m => m.name).join(', ')
                  }));
              case 'add_event':
                  if (!safeArgs.title) return { error: "Missing 'title'. Ask the user for the event name." };
                  if (!safeArgs.start) return { error: "Missing 'start' time. Ask the user when the event is." };
                  
                  const eventMemberIds = normalizeIds(safeArgs.memberIds, safeArgs.memberId);
                  if (eventMemberIds.length === 0) return { error: "Missing memberIds. Ask who this is for." };
                  
                  onAddEvent({
                      title: safeArgs.title,
                      start: new Date(safeArgs.start),
                      end: new Date(safeArgs.end || safeArgs.start),
                      location: safeArgs.location,
                      memberIds: eventMemberIds
                  });
                  return { status: "success", message: "Event created." };
              case 'update_event':
                  if (!safeArgs.id) return { error: "Missing event ID. List events first." };
                  onUpdateEvent(safeArgs.id, {
                      ...(safeArgs.title && { title: safeArgs.title }),
                      ...(safeArgs.start && { start: new Date(safeArgs.start) }),
                      ...(safeArgs.end && { end: new Date(safeArgs.end) }),
                      ...(safeArgs.location && { location: safeArgs.location }),
                      ...(safeArgs.memberIds && { memberIds: normalizeIds(safeArgs.memberIds, safeArgs.memberId) }),
                  });
                  return { status: "success", message: "Event updated." };
              case 'delete_event':
                  if (!safeArgs.id) return { error: "Missing event ID." };
                  onDeleteEvent(safeArgs.id);
                  return { status: "success", message: "Event deleted." };
              case 'list_tasks':
                    return tasks.map(t => ({
                        id: t.id,
                        title: t.title,
                        type: t.type,
                        isCompleted: t.isCompleted,
                        assignees: members.filter(m => t.assigneeIds.includes(m.id)).map(m => m.name).join(', ')
                    }));
              case 'add_task':
                    if (!safeArgs.title) return { error: "Missing title. Ask the user what the task is." };
                    
                    const taskAssigneeIds = normalizeIds(safeArgs.assigneeIds, safeArgs.assignedTo);
                    if (taskAssigneeIds.length === 0) return { error: "Missing assignees. Ask who needs to do this task." };
                    
                    onAddTask({
                        title: safeArgs.title,
                        type: safeArgs.type || "general",
                        dueDate: safeArgs.dueDate ? new Date(safeArgs.dueDate) : undefined,
                        assigneeIds: taskAssigneeIds
                    });
                    return { status: "success", message: "Task added." };
              case 'update_task':
                    if (!safeArgs.id) return { error: "Missing task ID." };
                    onUpdateTask(safeArgs.id, {
                        ...(safeArgs.title && { title: safeArgs.title }),
                        ...(safeArgs.isCompleted !== undefined && { isCompleted: safeArgs.isCompleted }),
                        ...(safeArgs.dueDate && { dueDate: new Date(safeArgs.dueDate) }),
                        ...(safeArgs.assigneeIds && { assigneeIds: normalizeIds(safeArgs.assigneeIds, safeArgs.assignedTo) }),
                    });
                    return { status: "success", message: "Task updated." };
              case 'delete_task':
                    if (!safeArgs.id) return { error: "Missing task ID." };
                    onDeleteTask(safeArgs.id);
                    return { status: "success", message: "Task deleted." };
              default:
                  return { error: `Unknown function: ${name}` };
          }
      } catch (e) {
          console.error(e);
          return { error: `Tool execution error: ${String(e)}` };
      }
  };

  const handleAcceptRecommendation = (rec: Recommendation, turnId: string, index: number) => {
      if (rec.category === 'event') {
          onAddEvent({
              ...rec.data,
              start: rec.data.start ? new Date(rec.data.start) : new Date(),
              end: rec.data.end ? new Date(rec.data.end) : new Date(Date.now() + 3600000),
              memberIds: rec.data.memberIds || (rec.suggestedAssigneeId ? [rec.suggestedAssigneeId] : [members[0]?.id])
          });
      } else {
          onAddTask({
              ...rec.data,
              dueDate: rec.data.dueDate ? new Date(rec.data.dueDate) : new Date(),
              assigneeIds: rec.data.assigneeIds || (rec.suggestedAssigneeId ? [rec.suggestedAssigneeId] : [members[0]?.id])
          });
      }
      
      // Mark as accepted locally (remove from UI list)
      setRecommendations(prev => {
          const updated = [...(prev[turnId] || [])];
          updated.splice(index, 1);
          return { ...prev, [turnId]: updated };
      });
  };

  const handleSend = async (textOverride?: string) => {
    const userText = textOverride || input;
    if (!userText.trim()) return;

    if (!hasApiKey) {
        setMessages(prev => [...prev, 
            { id: Date.now().toString(), role: 'user', text: userText },
            { id: 'err', role: 'model', text: "API Key is missing. Please check your environment configuration." }
        ]);
        setInput('');
        return;
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const userMsgId = Date.now().toString();

    setMessages(prev => [...prev, { id: userMsgId, role: 'user', text: userText }]);
    setInput('');
    setIsProcessing(true);

    try {
        const historyForApi: Content[] = messages
            .filter(m => m.id !== 'err' && m.id !== 'welcome') 
            .map(m => {
                 const textPart = m.text || (m.thoughts ? `(Thought: ${m.thoughts})` : "Processed tool output.");
                 return {
                     role: m.role,
                     parts: [{ text: textPart }] 
                 };
            });

        const chatSession = ai.chats.create({
             model: 'gemini-2.5-flash',
             config: {
                 systemInstruction: `${SYSTEM_INSTRUCTION}\n\nCurrent Time: ${new Date().toString()}\nFamily Members: ${JSON.stringify(members.map(m => ({id: m.id, name: m.name})))}`,
                 tools: [{ functionDeclarations: toolsSchema }]
             },
             history: historyForApi
        });

        let currentMessagePayload: any = { message: userText };
        let activeResponseId = (Date.now() + 1).toString();
        
        let continueLoop = true;
        let turnCount = 0;
        const MAX_TURNS = 5; 

        while (continueLoop && turnCount < MAX_TURNS) {
            turnCount++;
            const currentTurnId = `${activeResponseId}_${turnCount}`;
            
            setMessages(prev => {
                return [...prev, { id: currentTurnId, role: 'model', text: '', isProcessing: true }];
            });

            const result = await chatSession.sendMessageStream(currentMessagePayload);
            
            let accumulatedText = "";
            let accumulatedToolCalls: any[] = [];

            for await (const chunk of result) {
                if (chunk.text) {
                    accumulatedText += chunk.text;
                    setMessages(prev => prev.map(m => m.id === currentTurnId ? { ...m, text: accumulatedText } : m));
                }
                if (chunk.functionCalls) {
                    accumulatedToolCalls.push(...chunk.functionCalls);
                }
            }

            if (accumulatedToolCalls.length > 0) {
                 setMessages(prev => prev.map(m => m.id === currentTurnId ? { 
                     ...m, 
                     text: '', 
                     thoughts: accumulatedText, 
                     isProcessing: true 
                 } : m));

                 const functionResponseParts: Part[] = [];
                 
                 for (const call of accumulatedToolCalls) {
                     const { name, args, id } = call;
                     
                     setMessages(prev => prev.map(m => m.id === currentTurnId ? { 
                        ...m, 
                        toolLogs: [...(m.toolLogs || []), { name, args }] 
                    } : m));

                     const executionResult = executeTool(name, args, currentTurnId);

                     functionResponseParts.push({
                        functionResponse: {
                            name: name,
                            response: { result: executionResult },
                            id: id
                        }
                     });
                 }
                 
                 currentMessagePayload = { message: functionResponseParts };
                 
                 setMessages(prev => prev.map(m => m.id === currentTurnId ? { ...m, isProcessing: false } : m));
                 
            } else {
                speak(accumulatedText);
                setMessages(prev => prev.map(m => m.id === currentTurnId ? { ...m, isProcessing: false } : m));
                continueLoop = false; 
            }
        }

    } catch (error) {
        console.error("AI Error:", error);
        setMessages(prev => prev.map(m => m.isProcessing ? { ...m, isProcessing: false } : m));
        setMessages(prev => [...prev, { id: 'err', role: 'model', text: "Sorry, I encountered an error. Please check your connection or API key." }]);
    } finally {
        setIsProcessing(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 p-4 rounded-full shadow-2xl z-50 transition-all hover:scale-105 ${isOpen ? 'bg-slate-800 text-white' : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'}`}
      >
        {isOpen ? <X size={24} /> : <Bot size={28} />}
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-6 w-[380px] h-[640px] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col z-50 overflow-hidden animate-slide-up origin-bottom-right">
           <div className="bg-slate-900 p-5 flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center border-2 border-white/20">
                    <Sparkles size={20} className="text-white animate-pulse" />
                 </div>
                 <div>
                    <h3 className="font-bold text-lg leading-tight">FamilyBot</h3>
                    <div className="text-[10px] text-slate-400 font-medium uppercase tracking-widest flex items-center gap-1">
                        {hasApiKey ? (
                             <span className="flex items-center gap-1 text-green-400"><Wifi size={10} /> Connected</span>
                        ) : (
                             <span className="flex items-center gap-1 text-red-400"><WifiOff size={10} /> Offline</span>
                        )}
                    </div>
                 </div>
              </div>
              <button 
                onClick={() => setIsSpeaking(!isSpeaking)} 
                className={`p-2 rounded-full hover:bg-white/10 transition-colors ${!isSpeaking ? 'text-slate-500' : 'text-blue-400 bg-white/5'}`}
              >
                 {isSpeaking ? <Volume2 size={20} /> : <VolumeX size={20} />}
              </button>
           </div>

           <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 custom-scrollbar">
              {messages.map((msg) => (
                  <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                      {msg.thoughts && (
                          <div className="max-w-[85%] mb-2 bg-indigo-50 text-indigo-600 p-3 rounded-2xl rounded-bl-none text-xs italic border border-indigo-100 flex gap-2">
                             <BrainCircuit size={14} className="flex-none mt-0.5" />
                             <div className="whitespace-pre-wrap">{msg.thoughts}</div>
                          </div>
                      )}

                      {msg.toolLogs && (
                          <div className="mb-2 w-full max-w-[90%]">
                              {msg.toolLogs.map((log, idx) => (
                                  <div key={idx} className="bg-slate-800 text-slate-300 rounded-lg p-2 text-[10px] font-mono mb-1 animate-fade-in flex flex-col gap-1 border border-slate-700 shadow-sm">
                                      <div className="flex items-center gap-2">
                                          <Terminal size={12} className="text-blue-400" />
                                          <span className="font-bold text-blue-300">{log.name}</span>
                                      </div>
                                      {log.args && (
                                          <div className="pl-4 border-l border-slate-700 ml-1 opacity-70 break-all text-[9px]">
                                              {JSON.stringify(log.args, null, 1)}
                                          </div>
                                      )}
                                  </div>
                              ))}
                          </div>
                      )}

                      {msg.text && (
                          <div className={`max-w-[90%] p-4 rounded-2xl text-sm shadow-sm whitespace-pre-wrap leading-relaxed ${
                              msg.role === 'user' 
                              ? 'bg-blue-600 text-white rounded-br-none' 
                              : 'bg-white text-slate-800 border border-slate-100 rounded-bl-none'
                          }`}>
                              {msg.text}
                          </div>
                      )}

                      {/* Recommendations UI */}
                      {recommendations[msg.id] && recommendations[msg.id].length > 0 && (
                          <div className="mt-3 w-full space-y-2 animate-fade-in">
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Quick Recommendations</div>
                              {recommendations[msg.id].map((rec, idx) => (
                                  <div key={idx} className="bg-white border border-blue-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all group border-l-4 border-l-blue-500">
                                      <div className="flex justify-between items-start gap-3">
                                          <div className="flex-1">
                                              <div className="flex items-center gap-2 mb-1">
                                                  <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${rec.category === 'event' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                      {rec.category}
                                                  </span>
                                                  <h4 className="font-bold text-slate-800 text-sm">{rec.title}</h4>
                                              </div>
                                              <p className="text-xs text-slate-500 leading-snug">{rec.description}</p>
                                          </div>
                                          <button 
                                              onClick={() => handleAcceptRecommendation(rec, msg.id, idx)}
                                              className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                          >
                                              <PlusCircle size={20} />
                                          </button>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
              ))}
              
              {isProcessing && !messages.find(m => m.isProcessing && m.text)?.text && (
                  <div className="flex justify-start">
                      <div className="bg-white px-4 py-2 rounded-2xl rounded-bl-none border border-slate-100 shadow-sm flex items-center gap-2 text-slate-400 text-xs">
                         <Loader2 size={16} className="animate-spin" /> Thinking...
                      </div>
                  </div>
              )}
              <div ref={chatEndRef} />
           </div>

           <div className="p-4 bg-white border-t border-slate-100">
              <div className="flex items-center gap-2">
                 <button 
                    onClick={() => handleSend("Can you recommend some family activities or tasks for this week?")}
                    className="p-3 bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-all"
                    title="Get Recommendations"
                 >
                    <Sparkles size={20} />
                 </button>
                 <input 
                    type="text" 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Ask FamilyBot..." 
                    className="flex-1 bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 ring-blue-500/20 outline-none placeholder:text-slate-400"
                    disabled={isProcessing}
                 />
                 
                 <button 
                    onClick={handleVoiceInput}
                    disabled={isProcessing}
                    className={`p-3 rounded-2xl transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                 >
                    <Mic size={20} />
                 </button>
                 
                 <button 
                    onClick={() => handleSend()}
                    disabled={!input.trim() || isProcessing}
                    className="p-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition-all active:scale-95"
                 >
                    {isProcessing ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                 </button>
              </div>
           </div>
        </div>
      )}
    </>
  );
};

export default AIAssistant;
