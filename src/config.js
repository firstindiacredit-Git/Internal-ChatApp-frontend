export const config = {
  API_URL: import.meta.env.VITE_API_URL || "http://localhost:5002/api",
  SOCKET_URL: import.meta.env.VITE_SOCKET_URL || "http://localhost:5002",
  TURN_URL: import.meta.env.VITE_TURN_URL || " turn:internalchat.pizeonfly.com:3478",
  TURN_USERNAME: import.meta.env.VITE_TURN_USERNAME || "turn",
  TURN_PASSWORD: import.meta.env.VITE_TURN_PASSWORD || "o4Ps!xl4",
};
