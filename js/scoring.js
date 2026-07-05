// Puntenschema voor de top 10 van een daguitslag.
const STAGE_POINTS = [15, 9, 8, 7, 6, 5, 4, 3, 2, 1];

async function loadData() {
  const [riders, teams, results] = await Promise.all([
    fetch('data/riders.json').then(r => r.json()),
    fetch('data/teams.json').then(r => r.json()),
    fetch('data/results.json').then(r => r.json()),
  ]);

  const riderByBib = new Map(riders.map(r => [r.bib, r]));

  // team -> Set(bib) voor snelle lookup, en bib -> [team, ...] voor overlap
  const teamRiderSet = new Map(teams.map(t => [t.name, new Set(t.riders)]));
  const bibToTeams = new Map();
  for (const t of teams) {
    for (const bib of t.riders) {
      if (!bibToTeams.has(bib)) bibToTeams.set(bib, []);
      bibToTeams.get(bib).push(t.name);
    }
  }

  return { riders, teams, results, riderByBib, teamRiderSet, bibToTeams };
}

// Punten per team voor één etappe-uitslag (top10 = array van rugnummers, positie 0 = winnaar).
function stagePointsForTeams(top10, teams) {
  const points = Object.fromEntries(teams.map(t => [t.name, 0]));
  const scorers = Object.fromEntries(teams.map(t => [t.name, []])); // {team: [{bib, pos, pts}]}

  top10.forEach((bib, idx) => {
    const pts = STAGE_POINTS[idx] ?? 0;
    for (const t of teams) {
      if (t.riders.includes(bib)) {
        points[t.name] += pts;
        scorers[t.name].push({ bib, position: idx + 1, points: pts });
      }
    }
  });

  return { points, scorers };
}

// Bouwt het volledige klassement: per etappe en cumulatief, inclusief klassering en positieverschil.
function buildStandings(results, teams) {
  const cumulative = Object.fromEntries(teams.map(t => [t.name, 0]));
  const riderContribution = Object.fromEntries(
    teams.map(t => [t.name, Object.fromEntries(t.riders.map(bib => [bib, 0]))])
  );

  const stages = [];
  let previousRanks = null;

  const sortedResults = [...results].sort((a, b) => a.stage - b.stage);

  for (const stage of sortedResults) {
    const { points, scorers } = stagePointsForTeams(stage.top10, teams);

    for (const t of teams) {
      cumulative[t.name] += points[t.name];
      for (const s of scorers[t.name]) {
        riderContribution[t.name][s.bib] += s.points;
      }
    }

    const ranking = teams
      .map(t => ({ team: t.name, stagePoints: points[t.name], total: cumulative[t.name] }))
      .sort((a, b) => b.total - a.total || b.stagePoints - a.stagePoints);

    ranking.forEach((r, i) => { r.rank = i + 1; });

    if (previousRanks) {
      for (const r of ranking) {
        const prevRank = previousRanks.get(r.team);
        r.rankChange = prevRank !== undefined ? prevRank - r.rank : 0;
      }
    } else {
      ranking.forEach(r => { r.rankChange = 0; });
    }

    previousRanks = new Map(ranking.map(r => [r.team, r.rank]));

    stages.push({
      stage: stage.stage,
      date: stage.date,
      top10: stage.top10,
      scorers,
      ranking,
    });
  }

  return { stages, cumulative, riderContribution };
}

window.TDF = { STAGE_POINTS, loadData, stagePointsForTeams, buildStandings };
