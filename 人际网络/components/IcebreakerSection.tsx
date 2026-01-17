import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Star, Zap, ChevronDown } from 'lucide-react';
import { Icebreaker } from '../types';

interface IcebreakerSectionProps {
  icebreakers: Icebreaker[];
}

const CATEGORY_LABELS: Record<string, string> = {
  'All': '全部',
  'Professional': '专业',
  'Interest': '兴趣',
  'Dynamic': '动态'
};

const CATEGORY_KEYS = ['All', 'Professional', 'Interest', 'Dynamic'];

const IcebreakerSection: React.FC<IcebreakerSectionProps> = ({ icebreakers }) => {
  const [filter, setFilter] = useState<'All' | 'Professional' | 'Interest' | 'Dynamic'>('All');
  const [expanded, setExpanded] = useState(false);

  const filteredItems = filter === 'All' 
    ? icebreakers 
    : icebreakers.filter(i => i.category === filter);

  const getIcon = (type: string) => {
    switch (type) {
      case 'book': return <BookOpen size={14} className="text-mutedBlue" />;
      case 'star': return <Star size={14} className="text-amber-500" />;
      case 'zap': return <Zap size={14} className="text-emerald-500" />;
      default: return <BookOpen size={14} />;
    }
  };

  return (
    <div className="w-full mt-6">
      {/* Segmented Control */}
      <div className="flex p-1 bg-gray-100 rounded-lg mb-4">
        {CATEGORY_KEYS.map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab as any)}
            className={`flex-1 py-1.5 text-[10px] md:text-xs font-medium rounded-md transition-all duration-300 ${
              filter === tab 
                ? 'bg-white text-graphite shadow-sm' 
                : 'text-slateGray hover:text-graphite'
            }`}
          >
            {CATEGORY_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* List */}
      <motion.div 
        layout 
        className="space-y-3 overflow-hidden"
      >
        <AnimatePresence mode='popLayout'>
          {filteredItems.slice(0, expanded ? undefined : 2).map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="flex items-start space-x-3 p-3 bg-white border border-gray-100 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.02)]"
            >
              <div className="mt-0.5 p-1.5 bg-gray-50 rounded-full shrink-0">
                {getIcon(item.iconType)}
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-slateGray font-semibold block mb-0.5">
                  {CATEGORY_LABELS[item.category]}
                </span>
                <p className="text-sm text-graphite leading-relaxed font-medium">
                  {item.text}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      {/* More Button */}
      {filteredItems.length > 2 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full mt-3 flex items-center justify-center text-xs text-mutedBlue font-medium py-2 hover:bg-blue-50/50 rounded-lg transition-colors"
        >
          {expanded ? '收起' : '查看更多话题'}
          <ChevronDown 
            size={14} 
            className={`ml-1 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} 
          />
        </button>
      )}
    </div>
  );
};

export default IcebreakerSection;