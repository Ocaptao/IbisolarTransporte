
import { Chart, registerables } from 'chart.js';
// Firebase App (o núcleo do Firebase SDK) é sempre necessário e deve ser listado primeiro
import { initializeApp } from "firebase/app";
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    // updatePassword as updateUserPasswordInAuth, // Removido por não estar em uso
} from "firebase/auth";
import {
    getFirestore,
    collection,
    doc,
    addDoc,
    getDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    query,
    where,
    Timestamp,
    orderBy,
    // writeBatch, // Removido por não estar em uso
    setDoc as firebaseSetDoc,
} from "firebase/firestore";

Chart.register(...registerables);

// --- CONFIGURAÇÃO DO FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyC3f9S7B94TI2nCHdC4FbIVPcBVLZGkHCQ",
    authDomain: "ibisolar-transporte.firebaseapp.com",
    projectId: "ibisolar-transporte",
    storageBucket: "ibisolar-transporte.firebasestorage.app",
    messagingSenderId: "601522852757",
    appId: "1:601522852757:web:16e8af21fa364511385c9c",
    measurementId: "G-JGY7JHX4ML"
};

// Inicializar Firebase
let app;
let authFirebase; // Renomeado para evitar conflito com a variável 'auth' já declarada no escopo global do browser
let db;
let userProfilesCollection;
let tripsCollection;

try {
    app = initializeApp(firebaseConfig);
    authFirebase = getAuth(app); // Usando a variável renomeada
    db = getFirestore(app);
    userProfilesCollection = collection(db, "userProfiles");
    tripsCollection = collection(db, "trips");
    console.log("Firebase inicializado com sucesso!");

    // Anexar o listener onAuthStateChanged somente se a autenticação inicializou com sucesso
    onAuthStateChanged(authFirebase, async (user) => { // Usando a variável renomeada
        console.log("onAuthStateChanged acionado. Objeto de usuário:", user ? user.uid : 'null');
        if (user) {
            loggedInUser = user;
            console.log("Usuário está autenticado com UID:", user.uid);
            try {
                console.log("Tentando buscar perfil do usuário no Firestore para o UID:", user.uid);
                const userProfileDocRef = doc(userProfilesCollection, user.uid);
                const userProfileDoc = await getDoc(userProfileDocRef);

                if (userProfileDoc.exists()) {
                    if (authFirebase.currentUser && authFirebase.currentUser.uid === user.uid) { // Usando a variável renomeada
                        loggedInUserProfile = { id: userProfileDoc.id, ...userProfileDoc.data() };
                        console.log("Perfil do usuário encontrado no Firestore:", "Nome de usuário:", loggedInUserProfile.username, "Papel:", loggedInUserProfile.role);

                        updateNavVisibility();
                        if (loggedInUserProfile.role === 'admin') {
                            console.log("Usuário é admin, mostrando adminView.");
                            showView('adminView');
                            initializeAdminView();
                        } else {
                            console.log("Usuário é motorista, mostrando userView.");
                            showView('userView');
                            initializeUserView();
                        }
                        if (myTripsViewBtn && myTripsViewBtn.style.display !== 'none') {
                            console.log("Inicializando a visualização 'Minhas Viagens' para o usuário logado.");
                            initializeMyTripsView();
                        }
                        if (userManagementViewBtn && userManagementViewBtn.style.display !== 'none' && loggedInUserProfile.username.toLowerCase() === 'fabio') {
                            console.log("Usuário é Fabio (admin), inicializando a visualização 'Gerenciamento de Usuários'.");
                            initializeUserManagementView();
                        }
                    } else {
                        console.warn("Sessão do usuário alterada (ex: logout ou login de outro usuário) durante a busca do perfil para o UID:", user.uid, ". Abortando atualização da UI para esta sessão obsoleta. O novo estado de autenticação será tratado.");
                    }
                } else {
                    console.error("CRÍTICO: Perfil do usuário NÃO ENCONTRADO no Firestore para o UID:", user.uid, "Email:", user.email);
                    showFeedback(loginFeedback, `Falha ao carregar perfil (usuário ${user.email || user.uid}). Você será desconectado. Verifique o cadastro ou contate o suporte.`, "error");
                    setTimeout(() => signOut(authFirebase), 3000); // Usando a variável renomeada
                }
            } catch (error) {
                console.error("ERRO CRÍTICO ao buscar perfil do usuário para o UID:", user.uid, "Erro:", error);
                showFeedback(loginFeedback, `Erro ao carregar dados do perfil (usuário ${user.email || user.uid}). Você será desconectado. (${error.message})`, "error");
                setTimeout(() => signOut(authFirebase), 3000); // Usando a variável renomeada
            }
        } else {
            console.log("Usuário não está autenticado (desconectado ou sessão encerrada).");
            loggedInUser = null;
            loggedInUserProfile = null;
            trips = [];
            userProfiles = [];
            updateNavVisibility();
            showView('loginView');
            console.log("Usuário está desconectado, mostrando loginView.");
        }
        console.log("onAuthStateChanged concluiu o processamento para o usuário:", user ? user.uid : 'null');
    });
    console.log("Listener onAuthStateChanged anexado com sucesso.");

} catch (error) {
    console.error("ERRO CRÍTICO: Falha na inicialização do Firebase:", "Código:", error.code, "Mensagem:", error.message);
    alert("Erro crítico: Não foi possível conectar ao serviço de dados. Verifique a configuração do Firebase e sua conexão com a internet.");
    showView('loginView');
}


// --- VARIÁVEIS DE ESTADO ---
let trips = []; // Cache local de viagens carregadas
let editingTripId = null;
let currentUserForMyTripsSearch = null; // Nome de usuário
let currentUidForMyTripsSearch = null; // UID do Firebase

let userProfiles = []; // Cache local de perfis de usuário (para admin)
let loggedInUser = null; // Usuário do Firebase Auth
let loggedInUserProfile = null; // Perfil do usuário logado do Firestore
let editingUserIdForAdmin = null; // UID do usuário sendo editado pelo admin
let adminSelectedDriverName = null; // Nome de usuário
let adminSelectedDriverUid = null; // UID do Firebase

let adminSummaryChart = null; // Instância do gráfico

// --- ELEMENTOS DOM ---
const loginView = document.getElementById('loginView');
const registerView = document.getElementById('registerView');
const appContainer = document.getElementById('appContainer');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const tripForm = document.getElementById('tripForm');
const loginFeedback = document.getElementById('loginFeedback');
const registerFeedback = document.getElementById('registerFeedback');
const userFormFeedback = document.getElementById('userFormFeedback');
const myTripsFeedback = document.getElementById('myTripsFeedback');
const adminGeneralFeedback = document.getElementById('adminGeneralFeedback');
const userManagementFeedback = document.getElementById('userManagementFeedback');
const editUserFeedback = document.getElementById('editUserFeedback');

const showRegisterViewLink = document.getElementById('showRegisterViewLink');
const showLoginViewLink = document.getElementById('showLoginViewLink');

const userViewBtn = document.getElementById('userViewBtn');
const myTripsViewBtn = document.getElementById('myTripsViewBtn');
const adminViewBtn = document.getElementById('adminViewBtn');
const userManagementViewBtn = document.getElementById('userManagementViewBtn');
const logoutBtn = document.getElementById('logoutBtn');

const userView = document.getElementById('userView');
const myTripsView = document.getElementById('myTripsView');
const adminView = document.getElementById('adminView');
const userManagementView = document.getElementById('userManagementView');

const tripIdToEditInput = document.getElementById('tripIdToEdit');
const tripDateInput = document.getElementById('tripDate');
const driverNameInput = document.getElementById('driverName');
const cargoTypeInput = document.getElementById('cargoType');
const kmInitialInput = document.getElementById('kmInitial');
const kmFinalInput = document.getElementById('kmFinal');
const weightInput = document.getElementById('weight');
const unitValueInput = document.getElementById('unitValue');
const freightValueInput = document.getElementById('freightValue');
const fuelEntriesContainer = document.getElementById('fuelEntriesContainer');
const addFuelEntryBtn = document.getElementById('addFuelEntryBtn');
const arla32CostInput = document.getElementById('arla32Cost');
const tollCostInput = document.getElementById('tollCost');
const commissionCostInput = document.getElementById('commissionCost');
const otherExpensesInput = document.getElementById('otherExpenses');
const expenseDescriptionInput = document.getElementById('expenseDescription');
const declaredValueInput = document.getElementById('declaredValue');
const submitTripBtn = document.getElementById('submitTripBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');

