
import { Chart, registerables, ChartConfiguration, ChartItem, ChartTypeRegistry, ChartDataset } from 'chart.js';
Chart.register(...registerables);

// --- INTERFACES ---
interface FuelEntry {
    id: string;
    // fuelType?: string; // Removido - não será mais coletado no formulário
    liters: number;
    valuePerLiter: number;
    discount: number;
    totalValue: number;
}

interface Trip {
    id: string;
    date: string;
    driverName: string;
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
    declaredValue?: number; // Agora preenchido manualmente
}

interface User {
    id: string;
    username: string;
    password: string; // Armazena o HASH da senha
    role: 'motorista' | 'admin';
}

interface MonthlyData {
    month: string; // YYYY-MM
    totalFreight: number;
    totalExpenses: number;
    netProfit: number; // For drivers, this stores total commission for the month
}

interface SummaryData {
    totalTrips: number;
    totalFreight: number;
    totalExpenses: number;
    totalNetProfit: number; // For drivers, this stores total commission
    monthlyChartData: MonthlyData[];
}


// --- STATE VARIABLES ---
let trips: Trip[] = [];
let fuelEntryIdCounter = 0;
let editingTripId: string | null = null;
let currentUserForMyTripsSearch: string | null = null;

let users: User[] = [];
let loggedInUser: User | null = null;
let editingUserIdForAdmin: string | null = null;
let adminSelectedDriverName: string | null = null;

let adminSummaryChart: Chart | null = null; // Keep for future potential use, though rendering is removed.


// --- STORAGE KEYS ---
const TRIPS_STORAGE_KEY = 'travelTrackerApp_trips_v6_manual_declared'; // Version bump for new structure
const USERS_STORAGE_KEY = 'travelTrackerApp_users_v1_hashed';
const LOGGED_IN_USER_SESSION_KEY = 'travelTrackerApp_loggedInUser_v1';

// --- DOM ELEMENTS ---
// Auth Views
const loginView = document.getElementById('loginView') as HTMLElement;
const registerView = document.getElementById('registerView') as HTMLElement;
const loginForm = document.getElementById('loginForm') as HTMLFormElement;
const registerForm = document.getElementById('registerForm') as HTMLFormElement;
const loginFeedback = document.getElementById('loginFeedback') as HTMLParagraphElement;
const registerFeedback = document.getElementById('registerFeedback') as HTMLParagraphElement;
const showRegisterViewLink = document.getElementById('showRegisterViewLink') as HTMLAnchorElement;
const showLoginViewLink = document.getElementById('showLoginViewLink') as HTMLAnchorElement;

// App Container & Main Navigation
const appContainer = document.getElementById('appContainer') as HTMLElement;
const logoutBtn = document.getElementById('logoutBtn') as HTMLButtonElement;
const userViewBtn = document.getElementById('userViewBtn') as HTMLButtonElement;
const myTripsViewBtn = document.getElementById('myTripsViewBtn') as HTMLButtonElement;
const adminViewBtn = document.getElementById('adminViewBtn') as HTMLButtonElement;
const userManagementViewBtn = document.getElementById('userManagementViewBtn') as HTMLButtonElement;

// Main Views
const userView = document.getElementById('userView') as HTMLElement;
const myTripsView = document.getElementById('myTripsView') as HTMLElement;
const adminView = document.getElementById('adminView') as HTMLElement;
const userManagementView = document.getElementById('userManagementView') as HTMLElement;

// Trip Form Elements
const tripForm = document.getElementById('tripForm') as HTMLFormElement;
const tripDriverNameInput = document.getElementById('driverName') as HTMLInputElement;
const tripIdToEditInput = document.getElementById('tripIdToEdit') as HTMLInputElement;
const submitTripBtn = document.getElementById('submitTripBtn') as HTMLButtonElement;
const cancelEditBtn = document.getElementById('cancelEditBtn') as HTMLButtonElement;
const userFormFeedback = document.getElementById('userFormFeedback') as HTMLParagraphElement;
const fuelEntriesContainer = document.getElementById('fuelEntriesContainer') as HTMLDivElement;
const addFuelEntryBtn = document.getElementById('addFuelEntryBtn') as HTMLButtonElement;
const declaredValueInput = document.getElementById('declaredValue') as HTMLInputElement; // Editable
const freightValueInput = document.getElementById('freightValue') as HTMLInputElement;
const arla32CostInput = document.getElementById('arla32Cost') as HTMLInputElement;
const tollCostInput = document.getElementById('tollCost') as HTMLInputElement;
const commissionCostInput = document.getElementById('commissionCost') as HTMLInputElement;
const otherExpensesInput = document.getElementById('otherExpenses') as HTMLInputElement;


// My Trips View Elements
const myTripsDriverNameContainer = document.getElementById('myTripsDriverNameContainer') as HTMLElement;
const myTripsDriverNameInput = document.getElementById('myTripsDriverNameInput') as HTMLInputElement;
const loadMyTripsBtn = document.getElementById('loadMyTripsBtn') as HTMLButtonElement;
const myTripsFilterControls = document.getElementById('myTripsFilterControls') as HTMLElement;
const myTripsFilterStartDate = document.getElementById('myTripsFilterStartDate') as HTMLInputElement;
const myTripsFilterEndDate = document.getElementById('myTripsFilterEndDate') as HTMLInputElement;
const applyMyTripsFilterBtn = document.getElementById('applyMyTripsFilterBtn') as HTMLButtonElement;
const myTripsFeedback = document.getElementById('myTripsFeedback') as HTMLParagraphElement;
const myTripsTableBody = document.getElementById('myTripsTableBody') as HTMLTableSectionElement;
const myTripsTable = document.getElementById('myTripsTable') as HTMLTableElement;
const myTripsTablePlaceholder = document.getElementById('myTripsTablePlaceholder') as HTMLParagraphElement;
const driverSummaryContainer = document.getElementById('driverSummaryContainer') as HTMLElement;
const driverTotalTripsEl = document.getElementById('driverTotalTripsEl') as HTMLParagraphElement;
const driverTotalFreightParticipatedEl = document.getElementById('driverTotalFreightParticipatedEl') as HTMLParagraphElement;
const driverTotalEarningsEl = document.getElementById('driverTotalEarningsEl') as HTMLParagraphElement;


// Admin View Elements
const adminSelectDriver = document.getElementById('adminSelectDriver') as HTMLSelectElement;
const adminLoadDriverTripsBtn = document.getElementById('adminLoadDriverTripsBtn') as HTMLButtonElement;
const adminDriverTripsSection = document.getElementById('adminDriverTripsSection') as HTMLElement;
const adminSelectedDriverNameDisplay = document.getElementById('adminSelectedDriverNameDisplay') as HTMLElement;
const adminDriverTripsTable = document.getElementById('adminDriverTripsTable') as HTMLTableElement;
const adminDriverTripsTableBody = document.getElementById('adminDriverTripsTableBody') as HTMLTableSectionElement;
const adminDriverTripsPlaceholder = document.getElementById('adminDriverTripsPlaceholder') as HTMLParagraphElement;
const adminTripDetailModal = document.getElementById('adminTripDetailModal') as HTMLElement;
const adminTripDetailContent = document.getElementById('adminTripDetailContent') as HTMLElement;
const closeAdminTripDetailModalBtn = document.getElementById('closeAdminTripDetailModalBtn') as HTMLElement;
const adminGeneralFeedback = document.getElementById('adminGeneralFeedback') as HTMLParagraphElement;
const adminSummaryContainer = document.getElementById('adminSummaryContainer') as HTMLElement;
const adminSummaryFilterStartDate = document.getElementById('adminSummaryFilterStartDate') as HTMLInputElement;
const adminSummaryFilterEndDate = document.getElementById('adminSummaryFilterEndDate') as HTMLInputElement;
const applyAdminSummaryFilterBtn = document.getElementById('applyAdminSummaryFilterBtn') as HTMLButtonElement;
const adminTotalTripsEl = document.getElementById('adminTotalTripsEl') as HTMLParagraphElement;
const adminTotalFreightEl = document.getElementById('adminTotalFreightEl') as HTMLParagraphElement;
const adminTotalExpensesEl = document.getElementById('adminTotalExpensesEl') as HTMLParagraphElement;
const adminTotalNetProfitEl = document.getElementById('adminTotalNetProfitEl') as HTMLParagraphElement;
// const adminSummaryChartCanvas = document.getElementById('adminSummaryChartCanvas') as HTMLCanvasElement; // Chart canvas removed from HTML


