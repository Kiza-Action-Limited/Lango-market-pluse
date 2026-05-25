import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from './redux/store';
import App from './App';
import './styles/globals.css';

const PERSIST_ROOT_KEY = 'persist:root';
const PERSIST_UI_KEY = 'persist:ui';

const clearCorruptPersistedState = () => {
  try {
    const rootValue = localStorage.getItem(PERSIST_ROOT_KEY);
    if (rootValue) {
      const parsedRoot = JSON.parse(rootValue);
      if (!parsedRoot || typeof parsedRoot !== 'object') {
        localStorage.removeItem(PERSIST_ROOT_KEY);
      }
    }
  } catch (error) {
    localStorage.removeItem(PERSIST_ROOT_KEY);
  }

  try {
    const uiValue = localStorage.getItem(PERSIST_UI_KEY);
    if (uiValue) {
      const parsedUi = JSON.parse(uiValue);
      if (!parsedUi || typeof parsedUi !== 'object') {
        localStorage.removeItem(PERSIST_UI_KEY);
      }
    }
  } catch (error) {
    localStorage.removeItem(PERSIST_UI_KEY);
  }
};

clearCorruptPersistedState();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <Provider store={store}>
    <PersistGate loading={<div>Loading...</div>} persistor={persistor}>
      <App />
    </PersistGate>
  </Provider>
);