const driverSummaryContainer = document.getElementById('driverSummaryContainer');
const driverTotalTripsEl = document.getElementById('driverTotalTripsEl');
const driverTotalFreightParticipatedEl = document.getElementById('driverTotalFreightParticipatedEl');
const driverTotalEarningsEl = document.getElementById('driverTotalEarningsEl');
const myTripsDriverNameContainer = document.getElementById('myTripsDriverNameContainer');
const myTripsDriverNameInput = document.getElementById('myTripsDriverNameInput');
const loadMyTripsBtn = document.getElementById('loadMyTripsBtn');
const myTripsFilterControls = document.getElementById('myTripsFilterControls');
const myTripsFilterStartDateInput = document.getElementById('myTripsFilterStartDate');
const myTripsFilterEndDateInput = document.getElementById('myTripsFilterEndDate');
const applyMyTripsFilterBtn = document.getElementById('applyMyTripsFilterBtn');
const myTripsTable = document.getElementById('myTripsTable');
const myTripsTableBody = document.getElementById('myTripsTableBody');
const myTripsTablePlaceholder = document.getElementById('myTripsTablePlaceholder');

const adminSummaryContainer = document.getElementById('adminSummaryContainer');
const adminSummaryFilterStartDateInput = document.getElementById('adminSummaryFilterStartDate');
const adminSummaryFilterEndDateInput = document.getElementById('adminSummaryFilterEndDate');
const applyAdminSummaryFilterBtn = document.getElementById('applyAdminSummaryFilterBtn');
const adminTotalTripsEl = document.getElementById('adminTotalTripsEl');
const adminTotalFreightEl = document.getElementById('adminTotalFreightEl');
const adminTotalExpensesEl = document.getElementById('adminTotalExpensesEl');
const adminTotalNetProfitEl = document.getElementById('adminTotalNetProfitEl');
const adminSelectDriver = document.getElementById('adminSelectDriver');
const adminLoadDriverTripsBtn = document.getElementById('adminLoadDriverTripsBtn');
const adminDriverTripsSection = document.getElementById('adminDriverTripsSection');
const adminSelectedDriverNameDisplay = document.getElementById('adminSelectedDriverNameDisplay');
const adminDriverTripsTable = document.getElementById('adminDriverTripsTable');
const adminDriverTripsTableBody = document.getElementById('adminDriverTripsTableBody');
const adminDriverTripsPlaceholder = document.getElementById('adminDriverTripsPlaceholder');
const adminTripDetailModal = document.getElementById('adminTripDetailModal');
const closeAdminTripDetailModalBtn = document.getElementById('closeAdminTripDetailModalBtn');
const adminTripDetailContent = document.getElementById('adminTripDetailContent');

const userManagementTableBody = document.getElementById('userManagementTableBody');
const editUserModal = document.getElementById('editUserModal');
const closeEditUserModalBtn = document.getElementById('closeEditUserModalBtn');
const editUserForm = document.getElementById('editUserForm');
const editUserIdInput = document.getElementById('editUserId');
const editUsernameDisplayInput = document.getElementById('editUsernameDisplay');
const editUserRoleSelect = document.getElementById('editUserRole');
const editUserNewPasswordInput = document.getElementById('editUserNewPassword');
const editUserConfirmNewPasswordInput = document.getElementById('editUserConfirmNewPassword');

let fuelEntryIdCounter = 0;

