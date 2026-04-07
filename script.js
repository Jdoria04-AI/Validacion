// ===== STATE =====
let subjects = JSON.parse(localStorage.getItem('uninota-subjects') || '["Matemáticas","Física","Programación","Inglés"]');
let history  = JSON.parse(localStorage.getItem('uninota-history')  || '[]');

// ===== SAVE =====
function save() {
  localStorage.setItem('uninota-subjects', JSON.stringify(subjects));
  localStorage.setItem('uninota-history',  JSON.stringify(history));
}

// ===== SUBJECTS =====
function renderSubjects() {
  const sel = document.getElementById('subject-select');
  const cur = sel.value;
  sel.innerHTML = subjects.map(s => `<option value="${s}">${s}</option>`).join('');
  if (cur && subjects.includes(cur)) sel.value = cur;
}

// ===== TABS =====
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
  });
});

// ===== BAR CHART =====
function renderBars(containerId, c1, c2, c3, needed) {
  const bars = [
    { label: 'Corte 1', val: c1 },
    { label: 'Corte 2', val: c2 },
    { label: 'Corte 3', val: c3 },
    { label: 'Final',   val: Math.min(Math.max(needed, 0), 5), isResult: true, overflow: needed > 5, passed: needed <= 0 }
  ];

  const el = document.getElementById(containerId);
  el.innerHTML = bars.map(b => {
    const pct = (b.val / 5 * 100).toFixed(1);
    let color = '#34d399'; // Neón green default
    if (b.isResult) {
      if (b.overflow) color = '#f87171';
      else if (b.passed) color = '#34d399';
      else color = '#60a5fa';
    }
    const displayVal = b.isResult && b.overflow ? '>5' : b.isResult && b.passed ? '—' : b.val.toFixed(1);
    return `
      <div class="bar-row">
        <span class="bar-label">${b.label}</span>
        <div class="bar-track">
          <div class="bar-fill" style="width:${pct}%;background:${color};${b.overflow ? 'opacity:0.5' : ''}"></div>
        </div>
        <span class="bar-num">${displayVal}</span>
      </div>`;
  }).join('');
}

// ===== MAIN CALC =====
function calcMain() {
  const c1   = parseFloat(document.getElementById('c1').value);
  const c2   = parseFloat(document.getElementById('c2').value);
  const c3   = parseFloat(document.getElementById('c3').value);
  const goal = parseFloat(document.getElementById('goal').value) || 3.0;

  if (isNaN(c1) || isNaN(c2) || isNaN(c3)) return;

  const acc    = (c1 + c2 + c3) * 0.2;
  const needed = (goal - acc) / 0.4;
  const avg    = (c1 + c2 + c3) / 3;

  // Update metrics
  document.getElementById('m-acc').textContent  = acc.toFixed(2);
  document.getElementById('m-avg').textContent  = avg.toFixed(2);
  document.getElementById('m-goal').textContent = goal.toFixed(1);

  // Determine state
  const card = document.getElementById('result-card');
  card.classList.remove('state-ok', 'state-warn', 'state-bad');

  let displayVal, msg, state;

  if (needed <= 0) {
    displayVal = '—';
    msg   = '¡Ya aprobaste con tus notas actuales!';
    state = 'state-ok';
  } else if (needed > 5) {
    displayVal = '> 5.0';
    msg   = `No es posible alcanzar ${goal.toFixed(1)} con estas notas.`;
    state = 'state-bad';
  } else {
    displayVal = needed.toFixed(2);
    msg   = `en el examen final para alcanzar ${goal.toFixed(1)}.`;
    state = needed >= 4.0 ? 'state-warn' : 'state-ok';
  }

  document.getElementById('r-val').textContent = displayVal;
  document.getElementById('r-msg').textContent = msg;
  card.classList.add(state);

  // Show result
  document.getElementById('result-section').classList.remove('hidden');

  // Render bars
  renderBars('bar-chart', c1, c2, c3, needed);

  // Save to history
  const subject = document.getElementById('subject-select').value;
  history.unshift({
    subject,
    c1, c2, c3, goal,
    needed,
    acc,
    ts: new Date().toISOString()
  });
  if (history.length > 100) history.pop();
  save();
  renderHistory();
}

// Live calc on input
['c1','c2','c3','goal'].forEach(id => {
  document.getElementById(id).addEventListener('input', () => {
    const c1   = parseFloat(document.getElementById('c1').value);
    const c2   = parseFloat(document.getElementById('c2').value);
    const c3   = parseFloat(document.getElementById('c3').value);
    if (!isNaN(c1) && !isNaN(c2) && !isNaN(c3)) calcMain();
  });
});

