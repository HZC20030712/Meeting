
import React from 'react';

interface HeaderProps {
  onOpenSidebar: () => void;
  isBottomMode?: boolean;
}

const Header: React.FC<HeaderProps> = ({ onOpenSidebar, isBottomMode }) => {
  return (
    <header className={`sticky top-0 z-20 flex items-center px-4 md:px-8 py-5 bg-[#F8F9FB]/80 backdrop-blur-xl justify-between`}>
      <div className="flex items-center gap-4 md:gap-8 flex-1">
        {/* 收缩按钮 - 极简线条 */}
        {!isBottomMode && (
          <button 
            onClick={onOpenSidebar}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-[#EEEEEE] text-[#1A1A1A] hover:border-[#33a3dc]/40 transition-all active:scale-95 shadow-sm flex-shrink-0"
          >
            <i className="fa-solid fa-indent text-sm"></i>
          </button>
        )}

        {/* 呼吸感搜索栏 */}
        <div className="relative group flex-1 max-w-lg">
          <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-[#CCCCCC] text-sm group-focus-within:text-[#33a3dc] transition-colors"></i>
          <input 
            type="text" 
            placeholder="搜索关键词、会议或指令 (Ctrl + K)"
            className="w-full bg-white border border-[#EEEEEE] rounded-2xl py-2.5 pl-11 pr-4 text-xs font-bold text-[#1A1A1A] placeholder-[#CCCCCC] focus:outline-none focus:ring-4 focus:ring-[#33a3dc]/5 focus:border-[#33a3dc]/30 transition-all shadow-sm"
          />
        </div>
      </div>
      
      <div className="flex items-center gap-5">
        <button className="w-10 h-10 flex items-center justify-center rounded-xl text-[#BBBBBB] hover:text-[#1A1A1A] hover:bg-white transition-all relative">
          <i className="fa-solid fa-bell"></i>
          <span className="absolute top-3 right-3 w-1.5 h-1.5 bg-[#33a3dc] rounded-full ring-2 ring-[#F8F9FB]"></span>
        </button>
        <div className="w-10 h-10 flex items-center justify-center rounded-xl text-[#BBBBBB] hover:text-[#1A1A1A] hover:bg-white transition-all">
          <i className="fa-solid fa-clock-rotate-left"></i>
        </div>
      </div>
    </header>
  );
};

export default Header;
