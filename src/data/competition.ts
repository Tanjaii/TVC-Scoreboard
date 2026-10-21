export const leftNav = [
  { label: "Home", icon: "home", active: true },
  { label: "Live Matches", icon: "circleDot" },
  { label: "Standings", icon: "trophy" },
  { label: "Schedule", icon: "calendar" },
  { label: "Players", icon: "shield" },
  { label: "Stats", icon: "barChart" },
] as const;

export const statRows = [
  { label: "Attack %", home: 0, away: 0 },
  { label: "Block", home: 0, away: 0 },
  { label: "Ace", home: 0, away: 0 },
  { label: "Errors", home: 0, away: 0 },
  { label: "Total Points", home: 0, away: 0 },
] as const;

export const standings = [
  { rank: 0, team: "Awaiting data", wins: 0, losses: 0, points: 0 },
  { rank: 0, team: "Awaiting data", wins: 0, losses: 0, points: 0 },
  { rank: 0, team: "Awaiting data", wins: 0, losses: 0, points: 0 },
  { rank: 0, team: "Awaiting data", wins: 0, losses: 0, points: 0 },
  { rank: 0, team: "Awaiting data", wins: 0, losses: 0, points: 0 },
] as const;

export const recentMatches = [
  { date: "Awaiting input", home: "Waiting for live data", score: "--", away: "Waiting for live data" },
  { date: "Awaiting input", home: "Waiting for live data", score: "--", away: "Waiting for live data" },
  { date: "Awaiting input", home: "Waiting for live data", score: "--", away: "Waiting for live data" },
  { date: "Awaiting input", home: "Waiting for live data", score: "--", away: "Waiting for live data" },
] as const;

export const matchRows = [
  { team: "Awaiting data", p: 0, w: 0, l: 0, pts: 0 },
  { team: "Awaiting data", p: 0, w: 0, l: 0, pts: 0 },
  { team: "Awaiting data", p: 0, w: 0, l: 0, pts: 0 },
  { team: "Awaiting data", p: 0, w: 0, l: 0, pts: 0 },
  { team: "Awaiting data", p: 0, w: 0, l: 0, pts: 0 },
] as const;

export const previousSets = [
  { set: 0, home: 0, away: 0 },
  { set: 0, home: 0, away: 0 },
  { set: 0, home: 0, away: 0 },
] as const;
