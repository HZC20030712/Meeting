import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Sparkles, Loader2 } from 'lucide-react';
import { Profile } from '../types';
import IcebreakerSection from './IcebreakerSection';
import { generateProfileInsights } from '../services/geminiService';

interface BusinessCardProps {
  profile: Profile;
  isActive: boolean;
}

const BusinessCard: React.FC<BusinessCardProps> = ({ profile, isActive }) => {
  const [currentProfile, setCurrentProfile] = useState(profile);
  const [isUpdating, setIsUpdating] = useState(false);

  // Parent variants for stagger effect
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { type: "spring", stiffness: 100, damping: 15 }
    }
  };

  const handleSmartUpdate = async () => {
    setIsUpdating(true);
    const insights = await generateProfileInsights(
      currentProfile.name,
      currentProfile.role,
      currentProfile.company,
      currentProfile.upcomingMeeting.title
    );
    
    if (insights) {
      setCurrentProfile(prev => ({
        ...prev,
        icebreakers: insights.icebreakers,
        nudge: insights.nudge
      }));
    }
    setIsUpdating(false);
  };

  return (
    <div className={`
      relative w-full h-full bg-surface rounded-[24px] overflow-hidden flex flex-col
      border-[1px] border-white/40
      shadow-float
      transition-all duration-500
    `}>
      {/* Scrollable Content Container */}
      <div className="flex-1 overflow-y-auto no-scrollbar relative z-10 p-6 pb-24">
        
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={isActive ? "visible" : "hidden"}
        >
          {/* Header */}
          <motion.div variants={itemVariants} className="flex flex-col items-center text-center mt-2">
            <div className="relative">
              <img 
                src={currentProfile.avatarUrl} 
                alt={currentProfile.name} 
                className="w-20 h-20 rounded-full object-cover border-[3px] border-white shadow-sm"
              />
              <div className="absolute inset-0 rounded-full border border-black/5 pointer-events-none"></div>
            </div>
            
            <h2 className="mt-4 text-xl font-bold text-graphite tracking-tight">
              {currentProfile.name}
            </h2>
            <p className="text-sm text-slateGray font-medium mt-1">
              {currentProfile.role} <span className="text-gray-300 mx-1">|</span> {currentProfile.company}
            </p>

            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {currentProfile.tags.map((tag, idx) => (
                <span 
                  key={idx} 
                  className="px-3 py-1 bg-gray-50 text-slateGray text-[11px] font-semibold rounded-full border border-gray-100"
                >
                  {tag}
                </span>
              ))}
            </div>
          </motion.div>

          {/* Timeline / Connection Context */}
          <motion.div variants={itemVariants} className="mt-8">
            <div className="relative pl-4 border-l-2 border-gray-100 py-1">
               <div className="absolute -left-[5px] top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-mutedBlue rounded-full ring-4 ring-white"></div>
               <div className="bg-warmPaper/60 p-4 rounded-xl border border-gray-100/50">
                  <div className="flex items-center space-x-3 text-mutedBlue mb-2">
                    <Calendar size={14} />
                    <span className="text-xs font-bold uppercase tracking-wide">{currentProfile.upcomingMeeting.date}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-graphite">
                    {currentProfile.upcomingMeeting.title}
                  </h3>
                  <div className="flex items-center text-xs text-slateGray mt-1.5">
                    <MapPin size={12} className="mr-1" />
                    {currentProfile.upcomingMeeting.location}
                    <span className="mx-2">•</span>
                    {currentProfile.upcomingMeeting.time}
                  </div>
               </div>
            </div>
          </motion.div>

          {/* Icebreakers */}
          <motion.div variants={itemVariants}>
            <div className="flex items-center justify-between mt-8 mb-2">
              <h4 className="text-xs font-bold text-slateGray uppercase tracking-wider">话题破冰</h4>
              <button 
                onClick={handleSmartUpdate}
                disabled={isUpdating}
                className="flex items-center text-[10px] text-mutedBlue font-medium hover:bg-blue-50 px-2 py-1 rounded transition-colors"
              >
                {isUpdating ? <Loader2 size={12} className="animate-spin mr-1"/> : <Sparkles size={12} className="mr-1" />}
                AI 刷新
              </button>
            </div>
            <IcebreakerSection icebreakers={currentProfile.icebreakers} />
          </motion.div>

          <div className="h-4"></div> 
        </motion.div>
      </div>

      {/* Gentle Nudge (Sticky Bottom) */}
      <motion.div 
        initial={{ y: 100 }}
        animate={{ y: isActive ? 0 : 100 }}
        transition={{ delay: 0.5, type: "spring", stiffness: 80 }}
        className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-white via-white to-transparent"
      >
        <div className="bg-[#FFFDF5] border border-amber-100/50 p-4 rounded-xl shadow-[0_4px_20px_rgba(251,191,36,0.06)] backdrop-blur-sm">
          <div className="flex items-start gap-3">
             <div className="p-1.5 bg-amber-50 rounded-full shrink-0">
               <Sparkles size={14} className="text-amber-500" />
             </div>
             <div>
               <p className="text-[11px] font-bold text-amber-800/60 uppercase tracking-wide mb-1">智能建议</p>
               <p className="text-sm text-graphite font-medium leading-snug">
                 {currentProfile.nudge}
               </p>
             </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default BusinessCard;
