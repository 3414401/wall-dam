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
