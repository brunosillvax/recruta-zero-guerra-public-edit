// --- Meta-informações e Importações ---

// Importa as funções do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore, collection, onSnapshot, doc, setDoc, addDoc, updateDoc, deleteDoc, writeBatch, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

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

// Helpers
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => el.querySelectorAll(s);
const formatNumber = (num) => (num || 0).toLocaleString('pt-BR');
const MIN_ROWS_DISPLAY = 10;

// --- Variáveis de Estado da Aplicação ---
let state = {
    settings: {
        maxPlayers: 50,
        totalDays: 4,
        announcementMessage: '',
        lockedDays: [],
        adminPin: '1590',
        loginPassword: '0000',
        allowPointEditing: false,
        allowPlayerManagement: false
    },
    players: [],
};
let playerChart = null;
let settingsFormState = { initialValues: {} };
let isWarningAdminMode = false;
let lastWarWinners = {};
let isSnapshotRunning = false;

// --- Referências do Firestore ---
const settingsRef = doc(db, "config", "settings");
const playersRef = collection(db, "players");
const winnersRef = doc(db, "config", "last_war_winners");
const historyRef = collection(db, "war_history");

// --- Listeners do Firestore ---
onSnapshot(settingsRef, (docSnap) => {
    if (docSnap.exists()) {
        const dbSettings = docSnap.data();
        state.settings = {
            maxPlayers: 50,
            totalDays: 4,
            announcementMessage: '',
            lockedDays: [],
            adminPin: '1590',
            loginPassword: '0000',
            allowPointEditing: false,
            allowPlayerManagement: false,
            ...dbSettings
        };
        initSettingsInputs();
        render();
        updateTicker();

        const clanName = state.settings.clanName || 'RECRUTA ZERO《☆》';
        $("#clanNameDisplay").textContent = clanName;
        $("#loginClanName").textContent = clanName;
        $("#clanSubtitleDisplay").textContent = state.settings.clanSubtitle || 'Placar da Guerra Online';
    } else {
        setDoc(settingsRef, state.settings);
    }
});

onSnapshot(playersRef, (querySnapshot) => {
    const playersFromDB = [];
    querySnapshot.forEach((doc) => {
        playersFromDB.push({
            id: doc.id,
            ...doc.data(),
            navalDefensePoints: doc.data().navalDefensePoints || 0
        });
    });
    state.players = playersFromDB;
    render();
});

onSnapshot(winnersRef, (docSnap) => {
    if (docSnap.exists()) {
        lastWarWinners = docSnap.data();
    } else {
        lastWarWinners = {};
    }
    updateTicker();
});

// --- Event Listeners Globais ---
$("#search").addEventListener("input", render);
$("#addPlayer").addEventListener("click", addPlayer);
$("#tableWrapper").addEventListener('click', handleTableClick);
$("#shareRankingBtn").addEventListener("click", shareRanking);
$("#exportWarDataBtn").addEventListener("click", handleWarDataExport);
$("#exportNavalDataBtn").addEventListener("click", handleNavalDataExport);
$("#loginBtn").addEventListener("click", handleLogin);
$("#loginPasswordInput").addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleLogin();
});

// --- LISTENERS PARA DEFESA NAVAL ---
$("#openNavalDefenseBtn").addEventListener("click", openNavalDefenseModal);
$("#resetNavalDefenseBtn").addEventListener("click", resetAllNavalDefensePoints);
$("#navalDefenseTableContainer").addEventListener('click', handleNavalDefenseTableClick);

// --- Lógica do Clock ---
setInterval(tickClock, 1000);
tickClock();

