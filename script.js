// ===== STATE =====
let history = JSON.parse(localStorage.getItem('uninota-history') || '[]');

let currentCuts = [
  { id: 1, weight: 20 },
  { id: 2, weight: 20 },
  { id: 3, weight: 20 }
];
let nextCutId = 4;

// ===== SAVE =====
function save() {
  localStorage.setItem('uninota-history', JSON.stringify(history));
}

// ===== AUTOCOMPLETE =====
function updateSubjectSuggestions() {
  const dl = document.getElementById('subject-suggestions');
  if(!dl) return;
  const uniqueSubjects = {};
  history.forEach(h => { if (!uniqueSubjects[h.subject]) uniqueSubjects[h.subject] = h; });
  dl.innerHTML = Object.values(uniqueSubjects).map(h => `<option value="${h.subject}">`).join('');
}

const inpSubject = document.getElementById('calc-subject');
if(inpSubject) {
  inpSubject.addEventListener('change', (e) => {
    const val = e.target.value.trim();
    const found = history.find(h => h.subject === val);
    if(found) {
      document.getElementById('calc-semester').value = found.semester;
      document.getElementById('calc-credits').value = found.credits;
    }
  });
}

// ===== TABS =====
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
    if (tab.dataset.tab === 'history') updatePGA();
    if (tab.dataset.tab === 'pga') initPGASimulator();
  });
});

// ===== DYNAMIC CUTS UI =====
let evalMode = 'free'; // 'free' o 'udec'

document.getElementById('eval-mode-select').addEventListener('change', e => {
  evalMode = e.target.value;
  document.getElementById('mode-free').classList.toggle('hidden', evalMode !== 'free');
  document.getElementById('mode-udec').classList.toggle('hidden', evalMode !== 'udec');
  calcMain(false);
});

// Lógica de acordeones UdeC
document.querySelectorAll('.udec-header').forEach(btn => {
  btn.addEventListener('click', () => {
    const body = btn.nextElementSibling;
    body.classList.toggle('open');
  });
});

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

window.removeCut = function (id) {
  currentCuts = currentCuts.filter(c => c.id !== id);
  renderDynamicCuts();
};

document.getElementById('btn-add-cut').addEventListener('click', addCut);

