import React, { useState } from 'react';
import { Sparkles, Loader2, Mic } from 'lucide-react';
import { parseNaturalLanguage } from '../services/geminiService';
import { CalendarEvent, ToDoTask, NaturalLanguageResult } from '../types';

interface SmartInputProps {
  onParsed: (result: NaturalLanguageResult) => void;
}

const SmartInput: React.FC<SmartInputProps> = ({ onParsed }) => {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showMicFeedback, setShowMicFeedback] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    setIsProcessing(true);
    const result = await parseNaturalLanguage(input);
    setIsProcessing(false);

    if (result) {
        onParsed(result);
        setInput('');
    } else {
        alert("Sorry, I couldn't understand that. Please try again.");
    }
  };

  const simulateMic = () => {
    // Simulation of voice input (since browser SpeechRecognition API varies)
    setShowMicFeedback(true);
    setTimeout(() => {
        setShowMicFeedback(false);
        setInput("Buy milk and eggs tomorrow morning");
    }, 1500);
  }

  return (
    <div className="relative">
      <form onSubmit={handleSubmit} className="relative group">
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
            <Sparkles size={18} className={isProcessing ? "animate-pulse text-blue-500" : ""} />
        </div>
        
        <input 
            type="text" 
            value={showMicFeedback ? "Listening..." : input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask AI: 'Soccer practice for Leo tomorrow at 5pm' or 'Buy Milk'" 
            className={`w-full pl-10 pr-24 py-3 rounded-xl border border-slate-200 bg-white/80 backdrop-blur shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-slate-400 text-slate-700 ${showMicFeedback ? 'animate-pulse' : ''}`}
            disabled={isProcessing}
        />

        <div className="absolute inset-y-0 right-2 flex items-center gap-1">
             <button 
                type="button"
                onClick={simulateMic}
                className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                title="Voice Input (Simulation)"
            >
                <Mic size={18} />
            </button>
            <button 
                type="submit"
                disabled={!input.trim() || isProcessing}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
                {isProcessing ? <Loader2 size={16} className="animate-spin" /> : 'Add'}
            </button>
        </div>
      </form>
      
      {/* Helper text for user */}
      <div className="absolute -bottom-6 left-2 text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
          Powered by Gemini 2.5 Flash
      </div>
    </div>
  );
};

export default SmartInput;