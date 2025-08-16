// Versão
const VERSION = "war-public-v5.13.0-online"; // Adicionado Bloqueio de Dias
document.getElementById("version").textContent = VERSION;

// Importa as funções do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore, collection, onSnapshot, doc, setDoc, addDoc, updateDoc, deleteDoc, writeBatch } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// Configuração do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDYUtq1zxXleJDWd-XoCkx5GUKTuAaPcLk",
    authDomain: "recruta-zero.firebaseapp.com",
    projectId: "recruta-zero",
    storageBucket: "recruta-zero.appspot.com",
    messagingSenderId: "758953044147",
    appId: "1:758953044147:web:9b5562b4d45e4faaaf28c6"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ÍCONES SVG PROFISSIONAIS
const ICONS = {
    edit: `<svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z"></path></svg>`,
    remove: `<svg class="icon icon-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>`,
    note: `<svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path></svg>`
};

// PIN Config
const PIN = "1590";

// Helpers
const $ = (s, el = document) => el.querySelector(s);
const formatNumber = (num) => (num || 0).toLocaleString('pt-BR');

// Estado local
let state = {
  settings: { maxPlayers: 50, totalDays: 4, announcementMessage: '', lockedDays: [] },
  players: [],
};

// Variável para guardar a instância do gráfico
let playerChart = null;

// Objeto para controlar o estado do formulário de configurações
let settingsFormState = {
    initialValues: {}
};

// --- Referências do Firestore ---
const settingsRef = doc(db, "config", "settings");
const playersRef = collection(db, "players");

// --- Listeners do Firestore ---
onSnapshot(settingsRef, (docSnap) => {
    if (docSnap.exists()) {
        const dbSettings = docSnap.data();
        state.settings = { 
            maxPlayers: 50, totalDays: 4, announcementMessage: '', lockedDays: [],
            ...dbSettings 
        };
        while(state.settings.lockedDays.length < state.settings.totalDays) {
            state.settings.lockedDays.push(false);
        }
        initSettingsInputs();
        render();
    } else {
        setDoc(settingsRef, state.settings);
    }
});

onSnapshot(playersRef, (querySnapshot) => {
    const playersFromDB = [];
    querySnapshot.forEach((doc) => {
        playersFromDB.push({ id: doc.id, ...doc.data() });
    });
    state.players = playersFromDB;
    render();
});

// --- Event Listeners Globais ---
$("#search").addEventListener("input", render);
$("#addPlayer").addEventListener("click", addPlayer);
$("#tableWrapper").addEventListener('click', handleTableClick);
$("#shareRankingBtn").addEventListener("click", shareRanking);

// --- Lógica do Clock ---
setInterval(tickClock, 1000);
tickClock();

// --- Lógica dos Modais ---
$("#openRankingBtn").addEventListener("click", () => showModal("rankingModal"));
$("#openSettingsBtn").addEventListener("click", async () => {
    const pin = await showPrompt({ title: 'PIN de Acesso', message: 'Digite o PIN para abrir as configurações.', type: 'password' });
    if (pin === PIN) {
        captureInitialSettingsState();
        showModal("settingsModal");
    }
    else if (pin !== null) { showAlert({ title: 'Erro', message: 'PIN incorreto!' }); }
});

document.addEventListener('click', (e) => {
    if (e.target.matches('[data-close-modal]')) {
        tryCloseModal(e.target.dataset.closeModal);
    } else if (e.target.matches('.modal-backdrop.visible')) {
        tryCloseModal(e.target.id);
    }
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const visibleModal = document.querySelector('.modal-backdrop.visible');
        if (visibleModal && visibleModal.id !== 'dialogModal') {
             tryCloseModal(visibleModal.id);
        }
    }
});

// --- Lógica do Painel de Configuração ---
$("#saveSettings").addEventListener("click", saveSettings);
$("#syncAvatarsBtn").addEventListener("click", syncAvatars);
$("#resetPointsBtn").addEventListener("click", resetAllPoints);
$("#deleteAllPlayersBtn").addEventListener("click", deleteAllPlayers);
$("#dayLockContainer").addEventListener("click", (e) => {
    const target = e.target.closest('.day-lock-btn');
    if (target) {
        target.classList.toggle('locked');
        target.innerHTML = `<span>${target.classList.contains('locked') ? '🔒' : '🔓'}</span> D${parseInt(target.dataset.dayIndex, 10) + 1}`;
    }
});

