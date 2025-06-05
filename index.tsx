
import { Chart, registerables, ChartConfiguration, ChartItem, ChartTypeRegistry, ChartDataset } from 'chart.js';
// Firebase App (o núcleo do Firebase SDK) é sempre necessário e deve ser listado primeiro
import { initializeApp, FirebaseApp } from "firebase/app";
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    User as FirebaseUser,
    updatePassword as updateUserPasswordInAuth,
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
    writeBatch,
    setDoc as firebaseSetDoc // Explicitly import setDoc
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
let app: FirebaseApp;
let auth: any; // getAuth()
let db: any; // getFirestore()

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    console.log("Firebase initialized successfully!");
} catch (error) {
    console.error("CRITICAL ERROR: Firebase initialization failed:", error);
    alert("Erro crítico: Não foi possível conectar ao serviço de dados. Verifique a configuração do Firebase e sua conexão com a internet.");
}


// --- INTERFACES ---
interface FuelEntry {
    id: string; // Mantido para consistência interna, não será ID de documento no Firestore
    liters: number;
    valuePerLiter: number;
    discount: number;
    totalValue: number;
}

interface Trip {
    id?: string; // ID do documento Firestore, opcional ao criar
    userId: string; // UID do Firebase Auth do motorista que registrou/pertence
    date: string; // Armazenar como string YYYY-MM-DD, converter para Timestamp se necessário para queries complexas
    driverName: string; // Denormalized for easy display
    cargoType?: string;
    kmInitial?: number;
    kmFinal?: number;
    weight?: number;
    unitValue?: number;
    freightValue: number;
    kmDriven?: number;
    fuelEntries: FuelEntry[];
    arla32Cost?: number;
    tollCost: number;
    commissionCost?: number;
    otherExpenses: number;
    expenseDescription?: string;
    totalFuelCost?: number;
    totalExpenses: number;
    netProfit: number;
    declaredValue?: number;
    createdAt?: Timestamp; // Firestore Timestamp
}

interface UserProfile { // Perfil do usuário no Firestore
    id?: string; // ID do documento Firestore (geralmente igual ao UID do Firebase Auth)
    uid: string; // UID do Firebase Auth
    username: string; // Nome de usuário/exibição
    email: string; // Email usado para login (do Firebase Auth)
    role: 'motorista' | 'admin';
    createdAt?: Timestamp;
}


interface MonthlyData {
    month: string; // YYYY-MM
    totalFreight: number;
    totalExpenses: number;
    netProfit: number;
}

interface SummaryData {
    totalTrips: number;
    totalFreight: number;
    totalExpenses: number;
    totalNetProfit: number;
    monthlyChartData: MonthlyData[];
}


// --- STATE VARIABLES ---
let trips: Trip[] = []; // Cache local de viagens carregadas
let editingTripId: string | null = null;
let currentUserForMyTripsSearch: string | null = null; // Username
let currentUidForMyTripsSearch: string | null = null; // UID do Firebase

let userProfiles: UserProfile[] = []; // Cache local de perfis de usuário (para admin)
let loggedInUser: FirebaseUser | null = null; // Usuário do Firebase Auth
let loggedInUserProfile: UserProfile | null = null; // Perfil do usuário logado do Firestore
let editingUserIdForAdmin: string | null = null; // UID do usuário sendo editado pelo admin
let adminSelectedDriverName: string | null = null; // Username
let adminSelectedDriverUid: string | null = null; // UID do Firebase

let adminSummaryChart: Chart | null = null;

// --- DOM ELEMENTS (Assume-se que são obtidos corretamente como antes) ---
const loginView = document.getElementById('loginView') as HTMLElement;
const registerView = document.getElementById('registerView') as HTMLElement;
const appContainer = document.getElementById('appContainer') as HTMLElement;
const loginForm = document.getElementById('loginForm') as HTMLFormElement;
const registerForm = document.getElementById('registerForm') as HTMLFormElement;
const tripForm = document.getElementById('tripForm') as HTMLFormElement;
const loginFeedback = document.getElementById('loginFeedback') as HTMLParagraphElement;
const registerFeedback = document.getElementById('registerFeedback') as HTMLParagraphElement;
const userFormFeedback = document.getElementById('userFormFeedback') as HTMLParagraphElement;
const myTripsFeedback = document.getElementById('myTripsFeedback') as HTMLParagraphElement;
const adminGeneralFeedback = document.getElementById('adminGeneralFeedback') as HTMLParagraphElement;
// const addUserFeedback = document.getElementById('addUserFeedback') as HTMLParagraphElement; // Removido, pois addUserByAdminForm será removido
const userManagementFeedback = document.getElementById('userManagementFeedback') as HTMLParagraphElement;
const editUserFeedback = document.getElementById('editUserFeedback') as HTMLParagraphElement;

const showRegisterViewLink = document.getElementById('showRegisterViewLink') as HTMLAnchorElement;
const showLoginViewLink = document.getElementById('showLoginViewLink') as HTMLAnchorElement;

const userViewBtn = document.getElementById('userViewBtn') as HTMLButtonElement;
const myTripsViewBtn = document.getElementById('myTripsViewBtn') as HTMLButtonElement;
const adminViewBtn = document.getElementById('adminViewBtn') as HTMLButtonElement;
const userManagementViewBtn = document.getElementById('userManagementViewBtn') as HTMLButtonElement;
const logoutBtn = document.getElementById('logoutBtn') as HTMLButtonElement;

const userView = document.getElementById('userView') as HTMLElement;
const myTripsView = document.getElementById('myTripsView') as HTMLElement;
const adminView = document.getElementById('adminView') as HTMLElement;
const userManagementView = document.getElementById('userManagementView') as HTMLElement;

const tripIdToEditInput = document.getElementById('tripIdToEdit') as HTMLInputElement;
const tripDateInput = document.getElementById('tripDate') as HTMLInputElement;
const driverNameInput = document.getElementById('driverName') as HTMLInputElement;
const cargoTypeInput = document.getElementById('cargoType') as HTMLInputElement;
const kmInitialInput = document.getElementById('kmInitial') as HTMLInputElement;
const kmFinalInput = document.getElementById('kmFinal') as HTMLInputElement;
const weightInput = document.getElementById('weight') as HTMLInputElement;
const unitValueInput = document.getElementById('unitValue') as HTMLInputElement;
const freightValueInput = document.getElementById('freightValue') as HTMLInputElement;
const fuelEntriesContainer = document.getElementById('fuelEntriesContainer') as HTMLElement;
const addFuelEntryBtn = document.getElementById('addFuelEntryBtn') as HTMLButtonElement;
const arla32CostInput = document.getElementById('arla32Cost') as HTMLInputElement;
const tollCostInput = document.getElementById('tollCost') as HTMLInputElement;
const commissionCostInput = document.getElementById('commissionCost') as HTMLInputElement;
const otherExpensesInput = document.getElementById('otherExpenses') as HTMLInputElement;
const expenseDescriptionInput = document.getElementById('expenseDescription') as HTMLInputElement;
const declaredValueInput = document.getElementById('declaredValue') as HTMLInputElement;
const submitTripBtn = document.getElementById('submitTripBtn') as HTMLButtonElement;
const cancelEditBtn = document.getElementById('cancelEditBtn') as HTMLButtonElement;

