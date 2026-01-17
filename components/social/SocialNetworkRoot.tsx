import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import { NEW_MEETING_PROFILES, HISTORY_PROFILES } from './constants';
import { Profile } from './types';
import ListView from './components/ListView';
import ReviewView from './components/ReviewView';
import DetailView from './components/DetailView';

type AppState = 'LIST' | 'REVIEW' | 'DETAIL';

const SocialNetworkRoot: React.FC = () => {
  const [viewState, setViewState] = useState<AppState>('LIST');
  
  // Data State
  const [newProfiles, setNewProfiles] = useState<Profile[]>(NEW_MEETING_PROFILES);
  const [recentProfiles, setRecentProfiles] = useState<Profile[]>([]);
  const [historyProfiles, setHistoryProfiles] = useState<Profile[]>(HISTORY_PROFILES);
  
  // Selection State
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);

  // Search State (Lifted)
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Transition State
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  // Handlers
  const handleStartReview = () => {
    setViewState('REVIEW');
  };

  const handleReviewComplete = () => {
    // S4 Transition
    setShowSuccessToast(true);
    
    // Move new profiles to recent
    setTimeout(() => {
        setRecentProfiles(prev => [...newProfiles, ...prev]);
        setNewProfiles([]); // Clear new list
        setViewState('LIST');
        setShowSuccessToast(false);
    }, 1500); // Wait for toast animation
  };

  const handleSelectProfile = (profile: Profile) => {
    setSelectedProfile(profile);
    setViewState('DETAIL');
  };

  const handleBackToList = () => {
    setSelectedProfile(null);
    setViewState('LIST');
    // Note: We intentionally do NOT clear search state here to preserve context
  };

  return (
    <div className="relative bg-gray-50 h-full w-full overflow-hidden">
       {/* 1. Base Layer: List View (Always rendered, maintained state) */}
       <div className={`absolute inset-0 z-0 transition-transform duration-300 ${viewState !== 'LIST' ? 'scale-95 opacity-50 pointer-events-none' : 'scale-100 opacity-100'}`}>
          <ListView 
            recentProfiles={recentProfiles}
            historyProfiles={historyProfiles}
            onSelectProfile={handleSelectProfile}
            onReviewNew={handleStartReview}
            hasNewMeeting={newProfiles.length > 0}
            isSearchActive={isSearchActive}
            setIsSearchActive={setIsSearchActive}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />
       </div>

       {/* 2. Overlay Layer: Review View */}
       <AnimatePresence>
          {viewState === 'REVIEW' && (
              <motion.div 
                key="review"
                initial={{ opacity: 0, y: '100%' }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: '100%' }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="absolute inset-0 z-50 bg-gray-100"
              >
                  <ReviewView 
                    profiles={newProfiles}
                    onComplete={handleReviewComplete}
                  />
              </motion.div>
          )}
       </AnimatePresence>

       {/* 3. Overlay Layer: Detail View */}
       <AnimatePresence>
          {viewState === 'DETAIL' && selectedProfile && (
              <motion.div 
                key="detail"
                initial={{ opacity: 0, x: '100%' }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: '100%' }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="absolute inset-0 z-50 bg-gray-50"
              >
                  <DetailView 
                    profile={selectedProfile}
                    onBack={handleBackToList}
                  />
              </motion.div>
          )}
       </AnimatePresence>
       
       {/* Toast Notification */}
       <AnimatePresence>
         {showSuccessToast && (
            <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[60] bg-graphite text-white px-6 py-3 rounded-full shadow-float flex items-center gap-3"
            >
                <div className="w-5 h-5 rounded-full bg-green-400 flex items-center justify-center">
                    <CheckCircle2 size={12} className="text-graphite" strokeWidth={3} />
                </div>
                <span className="font-medium text-sm">会议回顾已完成，人脉已归档</span>
            </motion.div>
         )}
       </AnimatePresence>
    </div>
  );
};

export default SocialNetworkRoot;
