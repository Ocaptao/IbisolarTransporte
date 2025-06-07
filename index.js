

import { Chart, registerables } from 'chart.js';
// Firebase App (o núcleo do Firebase SDK) é sempre necessário e deve ser listado primeiro
import { initializeApp } from "@firebase/app";
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updatePassword as updateUserPasswordInAuth,
} from "@firebase/auth";
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
    writeBatch,
    setDoc as firebaseSetDoc,
} from "@firebase/firestore";

Chart.register(...registerables);

// --- FIREBASE CONFIGURATION ---
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
let authFirebase;
let db;
let userProfilesCollection;
let tripsCollection;


try {
    app = initializeApp(firebaseConfig);
    authFirebase = getAuth(app);
    db = getFirestore(app);
    userProfilesCollection = collection(db, "userProfiles");
    tripsCollection = collection(db, "trips");
    console.log("Firebase initialized successfully!");
} catch (error) {
    console.error("CRITICAL ERROR: Firebase initialization failed:", "Code:", error.code, "Message:", error.message);
    alert("Erro crítico: Não foi possível conectar ao serviço de dados. Verifique a configuração do Firebase e sua conexão com a internet.");
}


// --- STATE VARIABLES ---
let trips = [];
let editingTripId = null;
let currentUserForMyTripsSearch = null;
let currentUidForMyTripsSearch = null;

let userProfiles = [];
let loggedInUser = null;
let loggedInUserProfile = null;
let editingUserIdForAdmin = null;
let adminSelectedDriverName = null;
let adminSelectedDriverUid = null;
let currentDriverMonthlySummaries = [];

let adminSummaryChart = null;

// --- DOM ELEMENTS ---
const loginView = document.getElementById('loginView');
// registerView foi removido do HTML e não é mais referenciado aqui.
const appContainer = document.getElementById('appContainer');
const loginForm = document.getElementById('loginForm');
// registerForm foi removido.
const tripForm = document.getElementById('tripForm');
const loginFeedback = document.getElementById('loginFeedback');
// registerFeedback foi removido.
const userFormFeedback = document.getElementById('userFormFeedback');
const myTripsFeedback = document.getElementById('myTripsFeedback');
const adminGeneralFeedback = document.getElementById('adminGeneralFeedback');
const userManagementFeedback = document.getElementById('userManagementFeedback');
const editUserFeedback = document.getElementById('editUserFeedback');

// showRegisterViewLink e showLoginViewLink (se referia ao registro) foram removidos.

const userViewBtn = document.getElementById('userViewBtn');
const myTripsViewBtn = document.getElementById('myTripsViewBtn');
const adminViewBtn = document.getElementById('adminViewBtn');
const userManagementViewBtn = document.getElementById('userManagementViewBtn');
const logoutBtn = document.getElementById('logoutBtn');
const welcomeMessageContainer = document.getElementById('welcomeMessageContainer');


const userView = document.getElementById('userView');
const myTripsView = document.getElementById('myTripsView');
const adminView = document.getElementById('adminView');
const userManagementView = document.getElementById('userManagementView');

const tripIdToEditInput = document.getElementById('tripIdToEdit');
const tripDateInput = document.getElementById('tripDate');
const driverNameInput = document.getElementById('driverName');
// const cargoTypeInput = document.getElementById('cargoType'); // Removido
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
const exportAdminReportBtn = document.getElementById('exportAdminReportBtn');
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
const printAdminTripDetailBtn = document.getElementById('printAdminTripDetailBtn');

const adminDriverFiltersContainer = document.getElementById('adminDriverFiltersContainer');
const adminMonthFilterSelect = document.getElementById('adminMonthFilterSelect');
const adminYearFilterSelect = document.getElementById('adminYearFilterSelect');

// New DOM Elements for Individual Trips Display
const adminDriverIndividualTripsSection = document.getElementById('adminDriverIndividualTripsSection');
const adminIndividualTripsTitle = document.getElementById('adminIndividualTripsTitle');
const adminDriverIndividualTripsTable = document.getElementById('adminDriverIndividualTripsTable');
const adminDriverIndividualTripsTableBody = document.getElementById('adminDriverIndividualTripsTableBody');
const adminDriverIndividualTripsPlaceholder = document.getElementById('adminDriverIndividualTripsPlaceholder');


const userManagementTableBody = document.getElementById('userManagementTableBody');
const editUserModal = document.getElementById('editUserModal');
const closeEditUserModalBtn = document.getElementById('closeEditUserModalBtn');
const editUserForm = document.getElementById('editUserForm');
const editUserIdInput = document.getElementById('editUserId');
const editUsernameDisplayInput = document.getElementById('editUsernameDisplay');
const editUserRoleSelect = document.getElementById('editUserRole');
const editUserNewPasswordInput = document.getElementById('editUserNewPassword');
const editUserConfirmNewPasswordInput = document.getElementById('editUserConfirmNewPassword');

// DOM Elements para o formulário de criação de usuário pelo Admin
const adminCreateUserForm = document.getElementById('adminCreateUserForm');
const adminCreateUsernameInput = document.getElementById('adminCreateUsername');
const adminCreateUserRoleSelect = document.getElementById('adminCreateUserRole');
const adminCreateUserPasswordInput = document.getElementById('adminCreateUserPassword');
const adminCreateUserConfirmPasswordInput = document.getElementById('adminCreateUserConfirmPassword');
const adminCreateUserFeedback = document.getElementById('adminCreateUserFeedback');

// DOM Elements para importação de Excel
const excelFileInput = document.getElementById('excelFileInput');
const importExcelBtn = document.getElementById('importExcelBtn');
const excelImportFeedback = document.getElementById('excelImportFeedback');


let fuelEntryIdCounter = 0;

// --- UTILITY FUNCTIONS ---
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

function normalizeUsernameForEmail(username) {
    if (!username) return '';
    const lowerUsername = username.toLowerCase();
    const normalized = lowerUsername
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .replace(/\s+/g, '.')
        .replace(/[^a-z0-9._-]/g, '');

    let cleaned = normalized.replace(/\.+/g, '.');
    if (cleaned.startsWith('.')) cleaned = cleaned.substring(1);
    if (cleaned.endsWith('.')) cleaned = cleaned.slice(0, -1);

    if (!cleaned) {
        return `user.invalid.${generateId()}`;
    }
    return cleaned;
}

