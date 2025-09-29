import { io } from "socket.io-client";

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = Infinity;
    this.reconnectDelay = 1000;
    this.pingInterval = null;
    this.lastPingTime = Date.now();
    this.currentUserId = null;
    this.listeners = new Map();
    this.isConnecting = false;
  }

  connect() {
    if (this.isConnecting) {
      return this.socket;
    }

    if (this.socket && this.socket.connected) {
      return this.socket;
    }

    console.log("🔌 Creating new socket connection...");
    this.isConnecting = true;

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.socket = io(
      import.meta.env.VITE_SOCKET_URL || "http://localhost:5000",
      {
        autoConnect: true,
        reconnection: true,
        reconnectionDelay: this.reconnectDelay,
        reconnectionAttempts: this.maxReconnectAttempts,
        maxReconnectionAttempts: this.maxReconnectAttempts,
        timeout: 20000,
        forceNew: true,
        multiplex: false,
        transports: ["websocket", "polling"],
      }
    );

    this.setupEventHandlers();
    this.isConnecting = false;
    return this.socket;
  }

  setupEventHandlers() {
    this.socket.on("connect", () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.lastPingTime = Date.now();
      console.log("🎉 ===== SOCKET CONNECTED ===== 🎉");
      console.log("🔌 Socket ID:", this.socket.id);
      console.log("🌐 Connection URL:", this.socket.io.uri);
      console.log("📡 Transport:", this.socket.io.engine.transport.name);
      console.log("👤 Current User ID:", this.currentUserId);
      console.log("🔗 Active listeners:", this.listeners.size);
      console.log("========================================");

      if (this.currentUserId) {
        this.joinUserRoom(this.currentUserId);
      }
      this.startPingMonitoring();
      this.setupMessageListeners();

      // Send ping to keep connection alive and confirm connection
      this.socket.emit("ping", { timestamp: Date.now() });
      console.log("🔧 Enhanced connection alive detection initiated");
    });

    this.socket.on("disconnect", (reason) => {
      this.isConnected = false;
      console.log("⚠️ ===== SOCKET DISCONNECTED ===== ⚠️");
      console.log("❌ Reason:", reason);
      console.log("🔄 Attempting reconnection...");
      console.log("========================================");
      this.stopPingMonitoring();
      this.attemptReconnection();
    });

    this.socket.on("connect_error", (error) => {
      console.error("🚨 ===== CONNECTION ERROR ===== 🚨");
      console.error("❌ Error:", error.message);
      console.error("🌐 URL:", error.type);
      console.error("🔢 Status:", error.description);
      console.error("=========================================");
      this.attemptReconnection();
    });

    this.socket.on("reconnect", (attemptNumber) => {
      console.log("✅ ===== RECONNECTION SUCCESSFUL ===== ✅");
      console.log("🔄 Attempts tried:", attemptNumber);
      console.log("🔌 New Socket ID:", this.socket.id);
      console.log("==============================================");
    });

    this.socket.on("ping", (data) => {
      this.lastPingTime = Date.now();
      console.log(
        " Ping received - Connection alive, timestamp:",
        new Date(this.lastPingTime).toLocaleTimeString()
      );
    });

    // Handle pong responses
    this.socket.on("pong", (data) => {
      this.lastPingTime = Date.now();
      console.log(
        "💗 Pong received - Connection confirmed, timestamp:",
        new Date(this.lastPingTime).toLocaleTimeString()
      );
    });

    // Remove duplicate connect handler as it's already handled above

    // Connection state debugging
    this.socket.on("connect_timeout", () => {
      console.log("⏰ ===== CONNECTION TIMEOUT ===== ⏰");
      console.log("🔌 Socket connection timed out");
      console.log("======================================");
    });

    this.socket.on("reconnect_error", (error) => {
      console.error("🔄❌ ===== RECONNECTION ERROR ===== ❌🔄");
      console.error("Error:", error.message);
      console.error("========================================");
    });

    this.socket.on("reconnect_failed", () => {
      console.error("💥 ===== FAILED RECONNECTION ===== 💥");
      console.error("🔌 Socket reconnection permanently failed");
      console.error("🔄 Attempting force reconnect...");
      console.error("===========================================");
    });
  }

  setupMessageListeners() {
    // This will be called after socket connect to re-register all message listeners
    console.log("🔧 ===== SETTING UP MESSAGE LISTENERS ===== 🔧");
    console.log("📝 Total listeners to register:", this.listeners.size);

    for (const [event, callback] of this.listeners) {
      if (this.socket) {
        // Remove all existing listeners first to avoid duplicates
        this.socket.removeAllListeners(event);
        this.socket.on(event, callback);
        console.log(`✅ Re-registered listener: ${event}`);
      }
    }
    console.log("🔗 ===== ALL LISTENERS ACTIVE ===== ");
    console.log("📡 Socket ready for real-time messaging");
    console.log("========================================");
  }

  // Enhanced method to maintain persistent connection
  maintainConnection() {
    console.log("🔧 ===== MAINTAINING PERSISTENT CONNECTION ===== 🔧");

    if (!this.isConnected || !this.socket) {
      console.log("⚠️ Socket disconnected, reconnecting...");
      this.connect();
    } else {
      console.log("✅ Socket is connected, maintaining listeners");
      this.setupMessageListeners();

      // Enhanced keep-alive ping with connection validation
      if (this.socket && this.isConnected) {
        this.socket.emit("ping", { timestamp: Date.now() });
        this.lastPingTime = Date.now(); // Update immediately
        console.log("Keep-alive ping sent - Connection maintained");

        // Trigger a pong request for confirmation
        setTimeout(() => {
          if (this.socket && this.isConnected) {
            this.socket.emit("pong", { timestamp: Date.now() });
          }
        }, 100);
      }
    }
    console.log("==============================================");
  }

  // SPECIFIC METHOD FOR CHATROOM REAL-TIME MESSAGE RECEPTION
  forceChatroomReception() {
    console.log("🔔 FORCING CHATROOM MESSAGE RECEPTION");
    if (this.socket && this.isConnected) {
      // Re-register all listeners for chatroom persistence
      this.setupMessageListeners();
      console.log("✅ Chatroom reception listeners reinforced");
    } else {
      console.log("⚠️ Socket not available for chatroom reinforcement");
      this.connect();
    }
    console.log("=====");
  }

  startPingMonitoring() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    // Enhanced ping monitoring with more tolerance
    this.pingInterval = setInterval(() => {
      const timeSinceLastPing = Date.now() - this.lastPingTime;

      console.log(
        ` Health check: Time since last ping: ${timeSinceLastPing}ms`
      );

      // Proactively send ping to prevent health check failures
      if (this.socket && this.isConnected && timeSinceLastPing > 45000) {
        console.log("➡️ Proactive ping sent to prevent timeout");
        this.socket.emit("ping", { timestamp: Date.now() });
        this.lastPingTime = Date.now();
      }

      // More tolerant timeout handling with proactive prevention
      if (timeSinceLastPing > 180000) {
        // Extended to 3 minutes with ping prevention
        console.log(
          "⚠️ Extended timeout reached - checking real disconnection"
        );

        // Check if socket is truly disconnected (more thorough check)
        if (this.socket && this.socket.connected && this.isConnected) {
          console.log("🔧 Socket connection verified alive, resetting timer");
          this.lastPingTime = Date.now();
          return;
        }

        console.log("🔄 Real disconnection confirmed, force reconnecting...");
        this.forceReconnect();
      } else {
        console.log(
          `✅ Socket health maintained: ${timeSinceLastPing}ms response time`
        );
      }
    }, 25000); // More frequent checks every 25 seconds
  }

  stopPingMonitoring() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  attemptReconnection() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log("🔄 ===== ATTEMPTING RECONNECTION ===== 🔄");
      console.log(
        `📊 Attempt: ${this.reconnectAttempts}/${this.maxReconnectAttempts}`
      );
      console.log(
        `⏰ Delay: ${this.reconnectDelay * this.reconnectAttempts}ms`
      );
      console.log("====================");

      setTimeout(() => {
        console.log("🚀 Executing reconnection...");
        this.connect();
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.log("💥 ===== MAX ATTEMPTS REACHED ===== 💥");
      console.log("🔥 Forcing socket reset...");
      setTimeout(() => {
        this.forceReconnect();
      }, this.reconnectDelay * 5);
      console.log("=====================================");
    }
  }

  forceReconnect() {
    console.log("🔄 Force reconnecting socket...");
    this.stopPingMonitoring();
    this.reconnectAttempts = 0;

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    setTimeout(() => {
      this.connect();
    }, 2000);
  }

  disconnect() {
    this.stopPingMonitoring();
    this.listeners.clear();

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.isConnected = false;
    this.currentUserId = null;
  }

  joinUserRoom(userId) {
    this.currentUserId = userId;

    if (this.socket && this.isConnected) {
      this.socket.emit("join", userId);
      console.log("🏠 Joined user room:", userId);
    } else {
      console.log("🔄 Waiting to join user room after connection...");
    }
  }

  joinGroupRoom(groupId) {
    if (this.socket) {
      this.socket.emit("join-group", groupId);
    }
  }

  leaveGroupRoom(groupId) {
    if (this.socket) {
      this.socket.emit("leave-group", groupId);
    }
  }

  sendPersonalMessage(data) {
    console.log("📤 ===== SENDING PERSONAL MESSAGE ===== 📤");
    console.log("📊 Data:", data);
    console.log("🔌 Socket available:", !!this.socket);
    console.log("📡 Socket connected:", this.isConnected);
    console.log("🆔 Socket ID:", this.socket?.id);

    if (!this.socket || !this.isConnected) {
      console.log("⚠️ Socket not connected, connecting first...");
      this.connect();

      setTimeout(() => {
        if (this.socket && this.isConnected) {
          console.log("🔄 Retrying message send after connection");
          this.socket.emit("send-message", data);
          console.log("✅ Personal message retry sent successfully");
        } else {
          console.error("❌ Still not connected after retry");
        }
      }, 2000);
      return;
    }

    // Ensure socket is still connected right before sending
    this.ensureConnected();

    if (this.socket && this.isConnected) {
      this.socket.emit("send-message", data);
      console.log("✅ Personal message sent successfully");

      // Keep connection alive after sending message
      setTimeout(() => {
        if (this.socket && this.isConnected) {
          this.socket.emit("ping", { timestamp: Date.now() });
        }
      }, 100);
    } else {
      console.error("❌ Socket lost connection before sending message");
    }
    console.log("=============================================");
  }

  sendGroupMessage(data) {
    console.log("📤 ===== SENDING GROUP MESSAGE ===== 📤");
    console.log("📊 Data:", data);
    console.log("🔌 Socket available:", !!this.socket);
    console.log("📡 Socket connected:", this.isConnected);
    console.log("🆔 Socket ID:", this.socket?.id);

    if (!this.socket || !this.isConnected) {
      console.log("⚠️ Socket not connected, connecting first...");
      this.connect();

      setTimeout(() => {
        if (this.socket && this.isConnected) {
          console.log("🔄 Retrying group message send after connection");
          this.socket.emit("send-group-message", data);
          console.log("✅ Group message retry sent successfully");
        } else {
          console.error("❌ Still not connected after retry");
        }
      }, 2000);
      return;
    }

    this.socket.emit("send-group-message", data);
    console.log("✅ Group message sent successfully");
    console.log("============================================");
  }

  onReceiveMessage(callback) {
    console.log("🔔 Registering onReceiveMessage listener");
    this.registerListener("receive-message", (data) => {
      console.log("🔔 Received message:", data);
      const enrichedData = {
        ...data,
        _isExternalMessage: true,
        _timestamp: new Date().toISOString(),
      };
      callback(enrichedData);
    });

    // Ensure the listener is maintained for chatroom with improved persistence
    setTimeout(() => {
      if (this.socket && this.isConnected) {
        this.socket.off("receive-message");
        this.socket.on("receive-message", (data) => {
          console.log("🔄 Maintained receive-message listener:", data);
          const enrichedData = {
            ...data,
            _isExternalMessage: true,
            _timestamp: new Date().toISOString(),
          };
          callback(enrichedData);
        });
        console.log("✅ Listener re-registered for chatroom persistence");
      }
    }, 1000); // Reduced timing for faster re-registration
  }

  onReceiveGroupMessage(callback) {
    console.log("🔔 Registering onReceiveGroupMessage listener");
    this.registerListener("receive-group-message", (data) => {
      console.log("🔔 Received group message:", data);
      const enrichedData = {
        ...data,
        _isExternalMessage: true,
        _timestamp: new Date().toISOString(),
      };
      callback(enrichedData);
    });
  }

  onMessageSent(callback) {
    console.log("🔔 Registering onMessageSent listener");
    this.registerListener("message-sent", (data) => {
      console.log("🔔 Message sent confirmation:", data);
      const enrichedData = {
        ...data,
        _isOurMessage: true,
        _isConfirmation: true,
        _timestamp: new Date().toISOString(),
      };
      callback(enrichedData);
    });
  }

  registerListener(event, callback) {
    // Store the listener for later re-registration
    this.listeners.set(event, callback);
    console.log(`📝 Stored listener for event: ${event}`);

    if (this.socket && this.isConnected) {
      // Remove existing listener first to avoid duplicates
      this.socket.off(event);
      this.socket.on(event, callback);
      console.log(`✅ Listener immediately registered for event: ${event}`);
    } else {
      console.log(
        `🔄 Listener queued for event: ${event} (waiting for connection)`
      );
    }
  }

  onGroupMessageSent(callback) {
    this.registerListener("group-message-sent", callback);
  }

  onTyping(callback) {
    this.registerListener("user-typing", callback);
  }

  sendTyping(data) {
    if (this.socket && this.isConnected) {
      this.socket.emit("typing", data);
    }
  }

  onError(callback) {
    this.registerListener("error", callback);
  }

  onAvatarUpdate(callback) {
    this.registerListener("avatar-updated", callback);
  }

  onUserProfileUpdate(callback) {
    this.registerListener("user-profile-updated", callback);
  }

  removeAllListeners() {
    this.listeners.clear();

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.on("connect", () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.lastPingTime = Date.now();

        if (this.currentUserId) {
          this.joinUserRoom(this.currentUserId);
        }
        this.startPingMonitoring();
        this.setupMessageListeners();
      });
    }
  }

  // Enhanced connected state management
  ensureConnected() {
    if (!this.socket || !this.isConnected) {
      console.log("🔄 Ensuring socket connection...");
      return this.connect();
    }
    return true;
  }

  // Connection health check
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      socketId: this.socket?.id,
      lastPing: new Date(this.lastPingTime).toLocaleString(),
      listenersCount: this.listeners.size,
    };
  }

  // Enhanced status logging for debugging
  logConnectionStatus() {
    console.log("🔍 ===== SOCKET STATUS REPORT ===== 🔍");
    console.log("📡 Is Connected:", this.isConnected ? "✅ YES" : "❌ NO");
    console.log("🆔 Socket ID:", this.socket?.id || "N/A");
    console.log("🌐 Connection URL:", this.socket?.io?.uri || "N/A");
    console.log(
      "📊 Transport:",
      this.socket?.io?.engine?.transport?.name || "N/A"
    );
    console.log("👤 Current User ID:", this.currentUserId || "Not set");
    console.log("🔗 Active Listeners:", this.listeners.size);
    console.log("📡 Reconnect Attempts:", this.reconnectAttempts);
    console.log(
      " Last Ping:",
      new Date(this.lastPingTime).toLocaleTimeString()
    );
    console.log(
      "🔄 Listeners registered:",
      Array.from(this.listeners.keys()).join(", ") || "None"
    );
    console.log("========================================");
  }

  // Test connection status by manually triggering logs
  testConnection() {
    console.log("🧪 ===== TESTING SOCKET CONNECTION ===== 🧪");
    this.logConnectionStatus();

    if (this.socket) {
      console.log("🔄 Emitting test ping...");
      this.socket.emit("ping");
    }
    console.log("============================================");
  }

  // Manual connection trigger for debugging
  forceConnectionTest() {
    console.log("🛠️ ===== MANUAL CONNECTION FORCE TEST ===== 🛠️");
    this.connect();
    setTimeout(() => {
      this.testConnection();
    }, 3000);
    console.log("=============================================");
  }

  // Force disconnection and restart
  reset() {
    console.log("🔄 Resetting socket service...");
    this.disconnect();
    this.currentUserId = null;
    this.listeners.clear();
    this.reconnectAttempts = 0;
    this.isConnecting = false;
    clearTimeout(this.reconnectTimeout);
  }
}

export default new SocketService();
