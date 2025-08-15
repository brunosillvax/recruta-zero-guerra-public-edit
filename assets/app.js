// Versão
const VERSION = "war-v4.2.0"; // Ajuste Fino de Layout
document.getElementById("version").textContent = VERSION;

// ÍCONES SVG PROFISSIONAIS
const ICONS = {
    edit: `<svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z"></path></svg>`,
    remove: `<svg class="icon icon-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>`
};

// PIN Config
const PIN = "1590";

// Helpers
const $ = (s, el = document) => el.querySelector(s);

// Estado Padrão
const defaultState = {
  version: VERSION,
  settings: { maxPlayers: 50, totalDays: 4 },
  players: [],
};
let state = load() || defaultState;
save();

// --- Event Listeners Globais ---
$("#search").addEventListener("input", render);
$("#addPlayer").addEventListener("click", addPlayer);
$("#tableWrapper").addEventListener('click', handleTableClick);

// --- Lógica do Clock ---
setInterval(tickClock, 1000);
tickClock();

// --- Lógica dos Modais ---
$("#openRankingBtn").addEventListener("click", () => showModal("rankingModal"));
$("#openSettingsBtn").addEventListener("click", async () => {
    const pin = await showPrompt({ title: 'PIN de Acesso', message: 'Digite o PIN para abrir as configurações.', type: 'password' });
    if (pin === PIN) { showModal("settingsModal"); } 
    else if (pin !== null) { showAlert({ title: 'Erro', message: 'PIN incorreto!' }); }
});
document.addEventListener('click', (e) => {
    if (e.target.matches('[data-close-modal]')) { hideModal(e.target.dataset.closeModal); }
});

// --- Lógica do Painel de Configuração ---
$("#saveSettings").addEventListener("click", saveSettings);
$("#resetPointsBtn").addEventListener("click", resetAllPoints);
initSettingsInputs();

// --- FUNÇÕES PRINCIPAIS ---
function load() {
  try {
    const loadedState = JSON.parse(localStorage.getItem("rz_war_state"));
    if (!loadedState || !loadedState.version) {
      if (loadedState) showAlert({ title: "Atualização", message: "A estrutura de dados foi atualizada. Os dados antigos foram reiniciados." });
      return null;
    }
    return loadedState;
  } catch (e) { return null; }
}

function render() {
  renderTable();
}

async function addPlayer() {
  if (state.players.length >= state.settings.maxPlayers) return showAlert({ title: "Limite Atingido", message: "Você atingiu o número máximo de jogadores." });
  const name = await showPrompt({ title: 'Adicionar Jogador', message: 'Qual o nome do novo jogador?' });
  if (!name || !name.trim()) return;
  const pointsStr = await showPrompt({ title: 'Pontos Iniciais', message: `Quais os pontos para o Dia 1 de ${name}?`, type: 'number', initialValue: '0' });
  const points = Number.isFinite(parseInt(pointsStr, 10)) ? parseInt(pointsStr, 10) : 0;
  
  const newPlayer = {
      id: uid(),
      name: name.trim(),
      dailyPoints: Array(state.settings.totalDays).fill(0)
  };
  newPlayer.dailyPoints[0] = points;
  
  state.players.push(newPlayer);
  save();
  renderTable({ animateNewId: newPlayer.id });
}

async function handleTableClick(e) {
    const target = e.target.closest('button');
    if (!target) return;
    const { id, action, dayIndex } = target.dataset;
    if (!id || !action) return;
    const player = state.players.find(p => p.id === id);
    if (!player) return;
    let needsRender = true;
    if (action === 'edit-name') {
        const newName = await showPrompt({ title: 'Editar Nome', message: `Qual o novo nome para ${player.name}?`, initialValue: player.name });
        if (newName !== null) { player.name = newName.trim() || player.name; }
    } else if (action === 'edit-points') {
        const dayNum = parseInt(dayIndex, 10) + 1;
        const newPointsStr = await showPrompt({ title: `Editar Pontos - Dia ${dayNum}`, message: `Novos pontos para ${player.name}:`, type: 'number', initialValue: player.dailyPoints[dayIndex] });
        const newPoints = parseInt(newPointsStr, 10);
        if (Number.isFinite(newPoints)) { player.dailyPoints[dayIndex] = newPoints; }
    } else if (action === 'remove') {
        const confirmed = await showConfirm({ title: 'Remover Jogador', message: `Tem certeza que deseja remover ${player.name}?` });
        if (confirmed) {
            const row = target.closest('tr');
            row.classList.add('row-exiting');
            row.addEventListener('animationend', () => {
                state.players = state.players.filter(p => p.id !== id);
                save();
                render();
            }, { once: true });
            needsRender = false;
        } else {
            needsRender = false;
        }
    }
    if (needsRender) { save(); render(); }
}