document.getElementById('btn-calc').addEventListener('click', calcMain);

// ===== SIMULATOR =====
function simCalc() {
  const s1 = parseFloat(document.getElementById('s1').value);
  const s2 = parseFloat(document.getElementById('s2').value);
  const s3 = parseFloat(document.getElementById('s3').value);
  const sg = parseFloat(document.getElementById('sg').value);

  document.getElementById('sv1').textContent = s1.toFixed(1);
  document.getElementById('sv2').textContent = s2.toFixed(1);
  document.getElementById('sv3').textContent = s3.toFixed(1);
  document.getElementById('sgv').textContent = sg.toFixed(1);

  const acc    = (s1 + s2 + s3) * 0.2;
  const needed = (sg - acc) / 0.4;

  const card = document.getElementById('sim-card');
  card.classList.remove('state-ok', 'state-warn', 'state-bad');

  let displayVal, msg, state;

  if (needed <= 0) {
    displayVal = '—';
    msg   = '¡Ya alcanzarías la nota deseada!';
    state = 'state-ok';
  } else if (needed > 5) {
    displayVal = needed.toFixed(2);
    msg   = 'No alcanzable — necesitarías más de 5.0';
    state = 'state-bad';
  } else {
    displayVal = needed.toFixed(2);
    msg   = `para alcanzar ${sg.toFixed(1)} en el semestre`;
    state = needed >= 4.0 ? 'state-warn' : 'state-ok';
  }

  document.getElementById('sim-val').textContent = displayVal;
  document.getElementById('sim-msg').textContent = msg;
  card.classList.add(state);

  renderBars('sim-bar-chart', s1, s2, s3, needed);
}

['s1','s2','s3','sg'].forEach(id => {
  document.getElementById(id).addEventListener('input', simCalc);
});

// ===== HISTORY =====
function renderHistory() {
  const el    = document.getElementById('history-list');
  const count = document.getElementById('history-count');

  count.textContent = history.length === 1
    ? '1 registro'
    : `${history.length} registros`;

  if (history.length === 0) {
    el.innerHTML = '<div class="hist-empty">Sin cálculos aún. Calcula una nota para verla aquí.</div>';
    return;
  }

  el.innerHTML = history.map(h => {
    let badgeClass, badgeText;
    if (h.needed <= 0) {
      badgeClass = 'badge-ok';  badgeText = 'Aprobado';
    } else if (h.needed > 5) {
      badgeClass = 'badge-bad'; badgeText = '> 5.0';
    } else {
      badgeClass = h.needed >= 4.0 ? 'badge-warn' : 'badge-ok';
      badgeText  = h.needed.toFixed(2);
    }

    const d    = new Date(h.ts);
    const date = d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
    const time = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

    return `
      <div class="hist-item">
        <div class="hist-left">
          <div class="hist-subject">${h.subject}</div>
          <div class="hist-detail">${h.c1.toFixed(1)} · ${h.c2.toFixed(1)} · ${h.c3.toFixed(1)} &nbsp;·&nbsp; meta ${h.goal.toFixed(1)} &nbsp;·&nbsp; ${date} ${time}</div>
        </div>
        <span class="hist-badge ${badgeClass}">${badgeText}</span>
      </div>`;
  }).join('');
}

document.getElementById('btn-clear-history').addEventListener('click', () => {
  if (history.length === 0) return;
  if (confirm('¿Borrar todo el historial?')) {
    history = [];
    save();
    renderHistory();
  }
});

// ===== MODAL =====
function openModal() {
  document.getElementById('modal').classList.remove('hidden');
  setTimeout(() => document.getElementById('new-subject').focus(), 50);
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
  document.getElementById('new-subject').value = '';
}

function addSubject() {
  const name = document.getElementById('new-subject').value.trim();
  if (!name) return;
  if (!subjects.includes(name)) {
    subjects.push(name);
    save();
    renderSubjects();
  }
  document.getElementById('subject-select').value = name;
  closeModal();
}

document.getElementById('btn-add-subject').addEventListener('click', openModal);
document.getElementById('btn-modal-cancel').addEventListener('click', closeModal);
document.getElementById('btn-modal-confirm').addEventListener('click', addSubject);
document.getElementById('new-subject').addEventListener('keydown', e => {
  if (e.key === 'Enter') addSubject();
  if (e.key === 'Escape') closeModal();
});
document.getElementById('modal').addEventListener('click', e => {
  if (e.target === document.getElementById('modal')) closeModal();
});

// ===== INIT =====
renderSubjects();
renderHistory();
simCalc();