// --- FUNÇÕES UTILITÁRIAS ---
function generateId() { // Para IDs de elementos HTML (ex: entradas de combustível) se necessário
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

function normalizeUsernameForEmail(username) {
    if (!username) return '';
    const normalized = username
        .normalize('NFD') // Decompõe caracteres acentuados (ex: "é" para "e" + "´")
        .replace(/[\\u0300-\\u036f]/g, '') // Remove os diacríticos (acentos)
        .toLowerCase()
        .trim() // Remove espaços no início e fim
        .replace(/\s+/g, '.') // Substitui um ou mais espaços por um único ponto
        .replace(/[^a-z0-9._-]/g, ''); // Remove caracteres não permitidos (permite letras, números, ., _, -)

    // Evitar múltiplos pontos consecutivos ou pontos no início/fim que podem ser problemáticos
    let cleaned = normalized.replace(/\.+/g, '.'); // Substitui múltiplos pontos por um único
    if (cleaned.startsWith('.')) cleaned = cleaned.substring(1);
    if (cleaned.endsWith('.')) cleaned = cleaned.slice(0, -1);

    // Garante que não está vazio após a limpeza
    if (!cleaned) {
        // Se após a limpeza o nome ficar vazio (ex: nome só com caracteres especiais),
        // gere um identificador aleatório para evitar um email inválido.
        // Ou, idealmente, valide o username antes de chegar aqui.
        return `user.${generateId()}`;
    }
    return cleaned;
}


function formatDate(dateInput) {
    if (!dateInput) return 'Data inválida';

    let dateToFormat;

    if (typeof dateInput === 'string') {
        // Manipula string YYYY-MM-DD.
        // Exemplo: "2023-10-26"
        // new Date("2023-10-26T00:00:00Z") é correto para interpretação UTC
        dateToFormat = new Date(dateInput + 'T00:00:00Z');
    } else if (dateInput instanceof Date) { // Verifica se já é um objeto Date
        dateToFormat = dateInput;
    } else if (dateInput && typeof dateInput.toDate === 'function') { // Duck-typing para Timestamp do Firestore
        dateToFormat = dateInput.toDate();
    } else {
        console.warn("Tipo de dateInput não suportado em formatDate:", dateInput, typeof dateInput);
        return 'Data inválida';
    }

    if (isNaN(dateToFormat.getTime())) {
        console.warn("A conversão da data resultou em NaN em formatDate. Entrada original:", dateInput);
        return 'Data inválida';
    }
    return dateToFormat.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}


function formatCurrency(value) {
    if (value === undefined || value === null || isNaN(value)) {
        return 'R$ 0,00';
    }
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function showFeedback(element, message, type) {
    if (!element) {
        console.warn("Elemento de feedback não encontrado para a mensagem:", message);
        return;
    }
    element.textContent = message;
    element.className = `feedback-message ${type}`;
    element.style.display = 'block';
    setTimeout(() => {
        if (element) { 
            element.style.display = 'none';
            element.textContent = '';
        }
    }, 5000);
}

// --- GERENCIAMENTO DE VISUALIZAÇÃO ---
function showView(viewId) {
    const views = document.querySelectorAll('.view');
    views.forEach(view => view.style.display = 'none');
    if (loginView) loginView.style.display = 'none';
    if (registerView) registerView.style.display = 'none';
    if (appContainer) appContainer.style.display = 'none';

    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => btn.setAttribute('aria-pressed', 'false'));

    if (viewId === 'loginView' && loginView) {
        loginView.style.display = 'flex';
    } else if (viewId === 'registerView' && registerView) {
        registerView.style.display = 'flex';
    } else if (appContainer) {
        appContainer.style.display = 'flex';
        const targetView = document.getElementById(viewId);
        if (targetView) {
            targetView.style.display = 'block';
            const activeNavButton = document.getElementById(viewId + 'Btn');
            if (activeNavButton) {
                activeNavButton.setAttribute('aria-pressed', 'true');
            }
        }
    }
    window.scrollTo(0,0);
}

function updateNavVisibility() {
    if (loggedInUser && loggedInUserProfile) {
        if(logoutBtn) logoutBtn.style.display = 'inline-block';
        if (loggedInUserProfile.role === 'admin') {
            if(userViewBtn) userViewBtn.style.display = 'inline-block';
            if(myTripsViewBtn) myTripsViewBtn.style.display = 'inline-block';
            if(adminViewBtn) adminViewBtn.style.display = 'inline-block';
            if (loggedInUserProfile.username.toLowerCase() === 'fabio' && userManagementViewBtn) {
                 userManagementViewBtn.style.display = 'inline-block';
            } else if (userManagementViewBtn) {
                userManagementViewBtn.style.display = 'none';
            }
        } else { // 'motorista'
            if(userViewBtn) userViewBtn.style.display = 'inline-block';
            if(myTripsViewBtn) myTripsViewBtn.style.display = 'inline-block';
            if(adminViewBtn) adminViewBtn.style.display = 'none';
            if(userManagementViewBtn) userManagementViewBtn.style.display = 'none';
        }
    } else {
        if(userViewBtn) userViewBtn.style.display = 'none';
        if(myTripsViewBtn) myTripsViewBtn.style.display = 'none';
        if(adminViewBtn) adminViewBtn.style.display = 'none';
        if(userManagementViewBtn) userManagementViewBtn.style.display = 'none';
        if(logoutBtn) logoutBtn.style.display = 'none';
    }
}

// --- AUTENTICAÇÃO COM FIREBASE ---
async function handleRegister(event) {
    event.preventDefault();
    console.log("Tentando realizar cadastro...");
    const usernameInput = document.getElementById('registerUsername');
    const passwordInput = document.getElementById('registerPassword');
    const confirmPasswordInput = document.getElementById('registerConfirmPassword');

    const rawUsername = usernameInput.value.trim();
    const normalizedUsernamePart = normalizeUsernameForEmail(rawUsername);

    if (!rawUsername) {
        showFeedback(registerFeedback, "Nome de usuário é obrigatório.", "error");
        return;
    }
    if (!normalizedUsernamePart) {
        showFeedback(registerFeedback, "Nome de usuário inválido após normalização (ex: contém apenas caracteres especiais). Por favor, use um nome de usuário com letras ou números.", "error");
        return;
    }

    const email = `${normalizedUsernamePart}@example.com`;
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    console.log("Detalhes do cadastro:", { rawUsername, normalizedUsernamePart, email });

    if (!password || !confirmPassword) {
        showFeedback(registerFeedback, "Todos os campos são obrigatórios.", "error");
        return;
    }
    if (password.length < 6) {
        showFeedback(registerFeedback, "A senha deve ter pelo menos 6 caracteres.", "error");
        return;
    }
    if (password !== confirmPassword) {
        showFeedback(registerFeedback, "As senhas não coincidem.", "error");
        return;
    }

    try {
        console.log("Chamando createUserWithEmailAndPassword com o email:", email);
        const userCredential = await createUserWithEmailAndPassword(authFirebase, email, password); // CORRIGIDO: authFirebase
        const firebaseUser = userCredential.user;
        console.log("Usuário criado na Autenticação:", firebaseUser.uid);

        let roleForNewUser = 'motorista';
        if (rawUsername.toLowerCase() === 'fabio') {
            roleForNewUser = 'admin';
            console.log(`Registrando usuário ${rawUsername} como ADMIN porque o nome de usuário é 'fabio'.`);
        }

        // Criar perfil do usuário no Firestore
        const newUserProfile = {
            uid: firebaseUser.uid,
            username: rawUsername, // Salvar o nome de usuário original para exibição
            email: firebaseUser.email || email, // Usar o email do Firebase Auth
            role: roleForNewUser,
            createdAt: Timestamp.now()
        };
        console.log("Criando perfil do usuário no Firestore:", newUserProfile);
        await firebaseSetDoc(doc(userProfilesCollection, firebaseUser.uid), newUserProfile);
        console.log("Perfil do usuário criado no Firestore.");


        showFeedback(registerFeedback, "Cadastro realizado com sucesso! Faça o login.", "success");
        if (registerForm) registerForm.reset();
        setTimeout(() => showView('loginView'), 1500);

    } catch (error) {
        console.error("ERRO CRÍTICO durante o cadastro:", "Código:", error.code, "Mensagem:", error.message);
        if (error.code === 'auth/email-already-in-use') {
            showFeedback(registerFeedback, "Nome de usuário (ou e-mail derivado) já existe. Tente outro.", "error");
        } else if (error.code === 'auth/weak-password') {
            showFeedback(registerFeedback, "Senha muito fraca. Tente uma mais forte.", "error");
        } else if (error.code === 'auth/invalid-email') {
            showFeedback(registerFeedback, `O nome de usuário "${rawUsername}" resultou em um formato de e-mail inválido ("${email}"). Tente um nome de usuário diferente, com menos caracteres especiais.`, "error");
        }
         else {
            showFeedback(registerFeedback, "Erro ao registrar. Verifique o console para detalhes.", "error");
        }
    }
}

async function handleLogin(event) {
    event.preventDefault();
    console.log("Função handleLogin iniciada.");
    const usernameInput = document.getElementById('loginUsername');
    const passwordInput = document.getElementById('loginPassword');

    const rawUsername = usernameInput.value.trim();
    const normalizedUsernamePart = normalizeUsernameForEmail(rawUsername);

    if (!rawUsername) {
        showFeedback(loginFeedback, "Nome de usuário é obrigatório.", "error");
        console.log("Login abortado: nome de usuário vazio.");
        return;
    }
     if (!normalizedUsernamePart) {
        showFeedback(loginFeedback, `Nome de usuário "${rawUsername}" inválido. Use um nome com letras ou números.`, "error");
        console.log("Login abortado: parte normalizada do nome de usuário está vazia.");
        return;
    }

    const email = `${normalizedUsernamePart}@example.com`;
    const password = passwordInput.value;
    console.log("Tentando login com:", { rawUsername, normalizedUsernamePart, email });

    if (!password) { // username já foi verificado
        showFeedback(loginFeedback, "Senha é obrigatória.", "error");
        console.log("Login abortado: senha vazia.");
        return;
    }

    try {
        console.log("Chamando signInWithEmailAndPassword com o email:", email);
        await signInWithEmailAndPassword(authFirebase, email, password); // CORRIGIDO: authFirebase
        console.log("signInWithEmailAndPassword bem-sucedido (ou pelo menos não lançou erro imediatamente). Aguardando onAuthStateChanged.");
        showFeedback(loginFeedback, "Login bem-sucedido! Redirecionando...", "success");
        if (loginForm) loginForm.reset();
        // onAuthStateChanged irá lidar com a atualização da UI e do estado loggedInUser/loggedInUserProfile
    } catch (error) {
        console.error("ERRO CRÍTICO durante o login:", "Código:", error.code, "Mensagem:", error.message);
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            showFeedback(loginFeedback, "Nome de usuário ou senha incorretos.", "error");
        } else if (error.code === 'auth/invalid-email') {
             showFeedback(loginFeedback, `O nome de usuário "${rawUsername}" resultou em um formato de e-mail inválido ("${email}") para o login. Verifique se digitou corretamente.`, "error");
        }
        else {
            showFeedback(loginFeedback, "Erro ao tentar fazer login. Verifique o console para detalhes.", "error");
        }
    }
     console.log("Função handleLogin finalizada.");
}

async function handleLogout() {
    console.log("Tentando logout...");
    try {
        await signOut(authFirebase); // CORRIGIDO: authFirebase
        console.log("Usuário desconectado do Firebase Auth.");
        // onAuthStateChanged irá limpar loggedInUser e loggedInUserProfile e redirecionar
        showFeedback(loginFeedback, "Você foi desconectado.", "info");
        // Limpeza adicional da UI pode ser feita aqui ou em onAuthStateChanged
        if(myTripsTableBody) myTripsTableBody.innerHTML = '';
        if(myTripsTablePlaceholder) myTripsTablePlaceholder.textContent = 'Nenhuma viagem para exibir...';
        if(adminDriverTripsTableBody) adminDriverTripsTableBody.innerHTML = '';
        if(adminDriverTripsPlaceholder) adminDriverTripsPlaceholder.textContent = 'Nenhuma viagem encontrada para este motorista.';
        if(adminSelectDriver) adminSelectDriver.innerHTML = '<option value="">-- Selecione um Motorista --</option>';
        if(userManagementTableBody) userManagementTableBody.innerHTML = '';
        currentUserForMyTripsSearch = null;
        currentUidForMyTripsSearch = null;
        adminSelectedDriverName = null;
        adminSelectedDriverUid = null;
        editingTripId = null;
        editingUserIdForAdmin = null;
        if (tripForm) tripForm.reset();
        if (fuelEntriesContainer) fuelEntriesContainer.innerHTML = '';
        fuelEntryIdCounter = 0;
    } catch (error) {
        console.error("ERRO CRÍTICO durante o logout:", "Código:", error.code, "Mensagem:", error.message);
        showFeedback(loginFeedback, "Erro ao sair. Tente novamente.", "error");
    }
}

// Listener de estado de autenticação está agora dentro do try/catch da inicialização do Firebase


// --- GERENCIAMENTO DE VIAGENS COM FIRESTORE ---

