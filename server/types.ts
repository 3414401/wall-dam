export interface RosterRow {
  id: string;
  label: string;
  cells: Record<string, string>;
}

export interface RosterData {
  fileName: string;
  columns: string[];
  rows: RosterRow[];
  uploadedAt: string;
}

export interface SurveyResponse {
  id: string;
  nickname: string;
  scores: number[];
  submittedAt: string;
  rosterRowId?: string;
  rosterLabel?: string;
  rosterFields?: Record<string, string>;
}

export interface TeamGroup {
  teamIndex: number;
  memberIds: string[];
  totals: number[];
}

export interface AbilityStat {
  name: string;
  mean: number;
  std: number;
  min: number;
  max: number;
}

export interface TeamInsightLine {
  teamIndex: number;
  comment: string;
  recommendedActivity?: string;
}

export interface SessionInsights {
  homogeneityIndex: number;
  overallSummary: string;
  abilityStats: AbilityStat[];
  teamComments: TeamInsightLine[];
  generatedAt: string;
}

export interface SessionData {
  code: string;
  abilities: string[];
  teamPurpose?: string;
  createdAt: string;
  createdBy: string;
  surveys: SurveyResponse[];
  teamCount: number;
  groups: TeamGroup[] | null;
  balancedAt: string | null;
  balanceMethod: "greedy" | "ai" | null;
  aiBalanceNote: string | null;
  aiTeamExplanations?: TeamInsightLine[] | null;
  insights: SessionInsights | null;
  roster: RosterData | null;
}

export const RANDOM_SUBJECTS = [
  "국어",
  "수학",
  "영어",
  "사회",
  "과학",
  "예체능",
] as const;

export type RandomSubject = (typeof RANDOM_SUBJECTS)[number];

export interface RandomSurveyResponse {
  id: string;
  nickname: string;
  email: string;
  scores: number[];
  submittedAt: string;
  rosterRowId?: string;
  rosterLabel?: string;
  rosterFields?: Record<string, string>;
}

export interface RandomChatMessage {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
  system?: boolean;
}

export interface RandomRoomData {
  code: string;
  entryCode: string;
  subject: RandomSubject;
  abilities: string[];
  criterion3: string;
  criterion4: string;
  recipientEmail: string;
  createdAt: string;
  createdBy: string;
  surveys: RandomSurveyResponse[];
  joinClosed: boolean;
  maxParticipants: number;
  selectedEmail: string | null;
  matchedAt: string | null;
  matchNote: string | null;
  messages: RandomChatMessage[];
}

export interface RandomRoomPublic {
  code: string;
  subject: RandomSubject;
  criterion3: string;
  criterion4: string;
  createdAt: string;
  createdBy: string;
  participantCount: number;
  maxParticipants: number;
  joinClosed: boolean;
  selectedEmail: string | null;
  matchedAt: string | null;
}