function capitalizeName(nameString) {
    if (!nameString || typeof nameString !== 'string') return '';
    return nameString
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

function parseNumericValueFromString(value) {
    if (value === null || value === undefined) return 0;
    let strValue = String(value).trim();
    if (strValue === "") return 0;

    strValue = strValue.replace(/R\$\s?/g, ''); // Remove R$

    const hasComma = strValue.includes(',');
    const dotCount = (strValue.match(/\./g) || []).length;

    if (hasComma) {
        // Assume pt-BR format: "1.234,56" or "1234,56"
        strValue = strValue.replace(/\./g, ''); // Remove all dots (thousand separators)
        strValue = strValue.replace(/,/g, '.'); // Convert comma to dot (decimal)
    } else {
        // No comma
        if (dotCount > 1) {
            // Multiple dots, no comma: "1.234.567" (pt-BR integer for thousands)
            strValue = strValue.replace(/\./g, ''); // Remove all dots
        }
        // else if dotCount === 1: "1234.56" (US-style decimal). parseFloat handles this.
        // else if dotCount === 0: "1234" (integer). parseFloat handles this.
        // No change needed for strValue in these cases as parseFloat will handle them.
    }

    const num = parseFloat(strValue);
    return isNaN(num) ? 0 : num;
}


function formatDate(dateInput) {
    if (!dateInput) return 'Data inválida';
    let dateToFormat;

    if (typeof dateInput === 'string') {
        const trimmedDateInput = dateInput.trim();
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmedDateInput)) { // DD/MM/YYYY
            const parts = trimmedDateInput.split('/');
            // new Date(year, monthIndex (0-11), day)
            dateToFormat = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
        } else if (!trimmedDateInput.includes('T') && /^\d{4}-\d{2}-\d{2}$/.test(trimmedDateInput)) { // YYYY-MM-DD
            dateToFormat = new Date(trimmedDateInput + 'T00:00:00Z'); // Adiciona Z para UTC
        } else {
            dateToFormat = new Date(trimmedDateInput);
        }
    } else if (dateInput instanceof Date) { 
        dateToFormat = dateInput;
    } else if (dateInput && typeof dateInput.toDate === 'function') { 
        dateToFormat = dateInput.toDate();
    } else {
        console.warn("Unsupported dateInput type in formatDate:", dateInput, typeof dateInput);
        return 'Data inválida';
    }

    if (isNaN(dateToFormat.getTime())) {
        console.warn("Date parsing resulted in NaN in formatDate. Original input:", dateInput, "Type:", typeof dateInput);
        return 'Data inválida';
    }

    const year = dateToFormat.getUTCFullYear();
    const month = (dateToFormat.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = dateToFormat.getUTCDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatDisplayDate(dateInput) { 
    if (!dateInput) return 'Data inválida';
    const formattedYYYYMMDD = formatDate(dateInput); 
    if (formattedYYYYMMDD === 'Data inválida') return formattedYYYYMMDD;
    const [year, month, day] = formattedYYYYMMDD.split('-');
    return `${day}/${month}/${year}`; 
}

function formatMonthYear(yearMonthKey) {
    if (!yearMonthKey || typeof yearMonthKey !== 'string' || !yearMonthKey.includes('-')) {
        return 'Mês/Ano Inválido';
    }
    const parts = yearMonthKey.split('-');
    const year = parts[0];
    const month = parseInt(parts[1], 10);

    if (isNaN(month) || month < 1 || month > 12) {
        return 'Mês/Ano Inválido';
    }
    const dateForMonthName = new Date(parseInt(year, 10), month - 1, 1);
    const monthName = dateForMonthName.toLocaleString('pt-BR', { month: 'long', timeZone: 'UTC' }); 
    return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)}/${year}`;
}


function formatCurrency(value) {
    if (value === undefined || value === null || isNaN(value)) {
        return 'R$ 0,00';
    }
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatGenericNumber(value, minDigits = 0, maxDigits = 2) {
    if (value === undefined || value === null || isNaN(value)) {
        return (0).toLocaleString('pt-BR', {
            minimumFractionDigits: minDigits,
            maximumFractionDigits: minDigits,
        });
    }
    return value.toLocaleString('pt-BR', {
        minimumFractionDigits: minDigits,
        maximumFractionDigits: maxDigits,
    });
}

function escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) return '';
    return String(unsafe)
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}


function showFeedback(element, message, type) {
    if (!element) {
        console.warn("Feedback element not found for message:", message);
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
    }, 7000);
}

// --- VIEW MANAGEMENT ---
function showView(viewId) {
    const views = document.querySelectorAll('.view');
    views.forEach(view => view.style.display = 'none');
    if (loginView) loginView.style.display = 'none';
    if (appContainer) appContainer.style.display = 'none';

    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => btn.setAttribute('aria-pressed', 'false'));


    if (viewId === 'loginView' && loginView) {
        loginView.style.display = 'flex';
    } else if (appContainer) {
        appContainer.style.display = 'flex';
        const targetView = document.getElementById(viewId);
        if (targetView) {
            targetView.style.display = 'block';
            const activeNavButton = document.getElementById(viewId + 'Btn');
            if (activeNavButton) {
                activeNavButton.setAttribute('aria-pressed', 'true');
            }
        } else {
            console.warn(`View with ID "${viewId}" not found inside appContainer.`);
        }
    }
    window.scrollTo(0,0);
}

function updateNavVisibility() {
    if (loggedInUser && loggedInUserProfile) {
        if(logoutBtn) logoutBtn.style.display = 'inline-block';
        if (welcomeMessageContainer) welcomeMessageContainer.style.display = 'block';

        if (loggedInUserProfile.role === 'admin') {
            if(userViewBtn) userViewBtn.style.display = 'none';
            if(myTripsViewBtn) myTripsViewBtn.style.display = 'none';
            if(adminViewBtn) adminViewBtn.style.display = 'inline-block';
            if (loggedInUserProfile.username === 'fabio' && userManagementViewBtn) {
                 userManagementViewBtn.style.display = 'inline-block';
            } else if (userManagementViewBtn) {
                userManagementViewBtn.style.display = 'none';
            }
        } else {
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
        if (welcomeMessageContainer) {
             welcomeMessageContainer.innerHTML = '';
             welcomeMessageContainer.style.display = 'none';
        }
    }
}

// --- AUTHENTICATION WITH FIREBASE ---
async function handleLogin(event) {
    event.preventDefault();
    console.log("handleLogin function started.");
    const usernameInput = document.getElementById('loginUsername');
    const passwordInput = document.getElementById('loginPassword');

    const rawUsername = usernameInput.value.trim();
    const normalizedUsernamePart = normalizeUsernameForEmail(rawUsername);

    if (!rawUsername) {
        showFeedback(loginFeedback, "Nome de usuário é obrigatório.", "error");
        console.log("Login aborted: username empty.");
        return;
    }
     if (!normalizedUsernamePart || normalizedUsernamePart.includes("user.invalid")) {
        showFeedback(loginFeedback, `Nome de usuário "${rawUsername}" inválido. Use um nome com letras ou números.`, "error");
        console.log("Login aborted: normalized username part is invalid or empty.");
        return;
    }

    const email = `${normalizedUsernamePart}@example.com`;
    const password = passwordInput.value;
    console.log("Attempting login with:", { rawUsername, normalizedUsernamePart, email });

    if (!password) {
        showFeedback(loginFeedback, "Senha é obrigatória.", "error");
        console.log("Login aborted: password empty.");
        return;
    }

    try {
        console.log("Calling signInWithEmailAndPassword with email:", email);
        await signInWithEmailAndPassword(authFirebase, email, password);
        console.log("signInWithEmailAndPassword successful. Waiting for onAuthStateChanged.");
        showFeedback(loginFeedback, "Login bem-sucedido! Redirecionando...", "success");
        if (loginForm) loginForm.reset();

    } catch (error) {
        console.error("CRITICAL ERROR during login:", "Code:", error.code, "Message:", error.message);
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            showFeedback(loginFeedback, "Nome de usuário ou senha incorretos.", "error");
        } else if (error.code === 'auth/invalid-email') {
             showFeedback(loginFeedback, `O nome de usuário "${rawUsername}" resultou em um formato de e-mail inválido ("${email}") para o login. Verifique se digitou corretamente.`, "error");
        } else if (error.code === 'auth/too-many-requests') {
            showFeedback(loginFeedback, "Muitas tentativas de login malsucedidas. Por segurança, o acesso foi temporariamente bloqueado. Por favor, tente novamente mais tarde.", "error");
        }
        else {
            showFeedback(loginFeedback, "Erro ao tentar fazer login. Verifique o console para detalhes.", "error");
        }
    }
     console.log("handleLogin function finished.");
}

async function handleLogout() {
    console.log("Attempting logout...");
    try {
        await signOut(authFirebase);
        console.log("User signed out from Firebase Auth.");

        if (welcomeMessageContainer) {
            welcomeMessageContainer.innerHTML = '';
            welcomeMessageContainer.style.display = 'none';
        }

        showFeedback(loginFeedback, "Você foi desconectado.", "info");

        if(myTripsTableBody) myTripsTableBody.innerHTML = '';
        if(myTripsTablePlaceholder) myTripsTablePlaceholder.textContent = 'Nenhum frete para exibir...';
        if(adminDriverTripsTableBody) adminDriverTripsTableBody.innerHTML = '';
        if(adminDriverTripsPlaceholder) adminDriverTripsPlaceholder.textContent = 'Nenhum frete encontrado para este motorista.';
        if(adminDriverIndividualTripsTableBody) adminDriverIndividualTripsTableBody.innerHTML = ''; 
        if(adminDriverIndividualTripsPlaceholder) adminDriverIndividualTripsPlaceholder.textContent = 'Selecione um mês na tabela de resumos para ver as viagens individuais.';
        if(adminDriverIndividualTripsSection) adminDriverIndividualTripsSection.style.display = 'none';


        if(adminSelectDriver) adminSelectDriver.innerHTML = '<option value="">-- Selecione um Motorista --</option>';
        if(userManagementTableBody) userManagementTableBody.innerHTML = '';
        if(adminCreateUserForm) adminCreateUserForm.reset();
        if(adminCreateUserFeedback) {adminCreateUserFeedback.textContent = ''; adminCreateUserFeedback.style.display = 'none';}
        if(excelFileInput) excelFileInput.value = '';
        if(excelImportFeedback) {excelImportFeedback.textContent = ''; excelImportFeedback.style.display = 'none';}


        currentUserForMyTripsSearch = null;
        currentUidForMyTripsSearch = null;
        adminSelectedDriverName = null;
        adminSelectedDriverUid = null;
        currentDriverMonthlySummaries = [];
        editingTripId = null;
        editingUserIdForAdmin = null;
        if (tripForm) tripForm.reset();
        if (fuelEntriesContainer) fuelEntriesContainer.innerHTML = '';
        fuelEntryIdCounter = 0;
        if (adminDriverFiltersContainer) adminDriverFiltersContainer.style.display = 'none';
        if (adminMonthFilterSelect) adminMonthFilterSelect.value = '';
        if (adminYearFilterSelect) adminYearFilterSelect.value = '';
        if (adminSelectedDriverNameDisplay) adminSelectedDriverNameDisplay.textContent = "Selecione um motorista para ver os resumos.";


    } catch (error) {
        console.error("CRITICAL ERROR during logout:", "Code:", error.code, "Message:", error.message);
        showFeedback(loginFeedback, "Erro ao sair. Tente novamente.", "error");
    }
}


if (authFirebase) {
    onAuthStateChanged(authFirebase, async (user) => {
        console.log("onAuthStateChanged triggered. User object:", user ? user.uid : 'null');
        if (user) {
            loggedInUser = user;
            console.log("User is authenticated with UID:", user.uid);
            try {
                console.log("Attempting to fetch user profile from Firestore for UID:", user.uid);
                const userProfileDocRef = doc(userProfilesCollection, user.uid);
                const userProfileDoc = await getDoc(userProfileDocRef);

                if (userProfileDoc.exists()) {

                    if (authFirebase.currentUser && authFirebase.currentUser.uid === user.uid) {
                        loggedInUserProfile = { id: userProfileDoc.id, ...userProfileDoc.data() };
                        console.log("User profile found in Firestore:", "Username:", loggedInUserProfile.username, "Role:", loggedInUserProfile.role);

                        if (welcomeMessageContainer && loggedInUserProfile) {
                            const icon = loggedInUserProfile.role === 'admin' ? '⚙️' : '🚗';
                            const formattedUsername = capitalizeName(loggedInUserProfile.username);
                            welcomeMessageContainer.innerHTML = `Bem Vindo, <strong class="welcome-username">${escapeHtml(formattedUsername)}</strong> <span class="welcome-icon">${icon}</span>`;
                            welcomeMessageContainer.style.display = 'block';
                        }

                        updateNavVisibility();
                        if (loggedInUserProfile.role === 'admin') {
                            console.log("User is admin, showing adminView.");
                            showView('adminView');
                            initializeAdminView();
                        } else {
                            console.log("User is motorista, showing userView.");
                            showView('userView');
                            initializeUserView();
                        }

                        if (myTripsViewBtn && myTripsViewBtn.style.display !== 'none') {
                            console.log("Initializing My Fretes View for logged in user.");
                            initializeMyTripsView();
                        }
                        if (userManagementViewBtn && userManagementViewBtn.style.display !== 'none' && loggedInUserProfile.username === 'fabio') {
                            console.log("User is Fabio (admin), initializing User Management View.");
                            initializeUserManagementView();
                        }
                    } else {
                        console.warn("User session changed while fetching profile for UID:", user.uid, ". Aborting UI update for this stale session.");
                        if (welcomeMessageContainer) {
                            welcomeMessageContainer.innerHTML = '';
                            welcomeMessageContainer.style.display = 'none';
                        }
                    }
                } else {
                    console.error("CRITICAL: User profile NOT FOUND in Firestore for UID:", user.uid, "Email:", user.email);
                    showFeedback(loginFeedback, `Falha ao carregar perfil (usuário ${user.email || user.uid}). Você será desconectado. Verifique o cadastro ou contate o suporte.`, "error");
                    if (welcomeMessageContainer) {
                        welcomeMessageContainer.innerHTML = '';
                        welcomeMessageContainer.style.display = 'none';
                    }
                    setTimeout(() => signOut(authFirebase), 3000);
                }
            } catch (error) {
                console.error("CRITICAL ERROR fetching user profile for UID:", user.uid, "Error:", error);
                if (welcomeMessageContainer) {
                    welcomeMessageContainer.innerHTML = '';
                    welcomeMessageContainer.style.display = 'none';
                }
                showFeedback(loginFeedback, `Erro ao carregar dados do perfil (usuário ${user.email || user.uid}). Você será desconectado. (${error.message})`, "error");
                setTimeout(() => signOut(authFirebase), 3000);
            }
        } else {
            console.log("User is not authenticated (logged out or session ended).");
            loggedInUser = null;
            loggedInUserProfile = null;
            if (welcomeMessageContainer) {
                welcomeMessageContainer.innerHTML = '';
                welcomeMessageContainer.style.display = 'none';
            }
            trips = [];
            userProfiles = [];
            updateNavVisibility();
            showView('loginView');
            console.log("User is logged out, showing loginView.");
        }
        console.log("onAuthStateChanged finished processing for user:", user ? user.uid : 'null');
    });
}


// --- TRIP MANAGEMENT WITH FIRESTORE ---

function addFuelEntryToForm(entry) {
    const entryId = entry ? entry.id : `fuel_${fuelEntryIdCounter++}`;
    const fuelDiv = document.createElement('div');
    fuelDiv.className = 'fuel-entry-item';
    fuelDiv.id = entryId;
    fuelDiv.innerHTML = `
        <input type="hidden" name="fuelEntryId" value="${entryId}">
        <div class="form-group">
            <label for="liters_${entryId}">Litros:</label>
            <input type="text" id="liters_${entryId}" name="liters" placeholder="0" value="${entry?.liters ? String(entry.liters).replace('.', ',') : ''}" required inputmode="decimal">
        </div>
        <div class="form-group">
            <label for="valuePerLiter_${entryId}">Valor/Litro (R$):</label>
            <input type="text" id="valuePerLiter_${entryId}" name="valuePerLiter" placeholder="0,00" value="${entry?.valuePerLiter ? String(entry.valuePerLiter).replace('.', ',') : ''}" required inputmode="decimal">
        </div>
        <div class="form-group">
            <label for="discount_${entryId}">Desconto (R$):</label>
            <input type="text" id="discount_${entryId}" name="discount" placeholder="0,00" value="${entry?.discount ? String(entry.discount).replace('.', ',') : '0'}" inputmode="decimal">
        </div>
        <div class="form-group">
            <label for="totalValue_${entryId}">Valor Total (R$):</label>
            <input type="text" id="totalValue_${entryId}" name="totalValue" placeholder="0,00" value="${entry?.totalValue ? String(entry.totalValue).replace('.', ',') : ''}" required readonly inputmode="decimal">
        </div>
        <button type="button" class="control-btn danger-btn small-btn remove-fuel-entry-btn" data-entry-id="${entryId}" aria-label="Remover este abastecimento">Remover</button>
    `;
    if(fuelEntriesContainer) fuelEntriesContainer.appendChild(fuelDiv);

    const litersInput = document.getElementById(`liters_${entryId}`);
    const valuePerLiterInput = document.getElementById(`valuePerLiter_${entryId}`);
    const discountInput = document.getElementById(`discount_${entryId}`);
    const totalValueInput = document.getElementById(`totalValue_${entryId}`);

    function calculateTotalFuelValue() {
        const liters = parseNumericValueFromString(litersInput.value);
        const valuePerLiter = parseNumericValueFromString(valuePerLiterInput.value);
        const discount = parseNumericValueFromString(discountInput.value);
        const total = (liters * valuePerLiter) - discount;
        totalValueInput.value = total.toFixed(2).replace('.', ','); // Display with comma
    }

    litersInput.addEventListener('input', calculateTotalFuelValue);
    valuePerLiterInput.addEventListener('input', calculateTotalFuelValue);
    discountInput.addEventListener('input', calculateTotalFuelValue);

    fuelDiv.querySelector('.remove-fuel-entry-btn')?.addEventListener('click', (e) => {
        const targetButton = e.target;
        const idToRemove = targetButton.dataset.entryId;
        const entryElementToRemove = document.getElementById(idToRemove);
        if (entryElementToRemove) {
            entryElementToRemove.remove();
        }
    });
    if(entry) calculateTotalFuelValue();
}

async function handleTripFormSubmit(event) {
    event.preventDefault();
    if (!loggedInUser || !loggedInUserProfile) {
        showFeedback(userFormFeedback, "Você precisa estar logado para registrar um frete.", "error");
        return;
    }

    const formData = new FormData(tripForm);
    const fuelEntriesFromForm = [];
    const fuelEntryElements = fuelEntriesContainer.querySelectorAll('.fuel-entry-item');
    let totalFuelCostCalculated = 0;

    fuelEntryElements.forEach(entryEl => {
        const entryId = entryEl.id;
        const liters = parseNumericValueFromString((entryEl.querySelector(`input[name="liters"]`)).value);
        const valuePerLiter = parseNumericValueFromString((entryEl.querySelector(`input[name="valuePerLiter"]`)).value);
        const discount = parseNumericValueFromString((entryEl.querySelector(`input[name="discount"]`)).value);
        const totalValue = (liters * valuePerLiter) - discount;

        if (liters > 0 && valuePerLiter > 0) {
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

    const kmInitialVal = parseNumericValueFromString(formData.get('kmInitial'));
    const kmFinalVal = parseNumericValueFromString(formData.get('kmFinal'));
    const kmDrivenVal = (kmFinalVal > kmInitialVal) ? kmFinalVal - kmInitialVal : 0;

    const arla32CostVal = parseNumericValueFromString(formData.get('arla32Cost'));
    const tollCostVal = parseNumericValueFromString(formData.get('tollCost'));
    const commissionCostVal = parseNumericValueFromString(formData.get('commissionCost'));
    const otherExpensesVal = parseNumericValueFromString(formData.get('otherExpenses'));

    const totalExpensesCalculated = totalFuelCostCalculated + arla32CostVal + tollCostVal + otherExpensesVal + commissionCostVal;
    const freightValueVal = parseNumericValueFromString(formData.get('freightValue'));
    const netProfitVal = freightValueVal - totalExpensesCalculated;

    const tripDataObjectFromForm = {
        userId: loggedInUser.uid,
        driverName: (formData.get('driverName')).trim() || loggedInUserProfile.username, 
        date: formData.get('tripDate'),
        kmInitial: kmInitialVal,
        kmFinal: kmFinalVal,
        kmDriven: kmDrivenVal,
        weight: parseNumericValueFromString(formData.get('weight')),
        unitValue: parseNumericValueFromString(formData.get('unitValue')),
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
        declaredValue: parseNumericValueFromString(formData.get('declaredValue')),
    };

    try {
        if(submitTripBtn) {
            submitTripBtn.disabled = true;
            submitTripBtn.textContent = 'Salvando...';
        }

        if (editingTripId) {
            const tripRef = doc(tripsCollection, editingTripId);
            const updatePayload = { ...tripDataObjectFromForm };

            await updateDoc(tripRef, updatePayload);
            showFeedback(userFormFeedback, "Frete atualizado com sucesso!", "success");
        } else {
            const createPayload = {
                ...tripDataObjectFromForm,
                createdAt: Timestamp.now()
            };
            await addDoc(tripsCollection, createPayload);
            showFeedback(userFormFeedback, "Frete registrado com sucesso!", "success");
        }
        if(tripForm) tripForm.reset();
        if(fuelEntriesContainer) fuelEntriesContainer.innerHTML = '';
        fuelEntryIdCounter = 0;
        editingTripId = null;
        if(tripIdToEditInput) tripIdToEditInput.value = '';
        if (driverNameInput && loggedInUserProfile) driverNameInput.value = capitalizeName(loggedInUserProfile.username);
        if (submitTripBtn) submitTripBtn.textContent = 'Salvar Frete';
        if (cancelEditBtn) cancelEditBtn.style.display = 'none';

        if (myTripsView && myTripsView.style.display === 'block' && (!currentUserForMyTripsSearch || currentUserForMyTripsSearch === loggedInUserProfile.username)) {
            loadAndRenderMyTrips();
        }
        if (adminView && adminView.style.display === 'block') {
            updateAdminSummary();
            if (loggedInUser && adminSelectedDriverUid === loggedInUser.uid) { 
                 loadAndRenderAdminDriverMonthlySummaries(); 
            }
        }

    } catch (error) {
        console.error("Error saving trip to Firestore:", "Code:", error.code, "Message:", error.message);
        showFeedback(userFormFeedback, "Erro ao salvar frete. Tente novamente.", "error");
        if (submitTripBtn) submitTripBtn.textContent = editingTripId ? 'Salvar Alterações' : 'Salvar Frete';
    } finally {
        if (submitTripBtn) submitTripBtn.disabled = false;
    }
}

async function loadAndRenderMyTrips(filterStartDate, filterEndDate) {
    if (!loggedInUser || !loggedInUserProfile) {
        const msg = 'Você precisa estar logado e seu perfil carregado para ver seus fretes.';
        if (myTripsTablePlaceholder) myTripsTablePlaceholder.textContent = msg;
        if (myTripsTable) myTripsTable.style.display = 'none';
        if (myTripsTablePlaceholder) myTripsTablePlaceholder.style.display = 'block';
        showFeedback(myTripsFeedback, msg, "error");
        return;
    }

    let targetUid = loggedInUser.uid;
    let targetUsername = loggedInUserProfile.username;

    if (loggedInUserProfile.role === 'admin' && currentUidForMyTripsSearch && currentUserForMyTripsSearch) {
        targetUid = currentUidForMyTripsSearch;
        targetUsername = currentUserForMyTripsSearch;
    }

    if (!targetUid) {
        const msg = 'Não foi possível identificar o motorista para carregar os fretes.';
         if (myTripsTablePlaceholder) myTripsTablePlaceholder.textContent = msg;
        showFeedback(myTripsFeedback, msg, "error");
        return;
    }


    if(myTripsTablePlaceholder) myTripsTablePlaceholder.textContent = `Carregando fretes de ${capitalizeName(targetUsername)}...`;
    if(myTripsTable) myTripsTable.style.display = 'none';
    if(myTripsTablePlaceholder) myTripsTablePlaceholder.style.display = 'block';
    if(myTripsTableBody) myTripsTableBody.innerHTML = '';

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
            if(myTripsTablePlaceholder) myTripsTablePlaceholder.textContent = `Nenhum frete encontrado para ${capitalizeName(targetUsername)}` +
                `${(filterStartDate || filterEndDate) ? ' nos filtros aplicados.' : '.'}`;
        } else {
            if(myTripsTable) myTripsTable.style.display = 'table';
            if(myTripsTablePlaceholder) myTripsTablePlaceholder.style.display = 'none';
            renderMyTripsTable(trips);
        }
        updateDriverSummary(trips, targetUsername);

    } catch (error) {
        console.error(`ERRO CRÍTICO ao carregar fretes de ${capitalizeName(targetUsername)} do Firestore:`, "Código:", error.code, "Mensagem:", error.message, "Detalhes:", error);
        let userMessage = `Erro ao carregar fretes de ${capitalizeName(targetUsername)}. Verifique o console para mais detalhes.`;
        if (error.code === 'failed-precondition') {
            userMessage = `Erro ao carregar fretes de ${capitalizeName(targetUsername)}: Provavelmente um índice está faltando no Firestore. Verifique o console do navegador (F12) para um link ou mensagem de erro detalhada.`;
        } else if (error.code === 'permission-denied') {
            userMessage = `Erro ao carregar fretes de ${capitalizeName(targetUsername)}: Permissão negada. Verifique as regras de segurança do Firestore.`;
        }
        showFeedback(myTripsFeedback, userMessage, "error");
        if (myTripsTablePlaceholder) myTripsTablePlaceholder.textContent = userMessage;
    }
}

function renderMyTripsTable(tripsToRender) {
    if (!myTripsTableBody) return;
    myTripsTableBody.innerHTML = '';
    if (tripsToRender.length === 0) {
        if(myTripsTable) myTripsTable.style.display = 'none';
        if (myTripsTablePlaceholder) {
             myTripsTablePlaceholder.style.display = 'block';
             myTripsTablePlaceholder.textContent = 'Nenhum frete para exibir com os filtros atuais.';
        }
        return;
    }

    if (myTripsTable) myTripsTable.style.display = 'table';
    if (myTripsTablePlaceholder) myTripsTablePlaceholder.style.display = 'none';

    tripsToRender.forEach(trip => {
        const row = myTripsTableBody.insertRow();
        row.insertCell().textContent = formatDisplayDate(trip.date);
        row.insertCell().textContent = formatCurrency(trip.freightValue);
        row.insertCell().textContent = formatCurrency(trip.totalExpenses);
        row.insertCell().textContent = formatCurrency(trip.commissionCost);

        const actionsCell = row.insertCell();
        const editButton = document.createElement('button');
        editButton.className = 'control-btn small-btn';
        editButton.textContent = 'Editar';
        editButton.setAttribute('aria-label', `Editar frete de ${formatDisplayDate(trip.date)}`);
        editButton.onclick = () => loadTripForEditing(trip.id);
        actionsCell.appendChild(editButton);

        let canDelete = false;
        if (loggedInUserProfile && loggedInUser && trip.userId === loggedInUser.uid) {
            canDelete = true;
        }
        if (loggedInUserProfile && loggedInUserProfile.role === 'admin' && loggedInUserProfile.username === 'fabio') {
            canDelete = true;
        }


        if (canDelete) {
            const deleteButton = document.createElement('button');
            deleteButton.className = 'control-btn danger-btn small-btn';
            deleteButton.textContent = 'Excluir';
            deleteButton.setAttribute('aria-label', `Excluir frete de ${formatDisplayDate(trip.date)}`);
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

            if (!loggedInUser ||(loggedInUser.uid !== trip.userId && loggedInUserProfile?.role !== 'admin')) {
                showFeedback(userFormFeedback, "Você não tem permissão para editar este frete.", "error");
                return;
            }

            if(tripForm) tripForm.reset();
            if(fuelEntriesContainer) fuelEntriesContainer.innerHTML = '';

            if(tripIdToEditInput) tripIdToEditInput.value = trip.id;
            editingTripId = trip.id;
            if(driverNameInput) driverNameInput.value = capitalizeName(trip.driverName);
            if(tripDateInput) tripDateInput.value = trip.date; 
            if(kmInitialInput) kmInitialInput.value = trip.kmInitial?.toString().replace('.', ',') || '';
            if(kmFinalInput) kmFinalInput.value = trip.kmFinal?.toString().replace('.', ',') || '';    
            if(weightInput) weightInput.value = trip.weight?.toString().replace('.', ',') || '';      
            if(unitValueInput) unitValueInput.value = trip.unitValue?.toString().replace('.', ',') || ''; 
            if(freightValueInput) freightValueInput.value = trip.freightValue.toString().replace('.', ',');

            trip.fuelEntries.forEach(entry => addFuelEntryToForm(entry)); 

            if(arla32CostInput) arla32CostInput.value = trip.arla32Cost?.toString().replace('.', ',') || ''; 
            if(tollCostInput) tollCostInput.value = trip.tollCost.toString().replace('.', ',');            
            if(commissionCostInput) commissionCostInput.value = trip.commissionCost?.toString().replace('.', ',') || ''; 
            if(otherExpensesInput) otherExpensesInput.value = trip.otherExpenses.toString().replace('.', ',');      
            if(expenseDescriptionInput) expenseDescriptionInput.value = trip.expenseDescription || '';
            if(declaredValueInput) declaredValueInput.value = trip.declaredValue?.toString().replace('.', ',') || '';


            if (submitTripBtn) submitTripBtn.textContent = 'Salvar Alterações';
            if (cancelEditBtn) cancelEditBtn.style.display = 'inline-block';
            showView('userView');
            if (userView) userView.scrollIntoView({ behavior: 'smooth' });
            showFeedback(userFormFeedback, `Editando frete de ${capitalizeName(trip.driverName)} do dia ${formatDisplayDate(trip.date)}.`, "info");

        } else {
            showFeedback(myTripsFeedback, "Frete não encontrado para edição.", "error");
        }
    } catch (error) {
        console.error("Error loading trip for editing:", "Code:", error.code, "Message:", error.message);
        showFeedback(myTripsFeedback, "Erro ao carregar frete para edição.", "error");
    }
}


function confirmDeleteTrip(tripId, driverNameForConfirm) {
    if (!tripId) return;

    const tripToDelete = trips.find(t => t.id === tripId) ||
                        (adminView && adminView.style.display === 'block' ? trips.find(t=>t.id === tripId) : null);

    if (tripToDelete) {
         if (!loggedInUser || (loggedInUser.uid !== tripToDelete.userId &&
            !(loggedInUserProfile?.role === 'admin' && loggedInUserProfile.username === 'fabio'))) {
            showFeedback(myTripsFeedback, "Você não tem permissão para excluir este frete.", "error");
            return;
        }
    } else if (!loggedInUserProfile || loggedInUserProfile.role !== 'admin' || loggedInUserProfile.username !== 'fabio') {
        showFeedback(myTripsFeedback, "Frete não encontrado ou permissão para exclusão global negada.", "error");
        return;
    }


    if (confirm(`Tem certeza que deseja excluir o frete de ${capitalizeName(driverNameForConfirm)}? Esta ação não pode ser desfeita.`)) {
        deleteTrip(tripId);
    }
}

async function deleteTrip(tripId) {
    try {
        await deleteDoc(doc(tripsCollection, tripId));
        showFeedback(myTripsFeedback, "Frete excluído com sucesso.", "success");
        if (myTripsView && myTripsView.style.display === 'block') {
            loadAndRenderMyTrips(myTripsFilterStartDateInput?.value, myTripsFilterEndDateInput?.value);
        }
        if (adminView && adminView.style.display === 'block' && adminSelectedDriverUid) {
            loadAndRenderAdminDriverMonthlySummaries(); 
            updateAdminSummary();
        } else if (adminView && adminView.style.display === 'block') {
            updateAdminSummary();
        }

    } catch (error) {
        console.error("Error deleting trip from Firestore:", "Code:", error.code, "Message:", error.message);
        showFeedback(myTripsFeedback, "Erro ao excluir frete. Tente novamente.", "error");
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
                summaryTitle.textContent = `Resumo de Fretes de ${capitalizeName(driverDisplayName)}`;
            } else {
                summaryTitle.textContent = `Seu Resumo de Fretes`;
            }
        }
    }
}


// --- ADMIN PANEL FUNCTIONS ---
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

        querySnapshot.forEach((docSnap) => {
            const trip = docSnap.data();
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
        console.error("ERRO CRÍTICO ao atualizar resumo do administrador:", "Código:", error.code, "Mensagem:", error.message, "Detalhes:", error);
        let userMessage = "Erro ao atualizar resumo do administrador. Verifique o console para mais detalhes.";
         if (error.code === 'failed-precondition') {
            userMessage = "Erro ao atualizar resumo: Provavelmente um índice está faltando no Firestore. Verifique o console do navegador (F12) para um link ou mensagem de erro detalhada.";
        }
        showFeedback(adminGeneralFeedback, userMessage, "error");
    }
}

async function populateAdminDriverSelect() {
    if (!adminSelectDriver) return;
    adminSelectDriver.innerHTML = '<option value="">-- Carregando Motoristas --</option>';
    try {
        const q = query(userProfilesCollection, where("role", "==", "motorista"), orderBy("username"));
        const querySnapshot = await getDocs(q);

        const motoristas = [];
        querySnapshot.forEach((docSnap) => {
            motoristas.push({ id: docSnap.id, ...docSnap.data() });
        });

        const existingMotoristaIds = new Set(userProfiles.filter(p => p.role === 'motorista').map(p => p.id));
        motoristas.forEach(m => {
            if (!existingMotoristaIds.has(m.id)) {
                userProfiles.push(m);
            }
        });


        const options = ['<option value="">-- Selecione um Motorista --</option>'];
        motoristas.forEach((user) => {
            options.push(`<option value="${user.uid}" data-name="${user.username}">${capitalizeName(user.username)}</option>`);
        });
        adminSelectDriver.innerHTML = options.join('');

    } catch (error) {
        console.error("Error populating admin driver select:", "Code:", error.code, "Message:", error.message);
        adminSelectDriver.innerHTML = '<option value="">-- Erro ao carregar --</option>';
    }
}

function populateAdminYearFilterSelect() {
    if (!adminYearFilterSelect) return;
    const currentYear = new Date().getFullYear();
    const yearOptions = ['<option value="">Todos os Anos</option>'];
    for (let i = 0; i < 5; i++) {
        const year = currentYear - i;
        yearOptions.push(`<option value="${year}">${year}</option>`);
    }
    adminYearFilterSelect.innerHTML = yearOptions.join('');
}


async function loadAndRenderAdminDriverMonthlySummaries() {
    const driverUid = adminSelectDriver.value;
    const driverName = adminSelectDriver.options[adminSelectDriver.selectedIndex]?.dataset.name;

    if (adminDriverIndividualTripsSection) adminDriverIndividualTripsSection.style.display = 'none';
    if (adminDriverIndividualTripsTableBody) adminDriverIndividualTripsTableBody.innerHTML = '';
    if (adminIndividualTripsTitle) adminIndividualTripsTitle.textContent = '';


    if (!adminDriverFiltersContainer) {
        console.error("Admin Panel Bug: adminDriverFiltersContainer not found in DOM!");
        if(adminGeneralFeedback) showFeedback(adminGeneralFeedback, "Erro de Interface: Controles de filtro não encontrados. Contate o suporte.", "error");
    }


    if (!driverUid) {
        if (adminDriverTripsSection) adminDriverTripsSection.style.display = 'none';
        if (adminDriverFiltersContainer) adminDriverFiltersContainer.style.display = 'none';
        currentDriverMonthlySummaries = [];
        adminSelectedDriverUid = null;
        adminSelectedDriverName = null;
        if (adminSelectedDriverNameDisplay) adminSelectedDriverNameDisplay.textContent = "Selecione um motorista para ver os resumos.";
        if (adminDriverTripsTableBody) adminDriverTripsTableBody.innerHTML = '';
        if (adminDriverTripsPlaceholder) {
            adminDriverTripsPlaceholder.textContent = "Selecione um motorista acima para carregar os resumos mensais.";
            adminDriverTripsPlaceholder.style.display = 'block';
        }
        if (adminDriverTripsTable) adminDriverTripsTable.style.display = 'none';
        return;
    }

    adminSelectedDriverUid = driverUid;
    adminSelectedDriverName = driverName;

    if (adminSelectedDriverNameDisplay) adminSelectedDriverNameDisplay.textContent = `Resumos Mensais de ${capitalizeName(driverName)}`;
    if (adminDriverTripsTableBody) adminDriverTripsTableBody.innerHTML = '';
    if (adminDriverTripsPlaceholder) adminDriverTripsPlaceholder.textContent = `Carregando resumos de ${capitalizeName(driverName)}...`;
    if (adminDriverTripsTable) adminDriverTripsTable.style.display = 'none';
    if (adminDriverTripsPlaceholder) adminDriverTripsPlaceholder.style.display = 'block';
    if (adminDriverTripsSection) adminDriverTripsSection.style.display = 'block';
    if (adminDriverFiltersContainer) adminDriverFiltersContainer.style.display = 'block';


    try {
        const q = query(tripsCollection, where("userId", "==", driverUid), orderBy("date", "asc"));
        const querySnapshot = await getDocs(q);

        const monthlyDataMap = new Map();

        querySnapshot.forEach((docSnap) => {
            const trip = docSnap.data();
            const tripDate = trip.date; 
            const yearMonthKey = tripDate.substring(0, 7);

            if (!monthlyDataMap.has(yearMonthKey)) {
                monthlyDataMap.set(yearMonthKey, {
                    yearMonthKey: yearMonthKey,
                    displayMonthYear: formatMonthYear(yearMonthKey),
                    tripCount: 0,
                    totalFreightValue: 0,
                    totalExpenses: 0,
                    totalNetProfit: 0,
                });
            }

            const monthSummary = monthlyDataMap.get(yearMonthKey);
            monthSummary.tripCount++;
            monthSummary.totalFreightValue += trip.freightValue || 0;
            monthSummary.totalExpenses += trip.totalExpenses || 0;
            monthSummary.totalNetProfit += trip.netProfit || 0;
        });

        currentDriverMonthlySummaries = Array.from(monthlyDataMap.values())
            .sort((a, b) => b.yearMonthKey.localeCompare(a.yearMonthKey));

        renderAdminDriverMonthlySummariesTable();

    } catch (error) {
        console.error(`ERRO CRÍTICO ao carregar resumos para ${driverName} (UID: ${driverUid}):`, "Código:", error.code, "Mensagem:", error.message, "Detalhes:", error);
        let userMessage = `Erro ao carregar resumos de ${capitalizeName(driverName)}. Verifique o console.`;
        if (error.code === 'failed-precondition') {
            userMessage = `Erro ao carregar resumos de ${capitalizeName(driverName)}: Provavelmente um índice está faltando no Firestore. Verifique o console do navegador (F12).`;
        }
        showFeedback(adminGeneralFeedback, userMessage, "error");
        if (adminDriverTripsPlaceholder) adminDriverTripsPlaceholder.textContent = userMessage;
        if (adminDriverFiltersContainer) adminDriverFiltersContainer.style.display = 'none';
    }
}

function renderAdminDriverMonthlySummariesTable() {
    if (!adminDriverTripsTableBody) return;
    adminDriverTripsTableBody.innerHTML = '';

    if (adminDriverIndividualTripsSection) adminDriverIndividualTripsSection.style.display = 'none';
    if (adminDriverIndividualTripsTableBody) adminDriverIndividualTripsTableBody.innerHTML = '';


    const selectedMonth = adminMonthFilterSelect.value;
    const selectedYear = adminYearFilterSelect.value;

    const filteredSummaries = currentDriverMonthlySummaries.filter(summary => {
        const [summaryYear, summaryMonth] = summary.yearMonthKey.split('-');

        const yearMatch = !selectedYear || selectedYear === summaryYear;
        const monthMatch = !selectedMonth || selectedMonth === summaryMonth;

        return yearMatch && monthMatch;
    });


    if (filteredSummaries.length === 0) {
        if (adminDriverTripsTable) adminDriverTripsTable.style.display = 'none';
        if (adminDriverTripsPlaceholder) {
            adminDriverTripsPlaceholder.style.display = 'block';
            adminDriverTripsPlaceholder.textContent = `Nenhum resumo encontrado para ${capitalizeName(adminSelectedDriverName) || 'o motorista selecionado'} com os filtros aplicados.`;
        }
        return;
    }

    if (adminDriverTripsTable) adminDriverTripsTable.style.display = 'table';
    if (adminDriverTripsPlaceholder) adminDriverTripsPlaceholder.style.display = 'none';

    filteredSummaries.forEach(summary => {
        const row = adminDriverTripsTableBody.insertRow();
        row.insertCell().textContent = summary.displayMonthYear;
        row.insertCell().textContent = formatGenericNumber(summary.tripCount, 0, 0);
        row.insertCell().textContent = formatCurrency(summary.totalFreightValue);
        row.insertCell().textContent = formatCurrency(summary.totalExpenses);
        row.insertCell().textContent = formatCurrency(summary.totalNetProfit);
        
        const actionsCell = row.insertCell();
        const viewMonthTripsButton = document.createElement('button');
        viewMonthTripsButton.className = 'control-btn small-btn view-month-trips-btn';
        viewMonthTripsButton.textContent = 'Ver Viagens do Mês';
        viewMonthTripsButton.setAttribute('aria-label', `Ver viagens de ${summary.displayMonthYear}`);
        viewMonthTripsButton.dataset.yearMonth = summary.yearMonthKey;
        viewMonthTripsButton.dataset.driverUid = adminSelectedDriverUid;
        viewMonthTripsButton.dataset.driverName = adminSelectedDriverName;
        viewMonthTripsButton.dataset.displayMonthYear = summary.displayMonthYear;
        viewMonthTripsButton.onclick = () => handleViewMonthTripsClick(
            summary.yearMonthKey, 
            adminSelectedDriverUid, 
            adminSelectedDriverName, 
            summary.displayMonthYear
        );
        actionsCell.appendChild(viewMonthTripsButton);
    });
}

function handleViewMonthTripsClick(yearMonthKey, driverUid, driverName, displayMonthYear) {
    loadAndRenderTripsForMonth(yearMonthKey, driverUid, driverName, displayMonthYear);
}

async function loadAndRenderTripsForMonth(yearMonthKey, driverUid, driverName, displayMonthYear) {
    if (!adminDriverIndividualTripsSection || !adminIndividualTripsTitle || !adminDriverIndividualTripsTableBody || !adminDriverIndividualTripsPlaceholder || !adminDriverIndividualTripsTable) return;

    adminDriverIndividualTripsSection.style.display = 'block';
    adminIndividualTripsTitle.textContent = `Viagens Individuais de ${capitalizeName(driverName)} para ${displayMonthYear}`;
    adminDriverIndividualTripsTableBody.innerHTML = '';
    adminDriverIndividualTripsPlaceholder.textContent = `Carregando viagens de ${capitalizeName(driverName)} para ${displayMonthYear}...`;
    adminDriverIndividualTripsTable.style.display = 'none';
    adminDriverIndividualTripsPlaceholder.style.display = 'block';

    try {
        const [yearStr, monthStr] = yearMonthKey.split('-');
        const yearNum = parseInt(yearStr);
        const monthNum = parseInt(monthStr); 

        const startDate = `${yearStr}-${monthStr}-01`;
        const endDate = new Date(yearNum, monthNum, 0).toISOString().split('T')[0];


        const q = query(
            tripsCollection,
            where("userId", "==", driverUid),
            where("date", ">=", startDate),
            where("date", "<=", endDate),
            orderBy("date", "desc")
        );

        const querySnapshot = await getDocs(q);
        const fetchedTrips = [];
        querySnapshot.forEach((docSnap) => {
            fetchedTrips.push({ id: docSnap.id, ...docSnap.data() });
        });

        renderAdminDriverIndividualTripsTable(fetchedTrips, displayMonthYear, driverName);

    } catch (error) {
        console.error(`ERRO CRÍTICO ao carregar viagens individuais para ${driverName} (${yearMonthKey}):`, "Código:", error.code, "Mensagem:", error.message);
        let userMessage = `Erro ao carregar viagens de ${capitalizeName(driverName)} para ${displayMonthYear}. Verifique o console.`;
        if (error.code === 'failed-precondition') {
            userMessage = `Erro ao carregar viagens: Provavelmente um índice está faltando no Firestore. Verifique o console do navegador (F12).`;
        }
        adminDriverIndividualTripsPlaceholder.textContent = userMessage;
        showFeedback(adminGeneralFeedback, userMessage, "error");
    }
}

function renderAdminDriverIndividualTripsTable(individualTrips, displayMonthYear, driverName) {
    if (!adminDriverIndividualTripsTableBody || !adminDriverIndividualTripsPlaceholder || !adminDriverIndividualTripsTable) return;
    
    adminDriverIndividualTripsTableBody.innerHTML = '';

    if (individualTrips.length === 0) {
        adminDriverIndividualTripsPlaceholder.textContent = `Nenhuma viagem individual encontrada para ${capitalizeName(driverName)} em ${displayMonthYear}.`;
        adminDriverIndividualTripsTable.style.display = 'none';
        adminDriverIndividualTripsPlaceholder.style.display = 'block';
        return;
    }

    adminDriverIndividualTripsTable.style.display = 'table';
    adminDriverIndividualTripsPlaceholder.style.display = 'none';

    individualTrips.forEach(trip => {
        const row = adminDriverIndividualTripsTableBody.insertRow();
        row.insertCell().textContent = formatDisplayDate(trip.date);
        row.insertCell().textContent = formatCurrency(trip.freightValue);
        row.insertCell().textContent = formatCurrency(trip.totalExpenses);
        row.insertCell().textContent = formatCurrency(trip.netProfit);

        const actionsCell = row.insertCell();
        const viewDetailsButton = document.createElement('button');
        viewDetailsButton.className = 'control-btn small-btn view-trip-details-btn';
        viewDetailsButton.textContent = 'Ver Detalhes';
        viewDetailsButton.setAttribute('aria-label', `Ver detalhes da viagem de ${formatDisplayDate(trip.date)}`);
        viewDetailsButton.onclick = () => showAdminTripDetailModal(trip);
        actionsCell.appendChild(viewDetailsButton);
    });
}


function showAdminTripDetailModal(trip) {
    if(!adminTripDetailContent || !adminTripDetailModal) return;
    let fuelDetailsHtml = '<h4>Abastecimentos</h4>';
    if (trip.fuelEntries && trip.fuelEntries.length > 0) {
        trip.fuelEntries.forEach(entry => {
            fuelDetailsHtml += `
                <div class="fuel-entry-detail-item">
                    <p><strong>Litros:</strong> ${formatGenericNumber(entry.liters, 2, 2)}</p>
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
            <p><strong>Motorista:</strong> ${escapeHtml(capitalizeName(trip.driverName))}</p>
            <p><strong>Data:</strong> ${formatDisplayDate(trip.date)}</p>
            <p><strong>Km Inicial:</strong> ${formatGenericNumber(trip.kmInitial, 2, 2)}</p>
            <p><strong>Km Final:</strong> ${formatGenericNumber(trip.kmFinal, 2, 2)}</p>
            <p><strong>Km Rodados:</strong> ${formatGenericNumber(trip.kmDriven, 2, 2)}</p>
            <p><strong>Peso (Kg):</strong> ${formatGenericNumber(trip.weight, 2, 2)}</p>
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
            <p><strong>Descrição (Outras Despesas):</strong> ${escapeHtml(trip.expenseDescription) || 'Nenhuma'}</p>
        </div>
        <div class="trip-detail-section trip-financial-summary">
            <h4>Resumo Financeiro do Frete</h4>
            <p><strong>Valor do Frete:</strong> ${formatCurrency(trip.freightValue)}</p>
            <p><strong>Total de Combustível:</strong> ${formatCurrency(trip.totalFuelCost)}</p>
            <p><strong>Despesas Totais:</strong> ${formatCurrency(trip.totalExpenses)}</p>
            <p><strong>Lucro Líquido do Frete:</strong> <strong class="${trip.netProfit >= 0 ? 'profit' : 'loss'}">${formatCurrency(trip.netProfit)}</strong></p>
            <p><strong>Valor Declarado:</strong> ${formatCurrency(trip.declaredValue)}</p>
        </div>
    `;
    adminTripDetailModal.style.display = 'flex';
}

// --- USER MANAGEMENT FUNCTIONS (Admin Fabio) ---
async function loadAndRenderUsersForAdmin() {
    if (!userManagementTableBody) return;
    if (!loggedInUserProfile || loggedInUserProfile.role !== 'admin' || loggedInUserProfile.username !== 'fabio') {
        userManagementTableBody.innerHTML = '<tr><td colspan="3">Acesso negado.</td></tr>';
        return;
    }

    userManagementTableBody.innerHTML = '<tr><td colspan="3">Carregando usuários...</td></tr>';
    try {
        const q = query(userProfilesCollection, orderBy("username"));
        const querySnapshot = await getDocs(q);
        userProfiles = [];
        querySnapshot.forEach((docSnap) => {
            userProfiles.push({ id: docSnap.id, ...docSnap.data() });
        });

        renderUserManagementTable(userProfiles);
    } catch (error) {
        console.error("Error loading users for admin:", "Code:", error.code, "Message:", error.message);
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
        row.insertCell().textContent = capitalizeName(userProf.username);
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
    editUsernameDisplayInput.value = capitalizeName(userProf.username);
    editUserRoleSelect.value = userProf.role;
    editUserNewPasswordInput.value = '';
    editUserConfirmNewPasswordInput.value = '';
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
            showFeedback(editUserFeedback, "Papel do usuário atualizado. A alteração de senha por esta tela não é diretamente suportada. Se necessário, o administrador pode usar o console do Firebase ou o usuário pode redefinir sua própria senha.", "info");
        } else {
            showFeedback(editUserFeedback, "Papel do usuário atualizado com sucesso!", "success");
        }

        loadAndRenderUsersForAdmin();
        setTimeout(() => {
            if (closeEditUserModalBtn) closeEditUserModalBtn.click();
        }, 1500);

    } catch (error) {
        console.error("Error updating user role/password:", "Code:", error.code, "Message:", error.message);
        showFeedback(editUserFeedback, "Erro ao atualizar usuário. Tente novamente.", "error");
    }
}


// --- INITIALIZATION FUNCTIONS FOR VIEWS ---
function initializeUserView() {
    if (tripForm) tripForm.reset();
    if (fuelEntriesContainer) fuelEntriesContainer.innerHTML = '';
    fuelEntryIdCounter = 0;
    editingTripId = null;
    if (tripIdToEditInput) tripIdToEditInput.value = '';
    if (submitTripBtn) submitTripBtn.textContent = 'Salvar Frete';
    if (cancelEditBtn) cancelEditBtn.style.display = 'none';
    if (userFormFeedback) { userFormFeedback.textContent = ''; userFormFeedback.style.display = 'none';}

    if(driverNameInput && loggedInUserProfile) {
        driverNameInput.value = capitalizeName(loggedInUserProfile.username);
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
    populateAdminYearFilterSelect();
    if(adminDriverTripsSection) adminDriverTripsSection.style.display = 'none';
    if(adminDriverIndividualTripsSection) adminDriverIndividualTripsSection.style.display = 'none';


    if (!adminDriverFiltersContainer) {
        console.warn("Admin View Init: adminDriverFiltersContainer not found. Filters might not work.");
    } else {
        adminDriverFiltersContainer.style.display = 'none';
    }

    if(adminGeneralFeedback) { adminGeneralFeedback.textContent = ''; adminGeneralFeedback.style.display = 'none';}
    if (adminSummaryFilterStartDateInput) adminSummaryFilterStartDateInput.value = '';
    if (adminSummaryFilterEndDateInput) adminSummaryFilterEndDateInput.value = '';
    if (adminMonthFilterSelect) adminMonthFilterSelect.value = '';
    if (adminYearFilterSelect) adminYearFilterSelect.value = '';
    if (adminSelectDriver) adminSelectDriver.value = "";
    if (adminSelectedDriverNameDisplay) adminSelectedDriverNameDisplay.textContent = "Selecione um motorista para ver os resumos.";
    if (adminDriverTripsPlaceholder) adminDriverTripsPlaceholder.textContent = "Selecione um motorista para ver os resumos.";
    currentDriverMonthlySummaries = [];
    adminSelectedDriverUid = null;
    adminSelectedDriverName = null;
}

function initializeUserManagementView() {
     if (!loggedInUserProfile || loggedInUserProfile.role !== 'admin' || loggedInUserProfile.username !== 'fabio') return;
    loadAndRenderUsersForAdmin();
    if(adminCreateUserForm) adminCreateUserForm.reset();
    if(adminCreateUserFeedback) {adminCreateUserFeedback.textContent = ''; adminCreateUserFeedback.style.display = 'none';}
}

// --- FUNÇÃO DE EXPORTAÇÃO HTML ---
function convertToHTMLTable(dataArray, headers, reportMonthStr) {
    let tableHTML = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>Relatório de Fretes ${reportMonthStr}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                table { border-collapse: collapse; width: 100%; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; font-weight: bold; }
                tr:nth-child(even) { background-color: #f9f9f9; }
                h2 { color: #333; }
            </style>
        </head>
        <body>
            <h2>Relatório de Fretes - Mês ${escapeHtml(reportMonthStr)}</h2>
            <table>
                <thead>
                    <tr>`;
    headers.forEach(header => {
        tableHTML += `<th>${escapeHtml(header)}</th>`;
    });
    tableHTML += `
                    </tr>
                </thead>
                <tbody>`;
    dataArray.forEach(row => {
        tableHTML += '<tr>';
        row.forEach(cell => {
            tableHTML += `<td>${escapeHtml(cell)}</td>`;
        });
        tableHTML += '</tr>';
    });
    tableHTML += `
                </tbody>
            </table>
        </body>
        </html>`;
    return tableHTML;
}

