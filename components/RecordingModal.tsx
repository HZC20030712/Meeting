
import React, { useState, useEffect, useRef } from 'react';
import { Meeting } from '../types';

interface RecordingModalProps {
  onClose: () => void;
  // Added onSuccess to fix the type mismatch error in App.tsx
  onSuccess: (meeting: Meeting) => void;
}

const RecordingModal: React.FC<RecordingModalProps> = ({ onClose, onSuccess }) => {
  const [isRecording, setIsRecording] = useState(false); // Start false, wait for connection
  const [duration, setDuration] = useState(0);
  
  // Segmented Transcript State
  interface TranscriptSegment {
    id: string;
    type: 'user' | 'suggestion';
    content: string;
    status?: 'thinking' | 'streaming' | 'done';
  }
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [status, setStatus] = useState<'initializing' | 'recording' | 'error' | 'finished'>('initializing');
  
  const websocketRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const inputRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // Initialize recording on mount
  useEffect(() => {
    startRecording();
    return () => {
      stopRecording();
    };
  }, []);

  const startRecording = async () => {
    try {
      setStatus('initializing');
      
      // 1. Connect WebSocket
      const ws = new WebSocket('ws://localhost:8000/ws/asr');
      websocketRef.current = ws;

      ws.onopen = async () => {
        console.log('WebSocket Connected');
        // 2. Start Audio only after WS is ready
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          streamRef.current = stream;
          
          // Create AudioContext with 16k sample rate if possible
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          const audioContext = new AudioContextClass({ sampleRate: 16000 });
          audioContextRef.current = audioContext;

          const source = audioContext.createMediaStreamSource(stream);
          inputRef.current = source;
          
          // Buffer size 4096 is a good balance
          const processor = audioContext.createScriptProcessor(4096, 1, 1);
          processorRef.current = processor;

          processor.onaudioprocess = (e) => {
            if (ws.readyState === WebSocket.OPEN) {
              const inputData = e.inputBuffer.getChannelData(0);
              // Convert Float32 to Int16 PCM
              const pcmData = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                const s = Math.max(-1, Math.min(1, inputData[i]));
                pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
              }
              ws.send(pcmData.buffer);
            }
          };

          // Create a gain node to mute the output and prevent feedback (howling)
          const gainNode = audioContext.createGain();
          gainNode.gain.value = 0;

          source.connect(processor);
          processor.connect(gainNode);
          gainNode.connect(audioContext.destination);

          setIsRecording(true);
          setStatus('recording');
        } catch (err) {
          console.error('Audio Error:', err);
          setStatus('error');
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Handle Transcript
          if (data.type === 'transcript' || (data.text !== undefined && !data.type)) {
            if (data.is_final) {
              // Sentence finished, append to segments
              if (data.text && data.text.trim()) {
                setSegments(prev => [...prev, {
                  id: Date.now().toString(),
                  type: 'user',
                  content: data.text
                }]);
              }
              setCurrentTranscript('');
            } else {
              // Sentence in progress, update current
              setCurrentTranscript(data.text);
            }
          }
          // Handle Status: Thinking
          else if (data.type === 'status' && data.content === 'thinking') {
             // Append a new suggestion segment in 'thinking' state
             setSegments(prev => [...prev, {
               id: 'suggestion-' + Date.now(),
               type: 'suggestion',
               content: '',
               status: 'thinking'
             }]);
          }
          // Handle Suggestion Stream
          else if (data.type === 'suggestion_delta') {
            setSegments(prev => {
              const newSegments = [...prev];
              // Find the last suggestion segment
              const lastIdx = newSegments.map(s => s.type).lastIndexOf('suggestion');
              if (lastIdx !== -1) {
                const last = newSegments[lastIdx];
                newSegments[lastIdx] = {
                  ...last,
                  content: last.content + data.content,
                  status: 'streaming'
                };
              }
              return newSegments;
            });
          }
          // Handle Suggestion End
          else if (data.type === 'suggestion_end') {
            setSegments(prev => {
              const newSegments = [...prev];
              const lastIdx = newSegments.map(s => s.type).lastIndexOf('suggestion');
              if (lastIdx !== -1) {
                 newSegments[lastIdx] = { ...newSegments[lastIdx], status: 'done' };
              }
              return newSegments;
            });
          }
          
          if (data.error || (data.type === 'error')) {
            console.error('ASR/Gen Error:', data.error || data.content);
          }
        } catch (e) {
          console.error('WS Message Error:', e);
        }
      };

      ws.onerror = (e) => {
        console.error('WebSocket Error:', e);
        setStatus('error');
      };
      
      ws.onclose = () => {
        console.log('WebSocket Closed');
        setIsRecording(false);
      };

    } catch (err) {
      console.error('Setup Error:', err);
      setStatus('error');
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
    
    if (processorRef.current && inputRef.current) {
      processorRef.current.disconnect();
      inputRef.current.disconnect();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    
    if (websocketRef.current) {
      websocketRef.current.close();
    }
  };

  // Timer effect
  React.useEffect(() => {
    let interval: any;
    if (isRecording) {
      interval = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleFinish = () => {
    stopRecording();
    const fullText = segments.map(s => s.type === 'user' ? s.content : '').join('') + currentTranscript; // Only keep user text for title? Or include suggestions?
    // User probably only wants transcript content for the "meeting title" or full content.
    // Let's stick to user content for now.
    
    const newMeeting: Meeting = {
      id: Date.now().toString(),
      title: fullText.slice(0, 10) || '新录音', // Use transcript as title
      host: 'Me',
      duration: formatTime(duration),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: '刚刚',
      type: 'other'
    };
    onSuccess(newMeeting);
    onClose();
  };

  return (
    <div className="fixed inset-x-0 bottom-0 top-[88px] z-[60] flex flex-col bg-white rounded-t-[32px] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] animate-in slide-in-from-bottom duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] border-t border-gray-100">
      {/* 顶部导航 */}
      <div className="flex items-center justify-between px-6 py-4">
        <button 
          onClick={() => { stopRecording(); onClose(); }}
          className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <i className="fa-solid fa-compress text-sm"></i>
        </button>
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-gray-900">
            {status === 'initializing' ? '连接中...' : status === 'recording' ? '正在录音' : '录音停止'}
          </span>
          {status === 'recording' && <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>}
        </div>
        <button className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-600">
          <i className="fa-solid fa-gear text-sm"></i>
        </button>
      </div>

      {/* 流式内容区 */}
      <div className="flex-1 px-8 py-4 overflow-y-auto">
        <div className="mb-6">
          <div className="text-gray-400 text-xs mb-2">{formatTime(duration)}</div>
          <div className="text-lg text-gray-800 font-medium leading-relaxed whitespace-pre-wrap">
            {segments.map((segment, index) => {
              if (segment.type === 'suggestion') {
                return (
                  <div key={segment.id} className="my-4 p-3 bg-red-50 rounded-lg border border-red-100 animate-in fade-in slide-in-from-left-4">
                    <span className="text-red-500 font-bold mr-2">智能提问建议：</span>
                    <span className="text-gray-800">{segment.content}</span>
                    {segment.status === 'thinking' && <span className="animate-pulse">...</span>}
                  </div>
                );
              }
              return <span key={segment.id}>{segment.content}</span>;
            })}
            <span className="text-gray-500">{currentTranscript}</span>
            {(!segments.length && !currentTranscript && status === 'initializing') && '正在连接语音服务...'}
            {(!segments.length && !currentTranscript && status === 'recording') && '请说话...'}
            {/* 模拟光标 */}
            {isRecording && <span className="inline-block w-0.5 h-5 bg-blue-500 ml-1 align-middle animate-pulse"></span>}
          </div>
        </div>
      </div>

      {/* 底部控制区 */}
      <div className="px-8 pb-10 pt-4 bg-gradient-to-t from-white via-white to-transparent rounded-b-[32px]">
        {/* 进度条 */}
        <div className="flex items-center justify-center gap-4 mb-12">
          <div className="flex items-end gap-1 h-8 opacity-50">
            {/* Simple Visualizer Placeholder */}
             <div className="w-1 bg-red-400 h-3 rounded-full animate-[bounce_1s_infinite]"></div>
            <div className="w-1 bg-red-400 h-5 rounded-full animate-[bounce_1.2s_infinite]"></div>
             <div className="w-1 bg-red-400 h-4 rounded-full animate-[bounce_1.1s_infinite]"></div>
          </div>
          <span className="text-lg font-mono text-gray-600 min-w-[100px] text-center">
            {formatTime(duration)} / 60:00
          </span>
          <div className="flex items-end gap-1 h-8 opacity-50">
            <div className="w-1 bg-red-400 h-4 rounded-full animate-[bounce_1.1s_infinite]"></div>
            <div className="w-1 bg-red-400 h-5 rounded-full animate-[bounce_1.2s_infinite]"></div>
             <div className="w-1 bg-red-400 h-3 rounded-full animate-[bounce_1s_infinite]"></div>
          </div>
        </div>

        {/* 按钮组 */}
        <div className="flex items-center justify-between px-4 mb-8">
          <button 
            onClick={onClose}
            className="text-gray-400 font-bold text-lg hover:text-gray-600"
          >
            取消
          </button>
          
          <button 
            onClick={() => setIsRecording(!isRecording)}
            className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-200 active:scale-95 transition-all ring-4 ring-red-100"
          >
            {isRecording ? (
              <div className="flex gap-1.5">
                <div className="w-2 h-6 bg-white rounded-full"></div>
                <div className="w-2 h-6 bg-white rounded-full"></div>
              </div>
            ) : (
              <div className="w-0 h-0 border-l-[16px] border-l-white border-y-[10px] border-y-transparent ml-1"></div>
            )}
          </button>

          <button 
            onClick={handleFinish}
            className="text-gray-900 font-bold text-lg hover:text-blue-600"
          >
            完成
          </button>
        </div>

        {/* 底部辅助按钮 */}
        <div className="flex gap-4">
          <button className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-50 rounded-2xl text-gray-600 font-bold text-sm">
            <i className="fa-solid fa-camera"></i>
            拍重点
          </button>
          <button className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-50 rounded-2xl text-gray-600 font-bold text-sm">
            <i className="fa-solid fa-pen-to-square"></i>
            随手记
          </button>
        </div>
      </div>
    </div>
  );
};

interface LangBtnProps {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}

const LangBtn: React.FC<LangBtnProps> = ({ children, active, onClick }) => (
  <button 
    onClick={onClick}
    className={`
      px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
      ${active ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-400'}
    `}
  >
    {children}
  </button>
);

export default RecordingModal;
