import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5002/api";
// Derived origin for building absolute asset URLs
export const API_ORIGIN = API_BASE_URL.replace(/\/?api\/?$/, "");

// Create axios instance with increased timeout for large file uploads
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 5 * 60 * 1000, // 5 minutes timeout for large files
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (email, password) => api.post("/auth/login", { email, password }),
  registerSuperAdmin: (name, email, password) =>
    api.post("/auth/register-superadmin", { name, email, password }),
  getCurrentUser: () => api.get("/auth/me"),
  checkSuperAdmin: () => api.get("/auth/check-superadmin"),
};

// Users API
export const usersAPI = {
  getUsers: () => api.get("/users"),
  getActiveUsers: () => api.get("/users/active"),
  createUser: (userData) => api.post("/users", userData),
  updateUser: (id, userData) => api.put(`/users/${id}`, userData),
  deleteUser: (id) => api.delete(`/users/${id}`),
  toggleUserStatus: (id) => api.put(`/users/${id}/toggle-status`),
  updateProfile: (profileData) => {
    // Accept FormData directly to avoid losing file/content
    const payload =
      profileData instanceof FormData
        ? profileData
        : (() => {
            const fd = new FormData();
            Object.entries(profileData || {}).forEach(([key, value]) => {
              if (value !== null && value !== undefined) {
                fd.append(key, value);
              }
            });
            return fd;
          })();

    return api.put("/users/profile", payload, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },
};

// Groups API
export const groupsAPI = {
  getGroups: () => api.get("/groups"),
  getMyGroups: () => api.get("/groups/my-groups"),
  createGroup: (groupData) => api.post("/groups", groupData),
  addMembers: (groupId, members) =>
    api.post(`/groups/${groupId}/members`, { members }),
  removeMember: (groupId, memberId) =>
    api.delete(`/groups/${groupId}/members/${memberId}`),
  updateGroup: (groupId, groupData) => api.put(`/groups/${groupId}`, groupData),
  deleteGroup: (groupId) => api.delete(`/groups/${groupId}`),
  uploadGroupAvatar: (groupId, formData) =>
    api.post(`/groups/${groupId}/avatar`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
};

// Messages API
export const messagesAPI = {
  getPersonalMessages: (userId, params = {}) =>
    api.get(`/messages/personal/${userId}`, { params }),
  getGroupMessages: (groupId, params = {}) =>
    api.get(`/messages/group/${groupId}`, { params }),
  sendPersonalMessage: (messageData, onUploadProgress) => {
    // Check if it's FormData (file upload) or regular object
    if (messageData instanceof FormData) {
      return api.post("/messages/personal", messageData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 10 * 60 * 1000, // 10 minutes for large file uploads
        maxContentLength: 100 * 1024 * 1024, // 100MB
        maxBodyLength: 100 * 1024 * 1024, // 100MB
        onUploadProgress: onUploadProgress, // Upload progress callback
      });
    }
    return api.post("/messages/personal", messageData);
  },
  sendGroupMessage: (messageData, onUploadProgress) => {
    // Check if it's FormData (file upload) or regular object
    if (messageData instanceof FormData) {
      return api.post("/messages/group", messageData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 10 * 60 * 1000, // 10 minutes for large file uploads
        maxContentLength: 100 * 1024 * 1024, // 100MB
        maxBodyLength: 100 * 1024 * 1024, // 100MB
        onUploadProgress: onUploadProgress, // Upload progress callback
      });
    }
    return api.post("/messages/group", messageData);
  },
  markAsRead: (messageId) => api.put(`/messages/${messageId}/read`),
  getUnreadCount: () => api.get("/messages/unread/count"),
  getChatState: () => api.get("/messages/chat-state"),
  updateChatState: (chatStateData) =>
    api.post("/messages/chat-state", chatStateData),
  forwardMessage: (payload) => api.post("/messages/forward", payload),
  editMessage: (messageId, message) =>
    api.put(`/messages/${messageId}`, { message }),
};

// Calls API
export const callsAPI = {
  getHistory: (params = {}) => api.get(`/calls/history`, { params }),
  initiate: (receiverId, callType = "voice", offer = null) =>
    api.post(`/calls/initiate`, { receiverId, callType, offer }),
  answer: (callId, answer) => api.put(`/calls/${callId}/answer`, { answer }),
  decline: (callId) => api.put(`/calls/${callId}/decline`),
  end: (callId) => api.put(`/calls/${callId}/end`),
  addIceCandidate: (callId, candidate, sdpMLineIndex, sdpMid) =>
    api.post(`/calls/${callId}/ice-candidate`, {
      candidate,
      sdpMLineIndex,
      sdpMid,
    }),
  getDetails: (callId) => api.get(`/calls/${callId}`),
  updateNotes: (callId, notes) => api.put(`/calls/${callId}/notes`, { notes }),
  delete: (callId) => api.delete(`/calls/${callId}`),
};

// Group Calls API
export const groupCallsAPI = {
  test: () => api.get(`/group-calls/test`),
  initiate: (groupId, callType = "voice") =>
    api.post(`/group-calls/initiate`, { groupId, callType }),
  join: (callId) => api.post(`/group-calls/${callId}/join`),
  leave: (callId) => api.post(`/group-calls/${callId}/leave`),
  end: (callId) => api.post(`/group-calls/${callId}/end`),
  updateMuteStatus: (callId, isMuted) =>
    api.put(`/group-calls/${callId}/mute`, { isMuted }),
  updateVideoStatus: (callId, isVideoEnabled) =>
    api.put(`/group-calls/${callId}/video`, { isVideoEnabled }),
  removeParticipant: (callId, userId) =>
    api.delete(`/group-calls/${callId}/participant/${userId}`),
  getDetails: (callId) => api.get(`/group-calls/${callId}`),
  getActiveCalls: (groupId) => api.get(`/group-calls/group/${groupId}/active`),
  getHistory: (groupId, params = {}) =>
    api.get(`/group-calls/group/${groupId}/history`, { params }),
  endAllActive: () => api.post(`/group-calls/debug/end-all-active`),
};

// Time Settings API
export const timeSettingsAPI = {
  getSettings: () => api.get("/time-settings"),
  updateSettings: (settings) => api.put("/time-settings", settings),
  getCurrentTime: () => api.get("/time-settings/current-time"),
};

// Scheduled Disable API
export const scheduledDisableAPI = {
  getSchedules: () => api.get("/scheduled-disable"),
  getSchedule: (id) => api.get(`/scheduled-disable/${id}`),
  createSchedule: (scheduleData) =>
    api.post("/scheduled-disable", scheduleData),
  updateSchedule: (id, scheduleData) =>
    api.put(`/scheduled-disable/${id}`, scheduleData),
  deleteSchedule: (id) => api.delete(`/scheduled-disable/${id}`),
  toggleSchedule: (id) => api.put(`/scheduled-disable/${id}/toggle`),
  resetTrigger: (id) => api.put(`/scheduled-disable/${id}/reset-trigger`),
};

export default api;
