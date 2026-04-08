// ===== STATE =====
// Migración inteligente: Si hay strings antiguos, los converimos a objetos con semestre 1 y 3 créditos.
let rawSubjects = JSON.parse(localStorage.getItem('uninota-subjects') || '[]');
if (rawSubjects.length === 0) {
  rawSubjects = [
    { name: "Matemáticas", semester: 1, credits: 3 },
    { name: "Física", semester: 1, credits: 3 }
  ];
} else if (typeof rawSubjects[0] === 'string') {
  rawSubjects = rawSubjects.map(name => ({ name, semester: 1, credits: 3 }));
}
let subjects = rawSubjects;
let history  = JSON.parse(localStorage.getItem('uninota-history')  || '[]');

let currentCuts = [
  { id: 1, weight: 20 },
  { id: 2, weight: 20 },
  { id: 3, weight: 20 }
];
let nextCutId = 4;

// ===== SAVE =====
function save() {
  localStorage.setItem('uninota-subjects', JSON.stringify(subjects));
  localStorage.setItem('uninota-history',  JSON.stringify(history));
}

// ===== SUBJECTS =====
function renderSubjects() {
  const sel = document.getElementById('subject-select');
  const cur = sel.value;
  sel.innerHTML = subjects.map(s => `<option value="${s.name}">${s.name} (Semestre ${s.semester})</option>`).join('');
  if (cur && subjects.some(s => s.name === cur)) sel.value = cur;
}

// ===== TABS =====
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
    if (tab.dataset.tab === 'history') updatePGA();
  });
});

// ===== DYNAMIC CUTS UI =====
function renderDynamicCuts() {
  const cont = document.getElementById('dynamic-cuts-container');
  const simCont = document.getElementById('sim-sliders-container');
  
  // Render Calcular
  cont.innerHTML = currentCuts.map((cut, idx) => `
    <div class="cut-box" data-id="${cut.id}">
      ${currentCuts.length > 1 ? `<button class="cut-remove" onclick="removeCut(${cut.id})" title="Eliminar corte">×</button>` : ''}
      <label class="field-label-sm">Corte ${idx + 1}</label>
      <div style="display:flex; gap: 4px;">
        <input type="number" class="cut-val" min="0" max="5" step="0.1" placeholder="Nota" style="flex: 2;">
        <input type="number" class="cut-weight" min="1" max="100" value="${cut.weight}" style="flex: 1; padding: 12px 4px; text-align:center;" title="Porcentaje (%)">
      </div>
    </div>
  `).join('');

  // Render Simulador (rebuilding dynamically)
  simCont.innerHTML = currentCuts.map((cut, idx) => `
    <div class="sim-row" data-id="${cut.id}">
      <span class="sim-label">Corte ${idx + 1} <span class="pct">${cut.weight}%</span></span>
      <input type="range" class="sim-slider-val" min="0" max="5" step="0.1" value="3.0">
      <span class="sim-val">3.0</span>
    </div>
  `).join('') + `
    <div class="sim-row sim-goal-row">
      <span class="sim-label">Nota deseada</span>
      <input type="range" id="sg" min="0" max="5" step="0.1" value="3.0">
      <span class="sim-val" id="sgv">3.0</span>
    </div>
  `;

  attachCutListeners();
  simCalc();
}

function addCut() {
  currentCuts.push({ id: nextCutId++, weight: 20 });
  renderDynamicCuts();
}

window.removeCut = function(id) {
  currentCuts = currentCuts.filter(c => c.id !== id);
  renderDynamicCuts();
};

document.getElementById('btn-add-cut').addEventListener('click', addCut);

// ===== CORE CALCULATION =====
function getCutsData() {
  const nodes = document.querySelectorAll('.cut-box');
  let valid = true, sumWeights = 0, acc = 0;
  const cuts = [];
  
  nodes.forEach(n => {
    const val = parseFloat(n.querySelector('.cut-val').value) || 0;
    const w = parseFloat(n.querySelector('.cut-weight').value) || 0;
    sumWeights += w;
    acc += val * (w / 100);
    cuts.push({ val, weight: w });
  });

  document.getElementById('alerta-pesos').classList.toggle('hidden', sumWeights > 0 && sumWeights < 100);
  
  return { cuts, sumWeights, acc, leftoverW: (100 - sumWeights) / 100 };
}

