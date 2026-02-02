
export interface User {
  email: string;
  name: string;
}

export interface TranscriptionSegment {
  id: string;
  text: string;
  speaker: 'user' | 'ai';
  timestamp: number;
}

export interface AnalysisResult {
  summary: string;
  keyPoints: string[];
  actionItems: string[];
}

export interface Session {
  id: string;
  title: string;
  timestamp: number;
  segments: TranscriptionSegment[];
  analysis?: AnalysisResult;
  duration?: number;
}

export enum AppMode {
  HOME = 'HOME',
  LIVE = 'LIVE',
  FILE = 'FILE',
  CALENDAR = 'CALENDAR',
  LIBRARY = 'LIBRARY',
  SETTINGS = 'SETTINGS',
  SEARCH = 'SEARCH'
}

export interface CalendarEvent {
  id: string;
  title: string;
  startTime: string; // HH:mm format
  endTime: string;   // HH:mm format
  days: number[];    // 0-6 (Sunday-Saturday)
  date?: string;     // YYYY-MM-DD
  location?: string;
  isExternal?: boolean;
}
