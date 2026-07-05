const TOTAL_STAGES = 21;

function colorFor(teamName, teams) {
  return teams.find(t => t.name === teamName)?.color || '#999';
}

function emojiFor(teamName, teams) {
  return teams.find(t => t.name === teamName)?.emoji || '🚴';
}

function teamLabel(teamName, teams) {
  return `${emojiFor(teamName, teams)} ${teamName}`;
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

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' });
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
  const { stages } = standings;
  const lastStage = stages[stages.length - 1];

  // ---- Voortgang ----
  const pct = Math.min(100, Math.round((lastStage.stage / TOTAL_STAGES) * 100));
  document.getElementById('progressLabel').textContent = `Etappe ${lastStage.stage} van ${TOTAL_STAGES}`;
  document.getElementById('progressFill').style.width = `${pct}%`;
  document.getElementById('lastUpdatedLabel').textContent =
    lastStage.date ? `Laatste update: ${formatDate(lastStage.date)}` : '';

  // ---- Badges ----
  const badgesEl = document.getElementById('badges');
  badgesEl.innerHTML = [
    badgeCard('🟡', 'Maillot jaune', teamLabel(badges.leader.team, teams), `${badges.leader.total} punten · ${badges.leaderStreak} etappe(s) aan kop`),
    badgeCard('🏆', `Dagwinnaar etappe ${lastStage.stage}`, teamLabel(badges.stageWinner.team, teams), `+${badges.stageWinner.stagePoints} punten vandaag`),
    badgeCard('🔴', 'Rode lantaarn', teamLabel(badges.lantern.team, teams), `${badges.lantern.total} punten`),
    badges.biggestClimber.rankChange > 0
      ? badgeCard('📈', 'Grootste stijger', teamLabel(badges.biggestClimber.team, teams), `+${badges.biggestClimber.rankChange} plaats(en) omhoog`)
      : '',
    badges.biggestFaller.rankChange < 0
      ? badgeCard('📉', 'Vrije val', teamLabel(badges.biggestFaller.team, teams), `${badges.biggestFaller.rankChange} plaats(en) omlaag`)
      : '',
    badges.topRider
      ? badgeCard('⭐', 'Sterkste renner v/d tour', badges.topRider.rider.name, `${badges.topRider.points} fantasy-punten · ${badges.topRider.rider.team}`)
      : '',
  ].join('');

  // ---- Cumulatief lijndiagram ----
  const labels = stages.map(s => `Etappe ${s.stage}`);
  const cumulativeDatasets = teams.map(t => {
    const data = stages.map(s => s.ranking.find(r => r.team === t.name).total);
    return {
      label: t.name,
      data,
      borderColor: t.color,
      backgroundColor: t.color,
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

  // ---- Standen tabel (sorteerbaar) ----
  const tbody = document.querySelector('#standingsTable tbody');
  let sortState = { key: null, dir: 1 };

  function renderStandings() {
    let rows = [...lastStage.ranking];
    if (sortState.key === 'team') {
      rows.sort((a, b) => a.team.localeCompare(b.team) * sortState.dir);
    } else if (sortState.key === 'total') {
      rows.sort((a, b) => (a.total - b.total) * sortState.dir);
    } else {
      rows.sort((a, b) => a.rank - b.rank);
    }

    tbody.innerHTML = rows
      .map(r => {
        const rowClass = r.rank === 1 ? 'leader' : (r.rank === lastStage.ranking.length ? 'lantern' : '');
        return `<tr class="${rowClass}">
          <td>${r.rank}</td>
          <td><span class="team-color-dot" style="background:${colorFor(r.team, teams)}"></span>${teamLabel(r.team, teams)}</td>
          <td>${r.total}</td>
          <td>${rankChangeHtml(r.rankChange)}</td>
        </tr>`;
      })
      .join('');
  }
  renderStandings();

  document.querySelectorAll('#standingsTable th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      sortState.dir = sortState.key === key ? -sortState.dir : 1;
      sortState.key = key;
      document.querySelectorAll('#standingsTable th.sortable').forEach(t => t.classList.remove('active'));
      th.classList.add('active');
      th.querySelector('.sort-arrow').textContent = sortState.dir === 1 ? '↑' : '↓';
      renderStandings();
    });
  });

  // ---- Unieke troeven ----
  const uniqueBody = document.querySelector('#uniqueScorersTable tbody');
  if (badges.uniqueScorers.length === 0) {
    uniqueBody.innerHTML = `<tr><td colspan="3" class="muted">Nog geen unieke renners die gescoord hebben.</td></tr>`;
  } else {
    uniqueBody.innerHTML = badges.uniqueScorers
      .map(u => `<tr><td>${teamLabel(u.team, teams)}</td><td>${u.rider.name}</td><td>${u.points}</td></tr>`)
      .join('');
  }
})();
