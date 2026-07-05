(async function () {
  const { riders, teams, riderByBib, bibToTeams } = await window.TDF.loadData();

  const teamASel = document.getElementById('teamA');
  const teamBSel = document.getElementById('teamB');
  const options = teams.map((t, i) => `<option value="${i}">${t.emoji} ${t.name}</option>`).join('');
  teamASel.innerHTML = options;
  teamBSel.innerHTML = options;
  teamBSel.value = teams.length > 1 ? 1 : 0;

  function renderH2H() {
    const a = teams[Number(teamASel.value)];
    const b = teams[Number(teamBSel.value)];
    const setA = new Set(a.riders);
    const setB = new Set(b.riders);

    const onlyA = a.riders.filter(bib => !setB.has(bib));
    const onlyB = b.riders.filter(bib => !setA.has(bib));
    const shared = a.riders.filter(bib => setB.has(bib));

    const listHtml = (bibs, emptyLabel) => bibs.length
      ? `<ul>${bibs.map(bib => `<li>${riderByBib.get(bib).name} <span class="muted small">(${riderByBib.get(bib).team})</span></li>`).join('')}</ul>`
      : `<p class="muted small">${emptyLabel}</p>`;

    document.getElementById('h2hResult').innerHTML = `
      <div>
        <h3 class="small">Alleen ${a.name} (${onlyA.length})</h3>
        ${listHtml(onlyA, 'Geen unieke renners')}
      </div>
      <div>
        <h3 class="small">Gedeeld (${shared.length})</h3>
        ${listHtml(shared, 'Geen overlap')}
      </div>
      <div>
        <h3 class="small">Alleen ${b.name} (${onlyB.length})</h3>
        ${listHtml(onlyB, 'Geen unieke renners')}
      </div>`;
  }

  teamASel.addEventListener('change', renderH2H);
  teamBSel.addEventListener('change', renderH2H);
  renderH2H();

  // ---- Volledige matrix ----
  const usedBibs = [...bibToTeams.keys()].sort((a, b) => {
    const popDiff = bibToTeams.get(b).length - bibToTeams.get(a).length;
    if (popDiff !== 0) return popDiff;
    return riderByBib.get(a).name.localeCompare(riderByBib.get(b).name);
  });

  const thead = `<thead><tr>
    <th class="rider-name">Renner</th>
    <th>Populariteit</th>
    ${teams.map(t => `<th>${t.emoji} ${t.name}</th>`).join('')}
  </tr></thead>`;
  document.getElementById('matrixTable').innerHTML = thead + '<tbody></tbody>';
  const matrixBody = document.querySelector('#matrixTable tbody');

  function renderMatrix(filter) {
    const needle = filter.trim().toLowerCase();
    const filteredBibs = needle
      ? usedBibs.filter(bib => riderByBib.get(bib).name.toLowerCase().includes(needle))
      : usedBibs;

    if (filteredBibs.length === 0) {
      matrixBody.innerHTML = `<tr><td colspan="${teams.length + 2}" class="muted">Geen renners gevonden voor "${filter}".</td></tr>`;
      return;
    }

    matrixBody.innerHTML = filteredBibs.map(bib => {
      const rider = riderByBib.get(bib);
      const owners = bibToTeams.get(bib);
      const isUnique = owners.length === 1;
      const cells = teams.map(t => {
        const owns = t.riders.includes(bib);
        if (!owns) return '<td>—</td>';
        return `<td class="owned ${isUnique ? 'unique' : ''}">✓</td>`;
      }).join('');
      return `<tr>
        <td class="rider-name">${rider.name} <span class="muted small">(${rider.team})</span></td>
        <td>${owners.length}/${teams.length}</td>
        ${cells}
      </tr>`;
    }).join('');
  }

  renderMatrix('');
  document.getElementById('riderSearch').addEventListener('input', (e) => renderMatrix(e.target.value));
})();
