
import React, { useEffect, useState } from 'react';
import DeepAnalysisConfigModal from './DeepAnalysisConfigModal';
import DeepAnalysisList from './DeepAnalysisList';
import PersonaHeader from './PersonaHeader';
import SmartChapters from './SmartChapters';
import { Meeting, TranscriptSegment, AnalysisResult, ChaptersResult, DeepInsightResult, FullSummaryResult } from '../types';
import { Sparkles, MessageCircle, User } from 'lucide-react';

interface MeetingDetailProps {
  meeting: Meeting;
  onBack: () => void;
}

type TabType = 'summary' | 'analysis';

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
  const [activeTab, setActiveTab] = useState<TabType>('summary');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [speakerMap, setSpeakerMap] = useState<Record<string, string>>(meeting.speakerMap || {});
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(meeting.analysisResult || null);
  const [chaptersResult, setChaptersResult] = useState<ChaptersResult | null>(meeting.chapters || null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Use local state for segments to allow local edits
  const [localSegments, setLocalSegments] = useState<TranscriptSegment[]>(
    meeting.segments || []
  );
  
  // Safe parsing for full_summary analysis result
  const [fullSummaryResult, setFullSummaryResult] = useState<FullSummaryResult | null>(() => {
    if (meeting.analysis_result && (meeting.analysis_result as any).mode === 'full_summary') {
        return meeting.analysis_result as FullSummaryResult;
    }
    return null;
  });

  useEffect(() => {
    setSpeakerMap(meeting.speakerMap || {});
    setAnalysisResult(meeting.analysisResult || null);
    setChaptersResult(meeting.chapters || null);
    setLocalSegments(meeting.segments || []);
    if (meeting.analysis_result && (meeting.analysis_result as any).mode === 'full_summary') {
        setFullSummaryResult(meeting.analysis_result as FullSummaryResult);
    } else {
        setFullSummaryResult(null);
    }
  }, [meeting.id, meeting.analysis_result, meeting.chapters, meeting.segments, meeting.speakerMap]);

  useEffect(() => {
    if (localSegments.length === 0 && meeting.segments && meeting.segments.length > 0) {
      setLocalSegments(meeting.segments);
    }
  }, [meeting.segments, localSegments.length]);

  const handleUpdateSpeaker = async (segmentId: string, originalSpeakerId: string | undefined, name: string, isGlobal: boolean) => {
    if (isGlobal) {
        // Global mode: Update the name in the map for the existing speaker ID
        const targetId = originalSpeakerId || 'unknown_speaker_default'; 
        
        // Optimistic Update
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
        
        // Persist to Backend
        try {
            await fetch(`http://localhost:8000/api/meetings/${meeting.id}/speakers`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ original_name: targetId, new_name: name })
            });
        } catch (e) {
            console.error("Failed to persist speaker name", e);
            // Optionally revert optimistic update or show toast
        }

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

  const handleQuickSummary = () => {
    // One-click generation with default full_summary preset
    const config = {
        preset_id: 'full_summary',
        speaker_map: speakerMap,
        ignored_speakers: [],
        custom_requirement: ''
    };
    handleStartAnalysis(config);
  };

  const handleStartAnalysis = async (config: any) => {
    setIsAnalysisModalOpen(false);
    setIsAnalyzing(true);
    setActiveTab('analysis');
    
    // Update local speaker map first if changed
    setSpeakerMap(prev => ({ ...prev, ...config.speaker_map }));
    
    try {
        const res = await fetch(`http://localhost:8000/api/meetings/${meeting.id}/analysis`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        const data = await res.json();
        if (data.status === 'success') {
            if (config.preset_id === 'full_summary') {
                // Update local state for immediate feedback
                if (data.result.chapters) {
                    setChaptersResult({ chapters: data.result.chapters });
                }
                setFullSummaryResult({
                    mode: 'full_summary',
                    speaker_summaries: data.result.speaker_summaries,
                    qa_pairs: data.result.qa_pairs
                });
                
                // Update keywords and summary in meeting object (optimistic)
                if (data.result.keywords) meeting.keywords = data.result.keywords;
                if (data.result.abstract) meeting.summary = data.result.abstract;
                
                setActiveTab('summary');
            } else if (config.preset_id === 'chapters') {
                setChaptersResult(data.result);
                setActiveTab('summary'); // Switch to guide to see chapters
            } else {
                setAnalysisResult(data.result);
                setActiveTab('analysis'); // Switch to analysis
            }
        } else {
            alert('分析失败: ' + (data.detail || '未知错误'));
        }
    } catch (e) {
        console.error(e);
        alert('分析请求失败，请检查网络或后端日志');
    } finally {
        setIsAnalyzing(false);
    }
  };

  const uniqueSpeakers = Array.from(new Set(localSegments.map(s => s.speaker || 'unknown_speaker_default')));

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
          <label className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium cursor-pointer hover:bg-blue-100 transition-colors">
            <i className="fa-solid fa-cloud-arrow-up"></i>
            <span>导入录音文件</span>
            <input type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} />
          </label>
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
              onClick={() => setActiveTab('summary')}
              className={`flex-1 py-4 text-sm font-semibold relative ${activeTab === 'summary' ? 'text-gray-800' : 'text-gray-400'}`}
            >
              总结
              {activeTab === 'summary' && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-gray-800 rounded-full"></div>}
            </button>
            <button 
              onClick={() => setActiveTab('analysis')}
              className={`flex-1 py-4 text-sm font-semibold relative ${activeTab === 'analysis' ? 'text-gray-800' : 'text-gray-400'}`}
            >
              深度解读
              {activeTab === 'analysis' && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-gray-800 rounded-full"></div>}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {activeTab === 'analysis' ? (
              <div className="space-y-4">
                 <div className="flex justify-between items-center mb-4">
                   <h3 className="text-sm font-bold text-gray-800">深度解读</h3>
                   {!analysisResult && (
                     <button 
                       onClick={() => setIsAnalysisModalOpen(true)}
                       className="text-xs bg-blue-500 text-white px-3 py-1.5 rounded-lg hover:bg-blue-600 transition-colors shadow-sm"
                     >
                       开始解读
                     </button>
                   )}
                   {analysisResult && (
                      <button 
                       onClick={() => setIsAnalysisModalOpen(true)}
                       className="text-xs text-blue-500 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                     >
                       重新生成
                     </button>
                   )}
                 </div>
                 
                 {isAnalyzing ? (
                   <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                     <i className="fa-solid fa-spinner fa-spin text-2xl mb-2 text-blue-500"></i>
                     <span className="text-xs">AI 正在深度分析中...</span>
                   </div>
                 ) : (
                   <DeepAnalysisList 
                     analysisResult={analysisResult} 
                     speakerMap={speakerMap} 
                     onSeek={(time) => {
                        const parts = time.split(':').map(Number);
                        let seconds = 0;
                        if (parts.length === 3) seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
                        else if (parts.length === 2) seconds = parts[0] * 60 + parts[1];
                        setCurrentTime(seconds);
                     }} 
                   />
                 )}
              </div>
            ) : (
              <>
                {/* Keywords */}
                <section>
                  <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Sparkles size={14} className="text-blue-500" /> 关键词
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {/* Show skeletons if analyzing */}
                    {isAnalyzing ? (
                        Array.from({length: 5}).map((_, i) => (
                             <div key={i} className="h-6 w-16 bg-gray-100 rounded animate-pulse"></div>
                        ))
                    ) : (
                        (meeting.keywords || ['合作', '签约', '业务', '客户', '运营', 'AI', '咨询', '面诊', '手术']).map((kw, i) => (
                        <span key={i} className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100 cursor-pointer transition-colors">
                            {kw}
                        </span>
                        ))
                    )}
                  </div>
                </section>
    
                {/* Summary */}
                <section>
                  <h3 className="text-sm font-bold text-gray-800 mb-4">全文概要</h3>
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    {isAnalyzing ? (
                        <div className="space-y-2">
                            <div className="h-4 bg-gray-200 rounded w-full animate-pulse"></div>
                            <div className="h-4 bg-gray-200 rounded w-5/6 animate-pulse"></div>
                            <div className="h-4 bg-gray-200 rounded w-4/6 animate-pulse"></div>
                        </div>
                    ) : (
                        <p className="text-sm text-gray-700 leading-relaxed">
                            {meeting.summary || '暂无总结内容，请点击下方按钮生成。'}
                        </p>
                    )}
                    
                    {!meeting.summary && !isAnalyzing && (
                        <button 
                            onClick={handleQuickSummary}
                            className="mt-3 text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-1.5 rounded transition-colors font-medium w-full"
                        >
                            生成智能总结
                        </button>
                    )}
                  </div>
                </section>
    
                {/* Chapters */}
                <section>
                  <div className="flex items-center justify-between border-b border-gray-100 mb-4 pb-2">
                    <h3 className="text-sm font-bold text-gray-800">章节速览</h3>
                  </div>
                  
                  {isAnalyzing ? (
                     <div className="space-y-4">
                        {[1, 2].map(i => (
                            <div key={i} className="flex gap-2">
                                <div className="w-10 h-4 bg-gray-100 rounded animate-pulse"></div>
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 bg-gray-100 rounded w-3/4 animate-pulse"></div>
                                    <div className="h-10 bg-gray-50 rounded w-full animate-pulse"></div>
                                </div>
                            </div>
                        ))}
                     </div>
                  ) : !chaptersResult ? (
                    <div className="text-center py-8">
                       <p className="text-xs text-gray-400 mb-2">暂无章节信息</p>
                       <button 
                         onClick={handleQuickSummary}
                         className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-1.5 rounded transition-colors font-medium"
                       >
                         生成智能总结
                       </button>
                    </div>
                  ) : (
                    <SmartChapters 
                      chaptersData={chaptersResult}
                      onSeek={(time) => {
                        const parts = time.split(':').map(Number);
                        let seconds = 0;
                        if (parts.length === 3) seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
                        else if (parts.length === 2) seconds = parts[0] * 60 + parts[1];
                        setCurrentTime(seconds);
                      }}
                    />
                  )}
                </section>

                {/* Speaker Summaries */}
                {fullSummaryResult && fullSummaryResult.speaker_summaries && fullSummaryResult.speaker_summaries.length > 0 && (
                    <section>
                        <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <User size={14} className="text-gray-500" /> 发言总结
                        </h3>
                        <div className="space-y-3">
                            {fullSummaryResult.speaker_summaries.map((item, idx) => (
                                <div key={idx} className="bg-white border border-gray-100 rounded-lg p-3 shadow-sm">
                                    <div className="text-xs font-bold text-gray-900 mb-1">{item.speaker}</div>
                                    <p className="text-xs text-gray-600">{item.summary}</p>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Q&A Review */}
                {fullSummaryResult && fullSummaryResult.qa_pairs && fullSummaryResult.qa_pairs.length > 0 && (
                    <section>
                        <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <MessageCircle size={14} className="text-green-500" /> 问答回顾
                        </h3>
                        <div className="space-y-4">
                            {fullSummaryResult.qa_pairs.map((qa, idx) => (
                                <div key={idx} className="group">
                                    <div className="flex gap-2 mb-1">
                                        <span className="text-xs font-bold text-blue-600 shrink-0">Q:</span>
                                        <p className="text-xs font-bold text-gray-800">{qa.question}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <span className="text-xs font-bold text-green-600 shrink-0">A:</span>
                                        <p className="text-xs text-gray-600 leading-relaxed">{qa.answer}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
              </>
            )}
          </div>
        </div>

        {/* Left Column: Transcript (Moved to Right) */}
        <div className="flex-1 overflow-y-auto bg-[#FAFAFA] p-6 relative">
          <div className="max-w-3xl mx-auto bg-white min-h-full rounded-2xl shadow-sm overflow-hidden">
             {/* Persona Header */}
             <PersonaHeader 
                analysisResult={analysisResult && analysisResult.mode === 'deep_insight' ? (analysisResult as DeepInsightResult) : null}
                speakers={uniqueSpeakers}
             />

             <div className="p-8">
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
              {localSegments.length === 0 ? (
                <div className="py-20 text-center text-sm text-gray-400">
                  暂无转写内容
                </div>
              ) : localSegments.map((segment, index) => (
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
      <DeepAnalysisConfigModal
        isOpen={isAnalysisModalOpen}
        onClose={() => setIsAnalysisModalOpen(false)}
        onStartAnalysis={handleStartAnalysis}
        speakers={uniqueSpeakers}
        initialSpeakerMap={speakerMap}
      />
    </div>
  );
};

export default MeetingDetail;