// --- Lógica dos Modais ---
$("#openRankingBtn").addEventListener("click", () => showModal("rankingModal"));
$("#openWarningsBtn").addEventListener("click", () => {
    renderWarningsModal();
    showModal("warningsModal");
});
$("#openHistoryBtn").addEventListener("click", () => {
    renderHistoryModal();
    showModal("historyModal");
});
$("#openSettingsBtn").addEventListener("click", async () => {
    const pin = await showPrompt({ title: 'PIN de Acesso', message: 'Digite o PIN para abrir as configurações.', type: 'password' });
    if (pin === state.settings.adminPin) {
        captureInitialSettingsState();
        showModal("settingsModal");
    } else if (pin !== null) { showAlert({ title: 'Erro', message: 'PIN incorreto!' }); }
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
$("#saveLoginPasswordBtn").addEventListener("click", changeLoginPassword);
$("#toggleWarningAdminBtn").addEventListener("click", toggleWarningAdminMode);
$("#resetPointsBtn").addEventListener("click", resetAllPoints);
$("#resetWarningsBtn").addEventListener("click", resetAllWarnings);
$("#deleteAllPlayersBtn").addEventListener("click", deleteAllPlayers);
$("#dayLockContainer").addEventListener("click", (e) => {
    const target = e.target.closest('.day-lock-btn');
    if (target) {
        target.classList.toggle('locked');
        target.innerHTML = `<span>${target.classList.contains('locked') ? '🔒' : '🔓'}</span> D${parseInt(target.dataset.dayIndex, 10) + 1}`;
    }
});

// --- LÓGICA DE LOGIN ---
function checkLogin() {
    if (sessionStorage.getItem('isLoggedIn') === 'true') {
        $('#loginScreen').classList.add('hidden');
        $('main').classList.remove('hidden');
        updateTicker();
    } else {
        $('#loginScreen').classList.remove('hidden');
        $('main').classList.add('hidden');
    }
}

async function handleLogin() {
    const passwordInput = $("#loginPasswordInput");
    const errorMsg = $("#loginError");
    const enteredPassword = passwordInput.value;
    const loginBtn = $("#loginBtn");
    const originalBtnText = loginBtn.textContent;

    loginBtn.disabled = true;
    loginBtn.textContent = 'Verificando...';
    await new Promise(resolve => setTimeout(resolve, 300));

    if (enteredPassword === state.settings.loginPassword) {
        sessionStorage.setItem('isLoggedIn', 'true');
        checkLogin();
        errorMsg.textContent = '';
        passwordInput.value = '';
    } else {
        errorMsg.textContent = 'Senha incorreta.';
        passwordInput.value = '';
        setTimeout(() => { errorMsg.textContent = '' }, 2000);
    }

    loginBtn.disabled = false;
    loginBtn.textContent = originalBtnText;
}

async function changeLoginPassword() {
    const newPassword = $("#newLoginPasswordInput").value;
    if (!newPassword || newPassword.length < 4) {
        return showAlert({ title: "Erro", message: "A nova senha deve ter pelo menos 4 caracteres." });
    }
    const confirmed = await showConfirm({
        title: "Alterar Senha?",
        message: "Tem certeza que deseja alterar a senha de login?",
        confirmText: "Sim, Alterar"
    });
    if (confirmed) {
        await updateDoc(settingsRef, { loginPassword: newPassword });
        showAlert({ title: "Sucesso!", message: "A senha de login foi alterada." });
        $("#newLoginPasswordInput").value = "";
    }
}

// --- FUNÇÕES PRINCIPAIS ---
function render() {
    renderTable();
    renderAnnouncement();
    if ($("#navalDefenseModal").classList.contains('visible')) {
        renderNavalDefenseTable();
    }
}

async function addPlayer() {
    if (state.players.length >= state.settings.maxPlayers) {
        return showAlert({ title: "Limite Atingido", message: "Você atingiu o número máximo de jogadores." });
    }
    const name = await showPrompt({ title: 'Adicionar Jogador', message: 'Qual o nome do novo jogador?' });
    if (!name || !name.trim()) return;
    const newPlayer = {
        name: name.trim(),
        note: '',
        warnings: 0,
        navalDefensePoints: 0,
        dailyPoints: Array(state.settings.totalDays).fill(0)
    };
    await addDoc(playersRef, newPlayer);
}

async function handleTableClick(e) {
    const target = e.target.closest('button, [data-action="show-chart"]');
    if (!target) return;
    if (target.closest('.empty-row')) return;
    const { id, action, dayIndex } = target.dataset;
    if (!id || !action) return;
    const player = state.players.find(p => p.id === id);
    if (!player) return;
    const playerDocRef = doc(db, "players", id);
    if (action === 'show-chart') {
        openChartModal(player);
    } else if (action === 'edit-name') {
        if (!state.settings.allowPlayerManagement) {
            return showAlert({ title: "Ação Bloqueada", message: "A edição de nomes está desativada pelo administrador. Peça a um líder para liberar nas Configurações." });
        }
        const newName = await showPrompt({ title: 'Editar Nome', message: `Qual o novo nome para ${player.name}?`, initialValue: player.name });
        if (newName !== null) {
            await updateDoc(playerDocRef, { name: newName.trim() || player.name });
        }
    } else if (action === 'edit-note') {
        const pin = await showPrompt({ title: 'PIN de Acesso', message: 'Digite o PIN para editar a anotação.', type: 'password' });
        if (pin === state.settings.adminPin) {
            const newNote = await showPrompt({ title: `Nota sobre ${player.name}`, message: 'Digite sua anotação (visível para todos):', initialValue: player.note || '' });
            if (newNote !== null) {
                await updateDoc(playerDocRef, { note: newNote.trim() });
            }
        } else if (pin !== null) {
            showAlert({ title: 'Erro', message: 'PIN incorreto!' });
        }
    } else if (action === 'edit-points') {
        const currentPoints = player.dailyPoints[dayIndex] || 0;
        if (currentPoints > 0 && !state.settings.allowPointEditing) {
            return showAlert({ title: "Edição Bloqueada", message: "A edição de pontos já inseridos está desativada. Peça a um líder para liberar nas Configurações." });
        }
        const isLocked = state.settings.lockedDays && state.settings.lockedDays[dayIndex];
        if (isLocked) {
            return showAlert({ title: 'Dia Bloqueado', message: `O Dia ${parseInt(dayIndex, 10) + 1} está trancado e não pode ser editado.` });
        }
        const dayNum = parseInt(dayIndex, 10) + 1;
        const newPointsStr = await showPrompt({ title: `Editar Pontos - Dia ${dayNum}`, message: `Novos pontos para ${player.name}:`, type: 'number', initialValue: currentPoints });
        const newPoints = parseInt(newPointsStr, 10);
        if (Number.isFinite(newPoints)) {
            const updatedPoints = [...player.dailyPoints];
            updatedPoints[dayIndex] = newPoints;
            await updateDoc(playerDocRef, { dailyPoints: updatedPoints });
        }
    } else if (action === 'remove') {
        if (!state.settings.allowPlayerManagement) {
            return showAlert({ title: "Ação Bloqueada", message: "A exclusão de jogadores está desativada pelo administrador. Peça a um líder para liberar nas Configurações." });
        }
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
        const canvas = await html2canvas(rankingContainer, { backgroundColor: "#0f172a", scale: 2 });
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

async function renderHistoryModal() {
    const content = $("#historyContent");
    content.innerHTML = '<p class="text-center text-slate-400">Carregando histórico...</p>';
    try {
        const q = query(historyRef, orderBy("snapshotTimestamp", "desc"), limit(3));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            content.innerHTML = '<p class="text-center text-slate-400">Nenhum histórico de guerras encontrado.</p>';
            return;
        }
        let historyHTML = '';
        querySnapshot.forEach(doc => {
            const data = doc.data();
            const warDate = data.snapshotTimestamp.toDate().toLocaleDateString('pt-BR', {
                year: 'numeric', month: 'long', day: 'numeric'
            });
            const navalWinnerHTML = data.navalWinnerName ? `
                <div class="history-winner">
                    <span>⛵</span>
                    <div>
                        <strong>${escapeHtml(data.navalWinnerName)}</strong>
                        <span class="text-slate-400">- ${formatNumber(data.navalWinnerScore)} Pontos</span>
                    </div>
                </div>` : '';
            historyHTML += `
                <div class="history-entry">
                    <p class="history-date">GUERRA FINALIZADA EM: ${warDate}</p>
                    <div class="space-y-2">
                        <div class="history-winner">
                            <span>🏆</span>
                            <div>
                                <strong>${escapeHtml(data.warWinnerName)}</strong>
                                <span class="text-slate-400">- ${formatNumber(data.warWinnerScore)} Pontos</span>
                            </div>
                        </div>
                        ${navalWinnerHTML}
                    </div>
                </div>
            `;
        });
        content.innerHTML = historyHTML;
    } catch (error) {
        console.error("Erro ao buscar histórico:", error);
        content.innerHTML = '<p class="text-center text-red-400">Falha ao carregar o histórico.</p>';
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
    let rowsHTML = filtered.map((p, i) => {
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
        const noteIconColor = (p.note || '').trim() ? 'icon-note-active' : '';
        let warningsDisplay = '';
        const warnings = p.warnings || 0;
        let rowClass = '';
        if (warnings === 1) {
            warningsDisplay = '<span class="player-warning-icon">⚠</span>';
        } else if (warnings === 2) {
            warningsDisplay = '<span class="player-warning-icon">⚠⚠</span>';
        } else if (warnings >= 3) {
            rowClass = 'player-banned';
            warningsDisplay = '<span class="player-banned-icon">📵</span>';
        }
        const topPlayerClass = (i === 0 && total > 0) ? 'top-player-row' : '';
        return `<tr class="${animationClass} ${rowClass} ${topPlayerClass}" data-player-id="${p.id}">
                    <td class="cell-numeric">${i + 1}</td>
                    <td class="align-left">
                        <div class="player-name-container">
                            <span class="player-name-clickable" data-id="${p.id}" data-action="show-chart">
                                <span class="player-name-warnings">${escapeHtml(p.name)} ${warningsDisplay}</span>
                            </span>
                            <button class="edit-icon-btn" data-id="${p.id}" data-action="edit-name">${ICONS.edit}</button>
                            <button class="edit-icon-btn ${noteIconColor}" data-id="${p.id}" data-action="edit-note">${ICONS.note}</button>
                        </div>
                    </td>
                    ${dailyCells}
                    <td class="cell-numeric cell-total col-total-cell">${formatNumber(total)}</td>
                    <td><button data-id="${p.id}" data-action="remove" class="w-full h-full flex items-center justify-center">${ICONS.remove}</button></td>
                </tr>`;
    }).join("");
    const emptyRowsCount = MIN_ROWS_DISPLAY - filtered.length;
    if (emptyRowsCount > 0) {
        let emptyRowsToAdd = '';
        const emptyDailyCells = Array(state.settings.totalDays).fill('<td class="cell-numeric">0</td>').join('');
        for (let i = 0; i < emptyRowsCount; i++) {
            const pos = filtered.length + i + 1;
            emptyRowsToAdd += `
                <tr class="empty-row">
                    <td class="cell-numeric">${pos}</td>
                    <td class="align-left">
                        <div class="player-name-container">
                            <span class="player-name-clickable" style="color: transparent;">-</span>
                            <button class="edit-icon-btn">${ICONS.edit}</button>
                            <button class="edit-icon-btn">${ICONS.note}</button>
                        </div>
                    </td>
                    ${emptyDailyCells}
                    <td class="cell-numeric cell-total col-total-cell">0</td>
                    <td><button class="w-full h-full flex items-center justify-center">${ICONS.remove}</button></td>
                </tr>
            `;
        }
        rowsHTML += emptyRowsToAdd;
    }
    wrapper.innerHTML = `<table class="table"><thead><tr><th class="w-6">#</th><th>Jogador</th>${dayHeaders}<th class="w-14 col-total-header cell-total">Total</th><th class="w-10"></th></tr></thead><tbody id="player-tbody">${rowsHTML}</tbody></table>`;
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
        return `<tr class="${cls}">
                    <td class="p-2 text-center">${i + 1}</td>
                    <td class="p-2 text-left">${escapeHtml(p.name)}</td>
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
    const newClanName = $("#clanNameInput").value.trim();
    const newClanSubtitle = $("#clanSubtitleInput").value.trim();
    const newAdminPin = $("#adminPinInput").value.trim() || '1590';
    const newSettings = {
        totalDays: newTotalDays,
        maxPlayers: newMaxPlayers,
        announcementMessage: newAnnouncement,
        lockedDays: newLockedDays,
        clanName: newClanName,
        clanSubtitle: newClanSubtitle,
        adminPin: newAdminPin,
        allowPointEditing: $("#allowPointEditingToggle").checked,
        allowPlayerManagement: $("#allowPlayerManagementToggle").checked,
        loginPassword: state.settings.loginPassword
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
    await setDoc(settingsRef, newSettings, { merge: true });
    showAlert({ title: 'Sucesso', message: 'Configurações salvas.' });
    captureInitialSettingsState();
}

function initSettingsInputs() {
    $("#totalDaysInput").value = state.settings.totalDays;
    $("#maxPlayersInput").value = state.settings.maxPlayers;
    $("#announcementInput").value = state.settings.announcementMessage || '';
    $("#clanNameInput").value = state.settings.clanName || 'RECRUTA ZERO《☆》';
    $("#clanSubtitleInput").value = state.settings.clanSubtitle || 'Placar da Guerra Online';
    $("#adminPinInput").value = state.settings.adminPin || '1590';
    renderDayLocks();
    $("#allowPointEditingToggle").checked = state.settings.allowPointEditing === true;
    $("#allowPlayerManagementToggle").checked = state.settings.allowPlayerManagement === true;
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
    const managementArea = $("#playerManagementArea");
    $("#chartModalTitle").textContent = `Desempenho de: ${escapeHtml(player.name)}`;
    const warnings = player.warnings || 0;
    managementArea.innerHTML = `
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
                <label class="font-bold text-sm">Advertências:<span class="text-xl font-black text-yellow-400 ml-2">${warnings}</span></label>
                <button id="removeWarningBtn" class="btn-sec py-1 px-3 text-xs" ${warnings === 0 ? 'disabled' : ''}>- Remover</button>
            </div>
            <button id="addWarningBtn" class="btn py-1 px-3 text-xs" ${warnings >= 3 ? 'disabled' : ''}>+ Adicionar</button>
        </div>
    `;
    $("#addWarningBtn").onclick = () => updateWarnings(player.id, 1);
    $("#removeWarningBtn").onclick = () => updateWarnings(player.id, -1);
    if (player.note && player.note.trim() !== '') {
        noteDisplay.innerHTML = `<p class="font-bold text-slate-300">Anotação:</p><p>${escapeHtml(player.note)}</p>`;
        noteDisplay.style.display = 'block';
    } else {
        noteDisplay.style.display = 'none';
    }
    if (playerChart) { playerChart.destroy(); }
    const labels = Array.from({ length: player.dailyPoints.length }, (_, i) => `Dia ${i + 1}`);
    const data = {
        labels: labels,
        datasets: [{
            label: 'Pontos Diários', data: player.dailyPoints.map(p => p || 0),
            backgroundColor: 'rgba(56, 189, 248, 0.5)', borderColor: 'rgba(56, 189, 248, 1)',
            borderWidth: 2, borderRadius: 4, barThickness: 30
        }]
    };
    const config = {
        type: 'bar', data: data,
        options: {
            responsive: true, maintainAspectRatio: false,
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
    const lockedDaysState = state.settings.lockedDays || [];
    settingsFormState.initialValues = {
        totalDays: $("#totalDaysInput").value,
        maxPlayers: $("#maxPlayersInput").value,
        announcement: $("#announcementInput").value.trim(),
        lockedDays: JSON.stringify(lockedDaysState),
        clanName: $("#clanNameInput").value.trim(),
        clanSubtitle: $("#clanSubtitleInput").value.trim(),
        adminPin: $("#adminPinInput").value.trim(),
        allowPointEditing: $("#allowPointEditingToggle").checked,
        allowPlayerManagement: $("#allowPlayerManagementToggle").checked
    };
}

function isSettingsFormDirty() {
    const lockButtons = document.querySelectorAll('#dayLockContainer .day-lock-btn');
    const currentLockedDaysState = Array.from(lockButtons).map(btn => btn.classList.contains('locked'));
    const currentValues = {
        totalDays: $("#totalDaysInput").value,
        maxPlayers: $("#maxPlayersInput").value,
        announcement: $("#announcementInput").value.trim(),
        lockedDays: JSON.stringify(currentLockedDaysState),
        clanName: $("#clanNameInput").value.trim(),
        clanSubtitle: $("#clanSubtitleInput").value.trim(),
        adminPin: $("#adminPinInput").value.trim(),
        allowPointEditing: $("#allowPointEditingToggle").checked,
        allowPlayerManagement: $("#allowPlayerManagementToggle").checked
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

async function updateWarnings(playerId, change) {
    if (!isWarningAdminMode) {
        return showAlert({
            title: "Edição Bloqueada",
            message: "Para adicionar ou remover advertências, primeiro ative o 'Modo de Edição' nas Configurações ⚙️."
        });
    }
    const player = state.players.find(p => p.id === playerId);
    if (!player) return;
    const currentWarnings = player.warnings || 0;
    let newWarnings = currentWarnings + change;
    if (newWarnings < 0) newWarnings = 0;
    if (newWarnings > 3) newWarnings = 3;
    const playerDocRef = doc(db, "players", playerId);
    await updateDoc(playerDocRef, { warnings: newWarnings });
    player.warnings = newWarnings;
    openChartModal(player);
    renderTable();
}

async function resetAllWarnings() {
    const confirmed = await showConfirm({
        title: 'Resetar Advertências',
        message: 'Tem certeza que deseja ZERAR as advertências de TODOS os jogadores? Esta ação é ideal para o início de uma nova temporada.',
        confirmText: 'Sim, Zerar Tudo'
    });
    if (confirmed) {
        const batch = writeBatch(db);
        state.players.forEach(player => {
            if (player.warnings && player.warnings > 0) {
                const playerDocRef = doc(db, "players", player.id);
                batch.update(playerDocRef, { warnings: 0 });
            }
        });
        await batch.commit();
        showAlert({ title: 'Sucesso', message: 'Todas as advertências foram resetadas.' });
    }
}

function renderWarningsModal() {
    const content = $("#warningsContent");
    const level1 = state.players.filter(p => p.warnings === 1).sort((a, b) => a.name.localeCompare(b.name));
    const level2 = state.players.filter(p => p.warnings === 2).sort((a, b) => a.name.localeCompare(b.name));
    const banned = state.players.filter(p => p.warnings >= 3).sort((a, b) => a.name.localeCompare(b.name));
    const createPlayerList = (players) => {
        if (players.length === 0) return '<p class="text-slate-400">Nenhum jogador nesta categoria.</p>';
        return `<ul class="warnings-list">${players.map(p => `<li>📌 ${escapeHtml(p.name)} (${p.warnings}-Adv)</li>`).join('')}</ul>`;
    };
    const createBannedList = (players) => {
        if (players.length === 0) return '<p class="text-slate-400">Nenhum jogador banido.</p>';
        return `<ul class="warnings-list">${players.map(p => `<li>📌 ${escapeHtml(p.name)} - (Ban📵)</li>`).join('')}</ul>`;
    };
    content.innerHTML = `
        <div class="warnings-category"><h3>⚠ GERAL (1 Advertência)</h3>${createPlayerList(level1)}</div>
        <div class="warnings-category risk-zone"><h3>⚠ ZONA DE RISCO (2 Advertências)</h3>${createPlayerList(level2)}</div>
        <div class="warnings-rule">🇧🇷 Completando 3 ADV. É REMOVIDO DO CLÃ.</div>
        <div class="warnings-category banned"><h3>📵 BANIDOS (3+ Advertências)</h3>${createBannedList(banned)}</div>
        <p class="text-xs text-slate-400 text-center mt-4">🔥 As advertências são canceladas no dia em que inicia a nova temporada do Clash.</p>`;
}

function toggleWarningAdminMode() {
    isWarningAdminMode = !isWarningAdminMode;
    const header = $('header');
    const toggleBtn = $('#toggleWarningAdminBtn');
    if (isWarningAdminMode) {
        header.classList.add('admin-mode-active');
        toggleBtn.textContent = '🔒 Bloquear Edição de Advertências';
        toggleBtn.classList.remove('btn-sec');
        toggleBtn.classList.add('btn-admin-active');
        showAlert({ title: "Modo de Edição Ativado", message: "Agora você pode adicionar ou remover advertências sem precisar do PIN." });
    } else {
        header.classList.remove('admin-mode-active');
        toggleBtn.textContent = '🔓 Liberar Edição de Advertências';
        toggleBtn.classList.add('btn-sec');
        toggleBtn.classList.remove('btn-admin-active');
    }
}

function initializeSettingsTabs() {
    const tabNav = $('.tab-nav');
    if (!tabNav) return;
    const tabBtns = $$('.tab-btn', tabNav);
    const tabPanels = $$('.tab-panel', tabNav.nextElementSibling);
    tabNav.addEventListener('click', (e) => {
        const clickedTab = e.target.closest('.tab-btn');
        if (!clickedTab) return;
        tabBtns.forEach(btn => btn.classList.remove('active'));
        clickedTab.classList.add('active');
        const tabId = clickedTab.dataset.tab;
        tabPanels.forEach(panel => {
            if (panel.id === `tab-${tabId}`) {
                panel.classList.add('active');
            } else {
                panel.classList.remove('active');
            }
        });
    });
}

// ==========================================================
// ========== LÓGICA DA FUNCIONALIDADE DEFESA NAVAL =========
// ==========================================================

function openNavalDefenseModal() {
    renderNavalDefenseTable();
    showModal('navalDefenseModal');
}

function renderNavalDefenseTable() {
    const container = $("#navalDefenseTableContainer");
    const totalDisplay = $("#navalDefenseTotal");
    const sortedPlayers = [...state.players].sort((a, b) => (b.navalDefensePoints || 0) - (a.navalDefensePoints || 0));
    const totalPoints = sortedPlayers.reduce((sum, player) => sum + (player.navalDefensePoints || 0), 0);
    totalDisplay.innerHTML = `
      <div class="bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-center">
          <span class="text-xs uppercase font-bold text-slate-400 tracking-wider block">Total do Clã</span>
          <span class="text-2xl font-black text-sky-400">${formatNumber(totalPoints)}</span>
      </div>
    `;
    if (sortedPlayers.length === 0) {
        container.innerHTML = `<p class="text-center p-4 text-slate-400">Nenhum jogador para exibir.</p>`;
        return;
    }
    const rowsHTML = sortedPlayers.map((p, index) => {
        const points = p.navalDefensePoints || 0;
        const status = points > 0 ? 'Realizado' : 'Pendente';
        const statusClass = points > 0 ? 'status-realizado' : 'status-pendente';
        return `
            <tr>
                <td class="p-2 text-center">${index + 1}º</td>
                <td class="p-2 text-left">
                    ${escapeHtml(p.name)}
                </td>
                <td class="p-2 cell-numeric">${formatNumber(points)}</td>
                <td class="p-2 text-center">
                    <span class="${statusClass}">${status}</span>
                </td>
                <td class="p-2 text-center">
                    <button class="btn-sec py-1 px-3 text-xs" data-id="${p.id}" data-action="edit-naval-points">
                        Editar
                    </button>
                </td>
            </tr>
        `;
    }).join("");
    container.innerHTML = `
        <table class="w-full text-white text-sm">
            <thead class="sticky top-0 bg-slate-800 uppercase text-xs">
                <tr>
                    <th class="p-2 text-center">Pos.</th>
                    <th class="p-2 text-left">Jogador</th>
                    <th class="p-2 cell-numeric">Pontos</th>
                    <th class="p-2 text-center">Status</th>
                    <th class="p-2 text-center">Ações</th>
                </tr>
            </thead>
            <tbody id="navalDefenseBody">${rowsHTML}</tbody>
        </table>
    `;
}

async function handleNavalDefenseTableClick(e) {
    const target = e.target.closest('button');
    if (!target || target.dataset.action !== 'edit-naval-points') return;
    const playerId = target.dataset.id;
    const player = state.players.find(p => p.id === playerId);
    if (!player) return;
    const currentPoints = player.navalDefensePoints || 0;
    if (currentPoints > 0 && !state.settings.allowPointEditing) {
        return showAlert({ title: "Edição Bloqueada", message: "A edição de pontos está desativada pelo administrador. Fale com um líder para liberar nas Configurações." });
    }
    const newPointsStr = await showPrompt({
        title: `Pontos Navais de ${player.name}`,
        message: 'Digite a nova pontuação:',
        type: 'number',
        initialValue: currentPoints
    });
    const newPoints = parseInt(newPointsStr, 10);
    if (Number.isFinite(newPoints)) {
        const playerDocRef = doc(db, "players", playerId);
        await updateDoc(playerDocRef, { navalDefensePoints: newPoints });
    }
}

async function resetAllNavalDefensePoints() {
    const confirmed = await showConfirm({
        title: 'Resetar Pontos Navais',
        message: 'Tem certeza que deseja ZERAR a pontuação naval de TODOS os jogadores? Esta ação não pode ser desfeita.',
        confirmText: 'Sim, Zerar Tudo'
    });
    if (confirmed) {
        const batch = writeBatch(db);
        state.players.forEach(player => {
            const playerDocRef = doc(db, "players", player.id);
            batch.update(playerDocRef, { navalDefensePoints: 0 });
        });
        await batch.commit();
        showAlert({ title: 'Sucesso', message: 'Todos os pontos de defesa naval foram resetados.' });
    }
}

// ==========================================================
// =========== LÓGICA DO LETREIRO AUTOMÁTICO ================
// ==========================================================
function updateTicker() {
    const tickerElement = $("#ticker-text");
    if (!tickerElement) return;
    const messages = [];
    if (lastWarWinners.warWinnerName) {
        messages.push(`🏆 Vencedor da Guerra: ${lastWarWinners.warWinnerName} com ${formatNumber(lastWarWinners.warWinnerScore)} pontos!`);
    }
    messages.push(state.settings.clanName ? `${state.settings.clanName} — ${state.settings.clanSubtitle}` : `RECRUTA ZERO《☆》— Placar da Guerra Online`);
    const separator = `&nbsp;`.repeat(10) + `•` + `&nbsp;`.repeat(10);
    const uniqueContent = messages.join(separator);
    tickerElement.innerHTML = `<span>${uniqueContent}${separator}</span><span>${uniqueContent}${separator}</span>`;
    const contentSpan = tickerElement.querySelector('span');
    if (!contentSpan) return;
    const scrollWidth = contentSpan.offsetWidth;
    const scrollSpeed = 60;
    const duration = scrollWidth / scrollSpeed;
    const styleSheetId = 'dynamic-ticker-style';
    let styleSheet = document.getElementById(styleSheetId);
    if (styleSheet) {
        styleSheet.remove();
    }
    styleSheet = document.createElement('style');
    styleSheet.id = styleSheetId;
    styleSheet.innerHTML = `
        @keyframes dynamicTicker {
            0% { transform: translateX(0); }
            100% { transform: translateX(-${scrollWidth}px); }
        }
    `;
    document.head.appendChild(styleSheet);
    tickerElement.style.animation = `dynamicTicker ${duration.toFixed(2)}s linear infinite`;
}

async function runAutomaticSnapshot() {
    console.log("Rodando snapshot automático dos vencedores...");
    if (state.players.length === 0) {
        console.log("Nenhum jogador para snapshot.");
        return;
    }
    const sortedByWar = [...state.players].sort((a, b) => {
        const totalA = a.dailyPoints.reduce((sum, p) => sum + (p || 0), 0);
        const totalB = b.dailyPoints.reduce((sum, p) => sum + (p || 0), 0);
        return totalB - totalA;
    });
    const topWarPlayer = sortedByWar[0];
    const topWarScore = topWarPlayer.dailyPoints.reduce((sum, p) => sum + (p || 0), 0);
    const sortedByNaval = [...state.players].sort((a, b) => (b.navalDefensePoints || 0) - (a.navalDefensePoints || 0));
    const topNavalPlayer = sortedByNaval.length > 0 ? sortedByNaval[0] : { name: 'N/A', navalDefensePoints: 0 };
    const winnersData = {
        warWinnerName: topWarPlayer.name,
        warWinnerScore: topWarScore,
        navalWinnerName: topNavalPlayer.name,
        navalWinnerScore: topNavalPlayer.navalDefensePoints || 0,
        snapshotTimestamp: new Date()
    };
    await setDoc(winnersRef, {
        warWinnerName: winnersData.warWinnerName,
        warWinnerScore: winnersData.warWinnerScore,
        snapshotTimestamp: winnersData.snapshotTimestamp
    });
    await addDoc(historyRef, winnersData);
    console.log("Vencedores da semana salvos com sucesso no ticker e no histórico!");
}

async function checkAndRunAutomaticSnapshot() {
    if (isSnapshotRunning) return;
    const now = new Date();
    const todayIsMonday = now.getDay() === 1;
    const isAfterDeadlineTime = now.getHours() > 6 || (now.getHours() === 6 && now.getMinutes() >= 45);
    if (!todayIsMonday || !isAfterDeadlineTime) {
        return;
    }
    const lastSnapshotDate = lastWarWinners.snapshotTimestamp ? new Date(lastWarWinners.snapshotTimestamp.seconds * 1000) : new Date(0);
    const lastMonday = new Date(now);
    lastMonday.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1));
    lastMonday.setHours(6, 45, 0, 0);
    if (lastSnapshotDate < lastMonday) {
        isSnapshotRunning = true;
        await runAutomaticSnapshot();
        isSnapshotRunning = false;
    }
}

// Inicializa a aplicação
function initApp() {
    checkLogin();
    initSettingsInputs();
    initializeSettingsTabs();
    checkAndRunAutomaticSnapshot();
    setInterval(checkAndRunAutomaticSnapshot, 1000 * 60 * 5);
}
initApp();

// --- LÓGICA DE EXPORTAÇÃO PARA CSV ---

/**
 * Função genérica para criar e baixar um arquivo CSV.
 * @param {string} filename - O nome do arquivo a ser baixado (ex: 'dados.csv').
 * @param {string[][]} rows - Um array de arrays, onde cada array interno é uma linha.
 */
function exportToCsv(filename, rows) {
    const csvContent = rows.map(row =>
        row.map(item => `"${String(item || '').replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

/**
 * Prepara e exporta os dados da Guerra de Clãs.
 */
function handleWarDataExport() {
    const getTotalPoints = p => p.dailyPoints.reduce((sum, score) => sum + (score || 0), 0);
    const sortedPlayers = [...state.players].sort((a, b) => getTotalPoints(b) - getTotalPoints(a));
    const dayHeaders = Array.from({ length: state.settings.totalDays }, (_, i) => `Dia ${i + 1}`);
    const headers = ['Posição', 'Nome', ...dayHeaders, 'Total Pontos', 'Advertências'];
    const rows = sortedPlayers.map((player, index) => {
        const total = getTotalPoints(player);
        const dailyPoints = player.dailyPoints.map(p => p || 0);
        return [
            index + 1,
            player.name,
            ...dailyPoints,
            total,
            player.warnings || 0
        ];
    });
    const date = new Date().toISOString().slice(0, 10);
    exportToCsv(`guerra_cla_${date}.csv`, [headers, ...rows]);
}

/**
 * Prepara e exporta os dados de Defesa Naval.
 */
function handleNavalDataExport() {
    const sortedPlayers = [...state.players].sort((a, b) => (b.navalDefensePoints || 0) - (a.navalDefensePoints || 0));
    const headers = ['Posição', 'Nome', 'Pontos Defesa Naval'];
    const rows = sortedPlayers.map((player, index) => [
        index + 1,
        player.name,
        player.navalDefensePoints || 0
    ]);
    const date = new Date().toISOString().slice(0, 10);
    exportToCsv(`defesa_naval_${date}.csv`, [headers, ...rows]);
}