// User Management View Elements
const userManagementFeedback = document.getElementById('userManagementFeedback') as HTMLParagraphElement;
const userManagementTableBody = document.getElementById('userManagementTableBody') as HTMLTableSectionElement;
const editUserModal = document.getElementById('editUserModal') as HTMLElement;
const closeEditUserModalBtn = document.getElementById('closeEditUserModalBtn') as HTMLElement;
const editUserForm = document.getElementById('editUserForm') as HTMLFormElement;
const editUserIdInput = document.getElementById('editUserId') as HTMLInputElement;
const editUsernameDisplay = document.getElementById('editUsernameDisplay') as HTMLInputElement;
const editUserRoleSelect = document.getElementById('editUserRole') as HTMLSelectElement;
const editUserNewPasswordInput = document.getElementById('editUserNewPassword') as HTMLInputElement;
const editUserConfirmNewPasswordInput = document.getElementById('editUserConfirmNewPassword') as HTMLInputElement;
const editUserFeedback = document.getElementById('editUserFeedback') as HTMLParagraphElement;
const addUserByAdminForm = document.getElementById('addUserByAdminForm') as HTMLFormElement;
const addUserFeedback = document.getElementById('addUserFeedback') as HTMLParagraphElement;


// --- UTILITY FUNCTIONS ---
const formatDate = (dateString: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString + 'T00:00:00'); // Ensure date is parsed as local
    return date.toLocaleDateString('pt-BR');
};

const formatMonthYear = (dateString: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString + 'T00:00:00'); // Ensure date is parsed as local
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
};

const formatCurrency = (amount: number | undefined): string => {
    if (amount === undefined || isNaN(amount)) return 'N/A';
    return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const parseFloatInput = (value: string | null | undefined, defaultValue: number = 0): number => {
    if (value === null || value === undefined || value.trim() === '') return defaultValue;
    const cleanedValue = value.replace(',', '.');
    const parsed = parseFloat(cleanedValue);
    return isNaN(parsed) ? defaultValue : parsed;
};

function showFeedback(element: HTMLElement, message: string, type: 'success' | 'error' | 'info'): void {
    element.textContent = message;
    element.className = 'feedback-message';
    if (type === 'success') element.classList.add('success');
    else if (type === 'error') element.classList.add('error');
    else element.classList.add('info');
    element.style.display = 'block';

    setTimeout(() => {
        if(element) {
            element.style.display = 'none';
            element.textContent = '';
        }
    }, 5000);
}

async function hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

// --- AUTHENTICATION & USER MANAGEMENT ---
function loadUsersFromStorage(): void {
    const storedUsers = localStorage.getItem(USERS_STORAGE_KEY);
    if (storedUsers) {
        try {
            users = JSON.parse(storedUsers);
        } catch (error) {
            console.error("Erro ao carregar usuários do localStorage:", error);
            users = [];
        }
    } else {
        users = [];
    }
}

function saveUsersToStorage(): void {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
}

async function ensureMasterAdminExists(): Promise<void> {
    const fabioExists = users.some(user => user.username.toLowerCase() === 'fabio');
    if (!fabioExists) {
        const hashedPassword = await hashPassword('!admin');
        users.push({
            id: Date.now().toString(),
            username: 'Fabio',
            password: hashedPassword,
            role: 'admin'
        });
        saveUsersToStorage();
    }
}

async function handleRegister(event: Event): Promise<void> {
    event.preventDefault();
    const username = (registerForm.elements.namedItem('registerUsername') as HTMLInputElement).value.trim();
    const password = (registerForm.elements.namedItem('registerPassword') as HTMLInputElement).value;
    const confirmPassword = (registerForm.elements.namedItem('registerConfirmPassword') as HTMLInputElement).value;
    const role: 'motorista' | 'admin' = 'motorista';

    if (!username || !password || !confirmPassword) {
        showFeedback(registerFeedback, 'Por favor, preencha todos os campos.', 'error');
        return;
    }
    if (password !== confirmPassword) {
        showFeedback(registerFeedback, 'As senhas não coincidem.', 'error');
        return;
    }
    if (users.find(user => user.username.toLowerCase() === username.toLowerCase())) {
        showFeedback(registerFeedback, 'Este nome de usuário já existe.', 'error');
        return;
    }

    const hashedPassword = await hashPassword(password);
    const newUser: User = { id: Date.now().toString(), username, password: hashedPassword, role };
    users.push(newUser);
    saveUsersToStorage();
    showFeedback(registerFeedback, 'Cadastro realizado com sucesso! Faça o login.', 'success');
    registerForm.reset();
    setTimeout(() => updateUIAfterAuthChange('login'), 1000) ;
}

async function handleLogin(event: Event): Promise<void> {
    event.preventDefault();
    const username = (loginForm.elements.namedItem('loginUsername') as HTMLInputElement).value.trim();
    const password = (loginForm.elements.namedItem('loginPassword') as HTMLInputElement).value;

    const hashedPassword = await hashPassword(password);
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === hashedPassword);

    if (user) {
        loggedInUser = user;
        sessionStorage.setItem(LOGGED_IN_USER_SESSION_KEY, user.id);
        showFeedback(loginFeedback, `Bem-vindo, ${user.username}!`, 'success');
        loginForm.reset();
        updateUIAfterAuthChange('app');
    } else {
        showFeedback(loginFeedback, 'Nome de usuário ou senha inválidos.', 'error');
        loggedInUser = null;
        sessionStorage.removeItem(LOGGED_IN_USER_SESSION_KEY);
    }
}

function handleLogout(): void {
    loggedInUser = null;
    adminSelectedDriverName = null;
    currentUserForMyTripsSearch = null;
    sessionStorage.removeItem(LOGGED_IN_USER_SESSION_KEY);
    updateUIAfterAuthChange('login');
    if (adminSummaryChart) {
        adminSummaryChart.destroy();
        adminSummaryChart = null;
    }
}

function checkSession(): void {
    const loggedInUserId = sessionStorage.getItem(LOGGED_IN_USER_SESSION_KEY);
    if (loggedInUserId) {
        const user = users.find(u => u.id === loggedInUserId);
        if (user) {
            loggedInUser = user;
            updateUIAfterAuthChange('app');
            return;
        }
    }
    updateUIAfterAuthChange('login');
}

