
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
let auth;
let db;
let userProfilesCollection;
let tripsCollection;

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    userProfilesCollection = collection(db, "userProfiles");
    tripsCollection = collection(db, "trips");
    console.log("Firebase initialized successfully!");

    // Attach the onAuthStateChanged listener only if auth initialized successfully
    onAuthStateChanged(auth, async (user) => {
        console.log("onAuthStateChanged triggered. User object:", user ? user.uid : 'null');
        if (user) {
            loggedInUser = user;
            console.log("User is authenticated with UID:", user.uid);
            try {
                console.log("Attempting to fetch user profile from Firestore for UID:", user.uid);
                const userProfileDocRef = doc(userProfilesCollection, user.uid);
                const userProfileDoc = await getDoc(userProfileDocRef);

                if (userProfileDoc.exists()) {
                    if (auth.currentUser && auth.currentUser.uid === user.uid) {
                        loggedInUserProfile = { id: userProfileDoc.id, ...userProfileDoc.data() };
                        console.log("User profile found in Firestore:", "Username:", loggedInUserProfile.username, "Role:", loggedInUserProfile.role);

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
                            console.log("Initializing My Trips View for logged in user.");
                            initializeMyTripsView();
                        }
                        if (userManagementViewBtn && userManagementViewBtn.style.display !== 'none' && loggedInUserProfile.username.toLowerCase() === 'fabio') {
                            console.log("User is Fabio (admin), initializing User Management View.");
                            initializeUserManagementView();
                        }
                    } else {
                        console.warn("User session changed while fetching profile for UID:", user.uid, ". Aborting UI update.");
                    }
                } else {
                    console.error("CRITICAL: User profile NOT FOUND in Firestore for UID:", user.uid, "Email:", user.email);
                    showFeedback(loginFeedback, `Falha ao carregar perfil (usuário ${user.email || user.uid}). Você será desconectado. Verifique o cadastro ou contate o suporte.`, "error");
                    setTimeout(() => signOut(auth), 3000);
                }
            } catch (error) {
                console.error("CRITICAL ERROR fetching user profile for UID:", user.uid, "Error:", error);
                showFeedback(loginFeedback, `Erro ao carregar dados do perfil (usuário ${user.email || user.uid}). Você será desconectado. (${error.message})`, "error");
                setTimeout(() => signOut(auth), 3000);
            }
        } else {
            console.log("User is not authenticated.");
            loggedInUser = null;
            loggedInUserProfile = null;
            trips = [];
            userProfiles = [];
            updateNavVisibility();
            showView('loginView');
            console.log("User is logged out, showing loginView.");
        }
        console.log("onAuthStateChanged finished processing for user:", user ? user.uid : 'null');
    });
    console.log("onAuthStateChanged listener attached successfully.");

} catch (error) {
    console.error("CRITICAL ERROR: Firebase initialization failed:", "Code:", error.code, "Message:", error.message);
    alert("Erro crítico: Não foi possível conectar ao serviço de dados. Verifique a configuração do Firebase e sua conexão com a internet.");
    // Fallback: try to show login view, though buttons might not work if DOMContentLoaded also detects issues.
    // The DOMContentLoaded handler will also display a persistent error if Firebase vars are not set.
    showView('loginView');
}


// --- STATE VARIABLES ---
let trips = []; // Cache local de viagens carregadas
let editingTripId = null;
let currentUserForMyTripsSearch = null; // Username
let currentUidForMyTripsSearch = null; // UID do Firebase

let userProfiles = []; // Cache local de perfis de usuário (para admin)
let loggedInUser = null; // Usuário do Firebase Auth
let loggedInUserProfile = null; // Perfil do usuário logado do Firestore
let editingUserIdForAdmin = null; // UID do usuário sendo editado pelo admin
let adminSelectedDriverName = null; // Username
let adminSelectedDriverUid = null; // UID do Firebase

let adminSummaryChart = null; // Chart instance

// --- DOM ELEMENTS ---
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

// --- UTILITY FUNCTIONS ---
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

