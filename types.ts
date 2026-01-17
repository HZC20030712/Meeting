
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
  analysisResult?: AnalysisResult;
  chapters?: ChaptersResult;
}

export type AnalysisResult = ProjectStandardResult | DeepInsightResult | CrossroadsResult | ChaptersResult | FullSummaryResult;

export interface FullSummaryResult {
  mode: 'full_summary';
  speaker_summaries: {
    speaker: string;
    summary: string;
  }[];
  qa_pairs: {
    question: string;
    answer: string;
  }[];
}

export interface ChaptersResult {
  chapters: {
    timestamp: string;
    title: string;
    summary: string;
  }[];
}

export interface ProjectStandardResult {
  mode: 'project_standard';
  meta: {
    title: string;
    summary: string;
    duration: string;
  };
  action_items: {
    task: string;
    owner: string;
    deadline: string;
    priority: 'High' | 'Medium' | 'Low';
    timestamp: string;
  }[];
  decisions: {
    content: string;
    timestamp: string;
  }[];
  key_milestones: {
    event: string;
    date: string;
  }[];
}

export interface DeepInsightResult {
  mode: 'deep_insight';
  insights: {
    timestamp: string;
    speaker: string;
    original_text: string;
    subtext: string;
    intent_tag: string;
    confidence: number;
    risk_level: 'High' | 'Medium' | 'Low';
  }[];
  speaker_profiles: {
    name: string;
    stance: string;
    hidden_agenda: string;
    emotion_curve: string[];
  }[];
}

export interface CrossroadsResult {
  mode: 'crossroads';
  decision_points: {
    timestamp: string;
    context: string;
    actual_move: string;
    actual_outcome: string;
    alternative_move: string;
    simulated_outcome: string;
    game_theory_analysis: string;
  }[];
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
