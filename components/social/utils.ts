import React from 'react';
import { Profile } from './types';

// Debounce Hook
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Text Highlighter Component
export const HighlightText: React.FC<{ text: string; highlight: string }> = ({ text, highlight }) => {
  if (!highlight.trim()) {
    return React.createElement('span', null, text);
  }
  
  const regex = new RegExp(`(${highlight})`, 'gi');
  const parts = text.split(regex);

  return React.createElement('span', null,
    parts.map((part, i) => 
      regex.test(part) ? (
        React.createElement('span', {
          key: i,
          className: "text-mutedBlue font-semibold bg-blue-50/50 rounded-sm px-0.5"
        }, part)
      ) : (
        React.createElement('span', { key: i }, part)
      )
    )
  );
};

// Search Logic
interface SearchResult {
  profile: Profile;
  score: number;
  matchType: 'name' | 'company' | 'tag' | 'icebreaker' | 'role';
}

export const performSearch = (profiles: Profile[], query: string): Profile[] => {
  if (!query) return [];

  const lowerQuery = query.toLowerCase();
  
  // Intent Detection: "Chat", "Icebreaker"
  const isIntentChat = ['聊', '破冰', '话题', 'chat'].some(k => lowerQuery.includes(k));

  const results: SearchResult[] = profiles.map(profile => {
    let score = 0;
    let matchType: SearchResult['matchType'] = 'name';

    // 1. Name Match (Highest Priority)
    if (profile.name.toLowerCase().includes(lowerQuery)) {
      score += 100;
      matchType = 'name';
    }

    // 2. Company Match
    if (profile.company.toLowerCase().includes(lowerQuery)) {
      score += 80;
      matchType = 'company';
    }

    // 3. Role Match
    if (profile.role.toLowerCase().includes(lowerQuery)) {
      score += 60;
      matchType = 'role';
    }

    // 4. Tags Match
    const tagMatch = profile.tags.some(tag => tag.toLowerCase().includes(lowerQuery));
    if (tagMatch) {
      score += 50;
      matchType = 'tag';
    }

    // 5. Semantic/Icebreaker Match
    const icebreakerMatch = profile.icebreakers.some(ib => ib.text.toLowerCase().includes(lowerQuery));
    if (icebreakerMatch) {
      score += 40;
      matchType = 'icebreaker';
    }

    // Intent Bonus
    if (isIntentChat && profile.icebreakers.length > 2) {
      score += 20; // Boost profiles with rich topics
    }

    return { profile, score, matchType };
  });

  return results
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(r => r.profile);
};

export const RECENT_SEARCHES = ['AI 基础设施', 'B轮融资', '供应链'];
export const POPULAR_TAGS = ['#决策人', '#技术专家', '#全球运营', '#UX/UI'];