// --- FUNÇÕES PRINCIPAIS ---
function render() {
    renderTable();
    renderAnnouncement();
}

async function addPlayer() {
    if (state.players.length >= state.settings.maxPlayers) return showAlert({ title: "Limite Atingido", message: "Você atingiu o número máximo de jogadores." });
    const name = await showPrompt({ title: 'Adicionar Jogador', message: 'Qual o nome do novo jogador?' });
    if (!name || !name.trim()) return;
    const pointsStr = await showPrompt({ title: 'Pontos Iniciais', message: `Quais os pontos para o Dia 1 de ${name.trim()}?`, type: 'number', initialValue: '0' });
    const points = Number.isFinite(parseInt(pointsStr, 10)) ? parseInt(pointsStr, 10) : 0;
    const newPlayer = {
        id: uid(),
        name: name.trim(),
        avatar: '⚔️',
        note: '',
        dailyPoints: Array(state.settings.totalDays).fill(0)
    };
    newPlayer.dailyPoints[0] = points;
    state.players.push(newPlayer);
    renderTable({ animateNewId: newPlayer.id });
    await addDoc(playersRef, { 
        name: newPlayer.name, 
        avatar: newPlayer.avatar, 
        note: newPlayer.note, 
        dailyPoints: newPlayer.dailyPoints 
    });
}

async function handleTableClick(e) {
    const target = e.target.closest('button, [data-action="show-chart"]');
    if (!target) return;
    const { id, action, dayIndex } = target.dataset;
    if (!id || !action) return;
    const player = state.players.find(p => p.id === id);
    if (!player) return;
    const playerDocRef = doc(db, "players", id);

    if (action === 'show-chart') {
        openChartModal(player);
    } else if (action === 'edit-name') {
        const newName = await showPrompt({ title: 'Editar Nome', message: `Qual o novo nome para ${player.name}?`, initialValue: player.name });
        if (newName !== null) {
            await updateDoc(playerDocRef, { name: newName.trim() || player.name });
        }
    } else if (action === 'edit-note') {
        const pin = await showPrompt({ title: 'PIN de Acesso', message: 'Digite o PIN para editar a anotação.', type: 'password' });
        if (pin === PIN) {
            const newNote = await showPrompt({ title: `Nota sobre ${player.name}`, message: 'Digite sua anotação (visível para todos):', initialValue: player.note || '' });
            if (newNote !== null) {
                await updateDoc(playerDocRef, { note: newNote.trim() });
            }
        } else if (pin !== null) {
            showAlert({ title: 'Erro', message: 'PIN incorreto!' });
        }
    } else if (action === 'edit-points') {
        const isLocked = state.settings.lockedDays && state.settings.lockedDays[dayIndex];
        if (isLocked) {
            showAlert({ title: 'Dia Bloqueado', message: `O Dia ${parseInt(dayIndex, 10) + 1} está trancado e não pode ser editado.` });
            return;
        }
        const dayNum = parseInt(dayIndex, 10) + 1;
        const newPointsStr = await showPrompt({ title: `Editar Pontos - Dia ${dayNum}`, message: `Novos pontos para ${player.name}:`, type: 'number', initialValue: player.dailyPoints[dayIndex] });
        const newPoints = parseInt(newPointsStr, 10);
        if (Number.isFinite(newPoints)) {
            const updatedPoints = [...player.dailyPoints];
            updatedPoints[dayIndex] = newPoints;
            await updateDoc(playerDocRef, { dailyPoints: updatedPoints });
        }
    } else if (action === 'remove') {
        const confirmed = await showConfirm({ title: 'Remover Jogador', message: `Tem certeza que deseja remover ${player.name}?` });
        if (confirmed) {
            const row = target.closest('tr');
            row.classList.add('row-exiting');
            row.addEventListener('animationend', async () => {
                await deleteDoc(playerDocRef);
            }, { once: true });
        }
    }
}

async function syncAvatars() {
    const confirmed = await showConfirm({
        title: 'Sincronizar Avatares',
        message: 'Esta ação irá verificar todos os jogadores e adicionar o avatar padrão (⚔️) para aqueles que não o possuem. Deseja continuar?',
        confirmText: 'Sim, Sincronizar'
    });
    if (confirmed) {
        const batch = writeBatch(db);
        let updatesMade = 0;
        state.players.forEach(player => {
            if (!player.avatar) {
                const playerDocRef = doc(db, "players", player.id);
                batch.update(playerDocRef, { avatar: '⚔️' });
                updatesMade++;
            }
        });
        if (updatesMade > 0) {
            await batch.commit();
            showAlert({ title: 'Sucesso', message: `${updatesMade} jogadores foram atualizados com o avatar padrão.` });
        } else {
            showAlert({ title: 'Nenhuma Ação Necessária', message: 'Todos os jogadores já possuem um avatar.' });
        }
    }
}

