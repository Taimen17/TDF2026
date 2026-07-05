(async function () {
  const { riders, teams, results, riderByBib } = await window.TDF.loadData();

  const riderList = document.getElementById('riderList');
  riderList.innerHTML = riders
    .map(r => `<option value="${r.bib} - ${r.name} (${r.team})">`)
    .join('');

  const positionsEl = document.getElementById('positions');
  positionsEl.innerHTML = Array.from({ length: 10 }, (_, i) => {
    const pos = i + 1;
    const pts = window.TDF.STAGE_POINTS[i];
    return `
      <div class="form-row">
        <label for="pos${pos}">${pos}e plaats (${pts} ${pts === 1 ? 'punt' : 'punten'})</label>
        <input list="riderList" id="pos${pos}" placeholder="Typ naam of rugnummer...">
      </div>`;
  }).join('');

  const nextStage = (results.length ? Math.max(...results.map(r => r.stage)) : 0) + 1;
  document.getElementById('stageNum').value = nextStage;
  document.getElementById('stageDate').value = new Date().toISOString().slice(0, 10);

  function parseBibFromInput(value) {
    const match = value.trim().match(/^(\d+)/);
    return match ? Number(match[1]) : null;
  }

  function readTop10() {
    const top10 = [];
    for (let pos = 1; pos <= 10; pos++) {
      const raw = document.getElementById(`pos${pos}`).value;
      const bib = parseBibFromInput(raw);
      if (!bib || !riderByBib.has(bib)) {
        throw new Error(`Positie ${pos}: kies een geldige renner.`);
      }
      top10.push(bib);
    }
    const unique = new Set(top10);
    if (unique.size !== top10.length) {
      throw new Error('Een renner staat dubbel in de top 10 — controleer je invoer.');
    }
    return top10;
  }

  let lastUpdatedResults = null;

  document.getElementById('previewBtn').addEventListener('click', () => {
    const previewEl = document.getElementById('preview');
    const downloadCard = document.getElementById('downloadCard');
    try {
      const top10 = readTop10();
      const stage = Number(document.getElementById('stageNum').value);
      const date = document.getElementById('stageDate').value;

      const { points, scorers } = window.TDF.stagePointsForTeams(top10, teams);

      const rows = teams
        .map(t => ({ team: t.name, pts: points[t.name], scorers: scorers[t.name] }))
        .sort((a, b) => b.pts - a.pts)
        .map(r => `
          <tr>
            <td>${r.team}</td>
            <td><strong>${r.pts}</strong></td>
            <td class="small muted">${r.scorers
              .map(s => `${riderByBib.get(s.bib).name} (P${s.position}, +${s.points})`)
              .join(', ') || '—'}</td>
          </tr>`)
        .join('');

      previewEl.innerHTML = `
        <h3 style="margin-top:1.5rem">Etappe ${stage} — puntenverdeling</h3>
        <table>
          <thead><tr><th>Team</th><th>Punten</th><th>Scorende renners</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`;

      const updatedResults = [...results.filter(r => r.stage !== stage), { stage, date, top10 }]
        .sort((a, b) => a.stage - b.stage);
      lastUpdatedResults = updatedResults;

      document.getElementById('jsonOutput').value = JSON.stringify(updatedResults, null, 2);
      downloadCard.style.display = 'block';
    } catch (err) {
      previewEl.innerHTML = `<p style="color:#E4032E">${err.message}</p>`;
      downloadCard.style.display = 'none';
    }
  });

  document.getElementById('downloadBtn').addEventListener('click', () => {
    if (!lastUpdatedResults) return;
    const blob = new Blob([JSON.stringify(lastUpdatedResults, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'results.json';
    a.click();
    URL.revokeObjectURL(url);
  });
})();
