
import React, { useState } from 'react';
import { Meeting, TranscriptSegment } from '../types';

interface MeetingDetailProps {
  meeting: Meeting;
  onBack: () => void;
}

type TabType = 'guide' | 'mindmap' | 'notes';

const SpeakerTag: React.FC<{
  speakerId: string | undefined;
  speakerMap: Record<string, string>;
  onUpdateName: (speakerId: string | undefined, name: string, isGlobal: boolean) => void;
}> = ({ speakerId, speakerMap, onUpdateName }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState('');
  const [editMode, setEditMode] = useState<'global' | 'local'>('global');

  const displayName =
    (speakerId ? speakerMap[speakerId] : undefined) ||
    (speakerId ? undefined : speakerMap['unknown_speaker_default']) ||
    speakerId ||
    '未知发言人';

  const handleStartEdit = () => {
    setTempName(displayName);
    setIsEditing(true);
  };

  const handleSave = () => {
    if (tempName.trim()) {
      onUpdateName(speakerId, tempName.trim(), editMode === 'global');
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="relative inline-block">
        <div className="absolute top-0 left-0 z-50 bg-white shadow-lg rounded-lg border border-blue-100 p-3 min-w-[200px] animate-in fade-in zoom-in-95 duration-200">
          <input
            autoFocus
            className="text-sm text-gray-800 font-medium border border-blue-300 rounded px-2 py-1 w-full outline-none focus:ring-2 focus:ring-blue-400 mb-2"
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            placeholder="输入发言人姓名"
          />
          <div className="flex flex-col gap-1 mb-3">
             <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer hover:bg-gray-50 p-1 rounded">
               <input 
                 type="radio" 
                 name="editMode" 
                 checked={editMode === 'global'} 
                 onChange={() => setEditMode('global')}
                 className="text-blue-500 focus:ring-blue-400"
               />
               <span>修改所有同名发言人 (全局)</span>
             </label>
             <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer hover:bg-gray-50 p-1 rounded">
               <input 
                 type="radio" 
                 name="editMode" 
                 checked={editMode === 'local'} 
                 onChange={() => setEditMode('local')}
                 className="text-blue-500 focus:ring-blue-400"
               />
               <span>仅修改此处 (局部)</span>
             </label>
          </div>
          <div className="flex justify-end gap-2">
            <button 
              onClick={(e) => { e.stopPropagation(); setIsEditing(false); }}
              className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded"
            >
              取消
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); handleSave(); }}
              className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 shadow-sm"
            >
              保存
            </button>
          </div>
        </div>
        {/* Backdrop to close on click outside */}
        <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setIsEditing(false); }}></div>
      </div>
    );
  }

  return (
    <span 
      className="text-xs text-gray-400 font-medium cursor-pointer hover:text-blue-500 hover:underline decoration-dashed underline-offset-2 transition-colors relative"
      onClick={handleStartEdit}
      title="点击修改发言人姓名"
    >
      {displayName}
    </span>
  );
};

const MeetingDetail: React.FC<MeetingDetailProps> = ({ meeting, onBack }) => {
  const [activeTab, setActiveTab] = useState<TabType>('guide');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [speakerMap, setSpeakerMap] = useState<Record<string, string>>(meeting.speakerMap || {});
  
  // Use local state for segments to allow local edits
  const [localSegments, setLocalSegments] = useState<TranscriptSegment[]>(
    meeting.segments || [
      { id: '1', type: 'user', content: '好的。', startTime: '01:12:09', speaker: '发言人 2' },
      { id: '2', type: 'user', content: '你跟他们聊，我们跟他聊聊。', startTime: '01:12:13', speaker: '发言人 4' },
      { id: '3', type: 'user', content: '前面咨询你这两个岗位。', startTime: '01:12:16', speaker: '发言人 1' },
      { id: '4', type: 'user', content: '你先自己先聊。好的，没问题。', startTime: '01:12:18', speaker: '发言人 2' },
      { id: '5', type: 'user', content: '好，拜拜。好，再见蔡总。', startTime: '01:12:20', speaker: '发言人 4' },
    ]
  );

  const handleUpdateSpeaker = (segmentId: string, originalSpeakerId: string | undefined, name: string, isGlobal: boolean) => {
    if (isGlobal) {
        // Global mode: Update the name in the map for the existing speaker ID
        const targetId = originalSpeakerId || 'unknown_speaker_default'; 
        
        // If originalSpeakerId is undefined, we must update all segments that have undefined speaker to use targetId
        if (!originalSpeakerId) {
            setLocalSegments(prev => prev.map(seg => {
                if (!seg.speaker) {
                    return { ...seg, speaker: targetId };
                }
                return seg;
            }));
            
            // Also update meeting.segments for persistence
            if (meeting.segments) {
                meeting.segments.forEach(seg => {
                    if (!seg.speaker) seg.speaker = targetId;
                });
            }
        }

        const newMap = { ...speakerMap, [targetId]: name };
        setSpeakerMap(newMap);
        meeting.speakerMap = newMap;
    } else {
        // Local mode: 
        // 1. Generate new unique speaker ID for this segment
        // 2. Update the segment to point to this new ID
        // 3. Add the new ID -> Name mapping
        
        const newSpeakerId = `${originalSpeakerId || 'unknown'}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        
        // Update local segments
        setLocalSegments(prev => prev.map(seg => {
            if (seg.id === segmentId) {
                return { ...seg, speaker: newSpeakerId };
            }
            return seg;
        }));
        
        // Update map
        const newMap = { ...speakerMap, [newSpeakerId]: name };
        setSpeakerMap(newMap);
        meeting.speakerMap = newMap;
        
        // Note: We should ideally update meeting.segments too for persistence, 
        // but since we are using local state, we rely on localSegments for rendering.
        // For simple persistence in this mock:
        if (meeting.segments) {
             const segIndex = meeting.segments.findIndex(s => s.id === segmentId);
             if (segIndex !== -1) {
                 meeting.segments[segIndex].speaker = newSpeakerId;
             }
        }
    }
  };

  // Deprecated direct usage of segments, now using localSegments
  // const segments: TranscriptSegment[] = meeting.segments || ...

  const keywords = meeting.keywords || ['合作', '签约', '业务', '客户', '运营', 'AI', '咨询', '面诊', '手术'];

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // TODO: Add Loading State
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:8000/api/asr/file', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Transcription failed');

      const data = await response.json();
      if (data.status === 'succeeded' && data.segments) {
         setLocalSegments(data.segments);
         // Reset map if needed or merge
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("上传转写失败，请检查后端日志");
    }
  };

  return (
    <div className="h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="h-14 border-b border-gray-100 flex items-center justify-between px-4 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          <div>
            <h1 className="text-base font-medium text-gray-900">{meeting.title}</h1>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>{meeting.date}</span>
              <span>·</span>
              <span>{meeting.duration}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">

          <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 transition-colors">
            <i className="fa-solid fa-share-nodes"></i>
          </button>
          <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 transition-colors">
            <i className="fa-solid fa-ellipsis"></i>
          </button>
        </div>
      </div>

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
              {localSegments.map((segment, index) => (
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
                    <SpeakerTag 
                      speakerId={segment.speaker} 
                      speakerMap={speakerMap} 
                      onUpdateName={(speakerId, name, isGlobal) => handleUpdateSpeaker(segment.id, speakerId, name, isGlobal)}
                    />
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