async function resetAllPoints() {
    const confirmed = await showConfirm({ title: 'Resetar Pontos', message: 'ATENÇÃO! Deseja ZERAR TODOS OS PONTOS de todos os jogadores?', confirmText: 'Sim, Zerar Tudo' });
    if (confirmed) {
        const batch = writeBatch(db);
        state.players.forEach(player => {
            const playerDocRef = doc(db, "players", player.id);
            const resetPoints = Array(state.settings.totalDays).fill(0);
            batch.update(playerDocRef, { dailyPoints: resetPoints });
        });
        await batch.commit();
        showAlert({ title: 'Sucesso', message: 'Todos os pontos foram resetados.' });
    }
}

async function deleteAllPlayers() {
    const confirmed = await showConfirm({
        title: 'Excluir TODOS os Jogadores',
        message: 'PERIGO! Esta ação é IRREVERSÍVEL. Tem certeza que deseja excluir TODOS os jogadores da guerra? Seus nomes e pontos serão perdidos para sempre.',
        confirmText: 'Sim, Excluir Tudo'
    });
    if (confirmed) {
        const batch = writeBatch(db);
        state.players.forEach(player => {
            const playerDocRef = doc(db, "players", player.id);
            batch.delete(playerDocRef);
        });
        await batch.commit();
        showAlert({ title: 'Sucesso', message: 'Todos os jogadores foram excluídos.' });
    }
}

async function shareRanking() {
    const shareBtn = $("#shareRankingBtn");
    const originalText = shareBtn.innerHTML;
    shareBtn.disabled = true;
    shareBtn.innerHTML = `<span>Gerando imagem...</span>`;
    const rankingContainer = $("#rankingTableContainer");
    try {
        const canvas = await html2canvas(rankingContainer, {
            backgroundColor: "#0f172a",
            scale: 2,
        });
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        const file = new File([blob], 'ranking.png', { type: 'image/png' });
        const shareData = {
            title: 'Ranking da Guerra - RECRUTA ZERO',
            text: 'Confira a classificação atual da nossa guerra!',
            files: [file],
        };
        if (navigator.canShare && navigator.canShare(shareData)) {
            await navigator.share(shareData);
        } else {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'ranking-recruta-zero.png';
            link.click();
            URL.revokeObjectURL(link.href);
            await showAlert({ title: "Imagem Pronta!", message: "A imagem do ranking foi baixada. Agora é só arrastar o arquivo para sua conversa do WhatsApp Web." });
        }
    } catch (err) {
        console.error("Erro ao compartilhar:", err);
        showAlert({ title: "Erro", message: "Não foi possível gerar a imagem para compartilhamento." });
    } finally {
        shareBtn.disabled = false;
        shareBtn.innerHTML = originalText;
    }
}

// --- Funções de Renderização ---
function renderAnnouncement() {
    const area = $("#announcementArea");
    if (state.settings.announcementMessage && state.settings.announcementMessage.trim() !== '') {
        area.innerHTML = `<div class="flex items-start gap-3"><span class="text-xl mt-1">📢</span><div class="flex-1"><h3 class="font-bold text-sm uppercase text-sky-400">Aviso do Clã</h3><p class="text-sm text-slate-300 whitespace-pre-wrap">${escapeHtml(state.settings.announcementMessage)}</p></div></div>`;
        area.classList.remove('hidden');
    } else {
        area.classList.add('hidden');
    }
}