function calcMain(saveToHistory = false) {
  const data = getCutsData();
  const goal = parseFloat(document.getElementById('goal').value) || 3.0;

  if (data.sumWeights >= 100 && data.leftoverW <= 0) {
    // Si ya completó el 100%, solo mostremos la nota definitiva
    document.getElementById('r-val').textContent = data.acc.toFixed(2);
    document.getElementById('r-msg').textContent = 'Esta es tu nota definitiva del semestre.';
    document.getElementById('result-card').className = 'result-card ' + (data.acc >= goal ? 'state-ok' : 'state-bad');
    document.getElementById('result-section').classList.remove('hidden');
    // Hide bar chart since there is no missing needed grade
    document.querySelector('.chart-wrap').classList.add('hidden');
    return;
  }
  document.querySelector('.chart-wrap').classList.remove('hidden');

  const needed = (goal - data.acc) / data.leftoverW;
  const avg = data.cuts.reduce((sum, c) => sum + c.val, 0) / (data.cuts.length || 1);

  // Update metrics
  document.getElementById('m-acc').textContent  = data.acc.toFixed(2);
  document.getElementById('m-pct').textContent  = data.sumWeights.toFixed(0) + '%';
  document.getElementById('m-goal').textContent = goal.toFixed(1);

  // Determine state
  const card = document.getElementById('result-card');
  card.className = 'result-card'; // reset

  let displayVal, msg, state;
  if (needed <= 0) {
    displayVal = '—'; msg = '¡Ya aprobaste con lo que llevas!'; state = 'state-ok';
  } else if (needed > 5) {
    displayVal = '> 5.0'; msg = `Imposible alcanzar ${goal.toFixed(1)} en el final.`; state = 'state-bad';
  } else {
    displayVal = needed.toFixed(2); msg = `necesitas en el ${ (data.leftoverW*100).toFixed(0) }% restante.`; state = needed >= 4.0 ? 'state-warn' : 'state-ok';
  }

  document.getElementById('r-val').textContent = displayVal;
  document.getElementById('r-msg').textContent = msg;
  card.classList.add(state);
  document.getElementById('result-section').classList.remove('hidden');

  // Render bars
  const bars = data.cuts.map((c, i) => ({ label: `C${i+1}`, val: c.val }));
  bars.push({ label: 'Restante', val: Math.min(Math.max(needed, 0), 5), isResult: true, overflow: needed > 5, passed: needed <= 0 });
  renderBarsGeneric('bar-chart', bars);

  // Save to history logic
  if (saveToHistory) {
    const subjectName = document.getElementById('subject-select').value;
    const subjectData = subjects.find(s => s.name === subjectName) || { semester: 1, credits: 3 };
    
    // Check if we need to update an existing record for this subject
    let finalDefinitive = data.acc + (needed > 0 && needed <= 5 ? needed * data.leftoverW : 0);
    if (data.leftoverW <= 0) finalDefinitive = data.acc;

    history.unshift({
      subject: subjectName,
      semester: subjectData.semester,
      credits: subjectData.credits,
      cutsDetails: data.cuts,
      goal, needed, acc: data.acc,
      finalEstimated: finalDefinitive,
      ts: new Date().toISOString()
    });
    if (history.length > 50) history.pop();
    save();
    renderHistory();
    updatePGA();
  }
}

