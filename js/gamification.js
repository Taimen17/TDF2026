// Leuke extra's bovenop het kale klassement.
function computeBadges({ stages, cumulative, riderContribution }, teams, riderByBib, bibToTeams) {
  if (stages.length === 0) return null;

  const lastStage = stages[stages.length - 1];
  const ranking = lastStage.ranking;

  const leader = ranking[0];
  const lantern = ranking[ranking.length - 1];
  const stageWinner = [...ranking].sort((a, b) => b.stagePoints - a.stagePoints)[0];

  const biggestClimber = [...ranking].sort((a, b) => b.rankChange - a.rankChange)[0];
  const biggestFaller = [...ranking].sort((a, b) => a.rankChange - b.rankChange)[0];

  // Leider-reeks: hoeveel etappes op rij staat de huidige nummer 1 al bovenaan?
  let leaderStreak = 0;
  for (let i = stages.length - 1; i >= 0; i--) {
    const top = stages[i].ranking[0];
    if (top.team === leader.team) leaderStreak++;
    else break;
  }

  // Beste individuele renner per team (grootste puntenbijdrage binnen dat team).
  const bestRiderPerTeam = teams.map(t => {
    const contrib = riderContribution[t.name];
    const bestBib = Object.entries(contrib).sort((a, b) => b[1] - a[1])[0];
    if (!bestBib || bestBib[1] === 0) return { team: t.name, bib: null, points: 0 };
    const [bib, points] = bestBib;
    return { team: t.name, bib: Number(bib), points, rider: riderByBib.get(Number(bib)) };
  });

  // Sterkste renner van de hele tour (punten zijn team-onafhankelijk, dus 1 keer berekenen via elk team dat 'm heeft).
  const riderTotals = new Map();
  for (const t of teams) {
    for (const [bib, pts] of Object.entries(riderContribution[t.name])) {
      riderTotals.set(Number(bib), pts);
    }
  }
  const [topRiderBib, topRiderPoints] = [...riderTotals.entries()].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];

  // Unieke troeven: renners die maar door 1 team gekozen zijn en die al gescoord hebben.
  const uniqueScorers = [];
  for (const t of teams) {
    for (const [bib, pts] of Object.entries(riderContribution[t.name])) {
      const bibNum = Number(bib);
      if (pts > 0 && bibToTeams.get(bibNum)?.length === 1) {
        uniqueScorers.push({ team: t.name, bib: bibNum, points: pts, rider: riderByBib.get(bibNum) });
      }
    }
  }
  uniqueScorers.sort((a, b) => b.points - a.points);

  return {
    leader,
    lantern,
    stageWinner,
    biggestClimber,
    biggestFaller,
    leaderStreak,
    bestRiderPerTeam,
    topRider: topRiderBib ? { bib: topRiderBib, points: topRiderPoints, rider: riderByBib.get(topRiderBib) } : null,
    uniqueScorers,
  };
}

window.TDF = window.TDF || {};
window.TDF.computeBadges = computeBadges;
