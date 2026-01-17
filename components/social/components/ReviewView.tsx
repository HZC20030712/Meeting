import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, X, Check, ArrowRight } from 'lucide-react';
import { Profile } from '../types';
import BusinessCard from './BusinessCard';

interface ReviewViewProps {
  profiles: Profile[];
  onComplete: () => void;
}

const ReviewView: React.FC<ReviewViewProps> = ({ profiles, onComplete }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  const handleNext = () => {
    if (currentIndex < profiles.length - 1) {
      setDirection(1);
      setCurrentIndex(curr => curr + 1);
    } else {
        // End of list
        onComplete();
    }
  };

  const handleSkip = () => {
      // Logic for skip is same as next for this demo, visually distinguished
      handleNext();
  };

  const dragEndHandler = (e: any, { offset, velocity }: any) => {
    const swipeConfidenceThreshold = 10000;
    const swipePower = Math.abs(offset.x) * velocity.x;

    if (swipePower < -swipeConfidenceThreshold || offset.x < -100) {
      handleNext();
    } else if ((swipePower > swipeConfidenceThreshold || offset.x > 100) && currentIndex > 0) {
      setDirection(-1);
      setCurrentIndex(curr => curr - 1);
    }
  };

  return (
    <div className="absolute inset-0 bg-gray-100 flex flex-col overflow-hidden">
      
      {/* Top Header */}
      <div className="relative z-20 px-6 py-5 flex justify-between items-center bg-gray-100/50 backdrop-blur-sm">
        <div className="flex flex-col">
           <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slateGray">会议回顾</span>
           <span className="text-sm font-semibold text-graphite">供应链优化研讨会</span>
        </div>
        <div className="text-xs font-bold text-slateGray bg-white px-3 py-1 rounded-full border border-gray-200">
            {currentIndex + 1} / {profiles.length}
        </div>
      </div>

      {/* Card Deck Area */}
      <div className="flex-1 relative flex flex-col justify-center items-center pb-24 overflow-hidden w-full">
        
        {/* Navigation Hints */}
        {currentIndex > 0 && (
            <div 
                className="absolute left-2 top-1/2 -translate-y-1/2 z-30 p-2 text-gray-300 pointer-events-none"
            >
                <ChevronLeft size={32} />
            </div>
        )}
        
        {/* Card Stack */}
        <div className="relative w-full max-w-[400px] h-[640px] flex items-center justify-center perspective-[1000px]">
          <AnimatePresence initial={false} custom={direction}>
            {profiles.map((profile, index) => {
              if (index < currentIndex - 1 || index > currentIndex + 1) return null;
              
              const isCenter = index === currentIndex;
              const isLeft = index < currentIndex;
              
              const xOffset = 350; 

              return (
                <motion.div
                  key={profile.id}
                  custom={direction}
                  initial={{ 
                    x: isCenter ? direction * xOffset : isLeft ? -xOffset : xOffset, 
                    scale: isCenter ? 0.9 : 0.8,
                    opacity: 0,
                    zIndex: isCenter ? 10 : 0
                  }}
                  animate={{ 
                    x: isCenter ? 0 : isLeft ? -xOffset : xOffset, 
                    scale: isCenter ? 1 : 0.9,
                    opacity: isCenter ? 1 : 0.5,
                    zIndex: isCenter ? 10 : 0,
                    rotateY: isCenter ? 0 : isLeft ? 5 : -5
                  }}
                  exit={{ 
                    x: direction < 0 ? xOffset : -xOffset, 
                    opacity: 0,
                    scale: 0.9 
                  }}
                  transition={{
                    x: { type: "spring", stiffness: 300, damping: 30 },
                    opacity: { duration: 0.2 },
                    scale: { duration: 0.2 }
                  }}
                  drag={isCenter ? "x" : false}
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.1}
                  onDragEnd={dragEndHandler}
                  className={`absolute w-[88%] md:w-[340px] h-full shadow-2xl rounded-[24px] ${isCenter ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'}`}
                >
                   <BusinessCard profile={profile} isActive={isCenter} />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom Action Bar (S2 Specific) */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-white/90 backdrop-blur-md border-t border-gray-100 z-40 flex justify-between items-center gap-4 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
         <button 
            onClick={handleSkip}
            className="flex-1 py-3.5 px-6 rounded-xl font-semibold text-slateGray bg-gray-100 hover:bg-gray-200 transition-colors flex justify-center items-center gap-2"
         >
            <X size={18} />
            跳过
         </button>
         <button 
            onClick={handleNext}
            className="flex-[2] py-3.5 px-6 rounded-xl font-semibold text-white bg-mutedBlue hover:bg-blue-700 shadow-lg shadow-blue-900/10 transition-all flex justify-center items-center gap-2"
         >
            <Check size={18} />
            {currentIndex === profiles.length - 1 ? '完成回顾' : '标记为已读'}
         </button>
      </div>
    </div>
  );
};

export default ReviewView;
