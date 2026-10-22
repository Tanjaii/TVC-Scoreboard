export type MatchStatus = "scheduled" | "live" | "completed";

export type SetScore = {
  setNumber: number;
  homeScore: number;
  awayScore: number;
};

export type CompetitionMatch = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  stage: string;
  scheduledStartAt: string;
  status: MatchStatus;
  sets: SetScore[];
};

export type CompetitionState = {
  matches: CompetitionMatch[];
};

export const initialCompetitionState: CompetitionState = {
  matches: [],
};