async function handleExportAdminReport() {
    if (!loggedInUserProfile || loggedInUserProfile.role !== 'admin') {
        showFeedback(adminGeneralFeedback, "Apenas administradores podem exportar relatórios.", "error");
        return;
    }
    showFeedback(adminGeneralFeedback, "Gerando relatório do mês anterior...", "info");

    const today = new Date();
    let year = today.getFullYear();
    let month = today.getMonth();

    if (month === 0) {
        month = 11;
        year -= 1;
    } else {
        month -= 1;
    }

    const firstDayPrevMonth = new Date(year, month, 1);
    const lastDayPrevMonth = new Date(year, month + 1, 0);

    const startDate = firstDayPrevMonth.toISOString().split('T')[0];
    const endDate = lastDayPrevMonth.toISOString().split('T')[0];
    const reportMonthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

    try {
        const q = query(tripsCollection, where("date", ">=", startDate), where("date", "<=", endDate), orderBy("date", "asc"));
        const querySnapshot = await getDocs(q);
        const reportTrips = [];
        querySnapshot.forEach(docSnap => {
            reportTrips.push({ id: docSnap.id, ...docSnap.data() });
        });

        if (reportTrips.length === 0) {
            showFeedback(adminGeneralFeedback, `Nenhum frete encontrado para ${reportMonthStr} para exportar.`, "info");
            return;
        }
        
        const localUserProfilesForReport = [];
        const qProfiles = query(userProfilesCollection, orderBy("username"));
        const profileSnapshot = await getDocs(qProfiles);
        profileSnapshot.forEach(docSnap => {
            localUserProfilesForReport.push({ uid: docSnap.id, ...docSnap.data() });
        });
        const userMap = new Map(localUserProfilesForReport.map(p => [p.uid, p.username]));


        const headers = [
            "Data", "Motorista", "Km Inicial", "Km Final", "Km Rodados",
            "Peso (Kg)", "Valor Unidade (R$)", "Valor Frete Bruto (R$)",
            "Litros 1", "V/Litro 1", "Desc 1", "Total 1",
            "Litros 2", "V/Litro 2", "Desc 2", "Total 2",
            "Litros 3", "V/Litro 3", "Desc 3", "Total 3",
            "Litros 4", "V/Litro 4", "Desc 4", "Total 4",
            "Total Combustivel (R$)", "Arla-32 (R$)", "Pedagio (R$)",
            "Comissao (R$)", "Outras Despesas (R$)", "Descricao Outras Despesas",
            "Despesas Totais (R$)", "Lucro Liquido (R$)", "Valor Declarado (R$)"
        ];
        
        const dataForHTML = reportTrips.map(trip => {
            const rowData = [
                formatDisplayDate(trip.date),
                capitalizeName(userMap.get(trip.userId) || trip.driverName),
                formatGenericNumber(trip.kmInitial, 2, 2),
                formatGenericNumber(trip.kmFinal, 2, 2),
                formatGenericNumber(trip.kmDriven, 2, 2),
                formatGenericNumber(trip.weight, 2, 2),
                formatCurrency(trip.unitValue || 0),
                formatCurrency(trip.freightValue || 0),
            ];

            for (let i = 0; i < 4; i++) { // For up to 4 fuel entries
                if (trip.fuelEntries && trip.fuelEntries[i]) {
                    rowData.push(
                        formatGenericNumber(trip.fuelEntries[i].liters, 2, 2),
                        formatCurrency(trip.fuelEntries[i].valuePerLiter),
                        formatCurrency(trip.fuelEntries[i].discount),
                        formatCurrency(trip.fuelEntries[i].totalValue)
                    );
                } else {
                    rowData.push('', '', '', ''); // Empty cells if no entry
                }
            }

            rowData.push(
                formatCurrency(trip.totalFuelCost || 0),
                formatCurrency(trip.arla32Cost || 0),
                formatCurrency(trip.tollCost || 0),
                formatCurrency(trip.commissionCost || 0),
                formatCurrency(trip.otherExpenses || 0),
                trip.expenseDescription || '',
                formatCurrency(trip.totalExpenses || 0),
                formatCurrency(trip.netProfit || 0),
                formatCurrency(trip.declaredValue || 0)
            );
            return rowData;
        });


        const htmlString = convertToHTMLTable(dataForHTML, headers, reportMonthStr);
        const blob = new Blob([htmlString], { type: 'text/html;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `Relatorio_Fretes_${reportMonthStr}.html`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showFeedback(adminGeneralFeedback, `Relatório HTML para ${reportMonthStr} gerado e baixado. Por favor, anexe o arquivo .html em um e-mail para ibisolaribipitanga@gmail.com.`, "success");

    } catch (error) {
        console.error("Erro ao gerar relatório HTML:", error);
        showFeedback(adminGeneralFeedback, "Erro ao gerar relatório. Verifique o console.", "error");
    }
}


async function handleExcelFileImport(event) {
    const file = event.target.files[0];
    if (!file) {
        showFeedback(excelImportFeedback, "Nenhum arquivo selecionado.", "info");
        return;
    }

    if (!loggedInUserProfile || loggedInUserProfile.role !== 'admin') {
        showFeedback(excelImportFeedback, "Apenas administradores podem importar planilhas.", "error");
        return;
    }

    showFeedback(excelImportFeedback, "Processando arquivo Excel...", "info");
    const reader = new FileReader();

    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array', cellDates: true, cellNF: false, cellText: true });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: null });

            if (jsonData.length < 2) {
                showFeedback(excelImportFeedback, "Planilha vazia ou sem dados após o cabeçalho.", "error");
                return;
            }

            const headerRow = jsonData[0].map(header => String(header || '').trim().toLowerCase());
            const dataRows = jsonData.slice(1);

            const internalToSheetHeaderMap = {
                date: ["data"],
                driverName: ["motorista", "nome motorista", "motoristas"],
                kmInitial: ["km inicial", "km in", "km ini", "km inicial.", "kminicial"],
                kmFinal: ["km final", "km fn", "km fim", "km final.", "kmfinal"],
                weight: ["peso", "peso (kg)", "peso kg"],
                unitValue: ["v.un", "v. un", "v un", "valor unidade", "valor unitario", "valor/un", "valor_unidade"],
                freightValue: ["valor frete", "valor do frete", "vlr frete", "v. frete", "frete bruto", "valorfrete"],
                litros1: ["litros", "litro", "lts", "litros1", "litro1"],
                valor_litro1: ["v.litro", "v. litro", "valor litro", "v litro", "valor/litro", "valor_litro", "v.litro1", "valor_litro1"],
                desconto1: ["descont", "desconto", "desc", "desconto1", "desc1"],
                litros2: ["litros2", "litro2", "lts2"],
                valor_litro2: ["v.litro2", "v. litro2", "valor litro2", "v litro2", "valor/litro2", "valor_litro2"],
                desconto2: ["descont2", "desconto2", "desc2"],
                litros3: ["litros3", "litro3", "lts3"],
                valor_litro3: ["v.litro3", "v. litro3", "valor litro3", "v litro3", "valor/litro3", "valor_litro3"],
                desconto3: ["descont3", "desconto3", "desc3"],
                litros4: ["litros4", "litro4", "lts4"],
                valor_litro4: ["v.litro4", "v. litro4", "valor litro4", "v litro4", "valor/litro4", "valor_litro4"],
                desconto4: ["descont4", "desconto4", "desc4"],
                arla32Cost: ["arla-32", "arla32", "arla", "custo arla"],
                tollCost: ["pedágio", "pedagio", "pedágios", "pedagios"],
                commissionCost: ["comissão", "comissao", "comissões", "comissoes", "comiss"],
                otherExpenses: ["outras despesas", "outrasdespesas", "desp. adic.", "despesas adicionais"],
                expenseDescription: ["descrição outras despesas", "descricao outras despesas", "desc. outras", "detalhes despesas"],
                declaredValue: ["declarado", "valor declarado", "vlr declarado", "valordeclarado"],
            };

            const headerMap = {};
            for (const internalKey in internalToSheetHeaderMap) {
                for (const alias of internalToSheetHeaderMap[internalKey]) {
                    const index = headerRow.indexOf(alias);
                    if (index !== -1) {
                        headerMap[internalKey] = index;
                        break; 
                    }
                }
            }
            
            // Validação de cabeçalhos essenciais
            const essentialHeaders = ["date", "driverName", "freightValue"];
            for (const essential of essentialHeaders) {
                if (headerMap[essential] === undefined) {
                    throw new Error(`Coluna essencial "${internalToSheetHeaderMap[essential][0]}" não encontrada na planilha.`);
                }
            }


            const batch = writeBatch(db);
            let importCount = 0;
            const errorMessages = [];
            let importedTripsLog = "Viagens importadas com sucesso:\n";
            let skippedTripsLog = "Viagens ignoradas (já existentes ou erro):\n";


            const motoristasSnapshot = await getDocs(query(userProfilesCollection, where("role", "==", "motorista")));
            const motoristasMap = new Map();
            motoristasSnapshot.forEach(docSnap => {
                const profile = docSnap.data();
                motoristasMap.set(profile.username.trim().toLowerCase(), profile.uid);
            });


            for (let i = 0; i < dataRows.length; i++) {
                const rowArray = dataRows[i];
                if (!rowArray || rowArray.every(cell => cell === null || String(cell).trim() === '')) continue; 

                const driverNameFromSheet = String(rowArray[headerMap.driverName] || '').trim();
                const motoristaUid = motoristasMap.get(driverNameFromSheet.toLowerCase());

                if (!motoristaUid) {
                    errorMessages.push(`Linha ${i + 2}: Motorista "${driverNameFromSheet}" não encontrado no sistema. Cadastre-o primeiro.`);
                    skippedTripsLog += `Linha ${i + 2}: Motorista "${driverNameFromSheet}" não cadastrado.\n`;
                    continue;
                }
                
                let tripDateRaw = rowArray[headerMap.date];
                let tripDateFormatted;
                
                if (tripDateRaw instanceof Date) { // Se o XLSX já interpretou como Date
                     tripDateFormatted = formatDate(tripDateRaw);
                } else if (typeof tripDateRaw === 'number') { // Se for número de série do Excel
                    const excelEpoch = new Date(1899, 11, 30); // Excel epoch starts Dec 30, 1899
                    const jsDate = new Date(excelEpoch.getTime() + tripDateRaw * 24 * 60 * 60 * 1000);
                    tripDateFormatted = formatDate(jsDate);
                } else if (typeof tripDateRaw === 'string') { // Se for string (DD/MM/YYYY ou YYYY-MM-DD)
                    tripDateFormatted = formatDate(tripDateRaw.trim());
                } else {
                     errorMessages.push(`Linha ${i + 2}: Formato de data inválido ou não reconhecido: ${tripDateRaw}. Use YYYY-MM-DD ou DD/MM/YYYY.`);
                     skippedTripsLog += `Linha ${i+2}: Data inválida: ${tripDateRaw}\n`;
                     continue;
                }

                if (tripDateFormatted === 'Data inválida') {
                    errorMessages.push(`Linha ${i + 2}: Data inválida ou mal formatada: "${rowArray[headerMap.date]}". Use YYYY-MM-DD ou DD/MM/YYYY.`);
                    skippedTripsLog += `Linha ${i+2}: Data mal formatada: ${rowArray[headerMap.date]}\n`;
                    continue;
                }


                const existingTripQuery = query(tripsCollection, 
                    where("userId", "==", motoristaUid), 
                    where("date", "==", tripDateFormatted)
                );
                const existingTripSnapshot = await getDocs(existingTripQuery);

                if (!existingTripSnapshot.empty) {
                     skippedTripsLog += `Linha ${i + 2}: Viagem para ${driverNameFromSheet} em ${formatDisplayDate(tripDateFormatted)} já existe. Ignorando.\n`;
                    continue; 
                }


                const fuelEntries = [];
                let totalFuelCostSheet = 0;
                for (let j = 1; j <= 4; j++) { 
                    const liters = parseNumericValueFromString(String(rowArray[headerMap[`litros${j}`]] || '0').trim());
                    const valuePerLiter = parseNumericValueFromString(String(rowArray[headerMap[`valor_litro${j}`]] || '0').trim());
                    const discount = parseNumericValueFromString(String(rowArray[headerMap[`desconto${j}`]] || '0').trim());

                    if (liters > 0 && valuePerLiter > 0) {
                        const totalValue = (liters * valuePerLiter) - discount;
                        fuelEntries.push({ id: generateId(), liters, valuePerLiter, discount, totalValue });
                        totalFuelCostSheet += totalValue;
                    }
                }
                
                const kmInitialSheet = parseNumericValueFromString(String(rowArray[headerMap.kmInitial] || '0').trim());
                const kmFinalSheet = parseNumericValueFromString(String(rowArray[headerMap.kmFinal] || '0').trim());
                const freightValueSheet = parseNumericValueFromString(String(rowArray[headerMap.freightValue] || '0').trim());

                if (freightValueSheet <= 0) {
                     errorMessages.push(`Linha ${i + 2}: Valor do frete não pode ser zero ou negativo. Motorista: ${driverNameFromSheet}, Data: ${tripDateFormatted}`);
                     skippedTripsLog += `Linha ${i+2}: Valor do frete inválido (${driverNameFromSheet}, ${formatDisplayDate(tripDateFormatted)})\n`;
                     continue;
                }

                const arla32CostSheet = parseNumericValueFromString(String(rowArray[headerMap.arla32Cost] || '0').trim());
                const tollCostSheet = parseNumericValueFromString(String(rowArray[headerMap.tollCost] || '0').trim());
                const commissionCostSheet = parseNumericValueFromString(String(rowArray[headerMap.commissionCost] || '0').trim());
                const otherExpensesSheet = parseNumericValueFromString(String(rowArray[headerMap.otherExpenses] || '0').trim());

                const totalExpensesSheet = totalFuelCostSheet + arla32CostSheet + tollCostSheet + otherExpensesSheet + commissionCostSheet;
                const netProfitSheet = freightValueSheet - totalExpensesSheet;

                const newTrip = {
                    userId: motoristaUid,
                    driverName: driverNameFromSheet,
                    date: tripDateFormatted,
                    kmInitial: kmInitialSheet,
                    kmFinal: kmFinalSheet,
                    kmDriven: (kmFinalSheet > kmInitialSheet) ? kmFinalSheet - kmInitialSheet : 0,
                    weight: parseNumericValueFromString(String(rowArray[headerMap.weight] || '0').trim()),
                    unitValue: parseNumericValueFromString(String(rowArray[headerMap.unitValue] || '0').trim()),
                    freightValue: freightValueSheet,
                    fuelEntries: fuelEntries,
                    arla32Cost: arla32CostSheet,
                    tollCost: tollCostSheet,
                    commissionCost: commissionCostSheet,
                    otherExpenses: otherExpensesSheet,
                    expenseDescription: String(rowArray[headerMap.expenseDescription] || '').trim(),
                    totalFuelCost: totalFuelCostSheet,
                    totalExpenses: totalExpensesSheet,
                    netProfit: netProfitSheet,
                    declaredValue: parseNumericValueFromString(String(rowArray[headerMap.declaredValue] || '0').trim()),
                    createdAt: Timestamp.now(),
                };
                
                const newTripRef = doc(tripsCollection); 
                batch.set(newTripRef, newTrip);
                importCount++;
                importedTripsLog += `Linha ${i + 2}: ${driverNameFromSheet}, ${formatDisplayDate(tripDateFormatted)}, Frete: ${formatCurrency(newTrip.freightValue)}\n`;
            }

            if (importCount > 0) {
                await batch.commit();
                let successMsg = `${importCount} frete(s) importado(s) com sucesso!\n\n${importedTripsLog}`;
                if (skippedTripsLog.length > "Viagens ignoradas (já existentes ou erro):\n".length) {
                     successMsg += `\n${skippedTripsLog}`;
                }
                if (errorMessages.length > 0) {
                    successMsg += "\n\nErros detalhados:\n" + errorMessages.join("\n");
                }
                showFeedback(excelImportFeedback, successMsg, "success");
                updateAdminSummary();
                if (adminSelectedDriverUid) {
                    loadAndRenderAdminDriverMonthlySummaries();
                }
            } else {
                let noImportMsg = "Nenhum frete novo para importar.\n";
                if (skippedTripsLog.length > "Viagens ignoradas (já existentes ou erro):\n".length) {
                     noImportMsg += `\n${skippedTripsLog}`;
                }
                if (errorMessages.length > 0) {
                     noImportMsg += "\n\nErros encontrados:\n" + errorMessages.join("\n");
                } else if (importCount === 0 && dataRows.length > 0 && errorMessages.length === 0) {
                    noImportMsg = "Nenhum frete novo encontrado na planilha ou todos já existiam no sistema.\n" + skippedTripsLog;
                }
                showFeedback(excelImportFeedback, noImportMsg, errorMessages.length > 0 ? "error" : "info");
            }

        } catch (error) {
            console.error("Erro ao processar planilha Excel:", error);
            showFeedback(excelImportFeedback, `Erro ao processar planilha: ${error.message}. Verifique o formato do arquivo e os cabeçalhos.`, "error");
        } finally {
            if (excelFileInput) excelFileInput.value = ''; // Reset file input
        }
    };
    reader.onerror = () => {
        showFeedback(excelImportFeedback, "Falha ao ler o arquivo.", "error");
        if (excelFileInput) excelFileInput.value = '';
    };
    reader.readAsArrayBuffer(file);
}