function updateUIAfterAuthChange(targetView: 'login' | 'register' | 'app'): void {
    loginView.style.display = 'none';
    registerView.style.display = 'none';
    appContainer.style.display = 'none';

    userView.classList.remove('active-view');
    myTripsView.classList.remove('active-view');
    adminView.classList.remove('active-view');
    userManagementView.classList.remove('active-view');

    [userViewBtn, myTripsViewBtn, adminViewBtn, userManagementViewBtn].forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
    });

    if (targetView === 'login') {
        loginView.style.display = 'flex';
    } else if (targetView === 'register') {
        registerView.style.display = 'flex';
    } else if (targetView === 'app' && loggedInUser) {
        appContainer.style.display = 'flex';
        logoutBtn.style.display = 'inline-block';

        userViewBtn.style.display = loggedInUser.role === 'motorista' ? 'inline-block' : 'none';
        myTripsViewBtn.style.display = loggedInUser.role === 'motorista' ? 'inline-block' : 'none';
        adminViewBtn.style.display = loggedInUser.role === 'admin' ? 'inline-block' : 'none';
        userManagementViewBtn.style.display = (loggedInUser.role === 'admin' && loggedInUser.username.toLowerCase() === 'fabio') ? 'inline-block' : 'none';

        if (loggedInUser.role === 'motorista') {
            tripDriverNameInput.value = loggedInUser.username;
            tripDriverNameInput.disabled = true;
            myTripsDriverNameContainer.style.display = 'none';
            currentUserForMyTripsSearch = loggedInUser.username;
            showView('myTrips');
        } else if (loggedInUser.role === 'admin') {
            tripDriverNameInput.disabled = false;
            tripDriverNameInput.value = '';
            myTripsDriverNameContainer.style.display = 'block';
            currentUserForMyTripsSearch = null;
            populateAdminDriverSelect();
            showView('admin');
        }
    } else {
        loginView.style.display = 'flex';
    }
}

async function handleAddUserByAdmin(event: Event): Promise<void> {
    event.preventDefault();
    if (!loggedInUser || loggedInUser.username.toLowerCase() !== 'fabio') return;

    const usernameInput = addUserByAdminForm.elements.namedItem('addAdminUsername') as HTMLInputElement;
    const passwordInput = addUserByAdminForm.elements.namedItem('addAdminPassword') as HTMLInputElement;
    const confirmPasswordInput = addUserByAdminForm.elements.namedItem('addAdminConfirmPassword') as HTMLInputElement;
    const roleSelect = addUserByAdminForm.elements.namedItem('addAdminRole') as HTMLSelectElement;

    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    const role = roleSelect.value as 'motorista' | 'admin';

    if (!username || !password || !confirmPassword) {
        showFeedback(addUserFeedback, 'Por favor, preencha todos os campos.', 'error');
        return;
    }
    if (password !== confirmPassword) {
        showFeedback(addUserFeedback, 'As senhas não coincidem.', 'error');
        return;
    }
    if (users.find(user => user.username.toLowerCase() === username.toLowerCase())) {
        showFeedback(addUserFeedback, 'Este nome de usuário já existe.', 'error');
        return;
    }

    const hashedPassword = await hashPassword(password);
    const newUser: User = { id: Date.now().toString(), username, password: hashedPassword, role };
    users.push(newUser);
    saveUsersToStorage();
    showFeedback(addUserFeedback, `Usuário '${username}' adicionado com sucesso como ${role}.`, 'success');
    addUserByAdminForm.reset();
    renderUserManagementTable();
    if (loggedInUser && loggedInUser.role === 'admin') {
        populateAdminDriverSelect();
    }
}


// --- TRIP DATA FUNCTIONS ---
function calculateTripDerivedFields(trip: Trip): Trip {
    trip.kmDriven = (trip.kmFinal || 0) - (trip.kmInitial || 0);
    if (trip.kmDriven < 0) trip.kmDriven = 0;

    trip.totalFuelCost = 0;
    if (trip.fuelEntries) {
        trip.fuelEntries.forEach(entry => {
            if (isNaN(entry.totalValue) || entry.totalValue < 0) entry.totalValue = 0;
            trip.totalFuelCost! += entry.totalValue;
        });
    }
    if (isNaN(trip.totalFuelCost!)) trip.totalFuelCost = 0;

    trip.totalExpenses = (trip.totalFuelCost || 0) +
                         (trip.arla32Cost || 0) +
                         (trip.tollCost || 0) +
                         (trip.commissionCost || 0) +
                         (trip.otherExpenses || 0);
    trip.netProfit = (trip.freightValue || 0) - trip.totalExpenses;
    return trip;
}

function loadTripsFromStorage(): void {
    const storedTrips = localStorage.getItem(TRIPS_STORAGE_KEY);
    if (storedTrips) {
        try {
            trips = JSON.parse(storedTrips).map((trip: Trip) => calculateTripDerivedFields(trip));
        } catch (error) {
            console.error("Erro ao carregar viagens do localStorage:", error);
            trips = [];
        }
    } else {
        trips = [];
    }
}

function saveTripsToStorage(): void {
    localStorage.setItem(TRIPS_STORAGE_KEY, JSON.stringify(trips));
}

// --- SUMMARY AND CHART FUNCTIONS ---
function calculateSummaryData(filteredTrips: Trip[], context: 'admin' | 'driver'): SummaryData {
    let totalFreight = 0;
    let totalExpensesAgg = 0;
    let totalDriverEarningsOrNetProfit = 0;

    const monthlyAggregates: { [key: string]: { month: string, freight: number; expenses: number; earningsOrNetProfit: number } } = {};

    filteredTrips.forEach(trip => {
        totalFreight += trip.freightValue;

        const monthYearKey = formatMonthYear(trip.date);
        if (!monthlyAggregates[monthYearKey]) {
            monthlyAggregates[monthYearKey] = { month: monthYearKey, freight: 0, expenses: 0, earningsOrNetProfit: 0 };
        }
        monthlyAggregates[monthYearKey].freight += trip.freightValue;

        if (context === 'admin') {
            totalExpensesAgg += trip.totalExpenses;
            totalDriverEarningsOrNetProfit += trip.netProfit;
            monthlyAggregates[monthYearKey].expenses += trip.totalExpenses;
            monthlyAggregates[monthYearKey].earningsOrNetProfit += trip.netProfit;
        } else { // context === 'driver'
            const commissionVal = trip.commissionCost || 0;
            totalDriverEarningsOrNetProfit += commissionVal;
            monthlyAggregates[monthYearKey].earningsOrNetProfit += commissionVal;
        }
    });

    const monthlyChartDataResult: MonthlyData[] = Object.values(monthlyAggregates).map(agg => ({
        month: agg.month,
        totalFreight: agg.freight,
        totalExpenses: context === 'admin' ? agg.expenses : 0,
        netProfit: agg.earningsOrNetProfit
    })).sort((a, b) => a.month.localeCompare(b.month));

    return {
        totalTrips: filteredTrips.length,
        totalFreight: totalFreight,
        totalExpenses: context === 'admin' ? totalExpensesAgg : 0,
        totalNetProfit: totalDriverEarningsOrNetProfit,
        monthlyChartData: monthlyChartDataResult
    };
}

function renderAdminOverallSummary(startDate?: string, endDate?: string): void {
    let filteredAdminTrips = trips;
    if (startDate && endDate) {
        filteredAdminTrips = trips.filter(trip => trip.date >= startDate! && trip.date <= endDate!);
    } else if (startDate) {
        filteredAdminTrips = trips.filter(trip => trip.date >= startDate!);
    } else if (endDate) {
        filteredAdminTrips = trips.filter(trip => trip.date <= endDate!);
    }

    const summary = calculateSummaryData(filteredAdminTrips, 'admin');

    adminTotalTripsEl.textContent = summary.totalTrips.toString();
    adminTotalFreightEl.textContent = formatCurrency(summary.totalFreight);
    adminTotalExpensesEl.textContent = formatCurrency(summary.totalExpenses);
    adminTotalNetProfitEl.textContent = formatCurrency(summary.totalNetProfit);
    adminTotalNetProfitEl.className = summary.totalNetProfit >= 0 ? 'profit' : 'loss';

    // Admin chart rendering logic has been removed.
}