function addFuelEntryToForm(entry) {
    const entryId = entry ? entry.id : `fuel_${fuelEntryIdCounter++}`;
    const fuelDiv = document.createElement('div');
    fuelDiv.className = 'fuel-entry-item';
    fuelDiv.id = entryId; // ID do elemento HTML
    fuelDiv.innerHTML = `
        <input type="hidden" name="fuelEntryId" value="${entryId}">
        <div class="form-group">
            <label for="liters_${entryId}">Litros:</label>
            <input type="number" id="liters_${entryId}" name="liters" min="0" step="any" placeholder="0" value="${entry?.liters || ''}" required>
        </div>
        <div class="form-group">
            <label for="valuePerLiter_${entryId}">Valor/Litro (R$):</label>
            <input type="number" id="valuePerLiter_${entryId}" name="valuePerLiter" min="0" step="0.01" placeholder="0,00" value="${entry?.valuePerLiter || ''}" required>
        </div>
        <div class="form-group">
            <label for="discount_${entryId}">Desconto (R$):</label>
            <input type="number" id="discount_${entryId}" name="discount" min="0" step="0.01" placeholder="0,00" value="${entry?.discount || '0'}">
        </div>
        <div class="form-group">
            <label for="totalValue_${entryId}">Valor Total (R$):</label>
            <input type="number" id="totalValue_${entryId}" name="totalValue" min="0" step="0.01" placeholder="0,00" value="${entry?.totalValue || ''}" required readonly>
        </div>
        <button type="button" class="control-btn danger-btn small-btn remove-fuel-entry-btn" data-entry-id="${entryId}" aria-label="Remover este abastecimento">Remover</button>
    `;
    if (fuelEntriesContainer) fuelEntriesContainer.appendChild(fuelDiv);

    const litersInput = document.getElementById(`liters_${entryId}`);
    const valuePerLiterInput = document.getElementById(`valuePerLiter_${entryId}`);
    const discountInput = document.getElementById(`discount_${entryId}`);
    const totalValueInput = document.getElementById(`totalValue_${entryId}`);

    function calculateTotalFuelValue() {
        const liters = parseFloat(litersInput.value) || 0;
        const valuePerLiter = parseFloat(valuePerLiterInput.value) || 0;
        const discount = parseFloat(discountInput.value) || 0;
        const total = (liters * valuePerLiter) - discount;
        totalValueInput.value = total.toFixed(2);
    }

    if (litersInput) litersInput.addEventListener('input', calculateTotalFuelValue);
    if (valuePerLiterInput) valuePerLiterInput.addEventListener('input', calculateTotalFuelValue);
    if (discountInput) discountInput.addEventListener('input', calculateTotalFuelValue);

    fuelDiv.querySelector('.remove-fuel-entry-btn')?.addEventListener('click', (e) => {
        const targetButton = e.target;
        const idToRemove = targetButton.dataset.entryId;
        const entryElementToRemove = document.getElementById(idToRemove);
        if (entryElementToRemove) {
            entryElementToRemove.remove();
        }
    });
    if(entry) calculateTotalFuelValue(); // Calcular se preenchendo
}

async function handleTripFormSubmit(event) {
    event.preventDefault();
    if (!loggedInUser || !loggedInUserProfile) {
        showFeedback(userFormFeedback, "Você precisa estar logado para registrar uma viagem.", "error");
        return;
    }

    const formData = new FormData(tripForm);
    const fuelEntriesFromForm = [];
    const fuelEntryElements = fuelEntriesContainer.querySelectorAll('.fuel-entry-item');
    let totalFuelCostCalculated = 0;

    fuelEntryElements.forEach(entryEl => {
        const entryId = entryEl.id; // ID do elemento HTML
        const liters = parseFloat(entryEl.querySelector(`input[name="liters"]`).value) || 0;
        const valuePerLiter = parseFloat(entryEl.querySelector(`input[name="valuePerLiter"]`).value) || 0;
        const discount = parseFloat(entryEl.querySelector(`input[name="discount"]`).value) || 0;
        const totalValue = (liters * valuePerLiter) - discount;

        if (liters > 0 && valuePerLiter > 0) { // Apenas adicionar entradas válidas
            fuelEntriesFromForm.push({
                id: entryId, 
                liters,
                valuePerLiter,
                discount,
                totalValue
            });
            totalFuelCostCalculated += totalValue;
        }
    });

    const kmInitialVal = parseFloat(formData.get('kmInitial')) || 0;
    const kmFinalVal = parseFloat(formData.get('kmFinal')) || 0;
    const kmDrivenVal = (kmFinalVal > kmInitialVal) ? kmFinalVal - kmInitialVal : 0;

    const arla32CostVal = parseFloat(formData.get('arla32Cost')) || 0;
    const tollCostVal = parseFloat(formData.get('tollCost')) || 0;
    const commissionCostVal = parseFloat(formData.get('commissionCost')) || 0;
    const otherExpensesVal = parseFloat(formData.get('otherExpenses')) || 0;

    const totalExpensesCalculated = totalFuelCostCalculated + arla32CostVal + tollCostVal + otherExpensesVal + commissionCostVal;
    const freightValueVal = parseFloat(formData.get('freightValue')) || 0;
    const netProfitVal = freightValueVal - totalExpensesCalculated;

    const tripDataObjectFromForm = {
        userId: loggedInUser.uid,
        driverName: (formData.get('driverName')).trim() || loggedInUserProfile.username,
        date: formData.get('tripDate'),
        cargoType: formData.get('cargoType') || '',
        kmInitial: kmInitialVal,
        kmFinal: kmFinalVal,
        kmDriven: kmDrivenVal,
        weight: parseFloat(formData.get('weight')) || 0,
        unitValue: parseFloat(formData.get('unitValue')) || 0,
        freightValue: freightValueVal,
        fuelEntries: fuelEntriesFromForm,
        arla32Cost: arla32CostVal,
        tollCost: tollCostVal,
        commissionCost: commissionCostVal,
        otherExpenses: otherExpensesVal,
        expenseDescription: formData.get('expenseDescription') || '',
        totalFuelCost: totalFuelCostCalculated,
        totalExpenses: totalExpensesCalculated,
        netProfit: netProfitVal,
        declaredValue: parseFloat(formData.get('declaredValue')) || 0,
    };

    try {
        if (submitTripBtn) {
            submitTripBtn.disabled = true;
            submitTripBtn.textContent = 'Salvando...';
        }

        if (editingTripId) {
            const tripRef = doc(tripsCollection, editingTripId);
            const updatePayload = { ...tripDataObjectFromForm };
            // Se você adicionar um campo 'updatedAt' à interface Trip, defina-o aqui:
            // updatePayload.updatedAt = Timestamp.now();
            
            await updateDoc(tripRef, updatePayload);
            showFeedback(userFormFeedback, "Viagem atualizada com sucesso!", "success");
        } else {
            const createPayload = {
                ...tripDataObjectFromForm,
                createdAt: Timestamp.now()
            };
            await addDoc(tripsCollection, createPayload);
            showFeedback(userFormFeedback, "Viagem registrada com sucesso!", "success");
        }
        if(tripForm) tripForm.reset();
        if(fuelEntriesContainer) fuelEntriesContainer.innerHTML = '';
        fuelEntryIdCounter = 0;
        editingTripId = null;
        if(tripIdToEditInput) tripIdToEditInput.value = '';
        if (driverNameInput && loggedInUserProfile) driverNameInput.value = loggedInUserProfile.username;
        if (submitTripBtn) submitTripBtn.textContent = 'Salvar Viagem';
        if (cancelEditBtn) cancelEditBtn.style.display = 'none';

        if (myTripsView && myTripsView.style.display === 'block' && (!currentUserForMyTripsSearch || currentUserForMyTripsSearch === loggedInUserProfile.username)) {
            loadAndRenderMyTrips();
        }
        if (adminView && adminView.style.display === 'block') {
            updateAdminSummary();
            if (adminSelectedDriverUid === loggedInUser.uid) { 
                loadAndRenderAdminDriverTrips(adminSelectedDriverUid, loggedInUserProfile.username);
            }
        }

    } catch (error) {
        console.error("Erro ao salvar viagem no Firestore:", "Código:", error.code, "Mensagem:", error.message);
        showFeedback(userFormFeedback, "Erro ao salvar viagem. Tente novamente.", "error");
        if (submitTripBtn) submitTripBtn.textContent = editingTripId ? 'Salvar Alterações' : 'Salvar Viagem';
    } finally {
        if (submitTripBtn) submitTripBtn.disabled = false;
    }
}