function normalizeUsernameForEmail(username) {
    if (!username) return '';
    const normalized = username
        .normalize('NFD')
        .replace(/[\\u0300-\\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '.')
        .replace(/[^a-z0-9._-]/g, '');

    let cleaned = normalized.replace(/\.+/g, '.');
    if (cleaned.startsWith('.')) cleaned = cleaned.substring(1);
    if (cleaned.endsWith('.')) cleaned = cleaned.slice(0, -1);

    if (!cleaned) {
        return `user.${generateId()}`;
    }
    return cleaned;
}

function formatDate(dateInput) {
    if (!dateInput) return 'Data inválida';

    let dateToFormat;

    if (typeof dateInput === 'string') {
        dateToFormat = new Date(dateInput + 'T00:00:00Z');
    } else if (dateInput instanceof Date) {
        dateToFormat = dateInput;
    } else if (dateInput && typeof dateInput.toDate === 'function') { // Firestore Timestamp
        dateToFormat = dateInput.toDate();
    } else {
        console.warn("Unsupported dateInput type in formatDate:", dateInput, typeof dateInput);
        return 'Data inválida';
    }

    if (isNaN(dateToFormat.getTime())) {
        console.warn("Date parsing resulted in NaN in formatDate. Original input:", dateInput);
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
        console.warn("Feedback element not found for message:", message);
        return;
    }
    element.textContent = message;
    element.className = `feedback-message ${type}`;
    element.style.display = 'block';
    setTimeout(() => {
        if (element) { // Check if element still exists
            element.style.display = 'none';
            element.textContent = '';
        }
    }, 5000);
}

// --- VIEW MANAGEMENT ---
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

// --- AUTHENTICATION WITH FIREBASE ---
async function handleRegister(event) {
    event.preventDefault();
    console.log("Attempting registration...");
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
    console.log("Registration details:", { rawUsername, normalizedUsernamePart, email });

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
        console.log("Calling createUserWithEmailAndPassword with email:", email);
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const firebaseUser = userCredential.user;
        console.log("User created in Auth:", firebaseUser.uid);

        let roleForNewUser = 'motorista';
        if (rawUsername.toLowerCase() === 'fabio') {
            roleForNewUser = 'admin';
            console.log(`Registering user ${rawUsername} as ADMIN because username is 'fabio'.`);
        }

        const newUserProfile = {
            uid: firebaseUser.uid,
            username: rawUsername,
            email: firebaseUser.email || email,
            role: roleForNewUser,
            createdAt: Timestamp.now()
        };
        console.log("Creating user profile in Firestore:", newUserProfile);
        await firebaseSetDoc(doc(userProfilesCollection, firebaseUser.uid), newUserProfile);
        console.log("User profile created in Firestore.");

        showFeedback(registerFeedback, "Cadastro realizado com sucesso! Faça o login.", "success");
        if (registerForm) registerForm.reset();
        setTimeout(() => showView('loginView'), 1500);

    } catch (error) {
        console.error("CRITICAL ERROR during registration:", "Code:", error.code, "Message:", error.message);
        if (error.code === 'auth/email-already-in-use') {
            showFeedback(registerFeedback, "Nome de usuário (ou e-mail derivado) já existe. Tente outro.", "error");
        } else if (error.code === 'auth/weak-password') {
            showFeedback(registerFeedback, "Senha muito fraca. Tente uma mais forte.", "error");
        } else if (error.code === 'auth/invalid-email') {
            showFeedback(registerFeedback, `O nome de usuário "${rawUsername}" resultou em um formato de e-mail inválido ("${email}"). Tente um nome de usuário diferente, com menos caracteres especiais.`, "error");
        } else {
            showFeedback(registerFeedback, "Erro ao registrar. Verifique o console para detalhes.", "error");
        }
    }
}

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
    if (!normalizedUsernamePart) {
        showFeedback(loginFeedback, `Nome de usuário "${rawUsername}" inválido. Use um nome com letras ou números.`, "error");
        console.log("Login aborted: normalized username part is empty.");
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
        await signInWithEmailAndPassword(auth, email, password);
        console.log("signInWithEmailAndPassword successful. Waiting for onAuthStateChanged.");
        showFeedback(loginFeedback, "Login bem-sucedido! Redirecionando...", "success");
        if(loginForm) loginForm.reset();
    } catch (error) {
        console.error("CRITICAL ERROR during login:", "Code:", error.code, "Message:", error.message);
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            showFeedback(loginFeedback, "Nome de usuário ou senha incorretos.", "error");
        } else if (error.code === 'auth/invalid-email') {
             showFeedback(loginFeedback, `O nome de usuário "${rawUsername}" resultou em um formato de e-mail inválido ("${email}") para o login. Verifique se digitou corretamente.`, "error");
        } else {
            showFeedback(loginFeedback, "Erro ao tentar fazer login. Verifique o console para detalhes.", "error");
        }
    }
    console.log("handleLogin function finished.");
}