// --- EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded event fired.");

    const loginUsernameInput = document.getElementById('loginUsername');
    if (loginUsernameInput) {
        loginUsernameInput.addEventListener('input', function() {
            this.value = this.value.toLowerCase();
        });
        console.log("Event listener 'input' added to loginUsername for lowercase conversion.");
    } else {
        console.error("loginUsername input field not found for adding lowercase listener.");
    }


    if (!app || !authFirebase || !db || !userProfilesCollection || !tripsCollection) {
        console.error("CRITICAL DOMContentLoaded: Firebase not initialized correctly or collections not set. App listeners not added.");
        const body = document.querySelector('body');
        if (body) {
            const errorDiv = document.createElement('div');
            errorDiv.textContent = "ERRO CRÍTICO: FALHA AO CONECTAR AOS SERVIÇOS DE DADOS. VERIFIQUE O CONSOLE.";
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
    console.log("Firebase seems initialized, proceeding to add event listeners.");


    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    } else { console.error("loginForm not found!");}

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
        if(submitTripBtn) submitTripBtn.textContent = 'Salvar Frete';
        if(cancelEditBtn) cancelEditBtn.style.display = 'none';
        if(driverNameInput && loggedInUserProfile) driverNameInput.value = capitalizeName(loggedInUserProfile.username);
        addFuelEntryToForm();
        showFeedback(userFormFeedback, "Edição cancelada.", "info");
    });

    if (loadMyTripsBtn && myTripsDriverNameInput) {
        loadMyTripsBtn.addEventListener('click', async () => {
            const driverNameToSearch = myTripsDriverNameInput.value.trim().toLowerCase();
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
                    showFeedback(myTripsFeedback, `Motorista "${myTripsDriverNameInput.value.trim()}" não encontrado.`, "error");
                    if (myTripsTableBody) myTripsTableBody.innerHTML = '';
                    if (myTripsTablePlaceholder) myTripsTablePlaceholder.textContent = `Nenhum motorista encontrado com o nome "${myTripsDriverNameInput.value.trim()}".`;
                    if (myTripsTable) myTripsTable.style.display = 'none';
                    if (myTripsTablePlaceholder) myTripsTablePlaceholder.style.display = 'block';
                    updateDriverSummary([], myTripsDriverNameInput.value.trim());
                }
            } catch(err) {
                console.error("Error searching driver by name:", "Code:", err.code, "Message:", err.message);
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
    if (exportAdminReportBtn) {
        exportAdminReportBtn.addEventListener('click', handleExportAdminReport);
    }
    if (importExcelBtn && excelFileInput) {
        importExcelBtn.addEventListener('click', () => {
            if (excelFileInput.files && excelFileInput.files[0]) {
                handleExcelFileImport({ target: { files: excelFileInput.files } });
            } else {
                showFeedback(excelImportFeedback, "Por favor, selecione um arquivo Excel primeiro.", "info");
            }
        });
    }


    if (adminLoadDriverTripsBtn) {
        adminLoadDriverTripsBtn.addEventListener('click', loadAndRenderAdminDriverMonthlySummaries);
    }
    if (adminMonthFilterSelect) {
        adminMonthFilterSelect.addEventListener('change', renderAdminDriverMonthlySummariesTable);
    }
    if (adminYearFilterSelect) {
        adminYearFilterSelect.addEventListener('change', renderAdminDriverMonthlySummariesTable);
    }

    if(closeAdminTripDetailModalBtn && adminTripDetailModal) {
        closeAdminTripDetailModalBtn.addEventListener('click', () => adminTripDetailModal.style.display = 'none');
    }
    if (printAdminTripDetailBtn) {
        printAdminTripDetailBtn.addEventListener('click', () => {
            if (adminTripDetailModal && adminTripDetailModal.style.display === 'flex') {
                window.print();
            } else {
                console.warn("Print button clicked, but admin trip detail modal is not visible.");
                 showFeedback(adminGeneralFeedback, "Abra os detalhes de um frete para imprimir.", "info");
            }
        });
    }


    if(editUserForm) editUserForm.addEventListener('submit', handleEditUserFormSubmit);
    if(closeEditUserModalBtn && editUserModal) {
        closeEditUserModalBtn.addEventListener('click', () => editUserModal.style.display = 'none');
    }

    if (adminCreateUserForm) {
        adminCreateUserForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const username = adminCreateUsernameInput.value.trim();
            const role = adminCreateUserRoleSelect.value;
            const password = adminCreateUserPasswordInput.value;
            const confirmPassword = adminCreateUserConfirmPasswordInput.value;

            const normalizedUsernamePart = normalizeUsernameForEmail(username);

            if (!username) {
                showFeedback(adminCreateUserFeedback, "Nome de usuário é obrigatório.", "error"); return;
            }
            if (!normalizedUsernamePart || normalizedUsernamePart.includes("user.invalid")) {
                 showFeedback(adminCreateUserFeedback, `Nome de usuário "${username}" inválido. Use letras ou números e evite apenas espaços ou caracteres especiais.`, "error"); return;
            }
            if (!password || password.length < 6) {
                showFeedback(adminCreateUserFeedback, "Senha deve ter pelo menos 6 caracteres.", "error"); return;
            }
            if (password !== confirmPassword) {
                showFeedback(adminCreateUserFeedback, "As senhas não coincidem.", "error"); return;
            }

            const email = `${normalizedUsernamePart}@example.com`;

            try {
                if (adminCreateUserBtn) {
                    adminCreateUserBtn.disabled = true;
                    adminCreateUserBtn.textContent = 'Cadastrando...';
                }

                const userCredential = await createUserWithEmailAndPassword(authFirebase, email, password);
                const firebaseUser = userCredential.user;

                const newUserProfile = {
                    uid: firebaseUser.uid,
                    username: username, // Store the original, non-normalized username for display
                    email: firebaseUser.email || email,
                    role: role,
                    createdAt: Timestamp.now()
                };
                await firebaseSetDoc(doc(userProfilesCollection, firebaseUser.uid), newUserProfile);
                showFeedback(adminCreateUserFeedback, `Usuário "${capitalizeName(username)}" (${role}) cadastrado com sucesso!`, "success");
                adminCreateUserForm.reset();
                loadAndRenderUsersForAdmin(); 
                populateAdminDriverSelect(); 

            } catch (error) {
                console.error("Error creating user from admin panel:", "Code:", error.code, "Message:", error.message);
                if (error.code === 'auth/email-already-in-use') {
                    showFeedback(adminCreateUserFeedback, `Nome de usuário "${username}" (ou e-mail derivado: ${email}) já existe. Tente outro.`, "error");
                } else if (error.code === 'auth/weak-password') {
                    showFeedback(adminCreateUserFeedback, "Senha muito fraca.", "error");
                } else if (error.code === 'auth/invalid-email') {
                    showFeedback(adminCreateUserFeedback, `O nome de usuário "${username}" resultou em um e-mail inválido ("${email}"). Tente outro nome.`, "error");
                } else {
                    showFeedback(adminCreateUserFeedback, "Erro ao cadastrar usuário. Verifique o console.", "error");
                }
            } finally {
                 if (adminCreateUserBtn) {
                    adminCreateUserBtn.disabled = false;
                    adminCreateUserBtn.textContent = 'Cadastrar Usuário';
                }
            }
        });
    }

    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        const modalElement = modal;
        if(modalElement) {
            modalElement.style.display = 'none';
            modalElement.addEventListener('click', (event) => {
                if (event.target === modalElement) {
                    modalElement.style.display = 'none';
                }
            });
        }
    });
    console.log("All DOMContentLoaded event listeners nominally set up.");
});