function renderTable({ animateNewId = null } = {}) {
    const wrapper = $("#tableWrapper");
    const q = ($("#search").value || "").toLowerCase();
    const getTotalPoints = p => p.dailyPoints.reduce((sum, score) => sum + (score || 0), 0);
    const filtered = state.players.filter(p => p.name.toLowerCase().includes(q));
    filtered.sort((a, b) => getTotalPoints(b) - getTotalPoints(a));
    const dayHeaders = Array.from({ length: state.settings.totalDays }, (_, i) => `<th class="w-10">D${i + 1}</th>`).join("");
    const rows = filtered.map((p, i) => {
        const total = getTotalPoints(p);
        const dailyCells = p.dailyPoints.map((score, dayIdx) => {
            const isLocked = state.settings.lockedDays && state.settings.lockedDays[dayIdx];
            return `<td class="cell-numeric ${isLocked ? 'cell-locked' : ''}">
                <button data-id="${p.id}" data-action="edit-points" data-day-index="${dayIdx}" class="w-full h-full text-center" ${isLocked ? 'disabled' : ''}>
                    ${formatNumber(score)}
                </button>
            </td>`;
        }).join("");
        const animationClass = p.id === animateNewId ? 'row-entering' : '';
        const playerAvatar = p.avatar || '⚔️';
        const noteIconColor = (p.note || '').trim() ? 'icon-note-active' : '';
        return `<tr class="${animationClass}" data-player-id="${p.id}">
            <td class="cell-numeric">${i + 1}</td>
            <td class="align-left">
                <span class="avatar-display">${escapeHtml(playerAvatar)}</span>
                <div class="player-name-container">
                    <span class="player-name-clickable" data-id="${p.id}" data-action="show-chart">${escapeHtml(p.name)}</span>
                    <button class="edit-icon-btn" data-id="${p.id}" data-action="edit-name">${ICONS.edit}</button>
                    <button class="edit-icon-btn ${noteIconColor}" data-id="${p.id}" data-action="edit-note">${ICONS.note}</button>
                </div>
            </td>
            ${dailyCells}
            <td class="cell-numeric cell-total col-total-cell">${formatNumber(total)}</td>
            <td><button data-id="${p.id}" data-action="remove" class="w-full h-full flex items-center justify-center">${ICONS.remove}</button></td>
        </tr>`;
    }).join("");
    wrapper.innerHTML = `<table class="table"><thead><tr><th class="w-6">#</th><th>Jogador</th>${dayHeaders}<th class="w-14 col-total-header cell-total">Total</th><th class="w-10"></th></tr></thead><tbody id="player-tbody">${rows}</tbody></table>`;
    const grandTotal = state.players.reduce((sum, p) => sum + getTotalPoints(p), 0);
    $("#totalPoints").textContent = formatNumber(grandTotal);
    renderRanking(filtered);
}

function renderRanking(list) {
    const body = $("#rankingBody");
    const getTotalPoints = p => p.dailyPoints.reduce((sum, score) => sum + (score || 0), 0);
    if (list.length === 0) {
        body.innerHTML = `<tr><td colspan="4" class="text-center p-4 text-slate-400">Nenhum jogador ainda.</td></tr>`;
        return;
    }
    body.innerHTML = list.map((p, i) => {
        let cls = i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : "";
        const totalPoints = getTotalPoints(p);
        const daysScored = p.dailyPoints.filter(score => (score || 0) > 0).length;
        const average = daysScored > 0 ? (totalPoints / daysScored) : 0;
        const playerAvatar = `<span class="ranking-avatar">${escapeHtml(p.avatar || '⚔️')}</span>`;
        return `<tr class="${cls}">
            <td class="p-2 text-center">${i + 1}</td>
            <td class="p-2 text-left">${playerAvatar} ${escapeHtml(p.name)}</td>
            <td class="p-2 cell-numeric">${formatNumber(totalPoints)}</td>
            <td class="p-2 cell-average">${average.toFixed(1)}</td>
        </tr>`;
    }).join("");
}

// --- Funções Utilitárias ---
async function saveSettings() {
    const newTotalDays = clamp(parseInt($("#totalDaysInput").value || "4", 10), 1, 10);
    const newMaxPlayers = clamp(parseInt($("#maxPlayersInput").value || "50", 10), 5, 200);
    const newAnnouncement = $("#announcementInput").value.trim();
    const lockButtons = document.querySelectorAll('#dayLockContainer .day-lock-btn');
    const newLockedDays = Array.from(lockButtons).map(btn => btn.classList.contains('locked'));

    const newSettings = {
        totalDays: newTotalDays,
        maxPlayers: newMaxPlayers,
        announcementMessage: newAnnouncement,
        lockedDays: newLockedDays
    };

    if (newTotalDays !== state.settings.totalDays) {
        const batch = writeBatch(db);
        state.players.forEach(p => {
            const playerDocRef = doc(db, "players", p.id);
            const newPoints = Array(newTotalDays).fill(0);
            p.dailyPoints.slice(0, newTotalDays).forEach((score, i) => newPoints[i] = score);
            batch.update(playerDocRef, { dailyPoints: newPoints });
        });
        await batch.commit();
    }
    await setDoc(settingsRef, newSettings);
    showAlert({ title: 'Sucesso', message: 'Configurações salvas.' });
    captureInitialSettingsState();
}

