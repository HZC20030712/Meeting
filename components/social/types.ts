export interface Meeting {
  id: string;
  date: string;
  title: string;
  location: string;
  time: string;
}

export interface Icebreaker {
  id: string;
  category: 'Professional' | 'Interest' | 'Dynamic';
  text: string;
  iconType: 'book' | 'star' | 'zap';
}

export interface Profile {
  id: string;
  name: string;
  role: string;
  company: string;
  avatarUrl: string;
  tags: string[];
  upcomingMeeting: Meeting;
  icebreakers: Icebreaker[];
  nudge: string;
}

export interface GeminiAnalysis {
  icebreakers: Icebreaker[];
  nudge: string;
}