async function resetAllPoints() {
    const confirmed = await showConfirm({ title: 'Resetar Pontos', message: 'ATENÇÃO! Deseja ZERAR TODOS OS PONTOS de todos os jogadores?', confirmText: 'Sim, Zerar Tudo' });
    if (confirmed) {
        state.players.forEach(p => { p.dailyPoints.fill(0); });
        save();
        render();
        showAlert({ title: 'Sucesso', message: 'Todos os pontos foram resetados.' });
    }
}

// --- Funções de Renderização ---
const formatNumber = (num) => (num || 0).toLocaleString('pt-BR');

function renderTable({ animateNewId = null } = {}) {
  const wrapper = $("#tableWrapper");
  const q = ($("#search").value || "").toLowerCase();
  
  const getTotalPoints = p => p.dailyPoints.reduce((sum, score) => sum + (score || 0), 0);
  
  const filtered = state.players.filter(p => p.name.toLowerCase().includes(q));
  filtered.sort((a, b) => getTotalPoints(b) - getTotalPoints(a));

  const dayHeaders = Array.from({ length: state.settings.totalDays }, (_, i) => `<th class="w-10">D${i + 1}</th>`).join("");
  const rows = filtered.map((p, i) => {
    const total = getTotalPoints(p);
    const dailyCells = p.dailyPoints.map((score, dayIdx) => `<td class="cell-numeric"><button data-id="${p.id}" data-action="edit-points" data-day-index="${dayIdx}" class="w-full h-full text-center">${formatNumber(score)}</button></td>`).join("");
    const animationClass = p.id === animateNewId ? 'row-entering' : '';
    return `<tr class="${animationClass}" data-player-id="${p.id}"><td class="cell-numeric">${i + 1}</td><td class="align-left"><button data-id="${p.id}" data-action="edit-name" class="flex items-center gap-2 w-full text-left">${ICONS.edit}<span class="flex-grow min-w-0 truncate">${escapeHtml(p.name)}</span></button></td>${dailyCells}<td class="cell-numeric cell-total col-total-cell">${formatNumber(total)}</td><td><button data-id="${p.id}" data-action="remove" class="w-full h-full flex items-center justify-center">${ICONS.remove}</button></td></tr>`;
  }).join("");

  // MUDANÇA AQUI: Adicionada a classe "cell-total" ao cabeçalho
  wrapper.innerHTML = `<table class="table"><thead><tr><th class="w-6">#</th><th>Jogador</th>${dayHeaders}<th class="w-14 col-total-header cell-total">Total</th><th class="w-10"></th></tr></thead><tbody id="player-tbody">${rows}</tbody></table>`;
  
  const grandTotal = state.players.reduce((sum, p) => sum + getTotalPoints(p), 0);
  $("#totalPoints").textContent = formatNumber(grandTotal);
  renderRanking(filtered);
}

function renderRanking(list) {
  const body = $("#rankingBody");
  const getTotalPoints = p => p.dailyPoints.reduce((sum, score) => sum + (score || 0), 0);
  
  if (list.length === 0) {
    body.innerHTML = `<tr><td colspan="3" class="text-center p-4 text-slate-400">Nenhum jogador ainda.</td></tr>`;
    return;
  }
  
  body.innerHTML = list.map((p, i) => {
    let cls = i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : "";
    return `<tr class="${cls}"><td class="p-2 text-center">${i + 1}</td><td class="p-2 text-left">${escapeHtml(p.name)}</td><td class="p-2 cell-numeric">${formatNumber(getTotalPoints(p))}</td></tr>`;
  }).join("");
}