function initSettingsInputs() {
    $("#totalDaysInput").value = state.settings.totalDays;
    $("#maxPlayersInput").value = state.settings.maxPlayers;
    $("#announcementInput").value = state.settings.announcementMessage || '';
    renderDayLocks();
}

function renderDayLocks() {
    const container = $("#dayLockContainer");
    container.innerHTML = '';
    const totalDays = state.settings.totalDays || 4;
    const lockedDays = state.settings.lockedDays || [];
    for (let i = 0; i < totalDays; i++) {
        const isLocked = lockedDays[i] === true;
        const button = document.createElement('button');
        button.className = `day-lock-btn ${isLocked ? 'locked' : ''}`;
        button.dataset.dayIndex = i;
        button.innerHTML = `<span>${isLocked ? '🔒' : '🔓'}</span> D${i + 1}`;
        container.appendChild(button);
    }
}

function tickClock() {
    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR');
    const timeStr = now.toTimeString().slice(0, 5);
    $("#dateDisplay").textContent = dateStr;
    $("#timeDisplay").textContent = timeStr;
}

function uid() { return Math.random().toString(36).slice(2, 9); }
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[m])); }

function openChartModal(player) {
    const chartCanvas = $("#playerChartCanvas");
    const noteDisplay = $("#playerNoteDisplay");
    $("#chartModalTitle").textContent = `Desempenho de: ${escapeHtml(player.name)}`;
    if (player.note && player.note.trim() !== '') {
        noteDisplay.innerHTML = `<p class="font-bold text-slate-300">Anotação:</p><p>${escapeHtml(player.note)}</p>`;
        noteDisplay.style.display = 'block';
    } else {
        noteDisplay.style.display = 'none';
    }
    if (playerChart) {
        playerChart.destroy();
    }
    const labels = Array.from({ length: player.dailyPoints.length }, (_, i) => `Dia ${i + 1}`);
    const data = {
        labels: labels,
        datasets: [{
            label: 'Pontos Diários',
            data: player.dailyPoints.map(p => p || 0),
            backgroundColor: 'rgba(56, 189, 248, 0.5)',
            borderColor: 'rgba(56, 189, 248, 1)',
            borderWidth: 2,
            borderRadius: 4,
            barThickness: 30
        }]
    };
    const config = {
        type: 'bar',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148, 163, 184, 0.1)' } },
                x: { ticks: { color: '#94a3b8' }, grid: { display: false } }
            },
            plugins: {
                legend: { display: false },
                tooltip: { backgroundColor: '#1e293b', titleColor: '#e2e8f0', bodyColor: '#e2e8f0', padding: 10, cornerRadius: 6 }
            }
        }
    };
    playerChart = new Chart(chartCanvas, config);
    showModal('chartModal');
}

function captureInitialSettingsState() {
    const lockButtons = document.querySelectorAll('#dayLockContainer .day-lock-btn');
    const lockedDaysState = Array.from(lockButtons).map(btn => btn.classList.contains('locked'));
    settingsFormState.initialValues = {
        totalDays: $("#totalDaysInput").value,
        maxPlayers: $("#maxPlayersInput").value,
        announcement: $("#announcementInput").value.trim(),
        lockedDays: JSON.stringify(lockedDaysState)
    };
}

function isSettingsFormDirty() {
    const lockButtons = document.querySelectorAll('#dayLockContainer .day-lock-btn');
    const currentLockedDaysState = Array.from(lockButtons).map(btn => btn.classList.contains('locked'));
    const currentValues = {
        totalDays: $("#totalDaysInput").value,
        maxPlayers: $("#maxPlayersInput").value,
        announcement: $("#announcementInput").value.trim(),
        lockedDays: JSON.stringify(currentLockedDaysState)
    };
    return JSON.stringify(currentValues) !== JSON.stringify(settingsFormState.initialValues);
}

async function tryCloseModal(modalId) {
    if (modalId === 'settingsModal' && isSettingsFormDirty()) {
        const confirmed = await showConfirm({
            title: 'Descartar Alterações?',
            message: 'Você tem alterações não salvas. Tem certeza que deseja fechar?',
            confirmText: 'Sim, Descartar'
        });
        if (!confirmed) return;
    }
    if (modalId === 'settingsModal') {
        initSettingsInputs();
    }
    hideModal(modalId);
}

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
initSettingsInputs();