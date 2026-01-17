
import React, { useState } from 'react';
import { Folder } from '../types';

const INITIAL_FOLDERS: Folder[] = [
  { id: 'f1', name: '产品路线图 2024', itemCount: 12, color: 'text-blue-500' },
  { id: 'f2', name: '用户访谈记录', itemCount: 45, color: 'text-purple-500' },
  { id: 'f3', name: 'Q3 战略会议', itemCount: 8, color: 'text-orange-500' },
  { id: 'f4', name: '前端架构重构', itemCount: 21, color: 'text-teal-500' },
  { id: 'f5', name: '市场推广素材', itemCount: 15, color: 'text-red-500' },
  { id: 'f6', name: '融资路演资料', itemCount: 6, color: 'text-yellow-500' },
];

const FolderGrid: React.FC = () => {
  const [folders, setFolders] = useState<Folder[]>(INITIAL_FOLDERS);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.setData('folderId', id);
    // 延迟一点以改变拖拽时的视觉效果
    setTimeout(() => {
      const target = e.target as HTMLElement;
      target.classList.add('opacity-40');
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const target = e.target as HTMLElement;
    target.classList.remove('opacity-40');
    setDraggedId(null);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (draggedId === targetId) return;

    const currentFolders = [...folders];
    const draggedIndex = currentFolders.findIndex(f => f.id === draggedId);
    const targetIndex = currentFolders.findIndex(f => f.id === targetId);

    if (draggedIndex !== -1 && targetIndex !== -1) {
      const [removed] = currentFolders.splice(draggedIndex, 1);
      currentFolders.splice(targetIndex, 0, removed);
      setFolders(currentFolders);
    }
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {folders.map((folder) => (
        <div 
          key={folder.id}
          draggable
          onDragStart={(e) => handleDragStart(e, folder.id)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleDragOver(e, folder.id)}
          className={`
            group relative cursor-grab active:cursor-grabbing select-none
            bg-white border border-gray-100 rounded-[28px] p-6 
            transition-all duration-300 transform-gpu
            hover:shadow-[0_20px_40px_rgba(0,0,0,0.04)] hover:-translate-y-1
            ${draggedId === folder.id ? 'scale-105 z-10 border-[#33a3dc] border-2 ring-8 ring-[#33a3dc]/5' : ''}
          `}
        >
          {/* 文件夹图标 */}
          <div className="mb-4 flex items-start justify-between">
            <div className={`w-14 h-14 bg-gray-50 rounded-[20px] flex items-center justify-center text-2xl transition-colors group-hover:bg-[#F0F9FF] group-hover:text-[#33a3dc]`}>
              <i className={`fa-solid fa-folder ${folder.color} group-hover:text-inherit`}></i>
            </div>
            <button className="text-[#CCCCCC] hover:text-[#1A1A1A] transition-colors">
              <i className="fa-solid fa-ellipsis"></i>
            </button>
          </div>

          {/* 信息展示 */}
          <div className="space-y-1">
            <h3 className="text-sm font-black text-[#1A1A1A] line-clamp-2 leading-tight group-hover:text-[#33a3dc] transition-colors">
              {folder.name}
            </h3>
            <p className="text-[10px] font-bold text-[#BBBBBB]">
              {folder.itemCount} 个会议项
            </p>
          </div>

          {/* 背景装饰 - 文件夹夹层感 */}
          <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-[#33a3dc]/5 to-transparent rounded-bl-[80px] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
        </div>
      ))}

      {/* 新建文件夹占位符 */}
      <button className="border-2 border-dashed border-[#EEEEEE] rounded-[28px] p-6 flex flex-col items-center justify-center gap-3 text-[#BBBBBB] hover:border-[#33a3dc]/40 hover:text-[#33a3dc] transition-all group">
        <div className="w-12 h-12 rounded-full border border-current flex items-center justify-center group-hover:scale-110 transition-transform">
          <i className="fa-solid fa-plus"></i>
        </div>
        <span className="text-xs font-black uppercase tracking-widest">新建文件夹</span>
      </button>
    </div>
  );
};

export default FolderGrid;
