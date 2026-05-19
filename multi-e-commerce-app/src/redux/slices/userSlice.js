import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  profile: null,
  addresses: [],
  paymentMethods: [],
  loading: false,
  error: null,
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    fetchUserStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    fetchUserSuccess: (state, action) => {
      state.loading = false;
      state.profile = action.payload;
    },
    fetchUserFailure: (state, action) => {
      state.loading = false;
      state.error = action.payload;
    },
    updateProfileStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    updateProfileSuccess: (state, action) => {
      state.loading = false;
      state.profile = { ...state.profile, ...action.payload };
    },
    updateProfileFailure: (state, action) => {
      state.loading = false;
      state.error = action.payload;
    },
    addAddress: (state, action) => {
      state.addresses.push(action.payload);
    },
    removeAddress: (state, action) => {
      state.addresses = state.addresses.filter(
        (address) => address.id !== action.payload
      );
    },
    clearUserData: (state) => {
      state.profile = null;
      state.addresses = [];
      state.paymentMethods = [];
      state.loading = false;
      state.error = null;
    },
  },
});

export const {
  fetchUserStart,
  fetchUserSuccess,
  fetchUserFailure,
  updateProfileStart,
  updateProfileSuccess,
  updateProfileFailure,
  addAddress,
  removeAddress,
  clearUserData,
} = userSlice.actions;

export default userSlice.reducer;