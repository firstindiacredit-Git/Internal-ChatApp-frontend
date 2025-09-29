import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useSocket } from '../contexts/SocketProvider'
import { usersAPI, groupsAPI, messagesAPI, API_ORIGIN } from '../services/api'
import socketService from '../services/socket'
import { toast } from 'react-hot-toast'
import { Link } from 'react-router-dom'
import { 
  Users, 
  MessageSquare, 
  MessageCircle,
  User as UserIcon,
  Clock,
  Bell,
  Settings,
  LogOut,
  Mail,
  Phone,
  Calendar,
  Send,
  Search,
  MoreVertical,
  UserPlus,
  PhoneCall,
  Video,
  Paperclip
} from 'lucide-react'

const UserDashboard = () => {
  const { user, logout } = useAuth()
  const { 
    socket, 
    isConnected, 
    sendMessage: socketSendMessage, 
    joinGroup,
    leaveGroup,
    onReceiveMessage, 
    onReceiveGroupMessage,
    onMessageSent,
    getConnectionStatus 
  } = useSocket()
  
  const [users, setUsers] = useState([])
  const [groups, setGroups] = useState([])
  const [selectedChat, setSelectedChat] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [unreadCounts, setUnreadCounts] = useState({})
  const [lastMessages, setLastMessages] = useState({})
  const messagesEndRef = useRef(null)

  useEffect(() => {
    const loadChatStateFromDB = async () => {
      try {
        console.log('🔄 Loading chat state from database for UserDashboard...');
        const response = await messagesAPI.getChatState();
        const { personalChats, groupChats } = response.data;
        
        // Process personal chats for UserDashboard
        const newUnreadCounts = {};
        const newLastMessages = {};
        
        personalChats.forEach(chat => {
          // Only set unread count if it's greater than 0
          if (chat.unreadCount > 0) {
            newUnreadCounts[chat.chatId] = chat.unreadCount;
          }
          // Always set last message if it exists
          if (chat.lastMessage && chat.lastMessage.message) {
            newLastMessages[chat.chatId] = {
              id: chat.lastMessage._id || chat.lastMessage.id,
              message: chat.lastMessage.message,
              senderName: chat.lastMessage.senderName || chat.lastMessage.sender?.name || 'User',
              senderId: chat.lastMessage.senderId || chat.lastMessage.sender?._id || chat.lastMessage.sender?.id,
              timestamp: chat.lastMessage.createdAt || chat.lastMessage.timestamp
            };
          }
        });
        
        // Process group chats for UserDashboard  
        groupChats.forEach(chat => {
          // Only set unread count if it's greater than 0
          if (chat.unreadCount > 0) {
            newUnreadCounts[chat.chatId] = chat.unreadCount;
          }
          // Always set last message if it exists
          if (chat.lastMessage && chat.lastMessage.message) {
            newLastMessages[chat.chatId] = {
              id: chat.lastMessage._id || chat.lastMessage.id,
              message: chat.lastMessage.message,
              senderName: chat.lastMessage.senderName || chat.lastMessage.sender?.name || 'User',
              senderId: chat.lastMessage.senderId || chat.lastMessage.sender?._id || chat.lastMessage.sender?.id,
              timestamp: chat.lastMessage.createdAt || chat.lastMessage.timestamp
            };
          }
        });
        
        setUnreadCounts(newUnreadCounts);
        setLastMessages(newLastMessages);
        
        console.log('✅ UserDashboard chat state loaded from database:', {
          unreadCounts: newUnreadCounts,
          lastMessages: Object.keys(newLastMessages).length
        });
      } catch (error) {
        console.error('Error loading chat state from database:', error);
      }
    };

    loadChatStateFromDB();
    fetchDashboardData();
    setupSocketListeners();
    
    return () => {
      // Cleanup now handled by SocketProvider context
    }
  }, [])

  useEffect(() => {
    if (selectedChat) {
      fetchMessages()
      // Re-setup socket listeners for the new chat
      setupSocketListeners()
      
      // Join group room if it's a group chat
      if (selectedChat.type === 'group') {
        joinGroup(selectedChat.id)
        console.log('🏠 UserDashboard joined group room for:', selectedChat.name)
      }
    }
    return () => {
      socketService.removeAllListeners()
      // Leave group when component unmounts or chat changes
      if (selectedChat && selectedChat.type === 'group') {
        leaveGroup(selectedChat.id)
        console.log('🚪 UserDashboard left group room for:', selectedChat.name)
      }
      // Clear health check intervals  
      if (socketService.healthCheckInterval) {
        clearInterval(socketService.healthCheckInterval)
        delete socketService.healthCheckInterval
      }
    }
  }, [selectedChat])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Function to refresh chat state from database for UserDashboard
  const refreshChatState = async () => {
    try {
      console.log('🔄 Refreshing UserDashboard chat state from database...');
      const response = await messagesAPI.getChatState();
      const { personalChats, groupChats } = response.data;
      
      // Process personal chats
      const newUnreadCounts = {};
      const newLastMessages = {};
      
      personalChats.forEach(chat => {
        // Only set unread count if it's greater than 0
        if (chat.unreadCount > 0) {
          newUnreadCounts[chat.chatId] = chat.unreadCount;
        }
        // Always set last message if it exists
        if (chat.lastMessage && chat.lastMessage.message) {
          newLastMessages[chat.chatId] = {
            id: chat.lastMessage._id || chat.lastMessage.id,
            message: chat.lastMessage.message,
            senderName: chat.lastMessage.senderName || chat.lastMessage.sender?.name || 'User',
            senderId: chat.lastMessage.senderId || chat.lastMessage.sender?._id || chat.lastMessage.sender?.id,
            timestamp: chat.lastMessage.createdAt || chat.lastMessage.timestamp
          };
        }
      });
      
      // Process group chats  
      groupChats.forEach(chat => {
        // Only set unread count if it's greater than 0
        if (chat.unreadCount > 0) {
          newUnreadCounts[chat.chatId] = chat.unreadCount;
        }
        // Always set last message if it exists
        if (chat.lastMessage && chat.lastMessage.message) {
          newLastMessages[chat.chatId] = {
            id: chat.lastMessage._id || chat.lastMessage.id,
            message: chat.lastMessage.message,
            senderName: chat.lastMessage.senderName || chat.lastMessage.sender?.name || 'User',
            senderId: chat.lastMessage.senderId || chat.lastMessage.sender?._id || chat.lastMessage.sender?.id,
            timestamp: chat.lastMessage.createdAt || chat.lastMessage.timestamp
          };
        }
      });
      
      setUnreadCounts(newUnreadCounts);
      setLastMessages(newLastMessages);
      
      console.log('✅ UserDashboard chat state refreshed from database');
    } catch (error) {
      console.error('Error refreshing UserDashboard chat state:', error);
    }
  };


  // Add socket test methods to global window for debugging
  useEffect(() => {
    window.testSocketDashboard = () => {
      socketService.testConnection();
    };
    window.checkSocketDashboard = () => {
      socketService.logConnectionStatus();
    };
    window.forceSocketConnectDashboard = () => {
      socketService.forceConnectionTest();
    };
    console.log("🔧 UserDashboard Socket debugging methods available:");
    console.log(" - testSocketDashboard() - Test socket connection status");
    console.log(" - checkSocketDashboard() - Show current socket status");
    console.log(" - forceSocketConnectDashboard() - Force reconnection");
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      
      const [usersRes, groupsRes] = await Promise.all([
        usersAPI.getActiveUsers(),
        groupsAPI.getMyGroups()
      ])

      setUsers(usersRes.data.filter(u => u.id !== user.id))
      setGroups(groupsRes.data)
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const setupSocketListeners = () => {
    console.log("🔧 Setting up enhanced UserDashboard socket listeners with Context API...");
    
    // Get connection status for debugging
    const connectionStatus = getConnectionStatus()
    console.log("🔗 Current socket status:", connectionStatus);
    
    // Enhanced message reception with improved filtering
    onReceiveMessage((data) => {
      console.log("🔔 USERDASHBOARD CONTEXT - received message:", data);
      
      // Comprehensive sender identification
      const senderId = typeof data.sender === 'object' ? data.sender.id || data.sender._id : data.sender
      const receiverId = typeof data.receiver === 'object' ? data.receiver.id || data.receiver._id : data.receiver
      const messageId = data.id || data._id || data.messageId
      const messageText = data.message || data.content
      
      // Check if message is from current user (avoid duplicate display)
      const isCurrentUserSender = 
        senderId === user.id || 
        senderId === user._id || 
        senderId === user.id?.toString() || 
        senderId === user._id?.toString()

      // Skip confirmation messages
      if (data._isConfirmation || data.isConfirmMessage || data.isMessageSentConfirmation) {
        console.log("🔄 Skipping confirmation message");
        return;
      }

      // Enhanced chat relevance check with better logic
      const isForCurrentChat = isMessageForCurrentChat(data, selectedChat, user);
      
      console.log("📨 ENHANCED USERDASHBOARD MESSAGE FILTERING:", {
        senderId,
        receiverId, 
        messageId,
        messageText,
        selectedChatId: selectedChat?.id,
        selectedChatType: selectedChat?.type,
        currentUserId: user.id,
        isCurrentUserSender,
        isForCurrentChat,
        messageData: data
      });
      
      if (isForCurrentChat && selectedChat) {
        console.log("📨 Processing message for current active dashboard chat");
        
        // Only add messages NOT from current user (to avoid duplicate from optimistic updates)
        if (!isCurrentUserSender) {
          console.log("📨 Adding external message to current dashboard chat immediately");
          
          setMessages(prev => {
            // Enhanced comprehensive duplicate check for UserDashboard
            const exists = prev.some(existingMsg => {
              const existingId = existingMsg.id || existingMsg._id || existingMsg.messageId;
              const existingMessage = existingMsg.message || existingMsg.content;
              const existingSender = existingMsg.sender?.id || existingMsg.sender?._id || existingMsg.sender;
              const existingTimestamp = existingMsg.createdAt || existingMsg.timestamp;
              const newTimestamp = data.createdAt || data.timestamp;
              
              // Multiple duplicate detection logic
              // 1. Check by message ID
              if (existingId === messageId && messageId) return true;
              
              // 2. Check by message content + sender + recent timestamp
              if (existingMessage === messageText && 
                  String(existingSender) === String(senderId) &&
                  newTimestamp && existingTimestamp) {
                // Check if timestamps are within 5 seconds (same message sent quickly)
                const timeDifference = Math.abs(new Date(newTimestamp) - new Date(existingTimestamp));
                if (timeDifference < 5000) return true; // 5 second tolerance
              }
              
              // 3. Check optimistic message by temporary ID and content
              if (existingMsg.isOptimistic && existingMessage === messageText && 
                  String(existingSender) === String(senderId)) {
                if (newTimestamp && existingTimestamp) {
                  const timeDifference = Math.abs(new Date(newTimestamp) - new Date(existingTimestamp));
                  if (timeDifference < 10000) return true; // 10 second tolerance for optimistic
                }
              }
              
              return false;
            });
            
            if (exists) {
              console.log("🔄 UserDashboard enhanced detection: Message already exists - confirmed duplicate", {
                messageId,
                messageText: messageText?.substring(0, 20),
                senderId,
                isDuplicate: true
              });
              return prev;
            }
            
            console.log("✅ REAL-TIME USERDASHBOARD: NEW message confirmed - Adding to active chat", {
              messageId,
              messageText: messageText?.substring(0, 20),
              senderId,
              isDuplicate: false
            });
            const newMessage = createMessageObject(data, senderId);
            
            // Update last message for chat list
            updateLastMessage(selectedChat.id, data, senderId);
            
            // Refresh chat state from database to update any fresh counts
            setTimeout(() => {
              refreshChatState();
            }, 100);
            
            return [...prev, newMessage];
          });
        } else {
          console.log("📨 Message from current user - handled by optimistic updates");
        }
      } else if (messageText && !isCurrentUserSender) {
        // Message for different chat - increment unread count 
        const relevantSender = senderId || data.sender;
        if (relevantSender && relevantSender !== user.id) {
          console.log("📬 Incrementing unread count for dashboard chat:", relevantSender);
          setUnreadCounts(prev => ({
          ...prev,
            [relevantSender]: (prev[relevantSender] || 0) + 1
          }));
          
          // Update last message for that chat
          updateLastMessage(relevantSender, data, senderId);
          
          // Refresh chat state from database to keep counts updated
          setTimeout(() => {
            refreshChatState();
          }, 100);
        }
      }
    });
    
    // Message sent confirmation
    onMessageSent((data) => {
      console.log("🔄 Dashboard message sent confirmation received:", data);
      // Handle confirmation logic if needed
    });
    
    // Group message reception
    onReceiveGroupMessage((data) => {
      console.log("🔔 USERDASHBOARD GROUP MESSAGE CONTEXT - received message:", data);
      
      // Comprehensive sender identification for group messages
      const senderId = typeof data.sender === 'object' ? data.sender.id || data.sender._id : data.sender
      const groupId = data.groupId || data.group?.id || data.group?._id
      const messageId = data.id || data._id || data.messageId
      const messageText = data.message || data.content
      
      // Check if message is from current user (avoid duplicate display)
      const isCurrentUserSender = 
        senderId === user.id || 
        senderId === user._id || 
        senderId === user.id?.toString() || 
        senderId === user._id?.toString()

      // Skip confirmation messages
      if (data._isConfirmation || data.isConfirmMessage || data.isMessageSentConfirmation) {
        console.log("🔄 Skipping confirmation message");
        return;
      }

      // Check if message is for current group chat
      const isForCurrentGroup = selectedChat && 
        selectedChat.type === 'group' && 
        (groupId === selectedChat.id || 
         String(groupId) === String(selectedChat.id))
      
      console.log("📨 USERDASHBOARD GROUP MESSAGE FILTERING:", {
        senderId,
        groupId, 
        messageId,
        messageText,
        selectedChatId: selectedChat?.id,
        selectedChatType: selectedChat?.type,
        currentUserId: user.id,
        isCurrentUserSender,
        isForCurrentGroup,
        messageData: data
      });
      
      if (isForCurrentGroup && selectedChat) {
        console.log("📨 Processing group message for current UserDashboard group");
        
        if (!isCurrentUserSender) {
          console.log("📨 Adding external group message to current dashboard chat immediately");
          
          setMessages(prev => {
            // Enhanced comprehensive duplicate check for group messages
            const exists = prev.some(existingMsg => {
              const existingId = existingMsg.id || existingMsg._id || existingMsg.messageId;
              const existingMessage = existingMsg.message || existingMsg.content;
              const existingSender = existingMsg.sender?.id || existingMsg.sender?._id || existingMsg.sender;
              const existingTimestamp = existingMsg.createdAt || existingMsg.timestamp;
              const newTimestamp = data.createdAt || data.timestamp;
              
              if (existingId === messageId && messageId) return true;
              
              if (existingMessage === messageText && 
                  String(existingSender) === String(senderId) &&
                  newTimestamp && existingTimestamp) {
                const timeDifference = Math.abs(new Date(newTimestamp) - new Date(existingTimestamp));
                if (timeDifference < 5000) return true;
              }
              
              if (existingMsg.isOptimistic && existingMessage === messageText && 
                  String(existingSender) === String(senderId)) {
                if (newTimestamp && existingTimestamp) {
                  const timeDifference = Math.abs(new Date(newTimestamp) - new Date(existingTimestamp));
                  if (timeDifference < 10000) return true;
                }
              }
              
              return false;
            });
            
            if (exists) {
              console.log("🔄 USERDASHBOARD GROUP duplicate detection: Message already exists", {
                messageId,
                messageText: messageText?.substring(0, 20),
                senderId: senderId?.toString(),
                isDuplicate: true
              });
              return prev;
            }
            
            console.log("✅ USERDASHBOARD GROUP REAL-TIME: NEW message confirmed - Adding to active group", {
              messageId,
              messageText: messageText?.substring(0, 20),
              senderId,
              groupId
            });
            
            const newMessage = createMessageObject(data, senderId);
            
            // Update last message for group chat list
            updateLastMessage(selectedChat.id, data, senderId);
            
            // Refresh chat state from database to update any fresh counts
            setTimeout(() => {
              refreshChatState();
            }, 100);
            
            return [...prev, newMessage];
          });
        } else {
          console.log("📨 Group message from current user - handled by optimistic updates");
        }
      } else if (messageText && !isCurrentUserSender) {
        // Group message for different chat - increment unread count 
        const relevantGroupId = groupId || data.groupId;
        if (relevantGroupId) {
          const isForDifferentGroup = !selectedChat || 
            selectedChat.type !== 'group' || 
            String(relevantGroupId) !== String(selectedChat.id);
            
          if (isForDifferentGroup) {
            console.log("📬 UserDashboard incrementing unread count for group:", relevantGroupId);
            setUnreadCounts(prev => ({
              ...prev,
              [relevantGroupId]: (prev[relevantGroupId] || 0) + 1
            }));
            
            // Update last message for that group chat
            updateLastMessage(relevantGroupId, data, senderId);
            
            // Refresh chat state from database to keep counts updated
            setTimeout(() => {
              refreshChatState();
            }, 100);
          }
        }
      }
    });
  }

  // Enhanced helper to determine if message is for current chat
  const isMessageForCurrentChat = (messageData, currentChat, currentUser) => {
    if (!currentChat) return false;
    
    // Extract message participants
    const msgSender = messageData.sender?.id || messageData.sender?._id || messageData.sender;
    const msgReceiver = messageData.receiver?.id || messageData.receiver?._id || messageData.receiver;
    const msgChatId = messageData.chatId || messageData.chatRoom;
    
    // Direct chat matching  
    if (currentChat.type === 'personal' && currentChat.id) {
      // Message between current user and selected chat
      const chatMatches = 
        (msgSender === currentChat.id && msgReceiver === currentUser.id) ||
        (msgSender === currentUser.id && msgReceiver === currentChat.id) ||
        (String(msgSender) === String(currentChat.id)) ||
        (String(msgReceiver) === String(currentChat.id));
        
      if (chatMatches) return true;
    }
    
    // Group chat matching
    if (currentChat.type === 'group') {
      return msgChatId === currentChat.id || 
             messageData.groupId === currentChat.id;
    }
    
    return false;
  };

  // Create consistent message object structure for UserDashboard
  const createMessageObject = (data, senderId) => {
    return {
      id: data.id || data._id || data.messageId,
      message: data.message || data.content,
      sender: typeof data.sender === 'object' ? data.sender : {
        id: senderId,
        name: data.senderName || data.sender?.name || 'User',
        profileImage: data.senderProfileImage || data.sender?.profileImage
      },
      createdAt: data.createdAt || data.timestamp || new Date().toISOString(),
      timestamp: data.timestamp || data.createdAt,
      isFromOtherUser: !(senderId === user.id || senderId === user._id)
    };
  };

  // Update last message in chat list for UserDashboard
  const updateLastMessage = (chatId, messageData, senderId) => {
    const isCurrentUserSender = senderId === user.id || senderId === user._id;
    setLastMessages(prev => ({
      ...prev,
      [chatId]: {
        id: messageData.id || messageData._id || messageData.messageId,
        message: messageData.message || messageData.content,
        senderName: isCurrentUserSender ? 'You' : (messageData.senderName || messageData.sender?.name || 'User'),
        senderId: senderId,
        timestamp: messageData.createdAt || messageData.timestamp || new Date().toISOString()
      }
    }));
  };

  const fetchMessages = async () => {
    try {
      let response
      if (selectedChat.type === 'personal') {
        if (!selectedChat.id) {
          console.error('User ID is undefined for personal chat')
          return
        }
        response = await messagesAPI.getPersonalMessages(selectedChat.id)
      } else {
        if (!selectedChat.id) {
          console.error('Group ID is undefined for group chat')
          return
        }
        response = await messagesAPI.getGroupMessages(selectedChat.id)
      }
      
      const messagesData = response.data;
      setMessages(messagesData);
      
      // Update last message for the selected chat
      if (messagesData.length > 0) {
        const lastMsg = messagesData[messagesData.length - 1];
        updateLastMessage(selectedChat.id, lastMsg, lastMsg.sender?.id || lastMsg.sender);
      }
    } catch (error) {
      console.error('Error fetching messages:', error)
      toast.error('Failed to load messages')
    }
  }

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim() || !selectedChat) return

    // Check if trying to send message to disabled user
    if (selectedChat.type === 'personal' && selectedChat.isActive === false) {
      toast.error('Cannot send messages to disabled users')
      return;
    }

    const messageText = newMessage.trim()
    setNewMessage('') // Clear input immediately for better UX

    try {
      // Create optimistic message for immediate display
      const optimisticMessage = {
        id: Date.now(), // Temporary ID
        message: messageText,
        sender: {
          id: user.id,
          name: user.name,
          profileImage: user.profileImage
        },
        createdAt: new Date().toISOString(),
        timestamp: new Date().toISOString(),
        isOptimistic: true
      }

      // Add message immediately to UI for instant feedback
      setMessages(prev => [...prev, optimisticMessage])

      // Update last message immediately for send message
      updateLastMessage(selectedChat.id, {
        id: optimisticMessage.id,
        message: optimisticMessage.message,
        createdAt: optimisticMessage.createdAt
      }, user.id);

      // Use context socket to send message
      if (selectedChat.type === 'personal') {
        // Use context socket method for personal messages
        try {
          await socketSendMessage(
            selectedChat.id, 
            messageText, 
            'text', 
            false
          );
          console.log('✅ Dashboard message sent via context socket');
        } catch (contextError) {
          console.warn('Context socket failed, trying API:', contextError);
          // Fallback to API call
          await messagesAPI.sendPersonalMessage({
            sender: user.id,
            receiver: selectedChat.id,
            message: messageText,
            timestamp: new Date().toISOString()
          });
        }
      } else {
        // Group message via context
        try {
          await socketSendMessage(
            selectedChat.id, 
            messageText, 
            'text', 
            true // isGroupChat
          );
          console.log('✅ Dashboard group message sent via context socket');
        } catch (contextError) {
          console.warn('Context group socket failed, trying API:', contextError);
          // Fallback to API call
          await messagesAPI.sendGroupMessage({
            sender: user.id,
            group: selectedChat.id,
            message: messageText,
            timestamp: new Date().toISOString()
          });
        }
      }

      console.log('✅ Dashboard message sent successfully')
    } catch (error) {
      console.error('❌ Failed to send dashboard message:', error)
      toast.error('Failed to send message')
      // Remove optimistic message on error
      setMessages(prev => prev.filter(msg => !msg.isOptimistic))
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleLogout = () => {
    logout()
    toast.success('Logged out successfully')
  }

  // Combine users and groups for unified display
  const allChats = [
    ...users.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      type: 'personal',
      avatar: user.name.charAt(0).toUpperCase(),
      profileImage: user.profileImage,
      lastMessage: lastMessages[user.id] || null,
      isActive: user.isActive
    })),
    ...groups.map(group => ({
      id: group.id,
      name: group.name,
      email: `${group.members?.length || 0} members`,
      type: 'group',
      avatar: 'G',
      lastMessage: lastMessages[group.id] || null
    }))
  ]

  const filteredChats = allChats.filter(chat => 
    chat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    chat.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-gray-50 flex">
      {/* WhatsApp-style Main Container */}
      <div className="w-full h-screen flex bg-white shadow-lg">
        
        {/* Left Sidebar - Chat List */}
        <div className="w-1/3 min-w-[300px] max-w-[400px] bg-white border-r border-gray-200 flex flex-col">
          
          {/* Header with User Profile */}
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">WhatsApp Chat</h2>
              <div className="flex items-center space-x-2">
                <Link to="/profile" className="text-gray-500 hover:text-gray-700">
                  <Settings className="w-5 h-5" />
                </Link>
                <button
                  onClick={handleLogout}
                  className="p-1 text-gray-500 hover:text-gray-700"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* User Profile Section */}
            <div className="flex items-center space-x-3 mb-3">
              <Link to="/profile" className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
                {user.profileImage ? (
                  <img
                    src={`${API_ORIGIN}${user.profileImage}`}
                    alt="Profile"
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-medium">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <h3 className="font-medium text-gray-900">{user.name}</h3>
                  <p className="text-xs text-green-600">Online</p>
                </div>
              </Link>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search or start new chat"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>
          </div>

          {/* Chat List */}
          <div className="flex-1 overflow-y-auto">
            {filteredChats.map((chat) => (
              <div
                key={`${chat.type}-${chat.id}`}
                onClick={() => {
                  console.log('Selecting chat:', chat)
                  setSelectedChat({ 
                    type: chat.type, 
                    id: chat.id, 
                    name: chat.name,
                    profileImage: chat.profileImage,
                    isActive: chat.isActive !== false // Add disabled flag for reference
                  })
                  // Clear unread count when entering this chat
                  if (unreadCounts[chat.id]) {
                    setUnreadCounts(prev => {
                      const newCounts = { ...prev }
                      delete newCounts[chat.id]
                      return newCounts
                    });
                    
                    // Update backend database to clear unread count
                    messagesAPI.updateChatState({
                      chatId: chat.id,
                      chatType: chat.type,
                      action: 'clear_unread'
                    }).catch(error => {
                      console.error('Error clearing unread count:', error);
                    });
                  }
                }}
                className={`p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 ${
                  selectedChat?.id === chat.id && selectedChat?.type === chat.type
                    ? 'bg-green-50' 
                    : ''
                } ${
                  chat.type === 'personal' && chat.isActive === false 
                    ? 'opacity-60 bg-red-50 border-l-4 border-red-300' 
                    : ''
                }`}
                title={chat.type === 'personal' && chat.isActive === false ? 'Disabled User' : ''}
              >
                <div className="flex items-center space-x-3">
                  
                  {/* Profile Picture */}
                  <div className="relative">
                    <div className={`w-12 h-12 rounded-full overflow-hidden ${
                      chat.type === 'personal' && chat.isActive === false ? 'bg-gray-300' : 'bg-gray-200'
                    }`}>
                      {chat.type === 'personal' ? (
                        chat.profileImage ? (
                          <img
                            src={`${API_ORIGIN}${chat.profileImage}`}
                            alt={chat.name}
                            className={`w-full h-full object-cover ${
                              chat.isActive === false ? 'grayscale opacity-70' : ''
                            }`}
                          />
                        ) : (
                          <div className={`w-full h-full ${
                            chat.isActive === false ? 'bg-gray-400' : 'bg-green-500'
                          } flex items-center justify-center`}>
                            <span className="text-white font-semibold text-lg">
                              {chat.avatar}
                            </span>
                          </div>
                        )
                      ) : (
                        <div className="w-full h-full bg-green-500 flex items-center justify-center">
                          <Users className="w-6 h-6 text-white" />
                        </div>
                      )}
                    </div>
                    {/* Online indicator for personal chats - only for active users */}
                    {chat.type === 'personal' && chat.isActive !== false && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-white"></div>
                    )}
                    {/* Disabled indicator for disabled users */}
                    {chat.type === 'personal' && chat.isActive === false && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
                        <span className="text-white text-xs font-bold">×</span>
                      </div>
                    )}
                  </div>

                  {/* Chat Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className={`truncate ${
                        chat.type === 'personal' && chat.isActive === false 
                          ? 'font-medium text-red-700 line-through' 
                          : 'font-medium text-gray-900'
                      }`}>
                        {chat.name}
                        {chat.type === 'personal' && chat.isActive === false && (
                          <span className="ml-2 text-xs text-red-500">(Disabled)</span>
                        )}
                      </h3>
                      <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">12:30</span>
                        {/* Unread count badge */}
                        {unreadCounts[chat.id] && unreadCounts[chat.id] > 0 && (
                          <div className="bg-green-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                            {unreadCounts[chat.id] > 99 ? '99+' : unreadCounts[chat.id]}
                          </div>
                        )}
                      </div>
                    </div>
                    <p className={`text-sm truncate ${
                      chat.type === 'personal' && chat.isActive === false 
                        ? 'text-red-400' 
                        : 'text-gray-500'
                    }`}>
                      {chat.type === 'personal' && chat.isActive === false
                        ? 'User is disabled - cannot send new messages'
                        : chat.lastMessage && chat.lastMessage.message
                          ? `${chat.lastMessage.senderName || 'You'}: ${chat.lastMessage.message}` 
                          : 'No messages yet'
                      }
                    </p>
                  </div>
                </div>
              </div>
            ))}
            
            {filteredChats.length === 0 && (
              <div className="text-center py-8">
                <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">
                  {searchTerm ? 'No chats found.' : 'No chats available.'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Side - Chat Area */}
        <div className="flex-1 flex flex-col">
          {selectedChat ? (
            <>
              {/* Chat Header */}
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200">
                    {selectedChat.type === 'personal' ? (
                      selectedChat.profileImage ? (
                        <img
                          src={`${API_ORIGIN}${selectedChat.profileImage}`}
                          alt={selectedChat.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-green-500 flex items-center justify-center">
                          <span className="text-white font-semibold">
                            {selectedChat.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )
                    ) : (
                      <div className="w-full h-full bg-green-500 flex items-center justify-center">
                        <Users className="w-5 h-5 text-white" />
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className={`font-semibold ${
                      selectedChat.type === 'personal' && selectedChat.isActive === false ? 'text-red-700' : 'text-gray-900'
                    }`}>
                      {selectedChat.name}
                      {selectedChat.type === 'personal' && selectedChat.isActive === false && (
                        <span className="ml-2 text-xs text-red-500">(Disabled)</span>
                      )}
                    </h3>
                    <p className={`text-xs ${
                      selectedChat.type === 'personal' && selectedChat.isActive === false ? 'text-red-400' : 'text-gray-500'
                    }`}>
                      {selectedChat.type === 'personal' 
                        ? (selectedChat.isActive === false 
                          ? 'User is disabled - viewing mode only' 
                          : 'last seen today at 10:30 AM') 
                        : `${selectedChat.email}`
                      }
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <PhoneCall className="w-5 h-5 text-gray-600 cursor-pointer hover:text-gray-800" />
                  <Video className="w-5 h-5 text-gray-600 cursor-pointer hover:text-gray-800" />
                  <MoreVertical className="w-5 h-5 text-gray-600 cursor-pointer hover:text-gray-800" />
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 bg-gray-50 relative">
                <div className="max-w-4xl mx-auto">
                  {messages.map((message, index) => {
                    // More robust user checking logic to handle both string IDs and object references
                    let isCurrentUser = false
                    
                    // Handle different cases of sender identification
                    if (typeof message.sender === 'object' && message.sender !== null) {
                      // If sender is populated as an object, check various ID fields
                      const senderId = message.sender._id || message.sender.id
                      isCurrentUser = (senderId === user.id || senderId === user._id || senderId === user.id?.toString() || senderId === user._id?.toString())
                    } else {
                      // If sender is just an ID string
                      isCurrentUser = (message.sender === user.id || message.sender === user._id || message.sender === user.id?.toString() || message.sender === user._id?.toString())
                    }
                    
                    const senderName = typeof message.sender === 'object' ? message.sender?.name : 'User'
                    const senderProfileImage = typeof message.sender === 'object' ? message.sender?.profileImage : null
                    
                    return (
                      <div
                        key={message.id || message._id || index}
                        className={`flex ${
                          isCurrentUser ? 'justify-end' : 'justify-start'
                        } mb-4`}
                      >
                        <div className={`flex items-start gap-2 max-w-sm lg:max-w-md ${
                          isCurrentUser ? 'flex-row-reverse' : 'flex-row'
                        }`}>
                          
                          {/* Avatar */}
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-300 flex-shrink-0">
                            {isCurrentUser ? (
                              // Current user avatar (always on the right)
                              user.profileImage ? (
                                <img
                                  src={`${API_ORIGIN}${user.profileImage}`}
                                  alt={user.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-green-500 flex items-center justify-center">
                                  <span className="text-white text-xs font-medium">
                                    {user.name.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                              )
                            ) : (
                              // Other user avatar (always on the left)
                              senderProfileImage ? (
                                <img
                                  src={`${API_ORIGIN}${senderProfileImage}`}
                                  alt={senderName}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-gray-400 flex items-center justify-center">
                                  <span className="text-white text-xs font-medium">
                                    {String(senderName).charAt(0).toUpperCase()}
                                  </span>
                                </div>
                              )
                              )}
                            </div>

                          {/* Message Bubble */}
                          <div
                            className={`flex flex-col px-3 py-2 rounded-lg ${
                              isCurrentUser
                                ? 'bg-green-500 text-white rounded-br-none'
                                : 'bg-gray-200 text-gray-900 rounded-bl-none'
                            }`}
                          >
                            <p className="text-sm mb-1 break-words">{message.message}</p>
                            <p className={`text-xs self-end ${
                              isCurrentUser ? 'text-green-100' : 'text-gray-500'
                            }`}>
                              {new Date(message.createdAt || message.timestamp).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Message Input */}
              <div className="bg-white border-t border-gray-200 p-4">
                {selectedChat.type === 'personal' && selectedChat.isActive === false ? (
                  <div className="flex items-center justify-center">
                    <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 w-full text-center">
                      <p className="text-red-600 text-sm font-medium">
                        This user is disabled. You can view previous messages but cannot send new ones.
                      </p>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={sendMessage} className="flex items-center space-x-3">
                    <button
                      type="button"
                      className="p-2 text-gray-500 hover:text-gray-700"
                    >
                      <Paperclip className="w-5 h-5" />
                    </button>
                    
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message"
                        className="w-full py-2 px-4 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                      />
                    </div>
                    
                    <button
                      type="submit"
                      disabled={!newMessage.trim()}
                      className="bg-green-500 text-white p-2 rounded-full hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </form>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-600 mb-2">
                  Welcome to WhatsApp Chat
                </h3>
                <p className="text-gray-500 max-w-md">
                  Select a conversation from the sidebar to start messaging. 
                  Your conversations will appear on the left side.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default UserDashboard