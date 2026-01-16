import React from 'react';

interface RecordingTimerProps {
  duration: number;
  isPaused: boolean;
  onToggle: (e: React.MouseEvent) => void;
  onClick: () => void;
}

const RecordingTimer: React.FC<RecordingTimerProps> = ({ duration, isPaused, onToggle, onClick }) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      onClick={onClick}
      className="relative -top-5 cursor-pointer animate-in fade-in zoom-in duration-300"
    >
      <div className="h-14 px-2 bg-white rounded-full flex items-center gap-3 shadow-[0_8px_16px_rgba(0,0,0,0.08)] border border-red-50 hover:scale-105 transition-transform">
        {/* Waveform Icon */}
        <div className="flex items-center gap-0.5 h-4 ml-2">
          <div className="w-1 bg-red-400 h-2 rounded-full animate-[bounce_1s_infinite]"></div>
          <div className="w-1 bg-red-400 h-4 rounded-full animate-[bounce_1.2s_infinite]"></div>
          <div className="w-1 bg-red-400 h-2 rounded-full animate-[bounce_0.8s_infinite]"></div>
          <div className="w-1 bg-red-400 h-3 rounded-full animate-[bounce_1.1s_infinite]"></div>
        </div>
        
        {/* Timer */}
        <span className="text-xl font-bold text-gray-700 font-mono tracking-widest min-w-[60px]">
          {formatTime(duration)}
        </span>

        {/* Pause/Resume Button */}
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onToggle(e);
          }}
          className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500 hover:bg-red-100 transition-colors"
        >
          {isPaused ? (
            <i className="fa-solid fa-play text-sm ml-0.5"></i>
          ) : (
            <i className="fa-solid fa-pause text-sm"></i>
          )}
        </button>
      </div>
    </div>
  );
};

export default RecordingTimer;
