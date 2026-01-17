import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ChevronRight, CalendarClock, Clock, Tag, Building2, X } from 'lucide-react';
import { Profile } from '../types';
import { useDebounce, performSearch, HighlightText, RECENT_SEARCHES, POPULAR_TAGS } from '../utils';

interface ListViewProps {
  recentProfiles: Profile[];
  historyProfiles: Profile[];
  onSelectProfile: (profile: Profile) => void;
  onReviewNew: () => void;
  hasNewMeeting: boolean;
  // Search State Props
  isSearchActive: boolean;
  setIsSearchActive: (active: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

const ListView: React.FC<ListViewProps> = ({ 
  recentProfiles, 
  historyProfiles, 
  onSelectProfile, 
  onReviewNew,
  hasNewMeeting,
  isSearchActive,
  setIsSearchActive,
  searchQuery,
  setSearchQuery
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(searchQuery, 200);
  
  // Combine all profiles for search
  const allProfiles = [...recentProfiles, ...historyProfiles];
  const searchResults = performSearch(allProfiles, debouncedQuery);

  // Auto-focus logic
  useEffect(() => {
    if (isSearchActive && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isSearchActive]);

  const handleClearSearch = () => {
    setSearchQuery('');
    setIsSearchActive(false);
  };

  const handleTagClick = (tag: string) => {
    setSearchQuery(tag.replace('#', ''));
    if (searchInputRef.current) searchInputRef.current.focus();
  };

  // Group by company logic for "Aggregation View"
  const groupedResults: { [key: string]: Profile[] } = {};
  let showGrouped = false;
  
  if (debouncedQuery) {
     searchResults.forEach(p => {
         if (!groupedResults[p.company]) groupedResults[p.company] = [];
         groupedResults[p.company].push(p);
     });
     showGrouped = Object.values(groupedResults).some(g => g.length > 1);
  }

  return (
    <div className="h-full bg-gray-50 flex flex-col font-sans text-graphite pb-10 relative">
      
      {/* ==================== 1. Standard Header (Bottom Layer) ==================== */}
      <header className="sticky top-0 z-30 bg-gray-50/95 backdrop-blur-md px-6 py-4 border-b border-gray-200/50 h-[72px] flex items-center justify-between">
        <motion.h1 
            animate={{ opacity: isSearchActive ? 0 : 1, x: isSearchActive ? -20 : 0 }}
            transition={{ duration: 0.2 }}
            className="text-xl font-bold text-graphite tracking-tight whitespace-nowrap"
        >
            我的社交网络
        </motion.h1>
        
        {/* Placeholder for search icon to maintain layout, actual button fades out */}
        <motion.button 
            animate={{ opacity: isSearchActive ? 0 : 1, scale: isSearchActive ? 0.8 : 1 }}
            onClick={() => setIsSearchActive(true)}
            className="p-2 -mr-2 text-slateGray hover:text-graphite transition-colors"
            style={{ pointerEvents: isSearchActive ? 'none' : 'auto' }}
        >
            <Search size={22} strokeWidth={1.5} />
        </motion.button>
      </header>

      {/* ==================== 2. Main List Content (Bottom Layer) ==================== */}
      <main className="flex-1 px-4 pt-4 overflow-y-auto">
         {/* New Meeting Notification */}
         {hasNewMeeting && (
            <div className="mb-8">
                <div className="flex justify-between items-end mb-3 px-2">
                    <h2 className="text-xs font-bold text-slateGray uppercase tracking-wider">待办事项</h2>
                </div>
                <div 
                    onClick={onReviewNew}
                    className="relative overflow-hidden bg-gradient-to-r from-graphite to-slate-800 rounded-xl p-5 shadow-lg cursor-pointer group"
                >
                    <div className="relative z-10 flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <div className="p-3 bg-white/10 rounded-full">
                                <CalendarClock className="text-white" size={20} />
                            </div>
                            <div>
                                <h3 className="text-white font-semibold text-lg">会议结束</h3>
                                <p className="text-white/70 text-sm">有 {2} 位新联系人待回顾</p>
                            </div>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors">
                            <ChevronRight className="text-white" size={16} />
                        </div>
                    </div>
                    {/* Abstract bg decoration */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 blur-2xl"></div>
                </div>
            </div>
         )}

         {/* Recently Reviewed */}
         {recentProfiles.length > 0 && (
            <div className="mb-8">
                <h2 className="text-xs font-bold text-slateGray uppercase tracking-wider mb-3 px-2">最近会议新增</h2>
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {recentProfiles.map((profile, idx) => (
                    <ListItem 
                        key={profile.id} 
                        profile={profile} 
                        onClick={() => onSelectProfile(profile)} 
                        isLast={idx === recentProfiles.length - 1}
                    />
                ))}
                </div>
            </div>
         )}

         {/* History */}
         <div>
            <h2 className="text-xs font-bold text-slateGray uppercase tracking-wider mb-3 px-2">历史参会</h2>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {historyProfiles.map((profile, idx) => (
                    <ListItem 
                        key={profile.id} 
                        profile={profile} 
                        onClick={() => onSelectProfile(profile)} 
                        isLast={idx === historyProfiles.length - 1}
                    />
                ))}
                {historyProfiles.length === 0 && (
                    <div className="p-8 text-center text-slateGray text-sm">
                        暂无历史记录
                    </div>
                )}
            </div>
         </div>
      </main>

      {/* ==================== 3. Search Overlay (Middle & Top Layers) ==================== */}
      <AnimatePresence>
        {isSearchActive && (
          <>
            {/* Middle Layer: Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 z-40 bg-[rgba(255,255,255,0.4)] backdrop-blur-[15px] brightness-[0.98]"
              onClick={handleClearSearch}
            />

            {/* Top Layer: Content Container */}
            <div className="fixed inset-0 z-50 flex flex-col pointer-events-none">
              
              {/* Top Layer: Search Header */}
              <div className="h-[72px] px-6 py-4 flex items-center justify-end pointer-events-auto">
                 <motion.div 
                   initial={{ width: 40, opacity: 0 }} 
                   animate={{ width: '100%', opacity: 1 }}
                   exit={{ width: 40, opacity: 0 }}
                   transition={{ ease: [0.4, 0, 0.2, 1], duration: 0.3 }}
                   className="flex items-center w-full gap-3 origin-right"
                 >
                    <div className="relative flex-1 group">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slateGray" size={16} />
                      <input
                        ref={searchInputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="搜索姓名、公司或话题..."
                        className="w-full h-[36px] bg-[#F5F7FA] rounded-xl pl-9 pr-8 text-sm text-graphite focus:outline-none focus:ring-2 focus:ring-mutedBlue/10 placeholder-gray-400 shadow-inner"
                      />
                      {searchQuery && (
                          <button onClick={() => { setSearchQuery(''); searchInputRef.current?.focus(); }} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 rounded-full transition-colors">
                              <X size={12} className="text-gray-500"/>
                          </button>
                      )}
                    </div>
                    <button 
                      onClick={handleClearSearch}
                      className="text-sm font-semibold text-mutedBlue whitespace-nowrap active:opacity-70"
                    >
                      取消
                    </button>
                 </motion.div>
              </div>

              {/* Top Layer: Search Body */}
              <div className="flex-1 overflow-y-auto px-4 pt-2 pb-20 pointer-events-auto no-scrollbar">
                
                {/* 3a. Suggestions (Empty State) */}
                {!searchQuery && (
                  <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: 0.1 }}
                  >
                      {/* Recent Searches */}
                      <div className="mb-6">
                          <div className="flex items-center gap-2 mb-3 px-1 text-slateGray">
                              <Clock size={12} />
                              <span className="text-xs font-bold uppercase tracking-wider">最近搜索</span>
                          </div>
                          <div className="flex overflow-x-auto no-scrollbar gap-3 pb-2 -mx-4 px-4">
                              {RECENT_SEARCHES.map(term => (
                                  <button 
                                      key={term}
                                      onClick={() => setSearchQuery(term)}
                                      className="px-4 py-2 bg-[#F5F7FA] rounded-full text-xs font-medium text-graphite whitespace-nowrap active:scale-95 transition-transform"
                                  >
                                      {term}
                                  </button>
                              ))}
                          </div>
                      </div>

                      {/* Popular Tags */}
                      <div>
                          <div className="flex items-center gap-2 mb-3 px-1 text-slateGray">
                              <Tag size={12} />
                              <span className="text-xs font-bold uppercase tracking-wider">热门标签</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                              {POPULAR_TAGS.map(tag => (
                                  <button 
                                      key={tag}
                                      onClick={() => handleTagClick(tag)}
                                      className="px-3 py-1.5 bg-[#F5F7FA] rounded-lg text-xs text-slateGray hover:text-mutedBlue hover:bg-blue-50 transition-colors"
                                  >
                                      {tag}
                                  </button>
                              ))}
                          </div>
                      </div>
                  </motion.div>
                )}

                {/* 3b. Results (Active State) */}
                {searchQuery && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-4"
                  >
                    {searchResults.length === 0 ? (
                        <div className="text-center py-12 text-slateGray text-sm">
                            未找到相关结果
                        </div>
                    ) : (
                        <>
                            {showGrouped ? (
                                 Object.entries(groupedResults).map(([company, profiles]) => (
                                     <div key={company} className="bg-white rounded-2xl shadow-soft overflow-hidden mb-4">
                                        <div className="px-4 py-2 bg-gray-50/50 border-b border-gray-100 flex items-center gap-2">
                                            <Building2 size={12} className="text-mutedBlue" />
                                            <h3 className="text-[10px] font-bold uppercase text-slateGray tracking-wider">
                                                {company} <span className="ml-1 opacity-70">({profiles.length})</span>
                                            </h3>
                                        </div>
                                        {profiles.map((profile, idx) => (
                                            <SearchResultItem 
                                                key={profile.id}
                                                profile={profile}
                                                query={debouncedQuery}
                                                onClick={() => onSelectProfile(profile)}
                                                isLast={idx === profiles.length - 1}
                                            />
                                        ))}
                                     </div>
                                 ))
                            ) : (
                                <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
                                    {searchResults.map((profile, idx) => (
                                        <SearchResultItem 
                                            key={profile.id}
                                            profile={profile}
                                            query={debouncedQuery}
                                            onClick={() => onSelectProfile(profile)}
                                            isLast={idx === searchResults.length - 1}
                                        />
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                  </motion.div>
                )}
              </div>
            </div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
};

// Compact Search Result Item
const SearchResultItem: React.FC<{ profile: Profile; query: string; onClick: () => void; isLast: boolean }> = ({ profile, query, onClick, isLast }) => (
    <motion.div 
        onClick={onClick}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex items-center justify-between p-3.5 cursor-pointer bg-white hover:bg-gray-50 transition-colors ${!isLast ? 'border-b border-gray-100' : ''}`}
    >
        <div className="flex items-center space-x-3.5">
            <img 
                src={profile.avatarUrl} 
                alt={profile.name} 
                className="w-9 h-9 rounded-full object-cover border border-gray-100"
            />
            <div className="flex flex-col">
                <h3 className="text-graphite font-bold text-sm">
                    <HighlightText text={profile.name} highlight={query} />
                </h3>
                <p className="text-slateGray text-xs mt-0.5 font-medium truncate max-w-[200px]">
                    <HighlightText text={profile.role} highlight={query} />
                    <span className="mx-1 text-gray-300">|</span>
                    <HighlightText text={profile.company} highlight={query} />
                </p>
                {/* Context Match Hint */}
                {!profile.name.toLowerCase().includes(query.toLowerCase()) && 
                 !profile.role.toLowerCase().includes(query.toLowerCase()) && 
                 !profile.company.toLowerCase().includes(query.toLowerCase()) && (
                     <p className="text-[10px] text-mutedBlue mt-0.5 flex items-center gap-1">
                         <SparklesIcon size={10} />
                         <span>匹配到话题或标签</span>
                     </p>
                 )}
            </div>
        </div>
        <ChevronRight size={16} className="text-gray-300" />
    </motion.div>
);

const ListItem: React.FC<{ profile: Profile; onClick: () => void; isLast: boolean }> = ({ profile, onClick, isLast }) => (
  <div 
    onClick={onClick}
    className={`flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors ${!isLast ? 'border-b border-gray-100' : ''}`}
  >
    <div className="flex items-center space-x-4">
      <img 
        src={profile.avatarUrl} 
        alt={profile.name} 
        className="w-12 h-12 rounded-full object-cover border border-gray-100"
      />
      <div>
        <h3 className="text-graphite font-bold text-base">{profile.name}</h3>
        <p className="text-slateGray text-xs mt-0.5 font-medium">
          {profile.role} <span className="mx-1 text-gray-300">|</span> {profile.company}
        </p>
      </div>
    </div>
    <ChevronRight size={18} className="text-gray-300" />
  </div>
);

const SparklesIcon = ({ size }: { size: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
)

export default ListView;
