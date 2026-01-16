
import React, { useState } from 'react';
import { Meeting, TranscriptSegment } from '../types';

interface MeetingDetailProps {
  meeting: Meeting;
  onBack: () => void;
}

type TabType = 'guide' | 'mindmap' | 'notes';

const MeetingDetail: React.FC<MeetingDetailProps> = ({ meeting, onBack }) => {
  const [activeTab, setActiveTab] = useState<TabType>('guide');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // Mock data if segments are missing (for old mock meetings)
  const segments: TranscriptSegment[] = meeting.segments || [
    { id: '1', type: 'user', content: '好的。', startTime: '01:12:09', speaker: '发言人 2' },
    { id: '2', type: 'user', content: '你跟他们聊，我们跟他聊聊。', startTime: '01:12:13', speaker: '发言人 4' },
    { id: '3', type: 'user', content: '前面咨询你这两个岗位。', startTime: '01:12:16', speaker: '发言人 1' },
    { id: '4', type: 'user', content: '你先自己先聊。好的，没问题。', startTime: '01:12:18', speaker: '发言人 2' },
    { id: '5', type: 'user', content: '好，拜拜。好，再见蔡总。', startTime: '01:12:20', speaker: '发言人 4' },
  ];

  const keywords = meeting.keywords || ['合作', '签约', '业务', '客户', '运营', 'AI', '咨询', '面诊', '手术'];

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white z-10">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-600"
          >
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          <h1 className="text-xl font-bold text-gray-800">{meeting.title}</h1>
        </div>
        <div className="flex items-center gap-3">
          <button className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-50 text-gray-500 hover:text-gray-700 transition-colors">
            <i className="fa-solid fa-ellipsis"></i>
          </button>
          <button className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-50 text-gray-500 hover:text-gray-700 transition-colors">
            <i className="fa-regular fa-star"></i>
          </button>
          <button className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-50 text-gray-500 hover:text-gray-700 transition-colors">
            <i className="fa-regular fa-file-lines"></i>
          </button>
          <button className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-50 text-gray-500 hover:text-gray-700 transition-colors">
            <i className="fa-solid fa-share-nodes"></i>
          </button>
          <button className="px-4 py-1.5 bg-[#F0F9FF] text-[#33a3dc] rounded-lg text-sm font-semibold hover:bg-[#E1F3FF] transition-colors flex items-center gap-2">
            <i className="fa-solid fa-download"></i> 导出
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Right Column: AI Analysis (Moved to Left) */}
        <div className="w-[400px] border-r border-gray-100 bg-white flex flex-col">
          <div className="flex border-b border-gray-100">
            <button 
              onClick={() => setActiveTab('guide')}
              className={`flex-1 py-4 text-sm font-semibold relative ${activeTab === 'guide' ? 'text-gray-800' : 'text-gray-400'}`}
            >
              导读
              {activeTab === 'guide' && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-gray-800 rounded-full"></div>}
            </button>
            <button 
              onClick={() => setActiveTab('mindmap')}
              className={`flex-1 py-4 text-sm font-semibold relative ${activeTab === 'mindmap' ? 'text-gray-800' : 'text-gray-400'}`}
            >
              脑图
            </button>
            <button 
              onClick={() => setActiveTab('notes')}
              className={`flex-1 py-4 text-sm font-semibold relative ${activeTab === 'notes' ? 'text-gray-800' : 'text-gray-400'}`}
            >
              笔记
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {/* Keywords */}
            <section>
              <h3 className="text-sm font-bold text-gray-800 mb-4">关键词</h3>
              <div className="flex flex-wrap gap-2">
                {keywords.map((kw, i) => (
                  <span key={i} className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100 cursor-pointer transition-colors">
                    {kw}
                  </span>
                ))}
                <button className="text-xs text-blue-500 ml-auto mt-1 hover:underline">展开全部</button>
              </div>
            </section>

            {/* Summary */}
            <section>
              <h3 className="text-sm font-bold text-gray-800 mb-4">全文概要</h3>
              <p className="text-sm text-gray-400 italic">
                {meeting.summary || '没有总结内容哦'}
              </p>
            </section>

            {/* Chapters */}
            <section>
              <div className="flex items-center gap-6 border-b border-gray-100 mb-4">
                <h3 className="text-sm font-bold text-gray-800 border-b-2 border-gray-800 pb-2 -mb-[1px]">章节速览</h3>
                <h3 className="text-sm font-bold text-gray-400 pb-2 cursor-pointer hover:text-gray-600">发言总结</h3>
                <h3 className="text-sm font-bold text-gray-400 pb-2 cursor-pointer hover:text-gray-600">问答回顾</h3>
              </div>
              
              <div className="space-y-6">
                <div className="flex gap-3 group cursor-pointer">
                   <span className="text-xs text-gray-400 font-mono mt-0.5">00:00</span>
                   <div className="w-2 relative">
                     <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-gray-200 group-hover:bg-blue-400 transition-colors"></div>
                     <div className="absolute top-3 left-1/2 -translate-x-1/2 w-[1px] h-full bg-gray-100"></div>
                   </div>
                   <div className="flex-1 pb-4">
                     <h4 className="text-sm font-bold text-gray-700 mb-2 group-hover:text-blue-600 transition-colors">西安地区合作与签约事宜讨论</h4>
                     <p className="text-xs text-gray-500 leading-relaxed">
                       对话围绕在西安地区的合作项目展开，提及了收入限制、签约流程及其后续影响，双方就合作细节进行了交流。
                     </p>
                   </div>
                </div>

                <div className="flex gap-3 group cursor-pointer">
                   <span className="text-xs text-gray-400 font-mono mt-0.5">36:34</span>
                   <div className="w-2 relative">
                     <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-gray-200 group-hover:bg-blue-400 transition-colors"></div>
                     <div className="absolute top-3 left-1/2 -translate-x-1/2 w-[1px] h-full bg-gray-100"></div>
                   </div>
                   <div className="flex-1 pb-4">
                     <h4 className="text-sm font-bold text-gray-700 mb-2 group-hover:text-blue-600 transition-colors">业务合作与AI服务探讨</h4>
                     <p className="text-xs text-gray-500 leading-relaxed">
                       对话围绕业务合作与AI服务展开，讨论了执行过程中的挑战、对业务的深入理解。
                     </p>
                   </div>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* Left Column: Transcript (Moved to Right) */}
        <div className="flex-1 overflow-y-auto bg-[#FAFAFA] p-6 relative">
          <div className="max-w-3xl mx-auto bg-white min-h-full rounded-2xl shadow-sm p-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-lg font-bold text-gray-800">语音转文字</h2>
              <div className="flex items-center gap-3">
                <i className="fa-solid fa-magnifying-glass text-gray-400 hover:text-gray-600 cursor-pointer"></i>
                <i className="fa-regular fa-file-lines text-gray-400 hover:text-gray-600 cursor-pointer"></i>
                <i className="fa-solid fa-filter text-gray-400 hover:text-gray-600 cursor-pointer"></i>
                <i className="fa-solid fa-pen-to-square text-gray-400 hover:text-gray-600 cursor-pointer"></i>
              </div>
            </div>

            <div className="space-y-8">
              {segments.map((segment, index) => (
                <div key={segment.id || index} className="group">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs text-white ${
                      segment.speaker?.includes('1') ? 'bg-red-400' :
                      segment.speaker?.includes('2') ? 'bg-yellow-400' :
                      segment.speaker?.includes('4') ? 'bg-green-400' : 'bg-blue-400'
                    }`}>
                      {/* Avatar Placeholder */}
                      <i className="fa-solid fa-user"></i>
                    </div>
                    <span className="text-xs text-gray-400 font-medium">
                      {segment.speaker || '未知发言人'}
                    </span>
                    <span className="text-xs text-gray-300">
                      {segment.startTime || formatTime(index * 15)}
                    </span>
                  </div>
                  <div className="pl-11">
                    <p className="text-gray-700 leading-relaxed hover:bg-blue-50/50 p-2 -ml-2 rounded-lg transition-colors cursor-text">
                      {segment.content}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Scroll padding for bottom player */}
            <div className="h-32"></div>
          </div>
          
          {/* Floating Action Buttons */}
          <div className="absolute bottom-32 right-12 flex flex-col gap-3">
             <button className="w-10 h-10 rounded-full bg-gray-800 text-white shadow-lg flex items-center justify-center hover:bg-gray-700 transition-colors">
               <i className="fa-solid fa-arrow-up"></i>
             </button>
             <button className="w-10 h-10 rounded-full bg-gray-800 text-white shadow-lg flex items-center justify-center hover:bg-gray-700 transition-colors">
               <i className="fa-solid fa-crosshairs"></i>
             </button>
          </div>
        </div>
      </div>

      {/* Bottom Player */}
      <div className="h-24 bg-white border-t border-gray-100 flex items-center px-6 gap-6 shadow-[0_-4px_20px_rgba(0,0,0,0.02)] z-20">
        <div className="flex items-center gap-4">
          <button className="w-8 h-8 rounded-full border border-blue-500 text-blue-500 flex items-center justify-center hover:bg-blue-50 transition-colors text-sm">
             <i className="fa-solid fa-rotate-left"></i>
          </button>
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition-colors shadow-md shadow-blue-200"
          >
            {isPlaying ? <i className="fa-solid fa-pause text-lg"></i> : <i className="fa-solid fa-play text-lg ml-1"></i>}
          </button>
          <button className="w-8 h-8 rounded-full border border-blue-500 text-blue-500 flex items-center justify-center hover:bg-blue-50 transition-colors text-sm">
             <i className="fa-solid fa-rotate-right"></i>
          </button>
        </div>

        <div className="flex-1 flex flex-col gap-2">
           {/* Mock Waveform */}
           <div className="h-8 flex items-end gap-[2px] opacity-30">
             {Array.from({ length: 100 }).map((_, i) => (
               <div 
                 key={i} 
                 className="w-1 bg-blue-500 rounded-t-sm" 
                 style={{ 
                   height: `${20 + Math.random() * 80}%`,
                   opacity: i / 100 > currentTime / 100 ? 0.3 : 1 
                 }}
               ></div>
             ))}
           </div>
           {/* Progress Bar */}
           <div className="relative h-1 bg-gray-100 rounded-full cursor-pointer group">
             <div 
               className="absolute top-0 left-0 h-full bg-blue-500 rounded-full" 
               style={{ width: `${(currentTime / 100) * 100}%` }}
             ></div>
             <div 
               className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-blue-600 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
               style={{ left: `${(currentTime / 100) * 100}%` }}
             ></div>
           </div>
           <div className="flex justify-between text-[10px] text-gray-400 font-mono">
             <span>{formatTime(currentTime * 60)}</span>
             <span>{meeting.duration || '01:30:00'}</span>
           </div>
        </div>

        <div className="flex items-center gap-4 text-blue-500 text-sm font-semibold">
          <button className="hover:text-blue-700 transition-colors">倍速</button>
          <button className="hover:text-blue-700 transition-colors"><i className="fa-solid fa-sliders"></i></button>
        </div>
      </div>
    </div>
  );
};

export default MeetingDetail;
