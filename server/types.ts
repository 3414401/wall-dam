export interface SurveyResponse {
  id: string;
  nickname: string;
  scores: number[];
  submittedAt: string;
}

export interface TeamGroup {
  teamIndex: number;
  memberIds: string[];
  totals: number[];
}

export interface SessionData {
  code: string;
  abilities: string[];
  createdAt: string;
  createdBy: string;
  surveys: SurveyResponse[];
  teamCount: number;
  groups: TeamGroup[] | null;
  balancedAt: string | null;
}
