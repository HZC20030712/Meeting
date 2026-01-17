import React, { useRef, useState } from 'react';

interface QuickCreateModalProps {
  onClose: () => void;
  onRecordStart: () => void;
  onSuccess?: (meetingData: any) => void;
}

const QuickCreateModal: React.FC<QuickCreateModalProps> = ({ onClose, onRecordStart, onSuccess }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadAndTranscribe(file);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      await uploadAndTranscribe(file);
    }
  };

  const uploadAndTranscribe = (file: File) => {
    // Validate file type
    if (!file.type.startsWith('audio/') && !file.type.startsWith('video/')) {
      alert('请上传音频或视频文件');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    // Use XMLHttpRequest to track upload progress
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);

    xhr.open('POST', '/api/asr/file', true);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        // Upload phase: 0% - 80%
        const percentComplete = (event.loaded / event.total) * 80;
        setUploadProgress(percentComplete);
      }
    };

    xhr.onload = async () => {
      if (xhr.status === 200) {
        try {
          // Transcribing phase (simulated): 80% -> 100%
          const interval = setInterval(() => {
             setUploadProgress(prev => {
                if (prev >= 99) {
                    clearInterval(interval);
                    return 99;
                }
                return prev + 1;
             });
          }, 50);

          const data = JSON.parse(xhr.responseText);
          
          clearInterval(interval);
          setUploadProgress(100);

          // Construct a meeting object
          const newMeeting = {
            id: Date.now().toString(),
            title: file.name.split('.')[0] || '导入的会议',
            host: '我',
            duration: '00:00',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            date: '刚刚',
            type: 'product',
            summary: data.text
          };

          // Small delay to show 100%
          setTimeout(() => {
              if (onSuccess) {
                onSuccess(newMeeting);
              }
              onClose();
              setIsUploading(false);
          }, 500);
          
        } catch (error) {
          console.error('Error parsing response:', error);
          alert('转写结果解析失败');
          setIsUploading(false);
        }
      } else {
        console.error('Upload failed:', xhr.statusText);
        alert('文件上传失败，请重试');
        setIsUploading(false);
      }
    };

    xhr.onerror = () => {
      console.error('Network error');
      alert('网络错误，请重试');
      setIsUploading(false);
    };

    xhr.send(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative w-[90%] max-w-md bg-white rounded-3xl shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-200 border border-gray-100">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-black text-gray-900">新建会议</h3>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Option 1: OCR Import */}
        <button className="w-full group relative overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border border-blue-100/50 rounded-2xl p-5 transition-all text-left">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center text-blue-500 text-xl group-hover:scale-110 transition-transform">
              <i className="fa-solid fa-camera"></i>
            </div>
            <div className="flex-1">
              <h4 className="font-black text-gray-900 mb-1">导入会议预约图片</h4>
              <p className="text-xs font-medium text-gray-500 leading-relaxed">
                OCR 智能识别 · 自动生成代办 · 预约会议
              </p>
            </div>
            <div className="absolute top-4 right-4 text-blue-300 group-hover:text-blue-400">
              <i className="fa-solid fa-angle-right"></i>
            </div>
          </div>
        </button>

        {/* Option 2: Recording (Middle) */}
        <button 
          onClick={() => {
            onClose();
            onRecordStart();
          }}
          className="w-full group bg-[#33a3dc] hover:bg-[#2b8cc0] rounded-2xl p-5 transition-all text-white shadow-lg shadow-[#33a3dc]/20 active:scale-[0.98]"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-white text-xl animate-pulse">
              <i className="fa-solid fa-microphone"></i>
            </div>
            <div className="flex-1 text-left">
              <h4 className="font-black text-white text-lg">开始录音</h4>
              <p className="text-xs font-medium text-blue-50/80">
                实时转写 · 智能摘要 · 自动生成纪要
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <i className="fa-solid fa-play ml-0.5"></i>
            </div>
          </div>
        </button>

        {/* Option 3: Import Audio/Video */}
        <input 
          type="file" 
          ref={fileInputRef}
          className="hidden" 
          accept="audio/*,video/*"
          onChange={handleFileSelect}
        />
        <button 
          onClick={() => fileInputRef.current?.click()}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          disabled={isUploading}
          className={`
            w-full group relative bg-gray-50 hover:bg-gray-100 border border-gray-100 rounded-2xl p-5 transition-all text-left overflow-hidden
            ${dragActive ? 'border-dashed border-[#33a3dc] bg-blue-50' : ''}
          `}
        >
          {isUploading && (
            <div 
              className="absolute inset-y-0 left-0 bg-[#33a3dc]/10 transition-all duration-200 ease-out"
              style={{ width: `${uploadProgress}%` }}
            >
              <div className="absolute right-0 top-0 bottom-0 w-[2px] bg-[#33a3dc] shadow-[0_0_10px_rgba(51,163,220,0.5)]"></div>
            </div>
          )}

          <div className="relative z-10">
            {isUploading ? (
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center text-[#33a3dc] text-xl">
                   <span className="font-black text-xs">{Math.round(uploadProgress)}%</span>
                 </div>
                 <div className="flex-1">
                   <h4 className="font-black text-[#33a3dc] mb-1">正在上传并转写...</h4>
                   <p className="text-xs font-medium text-[#33a3dc]/70">
                     {uploadProgress < 80 ? '文件上传中' : 'AI 智能转写中'}
                   </p>
                 </div>
                 <div className="w-5 h-5 border-2 border-[#33a3dc] border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center text-orange-500 text-xl group-hover:scale-110 transition-transform">
                <i className="fa-solid fa-file-audio"></i>
              </div>
              <div className="flex-1">
                <h4 className="font-black text-gray-900 mb-1">导入音视频文件</h4>
                <p className="text-xs font-medium text-gray-500">
                  支持 MP3, M4A, WAV, MP4 等格式 (拖拽或点击)
                </p>
              </div>
              <div className="text-gray-300 group-hover:text-gray-400">
                <i className="fa-solid fa-upload"></i>
              </div>
            </div>
          )}
          </div>
        </button>

      </div>
    </div>
  );
};

export default QuickCreateModal;