// ===== CORE CALCULATION =====
function getCutsData() {
  const nodes = document.querySelectorAll('.cut-box');
  let sumWeights = 0, acc = 0;
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

function getUdeCData() {
  document.getElementById('alerta-pesos').classList.add('hidden'); // No aplica acá porque UdeC es fijo 100% (60% + 40%)

  const readAvg = (selector, avgId) => {
    const nodes = document.querySelectorAll(selector);
    let sum = 0, count = 0;
    nodes.forEach(n => {
      const v = parseFloat(n.value);
      if (!isNaN(v)) { sum += v; count++; }
    });
    const avg = count > 0 ? (sum / count) : 0;
    document.getElementById(avgId).textContent = avg.toFixed(2);
    return avg;
  };

  const avg1 = readAvg('.u-in.c1', 'udec-av-1');
  const avg2 = readAvg('.u-in.c2', 'udec-av-2');
  const avg3 = readAvg('.u-in.c3', 'udec-av-3'); // Es 1 solo input pero la lógica funciona igual

  const acc = (avg1 * 0.2) + (avg2 * 0.2) + (avg3 * 0.2);
  return {
    cuts: [
      { val: avg1, weight: 20 },
      { val: avg2, weight: 20 },
      { val: avg3, weight: 20 }
    ],
    sumWeights: 60,
    acc: acc,
    leftoverW: 0.40 // Examen final de 40% fijo
  };
}

// ===== CORE CALCULATION =====
function calcMain(saveToHistory = false) {
  const data = evalMode === 'free' ? getCutsData() : getUdeCData();
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
  document.getElementById('m-acc').textContent = data.acc.toFixed(2);
  document.getElementById('m-pct').textContent = data.sumWeights.toFixed(0) + '%';
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
    displayVal = needed.toFixed(2); msg = `necesitas en el ${(data.leftoverW * 100).toFixed(0)}% restante.`; state = needed >= 4.0 ? 'state-warn' : 'state-ok';
  }

  document.getElementById('r-val').textContent = displayVal;
  document.getElementById('r-msg').textContent = msg;
  card.classList.add(state);
  document.getElementById('result-section').classList.remove('hidden');

  // Render bars
  const bars = data.cuts.map((c, i) => ({ label: `C${i + 1}`, val: c.val }));
  bars.push({ label: 'Restante', val: Math.min(Math.max(needed, 0), 5), isResult: true, overflow: needed > 5, passed: needed <= 0 });
  renderBarsGeneric('bar-chart', bars);

  // Save to history logic
  if (saveToHistory) {
    const subjectName = document.getElementById('calc-subject').value.trim();
    if (!subjectName) {
      alert("⚠️ Digita un Nombre de Asignatura para guardar tu nota en el historial.");
      return;
    }
    const subjectSem = parseInt(document.getElementById('calc-semester').value) || 1;
    const subjectCreds = parseInt(document.getElementById('calc-credits').value) || 3;

    // Check if we need to update an existing record for this subject
    let finalDefinitive = data.acc + (needed > 0 && needed <= 5 ? needed * data.leftoverW : 0);
    if (data.leftoverW <= 0) finalDefinitive = data.acc;

    history.unshift({
      subject: subjectName,
      semester: subjectSem,
      credits: subjectCreds,
      cutsDetails: data.cuts,
      goal, needed, acc: data.acc,
      finalEstimated: finalDefinitive,
      ts: new Date().toISOString()
    });
    if (history.length > 100) history.pop();
    save();
    updateSubjectSuggestions();
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
  document.querySelectorAll('.cut-val, .cut-weight, #goal, .u-in').forEach(el => {
    el.addEventListener('input', () => {
      if (el.classList.contains('cut-weight') || el.classList.contains('cut-val')) {
        document.querySelectorAll('.cut-box').forEach((n, i) => {
          currentCuts[i].weight = parseFloat(n.querySelector('.cut-weight').value) || 0;
        });
      }
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
  if (sg) sg.addEventListener('input', (e) => {
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
    bars.push({ label: `C${idx + 1}`, val });
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
function getDefinitiveGrade(h) {
  if (h.finalEstimated !== undefined) return Math.min(Math.max(h.finalEstimated, 0), 5.0);
  let grade = h.acc;
  const wSoFar = h.cutsDetails ? h.cutsDetails.reduce((s, c) => s + c.weight, 0) : 60;
  if (h.needed > 0 && h.needed <= 5) grade = h.acc + h.needed * ((100 - wSoFar) / 100);
  return Math.min(grade, 5.0);
}

function updatePGA() {
  if (history.length === 0) { document.getElementById('overall-pga').textContent = '0.00'; return; }

  const latestGrades = {};
  history.forEach(h => {
    if (!latestGrades[h.subject]) latestGrades[h.subject] = h;
  });

  let totalCredits = 0, totalPoints = 0;
  Object.values(latestGrades).forEach(h => {
    const creds = parseInt(h.credits) || 3;
    let grade = getDefinitiveGrade(h);
    totalCredits += creds;
    totalPoints += grade * creds;
  });

  let pga = totalCredits > 0 ? (totalPoints / totalCredits) : 0;
  document.getElementById('overall-pga').textContent = pga.toFixed(2);
}

function renderHistory() {
  const el = document.getElementById('history-list');

  // Solo contamos materias únicas actuales
  const latestGrades = {};
  history.forEach(h => {
    if (!latestGrades[h.subject]) latestGrades[h.subject] = h;
  });

  const uniqueCount = Object.keys(latestGrades).length;
  document.getElementById('history-count').textContent = `${uniqueCount} Asignaturas`;

  if (history.length === 0) {
    el.innerHTML = '<div class="hist-empty">Sin cálculos aún. Guarda una nota para empezar tu malla curricular.</div>';
    return;
  }

  const bySem = {};
  Object.values(latestGrades).forEach(h => {
    const s = parseInt(h.semester) || 1;
    if (!bySem[s]) bySem[s] = [];
    bySem[s].push(h);
  });

  const semKeys = Object.keys(bySem).map(Number).sort((a, b) => b - a); // Mostrar mayor primero

  let html = '';
  semKeys.forEach(s => {
    const list = bySem[s];
    let totalCreds = 0, totalPts = 0;
    list.forEach(h => {
      const c = parseInt(h.credits) || 3;
      const grade = getDefinitiveGrade(h);
      totalCreds += c;
      totalPts += grade * c;
    });
    const semGPA = totalPts / totalCreds;

    html += `<div class="sem-header">
               <span>Semestre ${s}</span>
               <span>Promedio: ${semGPA.toFixed(2)} (${totalCreds} Cr)</span>
             </div>`;

    html += list.map(h => {
      const d = new Date(h.ts);
      const dateStr = d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
      let badgeClass = h.needed > 5 ? 'badge-bad' : h.needed <= 0 ? 'badge-ok' : (h.needed > 4.0 ? 'badge-warn' : 'badge-ok');
      let text = h.needed > 5 ? 'Peligro' : (h.needed <= 0 ? 'Pasada ya' : 'Necesita ' + h.needed.toFixed(1));

      return `
        <div class="hist-item">
          <div class="hist-left">
            <div class="hist-subject">${h.subject} <span style="font-size:10px; color:#94a3b8; font-weight:normal;">(${h.credits} Cr)</span></div>
            <div class="hist-detail">Acum: ${h.acc.toFixed(2)} &nbsp;·&nbsp; Meta: ${h.goal.toFixed(1)} &nbsp;·&nbsp; ${dateStr}</div>
          </div>
          <span class="hist-badge ${badgeClass}">${text}</span>
        </div>`;
    }).join('');
  });

  el.innerHTML = html;
}

// ====== PGA SIMULATOR ======
function initPGASimulator() {
  const el = document.getElementById('pga-sim-list');
  
  if (history.length === 0) {
    el.innerHTML = '<div class="hist-empty">Guarda calificaciones primero para proyectar tu PGA global.</div>';
    document.getElementById('sim-overall-pga').textContent = '0.00';
    return;
  }
  
  pgaSimSliders = {};
  
  const latestGrades = {};
  history.forEach(h => { if (!latestGrades[h.subject]) latestGrades[h.subject] = h; });
  const uniqueActiveSubjects = Object.values(latestGrades);

  const bySem = {};
  uniqueActiveSubjects.forEach(sub => {
    const s = parseInt(sub.semester) || 1;
    if(!bySem[s]) bySem[s] = [];
    bySem[s].push(sub);
  });
  
  const semKeys = Object.keys(bySem).map(Number).sort((a,b)=>a-b); 
  
  let html = '';
  semKeys.forEach(s => {
    html += `<div class="field-label" style="margin-top:15px; margin-bottom: 4px;">Semestre ${s}</div>`;
    bySem[s].forEach(h => {
      let val = getDefinitiveGrade(h);
      let isFixed = false;
      
      if (h.needed <= 0) {
        isFixed = true; // Ya está super cerrada/pasada de sobra
      }
      
      pgaSimSliders[h.subject] = { val, credits: h.credits, isFixed };
      
      const safeId = h.subject.replace(/\s+/g,'-').replace(/[^a-zA-Z0-9-]/g, '');
      
      html += `
        <div class="sim-row">
          <span class="sim-label" style="width:130px;" title="${h.subject}">${h.subject} <span class="pct">(${h.credits}Cr)</span></span>
          ${isFixed 
            ? `<div style="flex:1; height:6px; background:rgba(52, 211, 153, 0.4); border-radius:8px; display:flex; align-items:center;"><div style="width:100%; text-align:center; font-size:10px; color:#6ee7b7; font-weight:600; line-height:0; letter-spacing:1px;">CERRADA</div></div>`
            : `<input type="range" class="pga-slider-input" data-sub="${h.subject}" min="0" max="5" step="0.1" value="${val}" style="height:6px;">`
          }
          <span class="sim-val" id="pga-sval-${safeId}">${val.toFixed(2)}</span>
        </div>
      `;
    });
  });
  
  el.innerHTML = html;

  document.querySelectorAll('.pga-slider-input').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const subName = e.target.getAttribute('data-sub');
      const safeId = subName.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
      const val = parseFloat(e.target.value);
      pgaSimSliders[subName].val = val;
      document.getElementById('pga-sval-' + safeId).textContent = val.toFixed(2);
      recalcSimPGA();
    });
  });

  recalcSimPGA();
}

function recalcSimPGA() {
  let totalCreds = 0, totalPts = 0;
  Object.values(pgaSimSliders).forEach(s => {
    totalCreds += s.credits;
    totalPts += s.val * s.credits;
  });
  const pga = totalCreds > 0 ? (totalPts / totalCreds) : 0;
  document.getElementById('sim-overall-pga').textContent = pga.toFixed(2);
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
    margin: 1,
    filename: 'Boletin_UniNota.pdf',
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, backgroundColor: '#ffffff' },
    jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
  };

  html2pdf().set(opt).from(element).save().then(() => {
    // Revert visual changes
    document.body.classList.remove('pdf-mode');
  });
});

// ===== THEME TOGGLE =====
const btnTheme = document.getElementById('btn-theme-toggle');
let isLight = localStorage.getItem('uninota-light-mode') === 'true';

const iconSun = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`;
const iconMoon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;

function applyTheme() {
  if(!btnTheme) return;
  if (isLight) {
    document.body.classList.add('light-theme');
    btnTheme.innerHTML = iconMoon;
  } else {
    document.body.classList.remove('light-theme');
    btnTheme.innerHTML = iconSun;
  }
}

if(btnTheme) {
  btnTheme.addEventListener('click', () => {
    isLight = !isLight;
    localStorage.setItem('uninota-light-mode', isLight);
    applyTheme();
  });
}

// ===== INIT =====
applyTheme();
updateSubjectSuggestions();
renderDynamicCuts();
renderHistory();
updatePGA();