async function handleLogout() {
    console.log("Attempting logout...");
    try {
        await signOut(auth);
        console.log("User signed out from Firebase Auth.");
        showFeedback(loginFeedback, "Você foi desconectado.", "info");
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
        console.error("CRITICAL ERROR during logout:", "Code:", error.code, "Message:", error.message);
        showFeedback(loginFeedback, "Erro ao sair. Tente novamente.", "error");
    }
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
    if(fuelEntriesContainer) fuelEntriesContainer.appendChild(fuelDiv);

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

    if(litersInput) litersInput.addEventListener('input', calculateTotalFuelValue);
    if(valuePerLiterInput) valuePerLiterInput.addEventListener('input', calculateTotalFuelValue);
    if(discountInput) discountInput.addEventListener('input', calculateTotalFuelValue);

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
        showFeedback(userFormFeedback, "Você precisa estar logado para registrar uma viagem.", "error");
        return;
    }

    const formData = new FormData(tripForm);
    const fuelEntriesFromForm = [];
    const fuelEntryElements = fuelEntriesContainer.querySelectorAll('.fuel-entry-item');
    let totalFuelCostCalculated = 0;

    fuelEntryElements.forEach(entryEl => {
        const entryId = entryEl.id;
        const liters = parseFloat(entryEl.querySelector(`input[name="liters"]`).value) || 0;
        const valuePerLiter = parseFloat(entryEl.querySelector(`input[name="valuePerLiter"]`).value) || 0;
        const discount = parseFloat(entryEl.querySelector(`input[name="discount"]`).value) || 0;
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
        if(submitTripBtn) {
            submitTripBtn.disabled = true;
            submitTripBtn.textContent = 'Salvando...';
        }

        if (editingTripId) {
            const tripRef = doc(tripsCollection, editingTripId);
            const updatePayload = { ...tripDataObjectFromForm };
            // updatePayload.updatedAt = Timestamp.now(); // If you add an 'updatedAt' field
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
        if(submitTripBtn) submitTripBtn.textContent = 'Salvar Viagem';
        if(cancelEditBtn) cancelEditBtn.style.display = 'none';

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
        console.error("Error saving trip to Firestore:", "Code:", error.code, "Message:", error.message);
        showFeedback(userFormFeedback, "Erro ao salvar viagem. Tente novamente.", "error");
        if(submitTripBtn) submitTripBtn.textContent = editingTripId ? 'Salvar Alterações' : 'Salvar Viagem';
    } finally {
        if(submitTripBtn) submitTripBtn.disabled = false;
    }
}

async function loadAndRenderMyTrips(filterStartDate, filterEndDate) {
    if (!loggedInUserProfile) {
        if(myTripsTablePlaceholder) myTripsTablePlaceholder.textContent = 'Você precisa estar logado para ver suas viagens.';
        if(myTripsTable) myTripsTable.style.display = 'none';
        if(myTripsTablePlaceholder) myTripsTablePlaceholder.style.display = 'block';
        return;
    }

    let targetUid = loggedInUser.uid; 
    let targetUsername = loggedInUserProfile.username;

    if (loggedInUserProfile.role === 'admin' && currentUidForMyTripsSearch && currentUserForMyTripsSearch) {
        targetUid = currentUidForMyTripsSearch;
        targetUsername = currentUserForMyTripsSearch;
    }

    if(myTripsTablePlaceholder) myTripsTablePlaceholder.textContent = `Carregando viagens de ${targetUsername}...`;
    if(myTripsTable) myTripsTable.style.display = 'none';
    if(myTripsTablePlaceholder) myTripsTablePlaceholder.style.display = 'block';
    if(myTripsTableBody) myTripsTableBody.innerHTML = '';

    try {
        let qParams = [where("userId", "==", targetUid), orderBy("date", "desc")];

        if (filterStartDate) {
            qParams.push(where("date", ">=", filterStartDate));
        }
        if (filterEndDate) {
            qParams.push(where("date", "<=", filterEndDate));
        }
        const q = query(tripsCollection, ...qParams);

        const querySnapshot = await getDocs(q);
        const fetchedTrips = [];
        querySnapshot.forEach((doc) => {
            fetchedTrips.push({ id: doc.id, ...doc.data() });
        });

        trips = fetchedTrips; 

        if (trips.length === 0) {
            if(myTripsTablePlaceholder) myTripsTablePlaceholder.textContent = `Nenhuma viagem encontrada para ${targetUsername}` +
                `${(filterStartDate || filterEndDate) ? ' nos filtros aplicados.' : '.'}`;
        } else {
            if(myTripsTable) myTripsTable.style.display = 'table';
            if(myTripsTablePlaceholder) myTripsTablePlaceholder.style.display = 'none';
            renderMyTripsTable(trips);
        }
        updateDriverSummary(trips, targetUsername); 

    } catch (error) {
        console.error(`Error loading trips for ${targetUsername} from Firestore:`, "Code:", error.code, "Message:", error.message);
        showFeedback(myTripsFeedback, `Erro ao carregar viagens de ${targetUsername}.`, "error");
        if(myTripsTablePlaceholder) myTripsTablePlaceholder.textContent = `Erro ao carregar viagens de ${targetUsername}.`;
    }
}

function renderMyTripsTable(tripsToRender) {
    if(!myTripsTableBody) return;
    myTripsTableBody.innerHTML = '';
    if (tripsToRender.length === 0) {
        if(myTripsTable) myTripsTable.style.display = 'none';
        if(myTripsTablePlaceholder) {
            myTripsTablePlaceholder.style.display = 'block';
            myTripsTablePlaceholder.textContent = 'Nenhuma viagem para exibir com os filtros atuais.';
        }
        return;
    }

    if(myTripsTable) myTripsTable.style.display = 'table';
    if(myTripsTablePlaceholder) myTripsTablePlaceholder.style.display = 'none';

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

            if(tripForm) tripForm.reset(); 
            if(fuelEntriesContainer) fuelEntriesContainer.innerHTML = ''; 

            if(tripIdToEditInput) tripIdToEditInput.value = trip.id;
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

            if(submitTripBtn) submitTripBtn.textContent = 'Salvar Alterações';
            if(cancelEditBtn) cancelEditBtn.style.display = 'inline-block';
            showView('userView'); 
            if(userView) userView.scrollIntoView({ behavior: 'smooth' });
            showFeedback(userFormFeedback, `Editando viagem de ${trip.driverName} do dia ${formatDate(trip.date)}.`, "info");

        } else {
            showFeedback(myTripsFeedback, "Viagem não encontrada para edição.", "error");
        }
    } catch (error) {
        console.error("Error loading trip for editing:", "Code:", error.code, "Message:", error.message);
        showFeedback(myTripsFeedback, "Erro ao carregar viagem para edição.", "error");
    }
}

