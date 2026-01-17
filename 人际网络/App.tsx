import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import { NEW_MEETING_PROFILES, HISTORY_PROFILES } from './constants';
import { Profile } from './types';
import ListView from './components/ListView';
import ReviewView from './components/ReviewView';
import DetailView from './components/DetailView';

type AppState = 'LIST' | 'REVIEW' | 'DETAIL';

const App: React.FC = () => {
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
    <div className="relative bg-gray-50 min-h-screen">
       <AnimatePresence mode='wait'>
          {viewState === 'LIST' && (
              <motion.div 
                key="list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, x: -20 }}
                className="absolute inset-0"
              >
                  <ListView 
                    recentProfiles={recentProfiles}
                    historyProfiles={historyProfiles}
                    onSelectProfile={handleSelectProfile}
                    onReviewNew={handleStartReview}
                    hasNewMeeting={newProfiles.length > 0}
                    // Pass search state
                    isSearchActive={isSearchActive}
                    setIsSearchActive={setIsSearchActive}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                  />
              </motion.div>
          )}

          {viewState === 'REVIEW' && (
              <motion.div 
                key="review"
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                className="absolute inset-0 z-50"
              >
                  <ReviewView 
                    profiles={newProfiles}
                    onComplete={handleReviewComplete}
                  />
              </motion.div>
          )}

          {viewState === 'DETAIL' && selectedProfile && (
              <motion.div 
                key="detail"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="absolute inset-0 z-40"
              >
                  <DetailView 
                    profile={selectedProfile}
                    onBack={handleBackToList}
                  />
              </motion.div>
          )}
       </AnimatePresence>

       {/* S4: Success Toast Overlay */}
       <AnimatePresence>
         {showSuccessToast && (
            <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 backdrop-blur-sm"
            >
                <div className="bg-white rounded-2xl shadow-float p-8 flex flex-col items-center text-center max-w-xs mx-4">
                    <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
                        <CheckCircle2 size={32} className="text-green-500" />
                    </div>
                    <h3 className="text-xl font-bold text-graphite mb-2">回顾完成</h3>
                    <p className="text-slateGray text-sm">
                        所有名片已回顾并添加至列表
                    </p>
                </div>
            </motion.div>
         )}
       </AnimatePresence>
    </div>
  );
};

export default App;