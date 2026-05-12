const MOCK_DATA_STORAGE_KEY = 'market_pulse_mock_data_mode';
const MOCK_DATA_DISABLED = 'disabled';
const MOCK_DATA_ENABLED = 'enabled';

export const isMockDataEnabled = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  return localStorage.getItem(MOCK_DATA_STORAGE_KEY) !== MOCK_DATA_DISABLED;
};

export const disableMockData = () => {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.setItem(MOCK_DATA_STORAGE_KEY, MOCK_DATA_DISABLED);
};

export const enableMockData = () => {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.setItem(MOCK_DATA_STORAGE_KEY, MOCK_DATA_ENABLED);
};