const driverSummaryContainer = document.getElementById('driverSummaryContainer') as HTMLElement;
const driverTotalTripsEl = document.getElementById('driverTotalTripsEl') as HTMLParagraphElement;
const driverTotalFreightParticipatedEl = document.getElementById('driverTotalFreightParticipatedEl') as HTMLParagraphElement;
const driverTotalEarningsEl = document.getElementById('driverTotalEarningsEl') as HTMLParagraphElement;
const myTripsDriverNameContainer = document.getElementById('myTripsDriverNameContainer') as HTMLElement;
const myTripsDriverNameInput = document.getElementById('myTripsDriverNameInput') as HTMLInputElement;
const loadMyTripsBtn = document.getElementById('loadMyTripsBtn') as HTMLButtonElement;
const myTripsFilterControls = document.getElementById('myTripsFilterControls') as HTMLElement;
const myTripsFilterStartDateInput = document.getElementById('myTripsFilterStartDate') as HTMLInputElement;
const myTripsFilterEndDateInput = document.getElementById('myTripsFilterEndDate') as HTMLInputElement;
const applyMyTripsFilterBtn = document.getElementById('applyMyTripsFilterBtn') as HTMLButtonElement;
const myTripsTable = document.getElementById('myTripsTable') as HTMLTableElement;
const myTripsTableBody = document.getElementById('myTripsTableBody') as HTMLTableSectionElement;
const myTripsTablePlaceholder = document.getElementById('myTripsTablePlaceholder') as HTMLParagraphElement;

const adminSummaryContainer = document.getElementById('adminSummaryContainer') as HTMLElement;
const adminSummaryFilterStartDateInput = document.getElementById('adminSummaryFilterStartDate') as HTMLInputElement;
const adminSummaryFilterEndDateInput = document.getElementById('adminSummaryFilterEndDate') as HTMLInputElement;
const applyAdminSummaryFilterBtn = document.getElementById('applyAdminSummaryFilterBtn') as HTMLButtonElement;
const adminTotalTripsEl = document.getElementById('adminTotalTripsEl') as HTMLParagraphElement;
const adminTotalFreightEl = document.getElementById('adminTotalFreightEl') as HTMLParagraphElement;
const adminTotalExpensesEl = document.getElementById('adminTotalExpensesEl') as HTMLParagraphElement;
const adminTotalNetProfitEl = document.getElementById('adminTotalNetProfitEl') as HTMLParagraphElement;
const adminSelectDriver = document.getElementById('adminSelectDriver') as HTMLSelectElement;
const adminLoadDriverTripsBtn = document.getElementById('adminLoadDriverTripsBtn') as HTMLButtonElement;
const adminDriverTripsSection = document.getElementById('adminDriverTripsSection') as HTMLElement;
const adminSelectedDriverNameDisplay = document.getElementById('adminSelectedDriverNameDisplay') as HTMLElement;
const adminDriverTripsTable = document.getElementById('adminDriverTripsTable') as HTMLTableElement;
const adminDriverTripsTableBody = document.getElementById('adminDriverTripsTableBody') as HTMLTableSectionElement;
const adminDriverTripsPlaceholder = document.getElementById('adminDriverTripsPlaceholder') as HTMLParagraphElement;
const adminTripDetailModal = document.getElementById('adminTripDetailModal') as HTMLElement;
const closeAdminTripDetailModalBtn = document.getElementById('closeAdminTripDetailModalBtn') as HTMLElement;
const adminTripDetailContent = document.getElementById('adminTripDetailContent') as HTMLElement;

// const addUserByAdminForm = document.getElementById('addUserByAdminForm') as HTMLFormElement; // Removido
const userManagementTableBody = document.getElementById('userManagementTableBody') as HTMLTableSectionElement;
const editUserModal = document.getElementById('editUserModal') as HTMLElement;
const closeEditUserModalBtn = document.getElementById('closeEditUserModalBtn') as HTMLElement;
const editUserForm = document.getElementById('editUserForm') as HTMLFormElement;
const editUserIdInput = document.getElementById('editUserId') as HTMLInputElement; // Armazenará UID
const editUsernameDisplayInput = document.getElementById('editUsernameDisplay') as HTMLInputElement;
const editUserRoleSelect = document.getElementById('editUserRole') as HTMLSelectElement;
const editUserNewPasswordInput = document.getElementById('editUserNewPassword') as HTMLInputElement;
const editUserConfirmNewPasswordInput = document.getElementById('editUserConfirmNewPassword') as HTMLInputElement;

let fuelEntryIdCounter = 0; // Para IDs de elementos HTML, não para IDs de dados de combustível

