import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://13.204.195.88:5002/api";
// Derived origin for building absolute asset URLs
export const API_ORIGIN = API_BASE_URL.replace(/\/?api\/?$/, "");

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
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
  getPersonalMessages: (userId) => api.get(`/messages/personal/${userId}`),
  getGroupMessages: (groupId) => api.get(`/messages/group/${groupId}`),
  sendPersonalMessage: (messageData) => {
    // Check if it's FormData (file upload) or regular object
    if (messageData instanceof FormData) {
      return api.post("/messages/personal", messageData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    }
    return api.post("/messages/personal", messageData);
  },
  sendGroupMessage: (messageData) => {
    // Check if it's FormData (file upload) or regular object
    if (messageData instanceof FormData) {
      return api.post("/messages/group", messageData, {
        headers: { "Content-Type": "multipart/form-data" },
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

export default api;