async function loadAndRenderMyTrips(filterStartDate, filterEndDate) {
    if (!loggedInUserProfile) {
        if (myTripsTablePlaceholder) myTripsTablePlaceholder.textContent = 'Você precisa estar logado para ver suas viagens.';
        if (myTripsTable) myTripsTable.style.display = 'none';
        if (myTripsTablePlaceholder) myTripsTablePlaceholder.style.display = 'block';
        return;
    }

    let targetUid = loggedInUser.uid; 
    let targetUsername = loggedInUserProfile.username;

    if (loggedInUserProfile.role === 'admin' && currentUidForMyTripsSearch && currentUserForMyTripsSearch) {
        targetUid = currentUidForMyTripsSearch;
        targetUsername = currentUserForMyTripsSearch;
    }

    if (myTripsTablePlaceholder) myTripsTablePlaceholder.textContent = `Carregando viagens de ${targetUsername}...`;
    if (myTripsTable) myTripsTable.style.display = 'none';
    if (myTripsTablePlaceholder) myTripsTablePlaceholder.style.display = 'block';
    if (myTripsTableBody) myTripsTableBody.innerHTML = '';

    try {
        let q = query(tripsCollection, where("userId", "==", targetUid), orderBy("date", "desc"));

        if (filterStartDate) {
            q = query(q, where("date", ">=", filterStartDate));
        }
        if (filterEndDate) {
            q = query(q, where("date", "<=", filterEndDate));
        }


        const querySnapshot = await getDocs(q);
        const fetchedTrips = [];
        querySnapshot.forEach((doc) => {
            fetchedTrips.push({ id: doc.id, ...doc.data() });
        });

        trips = fetchedTrips; 

        if (trips.length === 0) {
            if (myTripsTablePlaceholder) myTripsTablePlaceholder.textContent = `Nenhuma viagem encontrada para ${targetUsername}` +
                `${(filterStartDate || filterEndDate) ? ' nos filtros aplicados.' : '.'}`;
        } else {
            if (myTripsTable) myTripsTable.style.display = 'table';
            if (myTripsTablePlaceholder) myTripsTablePlaceholder.style.display = 'none';
            renderMyTripsTable(trips);
        }
        updateDriverSummary(trips, targetUsername); 

    } catch (error) {
        console.error(`Erro ao carregar viagens de ${targetUsername} do Firestore:`, "Código:", error.code, "Mensagem:", error.message);
        showFeedback(myTripsFeedback, `Erro ao carregar viagens de ${targetUsername}.`, "error");
        if (myTripsTablePlaceholder) myTripsTablePlaceholder.textContent = `Erro ao carregar viagens de ${targetUsername}.`;
    }
}

function renderMyTripsTable(tripsToRender) {
    if (!myTripsTableBody) return;
    myTripsTableBody.innerHTML = '';
    if (tripsToRender.length === 0) {
        if (myTripsTable) myTripsTable.style.display = 'none';
        if (myTripsTablePlaceholder) {
             myTripsTablePlaceholder.style.display = 'block';
             myTripsTablePlaceholder.textContent = 'Nenhuma viagem para exibir com os filtros atuais.';
        }
        return;
    }

    if (myTripsTable) myTripsTable.style.display = 'table';
    if (myTripsTablePlaceholder) myTripsTablePlaceholder.style.display = 'none';

    tripsToRender.forEach(trip => {
        const row = myTripsTableBody.insertRow();
        row.insertCell().textContent = formatDate(trip.date);
        row.insertCell().textContent = trip.cargoType || 'N/A';
        row.insertCell().textContent = formatCurrency(trip.freightValue);
        row.insertCell().textContent = formatCurrency(trip.totalExpenses);
        row.insertCell().textContent = formatCurrency(trip.commissionCost); 

        const actionsCell = row.insertCell();
        const editButton = document.createElement('button');
        editButton.className = 'control-btn small-btn';
        editButton.textContent = 'Editar';
        editButton.setAttribute('aria-label', `Editar viagem de ${formatDate(trip.date)}`);
        editButton.onclick = () => loadTripForEditing(trip.id);
        actionsCell.appendChild(editButton);

        let canDelete = false;
        if (loggedInUserProfile && loggedInUser && trip.userId === loggedInUser.uid) { 
            canDelete = true;
        }
        if (loggedInUserProfile && loggedInUserProfile.role === 'admin' && loggedInUserProfile.username.toLowerCase() === 'fabio') {
            canDelete = true;
        }


        if (canDelete) {
            const deleteButton = document.createElement('button');
            deleteButton.className = 'control-btn danger-btn small-btn';
            deleteButton.textContent = 'Excluir';
            deleteButton.setAttribute('aria-label', `Excluir viagem de ${formatDate(trip.date)}`);
            deleteButton.style.marginLeft = '0.5rem';
            deleteButton.onclick = () => confirmDeleteTrip(trip.id, trip.driverName);
            actionsCell.appendChild(deleteButton);
        }
    });
}

async function loadTripForEditing(tripId) {
    try {
        const tripDocRef = doc(tripsCollection, tripId);
        const tripDoc = await getDoc(tripDocRef);
        if (tripDoc.exists()) {
            const trip = { id: tripDoc.id, ...tripDoc.data() };

            if (loggedInUser.uid !== trip.userId && loggedInUserProfile?.role !== 'admin') {
                showFeedback(userFormFeedback, "Você não tem permissão para editar esta viagem.", "error");
                return;
            }

            if (tripForm) tripForm.reset(); 
            if (fuelEntriesContainer) fuelEntriesContainer.innerHTML = ''; 

            if (tripIdToEditInput) tripIdToEditInput.value = trip.id;
            editingTripId = trip.id;
            if(driverNameInput) driverNameInput.value = trip.driverName; 
            if(tripDateInput) tripDateInput.value = trip.date; 
            if(cargoTypeInput) cargoTypeInput.value = trip.cargoType || '';
            if(kmInitialInput) kmInitialInput.value = trip.kmInitial?.toString() || '';
            if(kmFinalInput) kmFinalInput.value = trip.kmFinal?.toString() || '';
            if(weightInput) weightInput.value = trip.weight?.toString() || '';
            if(unitValueInput) unitValueInput.value = trip.unitValue?.toString() || '';
            if(freightValueInput) freightValueInput.value = trip.freightValue.toString();

            trip.fuelEntries.forEach(entry => addFuelEntryToForm(entry));

            if(arla32CostInput) arla32CostInput.value = trip.arla32Cost?.toString() || '';
            if(tollCostInput) tollCostInput.value = trip.tollCost.toString();
            if(commissionCostInput) commissionCostInput.value = trip.commissionCost?.toString() || '';
            if(otherExpensesInput) otherExpensesInput.value = trip.otherExpenses.toString();
            if(expenseDescriptionInput) expenseDescriptionInput.value = trip.expenseDescription || '';
            if(declaredValueInput) declaredValueInput.value = trip.declaredValue?.toString() || '';


            if (submitTripBtn) submitTripBtn.textContent = 'Salvar Alterações';
            if (cancelEditBtn) cancelEditBtn.style.display = 'inline-block';
            showView('userView'); 
            if (userView) userView.scrollIntoView({ behavior: 'smooth' });
            showFeedback(userFormFeedback, `Editando viagem de ${trip.driverName} do dia ${formatDate(trip.date)}.`, "info");

        } else {
            showFeedback(myTripsFeedback, "Viagem não encontrada para edição.", "error");
        }
    } catch (error) {
        console.error("Erro ao carregar viagem para edição:", "Código:", error.code, "Mensagem:", error.message);
        showFeedback(myTripsFeedback, "Erro ao carregar viagem para edição.", "error");
    }
}


function confirmDeleteTrip(tripId, driverNameForConfirm) {
    if (!tripId) return;

    const tripToDelete = trips.find(t => t.id === tripId) || 
                        (adminView && adminView.style.display === 'block' ? trips.find(t=>t.id === tripId) : null); 

    if (tripToDelete) {
         if (loggedInUser.uid !== tripToDelete.userId &&
            !(loggedInUserProfile?.role === 'admin' && loggedInUserProfile.username.toLowerCase() === 'fabio')) {
            showFeedback(myTripsFeedback, "Você não tem permissão para excluir esta viagem.", "error");
            return;
        }
    } else if (loggedInUserProfile?.role !== 'admin' || loggedInUserProfile.username.toLowerCase() !== 'fabio') {
        showFeedback(myTripsFeedback, "Viagem não encontrada ou permissão negada.", "error");
        return;
    }


    if (confirm(`Tem certeza que deseja excluir a viagem de ${driverNameForConfirm}? Esta ação não pode ser desfeita.`)) {
        deleteTrip(tripId);
    }
}