function renderDriverSummary(driverNameToSummarize: string, startDate?: string, endDate?: string): void {
    let driverSpecificTrips = trips.filter(trip => trip.driverName.toLowerCase() === driverNameToSummarize.toLowerCase());

    if (startDate && endDate) {
        driverSpecificTrips = driverSpecificTrips.filter(trip => trip.date >= startDate! && trip.date <= endDate!);
    } else if (startDate) {
        driverSpecificTrips = driverSpecificTrips.filter(trip => trip.date >= startDate!);
    } else if (endDate) {
        driverSpecificTrips = driverSpecificTrips.filter(trip => trip.date <= endDate!);
    }

    const summary = calculateSummaryData(driverSpecificTrips, 'driver');

    driverTotalTripsEl.textContent = summary.totalTrips.toString();
    driverTotalFreightParticipatedEl.textContent = formatCurrency(summary.totalFreight);
    driverTotalEarningsEl.textContent = formatCurrency(summary.totalNetProfit); // Correctly reflects total commissions for the driver

    // Chart rendering logic removed for driver summary
    driverSummaryContainer.style.display = 'block';
}


// --- VIEW RENDERING FUNCTIONS ---
function showView(viewId: 'user' | 'myTrips' | 'admin' | 'userManagement', isEditingTrip: boolean = false): void {
    const views = [userView, myTripsView, adminView, userManagementView];
    const buttons = [userViewBtn, myTripsViewBtn, adminViewBtn, userManagementViewBtn];

    views.forEach(view => view.classList.remove('active-view'));
    buttons.forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
    });

    switch (viewId) {
        case 'user':
            userView.classList.add('active-view');
            userViewBtn.classList.add('active');
            userViewBtn.setAttribute('aria-pressed', 'true');
            if (!isEditingTrip) {
                resetTripForm();
                 if (loggedInUser && loggedInUser.role === 'motorista') {
                    tripDriverNameInput.value = loggedInUser.username;
                    tripDriverNameInput.disabled = true;
                } else {
                    tripDriverNameInput.value = '';
                    tripDriverNameInput.disabled = false;
                }
            }
            break;
        case 'myTrips':
            myTripsView.classList.add('active-view');
            myTripsViewBtn.classList.add('active');
            myTripsViewBtn.setAttribute('aria-pressed', 'true');
            myTripsFilterControls.style.display = 'block';

            if (loggedInUser && loggedInUser.role === 'motorista') {
                currentUserForMyTripsSearch = loggedInUser.username;
                myTripsDriverNameContainer.style.display = 'none';
                renderMyTripsTable(currentUserForMyTripsSearch, myTripsFilterStartDate.value, myTripsFilterEndDate.value);
                renderDriverSummary(currentUserForMyTripsSearch, myTripsFilterStartDate.value, myTripsFilterEndDate.value);
            } else if (loggedInUser && loggedInUser.role === 'admin') {
                myTripsDriverNameContainer.style.display = 'block';
                if (currentUserForMyTripsSearch) {
                    myTripsDriverNameInput.value = currentUserForMyTripsSearch;
                    renderMyTripsTable(currentUserForMyTripsSearch, myTripsFilterStartDate.value, myTripsFilterEndDate.value);
                    driverSummaryContainer.style.display = 'none'; // Admin viewing specific driver doesn't see generic driver summary
                } else {
                    myTripsTableBody.innerHTML = '';
                    myTripsTable.style.display = 'none';
                    myTripsTablePlaceholder.textContent = 'Administradores: Busque por um nome de motorista para ver as viagens.';
                    myTripsTablePlaceholder.style.display = 'block';
                    driverSummaryContainer.style.display = 'none';
                }
            }
            break;
        case 'admin':
            adminView.classList.add('active-view');
            adminViewBtn.classList.add('active');
            adminViewBtn.setAttribute('aria-pressed', 'true');
            populateAdminDriverSelect();
            renderAdminOverallSummary(adminSummaryFilterStartDate.value, adminSummaryFilterEndDate.value);
            if (adminSelectedDriverName) {
                adminSelectDriver.value = adminSelectedDriverName;
                renderAdminDriverTripsTable(adminSelectedDriverName);
            } else {
                adminDriverTripsSection.style.display = 'none';
            }
            break;
        case 'userManagement':
            userManagementView.classList.add('active-view');
            userManagementViewBtn.classList.add('active');
            userManagementViewBtn.setAttribute('aria-pressed', 'true');
            renderUserManagementTable();
            break;
    }
}


// --- TRIP FORM & FUEL ENTRIES ---
function addFuelEntryToFormUI(entry?: FuelEntry, isEditing: boolean = false): void {
    const entryId = isEditing && entry ? entry.id : `fuel_${fuelEntryIdCounter++}`;
    const newFuelEntryDiv = document.createElement('div');
    newFuelEntryDiv.classList.add('fuel-entry-item');
    newFuelEntryDiv.setAttribute('data-fuel-entry-id', entryId);

    newFuelEntryDiv.innerHTML = `
        <div class="form-group">
            <label for="fuelLiters_${entryId}">Litros:</label>
            <input type="number" id="fuelLiters_${entryId}" name="fuelLiters" min="0" step="any" value="${entry?.liters || ''}" placeholder="0" required>
        </div>
        <div class="form-group">
            <label for="fuelValuePerLiter_${entryId}">Valor/Litro (R$):</label>
            <input type="number" id="fuelValuePerLiter_${entryId}" name="fuelValuePerLiter" min="0" step="0.01" value="${entry?.valuePerLiter || ''}" placeholder="0,00" required>
        </div>
        <div class="form-group">
            <label for="fuelDiscount_${entryId}">Desconto (R$):</label>
            <input type="number" id="fuelDiscount_${entryId}" name="fuelDiscount" min="0" step="0.01" value="${entry?.discount || 0}" placeholder="0,00">
        </div>
        <div class="form-group">
            <label for="fuelTotalValue_${entryId}">Total Abast. (R$):</label>
            <input type="text" id="fuelTotalValue_${entryId}" name="fuelTotalValue" class="fuel-total-value-display" value="${formatCurrency(entry?.totalValue || 0)}" readonly>
        </div>
        <button type="button" class="control-btn danger-btn small-btn remove-fuel-entry-btn">Remover</button>
    `;
    fuelEntriesContainer.appendChild(newFuelEntryDiv);

    const removeBtn = newFuelEntryDiv.querySelector('.remove-fuel-entry-btn') as HTMLButtonElement;
    removeBtn.addEventListener('click', () => removeFuelEntryFromFormUI(entryId));

    const litersInput = newFuelEntryDiv.querySelector(`input[name="fuelLiters"]`) as HTMLInputElement;
    const valuePerLiterInput = newFuelEntryDiv.querySelector(`input[name="fuelValuePerLiter"]`) as HTMLInputElement;
    const discountInput = newFuelEntryDiv.querySelector(`input[name="fuelDiscount"]`) as HTMLInputElement;

    [litersInput, valuePerLiterInput, discountInput].forEach(input => {
        input.addEventListener('input', () => {
            updateFuelEntryRowCalculation(newFuelEntryDiv);
        });
    });
     if (isEditing && entry) {
        updateFuelEntryRowCalculation(newFuelEntryDiv);
    }
}

function removeFuelEntryFromFormUI(entryId: string): void {
    const entryDiv = fuelEntriesContainer.querySelector(`[data-fuel-entry-id="${entryId}"]`);
    if (entryDiv) {
        fuelEntriesContainer.removeChild(entryDiv);
    }
}

