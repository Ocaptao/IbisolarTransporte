

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
import {
    getStorage,
    ref as storageRef,
    uploadBytesResumable,
    getDownloadURL,
    deleteObject
} from "@firebase/storage";
import * as XLSX from 'xlsx';

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
let storage; // Firebase Storage instance
let userProfilesCollection;
let tripsCollection;


try {
    app = initializeApp(firebaseConfig);
    authFirebase = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app); // Initialize Storage
    userProfilesCollection = collection(db, "userProfiles");
    tripsCollection = collection(db, "trips");
    console.log("Firebase initialized successfully (including Storage)!");
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
const appContainer = document.getElementById('appContainer');
const loginForm = document.getElementById('loginForm');
const tripForm = document.getElementById('tripForm');
const loginFeedback = document.getElementById('loginFeedback');
const userFormFeedback = document.getElementById('userFormFeedback');
const myTripsFeedback = document.getElementById('myTripsFeedback');
const adminGeneralFeedback = document.getElementById('adminGeneralFeedback');
const userManagementFeedback = document.getElementById('userManagementFeedback');
const editUserFeedback = document.getElementById('editUserFeedback');

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

// Attachment DOM Elements
const tripAttachmentsInput = document.getElementById('tripAttachments');
const tripAttachmentsFeedback = document.getElementById('tripAttachmentsFeedback');
const adminTripAttachmentsSection = document.getElementById('adminTripAttachmentsSection');
const adminTripAttachmentsList = document.getElementById('adminTripAttachmentsList');


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

const adminCreateUserForm = document.getElementById('adminCreateUserForm');
const adminCreateUsernameInput = document.getElementById('adminCreateUsername');
const adminCreateUserRoleSelect = document.getElementById('adminCreateUserRole');
const adminCreateUserPasswordInput = document.getElementById('adminCreateUserPassword');
const adminCreateUserConfirmPasswordInput = document.getElementById('adminCreateUserConfirmPassword');
const adminCreateUserFeedback = document.getElementById('adminCreateUserFeedback');

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

    strValue = strValue.replace(/R\$\s?/g, ''); 

    const hasComma = strValue.includes(',');
    const dotCount = (strValue.match(/\./g) || []).length;

    if (hasComma) {
        strValue = strValue.replace(/\./g, ''); 
        strValue = strValue.replace(/,/g, '.'); 
    } else {
        if (dotCount > 1) {
            strValue = strValue.replace(/\./g, ''); 
        }
    }

    const num = parseFloat(strValue);
    return isNaN(num) ? 0 : num;
}