async function deleteTrip(tripId) {
    try {
        await deleteDoc(doc(tripsCollection, tripId));
        showFeedback(myTripsFeedback, "Viagem excluída com sucesso.", "success");
        if (myTripsView && myTripsView.style.display === 'block') {
            loadAndRenderMyTrips(myTripsFilterStartDateInput?.value, myTripsFilterEndDateInput?.value);
        }
        if (adminView && adminView.style.display === 'block' && adminSelectedDriverUid) {
            loadAndRenderAdminDriverTrips(adminSelectedDriverUid, adminSelectedDriverName);
            updateAdminSummary(); 
        } else if (adminView && adminView.style.display === 'block') {
            updateAdminSummary(); 
        }

    } catch (error) {
        console.error("Erro ao excluir viagem do Firestore:", "Código:", error.code, "Mensagem:", error.message);
        showFeedback(myTripsFeedback, "Erro ao excluir viagem. Tente novamente.", "error");
    }
}

function updateDriverSummary(summaryTrips, driverDisplayName) {
    let totalTrips = summaryTrips.length;
    let totalFreight = 0;
    let totalEarnings = 0; 

    summaryTrips.forEach(trip => {
        totalFreight += trip.freightValue;
        totalEarnings += trip.commissionCost || 0;
    });

    if (driverTotalTripsEl) driverTotalTripsEl.textContent = totalTrips.toString();
    if (driverTotalFreightParticipatedEl) driverTotalFreightParticipatedEl.textContent = formatCurrency(totalFreight);
    if (driverTotalEarningsEl) driverTotalEarningsEl.textContent = formatCurrency(totalEarnings);

    if (driverSummaryContainer){
        const summaryTitle = driverSummaryContainer.querySelector('h3');
        if (summaryTitle) {
            if (loggedInUserProfile?.role === 'admin' && currentUserForMyTripsSearch && currentUserForMyTripsSearch !== loggedInUserProfile.username) {
                summaryTitle.textContent = `Resumo de ${driverDisplayName}`;
            } else {
                summaryTitle.textContent = `Seu Resumo de Viagens`;
            }
        }
    }
}


// --- FUNÇÕES DO PAINEL ADMIN ---
async function updateAdminSummary(filterStartDate, filterEndDate) {
    if (!adminTotalTripsEl || !adminTotalFreightEl || !adminTotalExpensesEl || !adminTotalNetProfitEl) return;

    let q = query(tripsCollection, orderBy("date", "desc"));

    if (filterStartDate) q = query(q, where("date", ">=", filterStartDate));
    if (filterEndDate) q = query(q, where("date", "<=", filterEndDate));

    try {
        const querySnapshot = await getDocs(q);
        let totalTrips = 0;
        let totalFreight = 0;
        let totalExpensesOverall = 0; 
        let totalNetProfitOverall = 0; 

        querySnapshot.forEach((doc) => {
            const trip = doc.data(); 
            totalTrips++;
            totalFreight += trip.freightValue;
            totalExpensesOverall += trip.totalExpenses;
            totalNetProfitOverall += trip.netProfit;
        });

        adminTotalTripsEl.textContent = totalTrips.toString();
        adminTotalFreightEl.textContent = formatCurrency(totalFreight);
        adminTotalExpensesEl.textContent = formatCurrency(totalExpensesOverall);
        adminTotalNetProfitEl.textContent = formatCurrency(totalNetProfitOverall);

    } catch (error) {
        console.error("Erro ao atualizar resumo do administrador:", "Código:", error.code, "Mensagem:", error.message);
        showFeedback(adminGeneralFeedback, "Erro ao atualizar resumo do administrador.", "error");
    }
}

async function populateAdminDriverSelect() {
    if (!adminSelectDriver) return;
    adminSelectDriver.innerHTML = '<option value="">-- Carregando Motoristas --</option>';
    try {
        const q = query(userProfilesCollection, where("role", "==", "motorista"), orderBy("username"));
        const querySnapshot = await getDocs(q);
        const options = ['<option value="">-- Selecione um Motorista --</option>'];
        querySnapshot.forEach((doc) => {
            const user = doc.data(); 
            options.push(`<option value="${user.uid}">${user.username}</option>`);
        });
        adminSelectDriver.innerHTML = options.join('');
    } catch (error) {
        console.error("Erro ao popular select de motoristas do admin:", "Código:", error.code, "Mensagem:", error.message);
        adminSelectDriver.innerHTML = '<option value="">-- Erro ao carregar --</option>';
    }
}

async function loadAndRenderAdminDriverTrips(driverUid, driverName) {
    if (!driverUid) {
        if (adminDriverTripsSection) adminDriverTripsSection.style.display = 'none';
        return;
    }
    adminSelectedDriverUid = driverUid;
    adminSelectedDriverName = driverName;

    if (adminSelectedDriverNameDisplay) adminSelectedDriverNameDisplay.textContent = `Viagens de ${driverName}`;
    if (adminDriverTripsTableBody) adminDriverTripsTableBody.innerHTML = '';
    if (adminDriverTripsPlaceholder) adminDriverTripsPlaceholder.textContent = `Carregando viagens de ${driverName}...`;
    if (adminDriverTripsTable) adminDriverTripsTable.style.display = 'none';
    if (adminDriverTripsPlaceholder) adminDriverTripsPlaceholder.style.display = 'block';
    if (adminDriverTripsSection) adminDriverTripsSection.style.display = 'block';

    try {
        const q = query(tripsCollection, where("userId", "==", driverUid), orderBy("date", "desc"));
        const querySnapshot = await getDocs(q);
        const driverTrips = [];
        querySnapshot.forEach((doc) => {
            driverTrips.push({ id: doc.id, ...doc.data() });
        });

        trips = driverTrips; 

        if (driverTrips.length === 0) {
            if (adminDriverTripsPlaceholder) adminDriverTripsPlaceholder.textContent = `Nenhuma viagem encontrada para ${driverName}.`;
        } else {
            if (adminDriverTripsTable) adminDriverTripsTable.style.display = 'table';
            if (adminDriverTripsPlaceholder) adminDriverTripsPlaceholder.style.display = 'none';
        }
        renderAdminDriverTripsTable(driverTrips);

    } catch (error) {
        console.error(`Erro ao carregar viagens para o motorista ${driverName} (UID: ${driverUid}):`, "Código:", error.code, "Mensagem:", error.message);
        showFeedback(adminGeneralFeedback, `Erro ao carregar viagens de ${driverName}.`, "error");
        if (adminDriverTripsPlaceholder) adminDriverTripsPlaceholder.textContent = `Erro ao carregar viagens de ${driverName}.`;
    }
}

function renderAdminDriverTripsTable(driverTripsToRender) {
    if (!adminDriverTripsTableBody) return;
    adminDriverTripsTableBody.innerHTML = '';
    driverTripsToRender.forEach(trip => {
        const row = adminDriverTripsTableBody.insertRow();
        row.insertCell().textContent = formatDate(trip.date);
        row.insertCell().textContent = trip.cargoType || 'N/A';
        row.insertCell().textContent = formatCurrency(trip.netProfit);

        const actionsCell = row.insertCell();
        const viewButton = document.createElement('button');
        viewButton.className = 'control-btn small-btn';
        viewButton.textContent = 'Ver Detalhes';
        viewButton.setAttribute('aria-label', `Ver detalhes da viagem de ${formatDate(trip.date)}`);
        viewButton.onclick = () => showAdminTripDetailModal(trip);
        actionsCell.appendChild(viewButton);
    });
}