function updateFuelEntryRowCalculation(entryDiv: HTMLDivElement): void {
    const liters = parseFloatInput((entryDiv.querySelector('input[name="fuelLiters"]') as HTMLInputElement).value);
    const valuePerLiter = parseFloatInput((entryDiv.querySelector('input[name="fuelValuePerLiter"]') as HTMLInputElement).value);
    const discount = parseFloatInput((entryDiv.querySelector('input[name="fuelDiscount"]') as HTMLInputElement).value);
    const totalDisplay = entryDiv.querySelector('.fuel-total-value-display') as HTMLInputElement;

    const totalValue = (liters * valuePerLiter) - discount;
    totalDisplay.value = formatCurrency(totalValue >= 0 ? totalValue : 0);
}

function resetTripForm(): void {
    tripForm.reset();
    editingTripId = null;
    tripIdToEditInput.value = '';
    fuelEntriesContainer.innerHTML = '';
    fuelEntryIdCounter = 0;
    addFuelEntryToFormUI();
    submitTripBtn.textContent = 'Salvar Viagem';
    cancelEditBtn.style.display = 'none';
    userFormFeedback.style.display = 'none';
    userFormFeedback.textContent = '';
    declaredValueInput.value = '';
}

function populateFormForEditing(tripId: string): void {
    const tripToEdit = trips.find(trip => trip.id === tripId);
    if (!tripToEdit) {
        showFeedback(userFormFeedback, 'Erro: Viagem não encontrada para edição.', 'error');
        return;
    }

    editingTripId = tripId;
    tripIdToEditInput.value = tripId;


    (document.getElementById('tripDate') as HTMLInputElement).value = tripToEdit.date;
    tripDriverNameInput.value = tripToEdit.driverName;

    if (loggedInUser && loggedInUser.role === 'motorista') {
        tripDriverNameInput.disabled = true;
    } else {
        tripDriverNameInput.disabled = false;
    }

    (document.getElementById('cargoType') as HTMLInputElement).value = tripToEdit.cargoType || '';
    (document.getElementById('kmInitial') as HTMLInputElement).value = tripToEdit.kmInitial?.toString() || '';
    (document.getElementById('kmFinal') as HTMLInputElement).value = tripToEdit.kmFinal?.toString() || '';
    (document.getElementById('weight') as HTMLInputElement).value = tripToEdit.weight?.toString() || '';
    (document.getElementById('unitValue') as HTMLInputElement).value = tripToEdit.unitValue?.toString() || '';
    freightValueInput.value = tripToEdit.freightValue.toString();
    declaredValueInput.value = tripToEdit.declaredValue?.toString() || '';

    arla32CostInput.value = tripToEdit.arla32Cost?.toString() || '';
    tollCostInput.value = tripToEdit.tollCost.toString();
    commissionCostInput.value = tripToEdit.commissionCost?.toString() || '';
    otherExpensesInput.value = tripToEdit.otherExpenses.toString();
    (document.getElementById('expenseDescription') as HTMLInputElement).value = tripToEdit.expenseDescription || '';

    fuelEntriesContainer.innerHTML = '';
    fuelEntryIdCounter = 0; 

    if (tripToEdit.fuelEntries && tripToEdit.fuelEntries.length > 0) {
        tripToEdit.fuelEntries.forEach(entry => addFuelEntryToFormUI(entry, true));
    } else {
        addFuelEntryToFormUI(undefined, false); 
    }

    submitTripBtn.textContent = 'Atualizar Viagem';
    cancelEditBtn.style.display = 'inline-block';
    showView('user', true); 
}

function handleTripSubmit(event: Event): void {
    event.preventDefault();
    const formData = new FormData(tripForm);

    const fuelEntries: FuelEntry[] = [];
    const fuelEntryItems = fuelEntriesContainer.querySelectorAll('.fuel-entry-item');
    fuelEntryItems.forEach(item => {
        const id = item.getAttribute('data-fuel-entry-id')!;
        const liters = parseFloatInput((item.querySelector('input[name="fuelLiters"]') as HTMLInputElement).value);
        const valuePerLiter = parseFloatInput((item.querySelector('input[name="fuelValuePerLiter"]') as HTMLInputElement).value);
        const discount = parseFloatInput((item.querySelector('input[name="fuelDiscount"]') as HTMLInputElement).value);

        if (liters > 0 && valuePerLiter >= 0) { 
            const totalValue = (liters * valuePerLiter) - discount;
            fuelEntries.push({
                id,
                liters,
                valuePerLiter,
                discount,
                totalValue: totalValue >= 0 ? totalValue : 0
            });
        }
    });

    let driverNameValue: string;
    if (loggedInUser && loggedInUser.role === 'motorista') {
        driverNameValue = loggedInUser.username;
    } else {
        driverNameValue = tripDriverNameInput.value.trim();
    }


    let tripData: Trip = {
        id: editingTripId || Date.now().toString(),
        date: formData.get('tripDate') as string,
        driverName: driverNameValue,
        cargoType: (formData.get('cargoType') as string | null)?.trim() || undefined,
        kmInitial: parseFloatInput(formData.get('kmInitial') as string | null),
        kmFinal: parseFloatInput(formData.get('kmFinal') as string | null),
        weight: parseFloatInput(formData.get('weight') as string | null),
        unitValue: parseFloatInput(formData.get('unitValue') as string | null),
        freightValue: parseFloatInput(formData.get('freightValue') as string | null, 0),
        declaredValue: parseFloatInput(declaredValueInput.value),
        fuelEntries: fuelEntries,
        arla32Cost: parseFloatInput(formData.get('arla32Cost') as string | null),
        tollCost: parseFloatInput(formData.get('tollCost') as string | null, 0),
        commissionCost: parseFloatInput(formData.get('commissionCost') as string | null),
        otherExpenses: parseFloatInput(formData.get('otherExpenses') as string | null, 0),
        expenseDescription: (formData.get('expenseDescription') as string | null)?.trim() || undefined,
        totalExpenses: 0,
        netProfit: 0,
    };

    if (!tripData.date || !tripData.driverName || tripData.freightValue === undefined) {
        showFeedback(userFormFeedback, 'Por favor, preencha Data, Motorista e Valor do Frete.', 'error');
        return;
    }

    tripData = calculateTripDerivedFields(tripData);

    const wasEditing = !!editingTripId;

    if (editingTripId) {
        const index = trips.findIndex(trip => trip.id === editingTripId);
        if (index !== -1) {
            trips[index] = tripData;
            showFeedback(userFormFeedback, 'Viagem atualizada com sucesso!', 'success');
        } else {
            showFeedback(userFormFeedback, 'Erro: Viagem para edição não encontrada ao salvar.', 'error');
            trips.push(tripData); 
        }
    } else {
        trips.push(tripData);
        showFeedback(userFormFeedback, 'Viagem registrada com sucesso!', 'success');
    }

    saveTripsToStorage();

    const driverNameOfAffectedTrip = tripData.driverName;
    resetTripForm(); 


    if (loggedInUser && loggedInUser.role === 'motorista') {
        tripDriverNameInput.value = loggedInUser.username;
        tripDriverNameInput.disabled = true;
    }


    if (loggedInUser) {
        if (loggedInUser.role === 'admin') {
            renderAdminOverallSummary(adminSummaryFilterStartDate.value, adminSummaryFilterEndDate.value);
            if (adminSelectedDriverName && adminSelectedDriverName.toLowerCase() === driverNameOfAffectedTrip.toLowerCase()) {
                renderAdminDriverTripsTable(adminSelectedDriverName);
            }
            if (adminView.classList.contains('active-view')) {
                 populateAdminDriverSelect(); 
             }
            
            if (myTripsView.classList.contains('active-view') && currentUserForMyTripsSearch && currentUserForMyTripsSearch.toLowerCase() === driverNameOfAffectedTrip.toLowerCase()){
                renderMyTripsTable(currentUserForMyTripsSearch, myTripsFilterStartDate.value, myTripsFilterEndDate.value);
            }

        } else if (loggedInUser.role === 'motorista' && loggedInUser.username.toLowerCase() === driverNameOfAffectedTrip.toLowerCase()) {
            renderMyTripsTable(loggedInUser.username, myTripsFilterStartDate.value, myTripsFilterEndDate.value);
            renderDriverSummary(loggedInUser.username, myTripsFilterStartDate.value, myTripsFilterEndDate.value);
        }
    }
}