// --- UTILITY FUNCTIONS ---
function generateId(): string { // Para IDs de elementos HTML (ex: fuel entries) se necessário
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

function formatDate(dateInput: string | Timestamp | Date | null | undefined): string {
    if (!dateInput) return 'Data inválida';

    let dateToFormat: Date;

    if (typeof dateInput === 'string') {
        // Handles YYYY-MM-DD string.
        // Example: "2023-10-26"
        // new Date("2023-10-26T00:00:00Z") is correct for UTC interpretation
        dateToFormat = new Date(dateInput + 'T00:00:00Z');
    } else if (dateInput instanceof Date) { // Check if it's already a Date object
        dateToFormat = dateInput;
    } else if (typeof (dateInput as any).toDate === 'function') { // Duck-typing for Firestore Timestamp
        dateToFormat = (dateInput as Timestamp).toDate();
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


function formatCurrency(value: number | undefined | null): string {
    if (value === undefined || value === null || isNaN(value)) {
        return 'R$ 0,00';
    }
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function showFeedback(element: HTMLElement | null, message: string, type: 'success' | 'error' | 'info') {
    if (!element) {
        console.warn("Feedback element not found for message:", message);
        return;
    }
    element.textContent = message;
    element.className = `feedback-message ${type}`;
    element.style.display = 'block';
    setTimeout(() => {
        element.style.display = 'none';
        element.textContent = '';
    }, 5000);
}

// --- VIEW MANAGEMENT ---
function showView(viewId: string) {
    const views = document.querySelectorAll('.view') as NodeListOf<HTMLElement>;
    views.forEach(view => view.style.display = 'none');
    loginView.style.display = 'none';
    registerView.style.display = 'none';
    appContainer.style.display = 'none';

    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => btn.setAttribute('aria-pressed', 'false'));


    if (viewId === 'loginView') {
        loginView.style.display = 'flex';
    } else if (viewId === 'registerView') {
        registerView.style.display = 'flex';
    } else {
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
        logoutBtn.style.display = 'inline-block';
        if (loggedInUserProfile.role === 'admin') {
            userViewBtn.style.display = 'inline-block';
            myTripsViewBtn.style.display = 'inline-block';
            adminViewBtn.style.display = 'inline-block';
            if (loggedInUserProfile.username.toLowerCase() === 'fabio') { // Ou verifique o email/UID específico
                 userManagementViewBtn.style.display = 'inline-block';
            } else {
                userManagementViewBtn.style.display = 'none';
            }
        } else { // 'motorista'
            userViewBtn.style.display = 'inline-block';
            myTripsViewBtn.style.display = 'inline-block';
            adminViewBtn.style.display = 'none';
            userManagementViewBtn.style.display = 'none';
        }
    } else {
        userViewBtn.style.display = 'none';
        myTripsViewBtn.style.display = 'none';
        adminViewBtn.style.display = 'none';
        userManagementViewBtn.style.display = 'none';
        logoutBtn.style.display = 'none';
    }
}

// --- AUTHENTICATION WITH FIREBASE ---
async function handleRegister(event: Event) {
    event.preventDefault();
    console.log("Attempting registration...");
    const usernameInput = document.getElementById('registerUsername') as HTMLInputElement;
    const passwordInput = document.getElementById('registerPassword') as HTMLInputElement;
    const confirmPasswordInput = document.getElementById('registerConfirmPassword') as HTMLInputElement;

    const username = usernameInput.value.trim(); // Usaremos como nome de exibição
    const email = `${username.toLowerCase().replace(/\s+/g, '.')}@example.com`; // Cria um email único, mas o ideal é coletar email real
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    console.log("Registration details:", { username, email });


    if (!username || !password || !confirmPassword) {
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
        console.log("Calling createUserWithEmailAndPassword...");
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const firebaseUser = userCredential.user;
        console.log("User created in Auth:", firebaseUser.uid);

        // Criar perfil do usuário no Firestore
        const newUserProfile: UserProfile = {
            uid: firebaseUser.uid,
            username: username,
            email: firebaseUser.email || email, // Usar o email do Firebase Auth
            role: 'motorista', // Papel padrão
            createdAt: Timestamp.now()
        };
        console.log("Creating user profile in Firestore:", newUserProfile);
        // Use a importação explícita de firebaseSetDoc
        await firebaseSetDoc(doc(db, "userProfiles", firebaseUser.uid), newUserProfile);
        console.log("User profile created in Firestore.");


        showFeedback(registerFeedback, "Cadastro realizado com sucesso! Faça o login.", "success");
        registerForm.reset();
        setTimeout(() => showView('loginView'), 1500);

    } catch (error: any) {
        console.error("CRITICAL ERROR during registration:", error, "Error Code:", error.code, "Error Message:", error.message);
        if (error.code === 'auth/email-already-in-use') {
            showFeedback(registerFeedback, "Nome de usuário (ou e-mail derivado) já existe. Tente outro.", "error");
        } else if (error.code === 'auth/weak-password') {
            showFeedback(registerFeedback, "Senha muito fraca. Tente uma mais forte.", "error");
        } else {
            showFeedback(registerFeedback, "Erro ao registrar. Verifique o console para detalhes.", "error");
        }
    }
}

async function handleLogin(event: Event) {
    event.preventDefault();
    console.log("handleLogin function started.");
    const usernameInput = document.getElementById('loginUsername') as HTMLInputElement;
    const passwordInput = document.getElementById('loginPassword') as HTMLInputElement;

    const username = usernameInput.value.trim();
    const email = `${username.toLowerCase().replace(/\s+/g, '.')}@example.com`;
    const password = passwordInput.value;
    console.log("Attempting login with:", { username, email });

    if (!username || !password) {
        showFeedback(loginFeedback, "Nome de usuário e senha são obrigatórios.", "error");
        console.log("Login aborted: username or password empty.");
        return;
    }

    try {
        console.log("Calling signInWithEmailAndPassword...");
        await signInWithEmailAndPassword(auth, email, password);
        console.log("signInWithEmailAndPassword successful (or at least did not throw immediately). Waiting for onAuthStateChanged.");
        showFeedback(loginFeedback, "Login bem-sucedido! Redirecionando...", "success");
        loginForm.reset();
        // onAuthStateChanged irá lidar com a atualização do UI e do estado loggedInUser/loggedInUserProfile
    } catch (error: any) {
        console.error("CRITICAL ERROR during login:", error, "Error Code:", error.code, "Error Message:", error.message);
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            showFeedback(loginFeedback, "Nome de usuário ou senha incorretos.", "error");
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
        // onAuthStateChanged irá limpar loggedInUser e loggedInUserProfile e redirecionar
        showFeedback(loginFeedback, "Você foi desconectado.", "info");
        // Limpeza adicional de UI pode ser feita aqui ou em onAuthStateChanged
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
        console.error("CRITICAL ERROR during logout:", error);
        showFeedback(loginFeedback, "Erro ao sair. Tente novamente.", "error");
    }
}

// Listener de estado de autenticação
onAuthStateChanged(auth, async (user) => {
    console.log("onAuthStateChanged triggered. User object:", user);
    if (user) {
        loggedInUser = user;
        console.log("User is authenticated with UID:", user.uid);
        try {
            console.log("Attempting to fetch user profile from Firestore for UID:", user.uid);
            const userProfileDocRef = doc(db, "userProfiles", user.uid);
            const userProfileDoc = await getDoc(userProfileDocRef);

            if (userProfileDoc.exists()) {
                loggedInUserProfile = { id: userProfileDoc.id, ...userProfileDoc.data() } as UserProfile;
                console.log("User profile found in Firestore:", loggedInUserProfile);

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
                if (myTripsViewBtn.style.display !== 'none') {
                    console.log("Initializing My Trips View for logged in user.");
                    initializeMyTripsView();
                }
                if (userManagementViewBtn.style.display !== 'none' && loggedInUserProfile.username.toLowerCase() === 'fabio') {
                    console.log("User is Fabio (admin), initializing User Management View.");
                    initializeUserManagementView();
                }

            } else {
                console.error("CRITICAL: User profile NOT FOUND in Firestore for UID:", user.uid);
                await handleLogout(); // Forçar logout se o perfil não existir
                showFeedback(loginFeedback, "Perfil do usuário não encontrado. Faça o cadastro novamente ou contate o suporte.", "error");
            }
        } catch (error) {
            console.error("CRITICAL ERROR fetching user profile:", error);
            await handleLogout(); // Forçar logout em caso de erro
            showFeedback(loginFeedback, "Erro crítico ao carregar dados do usuário. Verifique o console.", "error");
        }
    } else {
        console.log("User is not authenticated (logged out or session ended).");
        loggedInUser = null;
        loggedInUserProfile = null;
        trips = []; // Limpar cache de viagens
        userProfiles = []; // Limpar cache de perfis
        updateNavVisibility();
        showView('loginView');
        console.log("User is logged out, showing loginView.");
    }
    console.log("onAuthStateChanged finished processing.");
});


// --- TRIP MANAGEMENT WITH FIRESTORE ---

function addFuelEntryToForm(entry?: FuelEntry) {
    const entryId = entry ? entry.id : `fuel_${fuelEntryIdCounter++}`;
    const fuelDiv = document.createElement('div');
    fuelDiv.className = 'fuel-entry-item';
    fuelDiv.id = entryId; // HTML element ID
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
    fuelEntriesContainer.appendChild(fuelDiv);

    const litersInput = document.getElementById(`liters_${entryId}`) as HTMLInputElement;
    const valuePerLiterInput = document.getElementById(`valuePerLiter_${entryId}`) as HTMLInputElement;
    const discountInput = document.getElementById(`discount_${entryId}`) as HTMLInputElement;
    const totalValueInput = document.getElementById(`totalValue_${entryId}`) as HTMLInputElement;

    function calculateTotalFuelValue() {
        const liters = parseFloat(litersInput.value) || 0;
        const valuePerLiter = parseFloat(valuePerLiterInput.value) || 0;
        const discount = parseFloat(discountInput.value) || 0;
        const total = (liters * valuePerLiter) - discount;
        totalValueInput.value = total.toFixed(2);
    }

    litersInput.addEventListener('input', calculateTotalFuelValue);
    valuePerLiterInput.addEventListener('input', calculateTotalFuelValue);
    discountInput.addEventListener('input', calculateTotalFuelValue);

    fuelDiv.querySelector('.remove-fuel-entry-btn')?.addEventListener('click', (e) => {
        const targetButton = e.target as HTMLButtonElement;
        const idToRemove = targetButton.dataset.entryId;
        const entryElementToRemove = document.getElementById(idToRemove!);
        if (entryElementToRemove) {
            entryElementToRemove.remove();
        }
    });
    if(entry) calculateTotalFuelValue(); // Calculate if pre-filling
}

async function handleTripFormSubmit(event: Event) {
    event.preventDefault();
    if (!loggedInUser || !loggedInUserProfile) {
        showFeedback(userFormFeedback, "Você precisa estar logado para registrar uma viagem.", "error");
        return;
    }

    const formData = new FormData(tripForm);
    const fuelEntries: FuelEntry[] = [];
    const fuelEntryElements = fuelEntriesContainer.querySelectorAll('.fuel-entry-item');
    let totalFuelCost = 0;

    fuelEntryElements.forEach(entryEl => {
        const entryId = entryEl.id; // HTML element ID
        const liters = parseFloat((entryEl.querySelector(`input[name="liters"]`) as HTMLInputElement).value) || 0;
        const valuePerLiter = parseFloat((entryEl.querySelector(`input[name="valuePerLiter"]`) as HTMLInputElement).value) || 0;
        const discount = parseFloat((entryEl.querySelector(`input[name="discount"]`) as HTMLInputElement).value) || 0;
        const totalValue = (liters * valuePerLiter) - discount;

        if (liters > 0 && valuePerLiter > 0) { // Only add valid entries
            fuelEntries.push({
                id: entryId, // este ID é do elemento HTML, não persistirá no Firestore com este valor.
                liters,
                valuePerLiter,
                discount,
                totalValue
            });
            totalFuelCost += totalValue;
        }
    });

    const kmInitial = parseFloat(formData.get('kmInitial') as string) || 0;
    const kmFinal = parseFloat(formData.get('kmFinal') as string) || 0;
    const kmDriven = (kmFinal > kmInitial) ? kmFinal - kmInitial : 0;

    const arla32Cost = parseFloat(formData.get('arla32Cost') as string) || 0;
    const tollCost = parseFloat(formData.get('tollCost') as string) || 0;
    const commissionCost = parseFloat(formData.get('commissionCost') as string) || 0;
    const otherExpenses = parseFloat(formData.get('otherExpenses') as string) || 0;

    const totalExpenses = totalFuelCost + arla32Cost + tollCost + otherExpenses + commissionCost;
    const freightValue = parseFloat(formData.get('freightValue') as string) || 0;
    const netProfit = freightValue - totalExpenses; // Lucro bruto da viagem, antes da comissão do motorista se aplicável por fora
                                                // Se comissãoCost é a comissão do motorista, ela já está em totalExpenses.

    const tripData: Trip = {
        userId: loggedInUser.uid,
        driverName: (formData.get('driverName') as string).trim() || loggedInUserProfile.username, // Usa o nome do perfil se não preenchido
        date: formData.get('tripDate') as string,
        cargoType: formData.get('cargoType') as string || '',
        kmInitial: kmInitial,
        kmFinal: kmFinal,
        kmDriven: kmDriven,
        weight: parseFloat(formData.get('weight') as string) || 0,
        unitValue: parseFloat(formData.get('unitValue') as string) || 0,
        freightValue: freightValue,
        fuelEntries: fuelEntries,
        arla32Cost: arla32Cost,
        tollCost: tollCost,
        commissionCost: commissionCost,
        otherExpenses: otherExpenses,
        expenseDescription: formData.get('expenseDescription') as string || '',
        totalFuelCost: totalFuelCost,
        totalExpenses: totalExpenses,
        netProfit: netProfit,
        declaredValue: parseFloat(formData.get('declaredValue') as string) || 0,
        createdAt: Timestamp.now()
    };

    try {
        submitTripBtn.disabled = true;
        submitTripBtn.textContent = 'Salvando...';

        if (editingTripId) {
            const tripRef = doc(db, "trips", editingTripId);
            await updateDoc(tripRef, tripData);
            showFeedback(userFormFeedback, "Viagem atualizada com sucesso!", "success");
        } else {
            await addDoc(collection(db, "trips"), tripData);
            showFeedback(userFormFeedback, "Viagem registrada com sucesso!", "success");
        }
        tripForm.reset();
        fuelEntriesContainer.innerHTML = '';
        fuelEntryIdCounter = 0;
        editingTripId = null;
        tripIdToEditInput.value = '';
        if (driverNameInput && loggedInUserProfile) driverNameInput.value = loggedInUserProfile.username; // Pre-fill driver name
        submitTripBtn.textContent = 'Salvar Viagem';
        cancelEditBtn.style.display = 'none';

        // Atualizar "Minhas Viagens" se estiver visível e for do usuário logado
        if (myTripsView.style.display === 'block' && (!currentUserForMyTripsSearch || currentUserForMyTripsSearch === loggedInUserProfile.username)) {
            loadAndRenderMyTrips();
        }
         // Atualizar resumo do admin se estiver na adminView
        if (adminView.style.display === 'block') {
            updateAdminSummary();
            if (adminSelectedDriverUid === loggedInUser.uid) { // Se o admin estava vendo as viagens do motorista que acabou de registrar
                loadAndRenderAdminDriverTrips(adminSelectedDriverUid, loggedInUserProfile.username);
            }
        }

    } catch (error) {
        console.error("Error saving trip to Firestore:", error);
        showFeedback(userFormFeedback, "Erro ao salvar viagem. Tente novamente.", "error");
        submitTripBtn.textContent = editingTripId ? 'Salvar Alterações' : 'Salvar Viagem';
    } finally {
        submitTripBtn.disabled = false;
    }
}

async function loadAndRenderMyTrips(filterStartDate?: string, filterEndDate?: string) {
    if (!loggedInUserProfile) {
        myTripsTablePlaceholder.textContent = 'Você precisa estar logado para ver suas viagens.';
        myTripsTable.style.display = 'none';
        myTripsTablePlaceholder.style.display = 'block';
        return;
    }

    let targetUid = loggedInUser!.uid; // Padrão: viagens do usuário logado
    let targetUsername = loggedInUserProfile.username;

    // Se admin está buscando por outro motorista
    if (loggedInUserProfile.role === 'admin' && currentUidForMyTripsSearch && currentUserForMyTripsSearch) {
        targetUid = currentUidForMyTripsSearch;
        targetUsername = currentUserForMyTripsSearch;
    }


    myTripsTablePlaceholder.textContent = `Carregando viagens de ${targetUsername}...`;
    myTripsTable.style.display = 'none';
    myTripsTablePlaceholder.style.display = 'block';
    myTripsTableBody.innerHTML = '';

    try {
        let q = query(collection(db, "trips"), where("userId", "==", targetUid), orderBy("date", "desc"));

        // Aplicar filtros de data se fornecidos
        if (filterStartDate) {
            q = query(q, where("date", ">=", filterStartDate));
        }
        if (filterEndDate) {
            // Para 'menor ou igual a', precisamos ajustar a data final para o fim do dia ou usar uma string que inclua o dia todo
            // Como 'date' é YYYY-MM-DD, a comparação direta funciona
            q = query(q, where("date", "<=", filterEndDate));
        }


        const querySnapshot = await getDocs(q);
        const fetchedTrips: Trip[] = [];
        querySnapshot.forEach((doc) => {
            fetchedTrips.push({ id: doc.id, ...doc.data() } as Trip);
        });

        trips = fetchedTrips; // Atualiza o cache local se necessário para esta visualização

        if (trips.length === 0) {
            myTripsTablePlaceholder.textContent = `Nenhuma viagem encontrada para ${targetUsername}` +
                `${(filterStartDate || filterEndDate) ? ' nos filtros aplicados.' : '.'}`;
        } else {
            myTripsTable.style.display = 'table';
            myTripsTablePlaceholder.style.display = 'none';
            renderMyTripsTable(trips);
        }
        updateDriverSummary(trips, targetUsername); // Atualiza o resumo com as viagens filtradas/carregadas

    } catch (error) {
        console.error(`Error loading trips for ${targetUsername} from Firestore:`, error);
        showFeedback(myTripsFeedback, `Erro ao carregar viagens de ${targetUsername}.`, "error");
        myTripsTablePlaceholder.textContent = `Erro ao carregar viagens de ${targetUsername}.`;
    }
}

function renderMyTripsTable(tripsToRender: Trip[]) {
    myTripsTableBody.innerHTML = '';
    if (tripsToRender.length === 0) {
        myTripsTable.style.display = 'none';
        myTripsTablePlaceholder.style.display = 'block';
        myTripsTablePlaceholder.textContent = 'Nenhuma viagem para exibir com os filtros atuais.';
        return;
    }

    myTripsTable.style.display = 'table';
    myTripsTablePlaceholder.style.display = 'none';

    tripsToRender.forEach(trip => {
        const row = myTripsTableBody.insertRow();
        row.insertCell().textContent = formatDate(trip.date);
        row.insertCell().textContent = trip.cargoType || 'N/A';
        row.insertCell().textContent = formatCurrency(trip.freightValue);
        row.insertCell().textContent = formatCurrency(trip.totalExpenses);
        row.insertCell().textContent = formatCurrency(trip.commissionCost); // Alterado de netProfit para commissionCost

        const actionsCell = row.insertCell();
        const editButton = document.createElement('button');
        editButton.className = 'control-btn small-btn';
        editButton.textContent = 'Editar';
        editButton.setAttribute('aria-label', `Editar viagem de ${formatDate(trip.date)}`);
        editButton.onclick = () => loadTripForEditing(trip.id!);
        actionsCell.appendChild(editButton);

        // Lógica de permissão para excluir
        let canDelete = false;
        if (loggedInUserProfile && trip.userId === loggedInUser!.uid) { // Motorista pode excluir suas próprias viagens
            canDelete = true;
        }
        if (loggedInUserProfile && loggedInUserProfile.role === 'admin' && loggedInUserProfile.username.toLowerCase() === 'fabio') {
            // Admin "Fabio" pode excluir qualquer viagem nesta tela (após busca)
            canDelete = true;
        }


        if (canDelete) {
            const deleteButton = document.createElement('button');
            deleteButton.className = 'control-btn danger-btn small-btn';
            deleteButton.textContent = 'Excluir';
            deleteButton.setAttribute('aria-label', `Excluir viagem de ${formatDate(trip.date)}`);
            deleteButton.style.marginLeft = '0.5rem';
            deleteButton.onclick = () => confirmDeleteTrip(trip.id!, trip.driverName);
            actionsCell.appendChild(deleteButton);
        }
    });
}

async function loadTripForEditing(tripId: string) {
    try {
        const tripDoc = await getDoc(doc(db, "trips", tripId));
        if (tripDoc.exists()) {
            const trip = { id: tripDoc.id, ...tripDoc.data() } as Trip;

            // Verificar permissão: só o motorista da viagem ou um admin podem editar
            if (loggedInUser!.uid !== trip.userId && loggedInUserProfile?.role !== 'admin') {
                showFeedback(userFormFeedback, "Você não tem permissão para editar esta viagem.", "error");
                return;
            }

            tripForm.reset(); // Limpa o formulário antes de preencher
            fuelEntriesContainer.innerHTML = ''; // Limpa abastecimentos anteriores

            tripIdToEditInput.value = trip.id!;
            editingTripId = trip.id!;
            if(driverNameInput) driverNameInput.value = trip.driverName; // Manter o nome do motorista original da viagem
            tripDateInput.value = trip.date; // Assumindo que trip.date está em YYYY-MM-DD
            cargoTypeInput.value = trip.cargoType || '';
            kmInitialInput.value = trip.kmInitial?.toString() || '';
            kmFinalInput.value = trip.kmFinal?.toString() || '';
            weightInput.value = trip.weight?.toString() || '';
            unitValueInput.value = trip.unitValue?.toString() || '';
            freightValueInput.value = trip.freightValue.toString();

            trip.fuelEntries.forEach(entry => addFuelEntryToForm(entry));

            arla32CostInput.value = trip.arla32Cost?.toString() || '';
            tollCostInput.value = trip.tollCost.toString();
            commissionCostInput.value = trip.commissionCost?.toString() || '';
            otherExpensesInput.value = trip.otherExpenses.toString();
            expenseDescriptionInput.value = trip.expenseDescription || '';
            declaredValueInput.value = trip.declaredValue?.toString() || '';


            submitTripBtn.textContent = 'Salvar Alterações';
            cancelEditBtn.style.display = 'inline-block';
            showView('userView'); // Mudar para a tela de formulário
            userView.scrollIntoView({ behavior: 'smooth' });
            showFeedback(userFormFeedback, `Editando viagem de ${trip.driverName} do dia ${formatDate(trip.date)}.`, "info");

        } else {
            showFeedback(myTripsFeedback, "Viagem não encontrada para edição.", "error");
        }
    } catch (error) {
        console.error("Error loading trip for editing:", error);
        showFeedback(myTripsFeedback, "Erro ao carregar viagem para edição.", "error");
    }
}


function confirmDeleteTrip(tripId: string, driverNameForConfirm: string) {
    if (!tripId) return;

    // Verificar permissão ANTES de mostrar o confirm
    const tripToDelete = trips.find(t => t.id === tripId) || // Procura no cache local de 'Minhas Viagens'
                        (adminView.style.display === 'block' ? trips.find(t=>t.id === tripId) : null); // Ou no cache de viagens do admin se aplicável

    if (tripToDelete) {
         if (loggedInUser!.uid !== tripToDelete.userId &&
            !(loggedInUserProfile?.role === 'admin' && loggedInUserProfile.username.toLowerCase() === 'fabio')) {
            showFeedback(myTripsFeedback, "Você não tem permissão para excluir esta viagem.", "error");
            return;
        }
    } else if (loggedInUserProfile?.role !== 'admin' || loggedInUserProfile.username.toLowerCase() !== 'fabio') {
        // Se a viagem não está no cache E o usuário não é o admin Fabio, recusa.
        // Isso é uma proteção extra, mas a verificação no `tripToDelete` deve ser suficiente se o cache estiver atualizado.
        showFeedback(myTripsFeedback, "Viagem não encontrada ou permissão negada.", "error");
        return;
    }


    if (confirm(`Tem certeza que deseja excluir a viagem de ${driverNameForConfirm}? Esta ação não pode ser desfeita.`)) {
        deleteTrip(tripId);
    }
}

async function deleteTrip(tripId: string) {
    try {
        await deleteDoc(doc(db, "trips", tripId));
        showFeedback(myTripsFeedback, "Viagem excluída com sucesso.", "success");
        // Recarregar a lista de viagens da view atual
        if (myTripsView.style.display === 'block') {
            loadAndRenderMyTrips(myTripsFilterStartDateInput.value, myTripsFilterEndDateInput.value);
        }
        if (adminView.style.display === 'block' && adminSelectedDriverUid) {
            loadAndRenderAdminDriverTrips(adminSelectedDriverUid, adminSelectedDriverName!);
            updateAdminSummary(); // Resumo geral também pode mudar
        } else if (adminView.style.display === 'block') {
            updateAdminSummary(); // Se nenhuma viagem de motorista específica estiver carregada
        }

    } catch (error) {
        console.error("Error deleting trip from Firestore:", error);
        showFeedback(myTripsFeedback, "Erro ao excluir viagem. Tente novamente.", "error");
    }
}

function updateDriverSummary(summaryTrips: Trip[], driverDisplayName: string) {
    let totalTrips = summaryTrips.length;
    let totalFreight = 0;
    let totalEarnings = 0; // Total de comissões

    summaryTrips.forEach(trip => {
        totalFreight += trip.freightValue;
        totalEarnings += trip.commissionCost || 0;
    });

    if (driverTotalTripsEl) driverTotalTripsEl.textContent = totalTrips.toString();
    if (driverTotalFreightParticipatedEl) driverTotalFreightParticipatedEl.textContent = formatCurrency(totalFreight);
    if (driverTotalEarningsEl) driverTotalEarningsEl.textContent = formatCurrency(totalEarnings);

    // Atualiza o título do resumo, se necessário
    const summaryTitle = driverSummaryContainer.querySelector('h3');
    if (summaryTitle) {
        if (loggedInUserProfile?.role === 'admin' && currentUserForMyTripsSearch && currentUserForMyTripsSearch !== loggedInUserProfile.username) {
            summaryTitle.textContent = `Resumo de ${driverDisplayName}`;
        } else {
            summaryTitle.textContent = `Seu Resumo de Viagens`;
        }
    }
}


// --- ADMIN PANEL FUNCTIONS ---
async function updateAdminSummary(filterStartDate?: string, filterEndDate?: string) {
    let q = query(collection(db, "trips"), orderBy("date", "desc"));

    if (filterStartDate) q = query(q, where("date", ">=", filterStartDate));
    if (filterEndDate) q = query(q, where("date", "<=", filterEndDate));

    try {
        const querySnapshot = await getDocs(q);
        let totalTrips = 0;
        let totalFreight = 0;
        let totalExpensesOverall = 0; // Despesas totais de todas as viagens
        let totalNetProfitOverall = 0; // Lucro líquido total de todas as viagens

        const monthlyDataMap = new Map<string, MonthlyData>();

        querySnapshot.forEach((doc) => {
            const trip = doc.data() as Trip;
            totalTrips++;
            totalFreight += trip.freightValue;
            totalExpensesOverall += trip.totalExpenses;
            totalNetProfitOverall += trip.netProfit;

            // Para o gráfico (se fosse reintroduzido)
            // const monthYear = trip.date.substring(0, 7); // YYYY-MM
            // const currentMonthData = monthlyDataMap.get(monthYear) || { month: monthYear, totalFreight: 0, totalExpenses: 0, netProfit: 0 };
            // currentMonthData.totalFreight += trip.freightValue;
            // currentMonthData.totalExpenses += trip.totalExpenses;
            // currentMonthData.netProfit += trip.netProfit;
            // monthlyDataMap.set(monthYear, currentMonthData);
        });

        adminTotalTripsEl.textContent = totalTrips.toString();
        adminTotalFreightEl.textContent = formatCurrency(totalFreight);
        adminTotalExpensesEl.textContent = formatCurrency(totalExpensesOverall);
        adminTotalNetProfitEl.textContent = formatCurrency(totalNetProfitOverall);

        // const monthlyChartData = Array.from(monthlyDataMap.values()).sort((a, b) => a.month.localeCompare(b.month));
        // renderAdminSummaryChart({ totalTrips, totalFreight, totalExpenses: totalExpensesOverall, totalNetProfit: totalNetProfitOverall, monthlyChartData });

    } catch (error) {
        console.error("Error updating admin summary:", error);
        showFeedback(adminGeneralFeedback, "Erro ao atualizar resumo do administrador.", "error");
    }
}

async function populateAdminDriverSelect() {
    if (!adminSelectDriver) return;
    adminSelectDriver.innerHTML = '<option value="">-- Carregando Motoristas --</option>';
    try {
        const q = query(collection(db, "userProfiles"), where("role", "==", "motorista"), orderBy("username"));
        const querySnapshot = await getDocs(q);
        const options = ['<option value="">-- Selecione um Motorista --</option>'];
        querySnapshot.forEach((doc) => {
            const user = doc.data() as UserProfile;
            options.push(`<option value="${user.uid}">${user.username}</option>`);
        });
        adminSelectDriver.innerHTML = options.join('');
    } catch (error) {
        console.error("Error populating admin driver select:", error);
        adminSelectDriver.innerHTML = '<option value="">-- Erro ao carregar --</option>';
    }
}

async function loadAndRenderAdminDriverTrips(driverUid: string, driverName: string) {
    if (!driverUid) {
        adminDriverTripsSection.style.display = 'none';
        return;
    }
    adminSelectedDriverUid = driverUid;
    adminSelectedDriverName = driverName;

    adminSelectedDriverNameDisplay.textContent = `Viagens de ${driverName}`;
    adminDriverTripsTableBody.innerHTML = '';
    adminDriverTripsPlaceholder.textContent = `Carregando viagens de ${driverName}...`;
    adminDriverTripsTable.style.display = 'none';
    adminDriverTripsPlaceholder.style.display = 'block';
    adminDriverTripsSection.style.display = 'block';

    try {
        const q = query(collection(db, "trips"), where("userId", "==", driverUid), orderBy("date", "desc"));
        const querySnapshot = await getDocs(q);
        const driverTrips: Trip[] = [];
        querySnapshot.forEach((doc) => {
            driverTrips.push({ id: doc.id, ...doc.data() } as Trip);
        });

        trips = driverTrips; // Atualiza cache global se admin está focando neste motorista

        if (driverTrips.length === 0) {
            adminDriverTripsPlaceholder.textContent = `Nenhuma viagem encontrada para ${driverName}.`;
        } else {
            adminDriverTripsTable.style.display = 'table';
            adminDriverTripsPlaceholder.style.display = 'none';
        }
        renderAdminDriverTripsTable(driverTrips);

    } catch (error) {
        console.error(`Error loading trips for driver ${driverName} (UID: ${driverUid}):`, error);
        showFeedback(adminGeneralFeedback, `Erro ao carregar viagens de ${driverName}.`, "error");
        adminDriverTripsPlaceholder.textContent = `Erro ao carregar viagens de ${driverName}.`;
    }
}

function renderAdminDriverTripsTable(driverTripsToRender: Trip[]) {
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

        // Botão de excluir foi removido desta tabela específica do admin.
        // O admin "Fabio" pode excluir pela tela "Minhas Viagens" após buscar o motorista.
    });
}

function showAdminTripDetailModal(trip: Trip) {
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

// --- USER MANAGEMENT FUNCTIONS (Admin Fabio) ---
async function loadAndRenderUsersForAdmin() {
    if (!loggedInUserProfile || loggedInUserProfile.role !== 'admin' || loggedInUserProfile.username.toLowerCase() !== 'fabio') {
        userManagementTableBody.innerHTML = '<tr><td colspan="3">Acesso negado.</td></tr>';
        return;
    }

    userManagementTableBody.innerHTML = '<tr><td colspan="3">Carregando usuários...</td></tr>';
    try {
        const q = query(collection(db, "userProfiles"), orderBy("username"));
        const querySnapshot = await getDocs(q);
        userProfiles = []; // Limpa cache local
        querySnapshot.forEach((doc) => {
            userProfiles.push({ id: doc.id, ...doc.data() } as UserProfile);
        });

        renderUserManagementTable(userProfiles);
    } catch (error) {
        console.error("Error loading users for admin:", error);
        showFeedback(userManagementFeedback, "Erro ao carregar lista de usuários.", "error");
        userManagementTableBody.innerHTML = '<tr><td colspan="3">Erro ao carregar usuários.</td></tr>';
    }
}

function renderUserManagementTable(usersToRender: UserProfile[]) {
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

        // Botão de excluir usuário pode ser perigoso e complexo (precisa excluir do Auth e Firestore, e viagens associadas?)
        // Por ora, admin "Fabio" apenas edita papéis. Exclusão via console do Firebase.
    });
}

