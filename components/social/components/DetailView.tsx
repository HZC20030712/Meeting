import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { Profile } from '../types';
import BusinessCard from './BusinessCard';

interface DetailViewProps {
  profile: Profile;
  onBack: () => void;
}

const DetailView: React.FC<DetailViewProps> = ({ profile, onBack }) => {
  return (
    <div className="absolute inset-0 bg-gray-50 flex flex-col">
      {/* Detail Header */}
      <header className="relative z-20 px-4 py-4 flex items-center bg-gray-50/50 backdrop-blur-sm">
        <button 
            onClick={onBack}
            className="p-2 -ml-2 text-slateGray hover:text-graphite transition-colors rounded-full hover:bg-gray-200/50"
        >
          <ArrowLeft size={24} />
        </button>
        <span className="ml-2 text-sm font-semibold text-slateGray">返回列表</span>
      </header>

      {/* Card Container - Reuse BusinessCard full screen logic */}
      <div className="flex-1 w-full h-full px-4 pb-8 overflow-hidden flex flex-col items-center">
        <div className="w-full max-w-md h-full">
             <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="w-full h-full"
             >
                <BusinessCard profile={profile} isActive={true} />
             </motion.div>
        </div>
      </div>
    </div>
  );
};

export default DetailView;
