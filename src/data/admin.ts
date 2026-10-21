export type OverviewStat = {
  label: string;
  value: string;
  meta: string;
  tone: "blue" | "gold" | "red" | "green";
};

export const overviewStats: OverviewStat[] = [
  { label: "Matches Played", value: "--", meta: "Awaiting input", tone: "blue" },
  { label: "Teams", value: "04", meta: "League", tone: "gold" },
  { label: "Officials", value: "03", meta: "Assigned", tone: "red" },
  { label: "Decisions", value: "00", meta: "Logged", tone: "green" },
];

export type MatchQueueEntry = {
  match: string;
  stage: string;
  time: string;
  status: "Live" | "Queued" | "Ready" | "Waiting";
};

export const matchesQueue: MatchQueueEntry[] = [
  { match: "Waiting for live data", stage: "Awaiting input", time: "--:--", status: "Waiting" },
  { match: "Waiting for live data", stage: "Awaiting input", time: "--:--", status: "Waiting" },
  { match: "Waiting for live data", stage: "Awaiting input", time: "--:--", status: "Waiting" },
];

export type DecisionEntry = {
  title: string;
  team: string;
  by: string;
  time: string;
};

export const decisionLog: DecisionEntry[] = [];

export type AccessMatrixEntry = {
  role: string;
  permissions: string;
  status: "Active" | "Authorised";
};

export const accessMatrix: AccessMatrixEntry[] = [
  { role: "Richard", permissions: "Full admin access", status: "Active" },
  { role: "Evans", permissions: "Full admin access", status: "Active" },
  { role: "Obulor", permissions: "Full admin access", status: "Active" },
  { role: "Scorekeeper", permissions: "Assigned matches only", status: "Authorised" },
  { role: "Official - Head Ref", permissions: "Decisions + review", status: "Authorised" },
];