function openEditUserModal(userProf: UserProfile) {
    editingUserIdForAdmin = userProf.uid; // Usar UID
    editUserIdInput.value = userProf.uid; // Guardar UID no input hidden
    editUsernameDisplayInput.value = userProf.username;
    editUserRoleSelect.value = userProf.role;
    editUserNewPasswordInput.value = ''; // Limpar campos de senha
    editUserConfirmNewPasswordInput.value = '';
    editUserForm.reset(); // Garante que o form esteja limpo, exceto os valores preenchidos acima
    editUsernameDisplayInput.value = userProf.username; // Repopulate readonly field
    editUserRoleSelect.value = userProf.role; // Repopulate role
    editUserModal.style.display = 'flex';
    showFeedback(editUserFeedback, "", "info"); // Clear previous feedback
}

async function handleEditUserFormSubmit(event: Event) {
    event.preventDefault();
    if (!editingUserIdForAdmin) return;

    const newRole = editUserRoleSelect.value as 'motorista' | 'admin';
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
        const userProfileRef = doc(db, "userProfiles", editingUserIdForAdmin);
        await updateDoc(userProfileRef, { role: newRole });

        if (newPassword) {
            // Alterar senha no Firebase Auth requer que o usuário esteja logado OU o uso do Admin SDK (não disponível no cliente).
            // A maneira mais segura de um admin redefinir senha seria através de um link de redefinição enviado ao email do usuário.
            // Para este app, vamos simplificar: o Admin "Fabio" NÃO pode mudar senhas de outros usuários por aqui.
            // O usuário precisaria fazer isso sozinho ou o admin "Fabio" faria pelo console do Firebase.
            // Se esta funcionalidade for crítica, precisa ser reavaliada com Admin SDK em Cloud Function.
            showFeedback(editUserFeedback, "Papel do usuário atualizado. A alteração de senha por esta tela não é suportada. Use o console do Firebase ou peça ao usuário para redefinir.", "info");
        } else {
            showFeedback(editUserFeedback, "Papel do usuário atualizado com sucesso!", "success");
        }

        loadAndRenderUsersForAdmin(); // Recarregar lista
        setTimeout(() => {
            closeEditUserModalBtn.click();
        }, 1500);

    } catch (error) {
        console.error("Error updating user role/password:", error);
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
    if (userFormFeedback) userFormFeedback.textContent = ''; userFormFeedback.style.display = 'none';

    if(driverNameInput && loggedInUserProfile) {
        driverNameInput.value = loggedInUserProfile.username; // Pre-fill driver name
    }
    // Adicionar um abastecimento em branco por padrão
    addFuelEntryToForm();
}

