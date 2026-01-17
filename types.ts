
export interface Meeting {
  id: string;
  title: string;
  host: string;
  duration: string;
  durationSeconds?: number;
  time: string;
  date: string;
  type: 'strategy' | 'product' | 'recruitment' | 'interview' | 'other';
  segments?: TranscriptSegment[];
  speakerMap?: Record<string, string>;
  summary?: string;
  keywords?: string[];
  audioUrl?: string;
}

export interface PersonaCapsule {
  id: string;
  label: string;
  icon: string;
  color: string;
}

export interface Folder {
  id: string;
  name: string;
  itemCount: number;
  color: string;
}

export enum AppTab {
  RECENT = 'recent',
  SHARED = 'shared',
  FOLDERS = 'folders',
  SOCIAL = 'social'
}

export interface TranscriptSegment {
  id: string;
  type: 'user' | 'suggestion';
  content: string;
  status?: 'thinking' | 'streaming' | 'done';
  startTime?: string;
  endTime?: string;
  speaker?: string;
}
