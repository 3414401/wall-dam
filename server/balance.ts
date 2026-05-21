import type { SurveyResponse, TeamGroup } from "./types.js";

function teamSums(members: SurveyResponse[]): number[] {
  const dims = members[0]?.scores.length ?? 5;
  const sums = Array(dims).fill(0);
  for (const m of members) {
    m.scores.forEach((v, i) => {
      sums[i] += v;
    });
  }
  return sums;
}

function imbalanceCost(teamTotals: number[][]): number {
  if (teamTotals.length === 0) return 0;
  const dims = teamTotals[0].length;
  let cost = 0;
  for (let d = 0; d < dims; d++) {
    const vals = teamTotals.map((t) => t[d]);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    for (const v of vals) {
      cost += (v - avg) ** 2;
    }
  }
  return cost;
}

export function balanceTeams(
  surveys: SurveyResponse[],
  teamCount: number
): TeamGroup[] {
  if (surveys.length === 0) return [];
  const count = Math.max(2, Math.min(teamCount, surveys.length));
  const dims = surveys[0].scores.length;

  const teams: SurveyResponse[][] = Array.from({ length: count }, () => []);

  const sorted = [...surveys].sort((a, b) => {
    const sa = a.scores.reduce((s, v) => s + v, 0);
    const sb = b.scores.reduce((s, v) => s + v, 0);
    return sb - sa;
  });

  for (const member of sorted) {
    let bestIdx = 0;
    let bestCost = Infinity;

    for (let i = 0; i < count; i++) {
      const trial = teams.map((t, idx) =>
        idx === i ? [...t, member] : [...t]
      );
      const totals = trial.map((t) =>
        t.length ? teamSums(t) : Array(dims).fill(0)
      );
      const cost = imbalanceCost(totals);
      if (cost < bestCost) {
        bestCost = cost;
        bestIdx = i;
      }
    }

    teams[bestIdx].push(member);
  }

  return teams.map((members, teamIndex) => ({
    teamIndex: teamIndex + 1,
    memberIds: members.map((m) => m.id),
    totals: teamSums(members),
  }));
}
