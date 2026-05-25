// src/redux/store.js
import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import { combineReducers } from 'redux';

import authReducer from './slices/authSlice';
import userReducer from './slices/userSlice';
import cartReducer from './slices/cartSlice';
import productReducer from './slices/productSlice';
import orderReducer from './slices/orderSlice';
import notificationReducer from './slices/notificationSlice';
import uiReducer from './slices/uiSlice';

const createPersistStorage = () => {
  if (typeof window === 'undefined') {
    return {
      getItem: () => Promise.resolve(null),
      setItem: (_key, value) => Promise.resolve(value),
      removeItem: () => Promise.resolve(),
    };
  }

  return {
    getItem: (key) => Promise.resolve(window.localStorage.getItem(key)),
    setItem: (key, value) => {
      window.localStorage.setItem(key, value);
      return Promise.resolve(value);
    },
    removeItem: (key) => {
      window.localStorage.removeItem(key);
      return Promise.resolve();
    },
  };
};

const storage = createPersistStorage();

const uiPersistConfig = {
  key: 'ui',
  storage,
  whitelist: ['theme', 'registrationProgress', 'profileReminder'],
};

const rootReducer = combineReducers({
  auth: authReducer,
  user: userReducer,
  cart: cartReducer,
  products: productReducer,
  orders: orderReducer,
  notifications: notificationReducer,
  ui: persistReducer(uiPersistConfig, uiReducer),
});

const persistConfig = {
  key: 'root',
  storage,
  whitelist: ['auth', 'user', 'cart', 'ui'],
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE', 'persist/REGISTER'],
        ignoredActionPaths: ['register'],
        ignoredPaths: ['register'],
      },
    }),
});

export const persistor = persistStore(store);