// --- Funções Utilitárias ---
function saveSettings() {
  const newTotalDays = clamp(parseInt($("#totalDaysInput").value || "4", 10), 1, 10);
  if (newTotalDays !== state.settings.totalDays) {
      state.players.forEach(p => {
          const newPoints = Array(newTotalDays).fill(0);
          p.dailyPoints.slice(0, newTotalDays).forEach((score, i) => newPoints[i] = score);
          p.dailyPoints = newPoints;
      });
  }
  state.settings.totalDays = newTotalDays;
  state.settings.maxPlayers = clamp(parseInt($("#maxPlayersInput").value || "50", 10), 5, 200);
  save();
  showAlert({ title: 'Sucesso', message: 'Configurações salvas.' });
  render();
}

function initSettingsInputs() {
  $("#totalDaysInput").value = state.settings.totalDays;
  $("#maxPlayersInput").value = state.settings.maxPlayers;
}

function tickClock() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = now.toTimeString().slice(0, 5);
  $("#dateDisplay").textContent = dateStr.split("-").reverse().join("/");
  $("#timeDisplay").textContent = timeStr;
}

function save() { localStorage.setItem("rz_war_state", JSON.stringify(state)); }
function uid() { return Math.random().toString(36).slice(2, 9); }
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function escapeHtml(s) { return s?.replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[m])) || ""; }

// --- Sistema de Modais Customizado ---
const dialogModal = $("#dialogModal");
const dialogTitle = $("#dialogTitle");
const dialogBody = $("#dialogBody");
const dialogFooter = $("#dialogFooter");

function showModal(id) { $(`#${id}`).classList.add('visible'); }
function hideModal(id) { $(`#${id}`).classList.remove('visible'); }

function showDialog(opts) {
  dialogTitle.textContent = opts.title || '';
  dialogBody.innerHTML = opts.body || '';
  dialogFooter.innerHTML = '';
  showModal('dialogModal');
  
  return new Promise(resolve => {
    const cleanup = () => { dialogModal.removeEventListener('click', backdropHandler); document.removeEventListener('keydown', escapeHandler); };
    const handleResolve = (value) => { hideModal('dialogModal'); cleanup(); resolve(value); };
    opts.buttons.forEach(btnOpts => {
      const button = document.createElement('button');
      button.textContent = btnOpts.text;
      button.className = btnOpts.class;
      button.onclick = () => {
        let value = btnOpts.value;
        if (typeof value === 'undefined') { value = dialogBody.querySelector('#dialogInput')?.value ?? true; }
        handleResolve(value);
      };
      dialogFooter.appendChild(button);
    });
    
    const backdropHandler = e => { if (e.target === dialogModal) handleResolve(null); };
    const escapeHandler = e => { if (e.key === 'Escape') handleResolve(null); };
    dialogModal.addEventListener('click', backdropHandler);
    document.addEventListener('keydown', escapeHandler);
    
    setTimeout(() => { dialogBody.querySelector('#dialogInput')?.focus(); dialogBody.querySelector('#dialogInput')?.select(); }, 100);
  });
}

async function showAlert({ title, message }) {
  return showDialog({ title, body: `<p class="text-sm text-slate-300">${message}</p>`, buttons: [{ text: 'OK', class: 'btn' }], });
}

async function showConfirm({ title, message, confirmText = 'Confirmar' }) {
  const result = await showDialog({ title, body: `<p class="text-sm text-slate-300">${message}</p>`, buttons: [{ text: 'Cancelar', class: 'btn-sec', value: false }, { text: confirmText, class: 'btn-danger', value: true }], });
  return !!result;
}

async function showPrompt({ title, message, initialValue = '', type = 'text' }) {
    const safeInitialValue = String(initialValue || '');
    return showDialog({ title, body: `<label class="text-sm text-slate-300">${message}</label><input type="${type}" id="dialogInput" class="input mt-2" value="${escapeHtml(safeInitialValue)}">`, buttons: [{ text: 'Cancelar', class: 'btn-sec', value: null }, { text: 'OK', class: 'btn' }] });
}

// Inicializa a aplicação
render();