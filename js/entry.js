const GITHUB_OWNER = 'Taimen17';
const GITHUB_REPO = 'TDF2026';
const GITHUB_BRANCH = 'main';
const RESULTS_PATH = 'data/results.json';
const TOKEN_STORAGE_KEY = 'tdf_gh_token';

function b64EncodeUnicode(str) {
  return btoa(unescape(encodeURIComponent(str)));
}
function b64DecodeUnicode(str) {
  return decodeURIComponent(escape(atob(str.replace(/\n/g, ''))));
}

async function githubGetFile(token) {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${RESULTS_PATH}?ref=${GITHUB_BRANCH}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} }
  );
  if (res.status === 404) return { results: [], sha: null };
  if (!res.ok) throw new Error(`Kon results.json niet ophalen (${res.status})`);
  const json = await res.json();
  return { results: JSON.parse(b64DecodeUnicode(json.content)), sha: json.sha };
}

async function githubPutFile(token, results, sha, message) {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${RESULTS_PATH}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        content: b64EncodeUnicode(JSON.stringify(results, null, 2)),
        branch: GITHUB_BRANCH,
        ...(sha ? { sha } : {}),
      }),
    }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Publiceren mislukt (${res.status})`);
  }
}

(async function () {
  const { riders, teams, riderByBib } = await window.TDF.loadData();
  let results = [];
  try {
    results = await fetch('data/results.json').then(r => r.json());
  } catch (_) { /* nog geen bestand */ }

  const tokenInput = document.getElementById('ghToken');
  tokenInput.value = localStorage.getItem(TOKEN_STORAGE_KEY) || '';
  tokenInput.addEventListener('change', () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, tokenInput.value.trim());
  });

  const stageSel = document.getElementById('stageNum');
  stageSel.innerHTML = Array.from({ length: 21 }, (_, i) => i + 1)
    .map(n => `<option value="${n}">Etappe ${n}</option>`)
    .join('');

  const positionsEl = document.getElementById('positions');
  positionsEl.innerHTML = Array.from({ length: 10 }, (_, i) => {
    const pos = i + 1;
    const pts = window.TDF.STAGE_POINTS[i];
    return `
      <div class="form-row">
        <label for="pos${pos}">${pos}e plaats (${pts} ${pts === 1 ? 'punt' : 'punten'})</label>
        <input type="number" id="pos${pos}" min="1" inputmode="numeric" placeholder="Rugnummer">
        <div class="small" id="posResolved${pos}" style="margin-top:0.25rem"></div>
      </div>`;
  }).join('');

  function resolveRider(pos) {
    const input = document.getElementById(`pos${pos}`);
    const resolvedEl = document.getElementById(`posResolved${pos}`);
    const bib = Number(input.value);
    if (!input.value) {
      resolvedEl.innerHTML = '';
      return;
    }
    const rider = riderByBib.get(bib);
    resolvedEl.innerHTML = rider
      ? `<span class="pill green">${rider.name}</span> <span class="muted">(${rider.team})</span>`
      : `<span style="color:#E4032E">Onbekend rugnummer ${bib}</span>`;
  }

  for (let pos = 1; pos <= 10; pos++) {
    document.getElementById(`pos${pos}`).addEventListener('input', () => resolveRider(pos));
  }

  function loadStageIntoForm(stageNum) {
    const existing = results.find(r => r.stage === stageNum);
    document.getElementById('stageDate').value = existing?.date || new Date().toISOString().slice(0, 10);
    for (let pos = 1; pos <= 10; pos++) {
      const input = document.getElementById(`pos${pos}`);
      input.value = existing?.top10?.[pos - 1] ?? '';
      resolveRider(pos);
    }
  }

  stageSel.addEventListener('change', () => loadStageIntoForm(Number(stageSel.value)));

  const nextStage = results.length ? Math.min(21, Math.max(...results.map(r => r.stage)) + 1) : 1;
  stageSel.value = nextStage;
  loadStageIntoForm(nextStage);

  function readTop10() {
    const top10 = [];
    for (let pos = 1; pos <= 10; pos++) {
      const raw = document.getElementById(`pos${pos}`).value;
      const bib = Number(raw);
      if (!raw || !riderByBib.has(bib)) {
        throw new Error(`Positie ${pos}: onbekend of leeg rugnummer.`);
      }
      top10.push(bib);
    }
    if (new Set(top10).size !== top10.length) {
      throw new Error('Een renner staat dubbel in de top 10 — controleer je invoer.');
    }
    return top10;
  }

  function renderPreview(stage, top10) {
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

    document.getElementById('preview').innerHTML = `
      <h3 style="margin-top:1.5rem">Etappe ${stage} — puntenverdeling</h3>
      <table>
        <thead><tr><th>Team</th><th>Punten</th><th>Scorende renners</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  function setStatus(message, kind) {
    const colors = { ok: '#1E8A3C', error: '#E4032E', info: '#6b6b6b' };
    document.getElementById('status').innerHTML =
      `<p style="color:${colors[kind] || colors.info}">${message}</p>`;
  }

  document.getElementById('saveBtn').addEventListener('click', async () => {
    const stage = Number(stageSel.value);
    const date = document.getElementById('stageDate').value;
    const token = tokenInput.value.trim();
    document.getElementById('fallbackCard').style.display = 'none';

    let top10;
    try {
      top10 = readTop10();
    } catch (err) {
      setStatus(err.message, 'error');
      return;
    }

    renderPreview(stage, top10);

    if (!token) {
      setStatus('Geen token ingevuld — vul deze hierboven in om te publiceren.', 'error');
      return;
    }

    setStatus('Bezig met publiceren...', 'info');
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
      const { results: latest, sha } = await githubGetFile(token);
      const updated = [...latest.filter(r => r.stage !== stage), { stage, date, top10 }]
        .sort((a, b) => a.stage - b.stage);
      await githubPutFile(token, updated, sha, `Etappe ${stage} uitslag bijwerken`);
      results = updated;
      setStatus(`✅ Etappe ${stage} opgeslagen en gepubliceerd. De site is over een paar seconden bijgewerkt.`, 'ok');
    } catch (err) {
      setStatus(`❌ ${err.message} — gebruik het alternatief hieronder.`, 'error');
      const fallback = [...results.filter(r => r.stage !== stage), { stage, date, top10 }]
        .sort((a, b) => a.stage - b.stage);
      document.getElementById('jsonOutput').value = JSON.stringify(fallback, null, 2);
      document.getElementById('fallbackCard').style.display = 'block';
      document.getElementById('downloadBtn').onclick = () => {
        const blob = new Blob([JSON.stringify(fallback, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'results.json';
        a.click();
        URL.revokeObjectURL(url);
      };
    }
  });
})();
