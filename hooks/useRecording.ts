import { useState, useEffect, useRef, useCallback } from 'react';
import { TranscriptSegment } from '../types';

export const useRecording = () => {
  const [isRecording, setIsRecording] = useState(false);
  const isRecordingRef = useRef(false);
  const [duration, setDuration] = useState(0);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [status, setStatus] = useState<'idle' | 'initializing' | 'recording' | 'error' | 'finished' | 'paused'>('idle');

  const websocketRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const inputRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const startRecording = useCallback(async () => {
    try {
      // If already recording or initializing, don't start again
      if (isRecordingRef.current || status === 'initializing') return;

      // Reset state
      setSegments([]);
      setCurrentTranscript('');
      setDuration(0);
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
          isRecordingRef.current = true;
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
                  id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
                  type: 'user',
                  content: data.text,
                  speaker: data.speaker || undefined
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
               id: 'suggestion-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
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
        isRecordingRef.current = false;
        // Don't change status to finished here automatically, as it might be a network issue?
        // But for now, let's assume it's stopped.
      };

    } catch (err) {
      console.error('Setup Error:', err);
      setStatus('error');
    }
  }, []);

  const stopRecording = useCallback(() => {
    setIsRecording(false);
    isRecordingRef.current = false;
    
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
    setStatus('finished');
  }, []);

  const resetRecording = useCallback(() => {
    setSegments([]);
    setCurrentTranscript('');
    setDuration(0);
    setStatus('idle');
    setIsRecording(false);
    isRecordingRef.current = false;
  }, []);

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      // Pause
      setIsRecording(false);
      isRecordingRef.current = false;
      setStatus('paused');
      if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
        websocketRef.current.send(JSON.stringify({ type: 'pause' }));
      }
      if (audioContextRef.current && audioContextRef.current.state === 'running') {
        await audioContextRef.current.suspend();
      }
    } else {
      // Resume
      setIsRecording(true);
      isRecordingRef.current = true;
      setStatus('recording');
      if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
        websocketRef.current.send(JSON.stringify({ type: 'resume' }));
      }
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
    }
  }, [isRecording]);

  // Timer effect
  useEffect(() => {
    let interval: any;
    if (isRecording) {
      interval = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  return {
    isRecording,
    duration,
    segments,
    currentTranscript,
    status,
    startRecording,
    stopRecording,
    toggleRecording,
    resetRecording
  };
};
