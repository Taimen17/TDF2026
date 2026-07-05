const TEAM_COLORS = [
  '#1E8A3C', '#E4032E', '#FFCD00', '#1f77b4', '#9467bd',
  '#ff7f0e', '#17becf', '#8c564b', '#e377c2',
];

function colorFor(teamName, teams) {
  const idx = teams.findIndex(t => t.name === teamName);
  return TEAM_COLORS[idx % TEAM_COLORS.length];
}

function rankChangeHtml(change) {
  if (change > 0) return `<span class="rank-up">▲ ${change}</span>`;
  if (change < 0) return `<span class="rank-down">▼ ${Math.abs(change)}</span>`;
  return `<span class="rank-same">—</span>`;
}

function badgeCard(emoji, title, value, sub) {
  return `
    <div class="badge-card">
      <div class="badge-emoji">${emoji}</div>
      <div>
        <div class="badge-title">${title}</div>
        <div class="badge-value">${value}</div>
        ${sub ? `<div class="badge-sub">${sub}</div>` : ''}
      </div>
    </div>`;
}

(async function () {
  const { teams, results, riderByBib, bibToTeams } = await window.TDF.loadData();

  if (results.length === 0) {
    document.getElementById('emptyState').style.display = 'block';
    return;
  }
  document.getElementById('content').style.display = 'block';

  const standings = window.TDF.buildStandings(results, teams);
  const badges = window.TDF.computeBadges(standings, teams, riderByBib, bibToTeams);
  const { stages, cumulative } = standings;
  const lastStage = stages[stages.length - 1];

  // ---- Badges ----
  const badgesEl = document.getElementById('badges');
  badgesEl.innerHTML = [
    badgeCard('🟡', 'Maillot jaune', badges.leader.team, `${badges.leader.total} punten · ${badges.leaderStreak} etappe(s) aan kop`),
    badgeCard('🏆', `Dagwinnaar etappe ${lastStage.stage}`, badges.stageWinner.team, `+${badges.stageWinner.stagePoints} punten vandaag`),
    badgeCard('🔴', 'Rode lantaarn', badges.lantern.team, `${badges.lantern.total} punten`),
    badges.biggestClimber.rankChange > 0
      ? badgeCard('📈', 'Grootste stijger', badges.biggestClimber.team, `+${badges.biggestClimber.rankChange} plaats(en) omhoog`)
      : '',
    badges.biggestFaller.rankChange < 0
      ? badgeCard('📉', 'Vrije val', badges.biggestFaller.team, `${badges.biggestFaller.rankChange} plaats(en) omlaag`)
      : '',
    badges.topRider
      ? badgeCard('⭐', 'Sterkste renner v/d tour', badges.topRider.rider.name, `${badges.topRider.points} fantasy-punten · ${badges.topRider.rider.team}`)
      : '',
  ].join('');

  // ---- Cumulatief lijndiagram ----
  const labels = stages.map(s => `Etappe ${s.stage}`);
  const cumulativeDatasets = teams.map(t => {
    let running = 0;
    const data = stages.map(s => {
      const row = s.ranking.find(r => r.team === t.name);
      return row.total;
    });
    return {
      label: t.name,
      data,
      borderColor: colorFor(t.name, teams),
      backgroundColor: colorFor(t.name, teams),
      tension: 0.25,
      pointRadius: 3,
    };
  });

  new Chart(document.getElementById('cumulativeChart'), {
    type: 'line',
    data: { labels, datasets: cumulativeDatasets },
    options: {
      responsive: true,
      interaction: { mode: 'nearest', intersect: false },
      plugins: { legend: { position: 'bottom' } },
      scales: { y: { beginAtZero: true, title: { display: true, text: 'Cumulatieve punten' } } },
    },
  });

  // ---- Staafdiagram laatste etappe ----
  const stageRanking = [...lastStage.ranking].sort((a, b) => b.stagePoints - a.stagePoints);
  new Chart(document.getElementById('stageChart'), {
    type: 'bar',
    data: {
      labels: stageRanking.map(r => r.team),
      datasets: [{
        label: `Punten etappe ${lastStage.stage}`,
        data: stageRanking.map(r => r.stagePoints),
        backgroundColor: stageRanking.map(r => colorFor(r.team, teams)),
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } },
    },
  });

  // ---- Standen tabel ----
  const tbody = document.querySelector('#standingsTable tbody');
  tbody.innerHTML = lastStage.ranking
    .map(r => {
      const rowClass = r.rank === 1 ? 'leader' : (r.rank === lastStage.ranking.length ? 'lantern' : '');
      return `<tr class="${rowClass}">
        <td>${r.rank}</td>
        <td>${r.team}</td>
        <td>${r.total}</td>
        <td>${rankChangeHtml(r.rankChange)}</td>
      </tr>`;
    })
    .join('');

  // ---- Unieke troeven ----
  const uniqueBody = document.querySelector('#uniqueScorersTable tbody');
  if (badges.uniqueScorers.length === 0) {
    uniqueBody.innerHTML = `<tr><td colspan="3" class="muted">Nog geen unieke renners die gescoord hebben.</td></tr>`;
  } else {
    uniqueBody.innerHTML = badges.uniqueScorers
      .map(u => `<tr><td>${u.team}</td><td>${u.rider.name}</td><td>${u.points}</td></tr>`)
      .join('');
  }
})();
