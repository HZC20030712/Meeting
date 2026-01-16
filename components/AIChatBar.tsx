
import React, { useState, useRef, useEffect } from 'react';

interface AIChatBarProps {
  className?: string;
}

const AIChatBar: React.FC<AIChatBarProps> = ({ className = '' }) => {
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [inputValue, setInputValue] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    setIsLoading(true);
    setResponse(''); // Clear previous response

    try {
      const res = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: inputValue }),
      });

      if (!res.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await res.json();
      setResponse(data.response);
    } catch (error) {
      console.error('Error sending message:', error);
      setResponse('抱歉，AI 暂时无法响应，请稍后再试。');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`absolute left-0 right-0 p-6 pb-10 bg-gradient-to-t from-white via-white/95 to-transparent pointer-events-none z-40 ${className || 'bottom-0'}`}>
      <div 
        ref={containerRef}
        className="max-w-xl mx-auto pointer-events-auto transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]"
      >
        {!isFocused ? (
          <div className="relative group cursor-text" onClick={() => setIsFocused(true)}>
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-400/20 to-teal-400/20 rounded-full blur opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="relative flex items-center gap-3 bg-white border border-gray-200 rounded-full p-1.5 pl-6 pr-1.5 shadow-lg shadow-gray-200/40 hover:border-gray-300 transition-all">
              <span className="flex-1 text-sm text-gray-400 truncate">问问关于会议的任何事情...</span>
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-full border border-gray-100 text-[11px] font-bold text-gray-500">
                  <i className="fa-solid fa-bolt text-teal-500"></i>
                  AI 智能
                </div>
                <div className="w-10 h-10 bg-gray-900 rounded-full flex items-center justify-center text-white shadow-md">
                  <i className="fa-solid fa-arrow-up text-sm"></i>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-[#fcfcfc] border border-gray-100 rounded-[44px] p-2 shadow-[0_20px_50px_rgba(0,0,0,0.1)] animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center justify-around px-4 pt-3 pb-4 overflow-x-auto no-scrollbar gap-2">
              <SuggestionChip icon="fa-paper-plane" color="bg-orange-50 text-orange-500" label="每周回顾" />
              <SuggestionChip icon="fa-list-ul" color="bg-green-50 text-green-500" label="待办清单" />
              <SuggestionChip icon="fa-lightbulb" color="bg-yellow-50 text-yellow-600" label="内容提炼" />
            </div>

            <div className="relative bg-white rounded-[32px] border-[1.5px] border-teal-100 p-5 flex flex-col min-h-[160px]">
              <div className="flex items-center mb-4">
                <button className="flex items-center gap-2 px-3 py-1 bg-gray-50 border border-gray-100 rounded-full text-[11px] font-bold text-gray-700">
                  <span>我的笔记</span>
                  <i className="fa-solid fa-chevron-down text-[8px] text-gray-300"></i>
                </button>
              </div>

              <textarea 
                autoFocus
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="输入指令..."
                className="w-full flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-300 focus:outline-none resize-none leading-relaxed font-medium"
              />

              {response && (
                <div className="mt-4 p-3 bg-blue-50 rounded-xl text-sm text-gray-700 leading-relaxed animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex items-center gap-2 mb-1 text-xs font-bold text-blue-500 uppercase tracking-wider">
                    <i className="fa-solid fa-sparkles"></i>
                    AI 回答
                  </div>
                  {response}
                </div>
              )}

              <div className="flex items-center justify-end gap-5 mt-2">
                <button className="text-gray-300">
                  <i className="fa-solid fa-paperclip text-lg"></i>
                </button>
                <button 
                  onClick={handleSend}
                  disabled={isLoading || !inputValue.trim()}
                  className={`w-12 h-12 rounded-full flex items-center justify-center border shadow-sm transition-all
                    ${isLoading || !inputValue.trim() 
                      ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed' 
                      : 'bg-blue-500 text-white border-blue-600 hover:bg-blue-600 hover:shadow-md cursor-pointer'
                    }`}
                >
                  {isLoading ? (
                    <i className="fa-solid fa-circle-notch fa-spin text-lg"></i>
                  ) : (
                    <i className="fa-solid fa-paper-plane text-lg"></i>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const SuggestionChip: React.FC<{ icon: string, color: string, label: string }> = ({ icon, color, label }) => (
  <button className="flex items-center gap-2 px-2.5 py-1 rounded-full hover:bg-gray-100 transition-all shrink-0">
    <div className={`w-5 h-5 ${color} rounded-md flex items-center justify-center text-[10px]`}>
      <i className={`fa-solid ${icon}`}></i>
    </div>
    <span className="text-[11px] font-bold text-gray-600 whitespace-nowrap">{label}</span>
  </button>
);

export default AIChatBar;