function editTrip(tripId: string): void {
    populateFormForEditing(tripId);
}

function deleteTrip(tripId: string, associatedDriverName: string): void {
    if (!loggedInUser) return; 

    const isOwnTripForDriver = loggedInUser.role === 'motorista' &&
                               associatedDriverName.toLowerCase() === loggedInUser.username.toLowerCase();
    const isFabioAdmin = loggedInUser.role === 'admin' &&
                         loggedInUser.username.toLowerCase() === 'fabio';

    if (!(isOwnTripForDriver || isFabioAdmin)) {
        showFeedback(userFormFeedback, 'Você não tem permissão para excluir esta viagem.', 'error');
        if (myTripsView.classList.contains('active-view')) {
             showFeedback(myTripsFeedback, 'Você não tem permissão para excluir esta viagem.', 'error');
        }
        return;
    }


    if (confirm('Tem certeza que deseja excluir esta viagem?')) {
        trips = trips.filter(trip => trip.id !== tripId);
        saveTripsToStorage();


        let feedbackElement = userFormFeedback; 
        if (myTripsView.classList.contains('active-view')) {
            feedbackElement = myTripsFeedback;
        } else if (adminView.classList.contains('active-view')) {
            feedbackElement = adminGeneralFeedback;
        }
        showFeedback(feedbackElement, 'Viagem excluída com sucesso.', 'info');


        if (myTripsView.classList.contains('active-view')) {
            const currentDriverForTable = (loggedInUser.role === 'motorista') ? loggedInUser.username : currentUserForMyTripsSearch;
            if (currentDriverForTable) {
                renderMyTripsTable(currentDriverForTable, myTripsFilterStartDate.value, myTripsFilterEndDate.value);
                 if (loggedInUser.role === 'motorista' && loggedInUser.username.toLowerCase() === currentDriverForTable.toLowerCase()) {
                    renderDriverSummary(currentDriverForTable, myTripsFilterStartDate.value, myTripsFilterEndDate.value);
                } else if (loggedInUser.role === 'admin' && loggedInUser.username.toLowerCase() === 'fabio' && currentUserForMyTripsSearch) {
                    // No specific summary to update here for admin in "My Trips" view
                }
            }
        }

        if (adminView.classList.contains('active-view')) {
            renderAdminOverallSummary(adminSummaryFilterStartDate.value, adminSummaryFilterEndDate.value);
            if (adminSelectedDriverName && adminSelectedDriverName.toLowerCase() === associatedDriverName.toLowerCase()) {
                 renderAdminDriverTripsTable(adminSelectedDriverName); 
            }
            populateAdminDriverSelect();
        }
    }
}

// --- "MY TRIPS" VIEW FUNCTIONS ---
function renderMyTripsTable(driverNameToRender: string, startDate?: string, endDate?: string): void {
    let filteredTrips = trips.filter(trip => trip.driverName.toLowerCase() === driverNameToRender.toLowerCase());

    if (startDate && endDate) {
        filteredTrips = filteredTrips.filter(trip => trip.date >= startDate! && trip.date <= endDate!);
    } else if (startDate) {
        filteredTrips = filteredTrips.filter(trip => trip.date >= startDate!);
    } else if (endDate) {
        filteredTrips = filteredTrips.filter(trip => trip.date <= endDate!);
    }

    filteredTrips.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    myTripsTableBody.innerHTML = '';
    if (filteredTrips.length === 0) {
        myTripsTable.style.display = 'none';
        myTripsTablePlaceholder.textContent = 'Nenhuma viagem encontrada para os filtros aplicados.';
        myTripsTablePlaceholder.style.display = 'block';
    } else {
        myTripsTable.style.display = 'table';
        myTripsTablePlaceholder.style.display = 'none';
        filteredTrips.forEach(trip => {
            const row = myTripsTableBody.insertRow();
            row.insertCell().textContent = formatDate(trip.date);
            row.insertCell().textContent = trip.cargoType || '-';
            row.insertCell().textContent = formatCurrency(trip.freightValue);
            row.insertCell().textContent = formatCurrency(trip.totalExpenses);

            const commissionCell = row.insertCell();
            commissionCell.textContent = formatCurrency(trip.commissionCost);

            const actionsCell = row.insertCell();
            const editButton = document.createElement('button');
            editButton.textContent = 'Editar';
            editButton.classList.add('control-btn', 'small-btn');
            editButton.setAttribute('aria-label', `Editar viagem de ${formatDate(trip.date)}`);
            editButton.onclick = () => editTrip(trip.id);
            actionsCell.appendChild(editButton);

            if (loggedInUser) {
                // Condition for showing the delete button:
                // 1. Logged-in user is a 'motorista' AND this trip belongs to them.
                // OR
                // 2. Logged-in user is an 'admin' AND their username is 'fabio' (case-insensitive).
                const canDelete = (loggedInUser.role === 'motorista' && trip.driverName.toLowerCase() === loggedInUser.username.toLowerCase()) ||
                                  (loggedInUser.role === 'admin' && loggedInUser.username.toLowerCase() === 'fabio');
                if (canDelete) {
                    const deleteButton = document.createElement('button');
                    deleteButton.textContent = 'Excluir';
                    deleteButton.classList.add('control-btn', 'danger-btn', 'small-btn');
                    deleteButton.style.marginLeft = '5px';
                    deleteButton.setAttribute('aria-label', `Excluir viagem de ${formatDate(trip.date)}`);
                    deleteButton.onclick = () => deleteTrip(trip.id, trip.driverName);
                    actionsCell.appendChild(deleteButton);
                }
            }
        });
    }
}

function handleLoadMyTripsForAdmin(): void {
    const driverName = myTripsDriverNameInput.value.trim();
    if (driverName) {
        currentUserForMyTripsSearch = driverName;
        renderMyTripsTable(driverName, myTripsFilterStartDate.value, myTripsFilterEndDate.value);
        myTripsFeedback.style.display = 'none';
        driverSummaryContainer.style.display = 'none'; 
    } else {
        showFeedback(myTripsFeedback, 'Por favor, digite um nome de motorista para buscar.', 'info');
        currentUserForMyTripsSearch = null;
        myTripsTableBody.innerHTML = '';
        myTripsTable.style.display = 'none';
        myTripsTablePlaceholder.textContent = 'Administradores: Busque por um nome de motorista para ver as viagens.';
        myTripsTablePlaceholder.style.display = 'block';
        driverSummaryContainer.style.display = 'none';
    }
}

function applyMyTripsDateFilter(): void {
    const driverNameToFilter = (loggedInUser?.role === 'motorista') ? loggedInUser.username : currentUserForMyTripsSearch;
    if (driverNameToFilter) {
        renderMyTripsTable(driverNameToFilter, myTripsFilterStartDate.value, myTripsFilterEndDate.value);
        if (loggedInUser?.role === 'motorista' && loggedInUser.username.toLowerCase() === driverNameToFilter.toLowerCase()) {
             renderDriverSummary(driverNameToFilter, myTripsFilterStartDate.value, myTripsFilterEndDate.value);
        }
    } else if (loggedInUser?.role === 'admin') {
        if (!currentUserForMyTripsSearch) {
            showFeedback(myTripsFeedback, 'Busque por um motorista antes de aplicar o filtro de data.', 'info');
        } 
    }
}

