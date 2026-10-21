export type MatchStats = {
  attackPercent: number;
  blocks: number;
  aces: number;
  errors: number;
};

export type LiveMatchData = {
  homeTeam: string;
  awayTeam: string;
  stage: string;
  setNumber: number;
  scheduledStartAt: string;
  homeScore: number;
  awayScore: number;
  homeStats: MatchStats;
  awayStats: MatchStats;
  isBroadcasting: boolean;
};

export const initialLiveMatch: LiveMatchData = {
  homeTeam: "",
  awayTeam: "",
  stage: "",
  setNumber: 1,
  scheduledStartAt: "",
  homeScore: 0,
  awayScore: 0,
  homeStats: { attackPercent: 0, blocks: 0, aces: 0, errors: 0 },
  awayStats: { attackPercent: 0, blocks: 0, aces: 0, errors: 0 },
  isBroadcasting: false,
};