function initializeMyTripsView() {
    if (!loggedInUserProfile) return;

    if (myTripsDriverNameContainer) {
        myTripsDriverNameContainer.style.display = (loggedInUserProfile.role === 'admin') ? 'flex' : 'none';
    }
    if (myTripsFilterControls) myTripsFilterControls.style.display = 'block'; // Sempre mostrar filtros

    // Limpar filtros anteriores
    if (myTripsFilterStartDateInput) myTripsFilterStartDateInput.value = '';
    if (myTripsFilterEndDateInput) myTripsFilterEndDateInput.value = '';
    if (myTripsDriverNameInput) myTripsDriverNameInput.value = '';

    currentUserForMyTripsSearch = null; // Reset search state
    currentUidForMyTripsSearch = null;

    loadAndRenderMyTrips(); // Carrega viagens do usuário logado por padrão
}

function initializeAdminView() {
    if (!loggedInUserProfile || loggedInUserProfile.role !== 'admin') return;
    updateAdminSummary();
    populateAdminDriverSelect();
    if(adminDriverTripsSection) adminDriverTripsSection.style.display = 'none';
    if(adminGeneralFeedback) adminGeneralFeedback.textContent = ''; adminGeneralFeedback.style.display = 'none';
    if (adminSummaryFilterStartDateInput) adminSummaryFilterStartDateInput.value = '';
    if (adminSummaryFilterEndDateInput) adminSummaryFilterEndDateInput.value = '';
}

