
import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import MeetingList from './components/MeetingList';
import PersonaCapsules from './components/PersonaCapsules';
import FolderGrid from './components/FolderGrid';
import RecordingModal from './components/RecordingModal';
import QuickCreateModal from './components/QuickCreateModal';
import AIChatBar from './components/AIChatBar';
import MeetingDetail from './components/MeetingDetail';
import TodoList from './components/TodoList';
import SocialNetworkRoot from './components/social/SocialNetworkRoot';
import { AppTab, Meeting, Folder } from './types';
import { useRecording } from './hooks/useRecording';

const INITIAL_MOCK_MEETINGS: Meeting[] = [
  {
    id: '1',
    title: 'Granola 入门指南',
    host: 'Sam Stephenson',
    duration: '3:15',
    time: '14:20',
    date: '昨天',
    type: 'product'
  },
  {
    id: '2',
    title: '每周产品同步会议',
    host: 'Jane Cooper',
    duration: '45:00',
    time: '10:00',
    date: '昨天',
    type: 'strategy'
  },
  {
    id: '3',
    title: '前端工程师候选人面试',
    host: 'Alex Wong',
    duration: '22:12',
    time: '16:00',
    date: '10月24日',
    type: 'interview'
  }
];

const App: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isRecordingModalOpen, setIsRecordingModalOpen] = useState(false);
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.RECENT);
  const [meetings, setMeetings] = useState<Meeting[]>(INITIAL_MOCK_MEETINGS);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  // 默认为左侧模式，但在小屏幕下初始化为底部模式，之后由用户手动控制
  const [isBottomMode, setIsBottomMode] = useState(() => window.innerWidth < 768);
  
  const [isUploading, setIsUploading] = useState(false);
  
  const recording = useRecording();

  useEffect(() => {
    // Fetch meetings from backend
    const fetchMeetings = async () => {
      try {
        const response = await fetch('/api/meetings');
        if (response.ok) {
          const data = await response.json();
          setMeetings(data);
        }
      } catch (error) {
        console.error("Failed to fetch meetings:", error);
      }
    };
    
    fetchMeetings();
  }, []);

  // 当前选中的会议
  // const selectedMeeting = meetings.find(m => m.id === selectedMeetingId); // Removed as we use state

  const handleMeetingClick = async (meeting: Meeting) => {
    // If meeting has no segments locally, try to fetch detail
    if (!meeting.segments) {
      try {
        const response = await fetch(`/api/meetings/${meeting.id}`);
        if (response.ok) {
          const detail = await response.json();
          const updatedMeeting: Meeting = {
            ...meeting,
            segments: detail.segments,
            audioUrl: detail.file_url || meeting.audioUrl,
            analysisResult: detail.analysis_result || meeting.analysisResult,
          };
          setMeetings(prev =>
            prev.map(m => (m.id === meeting.id ? updatedMeeting : m))
          );
          setSelectedMeeting(updatedMeeting);
          return;
        }
      } catch (error) {
        console.error("Failed to fetch meeting detail:", error);
      }
    }
    
    setSelectedMeeting(meeting);
  };

  const handleBack = () => {
    setSelectedMeeting(null);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/asr/file', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Transcription failed');

      const data = await response.json();
      if (data.status === 'succeeded' && data.segments) {
         // Create a new meeting from the uploaded file
         const newMeeting: Meeting = {
           id: data.meeting_id || Date.now().toString(),
           title: file.name.replace(/\.[^/.]+$/, ""), // Use filename as title
           host: '未知发言人',
           duration: data.segments[data.segments.length - 1]?.endTime || '00:00',
           time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
           date: '刚刚',
           type: 'product',
           segments: data.segments
         };
         // Refresh list from backend to ensure consistency, or just add local
         setMeetings(prev => [newMeeting, ...prev]);
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("上传转写失败，请检查后端日志及 .env 配置");
    } finally {
      setIsUploading(false);
    }
  };

  // 移除自动 resize 监听，改为手动触发
  // 只在组件挂载时进行一次初始化检查（上面的 useState 已经做了）

  const toggleLayoutMode = () => {
    setIsBottomMode(prev => !prev);
    // 切换到底部模式时，确保 sidebar 是打开的
    if (!isBottomMode) {
      setIsSidebarOpen(true);
    }
  };

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const addNewMeeting = (meeting: Meeting) => {
    setMeetings([meeting, ...meetings]);
    setSelectedMeeting(meeting);
  };

  const getPageTitle = () => {
    switch (activeTab) {
      case AppTab.RECENT: return '近期看板';
      case AppTab.SHARED: return '团队共享';
      case AppTab.FOLDERS: return '会议时间树';
      case AppTab.SOCIAL: return '社交关系';
      default: return '近期看板';
    }
  };

  const getPageDescription = () => {
    switch (activeTab) {
      case AppTab.RECENT: return `共 ${meetings.length} 个正在处理的项目`;
      case AppTab.FOLDERS: return '按时间维度浏览您的会议沉淀';
      case AppTab.SOCIAL: return '分析会议中的人际脉络与互动';
      default: return '管理您的工作流';
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#ffffff] text-[#1A1A1A]">
      <Sidebar 
        isOpen={isSidebarOpen || isBottomMode} 
        onClose={() => setIsSidebarOpen(false)} 
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        position={isBottomMode ? 'bottom' : 'left'}
        onToggleLayout={toggleLayoutMode}
        onAddClick={() => setIsRecordingModalOpen(true)}
        recordingState={{
          isActive: recording.status !== 'idle' && recording.status !== 'finished',
          isPaused: recording.status === 'paused',
          duration: recording.duration,
          onToggle: recording.toggleRecording
        }}
      />

      <main className={`relative flex flex-col flex-1 h-full min-w-0 bg-[#F8F9FB] transition-all duration-300 ${isBottomMode ? 'pb-[80px]' : ''}`}>
        {selectedMeeting ? (
          <MeetingDetail 
            meeting={selectedMeeting} 
            onBack={() => setSelectedMeeting(null)} 
          />
        ) : (
          <>
            <Header onOpenSidebar={toggleSidebar} isBottomMode={isBottomMode} />

            <div className="flex-1 overflow-y-auto px-6 pb-40 pt-6 no-scrollbar">
              {activeTab !== AppTab.FOLDERS && activeTab !== AppTab.SOCIAL && (
                <section className="mb-12">
                  <div className="flex items-center gap-3 mb-5 px-1">
                    <div className="w-1 h-4 rounded-full bg-gradient-to-b from-[#7bbfea] to-[#33a3dc]"></div>
                    <h2 className="text-[11px] font-black text-[#999999] uppercase tracking-[0.25em]">AI 智能建模</h2>
                  </div>
                  <PersonaCapsules />
                </section>
              )}

              <section className="w-full max-w-none">
                <div className="flex items-center justify-between mb-8 px-1">
                  <div className="flex flex-col">
                    <h2 className="text-2xl font-black text-[#1A1A1A] tracking-tighter">
                      {getPageTitle()}
                    </h2>
                    <span className="text-[10px] text-[#BBBBBB] font-bold mt-1 uppercase tracking-widest">
                      {getPageDescription()}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className={`
                      group relative px-6 py-2.5 rounded-full bg-blue-50 border border-blue-100 shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer
                      ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
                    `}>
                      <div className="relative flex items-center gap-2 text-sm font-bold text-[#33a3dc]">
                        <i className={`fa-solid ${isUploading ? 'fa-spinner fa-spin' : 'fa-cloud-arrow-up'} text-[10px]`}></i>
                        <span>{isUploading ? '上传转写中...' : '导入录音'}</span>
                      </div>
                      <input 
                        type="file" 
                        accept="audio/*" 
                        className="hidden" 
                        onChange={handleFileUpload} 
                        disabled={isUploading}
                      />
                    </label>
                    <button 
                      onClick={() => setIsRecordingModalOpen(true)}
                      className="group relative px-6 py-2.5 rounded-full bg-white border border-[#EEEEEE] shadow-sm hover:shadow-md transition-all active:scale-95"
                    >
                      <div className="relative flex items-center gap-2 text-sm font-bold text-[#33a3dc]">
                        <i className="fa-solid fa-plus text-[10px]"></i>
                        <span>快速新建</span>
                      </div>
                    </button>
                  </div>
                </div>
                
                {activeTab === AppTab.FOLDERS ? (
                  <FolderGrid />
                ) : activeTab === AppTab.SOCIAL ? (
                  <div className="h-[calc(100vh-180px)] w-full rounded-3xl overflow-hidden border border-gray-200 shadow-sm bg-gray-50">
                    <SocialNetworkRoot />
                  </div>
                ) : (
                  <>
                    <MeetingList meetings={meetings} onMeetingClick={handleMeetingClick} />
                    <TodoList />
                  </>
                )}
              </section>
            </div>

            <AIChatBar className={`transition-all duration-300 ${isBottomMode ? 'bottom-[70px]' : 'bottom-0'}`} />
          </>
        )}

        {isRecordingModalOpen && (
          <>
            <div className="fixed inset-0 bg-black/20 z-50 backdrop-blur-[2px] animate-in fade-in duration-300" onClick={() => setIsRecordingModalOpen(false)} />
            <RecordingModal 
              onClose={() => setIsRecordingModalOpen(false)} 
              onSuccess={addNewMeeting}
              recording={recording}
            />
          </>
        )}

        {isQuickCreateOpen && (
          <QuickCreateModal 
            onClose={() => setIsQuickCreateOpen(false)}
            onRecordStart={() => setIsRecordingModalOpen(true)}
            onSuccess={addNewMeeting}
          />
        )}
      </main>
    </div>
  );
}

export default App;
