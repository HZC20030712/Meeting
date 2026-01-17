import React from 'react';
import { ChaptersResult } from '../types';
import { BookOpen, Play } from 'lucide-react';

interface SmartChaptersProps {
  chaptersData: ChaptersResult | null;
  onSeek: (time: string) => void;
}

const SmartChapters: React.FC<SmartChaptersProps> = ({ chaptersData, onSeek }) => {
  if (!chaptersData || !chaptersData.chapters || chaptersData.chapters.length === 0) {
    return (
      <div className="text-center p-8 text-gray-400">
        <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">暂无章节信息</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {chaptersData.chapters.map((chapter, index) => (
        <div 
          key={index} 
          className="group relative pl-6 border-l-2 border-gray-100 hover:border-blue-400 transition-colors"
        >
          {/* Time Dot */}
          <div 
            onClick={() => onSeek(chapter.timestamp)}
            className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white border-2 border-gray-200 group-hover:border-blue-500 cursor-pointer flex items-center justify-center transition-all"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-transparent group-hover:bg-blue-500 transition-colors"></div>
          </div>

          <div className="mb-1 flex items-center gap-2">
            <span 
              onClick={() => onSeek(chapter.timestamp)}
              className="text-xs font-mono text-gray-400 group-hover:text-blue-500 cursor-pointer"
            >
              {chapter.timestamp}
            </span>
            <h3 className="text-sm font-bold text-gray-900">{chapter.title}</h3>
          </div>
          
          <p className="text-xs text-gray-600 leading-relaxed text-justify">
            {chapter.summary}
          </p>
          
          <button 
            onClick={() => onSeek(chapter.timestamp)}
            className="mt-2 text-[10px] text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 hover:underline"
          >
            <Play size={10} /> 跳转播放
          </button>
        </div>
      ))}
    </div>
  );
};

export default SmartChapters;
