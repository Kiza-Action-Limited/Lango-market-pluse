import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  theme: 'light', // 'light' or 'dark'
  sidebarOpen: false,
  cartDrawerOpen: false,
  modalOpen: false,
  modalContent: null,
  loadingOverlay: false,
  toast: {
    show: false,
    message: '',
    type: 'info', // 'success', 'error', 'warning', 'info'
  },
  registrationProgress: {
    step: 1,
    data: {
      verificationMethod: 'email',
      verificationValue: '',
      verificationCode: '',
      isVerified: false,
      name: '',
      phone: '',
      email: '',
      password: '',
      confirmPassword: '',
      role: 'buyer',
      businessType: '',
      businessLogoUrl: '',
    },
  },
  profileReminder: {
    dismissed: false,
    snoozedUntil: null,
  },
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleTheme: (state) => {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
    },
    setTheme: (state, action) => {
      state.theme = action.payload;
    },
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSidebarOpen: (state, action) => {
      state.sidebarOpen = action.payload;
    },
    toggleCartDrawer: (state) => {
      state.cartDrawerOpen = !state.cartDrawerOpen;
    },
    setCartDrawerOpen: (state, action) => {
      state.cartDrawerOpen = action.payload;
    },
    openModal: (state, action) => {
      state.modalOpen = true;
      state.modalContent = action.payload;
    },
    closeModal: (state) => {
      state.modalOpen = false;
      state.modalContent = null;
    },
    showLoadingOverlay: (state) => {
      state.loadingOverlay = true;
    },
    hideLoadingOverlay: (state) => {
      state.loadingOverlay = false;
    },
    showToast: (state, action) => {
      state.toast = {
        show: true,
        message: action.payload.message,
        type: action.payload.type || 'info',
      };
    },
    hideToast: (state) => {
      state.toast = {
        ...state.toast,
        show: false,
      };
    },
    setRegistrationStep: (state, action) => {
      state.registrationProgress.step = Math.max(1, Number(action.payload) || 1);
    },
    mergeRegistrationData: (state, action) => {
      state.registrationProgress.data = {
        ...state.registrationProgress.data,
        ...action.payload,
      };
    },
    resetRegistrationProgress: (state) => {
      state.registrationProgress = initialState.registrationProgress;
    },
    snoozeProfileReminder: (state, action) => {
      const minutes = Number(action.payload) || 60;
      state.profileReminder.snoozedUntil = Date.now() + minutes * 60 * 1000;
      state.profileReminder.dismissed = false;
    },
    dismissProfileReminder: (state) => {
      state.profileReminder.dismissed = true;
      state.profileReminder.snoozedUntil = null;
    },
    resetProfileReminder: (state) => {
      state.profileReminder = initialState.profileReminder;
    },
  },
});

export const {
  toggleTheme,
  setTheme,
  toggleSidebar,
  setSidebarOpen,
  toggleCartDrawer,
  setCartDrawerOpen,
  openModal,
  closeModal,
  showLoadingOverlay,
  hideLoadingOverlay,
  showToast,
  hideToast,
  setRegistrationStep,
  mergeRegistrationData,
  resetRegistrationProgress,
  snoozeProfileReminder,
  dismissProfileReminder,
  resetProfileReminder,
} = uiSlice.actions;

export default uiSlice.reducer;