function showAdminTripDetailModal(trip) {
    if (!adminTripDetailContent || !adminTripDetailModal) return;
    let fuelDetailsHtml = '<h4>Abastecimentos</h4>';
    if (trip.fuelEntries && trip.fuelEntries.length > 0) {
        trip.fuelEntries.forEach(entry => {
            fuelDetailsHtml += `
                <div class="fuel-entry-detail-item">
                    <p><strong>Litros:</strong> ${entry.liters.toFixed(2)}</p>
                    <p><strong>Valor/Litro:</strong> ${formatCurrency(entry.valuePerLiter)}</p>
                    <p><strong>Desconto:</strong> ${formatCurrency(entry.discount)}</p>
                    <p><strong>Total Abastecimento:</strong> ${formatCurrency(entry.totalValue)}</p>
                </div>`;
        });
    } else {
        fuelDetailsHtml += '<p>Nenhum abastecimento registrado.</p>';
    }

    adminTripDetailContent.innerHTML = `
        <div class="trip-detail-section">
            <h4>Informações Gerais</h4>
            <p><strong>Motorista:</strong> ${trip.driverName}</p>
            <p><strong>Data:</strong> ${formatDate(trip.date)}</p>
            <p><strong>Tipo de Carga:</strong> ${trip.cargoType || 'N/A'}</p>
            <p><strong>Km Inicial:</strong> ${trip.kmInitial || 'N/A'}</p>
            <p><strong>Km Final:</strong> ${trip.kmFinal || 'N/A'}</p>
            <p><strong>Km Rodados:</strong> ${trip.kmDriven || 'N/A'}</p>
            <p><strong>Peso (Kg):</strong> ${trip.weight || 'N/A'}</p>
            <p><strong>Valor Unidade:</strong> ${formatCurrency(trip.unitValue)}</p>
        </div>
        <div class="trip-detail-section">
            ${fuelDetailsHtml}
        </div>
        <div class="trip-detail-section">
            <h4>Outras Despesas</h4>
            <p><strong>Arla-32:</strong> ${formatCurrency(trip.arla32Cost)}</p>
            <p><strong>Pedágio:</strong> ${formatCurrency(trip.tollCost)}</p>
            <p><strong>Comissão (Motorista):</strong> ${formatCurrency(trip.commissionCost)}</p>
            <p><strong>Outras Despesas Adicionais:</strong> ${formatCurrency(trip.otherExpenses)}</p>
            <p><strong>Descrição (Outras Despesas):</strong> ${trip.expenseDescription || 'Nenhuma'}</p>
        </div>
        <div class="trip-detail-section trip-financial-summary">
            <h4>Resumo Financeiro da Viagem</h4>
            <p><strong>Valor do Frete:</strong> ${formatCurrency(trip.freightValue)}</p>
            <p><strong>Total de Combustível:</strong> ${formatCurrency(trip.totalFuelCost)}</p>
            <p><strong>Despesas Totais:</strong> ${formatCurrency(trip.totalExpenses)}</p>
            <p><strong>Lucro Líquido da Viagem:</strong> <strong class="${trip.netProfit >= 0 ? 'profit' : 'loss'}">${formatCurrency(trip.netProfit)}</strong></p>
            <p><strong>Valor Declarado (Manual):</strong> ${formatCurrency(trip.declaredValue)}</p>
        </div>
    `;
    adminTripDetailModal.style.display = 'flex';
}

// --- FUNÇÕES DE GERENCIAMENTO DE USUÁRIOS (Admin Fabio) ---
async function loadAndRenderUsersForAdmin() {
    if (!userManagementTableBody) return;
    if (!loggedInUserProfile || loggedInUserProfile.role !== 'admin' || loggedInUserProfile.username.toLowerCase() !== 'fabio') {
        userManagementTableBody.innerHTML = '<tr><td colspan="3">Acesso negado.</td></tr>';
        return;
    }

    userManagementTableBody.innerHTML = '<tr><td colspan="3">Carregando usuários...</td></tr>';
    try {
        const q = query(userProfilesCollection, orderBy("username"));
        const querySnapshot = await getDocs(q);
        userProfiles = []; 
        querySnapshot.forEach((doc) => {
            userProfiles.push({ id: doc.id, ...doc.data() });
        });

        renderUserManagementTable(userProfiles);
    } catch (error) {
        console.error("Erro ao carregar usuários para admin:", "Código:", error.code, "Mensagem:", error.message);
        showFeedback(userManagementFeedback, "Erro ao carregar lista de usuários.", "error");
        userManagementTableBody.innerHTML = '<tr><td colspan="3">Erro ao carregar usuários.</td></tr>';
    }
}

function renderUserManagementTable(usersToRender) {
    if (!userManagementTableBody) return;
    userManagementTableBody.innerHTML = '';
    if (usersToRender.length === 0) {
        userManagementTableBody.innerHTML = '<tr><td colspan="3">Nenhum usuário cadastrado.</td></tr>';
        return;
    }
    usersToRender.forEach(userProf => {
        const row = userManagementTableBody.insertRow();
        row.insertCell().textContent = userProf.username;
        row.insertCell().textContent = userProf.role === 'admin' ? 'Administrador' : 'Motorista';

        const actionsCell = row.insertCell();
        const editButton = document.createElement('button');
        editButton.className = 'control-btn small-btn';
        editButton.textContent = 'Editar Papel';
        editButton.setAttribute('aria-label', `Editar papel do usuário ${userProf.username}`);
        editButton.onclick = () => openEditUserModal(userProf);
        actionsCell.appendChild(editButton);
    });
}

function openEditUserModal(userProf) {
    if (!editUserIdInput || !editUsernameDisplayInput || !editUserRoleSelect || !editUserNewPasswordInput || !editUserConfirmNewPasswordInput || !editUserModal) return;

    editingUserIdForAdmin = userProf.uid; 
    editUserIdInput.value = userProf.uid; 
    editUsernameDisplayInput.value = userProf.username;
    editUserRoleSelect.value = userProf.role;
    editUserNewPasswordInput.value = ''; 
    editUserConfirmNewPasswordInput.value = '';
    editUsernameDisplayInput.value = userProf.username; 
    editUserRoleSelect.value = userProf.role; 
    editUserModal.style.display = 'flex';
    showFeedback(editUserFeedback, "", "info"); 
}

async function handleEditUserFormSubmit(event) {
    event.preventDefault();
    if (!editingUserIdForAdmin || !editUserRoleSelect || !editUserNewPasswordInput || !editUserConfirmNewPasswordInput) return;

    const newRole = editUserRoleSelect.value;
    const newPassword = editUserNewPasswordInput.value;
    const confirmNewPassword = editUserConfirmNewPasswordInput.value;

    if (newPassword && newPassword.length < 6) {
        showFeedback(editUserFeedback, "Nova senha deve ter pelo menos 6 caracteres.", "error");
        return;
    }
    if (newPassword && newPassword !== confirmNewPassword) {
        showFeedback(editUserFeedback, "As novas senhas não coincidem.", "error");
        return;
    }

    try {
        const userProfileRef = doc(userProfilesCollection, editingUserIdForAdmin);
        await updateDoc(userProfileRef, { role: newRole }); 

        if (newPassword) {
            showFeedback(editUserFeedback, "Papel do usuário atualizado. A alteração de senha por esta tela não é suportada. Use o console do Firebase ou peça ao usuário para redefinir.", "info");
        } else {
            showFeedback(editUserFeedback, "Papel do usuário atualizado com sucesso!", "success");
        }

        loadAndRenderUsersForAdmin(); 
        setTimeout(() => {
            if (closeEditUserModalBtn) closeEditUserModalBtn.click();
        }, 1500);

    } catch (error) {
        console.error("Erro ao atualizar papel/senha do usuário:", "Código:", error.code, "Mensagem:", error.message);
        showFeedback(editUserFeedback, "Erro ao atualizar usuário. Tente novamente.", "error");
    }
}


// --- FUNÇÕES DE INICIALIZAÇÃO PARA VISUALIZAÇÕES ---
function initializeUserView() {
    if (tripForm) tripForm.reset();
    if (fuelEntriesContainer) fuelEntriesContainer.innerHTML = '';
    fuelEntryIdCounter = 0;
    editingTripId = null;
    if (tripIdToEditInput) tripIdToEditInput.value = '';
    if (submitTripBtn) submitTripBtn.textContent = 'Salvar Viagem';
    if (cancelEditBtn) cancelEditBtn.style.display = 'none';
    if (userFormFeedback) { userFormFeedback.textContent = ''; userFormFeedback.style.display = 'none';}

    if(driverNameInput && loggedInUserProfile) {
        driverNameInput.value = loggedInUserProfile.username; 
    }
    addFuelEntryToForm();
}

function initializeMyTripsView() {
    if (!loggedInUserProfile) return;

    if (myTripsDriverNameContainer) {
        myTripsDriverNameContainer.style.display = (loggedInUserProfile.role === 'admin') ? 'flex' : 'none';
    }
    if (myTripsFilterControls) myTripsFilterControls.style.display = 'block'; 

    if (myTripsFilterStartDateInput) myTripsFilterStartDateInput.value = '';
    if (myTripsFilterEndDateInput) myTripsFilterEndDateInput.value = '';
    if (myTripsDriverNameInput) myTripsDriverNameInput.value = '';

    currentUserForMyTripsSearch = null; 
    currentUidForMyTripsSearch = null;

    loadAndRenderMyTrips(); 
}

