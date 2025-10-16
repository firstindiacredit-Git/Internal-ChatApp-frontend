// Detect if running in Electron
const isElectron = window.electron && window.electron.isElectron;

// Use localhost for Electron, otherwise use environment variables or defaults
const getApiUrl = () => {
  if (isElectron) {
    return "http://localhost:5001/api";
  }
  return import.meta.env.VITE_API_URL || "http://localhost:5001/api";
};

const getSocketUrl = () => {
  if (isElectron) {
    return "http://localhost:5001";
  }
  return import.meta.env.VITE_SOCKET_URL || "http://localhost:5001";
};

export const config = {
  API_URL: getApiUrl(),
  SOCKET_URL: getSocketUrl(),
  TURN_URL:
    import.meta.env.VITE_TURN_URL || "turn:internalchat.pizeonfly.com:3478",
  TURN_USERNAME: import.meta.env.VITE_TURN_USERNAME || "turn",
  TURN_PASSWORD: import.meta.env.VITE_TURN_PASSWORD || "o4Ps!xl4",
  IS_ELECTRON: isElectron,
};

// Firebase Configuration
export const firebaseConfig = {
  apiKey:
    import.meta.env.VITE_FIREBASE_API_KEY ||
    "",
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
    "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    "",
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ||
    "",
};

export const firebaseVapidKey =
  import.meta.env.VITE_FIREBASE_VAPID_KEY ||
  "";
