
import React from 'react';
import { PersonaCapsule } from '../types';

const CAPSULES: PersonaCapsule[] = [
  { id: '1', label: '董事会会议', icon: 'fa-landmark', color: 'text-purple-600' },
  { id: '2', label: '每日站会', icon: 'fa-bolt', color: 'text-yellow-600' },
  { id: '3', label: '战略规划', icon: 'fa-chess-king', color: 'text-blue-600' },
  { id: '4', label: '招聘面试', icon: 'fa-user-plus', color: 'text-green-600' },
  { id: '5', label: '销售路演', icon: 'fa-bullhorn', color: 'text-red-600' }
];

const PersonaCapsules: React.FC = () => {
  return (
    <div className="flex overflow-x-auto gap-3 pb-2 no-scrollbar">
      {CAPSULES.map((capsule) => (
        <button 
          key={capsule.id}
          className="flex-none flex items-center gap-2 bg-white border border-gray-200 px-4 py-2 rounded-full hover:border-blue-300 hover:bg-blue-50/30 shadow-sm transition-all active:scale-95"
        >
          <i className={`fa-solid ${capsule.icon} ${capsule.color} text-xs`}></i>
          <span className="text-xs font-semibold text-gray-700">{capsule.label}</span>
        </button>
      ))}
    </div>
  );
};

export default PersonaCapsules;