function formatDate(dateInput) {
    if (!dateInput) return 'Data inválida';
    let dateToFormat;

    if (typeof dateInput === 'string') {
        const trimmedDateInput = dateInput.trim();
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmedDateInput)) { 
            const parts = trimmedDateInput.split('/');
            dateToFormat = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
        } else if (!trimmedDateInput.includes('T') && /^\d{4}-\d{2}-\d{2}$/.test(trimmedDateInput)) { 
            dateToFormat = new Date(trimmedDateInput + 'T00:00:00Z'); 
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

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
        if(tripAttachmentsInput) tripAttachmentsInput.value = '';
        if(tripAttachmentsFeedback) tripAttachmentsFeedback.innerHTML = '';

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

// Function to compress image before upload
async function compressImage(file, maxSizeKB = 500, maxWidthOrHeight = 1920, quality = 0.7) {
    if (!file.type.startsWith('image/')) {
        return file; // Not an image
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidthOrHeight) {
                        height = Math.round((height * maxWidthOrHeight) / width);
                        width = maxWidthOrHeight;
                    }
                } else {
                    if (height > maxWidthOrHeight) {
                        width = Math.round((width * maxWidthOrHeight) / height);
                        height = maxWidthOrHeight;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(
                    (blob) => {
                        if (blob && blob.size / 1024 < maxSizeKB && blob.size < file.size) {
                            resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
                        } else {
                            resolve(file); // Original file if compression not effective or resulted in larger size
                        }
                    },
                    'image/jpeg',
                    quality
                );
            };
            img.onerror = reject;
            img.src = event.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}


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
        totalValueInput.value = total.toFixed(2).replace('.', ','); 
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

    if(submitTripBtn) {
        submitTripBtn.disabled = true;
        submitTripBtn.textContent = 'Salvando...';
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
        attachments: [] // Initialize attachments array
    };

    // Handle file attachments
    const filesToUpload = tripAttachmentsInput.files;
    const uploadedAttachmentsData = [];

    const currentTripId = editingTripId || doc(tripsCollection).id; // Get ID for storage path

    if (filesToUpload && filesToUpload.length > 0) {
        showFeedback(userFormFeedback, `Enviando ${filesToUpload.length} anexos...`, "info");
        for (let i = 0; i < filesToUpload.length; i++) {
            let file = filesToUpload[i];
            try {
                const compressedFile = await compressImage(file); // Compress if image
                const fileName = `${Date.now()}_${compressedFile.name}`;
                const attachmentRef = storageRef(storage, `trips/${currentTripId}/attachments/${fileName}`);
                
                const uploadTask = uploadBytesResumable(attachmentRef, compressedFile);

                await new Promise((resolve, reject) => {
                    uploadTask.on('state_changed',
                        (snapshot) => {
                            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                            console.log(`Upload de ${fileName} está ${progress}% concluído`);
                        },
                        (error) => {
                            console.error(`Erro no upload do anexo ${fileName}:`, error);
                            reject(error);
                        },
                        async () => {
                            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                            uploadedAttachmentsData.push({
                                name: compressedFile.name,
                                url: downloadURL,
                                type: compressedFile.type,
                                size: compressedFile.size,
                                storagePath: attachmentRef.fullPath,
                                uploadedAt: Timestamp.now()
                            });
                            resolve();
                        }
                    );
                });
            } catch (error) {
                console.error(`Falha ao processar ou enviar o anexo ${file.name}:`, error);
                showFeedback(userFormFeedback, `Falha ao enviar o anexo ${file.name}.`, "error");
                // Optionally, decide if a single attachment failure should stop the whole process
            }
        }
    }


    try {
        if (editingTripId) {
            const tripRef = doc(tripsCollection, editingTripId);
            const existingTripDoc = await getDoc(tripRef);
            const existingAttachments = existingTripDoc.exists() ? (existingTripDoc.data().attachments || []) : [];
            tripDataObjectFromForm.attachments = [...existingAttachments, ...uploadedAttachmentsData];
            await updateDoc(tripRef, tripDataObjectFromForm);
            showFeedback(userFormFeedback, "Frete atualizado com sucesso!", "success");
        } else {
            tripDataObjectFromForm.createdAt = Timestamp.now();
            tripDataObjectFromForm.attachments = uploadedAttachmentsData;
            // Use the pre-generated currentTripId if it was a new trip
            const newTripDocRef = doc(tripsCollection, currentTripId);
            await firebaseSetDoc(newTripDocRef, tripDataObjectFromForm);
            showFeedback(userFormFeedback, "Frete registrado com sucesso!", "success");
        }

        if(tripForm) tripForm.reset();
        if(fuelEntriesContainer) fuelEntriesContainer.innerHTML = '';
        if(tripAttachmentsInput) tripAttachmentsInput.value = '';
        if(tripAttachmentsFeedback) tripAttachmentsFeedback.innerHTML = '';
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
    } finally {
        if (submitTripBtn) {
            submitTripBtn.disabled = false;
            submitTripBtn.textContent = editingTripId ? 'Salvar Alterações' : 'Salvar Frete';
        }
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
            if(tripAttachmentsInput) tripAttachmentsInput.value = ''; // Clear file input
            if(tripAttachmentsFeedback) tripAttachmentsFeedback.innerHTML = ''; // Clear feedback

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

            // Display existing attachments
            if (trip.attachments && trip.attachments.length > 0 && tripAttachmentsFeedback) {
                const ul = document.createElement('ul');
                ul.innerHTML = '<li><strong>Anexos existentes (não podem ser removidos nesta tela, novos serão adicionados):</strong></li>';
                trip.attachments.forEach(att => {
                    const li = document.createElement('li');
                    li.textContent = `${escapeHtml(att.name)} (${formatFileSize(att.size)})`;
                    ul.appendChild(li);
                });
                tripAttachmentsFeedback.appendChild(ul);
            }


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
    
    let originalTripDataForAttachments = null;
    if (tripToDelete && tripToDelete.attachments) { // Check local cache first
        originalTripDataForAttachments = tripToDelete;
    }

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

    if (confirm(`Tem certeza que deseja excluir o frete de ${capitalizeName(driverNameForConfirm)}? Esta ação não pode ser desfeita e também excluirá todos os anexos associados.`)) {
        deleteTrip(tripId, originalTripDataForAttachments);
    }
}

async function deleteTrip(tripId, tripDataWithAttachments = null) {
    try {
        let attachmentsToDelete = tripDataWithAttachments ? tripDataWithAttachments.attachments : null;

        // If attachments not passed, fetch the trip doc to get them
        if (!attachmentsToDelete) {
            const tripDocRef = doc(tripsCollection, tripId);
            const tripDocSnapshot = await getDoc(tripDocRef);
            if (tripDocSnapshot.exists()) {
                attachmentsToDelete = tripDocSnapshot.data().attachments;
            }
        }
        
        // Delete attachments from Storage
        if (attachmentsToDelete && attachmentsToDelete.length > 0) {
            showFeedback(myTripsFeedback, "Excluindo anexos...", "info");
            for (const attachment of attachmentsToDelete) {
                if (attachment.storagePath) {
                    try {
                        const fileRef = storageRef(storage, attachment.storagePath);
                        await deleteObject(fileRef);
                        console.log(`Anexo ${attachment.name} excluído do Storage.`);
                    } catch (storageError) {
                        console.error(`Erro ao excluir anexo ${attachment.name} do Storage:`, storageError);
                        // Non-fatal, continue to delete Firestore doc
                    }
                }
            }
        }

        // Delete trip document from Firestore
        await deleteDoc(doc(tripsCollection, tripId));
        showFeedback(myTripsFeedback, "Frete e seus anexos excluídos com sucesso.", "success");

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
    if(!adminTripDetailContent || !adminTripDetailModal || !adminTripAttachmentsSection || !adminTripAttachmentsList) return;
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

    // Display attachments
    adminTripAttachmentsList.innerHTML = ''; // Clear previous
    if (trip.attachments && trip.attachments.length > 0) {
        const ul = document.createElement('ul');
        trip.attachments.forEach(att => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span class="attachment-info">
                    <a href="${escapeHtml(att.url)}" target="_blank" class="filename">${escapeHtml(att.name)}</a>
                </span>
                <span class="attachment-meta">
                    (${formatFileSize(att.size)}) - ${formatDisplayDate(att.uploadedAt)}
                </span>`;
            ul.appendChild(li);
        });
        adminTripAttachmentsList.appendChild(ul);
        adminTripAttachmentsSection.style.display = 'block';
    } else {
        adminTripAttachmentsList.innerHTML = '<p>Nenhum anexo.</p>';
        adminTripAttachmentsSection.style.display = 'block'; // Show section even if no attachments, to display "Nenhum anexo"
    }

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
        showFeedback(userManagementFeedback, `Erro ao carregar usuários. (${error.message})`, "error");
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

    usersToRender.forEach(user => {
        const row = userManagementTableBody.insertRow();
        row.insertCell().textContent = capitalizeName(user.username);
        row.insertCell().textContent = user.role === 'admin' ? 'Administrador' : 'Motorista';

        const actionsCell = row.insertCell();
        const editButton = document.createElement('button');
        editButton.className = 'control-btn small-btn';
        editButton.textContent = 'Editar';
        editButton.setAttribute('aria-label', `Editar usuário ${user.username}`);
        editButton.onclick = () => openEditUserModal(user.id);
        actionsCell.appendChild(editButton);

        if (user.username !== 'fabio' && user.username !== loggedInUserProfile.username) {
            const deleteButton = document.createElement('button');
            deleteButton.className = 'control-btn danger-btn small-btn delete-user-btn';
            deleteButton.textContent = 'Excluir';
            deleteButton.setAttribute('aria-label', `Excluir usuário ${user.username}`);
            deleteButton.onclick = () => confirmDeleteUser(user.id, user.username);
            actionsCell.appendChild(deleteButton);
        }
    });
}

function openEditUserModal(userId) {
    const userToEdit = userProfiles.find(u => u.id === userId);
    if (!userToEdit) {
        showFeedback(userManagementFeedback, "Usuário não encontrado para edição.", "error");
        return;
    }

    editingUserIdForAdmin = userToEdit.id;
    if(editUserIdInput) editUserIdInput.value = userToEdit.id;
    if(editUsernameDisplayInput) editUsernameDisplayInput.value = capitalizeName(userToEdit.username);
    if(editUserRoleSelect) editUserRoleSelect.value = userToEdit.role;
    if(editUserNewPasswordInput) editUserNewPasswordInput.value = '';
    if(editUserConfirmNewPasswordInput) editUserConfirmNewPasswordInput.value = '';
    if(editUserFeedback) {editUserFeedback.textContent = ''; editUserFeedback.style.display = 'none';}

    if(editUserModal) editUserModal.style.display = 'flex';
}

async function handleEditUserSubmit(event) {
    event.preventDefault();
    if (!editingUserIdForAdmin) {
        showFeedback(editUserFeedback, "Nenhum usuário selecionado para edição.", "error");
        return;
    }

    const newRole = editUserRoleSelect.value;
    const newPassword = editUserNewPasswordInput.value;
    const confirmNewPassword = editUserConfirmNewPasswordInput.value;

    if (newPassword && newPassword.length < 6) {
        showFeedback(editUserFeedback, "A nova senha deve ter pelo menos 6 caracteres.", "error");
        return;
    }
    if (newPassword && newPassword !== confirmNewPassword) {
        showFeedback(editUserFeedback, "As senhas não coincidem.", "error");
        return;
    }

    try {
        const userProfileRef = doc(userProfilesCollection, editingUserIdForAdmin);
        await updateDoc(userProfileRef, { role: newRole });

        if (newPassword) {
            const userToUpdate = authFirebase.currentUser;
            if (userToUpdate && userToUpdate.uid === editingUserIdForAdmin) {
                await updateUserPasswordInAuth(userToUpdate, newPassword);
                console.log("Password updated in Auth for current user.");
            } else {
                console.warn("Attempting to update password for a user who is not the currently logged-in user. This requires admin privileges and a different Firebase Admin SDK function, not available client-side directly.");
                showFeedback(editUserFeedback, "Senha atualizada no perfil, mas a alteração de senha para outros usuários requer backend com Admin SDK.", "info");
            }
        }

        showFeedback(editUserFeedback, "Usuário atualizado com sucesso!", "success");
        loadAndRenderUsersForAdmin(); 
        populateAdminDriverSelect(); 
        setTimeout(() => {
            if(editUserModal) editUserModal.style.display = 'none';
            editingUserIdForAdmin = null;
        }, 1500);

    } catch (error) {
        console.error("Error updating user:", "Code:", error.code, "Message:", error.message);
        let feedbackMsg = "Erro ao atualizar usuário.";
        if (error.code === 'auth/requires-recent-login' && newPassword) {
            feedbackMsg = "Para alterar a senha, você precisa ter feito login recentemente. Faça logout e login novamente.";
        }
        showFeedback(editUserFeedback, `${feedbackMsg} (${error.message})`, "error");
    }
}

function confirmDeleteUser(userId, username) {
     if (username === 'fabio') {
        showFeedback(userManagementFeedback, "O usuário 'fabio' não pode ser excluído.", "error");
        return;
    }
    if (loggedInUser && loggedInUserProfile && username === loggedInUserProfile.username) {
        showFeedback(userManagementFeedback, "Você não pode excluir seu próprio usuário.", "error");
        return;
    }

    if (confirm(`Tem certeza que deseja excluir o usuário ${capitalizeName(username)}? Esta ação NÃO pode ser desfeita e removerá o perfil, mas não exclui automaticamente o usuário da autenticação do Firebase (isso precisa ser feito manualmente no console do Firebase ou via Admin SDK).`)) {
        deleteUserProfile(userId);
    }
}

async function deleteUserProfile(userId) {
    try {
        await deleteDoc(doc(userProfilesCollection, userId));
        showFeedback(userManagementFeedback, "Perfil de usuário excluído com sucesso do Firestore. Lembre-se de excluir o usuário da Autenticação no console do Firebase, se necessário.", "success");
        loadAndRenderUsersForAdmin(); 
        populateAdminDriverSelect(); 
    } catch (error) {
        console.error("Error deleting user profile from Firestore:", "Code:", error.code, "Message:", error.message);
        showFeedback(userManagementFeedback, `Erro ao excluir perfil de usuário. (${error.message})`, "error");
    }
}

async function handleAdminCreateUserFormSubmit(event) {
    event.preventDefault();
    if (!adminCreateUsernameInput || !adminCreateUserRoleSelect || !adminCreateUserPasswordInput || !adminCreateUserConfirmPasswordInput || !adminCreateUserFeedback) {
        console.error("Um ou mais elementos do formulário de criação de usuário não foram encontrados.");
        return;
    }

    const rawUsername = adminCreateUsernameInput.value.trim();
    const role = adminCreateUserRoleSelect.value;
    const password = adminCreateUserPasswordInput.value;
    const confirmPassword = adminCreateUserConfirmPasswordInput.value;

    if (!rawUsername) {
        showFeedback(adminCreateUserFeedback, "Nome de usuário é obrigatório.", "error");
        return;
    }
    if (password.length < 6) {
        showFeedback(adminCreateUserFeedback, "A senha deve ter pelo menos 6 caracteres.", "error");
        return;
    }
    if (password !== confirmPassword) {
        showFeedback(adminCreateUserFeedback, "As senhas não coincidem.", "error");
        return;
    }

    const normalizedUsernamePart = normalizeUsernameForEmail(rawUsername);
    if (!normalizedUsernamePart || normalizedUsernamePart.includes("user.invalid")) {
        showFeedback(adminCreateUserFeedback, `Nome de usuário "${rawUsername}" inválido. Use letras e números, sem espaços ou caracteres especiais complexos.`, "error");
        return;
    }
    const emailForAuth = `${normalizedUsernamePart}@example.com`;

    try {
        const userCredential = await createUserWithEmailAndPassword(authFirebase, emailForAuth, password);
        const newUserUid = userCredential.user.uid;
        
        const userProfileData = {
            uid: newUserUid,
            username: rawUsername, 
            email: emailForAuth, 
            role: role,
            createdAt: Timestamp.now()
        };
        await firebaseSetDoc(doc(userProfilesCollection, newUserUid), userProfileData);

        showFeedback(adminCreateUserFeedback, `Usuário "${capitalizeName(rawUsername)}" criado com sucesso!`, "success");
        if(adminCreateUserForm) adminCreateUserForm.reset();
        loadAndRenderUsersForAdmin(); 
        populateAdminDriverSelect(); 

    } catch (error) {
        console.error("Error creating new user:", "Code:", error.code, "Message:", error.message);
        let feedbackMessage = "Erro ao criar usuário.";
        if (error.code === 'auth/email-already-in-use') {
            feedbackMessage = `Este nome de usuário ("${capitalizeName(rawUsername)}") já está em uso ou resulta em um e-mail de autenticação (${emailForAuth}) já cadastrado.`;
        } else if (error.code === 'auth/invalid-email') {
            feedbackMessage = `O nome de usuário "${capitalizeName(rawUsername)}" resultou em um e-mail inválido (${emailForAuth}) para autenticação.`;
        } else if (error.code === 'auth/weak-password') {
            feedbackMessage = "A senha fornecida é muito fraca.";
        }
        showFeedback(adminCreateUserFeedback, `${feedbackMessage} (${error.message})`, "error");
    }
}

// --- HTML REPORT EXPORT ---
async function handleExportAdminReport() {
    console.log("handleExportAdminReport function called");
    let startDate = null;
    let endDate = null;
    let reportPeriodTitle = "Geral Completo";
    let fileNameSuffix = "Geral_Completo";

    const startDateInput = document.getElementById('adminSummaryFilterStartDate');
    const endDateInput = document.getElementById('adminSummaryFilterEndDate');

    if (startDateInput && endDateInput) {
        startDate = startDateInput.value;
        endDate = endDateInput.value;

        if (startDate && endDate) {
            reportPeriodTitle = `Período: ${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}`;
            fileNameSuffix = `${formatDate(startDate)}_a_${formatDate(endDate)}`;
        } else if (startDate) {
            reportPeriodTitle = `A partir de: ${formatDisplayDate(startDate)}`;
            fileNameSuffix = `Desde_${formatDate(startDate)}`;
        } else if (endDate) {
            reportPeriodTitle = `Até: ${formatDisplayDate(endDate)}`;
            fileNameSuffix = `Ate_${formatDate(endDate)}`;
        }
    } else {
        console.warn("Admin summary filter date inputs not found. Exporting full report.");
    }

    try {
        let q = query(tripsCollection, orderBy("date", "desc"));
        if (startDate) q = query(q, where("date", ">=", startDate));
        if (endDate) q = query(q, where("date", "<=", endDate));
        
        const querySnapshot = await getDocs(q);
        const reportTrips = [];
        querySnapshot.forEach(docSnap => reportTrips.push({ id: docSnap.id, ...docSnap.data() }));

        if (reportTrips.length === 0) {
            showFeedback(adminGeneralFeedback, "Nenhum frete encontrado para o período selecionado para exportar.", "info");
            return;
        }

        const htmlContent = convertToHTMLTable(reportTrips, reportPeriodTitle);
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Relatorio_Fretes_${fileNameSuffix}.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        showFeedback(adminGeneralFeedback, `Relatório (${reportPeriodTitle}) exportado como HTML.`, "success");

    } catch (error) {
        console.error("CRITICAL ERROR generating HTML report:", "Code:", error.code, "Message:", error.message, "Details:", error);
        let userMessage = "Erro ao gerar relatório HTML. Verifique o console para detalhes.";
        if (error.code === 'failed-precondition') {
            userMessage = "Erro ao gerar relatório: Provavelmente um índice está faltando no Firestore. Verifique o console do navegador (F12).";
        }
        showFeedback(adminGeneralFeedback, userMessage, "error");
    }
}

function convertToHTMLTable(data, reportPeriodTitle) {
    let tableHTML = `
        <html>
        <head>
            <meta charset="UTF-F">
            <title>Relatório de Fretes - ${escapeHtml(reportPeriodTitle)}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; background-color: #f4f4f4; color: #333; }
                h1 { color: #333; text-align: center; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; background-color: #fff; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
                th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                th { background-color: #e2e2e2; font-weight: bold; }
                tr:nth-child(even) { background-color: #f9f9f9; }
                tr:hover { background-color: #f1f1f1; }
                .currency { text-align: right; }
                .total-row td { font-weight: bold; background-color: #e9e9e9; }
                .summary-section { margin-top: 30px; padding: 15px; background-color: #f0f0f0; border-radius: 5px; }
                .summary-section h2 { margin-top: 0; color: #555; }
            </style>
        </head>
        <body>
            <h1>Relatório de Fretes</h1>
            <h2>${escapeHtml(reportPeriodTitle)}</h2>
            <table>
                <thead>
                    <tr>
                        <th>Data</th>
                        <th>Motorista</th>
                        <th>Km Inicial</th>
                        <th>Km Final</th>
                        <th>Km Rodados</th>
                        <th>Peso (Kg)</th>
                        <th>V. Unidade (R$)</th>
                        <th>Valor Frete (R$)</th>
                        <th>Total Combust. (R$)</th>
                        <th>Arla-32 (R$)</th>
                        <th>Pedágio (R$)</th>
                        <th>Comissão (R$)</th>
                        <th>Outras Desp. (R$)</th>
                        <th>Despesas Totais (R$)</th>
                        <th>Lucro Líquido (R$)</th>
                        <th>Valor Declarado (R$)</th>
                    </tr>
                </thead>
                <tbody>
    `;

    let grandTotalFreight = 0;
    let grandTotalExpenses = 0;
    let grandTotalNetProfit = 0;
    let grandTotalKmDriven = 0;
    let grandTotalWeight = 0;
    let grandTotalFuelCost = 0;
    let grandTotalCommission = 0;
    let grandTotalDeclared = 0;

    data.sort((a,b) => new Date(a.date) - new Date(b.date)).forEach(trip => {
        grandTotalFreight += trip.freightValue || 0;
        grandTotalExpenses += trip.totalExpenses || 0;
        grandTotalNetProfit += trip.netProfit || 0;
        grandTotalKmDriven += trip.kmDriven || 0;
        grandTotalWeight += trip.weight || 0;
        grandTotalFuelCost += trip.totalFuelCost || 0;
        grandTotalCommission += trip.commissionCost || 0;
        grandTotalDeclared += trip.declaredValue || 0;

        tableHTML += `
            <tr>
                <td>${formatDisplayDate(trip.date)}</td>
                <td>${escapeHtml(capitalizeName(trip.driverName))}</td>
                <td class="currency">${formatGenericNumber(trip.kmInitial, 2, 2)}</td>
                <td class="currency">${formatGenericNumber(trip.kmFinal, 2, 2)}</td>
                <td class="currency">${formatGenericNumber(trip.kmDriven, 2, 2)}</td>
                <td class="currency">${formatGenericNumber(trip.weight, 2, 2)}</td>
                <td class="currency">${formatCurrency(trip.unitValue)}</td>
                <td class="currency">${formatCurrency(trip.freightValue)}</td>
                <td class="currency">${formatCurrency(trip.totalFuelCost)}</td>
                <td class="currency">${formatCurrency(trip.arla32Cost)}</td>
                <td class="currency">${formatCurrency(trip.tollCost)}</td>
                <td class="currency">${formatCurrency(trip.commissionCost)}</td>
                <td class="currency">${formatCurrency(trip.otherExpenses)}</td>
                <td class="currency">${formatCurrency(trip.totalExpenses)}</td>
                <td class="currency">${formatCurrency(trip.netProfit)}</td>
                <td class="currency">${formatCurrency(trip.declaredValue)}</td>
            </tr>
        `;
    });

    tableHTML += `
                </tbody>
                <tfoot>
                    <tr class="total-row">
                        <td colspan="4">TOTAIS GERAIS:</td>
                        <td class="currency">${formatGenericNumber(grandTotalKmDriven, 2, 2)}</td>
                        <td class="currency">${formatGenericNumber(grandTotalWeight, 2, 2)}</td>
                        <td></td>
                        <td class="currency">${formatCurrency(grandTotalFreight)}</td>
                        <td class="currency">${formatCurrency(grandTotalFuelCost)}</td>
                        <td></td> 
                        <td></td> 
                        <td class="currency">${formatCurrency(grandTotalCommission)}</td>
                        <td></td> 
                        <td class="currency">${formatCurrency(grandTotalExpenses)}</td>
                        <td class="currency">${formatCurrency(grandTotalNetProfit)}</td>
                        <td class="currency">${formatCurrency(grandTotalDeclared)}</td>
                    </tr>
                </tfoot>
            </table>
            <div class="summary-section">
                <h2>Resumo dos Totais</h2>
                <p><strong>Total de Fretes no Período:</strong> ${data.length}</p>
                <p><strong>Total Receita Bruta (Fretes):</strong> ${formatCurrency(grandTotalFreight)}</p>
                <p><strong>Total de Despesas:</strong> ${formatCurrency(grandTotalExpenses)}</p>
                <p><strong>Total Lucro Líquido:</strong> ${formatCurrency(grandTotalNetProfit)}</p>
                <p><strong>Total de Km Rodados:</strong> ${formatGenericNumber(grandTotalKmDriven, 2, 2)} Km</p>
                <p><strong>Total de Peso Transportado:</strong> ${formatGenericNumber(grandTotalWeight, 2, 2)} Kg</p>
            </div>
        </body>
        </html>
    `;
    return tableHTML;
}

// --- EXCEL IMPORT ---
async function handleExcelFileImport() {
    if (!excelFileInput || !excelImportFeedback) return;
    const file = excelFileInput.files[0];
    if (!file) {
        showFeedback(excelImportFeedback, "Por favor, selecione um arquivo Excel.", "error");
        return;
    }

    excelImportFeedback.textContent = "Processando arquivo...";
    excelImportFeedback.className = 'feedback-message info';
    excelImportFeedback.style.display = 'block';

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array', cellDates: true });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true, defval: null });

            if (jsonData.length < 2) {
                showFeedback(excelImportFeedback, "A planilha está vazia ou não contém cabeçalhos e dados.", "error");
                return;
            }

            const headers = jsonData[0].map(header => String(header || '').trim().toLowerCase());
            const dataRows = jsonData.slice(1);

            const internalToSheetHeaderMap = {
                date: ['data', 'date'],
                driverName: ['motorista', 'driver name', 'nome motorista', 'nome do motorista'],
                kmInitial: ['km inicial', 'km in', 'km inicial', 'kminicial', 'km inicio'],
                kmFinal: ['km final', 'km fn', 'kmfinal', 'km fim'],
                weight: ['peso (kg)', 'peso', 'peso kg', 'carga (kg)', 'carga', 'peso carga'],
                unitValue: ['v. unidade (r$)', 'v.un', 'v.unidade', 'valor unidade', 'valor/un', 'valor unitario', 'v.unitario'],
                freightValue: ['valor frete (r$)', 'valor frete', 'v.frete', 'v frete', 'valor do frete'],
                litros1: ['litros', 'litros1', 'litro', 'litro1', 'lts', 'lts1', 'combustivel litros', 'combustivel litros1'],
                valor_litro1: ['v.litro', 'v.litro1', 'valor litro', 'valor/litro', 'valor/litro1', 'valor litro1', 'vl litro', 'vl litro1', 'combustivel valor/litro', 'combustivel valor/litro1'],
                desconto1: ['descont', 'descont1', 'desconto', 'desconto1', 'desc', 'desc1', 'combustivel desconto', 'combustivel desconto1'],
                litros2: ['litro2', 'litros2', 'lts2', 'combustivel litros2'],
                valor_litro2: ['v.litro2', 'valor litro2', 'valor/litro2', 'vl litro2', 'combustivel valor/litro2'],
                desconto2: ['descont2', 'desconto2', 'desc2', 'combustivel desconto2'],
                litros3: ['litros3', 'litro3', 'lts3', 'combustivel litros3'],
                valor_litro3: ['v.litro3', 'valor litro3', 'valor/litro3', 'vl litro3', 'combustivel valor/litro3'],
                desconto3: ['descont3', 'desconto3', 'desc3', 'combustivel desconto3'],
                litros4: ['litros4', 'litro4', 'lts4', 'combustivel litros4'], 
                valor_litro4: ['v.litro4', 'valor litro4', 'valor/litro4', 'vl litro4', 'combustivel valor/litro4'], 
                desconto4: ['descont4', 'desconto4', 'desc4', 'combustivel desconto4'], 
                arla32Cost: ['arla-32 (r$)', 'arla-32', 'arla32', 'arla', 'custo arla', 'valor arla'],
                tollCost: ['pedágio (r$)', 'pedagio', 'pedágio', 'custo pedagio', 'valor pedagio'],
                commissionCost: ['comissão (r$)', 'comissao', 'comissão', 'comissao motorista', 'comissão motorista'],
                otherExpenses: ['outras despesas adicionais (r$)', 'outras despesas', 'outrasdespesas', 'desp. adic.', 'despesas adicionais'],
                expenseDescription: ['descrição (outras despesas adicionais)', 'descricao outras despesas', 'desc. outras despesas', 'obs despesas'],
                declaredValue: ['valor declarado', 'declarado', 'v.declarado', 'v declarado', 'valor declarado (r$)']
            };
            
            const headerMap = {};
            Object.keys(internalToSheetHeaderMap).forEach(internalKey => {
                const possibleHeaders = internalToSheetHeaderMap[internalKey];
                const foundIndex = headers.findIndex(h => possibleHeaders.includes(h));
                if (foundIndex !== -1) {
                    headerMap[internalKey] = foundIndex;
                }
            });

            if (!('date' in headerMap) || !('driverName' in headerMap) || !('freightValue' in headerMap)) {
                showFeedback(excelImportFeedback, "Erro: Cabeçalhos obrigatórios (Data, Motorista, Valor Frete) não encontrados na planilha. Verifique a primeira linha.", "error");
                return;
            }
            
            const batch = writeBatch(db);
            let importCount = 0;
            const errorMessages = [];
            const importedTripIdentifiers = new Set();

            for (let i = 0; i < dataRows.length; i++) {
                const rowArray = dataRows[i];
                const driverNameFromSheet = String(rowArray[headerMap.driverName] || '').trim();
                
                if (!driverNameFromSheet) {
                    errorMessages.push(`Linha ${i + 2}: Nome do motorista não fornecido. Pulando.`);
                    continue;
                }

                const userProfile = userProfiles.find(profile => profile.username.toLowerCase() === driverNameFromSheet.toLowerCase());
                if (!userProfile) {
                    errorMessages.push(`Linha ${i + 2}: Motorista "${driverNameFromSheet}" não encontrado no sistema. Cadastre o motorista primeiro. Pulando.`);
                    continue;
                }
                const motoristaUid = userProfile.uid;

                const tripDateRaw = rowArray[headerMap.date];
                const tripDateFormatted = formatDate(tripDateRaw);

                if (tripDateFormatted === 'Data inválida') {
                    errorMessages.push(`Linha ${i + 2}: Data "${tripDateRaw}" inválida para motorista ${driverNameFromSheet}. Pulando.`);
                    continue;
                }
                
                const tripIdentifier = `${motoristaUid}_${tripDateFormatted}`;
                const qDup = query(tripsCollection, where("userId", "==", motoristaUid), where("date", "==", tripDateFormatted));
                const dupSnapshot = await getDocs(qDup);

                if (!dupSnapshot.empty) {
                     errorMessages.push(`Linha ${i + 2}: Viagem duplicada para ${driverNameFromSheet} em ${formatDisplayDate(tripDateFormatted)}. Ignorando.`);
                     importedTripIdentifiers.add(tripIdentifier); 
                     continue;
                }
                 if (importedTripIdentifiers.has(tripIdentifier)) {
                     continue; 
                 }

                const fuelEntries = [];
                let totalFuelCost = 0;

                for (let j = 1; j <= 4; j++) { 
                    const litersKey = `litros${j}`;
                    const valuePerLiterKey = `valor_litro${j}`;
                    const discountKey = `desconto${j}`;

                    if (litersKey in headerMap && valuePerLiterKey in headerMap) {
                        const liters = parseNumericValueFromString(rowArray[headerMap[litersKey]]);
                        const valuePerLiter = parseNumericValueFromString(rowArray[headerMap[valuePerLiterKey]]);
                        const discount = parseNumericValueFromString(rowArray[headerMap[discountKey]] || '0');
                        
                        if (liters > 0 && valuePerLiter > 0) {
                            const entryTotal = (liters * valuePerLiter) - discount;
                            fuelEntries.push({
                                id: `excel_fuel_${i}_${j}`,
                                liters,
                                valuePerLiter,
                                discount,
                                totalValue: entryTotal
                            });
                            totalFuelCost += entryTotal;
                        }
                    }
                }

                const kmInitial = parseNumericValueFromString(rowArray[headerMap.kmInitial] || '0');
                const kmFinal = parseNumericValueFromString(rowArray[headerMap.kmFinal] || '0');
                const kmDriven = (kmFinal > kmInitial) ? kmFinal - kmInitial : 0;
                
                const arla32Cost = parseNumericValueFromString(rowArray[headerMap.arla32Cost] || '0');
                const tollCost = parseNumericValueFromString(rowArray[headerMap.tollCost] || '0');
                const commissionCost = parseNumericValueFromString(rowArray[headerMap.commissionCost] || '0');
                const otherExpenses = parseNumericValueFromString(rowArray[headerMap.otherExpenses] || '0');
                
                const totalExpenses = totalFuelCost + arla32Cost + tollCost + commissionCost + otherExpenses;
                const freightValue = parseNumericValueFromString(rowArray[headerMap.freightValue]);
                
                if (isNaN(freightValue) || freightValue === 0 && String(rowArray[headerMap.freightValue]).trim() !== "0") {
                     errorMessages.push(`Linha ${i+2}: Valor do Frete "${rowArray[headerMap.freightValue]}" inválido para motorista ${driverNameFromSheet}. Pulando.`);
                     continue;
                }

                const netProfit = freightValue - totalExpenses;

                const newTripRef = doc(tripsCollection); 
                batch.set(newTripRef, {
                    userId: motoristaUid,
                    driverName: driverNameFromSheet,
                    date: tripDateFormatted,
                    kmInitial,
                    kmFinal,
                    kmDriven,
                    weight: parseNumericValueFromString(rowArray[headerMap.weight] || '0'),
                    unitValue: parseNumericValueFromString(rowArray[headerMap.unitValue] || '0'),
                    freightValue,
                    fuelEntries,
                    arla32Cost,
                    tollCost,
                    commissionCost,
                    otherExpenses,
                    expenseDescription: String(rowArray[headerMap.expenseDescription] || '').trim(),
                    totalFuelCost,
                    totalExpenses,
                    netProfit,
                    declaredValue: parseNumericValueFromString(rowArray[headerMap.declaredValue] || '0'),
                    createdAt: Timestamp.now(),
                    attachments: [] // Initialize attachments for Excel import
                });
                importCount++;
                importedTripIdentifiers.add(tripIdentifier);
            }

            if (importCount > 0) {
                await batch.commit();
            }

            let feedbackMsg = `Importação concluída. ${importCount} fretes processados da planilha.`;
            if (errorMessages.length > 0) {
                feedbackMsg += "\n\nAlertas/Erros durante a importação:\n" + errorMessages.join("\n");
                showFeedback(excelImportFeedback, feedbackMsg, importCount > 0 ? "info" : "error"); 
            } else {
                showFeedback(excelImportFeedback, feedbackMsg, "success");
            }

            if (importCount > 0) {
                updateAdminSummary();
                if (adminSelectedDriverUid) {
                    loadAndRenderAdminDriverMonthlySummaries();
                }
            }
            if (excelFileInput) excelFileInput.value = ''; 

        } catch (err) {
            console.error("Erro CRÍTICO durante importação do Excel:", err);
            showFeedback(excelImportFeedback, `Erro crítico ao processar o arquivo: ${err.message}. Verifique o console.`, "error");
        }
    };
    reader.onerror = () => {
        showFeedback(excelImportFeedback, "Erro ao ler o arquivo.", "error");
    };
    reader.readAsArrayBuffer(file);
}

// --- INITIALIZATION ---
function initializeUserView() {
    console.log("Initializing User View (Registrar Frete)...");
    if(tripForm) tripForm.reset();
    if(fuelEntriesContainer) fuelEntriesContainer.innerHTML = '';
    fuelEntryIdCounter = 0;
    addFuelEntryToForm(); 
    editingTripId = null;
    if(tripIdToEditInput) tripIdToEditInput.value = '';
    if (submitTripBtn) submitTripBtn.textContent = 'Salvar Frete';
    if (cancelEditBtn) cancelEditBtn.style.display = 'none';
    if(userFormFeedback) { userFormFeedback.textContent = ''; userFormFeedback.style.display = 'none'; }
    if (driverNameInput && loggedInUserProfile) {
        driverNameInput.value = capitalizeName(loggedInUserProfile.username);
    }
    if(tripAttachmentsInput) tripAttachmentsInput.value = '';
    if(tripAttachmentsFeedback) tripAttachmentsFeedback.innerHTML = '';
}

function initializeMyTripsView() {
    console.log("Initializing My Fretes View...");
    if (loggedInUserProfile) {
        if (loggedInUserProfile.role === 'admin') {
            if (myTripsDriverNameContainer) myTripsDriverNameContainer.style.display = 'block';
            if (myTripsDriverNameInput) myTripsDriverNameInput.value = '';
            currentUserForMyTripsSearch = null; 
            currentUidForMyTripsSearch = null; 
        } else {
            if (myTripsDriverNameContainer) myTripsDriverNameContainer.style.display = 'none';
            currentUserForMyTripsSearch = loggedInUserProfile.username; 
            currentUidForMyTripsSearch = loggedInUser.uid; 
        }
        if (myTripsFilterControls) myTripsFilterControls.style.display = 'block';
        if(myTripsFilterStartDateInput) myTripsFilterStartDateInput.value = '';
        if(myTripsFilterEndDateInput) myTripsFilterEndDateInput.value = '';
        if(myTripsTablePlaceholder) myTripsTablePlaceholder.textContent = loggedInUserProfile.role === 'admin' ? 'Digite o nome do motorista e clique em "Buscar Fretes"' : 'Carregando seus fretes...';
        if(myTripsTableBody) myTripsTableBody.innerHTML = ''; 
        loadAndRenderMyTrips();
    } else {
        if(myTripsTablePlaceholder) myTripsTablePlaceholder.textContent = 'Faça login para ver seus fretes.';
    }
    if(myTripsFeedback) {myTripsFeedback.textContent = ''; myTripsFeedback.style.display = 'none';}
}

function initializeAdminView() {
    console.log("Initializing Admin View...");
    updateAdminSummary();
    populateAdminDriverSelect();
    populateAdminYearFilterSelect();
    if (adminSelectDriver) adminSelectDriver.value = '';
    if (adminDriverTripsSection) adminDriverTripsSection.style.display = 'none';
    if (adminDriverIndividualTripsSection) adminDriverIndividualTripsSection.style.display = 'none';
    if (adminSelectedDriverNameDisplay) adminSelectedDriverNameDisplay.textContent = "Selecione um motorista para ver os resumos.";
    if (adminDriverTripsPlaceholder) adminDriverTripsPlaceholder.textContent = "Selecione um motorista para carregar os resumos mensais.";
    if (adminDriverFiltersContainer) adminDriverFiltersContainer.style.display = 'none';
    if (adminMonthFilterSelect) adminMonthFilterSelect.value = '';
    if (adminYearFilterSelect) adminYearFilterSelect.value = '';
    if(adminGeneralFeedback) {adminGeneralFeedback.textContent = ''; adminGeneralFeedback.style.display = 'none';}
    if(adminSummaryFilterStartDateInput) adminSummaryFilterStartDateInput.value = '';
    if(adminSummaryFilterEndDateInput) adminSummaryFilterEndDateInput.value = '';
    if(excelFileInput) excelFileInput.value = '';
    if(excelImportFeedback) {excelImportFeedback.textContent = ''; excelImportFeedback.style.display = 'none';}
}

function initializeUserManagementView() {
    console.log("Initializing User Management View...");
    if (loggedInUserProfile && loggedInUserProfile.role === 'admin' && loggedInUserProfile.username === 'fabio') {
        loadAndRenderUsersForAdmin();
    }
    if (adminCreateUserForm) adminCreateUserForm.reset();
    if (adminCreateUserFeedback) {adminCreateUserFeedback.textContent = ''; adminCreateUserFeedback.style.display = 'none';}
    if (userManagementFeedback) {userManagementFeedback.textContent = ''; userManagementFeedback.style.display = 'none';}
}

// --- EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded event fired.");

    if (!app || !authFirebase || !db || !storage) { // Check for storage too
        console.error("CRITICAL: Firebase not initialized (or storage missing) at DOMContentLoaded. App will not function.");
        const body = document.querySelector('body');
        if (body) {
            body.innerHTML = `<div style="padding: 20px; text-align: center; background-color: #ffdddd; border: 1px solid red; color: red;">
                <h1>Erro Crítico</h1>
                <p>A aplicação não pôde ser iniciada devido a um problema na inicialização dos serviços Firebase. Verifique o console para detalhes.</p>
                <p>Por favor, recarregue a página ou contate o suporte técnico.</p>
            </div>`;
        }
        return; 
    }

    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

    if (userViewBtn) userViewBtn.addEventListener('click', () => { showView('userView'); initializeUserView(); });
    if (myTripsViewBtn) myTripsViewBtn.addEventListener('click', () => { showView('myTripsView'); initializeMyTripsView(); });
    if (adminViewBtn) adminViewBtn.addEventListener('click', () => { showView('adminView'); initializeAdminView(); });
    if (userManagementViewBtn) userManagementViewBtn.addEventListener('click', () => { showView('userManagementView'); initializeUserManagementView(); });

    if (tripForm) tripForm.addEventListener('submit', handleTripFormSubmit);
    if (addFuelEntryBtn) addFuelEntryBtn.addEventListener('click', () => addFuelEntryToForm());
    if (cancelEditBtn) cancelEditBtn.addEventListener('click', () => {
        editingTripId = null;
        if(tripIdToEditInput) tripIdToEditInput.value = '';
        if(tripForm) tripForm.reset();
        if(fuelEntriesContainer) fuelEntriesContainer.innerHTML = '';
        addFuelEntryToForm(); 
        if (submitTripBtn) submitTripBtn.textContent = 'Salvar Frete';
        if (cancelEditBtn) cancelEditBtn.style.display = 'none';
        if (driverNameInput && loggedInUserProfile) driverNameInput.value = capitalizeName(loggedInUserProfile.username);
        if(tripAttachmentsInput) tripAttachmentsInput.value = ''; // Clear file input on cancel
        if(tripAttachmentsFeedback) tripAttachmentsFeedback.innerHTML = ''; // Clear feedback on cancel
        showFeedback(userFormFeedback, "Edição cancelada.", "info");
    });

    if (tripAttachmentsInput && tripAttachmentsFeedback) {
        tripAttachmentsInput.addEventListener('change', () => {
            tripAttachmentsFeedback.innerHTML = ''; // Clear previous
            if (tripAttachmentsInput.files.length > 0) {
                const ul = document.createElement('ul');
                ul.innerHTML = '<li><strong>Arquivos selecionados para novo anexo:</strong></li>';
                for (let i = 0; i < tripAttachmentsInput.files.length; i++) {
                    const li = document.createElement('li');
                    li.textContent = escapeHtml(tripAttachmentsInput.files[i].name);
                    ul.appendChild(li);
                }
                tripAttachmentsFeedback.appendChild(ul);
            }
        });
    }

    if (loadMyTripsBtn && myTripsDriverNameInput) {
        loadMyTripsBtn.addEventListener('click', () => {
            const driverNameToSearch = myTripsDriverNameInput.value.trim();
            if (!driverNameToSearch) {
                showFeedback(myTripsFeedback, "Por favor, digite o nome de um motorista para buscar.", "error");
                currentUserForMyTripsSearch = null;
                currentUidForMyTripsSearch = null;
                return;
            }
            const foundProfile = userProfiles.find(p => p.username.toLowerCase() === driverNameToSearch.toLowerCase() && p.role === 'motorista');
            if (foundProfile) {
                currentUserForMyTripsSearch = foundProfile.username;
                currentUidForMyTripsSearch = foundProfile.uid;
                if(myTripsFilterStartDateInput) myTripsFilterStartDateInput.value = ''; 
                if(myTripsFilterEndDateInput) myTripsFilterEndDateInput.value = '';
                loadAndRenderMyTrips();
            } else {
                showFeedback(myTripsFeedback, `Motorista "${capitalizeName(driverNameToSearch)}" não encontrado.`, "error");
                if(myTripsTableBody) myTripsTableBody.innerHTML = '';
                if(myTripsTablePlaceholder) myTripsTablePlaceholder.textContent = `Motorista "${capitalizeName(driverNameToSearch)}" não encontrado.`;
                currentUserForMyTripsSearch = null;
                currentUidForMyTripsSearch = null;
            }
        });
    }

    if (applyMyTripsFilterBtn && myTripsFilterStartDateInput && myTripsFilterEndDateInput) {
        applyMyTripsFilterBtn.addEventListener('click', () => {
            const startDate = myTripsFilterStartDateInput.value;
            const endDate = myTripsFilterEndDateInput.value;
            loadAndRenderMyTrips(startDate, endDate);
        });
    }

    if(applyAdminSummaryFilterBtn && adminSummaryFilterStartDateInput && adminSummaryFilterEndDateInput) {
        applyAdminSummaryFilterBtn.addEventListener('click', () => {
            updateAdminSummary(adminSummaryFilterStartDateInput.value, adminSummaryFilterEndDateInput.value);
        });
    }

    if (exportAdminReportBtn) {
        exportAdminReportBtn.addEventListener('click', handleExportAdminReport);
    } else {
        console.warn("Botão exportAdminReportBtn não encontrado no DOM.");
    }

    if (adminLoadDriverTripsBtn && adminSelectDriver) {
        adminLoadDriverTripsBtn.addEventListener('click', loadAndRenderAdminDriverMonthlySummaries);
    }

    if(adminMonthFilterSelect && adminYearFilterSelect) {
        adminMonthFilterSelect.addEventListener('change', renderAdminDriverMonthlySummariesTable);
        adminYearFilterSelect.addEventListener('change', renderAdminDriverMonthlySummariesTable);
    }

    if (closeAdminTripDetailModalBtn && adminTripDetailModal) {
        closeAdminTripDetailModalBtn.addEventListener('click', () => adminTripDetailModal.style.display = 'none');
    }
    if (printAdminTripDetailBtn) {
        printAdminTripDetailBtn.addEventListener('click', () => window.print());
    }

    if (adminCreateUserForm) {
        adminCreateUserForm.addEventListener('submit', handleAdminCreateUserFormSubmit);
    }
    if (closeEditUserModalBtn && editUserModal) {
        closeEditUserModalBtn.addEventListener('click', () => editUserModal.style.display = 'none');
    }
    if (editUserForm) {
        editUserForm.addEventListener('submit', handleEditUserSubmit);
    }

    if(importExcelBtn && excelFileInput) {
        importExcelBtn.addEventListener('click', handleExcelFileImport);
    }
    
    showView('loginView');
    console.log("Initial view set to loginView.");
});
