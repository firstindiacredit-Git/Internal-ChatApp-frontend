import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { config } from '../config';
import { toast } from 'react-hot-toast';
import { initializePushNotifications } from '../services/pushNotifications';
import { initializeFCM } from '../services/fcmNotifications';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children, user }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [lastPingTime, setLastPingTime] = useState(Date.now());
  const [notifications, setNotifications] = useState([]);

  // Initialize push notifications (FCM + Web Push)
  const initializeNotifications = async (userId) => {
    try {
      console.log('🔔 Starting push notification initialization...');
      
      // Check notification permission first
      if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
        console.warn('⚠️ Notification permission is denied. Skipping push notification setup.');
        toast('Enable notifications in browser settings to receive alerts when offline', {
          icon: '🔔',
          duration: 5000,
        });
        return;
      }
      
      // Try FCM first
      console.log('🔔 Attempting FCM registration...');
      const fcmResult = await initializeFCM(userId);
      
      if (fcmResult.success) {
        console.log('✅ Push notifications initialized (FCM)');
        
        return;
      }
      
      // Fallback to Web Push if FCM fails
      console.log('🔔 FCM failed, trying Web Push...');
      const webPushResult = await initializePushNotifications(userId);
      
      if (webPushResult.success) {
        console.log('✅ Push notifications initialized (Web Push)');
       
      } else {
        console.warn('⚠️ Push notifications not initialized:', webPushResult.error);
        if (webPushResult.error.includes('permission')) {
         
        }
      }
    } catch (error) {
      console.error('❌ Push notification initialization error:', error);
    }
  };

  // Handle admin notifications
  const handleAdminNotification = (data) => {
    // Check if current user is admin/superadmin
    const isAdmin = user && (user.role === 'admin' || user.role === 'superadmin');
    
    if (isAdmin) {
      // Show toast notification for admin/superadmin
      const toastMessage = `🚨 DISABLED USER LOGIN ATTEMPT\n\n${data.userName} (${data.userEmail}) is trying to access the system`;
      
      toast.error(toastMessage, {
        duration: 8000,
        position: 'top-center',
        style: {
          background: '#fef2f2',
          color: '#dc2626',
          border: '2px solid #ef4444',
          fontSize: '14px',
          fontWeight: 'bold',
          padding: '16px',
          borderRadius: '8px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          whiteSpace: 'pre-line',
        },
        icon: '🚨',
        className: 'toast-admin-alert',
      });
      
      // Add notification for admin/superadmin users  
      const notificationId = Date.now() + Math.random();
      setNotifications(prev => [...prev, { ...data, id: notificationId }]);
    }
  };

  // Handle active user from notification
  const handleActivateUser = async (userId) => {
    try {
      const { usersAPI } = await import('../services/api');
      await usersAPI.toggleUserStatus(userId);
      
      // Find notification to get user name
      const notification = notifications.find(n => n.userId === userId);
      
      setNotifications(prev => prev.filter(n => n.userId !== userId));
      
      // Show success toast
      if (notification) {
        toast.success(`✅ User ${notification.userName} has been activated successfully!`, {
          duration: 4000,
          position: 'top-right',
        });
      }
    } catch (error) {
      console.error('Error activating user:', error);
      toast.error('Failed to activate user. Please try again.');
    }
  };

  // Handle close notification
  const handleCloseNotification = (notificationId) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  // Socket configuration with enhanced transport fallback
  const socketOptions = {
    autoConnect: true,
    transports: ['websocket', 'polling'],
    upgrade: true,
    rememberUpgrade: true,
    timeout: 20000,
    forceNew: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    maxReconnectionAttempts: Infinity,
  };

  // Initialize socket connection
  useEffect(() => {
    if (user && user.id) {
      console.log('🔌 Initializing socket connection for user:', user.name);
      console.log('🔗 Socket URL:', (import.meta.env.VITE_SOCKET_URL || config.SOCKET_URL));
      
      // Close any existing connection first
      if (socket) {
        console.log('🧹 Closing existing socket connection');
        socket.close();
        setSocket(null);
      }
      
      const token = localStorage.getItem('token');
      const newSocket = io((import.meta.env.VITE_SOCKET_URL || config.SOCKET_URL), {
        ...socketOptions,
        auth: { token }
      });

      // Connection successful
      newSocket.on('connect', () => {
        setReconnectAttempts(0);
        setLastPingTime(Date.now());
        setIsConnected(true);
        console.log('✅ Socket connected - ID:', newSocket.id);
        console.log('👤 Connected as user:', user.name);
        console.log('🔗 Connection URL:', newSocket.io.uri);
        
        // Join user room for personal messages
        newSocket.emit('join', user.id);
        console.log(`🏠 User ${user.id} joined personal room`);
        
        // Initialize push notifications
        initializeNotifications(user.id);
        
        // Listen for service worker messages (for inline reply)
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.addEventListener('message', (event) => {
            console.log('📨 Service worker message received:', event.data);
            
            if (event.data.type === 'send-reply') {
              const { replyText, receiver, sender } = event.data.data;
              console.log('💬 Sending reply from notification:', replyText);
              
              // Send the reply message via socket
              newSocket.emit('send-message', {
                receiver: receiver,
                message: replyText,
                messageType: 'text',
                sender: sender,
                timestamp: new Date().toISOString(),
              });
              
              // Show confirmation toast
              toast.success('💬 Reply sent!', {
                duration: 2000,
                position: 'top-right',
              });
            }
          });
        }
        
        startPingMonitoring(newSocket);
        startHeartbeat(newSocket);
      });

      newSocket.on('disconnect', (reason) => {
        setIsConnected(false);
        console.log('❌ Socket disconnected - Reason:', reason);
        console.log('👤 Disconnected user:', user.name);
        stopPingMonitoring();
        stopHeartbeat();
        startReconnection(newSocket);
      });

      newSocket.on('connect_error', (error) => {
        console.error('❌ Socket connection error:', error);
        setIsConnected(false);
        
        // Enhanced error handling for websocket issues
        if (error.message && error.message.includes('WebSocket')) {
          console.log('🔄 WebSocket connection failed, trying polling transport');
          newSocket.io.opts.transports = ['polling'];
          setTimeout(() => newSocket.connect(), 1000);
        }
        
        startReconnection(newSocket);
      });

      newSocket.on('reconnect', (attemptNumber) => {
        setReconnectAttempts(0);
        console.log('🔄 Socket reconnected after', attemptNumber, 'attempts');
        console.log('🔌 New Socket ID:', newSocket.id);
        setIsConnected(true);
        
        // Rejoin room after reconnect
        newSocket.emit('join', user.id);
      });

      newSocket.on('reconnect_error', (error) => {
        console.error('❌ Socket reconnection error:', error);
      });

      newSocket.on('reconnect_failed', () => {
        console.error('❌ Socket reconnection failed');
        setIsConnected(false);
      });

      // Handle ping/pong for healt monitoring
      newSocket.on('ping', (data) => {
        setLastPingTime(Date.now());
        console.log(
          ' Ping received - Connection alive, timestamp:',
          new Date(Date.now()).toLocaleTimeString()
        );
      });

      newSocket.on('pong', (data) => {
        setLastPingTime(Date.now());
        console.log(
          '💗 Pong received - Connection confirmed, timestamp:',
          new Date(Date.now()).toLocaleTimeString()
        );
      });

      // Connection timeout events
      newSocket.on('connect_timeout', () => {
        console.log('⏰ Socket connection timed out');
      });

      newSocket.on('reconnect_error', (error) => {
        console.error('🔄 Reconnection error:', error.message);
      });

      newSocket.on('reconnect_failed', () => {
        console.error('💥 Reconnection failed permanently - forcing reconnect');
        setReconnectAttempts(Infinity);
      });

      // Handle force logout when user is disabled
      newSocket.on('force-logout', (data) => {
        console.log('🚪 Force logout received:', data);
        // Remove token and redirect to login
        localStorage.removeItem('token');
        window.location.href = '/login';
      });

      // Handle admin notifications (disabled user login attempts)
      newSocket.on('admin_notification', (data) => {
        handleAdminNotification(data);
      });

      // Handle task notifications (task assignment, comments, etc.)
      newSocket.on('task_notification', (data) => {
        console.log('📋 Task notification received:', data);
        
        // Show toast notification based on task notification type
        const getNotificationMessage = () => {
          switch(data.type) {
            case 'task_assigned':
              return `📋 New Task: ${data.taskTitle}\n${data.assignedBy} assigned you a ${data.taskPriority} priority task`;
            case 'task_comment':
              return `💬 ${data.commentedBy} commented on: ${data.taskTitle}`;
            case 'task_status_update':
              return `🔄 Task "${data.taskTitle}" status updated to: ${data.newStatus}`;
            default:
              return data.message || 'New task notification';
          }
        };

        const getToastIcon = () => {
          switch(data.type) {
            case 'task_assigned':
              return data.taskPriority === 'high' ? '🔴' : data.taskPriority === 'low' ? '🟢' : '🟡';
            case 'task_comment':
              return '💬';
            case 'task_status_update':
              return '🔄';
            default:
              return '📋';
          }
        };

        toast(getNotificationMessage(), {
          icon: getToastIcon(),
          duration: 5000,
          position: 'top-right',
          style: {
            background: '#f3f4f6',
            color: '#1f2937',
            border: '1px solid #e5e7eb',
            fontSize: '14px',
            padding: '12px 16px',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            whiteSpace: 'pre-line',
            maxWidth: '400px',
          },
        });

        // Play notification sound if user has permission
        try {
          const audio = new Audio('/notification.mp3');
          audio.volume = 0.5;
          audio.play().catch(e => console.log('Audio play failed:', e));
        } catch (e) {
          console.log('Notification sound failed:', e);
        }
      });

      // User online/offline events
      newSocket.on('user-online', (data) => {
        console.log('🟢 User came online:', data.user?.name);
        setOnlineUsers(prev => {
          const exists = prev.find(u => u.userId === data.userId);
          if (exists) {
            return prev.map(u => 
              u.userId === data.userId 
                ? { ...u, isOnline: true, lastSeen: new Date() }
                : u
            );
          }
          return [...prev, { ...data, isOnline: true, lastSeen: new Date() }];
        });
      });

      newSocket.on('user-offline', (data) => {
        console.log('🔴 User went offline:', data.user?.name);
        setOnlineUsers(prev => {
          const exists = prev.find(u => u.userId === data.userId);
          if (exists) {
            return prev.map(u => 
              u.userId === data.userId 
                ? { ...u, isOnline: false, lastSeen: new Date() }
                : u
            );
          }
          return prev;
        });
      });

      // Receive initial online users list
      newSocket.on('online-users', (users) => {
        console.log('👥 Initial online users:', users.map(u => u.user?.name || u.name));
        setOnlineUsers(users.map(user => ({ 
          ...user, 
          isOnline: true, 
          lastSeen: new Date() 
        })));
      });

      setSocket(newSocket);

      // Handle page visibility changes (tab switch, minimize)
      const handleVisibilityChange = () => {
        if (document.hidden) {
          console.log('📱 User left tab - marking as away');
          // Don't disconnect, just let server know user is away
          if (newSocket && newSocket.connected) {
            newSocket.emit('user-away', { userId: user.id });
          }
        } else {
          console.log('📱 User returned to tab - marking as active');
          if (newSocket && newSocket.connected) {
            newSocket.emit('user-active', { userId: user.id });
          }
        }
      };

      // Handle tab/window close
      const handleBeforeUnload = () => {
        console.log('🚪 User closing tab/window - disconnecting immediately');
        if (newSocket && newSocket.connected) {
          newSocket.emit('force-disconnect', { userId: user.id });
          newSocket.disconnect();
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('beforeunload', handleBeforeUnload);

      // Cleanup on unmount
      return () => {
        console.log('🧹 Cleaning up socket connection');
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('beforeunload', handleBeforeUnload);
        stopPingMonitoring();
        stopHeartbeat();
        if (newSocket && newSocket.connected) {
          newSocket.emit('force-disconnect', { userId: user.id });
        }
        newSocket.close();
        setSocket(null);
        setIsConnected(false);
        setOnlineUsers([]);
      };
    } else {
      // Disconnect socket if no user
      if (socket) {
        console.log('🔌 Disconnecting socket - no user');
        socket.close();
        setSocket(null);
        setIsConnected(false);
        setOnlineUsers([]);
      }
    }
  }, [user?.id]);

  // Reconnection logic
  const startReconnection = (newSocket) => {
    console.log('🔄 Starting reconnection logic');
    if (reconnectAttempts < 5) {
      const delay = 1000 * Math.pow(2, reconnectAttempts);
      console.log(`🔄 Reconnecting in ${delay}ms...`);
      
      setTimeout(() => {
        setReconnectAttempts(prev => prev + 1);
        newSocket.connect();
      }, delay);
    } else {
      console.log('💥 Max reconnections reached, manual reconnection forced');
      newSocket.connect();
    }
  };

  // Enhanced ping monitoring system
  let pingInterval;
  let heartbeatInterval;
  
  const startPingMonitoring = (newSocket) => {
    if (pingInterval) {
      clearInterval(pingInterval);
    }

    pingInterval = setInterval(() => {
      const timeSinceLastPing = Date.now() - lastPingTime;
      
      console.log(
        `Time since last ping: ${timeSinceLastPing}ms`
      );

      // Proactively send ping to prevent timeout
      if (newSocket && isConnected && timeSinceLastPing > 45000) {
        console.log("➡️ Proactive ping sent to prevent timeout");
        newSocket.emit('ping', { timestamp: Date.now() });
        setLastPingTime(Date.now());
      }

      //  check with extended timeout
      if (timeSinceLastPing > 180000) { // 3 minutes
        console.log("⚠️ Extended timeout reached - checking connection");
        
        if (newSocket && newSocket.connected && isConnected) {
          console.log("🔧 Connection verified, resetting last ping");
          setLastPingTime(Date.now());
        } else {
          console.log("🔄 Disconnection confirmed, reconnecting...");
          newSocket.connect();
        }
      } else {
        console.log(
          `✅ Socket maintained: ${timeSinceLastPing}ms since last ping`
        );
      }
    }, 25000); // Check every 25 seconds
  };

  const stopPingMonitoring = () => {
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
  };

  // Lightweight 2s heartbeat to keep the socket hot and responsive
  const startHeartbeat = (newSocket) => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
    heartbeatInterval = setInterval(() => {
      if (newSocket && newSocket.connected) {
        newSocket.emit('client-heartbeat', { t: Date.now() });
      }
    }, 2000);
  };

  const stopHeartbeat = () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  };

  // Send message function
  const sendMessage = (receiverId, content, messageType = 'text', isGroupChat = false, attachment = null) => {
    console.log('📤 sendMessage called with:', { 
      receiverId, 
      content, 
      messageType, 
      isGroupChat, 
      attachment,
      socketStatus: { socket: !!socket, isConnected, socketId: socket?.id }
    });
    
    if (socket && isConnected) {
      console.log('📤 Emitting send-message event...');
      
      let messageData;
      
      if (isGroupChat) {
        messageData = {
          sender: user.id,
          groupId: receiverId,
          message: content,
          messageType,
          timestamp: new Date().toISOString()
        };
        socket.emit('send-group-message', messageData);
      } else {
        messageData = {
          sender: user.id,
          receiver: receiverId,
          message: content,
          messageType,
          timestamp: new Date().toISOString()
        };
        socket.emit('send-message', messageData);
      }
      
      console.log('✅ Message sent successfully:', messageData);
      return true;
    } else {
      console.error('❌ Cannot send message: Socket not connected');
      throw new Error('Socket not connected. Please check your connection.');
    }
  };

  // Mark message as read
  const markMessageRead = (messageId, senderId) => {
    if (socket && isConnected) {
      socket.emit('mark-message-read', {
        messageId,
        senderId,
      });
      console.log('📥 Message read marked for:', { messageId, senderId });
    }
  };

  // Typing indicators
  const startTyping = (receiverId) => {
    if (socket && isConnected) {
      socket.emit('typing', { 
        sender: user.id, 
        receiver: receiverId, 
        isTyping: true 
      });
    }
  };

  const stopTyping = (receiverId) => {
    if (socket && isConnected) {
      socket.emit('typing', { 
        sender: user.id, 
        receiver: receiverId, 
        isTyping: false 
      });
    }
  };

  // Check if user is online
  const isUserOnline = (userId) => {
    const onlineUser = onlineUsers.find(u => u.userId === userId);
    return onlineUser ? onlineUser.isOnline : false;
  };

  // Get user status (online/offline + lastSeen)
  const getUserStatus = (userId) => {
    const onlineUser = onlineUsers.find(u => u.userId === userId);
    if (onlineUser) {
      return {
        isOnline: onlineUser.isOnline,
        lastSeen: onlineUser.lastSeen
      };
    }
    return { isOnline: false, lastSeen: null };
  };

  // Join and leave group functionality
  const joinGroup = (groupId) => {
    if (socket && isConnected) {
      socket.emit('join-group', groupId);
      console.log('🏠 Joined group room:', groupId);
    }
  };

  const leaveGroup = (groupId) => {
    if (socket && isConnected) {
      socket.emit('leave-group', groupId);
      console.log('🚪 Left group room:', groupId);
    }
  };

  // Enhanced message listener setup for custom callbacks
  const onReceiveMessage = (callback) => {
    if (socket) {
      socket.off('receive-message');
      socket.on('receive-message', (data) => {
        console.log('🔔 Received message:', data);
        callback(data);
      });
    }
  };

  const onReceiveGroupMessage = (callback) => {
    if (socket) {
      socket.off('receive-group-message');
      socket.on('receive-group-message', (data) => {
        console.log('🔔 Received group message:', data);
        callback(data);
      });
    }
  };

  const onMessageSent = (callback) => {
    if (socket) {
      socket.off('message-sent');
      socket.on('message-sent', (data) => {
        console.log('🔔 Message sent confirmation:', data);
        callback(data);
      });
    }
  };

  // Profile update listener
  const onProfileUpdated = (callback) => {
    if (socket) {
      socket.off('avatar-updated');
      socket.on('avatar-updated', (data) => {
        console.log('👤 Profile updated:', data);
        callback(data);
      });
    }
  };

  const value = {
    socket,
    isConnected,
    onlineUsers,
    notifications,
    sendMessage,
    markMessageRead,
    startTyping,
    stopTyping,
    isUserOnline,
    getUserStatus,
    joinGroup,
    leaveGroup,
    onReceiveMessage,
    onReceiveGroupMessage,
    onMessageSent,
    onProfileUpdated,
    handleActivateUser,
    handleCloseNotification,
    getConnectionStatus: () => ({
      isConnected,
      reconnectAttempts,
      lastPing: new Date(lastPingTime).toLocaleString(),
      socketId: socket?.id,
    })
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export default SocketContext;