function initializeAdminView() {
    if (!loggedInUserProfile || loggedInUserProfile.role !== 'admin') return;
    updateAdminSummary();
    populateAdminDriverSelect();
    if(adminDriverTripsSection) adminDriverTripsSection.style.display = 'none';
    if(adminGeneralFeedback) { adminGeneralFeedback.textContent = ''; adminGeneralFeedback.style.display = 'none';}
    if (adminSummaryFilterStartDateInput) adminSummaryFilterStartDateInput.value = '';
    if (adminSummaryFilterEndDateInput) adminSummaryFilterEndDateInput.value = '';
}

function initializeUserManagementView() {
     if (!loggedInUserProfile || loggedInUserProfile.role !== 'admin' || loggedInUserProfile.username.toLowerCase() !== 'fabio') return;
    loadAndRenderUsersForAdmin();
}


// --- OUVINTES DE EVENTOS ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("Evento DOMContentLoaded disparado.");

    // Adiciona listeners para alternar entre login/cadastro ANTES da checagem do Firebase
    // para permitir navegação básica mesmo que o Firebase falhe.
    if (showRegisterViewLink) {
        showRegisterViewLink.addEventListener('click', (e) => { e.preventDefault(); showView('registerView'); });
        console.log("Listener de evento adicionado para showRegisterViewLink.");
    } else { console.error("showRegisterViewLink não encontrado!"); }

    if (showLoginViewLink) {
        showLoginViewLink.addEventListener('click', (e) => { e.preventDefault(); showView('loginView'); });
        console.log("Listener de evento adicionado para showLoginViewLink.");
    } else { console.error("showLoginViewLink não encontrado!"); }


    if (!app || !authFirebase || !db || !userProfilesCollection || !tripsCollection) {
        console.error("CRÍTICO DOMContentLoaded: Firebase não inicializado corretamente ou coleções não definidas. Listeners da aplicação não adicionados.");
        const body = document.querySelector('body');
        if (body) {
            const errorDiv = document.createElement('div');
            errorDiv.textContent = "ERRO CRÍTICO: FALHA AO CONECTAR AOS SERVIÇOS DE DADOS. VERIFIQUE O CONSOLE E A CONFIGURAÇÃO DO FIREBASE.";
            errorDiv.style.backgroundColor = "red";
            errorDiv.style.color = "white";
            errorDiv.style.padding = "10px";
            errorDiv.style.textAlign = "center";
            errorDiv.style.position = "fixed";
            errorDiv.style.top = "0";
            errorDiv.style.left = "0";
            errorDiv.style.width = "100%";
            errorDiv.style.zIndex = "9999";
            body.prepend(errorDiv);
        }
        return; 
    }
    console.log("Firebase parece inicializado, prosseguindo para adicionar listeners de eventos.");


    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
        console.log("Listener de evento adicionado para registerForm.");
    } else { console.error("registerForm não encontrado!");}
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
        console.log("Listener de evento adicionado para loginForm.");
    } else { console.error("loginForm não encontrado!");}

    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

    if (userViewBtn) userViewBtn.addEventListener('click', () => { showView('userView'); initializeUserView(); });
    if (myTripsViewBtn) myTripsViewBtn.addEventListener('click', () => { showView('myTripsView'); initializeMyTripsView(); });
    if (adminViewBtn) adminViewBtn.addEventListener('click', () => { showView('adminView'); initializeAdminView(); });
    if (userManagementViewBtn) userManagementViewBtn.addEventListener('click', () => { showView('userManagementView'); initializeUserManagementView();});

    if (tripForm) tripForm.addEventListener('submit', handleTripFormSubmit);
    if (addFuelEntryBtn) addFuelEntryBtn.addEventListener('click', () => addFuelEntryToForm());
    if (cancelEditBtn) cancelEditBtn.addEventListener('click', () => {
        editingTripId = null;
        if(tripIdToEditInput) tripIdToEditInput.value = '';
        if(tripForm) tripForm.reset();
        if(fuelEntriesContainer) fuelEntriesContainer.innerHTML = '';
        fuelEntryIdCounter = 0;
        if(submitTripBtn) submitTripBtn.textContent = 'Salvar Viagem';
        if(cancelEditBtn) cancelEditBtn.style.display = 'none';
        if(driverNameInput && loggedInUserProfile) driverNameInput.value = loggedInUserProfile.username; 
        addFuelEntryToForm(); 
        showFeedback(userFormFeedback, "Edição cancelada.", "info");
    });

    if (loadMyTripsBtn && myTripsDriverNameInput) {
        loadMyTripsBtn.addEventListener('click', async () => {
            const driverNameToSearch = myTripsDriverNameInput.value.trim();
            if (!driverNameToSearch) {
                showFeedback(myTripsFeedback, "Digite um nome de motorista para buscar.", "error");
                currentUserForMyTripsSearch = null;
                currentUidForMyTripsSearch = null;
                loadAndRenderMyTrips(myTripsFilterStartDateInput?.value, myTripsFilterEndDateInput?.value); 
                return;
            }
            try {
                const qUser = query(userProfilesCollection, where("username", "==", driverNameToSearch));
                const userSnapshot = await getDocs(qUser);
                if (!userSnapshot.empty) {
                    const foundUser = userSnapshot.docs[0].data(); 
                    currentUserForMyTripsSearch = foundUser.username;
                    currentUidForMyTripsSearch = foundUser.uid;
                    loadAndRenderMyTrips(myTripsFilterStartDateInput?.value, myTripsFilterEndDateInput?.value);
                } else {
                    showFeedback(myTripsFeedback, `Motorista "${driverNameToSearch}" não encontrado.`, "error");
                    if (myTripsTableBody) myTripsTableBody.innerHTML = '';
                    if (myTripsTablePlaceholder) myTripsTablePlaceholder.textContent = `Nenhum motorista encontrado com o nome "${driverNameToSearch}".`;
                    if (myTripsTable) myTripsTable.style.display = 'none';
                    if (myTripsTablePlaceholder) myTripsTablePlaceholder.style.display = 'block';
                    updateDriverSummary([], driverNameToSearch); 
                }
            } catch(err) {
                console.error("Erro ao buscar motorista por nome:", "Código:", err.code, "Mensagem:", err.message);
                showFeedback(myTripsFeedback, "Erro ao buscar motorista.", "error");
            }
        });
    }
    if (applyMyTripsFilterBtn) {
        applyMyTripsFilterBtn.addEventListener('click', () => {
            loadAndRenderMyTrips(myTripsFilterStartDateInput?.value, myTripsFilterEndDateInput?.value);
        });
    }


    if (applyAdminSummaryFilterBtn) {
        applyAdminSummaryFilterBtn.addEventListener('click', () => {
            updateAdminSummary(adminSummaryFilterStartDateInput?.value, adminSummaryFilterEndDateInput?.value);
        });
    }
    if (adminLoadDriverTripsBtn && adminSelectDriver) {
        adminLoadDriverTripsBtn.addEventListener('click', () => {
            const selectedDriverUid = adminSelectDriver.value;
            const selectedDriverName = adminSelectDriver.options[adminSelectDriver.selectedIndex]?.text;
            if (selectedDriverUid && selectedDriverName) {
                loadAndRenderAdminDriverTrips(selectedDriverUid, selectedDriverName);
            } else {
                if(adminDriverTripsSection) adminDriverTripsSection.style.display = 'none';
            }
        });
    }
    if(closeAdminTripDetailModalBtn) {
        closeAdminTripDetailModalBtn.addEventListener('click', () => { if(adminTripDetailModal) adminTripDetailModal.style.display = 'none'; });
    }


    if(editUserForm) editUserForm.addEventListener('submit', handleEditUserFormSubmit);
    if(closeEditUserModalBtn) {
        closeEditUserModalBtn.addEventListener('click', () => {if(editUserModal) editUserModal.style.display = 'none'; });
    }

    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if(modal) {
            modal.style.display = 'none';
            modal.addEventListener('click', (event) => {
                if (event.target === modal) {
                    modal.style.display = 'none';
                }
            });
        }
    });
    console.log("Todos os listeners de evento do DOMContentLoaded nominalmente configurados.");
});