function confirmDeleteTrip(tripId, driverNameForConfirm) {
    if (!tripId) return;

    const tripToDelete = trips.find(t => t.id === tripId);

    if (tripToDelete) {
         if (loggedInUser.uid !== tripToDelete.userId &&
            !(loggedInUserProfile?.role === 'admin' && loggedInUserProfile.username.toLowerCase() === 'fabio')) {
            showFeedback(myTripsFeedback, "Você não tem permissão para excluir esta viagem.", "error");
            return;
        }
    } else if (!(loggedInUserProfile?.role === 'admin' && loggedInUserProfile.username.toLowerCase() === 'fabio')) {
        // If trip not found in local cache and user is not super admin, deny.
        showFeedback(myTripsFeedback, "Viagem não encontrada ou permissão negada para exclusão direta.", "error");
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
        console.error("Error deleting trip from Firestore:", "Code:", error.code, "Message:", error.message);
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

    if (driverSummaryContainer) {
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

// --- ADMIN PANEL FUNCTIONS ---
async function updateAdminSummary(filterStartDate, filterEndDate) {
    let qParams = [orderBy("date", "desc")];
    if (filterStartDate) qParams.push(where("date", ">=", filterStartDate));
    if (filterEndDate) qParams.push(where("date", "<=", filterEndDate));
    
    const q = query(tripsCollection, ...qParams);

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

        if(adminTotalTripsEl) adminTotalTripsEl.textContent = totalTrips.toString();
        if(adminTotalFreightEl) adminTotalFreightEl.textContent = formatCurrency(totalFreight);
        if(adminTotalExpensesEl) adminTotalExpensesEl.textContent = formatCurrency(totalExpensesOverall);
        if(adminTotalNetProfitEl) adminTotalNetProfitEl.textContent = formatCurrency(totalNetProfitOverall);

    } catch (error) {
        console.error("Error updating admin summary:", "Code:", error.code, "Message:", error.message);
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
        console.error("Error populating admin driver select:", "Code:", error.code, "Message:", error.message);
        adminSelectDriver.innerHTML = '<option value="">-- Erro ao carregar --</option>';
    }
}

async function loadAndRenderAdminDriverTrips(driverUid, driverName) {
    if (!driverUid) {
        if(adminDriverTripsSection) adminDriverTripsSection.style.display = 'none';
        return;
    }
    adminSelectedDriverUid = driverUid;
    adminSelectedDriverName = driverName;

    if(adminSelectedDriverNameDisplay) adminSelectedDriverNameDisplay.textContent = `Viagens de ${driverName}`;
    if(adminDriverTripsTableBody) adminDriverTripsTableBody.innerHTML = '';
    if(adminDriverTripsPlaceholder) adminDriverTripsPlaceholder.textContent = `Carregando viagens de ${driverName}...`;
    if(adminDriverTripsTable) adminDriverTripsTable.style.display = 'none';
    if(adminDriverTripsPlaceholder) adminDriverTripsPlaceholder.style.display = 'block';
    if(adminDriverTripsSection) adminDriverTripsSection.style.display = 'block';

    try {
        const q = query(tripsCollection, where("userId", "==", driverUid), orderBy("date", "desc"));
        const querySnapshot = await getDocs(q);
        const driverTrips = [];
        querySnapshot.forEach((doc) => {
            driverTrips.push({ id: doc.id, ...doc.data() });
        });

        trips = driverTrips; // Overwrite global trips with specific driver's trips for admin context

        if (driverTrips.length === 0) {
            if(adminDriverTripsPlaceholder) adminDriverTripsPlaceholder.textContent = `Nenhuma viagem encontrada para ${driverName}.`;
        } else {
            if(adminDriverTripsTable) adminDriverTripsTable.style.display = 'table';
            if(adminDriverTripsPlaceholder) adminDriverTripsPlaceholder.style.display = 'none';
        }
        renderAdminDriverTripsTable(driverTrips);

    } catch (error) {
        console.error(`Error loading trips for driver ${driverName} (UID: ${driverUid}):`, "Code:", error.code, "Message:", error.message);
        showFeedback(adminGeneralFeedback, `Erro ao carregar viagens de ${driverName}.`, "error");
        if(adminDriverTripsPlaceholder) adminDriverTripsPlaceholder.textContent = `Erro ao carregar viagens de ${driverName}.`;
    }
}

function renderAdminDriverTripsTable(driverTripsToRender) {
    if(!adminDriverTripsTableBody) return;
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

    if(adminTripDetailContent) {
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
    }
    if(adminTripDetailModal) adminTripDetailModal.style.display = 'flex';
}

// --- USER MANAGEMENT FUNCTIONS (Admin Fabio) ---
async function loadAndRenderUsersForAdmin() {
    if (!loggedInUserProfile || loggedInUserProfile.role !== 'admin' || loggedInUserProfile.username.toLowerCase() !== 'fabio') {
        if(userManagementTableBody) userManagementTableBody.innerHTML = '<tr><td colspan="3">Acesso negado.</td></tr>';
        return;
    }

    if(userManagementTableBody) userManagementTableBody.innerHTML = '<tr><td colspan="3">Carregando usuários...</td></tr>';
    try {
        const q = query(userProfilesCollection, orderBy("username"));
        const querySnapshot = await getDocs(q);
        userProfiles = []; 
        querySnapshot.forEach((doc) => {
            userProfiles.push({ id: doc.id, ...doc.data() });
        });

        renderUserManagementTable(userProfiles);
    } catch (error) {
        console.error("Error loading users for admin:", "Code:", error.code, "Message:", error.message);
        showFeedback(userManagementFeedback, "Erro ao carregar lista de usuários.", "error");
        if(userManagementTableBody) userManagementTableBody.innerHTML = '<tr><td colspan="3">Erro ao carregar usuários.</td></tr>';
    }
}

function renderUserManagementTable(usersToRender) {
    if(!userManagementTableBody) return;
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
    editingUserIdForAdmin = userProf.uid; 
    if(editUserIdInput) editUserIdInput.value = userProf.uid; 
    if(editUsernameDisplayInput) editUsernameDisplayInput.value = userProf.username;
    if(editUserRoleSelect) editUserRoleSelect.value = userProf.role;
    if(editUserNewPasswordInput) editUserNewPasswordInput.value = ''; 
    if(editUserConfirmNewPasswordInput) editUserConfirmNewPasswordInput.value = '';
    if(editUserModal) editUserModal.style.display = 'flex';
    showFeedback(editUserFeedback, "", "info"); 
}

async function handleEditUserFormSubmit(event) {
    event.preventDefault();
    if (!editingUserIdForAdmin) return;

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
            // Password update via client SDK for other users is generally not recommended/possible without re-authentication.
            // This part might need to be handled via Firebase Admin SDK on a backend or Firebase Console.
            showFeedback(editUserFeedback, "Papel do usuário atualizado. A alteração de senha por esta tela não é suportada diretamente pelo SDK do cliente para outros usuários. Use o console do Firebase ou peça ao usuário para redefinir.", "info");
        } else {
            showFeedback(editUserFeedback, "Papel do usuário atualizado com sucesso!", "success");
        }

        loadAndRenderUsersForAdmin(); 
        setTimeout(() => {
            if(closeEditUserModalBtn) closeEditUserModalBtn.click();
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

// --- EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded event fired.");
    if (!app || !auth || !db || !userProfilesCollection || !tripsCollection) {
        console.error("CRITICAL DOMContentLoaded: Firebase not initialized correctly. App listeners not added. Variables: ", {app, auth, db, userProfilesCollection, tripsCollection});
        const body = document.querySelector('body');
        if (body) {
            const errorDiv = document.createElement('div');
            errorDiv.textContent = "ERRO CRÍTICO: FALHA AO CONECTAR AOS SERVIÇOS DE DADOS. VERIFIQUE O CONSOLE (F12).";
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

    if (registerForm) registerForm.addEventListener('submit', handleRegister);
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (showRegisterViewLink) showRegisterViewLink.addEventListener('click', (e) => { e.preventDefault(); showView('registerView'); });
    if (showLoginViewLink) showLoginViewLink.addEventListener('click', (e) => { e.preventDefault(); showView('loginView'); });
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
                    if(myTripsTableBody) myTripsTableBody.innerHTML = '';
                    if(myTripsTablePlaceholder) myTripsTablePlaceholder.textContent = `Nenhum motorista encontrado com o nome "${driverNameToSearch}".`;
                    if(myTripsTable) myTripsTable.style.display = 'none';
                    if(myTripsTablePlaceholder) myTripsTablePlaceholder.style.display = 'block';
                    updateDriverSummary([], driverNameToSearch); 
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
        closeAdminTripDetailModalBtn.addEventListener('click', () => {if(adminTripDetailModal) adminTripDetailModal.style.display = 'none'});
    }

    if(editUserForm) editUserForm.addEventListener('submit', handleEditUserFormSubmit);
    if(closeEditUserModalBtn) {
        closeEditUserModalBtn.addEventListener('click', () => {if(editUserModal) editUserModal.style.display = 'none'});
    }

    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if(modal) {
            // modal.style.display = 'none'; // Already hidden by default HTML/CSS
            modal.addEventListener('click', (event) => {
                if (event.target === modal) {
                    (modal as HTMLElement).style.display = 'none';
                }
            });
        }
    });
    console.log("All DOMContentLoaded event listeners nominally set up.");
});