function initializeUserManagementView() {
     if (!loggedInUserProfile || loggedInUserProfile.role !== 'admin' || loggedInUserProfile.username.toLowerCase() !== 'fabio') return;
    // const addUserForm = document.getElementById('addUserByAdminFieldset'); // Esconder o form de adicionar user
    // if (addUserForm) addUserForm.style.display = 'none';
    loadAndRenderUsersForAdmin();
}


// --- EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded event fired.");
    // Verificação de inicialização do Firebase
    if (!app || !auth || !db) {
        console.error("CRITICAL DOMContentLoaded: Firebase not initialized correctly. App listeners not added.");
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
        return; // Impede a adição de outros listeners se o Firebase falhou
    }
    console.log("Firebase seems initialized, proceeding to add event listeners.");


    // Auth forms
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
        console.log("Event listener added for registerForm.");
    } else { console.error("registerForm not found!");}
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
        console.log("Event listener added for loginForm.");
    } else { console.error("loginForm not found!");}

    if (showRegisterViewLink) showRegisterViewLink.addEventListener('click', (e) => { e.preventDefault(); showView('registerView'); });
    if (showLoginViewLink) showLoginViewLink.addEventListener('click', (e) => { e.preventDefault(); showView('loginView'); });
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

    // Nav buttons
    if (userViewBtn) userViewBtn.addEventListener('click', () => { showView('userView'); initializeUserView(); });
    if (myTripsViewBtn) myTripsViewBtn.addEventListener('click', () => { showView('myTripsView'); initializeMyTripsView(); });
    if (adminViewBtn) adminViewBtn.addEventListener('click', () => { showView('adminView'); initializeAdminView(); });
    if (userManagementViewBtn) userManagementViewBtn.addEventListener('click', () => { showView('userManagementView'); initializeUserManagementView();});

    // Trip form
    if (tripForm) tripForm.addEventListener('submit', handleTripFormSubmit);
    if (addFuelEntryBtn) addFuelEntryBtn.addEventListener('click', () => addFuelEntryToForm());
    if (cancelEditBtn) cancelEditBtn.addEventListener('click', () => {
        editingTripId = null;
        tripIdToEditInput.value = '';
        tripForm.reset();
        fuelEntriesContainer.innerHTML = '';
        fuelEntryIdCounter = 0;
        submitTripBtn.textContent = 'Salvar Viagem';
        cancelEditBtn.style.display = 'none';
        if(driverNameInput && loggedInUserProfile) driverNameInput.value = loggedInUserProfile.username; // Pre-fill driver name
        addFuelEntryToForm(); // Add one blank fuel entry
        showFeedback(userFormFeedback, "Edição cancelada.", "info");
    });

    // My Trips View
    if (loadMyTripsBtn && myTripsDriverNameInput) {
        loadMyTripsBtn.addEventListener('click', async () => {
            const driverNameToSearch = myTripsDriverNameInput.value.trim();
            if (!driverNameToSearch) {
                showFeedback(myTripsFeedback, "Digite um nome de motorista para buscar.", "error");
                currentUserForMyTripsSearch = null;
                currentUidForMyTripsSearch = null;
                loadAndRenderMyTrips(myTripsFilterStartDateInput.value, myTripsFilterEndDateInput.value); // Carrega do logado
                return;
            }
            try {
                // Buscar UID pelo username (assumindo que usernames são únicos ou o primeiro encontrado é ok)
                const qUser = query(collection(db, "userProfiles"), where("username", "==", driverNameToSearch));
                const userSnapshot = await getDocs(qUser);
                if (!userSnapshot.empty) {
                    const foundUser = userSnapshot.docs[0].data() as UserProfile;
                    currentUserForMyTripsSearch = foundUser.username;
                    currentUidForMyTripsSearch = foundUser.uid;
                    loadAndRenderMyTrips(myTripsFilterStartDateInput.value, myTripsFilterEndDateInput.value);
                } else {
                    showFeedback(myTripsFeedback, `Motorista "${driverNameToSearch}" não encontrado.`, "error");
                    myTripsTableBody.innerHTML = '';
                    myTripsTablePlaceholder.textContent = `Nenhum motorista encontrado com o nome "${driverNameToSearch}".`;
                    myTripsTable.style.display = 'none';
                    myTripsTablePlaceholder.style.display = 'block';
                    updateDriverSummary([], driverNameToSearch); // Limpa o resumo
                }
            } catch(err) {
                console.error("Error searching driver by name:", err);
                showFeedback(myTripsFeedback, "Erro ao buscar motorista.", "error");
            }
        });
    }
    if (applyMyTripsFilterBtn) {
        applyMyTripsFilterBtn.addEventListener('click', () => {
            loadAndRenderMyTrips(myTripsFilterStartDateInput.value, myTripsFilterEndDateInput.value);
        });
    }


    // Admin View
    if (applyAdminSummaryFilterBtn) {
        applyAdminSummaryFilterBtn.addEventListener('click', () => {
            updateAdminSummary(adminSummaryFilterStartDateInput.value, adminSummaryFilterEndDateInput.value);
        });
    }
    if (adminLoadDriverTripsBtn && adminSelectDriver) {
        adminLoadDriverTripsBtn.addEventListener('click', () => {
            const selectedDriverUid = adminSelectDriver.value;
            const selectedDriverName = adminSelectDriver.options[adminSelectDriver.selectedIndex]?.text;
            if (selectedDriverUid && selectedDriverName) {
                loadAndRenderAdminDriverTrips(selectedDriverUid, selectedDriverName);
            } else {
                adminDriverTripsSection.style.display = 'none';
            }
        });
    }
    if(closeAdminTripDetailModalBtn) {
        closeAdminTripDetailModalBtn.addEventListener('click', () => adminTripDetailModal.style.display = 'none');
    }


    // User Management View (Admin Fabio)
    // Funcionalidade de adicionar usuário pelo admin foi removida para simplificar.
    // if (addUserByAdminForm) addUserByAdminForm.addEventListener('submit', handleAddUserByAdmin);
    if(editUserForm) editUserForm.addEventListener('submit', handleEditUserFormSubmit);
    if(closeEditUserModalBtn) {
        closeEditUserModalBtn.addEventListener('click', () => editUserModal.style.display = 'none');
    }

    // Esconder todos os modais inicialmente
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        (modal as HTMLElement).style.display = 'none';
        // Fechar modal ao clicar fora do conteúdo (opcional)
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                (modal as HTMLElement).style.display = 'none';
            }
        });
    });
    console.log("All DOMContentLoaded event listeners nominally set up.");
    // Estado inicial da aplicação é controlado pelo onAuthStateChanged.
    // O onAuthStateChanged é chamado automaticamente quando o auth é inicializado.
});

// Polyfill para setDoc com merge (caso não seja importado de 'firebase/firestore')
// A importação explícita de `firebaseSetDoc` de `firebase/firestore` no topo do arquivo é a abordagem correta.
// Esta função setDoc local não é mais necessária.
/*
async function setDoc(docRef: any, data: any, options?: { merge?: boolean }) {
    const firestore = getFirestore(); // Certifique-se que db (firestore instance) está disponível
    const colPath = docRef.parent.path;
    const docId = docRef.id;
    const fullPath = `${colPath}/${docId}`;

    if (options && options.merge) {
        return updateDoc(doc(firestore, fullPath), data); // updateDoc faz merge por padrão
    } else {
        // Para um set completo (sobrescrever), o SDK setDoc é o correto.
        // Se a importação direta de setDoc de 'firebase/firestore' não funcionar devido a
        // como o esm.sh lida com os exports, esta é uma forma de garantir.
        // No entanto, a importação direta de `setDoc` do SDK é preferível.
        // const { setDoc: firebaseSetDoc } = await import("firebase/firestore"); // Movido para o topo
        return firebaseSetDoc(docRef, data);
    }
}
*/