function renderBarsGeneric(containerId, bars) {
  const el = document.getElementById(containerId);
  el.innerHTML = bars.map(b => {
    const pct = (b.val / 5 * 100).toFixed(1);
    let color = '#34d399';
    if (b.isResult) {
      if (b.overflow) color = '#f87171'; else if (b.passed) color = '#34d399'; else color = '#60a5fa';
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

function attachCutListeners() {
  document.querySelectorAll('.cut-val, .cut-weight, #goal').forEach(el => {
    el.addEventListener('input', () => {
      // Update weights back to state
      document.querySelectorAll('.cut-box').forEach((n, i) => {
        currentCuts[i].weight = parseFloat(n.querySelector('.cut-weight').value) || 0;
      });
      calcMain(false);
    });
  });

  // Simulator listeners
  document.querySelectorAll('.sim-slider-val').forEach(slider => {
    slider.addEventListener('input', (e) => {
      e.target.nextElementSibling.textContent = parseFloat(e.target.value).toFixed(1);
      simCalc();
    });
  });
  const sg = document.getElementById('sg');
  if(sg) sg.addEventListener('input', (e) => {
    document.getElementById('sgv').textContent = parseFloat(e.target.value).toFixed(1);
    simCalc();
  });
}

document.getElementById('btn-calc').addEventListener('click', () => calcMain(true));

// ===== SIMULATOR =====
function simCalc() {
  const sliders = document.querySelectorAll('.sim-slider-val');
  if (sliders.length === 0) return;
  const sg = parseFloat(document.getElementById('sg').value) || 3.0;

  let acc = 0, sumWeights = 0;
  const bars = [];
  
  sliders.forEach((s, idx) => {
    const val = parseFloat(s.value);
    const weight = currentCuts[idx] ? currentCuts[idx].weight : 20;
    acc += val * (weight / 100);
    sumWeights += weight;
    bars.push({ label: `C${idx+1}`, val });
  });

  const leftoverW = (100 - sumWeights) / 100;
  const card = document.getElementById('sim-card');
  card.className = 'result-card'; // reset

  if (leftoverW <= 0) {
    document.getElementById('sim-val').textContent = acc.toFixed(2);
    document.getElementById('sim-msg').textContent = 'Nota definitiva simulada';
    document.querySelector('#panel-sim .chart-wrap').classList.add('hidden');
    card.classList.add(acc >= sg ? 'state-ok' : 'state-bad');
    return;
  }
  
  document.querySelector('#panel-sim .chart-wrap').classList.remove('hidden');
  const needed = (sg - acc) / leftoverW;

  let displayVal, msg, state;
  if (needed <= 0) { displayVal = '—'; msg = 'Ya lograrías la meta'; state = 'state-ok'; }
  else if (needed > 5) { displayVal = needed.toFixed(2); msg = 'Inalcanzable'; state = 'state-bad'; }
  else { displayVal = needed.toFixed(2); msg = `para ${sg.toFixed(1)} en el semestre`; state = needed >= 4.0 ? 'state-warn' : 'state-ok'; }

  document.getElementById('sim-val').textContent = displayVal;
  document.getElementById('sim-msg').textContent = msg;
  card.classList.add(state);

  bars.push({ label: 'Final', val: Math.min(Math.max(needed, 0), 5), isResult: true, overflow: needed > 5, passed: needed <= 0 });
  renderBarsGeneric('sim-bar-chart', bars);
}


// ===== HISTORY & PGA =====
function updatePGA() {
  if (history.length === 0) { document.getElementById('overall-pga').textContent = '0.00'; return; }
  
  // Agrupar la nota más reciente de cada materia
  const latestGrades = {};
  history.forEach(h => {
    if (!latestGrades[h.subject]) latestGrades[h.subject] = h;
  });

  let totalCredits = 0, totalPoints = 0;
  Object.values(latestGrades).forEach(h => {
    const creds = parseInt(h.credits) || 3;
    // Si alcanzó meta asume que pasó, pero la nota la estimamos con el final real necesario o el cap de 5.0
    let grade = h.acc;
    if (h.needed > 0 && h.needed <= 5) grade = h.acc + h.needed * ((100 - h.cutsDetails.reduce((s,c)=>s+c.weight,0))/100);
    // Si la pasó sobra, nota será el acumulado (podría ser más si saca nota en final pero estimamos el mínimo)
    
    totalCredits += creds;
    totalPoints += grade * creds;
  });

  let pga = totalCredits > 0 ? (totalPoints / totalCredits) : 0;
  document.getElementById('overall-pga').textContent = pga.toFixed(2);
}

function renderHistory() {
  const el = document.getElementById('history-list');
  document.getElementById('history-count').textContent = `${history.length} registros`;

  if (history.length === 0) {
    el.innerHTML = '<div class="hist-empty">Sin cálculos aún. Guarda una nota para empezar tu boletín.</div>';
    return;
  }

  el.innerHTML = history.map(h => {
    const d = new Date(h.ts);
    const dateStr = d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', hour:'2-digit', minute:'2-digit' });
    let badgeClass = h.needed > 5 ? 'badge-bad' : h.needed <= 0 ? 'badge-ok' : (h.needed > 4.0 ? 'badge-warn' : 'badge-ok');
    let text = h.needed > 5 ? 'Peligro' : (h.needed <= 0 ? 'Pasada ya' : 'Necesita ' + h.needed.toFixed(1));

    return `
      <div class="hist-item">
        <div class="hist-left">
          <div class="hist-subject">${h.subject} <span style="font-size:10px; color:#94a3b8; font-weight:normal;">(Sem. ${h.semester} | ${h.credits} Cr)</span></div>
          <div class="hist-detail">Acum: ${h.acc.toFixed(2)} &nbsp;·&nbsp; Meta: ${h.goal.toFixed(1)} &nbsp;·&nbsp; ${dateStr}</div>
        </div>
        <span class="hist-badge ${badgeClass}">${text}</span>
      </div>`;
  }).join('');
}

document.getElementById('btn-clear-history').addEventListener('click', () => {
  if (history.length === 0) return;
  if (confirm('¿Borrar TODO el historial? (Esto afectará tu PGA)')) { history = []; save(); renderHistory(); updatePGA(); }
});

// ===== PDF GENERATOR =====
document.getElementById('btn-export-pdf').addEventListener('click', () => {
  // Add a class to body to format for printing
  document.body.classList.add('pdf-mode');
  
  const element = document.getElementById('panel-history');
  const opt = {
    margin:       1,
    filename:     'Boletin_UniNota.pdf',
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, backgroundColor: '#ffffff' },
    jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
  };

  html2pdf().set(opt).from(element).save().then(() => {
    // Revert visual changes
    document.body.classList.remove('pdf-mode');
  });
});

// ===== MODAL (NUEVA MATERIA) =====
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
  const semester = parseInt(document.getElementById('new-semester').value) || 1;
  const credits = parseInt(document.getElementById('new-credits').value) || 3;
  
  if (!name) return;
  
  // Actualizar si ya existe, si no, crear nuevo
  const existing = subjects.find(s => s.name === name);
  if (existing) {
    existing.semester = semester;
    existing.credits = credits;
  } else {
    subjects.push({ name, semester, credits });
  }
  
  save();
  renderSubjects();
  document.getElementById('subject-select').value = name;
  closeModal();
}

document.getElementById('btn-add-subject').addEventListener('click', openModal);
document.getElementById('btn-modal-cancel').addEventListener('click', closeModal);
document.getElementById('btn-modal-confirm').addEventListener('click', addSubject);

// ===== THEME TOGGLE =====
const btnTheme = document.getElementById('btn-theme-toggle');
let isLight = localStorage.getItem('uninota-light-mode') === 'true';

const iconSun = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`;
const iconMoon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;

function applyTheme() {
  if (isLight) {
    document.body.classList.add('light-theme');
    btnTheme.innerHTML = iconMoon;
  } else {
    document.body.classList.remove('light-theme');
    btnTheme.innerHTML = iconSun;
  }
}

btnTheme.addEventListener('click', () => {
  isLight = !isLight;
  localStorage.setItem('uninota-light-mode', isLight);
  applyTheme();
});

// ===== INIT =====
applyTheme();
renderSubjects();
renderDynamicCuts();
renderHistory();
updatePGA();