// --- ADMIN PANEL FUNCTIONS ---
function populateAdminDriverSelect(): void {
    const driverUsernames = new Set<string>();
    users.filter(u => u.role === 'motorista').forEach(u => driverUsernames.add(u.username));
    trips.forEach(trip => driverUsernames.add(trip.driverName)); 

    const sortedDriverNames = Array.from(driverUsernames).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

    const currentSelectedValue = adminSelectDriver.value;
    adminSelectDriver.innerHTML = '<option value="">-- Selecione um Motorista --</option>';
    sortedDriverNames.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        adminSelectDriver.appendChild(option);
    });
    
    if (currentSelectedValue && sortedDriverNames.includes(currentSelectedValue)) {
        adminSelectDriver.value = currentSelectedValue;
    } else if (adminSelectedDriverName && sortedDriverNames.includes(adminSelectedDriverName)) {
        adminSelectDriver.value = adminSelectedDriverName; 
    } else {
        adminSelectDriver.value = ""; 
        if(adminSelectedDriverName && !sortedDriverNames.includes(adminSelectedDriverName)){
            adminSelectedDriverName = null; 
            if (adminDriverTripsSection) adminDriverTripsSection.style.display = 'none';
        }
    }
}

function renderAdminDriverTripsTable(driverName: string): void {
    adminSelectedDriverName = driverName;
    const driverTrips = trips.filter(trip => trip.driverName.toLowerCase() === driverName.toLowerCase())
                             .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    adminSelectedDriverNameDisplay.textContent = `Viagens de ${driverName}`;
    adminDriverTripsTableBody.innerHTML = '';

    if (driverTrips.length === 0) {
        adminDriverTripsTable.style.display = 'none';
        adminDriverTripsPlaceholder.textContent = `Nenhuma viagem encontrada para ${driverName}.`;
        adminDriverTripsPlaceholder.style.display = 'block';
    } else {
        adminDriverTripsTable.style.display = 'table';
        adminDriverTripsPlaceholder.style.display = 'none';
        driverTrips.forEach(trip => {
            const row = adminDriverTripsTableBody.insertRow();
            row.insertCell().textContent = formatDate(trip.date);
            row.insertCell().textContent = trip.cargoType || '-';
            const netProfitCell = row.insertCell();
            netProfitCell.textContent = formatCurrency(trip.netProfit);
            netProfitCell.style.color = trip.netProfit >= 0 ? 'green' : 'red';

            const actionsCell = row.insertCell();
            const detailButton = document.createElement('button');
            detailButton.textContent = 'Detalhes';
            detailButton.classList.add('control-btn', 'small-btn');
            detailButton.setAttribute('aria-label', `Detalhes da viagem de ${formatDate(trip.date)}`);
            detailButton.onclick = () => showAdminTripDetailModal(trip.id);
            actionsCell.appendChild(detailButton);

            const editButton = document.createElement('button');
            editButton.textContent = 'Editar';
            editButton.classList.add('control-btn', 'secondary-btn', 'small-btn');
            editButton.style.marginLeft = '5px';
            editButton.setAttribute('aria-label', `Editar viagem de ${formatDate(trip.date)}`);
            editButton.onclick = () => editTrip(trip.id); 
            actionsCell.appendChild(editButton);

            // Delete button is removed from this table as per requirements.
            // Master admin ('Fabio') can delete via "Minhas Viagens" search.
        });
    }
    adminDriverTripsSection.style.display = 'block';
}

function showAdminTripDetailModal(tripId: string): void {
    const trip = trips.find(t => t.id === tripId);
    if (!trip) return;

    let fuelDetailsHtml = '<h4>Abastecimentos</h4>';
    if (trip.fuelEntries && trip.fuelEntries.length > 0) {
        trip.fuelEntries.forEach(entry => {
            fuelDetailsHtml += `
                <div class="fuel-entry-detail-item">
                    <p><strong>Litros:</strong> ${entry.liters.toLocaleString('pt-BR')}</p>
                    <p><strong>Valor/Litro:</strong> ${formatCurrency(entry.valuePerLiter)}</p>
                    <p><strong>Desconto:</strong> ${formatCurrency(entry.discount)}</p>
                    <p><strong>Total Abastecimento:</strong> ${formatCurrency(entry.totalValue)}</p>
                </div>
            `;
        });
    } else {
        fuelDetailsHtml += '<p>Nenhum abastecimento registrado.</p>';
    }

    adminTripDetailContent.innerHTML = `
        <div class="trip-detail-section">
            <h4>Informações Gerais</h4>
            <p><strong>Data:</strong> ${formatDate(trip.date)}</p>
            <p><strong>Motorista:</strong> ${trip.driverName}</p>
            <p><strong>Tipo de Carga:</strong> ${trip.cargoType || '-'}</p>
            <p><strong>Km Inicial:</strong> ${trip.kmInitial?.toLocaleString('pt-BR') || '-'}</p>
            <p><strong>Km Final:</strong> ${trip.kmFinal?.toLocaleString('pt-BR') || '-'}</p>
            <p><strong>Km Rodados:</strong> ${trip.kmDriven?.toLocaleString('pt-BR') || '-'}</p>
            <p><strong>Peso (Kg):</strong> ${trip.weight?.toLocaleString('pt-BR') || '-'}</p>
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
            <p><strong>Descrição (Outras):</strong> ${trip.expenseDescription || '-'}</p>
        </div>
        <div class="trip-detail-section trip-financial-summary">
            <h4>Resumo Financeiro</h4>
            <p><strong>Valor do Frete:</strong> ${formatCurrency(trip.freightValue)}</p>
            <p><strong>Valor Declarado:</strong> ${formatCurrency(trip.declaredValue)}</p>
            <p><strong>Total de Combustível:</strong> ${formatCurrency(trip.totalFuelCost)}</p>
            <p><strong>Despesas Totais (Empresa):</strong> ${formatCurrency(trip.totalExpenses)}</p>
            <p><strong>Lucro Líquido (Empresa):</strong> <strong class="${trip.netProfit >= 0 ? 'profit' : 'loss'}">${formatCurrency(trip.netProfit)}</strong></p>
        </div>
    `;
    adminTripDetailModal.style.display = 'flex';
}

// --- USER MANAGEMENT (ADMIN "Fabio" ONLY) ---
function renderUserManagementTable(): void {
    if (!loggedInUser || loggedInUser.username.toLowerCase() !== 'fabio') return;

    userManagementTableBody.innerHTML = '';
    users
        .sort((a, b) => a.username.localeCompare(b.username))
        .forEach(user => {
            const row = userManagementTableBody.insertRow();
            row.insertCell().textContent = user.username;
            row.insertCell().textContent = user.role === 'admin' ? 'Administrador' : 'Motorista';

            const actionsCell = row.insertCell();
            const editButton = document.createElement('button');
            editButton.textContent = 'Editar';
            editButton.classList.add('control-btn', 'small-btn');
            editButton.setAttribute('aria-label', `Editar usuário ${user.username}`);
            editButton.onclick = () => openEditUserModal(user.id);
            actionsCell.appendChild(editButton);

            if (user.username.toLowerCase() !== 'fabio') {
                const deleteButton = document.createElement('button');
                deleteButton.textContent = 'Excluir';
                deleteButton.classList.add('control-btn', 'danger-btn', 'small-btn');
                deleteButton.style.marginLeft = '5px';
                deleteButton.setAttribute('aria-label', `Excluir usuário ${user.username}`);
                deleteButton.onclick = () => deleteUser(user.id, user.username);
                actionsCell.appendChild(deleteButton);
            }
        });
}

function openEditUserModal(userId: string): void {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    editingUserIdForAdmin = userId;
    editUserIdInput.value = userId;
    editUsernameDisplay.value = user.username;
    editUserRoleSelect.value = user.role;
    editUserNewPasswordInput.value = '';
    editUserConfirmNewPasswordInput.value = '';
    editUserFeedback.style.display = 'none';
    editUserModal.style.display = 'flex';
}

async function handleEditUser(event: Event): Promise<void> {
    event.preventDefault();
    if (!editingUserIdForAdmin) return;

    const newRole = editUserRoleSelect.value as 'motorista' | 'admin';
    const newPassword = editUserNewPasswordInput.value;
    const confirmNewPassword = editUserConfirmNewPasswordInput.value;

    const userIndex = users.findIndex(u => u.id === editingUserIdForAdmin);
    if (userIndex === -1) {
        showFeedback(editUserFeedback, 'Usuário não encontrado.', 'error');
        return;
    }

    if (newPassword) {
        if (newPassword !== confirmNewPassword) {
            showFeedback(editUserFeedback, 'As novas senhas não coincidem.', 'error');
            return;
        }
        users[userIndex].password = await hashPassword(newPassword);
    }
    users[userIndex].role = newRole;
    saveUsersToStorage();
    showFeedback(editUserFeedback, 'Usuário atualizado com sucesso!', 'success');
    renderUserManagementTable();

    if (loggedInUser && loggedInUser.role === 'admin') {
        populateAdminDriverSelect(); 
    }

    setTimeout(() => {
        editUserModal.style.display = 'none';
        editingUserIdForAdmin = null;
    }, 1500);
}

function deleteUser(userId: string, username: string): void {
    if (username.toLowerCase() === 'fabio') {
        showFeedback(userManagementFeedback, 'Não é possível excluir o super-administrador.', 'error');
        return;
    }
    if (confirm(`Tem certeza que deseja excluir o usuário '${username}'? Isso não excluirá as viagens já registradas por ele.`)) {
        users = users.filter(user => user.id !== userId);
        saveUsersToStorage();
        showFeedback(userManagementFeedback, `Usuário '${username}' excluído.`, 'info');
        renderUserManagementTable();

        if (adminSelectedDriverName && adminSelectedDriverName.toLowerCase() === username.toLowerCase()) {
            adminSelectedDriverName = null;
            if(adminDriverTripsSection) adminDriverTripsSection.style.display = 'none'; 
        }
        if (loggedInUser && loggedInUser.role === 'admin') {
            populateAdminDriverSelect(); 
        }
    }
}


// --- EVENT LISTENERS ---
function initializeEventListeners(): void {
    loginForm.addEventListener('submit', (e) => handleLogin(e));
    registerForm.addEventListener('submit', (e) => handleRegister(e));
    showRegisterViewLink.addEventListener('click', (e) => { e.preventDefault(); updateUIAfterAuthChange('register'); });
    showLoginViewLink.addEventListener('click', (e) => { e.preventDefault(); updateUIAfterAuthChange('login'); });
    logoutBtn.addEventListener('click', handleLogout);

    userViewBtn.addEventListener('click', () => showView('user'));
    myTripsViewBtn.addEventListener('click', () => showView('myTrips'));
    adminViewBtn.addEventListener('click', () => showView('admin'));
    userManagementViewBtn.addEventListener('click', () => showView('userManagement'));

    tripForm.addEventListener('submit', handleTripSubmit);
    addFuelEntryBtn.addEventListener('click', () => addFuelEntryToFormUI(undefined, false));
    cancelEditBtn.addEventListener('click', () => {
        resetTripForm();
        if (loggedInUser && loggedInUser.role === 'motorista') {
            tripDriverNameInput.value = loggedInUser.username;
            tripDriverNameInput.disabled = true;
        } else if (loggedInUser && loggedInUser.role === 'admin') {
            tripDriverNameInput.value = ''; 
            tripDriverNameInput.disabled = false;
        }
    });

    loadMyTripsBtn.addEventListener('click', handleLoadMyTripsForAdmin);
    applyMyTripsFilterBtn.addEventListener('click', applyMyTripsDateFilter);

    adminLoadDriverTripsBtn.addEventListener('click', () => {
        const selectedDriver = adminSelectDriver.value;
        if (selectedDriver) {
            renderAdminDriverTripsTable(selectedDriver);
        } else {
            adminSelectedDriverName = null; 
            if(adminDriverTripsSection) adminDriverTripsSection.style.display = 'none';
            showFeedback(adminGeneralFeedback, 'Por favor, selecione um motorista.', 'info');
        }
    });
    closeAdminTripDetailModalBtn.addEventListener('click', () => adminTripDetailModal.style.display = 'none');
    applyAdminSummaryFilterBtn.addEventListener('click', () => renderAdminOverallSummary(adminSummaryFilterStartDate.value, adminSummaryFilterEndDate.value));

    addUserByAdminForm.addEventListener('submit', (e) => handleAddUserByAdmin(e));
    editUserForm.addEventListener('submit', (e) => handleEditUser(e));
    closeEditUserModalBtn.addEventListener('click', () => editUserModal.style.display = 'none');
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    const essentialElements = [
        loginView, registerView, loginForm, registerForm, loginFeedback, registerFeedback, showRegisterViewLink, showLoginViewLink,
        appContainer, logoutBtn, userViewBtn, myTripsViewBtn, adminViewBtn, userManagementViewBtn,
        userView, myTripsView, adminView, userManagementView,
        tripForm, tripDriverNameInput, tripIdToEditInput, submitTripBtn, cancelEditBtn, userFormFeedback,
        fuelEntriesContainer, addFuelEntryBtn, declaredValueInput, freightValueInput, arla32CostInput, tollCostInput, commissionCostInput, otherExpensesInput,
        myTripsDriverNameContainer, myTripsDriverNameInput, loadMyTripsBtn, myTripsFilterControls, myTripsFilterStartDate, myTripsFilterEndDate, applyMyTripsFilterBtn,
        myTripsFeedback, myTripsTableBody, myTripsTable, myTripsTablePlaceholder, driverSummaryContainer, driverTotalTripsEl, driverTotalFreightParticipatedEl,
        driverTotalEarningsEl,
        adminSelectDriver, adminLoadDriverTripsBtn, adminDriverTripsSection, adminSelectedDriverNameDisplay, adminDriverTripsTable, adminDriverTripsTableBody,
        adminDriverTripsPlaceholder, adminTripDetailModal, adminTripDetailContent, closeAdminTripDetailModalBtn, adminGeneralFeedback,
        adminSummaryContainer, adminSummaryFilterStartDate, adminSummaryFilterEndDate, applyAdminSummaryFilterBtn, adminTotalTripsEl, adminTotalFreightEl,
        adminTotalExpensesEl, adminTotalNetProfitEl,
        userManagementFeedback, userManagementTableBody, editUserModal, closeEditUserModalBtn, editUserForm, editUserIdInput,
        editUsernameDisplay, editUserRoleSelect, editUserNewPasswordInput, editUserConfirmNewPasswordInput, editUserFeedback,
        addUserByAdminForm, addUserFeedback
    ];

    let allElementsPresent = true;
    for (const el of essentialElements) {
        if (!el) {
            console.error('Elemento DOM essencial não encontrado. Verifique o HTML e os IDs.', el === null ? 'Um elemento nulo foi encontrado' : el);
            allElementsPresent = false;
        }
    }

    if (allElementsPresent) {
        initializeEventListeners();
        loadUsersFromStorage();
        await ensureMasterAdminExists();
        loadTripsFromStorage();
        checkSession();
    } else {
        document.body.innerHTML = '<p style="color: red; font-size: 1.5em; text-align: center; margin-top: 20px;">Erro crítico: Nem todos os elementos da interface foram carregados. Verifique o console para detalhes e o HTML para IDs corretos.</p>';
    }
});