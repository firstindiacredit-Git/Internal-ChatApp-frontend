import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useSocket } from '../contexts/SocketProvider'
import { usersAPI, groupsAPI, messagesAPI, callsAPI, groupCallsAPI, API_ORIGIN } from '../services/api'
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
  File,
  Download,
  Image as ImageIcon,
  Video,
  Search,
  MoreVertical,
  UserPlus,
  PhoneCall,
  Paperclip,
  ChevronDown,
  Copy,
  Edit,
  Forward,
  ZoomIn,
  ZoomOut,
  RotateCcw
} from 'lucide-react'
import WebRTCAudioCall from '../components/WebRTCAudioCall'
import WebRTCCall from '../components/WebRTCCall'
import GroupCallUI from '../components/GroupCallUI'

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
    getConnectionStatus,
    isUserOnline,
    getUserStatus
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
  const [activeFilter, setActiveFilter] = useState('all') // 'all', 'unread', 'groups'
  const [hasMoreMessages, setHasMoreMessages] = useState(false) // For pagination
  const [loadingMore, setLoadingMore] = useState(false) // Loading older messages
  const messageLimit = 50 // Messages per page
  const [selectedFile, setSelectedFile] = useState(null)
  const [filePreview, setFilePreview] = useState(null)
  const [showFileOptions, setShowFileOptions] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState({})
  const [downloadedMap, setDownloadedMap] = useState(() => {
    try {
      const raw = sessionStorage.getItem('downloadedMessages')
      return raw ? JSON.parse(raw) : {}
    } catch {
      return {}
    }
  })

  // Call UI state
  const [showCallUI, setShowCallUI] = useState(false)
  const [callData, setCallData] = useState(null)
  const [isIncomingCall, setIsIncomingCall] = useState(false)
  const [avatarPopup, setAvatarPopup] = useState(null) // For avatar popup
  const [imagePreview, setImagePreview] = useState(null) // For image preview modal
  const [videoPreview, setVideoPreview] = useState(null) // For video preview modal
  const [documentPreview, setDocumentPreview] = useState(null) // For document preview modal
  const [imageZoom, setImageZoom] = useState(1) // For image zoom level
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 }) // For image pan position
  const [isDragging, setIsDragging] = useState(false) // For drag state

  // Image zoom functions
  const handleZoomIn = () => {
    setImageZoom(prev => {
      const newZoom = Math.min(prev * 1.25, 4) // Max zoom 4x
      return newZoom
    })
  }

  const handleZoomOut = () => {
    setImageZoom(prev => {
      const newZoom = Math.max(prev / 1.25, 0.5) // Min zoom 0.5x
      return newZoom
    })
  }

  const handleResetZoom = () => {
    setImageZoom(1)
    setImagePosition({ x: 0, y: 0 })
  }


  const handleMouseDown = (e) => {
    e.preventDefault()
    setIsDragging(true)
    setImagePosition({
      x: e.clientX - imagePosition.x,
      y: e.clientY - imagePosition.y
    })
  }

  const handleMouseMove = (e) => {
    if (isDragging) {
      e.preventDefault()
      setImagePosition({
        x: e.clientX - imagePosition.x,
        y: e.clientY - imagePosition.y
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  // Reset zoom when image changes
  const openImagePreview = (imageData) => {
    setImagePreview(imageData)
    setImageZoom(1)
    setImagePosition({ x: 0, y: 0 })
  }

  // Group call UI state
  const [showGroupCallUI, setShowGroupCallUI] = useState(false)
  const [groupCallData, setGroupCallData] = useState(null)
  const [isIncomingGroupCall, setIsIncomingGroupCall] = useState(false)

  const resolveUrl = (url) => {
    if (!url) return url
    return /^https?:\/\//i.test(url) ? url : `${API_ORIGIN}${url}`
  }

  // WhatsApp-style date formatting
  const formatChatDate = (timestamp) => {
    if (!timestamp) return ''
    
    const messageDate = new Date(timestamp)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const messageDay = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate())
    
    // Check if message is from today
    if (messageDay.getTime() === today.getTime()) {
      return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    
    // Check if message is from yesterday
    if (messageDay.getTime() === yesterday.getTime()) {
      return 'Yesterday'
    }
    
    // Check if message is from this week (last 7 days)
    const daysDiff = Math.floor((today - messageDay) / (1000 * 60 * 60 * 24))
    if (daysDiff < 7) {
      return messageDate.toLocaleDateString([], { weekday: 'short' })
    }
    
    // For older messages, show date
    return messageDate.toLocaleDateString([], { day: 'numeric', month: 'numeric', year: messageDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined })
  }

  // Format date for message separators
  const formatMessageDate = (timestamp) => {
    if (!timestamp) return ''
    
    const messageDate = new Date(timestamp)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const messageDay = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate())
    
    // Check if message is from today
    if (messageDay.getTime() === today.getTime()) {
      return 'Today'
    }
    
    // Check if message is from yesterday
    if (messageDay.getTime() === yesterday.getTime()) {
      return 'Yesterday'
    }
    
    // Check if message is from this week (last 7 days)
    const daysDiff = Math.floor((today - messageDay) / (1000 * 60 * 60 * 24))
    if (daysDiff < 7) {
      return messageDate.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
    }
    
    // For older messages, show full date
    return messageDate.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric', year: messageDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined })
  }

  // Format last seen time (WhatsApp style)
  const formatLastSeen = (lastSeen) => {
    if (!lastSeen) return 'Last seen recently'
    
    const now = new Date()
    const lastSeenDate = new Date(lastSeen)
    const diffMs = now - lastSeenDate
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffMins < 1) return 'Last seen just now'
    if (diffMins < 60) return `Last seen ${diffMins} minute${diffMins === 1 ? '' : 's'} ago`
    if (diffHours < 24) return `Last seen ${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
    if (diffDays === 1) return 'Last seen yesterday'
    if (diffDays < 7) return `Last seen ${diffDays} day${diffDays === 1 ? '' : 's'} ago`
    
    // For older, show date
    return `Last seen ${lastSeenDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}`
  }

  // Long-press actions
  const [pressTimer, setPressTimer] = useState(null)
  const [showActions, setShowActions] = useState(false)
  const [selectedMessage, setSelectedMessage] = useState(null)
  const [editingMessage, setEditingMessage] = useState(null)
  const [editText, setEditText] = useState('')
  const [messageDropdown, setMessageDropdown] = useState(null) // Track which message dropdown is open
  const getMessageId = (m) => (m?.id || m?._id || m?.messageId || '').toString()

  const startLongPress = (message) => {
    if (pressTimer) clearTimeout(pressTimer)
    const timer = setTimeout(() => {
      setSelectedMessage(message)
      setShowActions(true)
    }, 700)
    setPressTimer(timer)
  }
  const cancelLongPress = () => {
    if (pressTimer) {
      clearTimeout(pressTimer)
      setPressTimer(null)
    }
  }
  // Dropdown menu handlers
  const handleDropdownToggle = (messageId, event) => {
    event.stopPropagation()
    setMessageDropdown(messageDropdown === messageId ? null : messageId)
  }

  const handleDropdownAction = (action, message) => {
    setSelectedMessage(message)
    setMessageDropdown(null) // Close dropdown
    
    switch (action) {
      case 'copy':
        handleCopyMessage(message)
        break
      case 'edit':
        handleEditMessage(message)
        break
      case 'forward':
        handleForwardMessage(message)
        break
    }
  }

  const handleCopyMessage = async (message) => {
    try {
      const toCopy = message?.messageType === 'text'
        ? (message?.message || '')
        : (resolveUrl(message?.fileUrl) || message?.fileName || '')
      if (toCopy) {
        await navigator.clipboard.writeText(toCopy)
        toast.success('Copied to clipboard')
      }
    } catch (error) {
      console.error('Copy failed:', error)
      toast.error('Failed to copy')
    }
  }

  const handleForwardMessage = (message) => {
    try { 
      sessionStorage.setItem('forwardMessage', JSON.stringify({
        id: message.id || message._id,
        message: message.message,
        messageType: message.messageType,
        fileUrl: message.fileUrl,
        fileName: message.fileName,
        fileSize: message.fileSize,
        fileType: message.fileType,
      })) 
      toast.success('Message ready to forward')
      window.location.href = '/forward'
    } catch (error) {
      console.error('Forward setup failed:', error)
      toast.error('Failed to prepare message for forwarding')
    }
  }

  const handleEditMessage = (message) => {
    if (message && message.messageType === 'text') {
      // Check if current user is the sender of this message
      const senderId = message.sender?.id || message.sender?._id || message.sender
      const isCurrentUserMessage = senderId === user.id || senderId === user._id || senderId === user.id?.toString() || senderId === user._id?.toString()
      
      if (isCurrentUserMessage) {
        setEditingMessage(message)
        setEditText(message.message || '')
      } else {
        toast.error('You can only edit your own messages')
      }
    }
  }

  // Legacy handlers for long press (keeping for backward compatibility)
  const handleCopySelected = async () => {
    if (selectedMessage) {
      await handleCopyMessage(selectedMessage)
    }
    setShowActions(false)
  }
  const handleForwardSelected = () => {
    if (selectedMessage) {
      handleForwardMessage(selectedMessage)
    }
    setShowActions(false)
  }
  const handleEditSelected = () => {
    if (selectedMessage) {
      handleEditMessage(selectedMessage)
    }
    setShowActions(false)
  }
  const handleSaveEdit = async () => {
    if (!editingMessage || !editText.trim()) return
    
    try {
      // Update message in UI immediately
      setMessages(prev => prev.map(msg => {
        const isTarget = getMessageId(msg) === getMessageId(editingMessage)
        return isTarget ? { ...msg, message: editText.trim(), isEdited: true, editedAt: new Date().toISOString() } : msg
      }))
      
      // Send edit request to backend
      await messagesAPI.editMessage(
        editingMessage.id || editingMessage._id,
        editText.trim()
      )
      
      setEditingMessage(null)
      setEditText('')
    } catch (error) {
      console.error('Failed to edit message:', error)
      toast.error('Failed to edit message')
    }
  }
  const handleCancelEdit = () => {
    setEditingMessage(null)
    setEditText('')
  }
  const messagesEndRef = useRef(null)
  const isInitialLoadRef = useRef(true)
  const messagesContainerRef = useRef(null) // For scroll detection
  const previousScrollHeightRef = useRef(0) // To maintain scroll position after loading older messages
  const scrollHandlerTimeoutRef = useRef(null) // For debouncing scroll handler

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
      // Clear messages immediately when switching chats to prevent wrong messages showing
      setMessages([])
      setHasMoreMessages(false)
      setLoadingMore(false)
      
      isInitialLoadRef.current = true  // Mark as initial load when chat changes
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
    if (messages.length > 0) {
      // Use instant scroll for initial load, smooth for new messages
      if (isInitialLoadRef.current) {
        setTimeout(() => {
          scrollToBottom(true)
          isInitialLoadRef.current = false
        }, 100)
      } else {
        // Only auto-scroll if user is already near the bottom (within 200px)
        // This prevents auto-scroll when user is viewing older messages
        if (messagesContainerRef.current) {
          const container = messagesContainerRef.current
          const scrollHeight = container.scrollHeight
          const scrollTop = container.scrollTop
          const clientHeight = container.clientHeight
          const distanceFromBottom = scrollHeight - scrollTop - clientHeight
          
          // Only scroll if user is within 200px of bottom
          if (distanceFromBottom < 200) {
            scrollToBottom(false)
          }
        }
      }
    }
  }, [messages])

  // Handle scroll to load more messages with debounce
  const handleScroll = () => {
    if (!messagesContainerRef.current || loadingMore || !hasMoreMessages || !selectedChat) return

    // Clear any existing timeout
    if (scrollHandlerTimeoutRef.current) {
      clearTimeout(scrollHandlerTimeoutRef.current)
    }

    // Debounce the scroll handler to prevent rapid firing
    scrollHandlerTimeoutRef.current = setTimeout(() => {
      if (!messagesContainerRef.current || loadingMore || !hasMoreMessages) return

      const container = messagesContainerRef.current
      const scrollTop = container.scrollTop
      
      // If scrolled near the top (within 50px), load more
      // Using 50px to reduce false triggers and prevent scroll loop
      if (scrollTop < 50 && messages.length > 0) {
        // Save current scroll height and scroll position before loading more
        previousScrollHeightRef.current = container.scrollHeight
        
        // Load messages before the first message in current list
        const oldestMessageId = messages[0]?._id || messages[0]?.id
        if (oldestMessageId) {
          fetchMessages(oldestMessageId)
        }
      }
    }, 150) // 150ms debounce
  }

  // Attach scroll listener
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container || !selectedChat) return

    container.addEventListener('scroll', handleScroll)
    return () => {
      container.removeEventListener('scroll', handleScroll)
      // Clear any pending scroll handler timeouts
      if (scrollHandlerTimeoutRef.current) {
        clearTimeout(scrollHandlerTimeoutRef.current)
      }
    }
  }, [messages, loadingMore, hasMoreMessages, selectedChat]) // Re-attach when these change

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

      console.log('📊 UserDashboard Data Loaded:')
      console.log('👥 Users:', usersRes.data.length)
      console.log('🏠 Groups:', groupsRes.data.length)
      console.log('📋 Group Details:', groupsRes.data.map(g => ({
        id: g.id,
        name: g.name,
        members: g.members?.length || 0,
        avatar: g.avatar ? 'Has Avatar' : 'No Avatar'
      })))

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
      
      // Replace optimistic message with real message
      if (data && data.id) {
        setMessages(prev => {
          // Remove optimistic messages and add the real message
          const filteredMessages = prev.filter(msg => !msg.isOptimistic);
          const newMessage = {
            id: data.id,
            message: data.message,
            messageType: data.messageType || 'text',
            fileUrl: data.fileUrl,
            fileName: data.fileName,
            fileSize: data.fileSize,
            fileType: data.fileType,
            sender: data.sender,
            createdAt: data.createdAt || data.timestamp,
            timestamp: data.timestamp,
            isOptimistic: false
          };
          
          return [...filteredMessages, newMessage];
        });
      }
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

    // WebRTC call events
    if (socket) {
      socket.off('incoming-call')
      socket.on('incoming-call', (data) => {
        console.log('📞 Incoming call received:', data)
        toast.success(`Incoming ${data.callType} call from ${data.caller?.name || 'Unknown'}`, {
          duration: 5000,
          icon: '📞'
        })
        setIsIncomingCall(true)
        setCallData({ callId: data.callId, callType: data.callType, caller: data.caller })
        setShowCallUI(true)
      })

      socket.off('call-initiated')
      socket.on('call-initiated', (data) => {
        console.log('📤 Call initiated:', data)
        setIsIncomingCall(false)
        setCallData({ callId: data.callId, callType: data.callType, otherUser: data.receiver })
        setShowCallUI(true)
      })

      socket.off('call-error')
      socket.on('call-error', (data) => {
        console.error('❌ Call error:', data)
        toast.error(data.error || 'Call failed', {
          duration: 4000
        })
      })

      // Profile/Avatar update event - update user profiles in real-time
      socket.off('avatar-updated')
      socket.on('avatar-updated', (data) => {
        console.log('👤 Profile updated received:', data)
        const updatedUserId = data.userId?.toString() || data.userId
        
        // Update users list
        setUsers(prevUsers => 
          prevUsers.map(u => 
            (u.id || u._id)?.toString() === updatedUserId
              ? { ...u, profileImage: data.profileImage, name: data.name }
              : u
          )
        )
        
        // Update selected chat if it's the user whose profile was updated
        if (selectedChat && selectedChat.type === 'personal' && 
            (selectedChat.id || selectedChat._id)?.toString() === updatedUserId) {
          setSelectedChat(prev => ({
            ...prev,
            profileImage: data.profileImage,
            name: data.name
          }))
        }
        
        // Update messages sender info for current chat
        setMessages(prevMessages =>
          prevMessages.map(msg => {
            const senderId = (msg.sender?.id || msg.sender?._id || msg.sender)?.toString()
            if (senderId === updatedUserId) {
              return {
                ...msg,
                sender: {
                  ...(typeof msg.sender === 'object' ? msg.sender : { id: msg.sender }),
                  profileImage: data.profileImage,
                  name: data.name
                }
              }
            }
            return msg
          })
        )
      })

      // Messages seen event - update message status to show blue checkmarks
      socket.off('messages-seen')
      socket.on('messages-seen', (data) => {
        console.log('👁️ Messages seen by user:', data.readBy)
        // Update all messages from current user to the chat that was opened
        if (selectedChat && selectedChat.type === 'personal' && data.chatId === selectedChat.id) {
          setMessages(prev => prev.map(msg => {
            const isSentByCurrentUser = (msg.sender?.id || msg.sender?._id || msg.sender) === user.id
            if (isSentByCurrentUser) {
              return { ...msg, isRead: true, readBy: [{ user: data.readBy, readAt: data.timestamp }] }
            }
            return msg
          }))
        }
      })

      // Group call events
      socket.off('incoming-group-call')
      socket.on('incoming-group-call', (data) => {
        console.log('📞 Incoming group call received:', data)
        toast.success(`Incoming group ${data.callType} call from ${data.initiator?.name || 'Unknown'}`, {
          duration: 5000,
          icon: '📞'
        })
        setIsIncomingGroupCall(true)
        setGroupCallData({ 
          callId: data.callId, 
          callType: data.callType, 
          groupId: data.groupId,
          group: data.group,
          initiator: data.initiator 
        })
        setShowGroupCallUI(true)
      })

      socket.off('group-call-initiated')
      socket.on('group-call-initiated', (data) => {
        console.log('📤 Group call initiated:', data)
        setIsIncomingGroupCall(false)
        setGroupCallData({ 
          callId: data.callId, 
          callType: data.callType, 
          groupId: data.groupId,
          group: data.group 
        })
        setShowGroupCallUI(true)
      })

      socket.off('group-call-error')
      socket.on('group-call-error', (data) => {
        console.error('❌ Group call error:', data)
        toast.error(data.error || 'Group call failed', {
          duration: 4000
        })
      })
    }
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
      messageType: data.messageType || 'text',
      fileUrl: data.fileUrl,
      fileName: data.fileName,
      fileSize: data.fileSize,
      fileType: data.fileType,
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

  const fetchMessages = async (before = null) => {
    try {
      if (before) {
        setLoadingMore(true) // Loading older messages
      }
      
      let response
      const params = { limit: messageLimit }
      if (before) {
        params.before = before // Load messages before this ID
      }
      
      if (selectedChat.type === 'personal') {
        if (!selectedChat.id) {
          console.error('User ID is undefined for personal chat')
          return
        }
        response = await messagesAPI.getPersonalMessages(selectedChat.id, params)
      } else {
        if (!selectedChat.id) {
          console.error('Group ID is undefined for group chat')
          return
        }
        response = await messagesAPI.getGroupMessages(selectedChat.id, params)
      }
      
      // Handle both old and new response formats
      let messagesData, hasMore
      if (response.data && typeof response.data === 'object') {
        // New format: { messages: [], hasMore: boolean }
        if (Array.isArray(response.data.messages)) {
          messagesData = response.data.messages
          hasMore = response.data.hasMore || false
        } 
        // Old format: direct array
        else if (Array.isArray(response.data)) {
          messagesData = response.data
          hasMore = response.data.length >= messageLimit
        } else {
          messagesData = []
          hasMore = false
        }
      } else {
        messagesData = []
        hasMore = false
      }
      
      if (before) {
        // Loading older messages - prepend to existing messages
        setMessages(prev => {
          // Create a Set of existing message IDs to avoid duplicates
          const existingIds = new Set(prev.map(msg => msg._id || msg.id))
          
          // Filter out any messages that already exist
          const newMessages = messagesData.filter(msg => {
            const msgId = msg._id || msg.id
            return !existingIds.has(msgId)
          })
          
          // Prepend only new messages
          return [...newMessages, ...prev]
        })
        setHasMoreMessages(hasMore)
        setLoadingMore(false)
        
        // Maintain scroll position after loading older messages
        setTimeout(() => {
          if (messagesContainerRef.current && previousScrollHeightRef.current > 0) {
            const newScrollHeight = messagesContainerRef.current.scrollHeight
            const scrollDiff = newScrollHeight - previousScrollHeightRef.current
            // Add 100px padding to prevent re-triggering the scroll handler
            messagesContainerRef.current.scrollTop = scrollDiff + 100
          }
        }, 0)
      } else {
        // Initial load - replace all messages
        setMessages(messagesData || [])
        setHasMoreMessages(hasMore)
        
        // Update last message for the selected chat
        if (messagesData && messagesData.length > 0) {
          const lastMsg = messagesData[messagesData.length - 1];
          updateLastMessage(selectedChat.id, lastMsg, lastMsg.sender?.id || lastMsg.sender);
        }
      }
    } catch (error) {
      console.error('Error fetching messages:', error)
      toast.error('Failed to load messages')
      setMessages([]) // Set empty array on error
      if (before) {
        setLoadingMore(false)
      }
    }
  }

  const handleFileSelect = (fileType) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.style.display = 'none'
    
    if (fileType === 'image') {
      input.accept = 'image/*'
    } else if (fileType === 'video') {
      input.accept = 'video/*'
    } else if (fileType === 'document') {
      input.accept = '.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.ppt,.pptx,.xlsm,.xlsx,.zip,.rar,.7z,.tar,.gz,.bz2,.xz,.iso,.dmg,.img,.bin,.exe,.msi,.dmg,.iso,.tar,.gz,.bz2,.xz,.img,.bin,.exe,.msi'
    }
    
    input.onchange = (e) => {
      const file = e.target.files[0]
      if (file) {
        setSelectedFile(file)
        if (file.type.startsWith('image/')) {
          const reader = new FileReader()
          reader.onload = (e) => setFilePreview(e.target.result)
          reader.readAsDataURL(file)
        } else {
          setFilePreview(null)
        }
        setShowFileOptions(false)
      }
    }
    
    document.body.appendChild(input)
    input.click()
    document.body.removeChild(input)
  }

  const clearFile = () => {
    setSelectedFile(null)
    setFilePreview(null)
  }

  const downloadFile = async (fileUrl, fileName, messageId) => {
    try {
      // Set initial progress
      setDownloadProgress(prev => ({
        ...prev,
        [messageId]: { progress: 0, downloading: true }
      }))

      const response = await fetch(resolveUrl(fileUrl))
      const contentLength = response.headers.get('content-length')
      const total = parseInt(contentLength, 10)
      
      if (!response.ok) {
        throw new Error('Download failed')
      }

      const reader = response.body.getReader()
      const chunks = []
      let receivedLength = 0

      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break
        
        chunks.push(value)
        receivedLength += value.length
        
        // Update progress
        const progress = total ? Math.round((receivedLength / total) * 100) : 0
        setDownloadProgress(prev => ({
          ...prev,
          [messageId]: { progress, downloading: true }
        }))
      }

      // Create blob and download
      const blob = new Blob(chunks)
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      // Complete progress
      setDownloadProgress(prev => ({
        ...prev,
        [messageId]: { progress: 100, downloading: false }
      }))

      // Mark as downloaded for this session
      setDownloadedMap(prev => {
        const next = { ...prev, [messageId]: true }
        try { sessionStorage.setItem('downloadedMessages', JSON.stringify(next)) } catch {}
        return next
      })

      // Clear progress after 2 seconds
      setTimeout(() => {
        setDownloadProgress(prev => {
          const newProgress = { ...prev }
          delete newProgress[messageId]
          return newProgress
        })
      }, 2000)

    } catch (error) {
      console.error('Download failed:', error)
      setDownloadProgress(prev => ({
        ...prev,
        [messageId]: { progress: 0, downloading: false, error: true }
      }))
    }
  }

  // Close file options and message dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showFileOptions && !event.target.closest('.file-options-container')) {
        setShowFileOptions(false)
      }
      if (messageDropdown && !event.target.closest('.message-dropdown-container')) {
        setMessageDropdown(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showFileOptions, messageDropdown])

  const sendMessage = async (e) => {
    e.preventDefault()
    if ((!newMessage.trim() && !selectedFile) || !selectedChat) return

    // Check if trying to send message to disabled user
    if (selectedChat.type === 'personal' && selectedChat.isActive === false) {
      toast.error('Cannot send messages to disabled users')
      return;
    }

    const messageText = newMessage.trim()
    setNewMessage('') // Clear input immediately for better UX

    try {
      let messageData = {
        sender: user.id,
        message: messageText,
        messageType: 'text'
      }
      
      if (selectedChat.type === 'personal') {
        messageData.receiver = selectedChat.id
      } else {
        messageData.group = selectedChat.id
      }

      // Handle file upload
      if (selectedFile) {
        const formData = new FormData()
        if (selectedChat.type === 'personal') {
          formData.append('receiver', selectedChat.id)
        } else {
          formData.append('group', selectedChat.id)
        }
        formData.append('message', messageText)
        formData.append('file', selectedFile)

        // Determine message type based on file type
        let messageType = 'file'
        if (selectedFile.type.startsWith('image/')) {
          messageType = 'image'
        } else if (selectedFile.type.startsWith('video/')) {
          messageType = 'video'
        }

        // Create optimistic message for file upload
        const optimisticMessage = {
          id: Date.now(), // Temporary ID
          message: messageText || selectedFile.name,
          messageType: messageType,
          fileUrl: URL.createObjectURL(selectedFile), // Temporary local URL
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          fileType: selectedFile.type,
          sender: {
            id: user.id,
            name: user.name,
            profileImage: user.profileImage
          },
          createdAt: new Date().toISOString(),
          timestamp: new Date().toISOString(),
          isOptimistic: true
        }

        // Add optimistic message immediately to UI
        setMessages(prev => [...prev, optimisticMessage])

        // Update last message immediately
        updateLastMessage(selectedChat.id, {
          id: optimisticMessage.id,
          message: optimisticMessage.message,
          createdAt: optimisticMessage.createdAt
        }, user.id);

        // Send file via API
        if (selectedChat.type === 'personal') {
          await messagesAPI.sendPersonalMessage(formData)
        } else {
          await messagesAPI.sendGroupMessage(formData)
        }

        // Clear file after sending
        clearFile()
      } else {
        // Create optimistic message for text
        const optimisticMessage = {
          id: Date.now(), // Temporary ID
          message: messageText,
          messageType: 'text',
          sender: {
            id: user.id,
            name: user.name,
            profileImage: user.profileImage
          },
          createdAt: new Date().toISOString(),
          timestamp: new Date().toISOString(),
          isOptimistic: true
        }

        // Add optimistic message immediately to UI
        setMessages(prev => [...prev, optimisticMessage])

        // Update last message immediately
        updateLastMessage(selectedChat.id, {
          id: optimisticMessage.id,
          message: optimisticMessage.message,
          createdAt: optimisticMessage.createdAt
        }, user.id);

        // Send text message via socket
        if (selectedChat.type === 'personal') {
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
            await messagesAPI.sendPersonalMessage(messageData);
          }
        } else {
          try {
            await socketSendMessage(
              selectedChat.id, 
              messageText, 
              'text', 
              true
            );
            console.log('✅ Dashboard group message sent via context socket');
          } catch (contextError) {
            console.warn('Context socket failed, trying API:', contextError);
            // Fallback to API call
            await messagesAPI.sendGroupMessage({
              sender: user.id,
              group: selectedChat.id,
              message: messageText,
              timestamp: new Date().toISOString()
            });
          }
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

  const scrollToBottom = (instant = false) => {
    messagesEndRef.current?.scrollIntoView({ behavior: instant ? 'instant' : 'smooth' })
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
      avatar: group.avatar ? `${API_ORIGIN}${group.avatar}` : 'G',
      profileImage: group.avatar,
      lastMessage: lastMessages[group.id] || null
    }))
  ].sort((a, b) => {
    // Sort by most recent message timestamp (WhatsApp style)
    const aTime = a.lastMessage?.timestamp ? new Date(a.lastMessage.timestamp).getTime() : 0
    const bTime = b.lastMessage?.timestamp ? new Date(b.lastMessage.timestamp).getTime() : 0
    return bTime - aTime // Most recent first
  })

  // Filter chats based on active filter
  const getFilteredChats = () => {
    let filtered = allChats;

    // Apply filter logic
    switch (activeFilter) {
      case 'unread':
        filtered = allChats.filter(chat => unreadCounts[chat.id] > 0);
        break;
      case 'groups':
        filtered = allChats.filter(chat => chat.type === 'group');
        break;
      case 'all':
      default:
        filtered = allChats;
        break;
    }

    // Apply search term filter
    return filtered.filter(chat => 
      chat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      chat.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const filteredChats = getFilteredChats();

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
              <h2 className="text-lg font-semibold text-gray-800">User Dashboard</h2>
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
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search or start new chat"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>

            {/* Filter Buttons */}
            <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setActiveFilter('all')}
                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  activeFilter === 'all'
                    ? 'bg-white text-green-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setActiveFilter('unread')}
                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  activeFilter === 'unread'
                    ? 'bg-white text-green-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Unread
                {Object.values(unreadCounts).reduce((sum, count) => sum + count, 0) > 0 && (
                  <span className="ml-1 bg-green-500 text-white text-xs rounded-full px-1.5 py-0.5">
                    {Object.values(unreadCounts).reduce((sum, count) => sum + count, 0)}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveFilter('groups')}
                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  activeFilter === 'groups'
                    ? 'bg-white text-green-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Groups
              </button>
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
                    <div 
                      className={`w-12 h-12 rounded-full overflow-hidden cursor-pointer hover:ring-2 hover:ring-green-400 transition-all ${
                        chat.type === 'personal' && chat.isActive === false ? 'bg-gray-300' : 'bg-gray-200'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent chat selection
                        if (chat.profileImage) {
                          setAvatarPopup({
                            image: chat.type === 'personal' ? `${API_ORIGIN}${chat.profileImage}` : chat.avatar,
                            name: chat.name
                          });
                        }
                      }}
                    >
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
                        chat.profileImage ? (
                          <img
                            src={chat.avatar}
                            alt={chat.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-green-500 flex items-center justify-center">
                            <Users className="w-6 h-6 text-white" />
                          </div>
                        )
                      )}
                    </div>
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
                      <div className="flex items-center space-x-2">
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
                        {chat.type === 'group' && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Group
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">
                          {chat.lastMessage?.timestamp ? formatChatDate(chat.lastMessage.timestamp) : ''}
                        </span>
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

        {/* Avatar Popup Modal */}
        {avatarPopup && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={() => setAvatarPopup(null)}
          >
            <div className="relative max-w-2xl max-h-[90vh] p-4">
              {/* Close button */}
              <button
                onClick={() => setAvatarPopup(null)}
                className="absolute top-6 right-6 z-10 bg-white/10 hover:bg-white/20 text-white rounded-full p-2 transition-colors"
                title="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              
              {/* Avatar image */}
              <div className="bg-white rounded-lg overflow-hidden shadow-2xl">
                <div className="bg-gradient-to-r from-green-500 to-green-600 p-4">
                  <h3 className="text-white text-xl font-semibold text-center">{avatarPopup.name}</h3>
                </div>
                <img
                  src={avatarPopup.image}
                  alt={avatarPopup.name}
                  className="w-full h-auto max-h-[70vh] object-contain"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          </div>
        )}

        {/* Image Preview Modal */}
        {imagePreview && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm"
            onClick={() => setImagePreview(null)}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <div className="relative w-[95vw] h-[95vh] flex items-center justify-center overflow-hidden">
              {/* Close button */}
              <button
                onClick={() => setImagePreview(null)}
                className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full p-3 transition-colors"
                title="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              
              {/* Download button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  const link = document.createElement('a')
                  link.href = imagePreview.src
                  link.download = imagePreview.alt
                  document.body.appendChild(link)
                  link.click()
                  document.body.removeChild(link)
                }}
                className="absolute top-4 right-16 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full p-3 transition-colors"
                title="Download"
              >
                <Download className="w-5 h-5" />
              </button>

              {/* Zoom Controls */}
              <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleZoomIn()
                  }}
                  className="bg-black/50 hover:bg-black/70 text-white rounded-full p-3 transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn className="w-5 h-5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleZoomOut()
                  }}
                  className="bg-black/50 hover:bg-black/70 text-white rounded-full p-3 transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-5 h-5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleResetZoom()
                  }}
                  className="bg-black/50 hover:bg-black/70 text-white rounded-full p-3 transition-colors"
                  title="Reset Zoom"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>
              </div>

              {/* Zoom Level Display */}
              <div className="absolute bottom-4 left-4 z-10 bg-black/50 text-white px-3 py-2 rounded-lg text-sm">
                {Math.round(imageZoom * 100)}%
              </div>
              
              {/* Image */}
              <img
                src={imagePreview.src}
                alt={imagePreview.alt}
                className={`object-contain transition-transform duration-200 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                style={{
                  transform: `translate(${imagePosition.x}px, ${imagePosition.y}px) scale(${imageZoom})`,
                  maxWidth: 'none',
                  maxHeight: 'none',
                  width: 'auto',
                  height: 'auto'
                }}
                onMouseDown={handleMouseDown}
                onClick={(e) => e.stopPropagation()}
                draggable={false}
              />
            </div>
          </div>
        )}

        {/* Video Preview Modal */}
        {videoPreview && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm"
            onClick={() => setVideoPreview(null)}
          >
            <div className="relative w-[95vw] h-[95vh] flex items-center justify-center">
              {/* Close button */}
              <button
                onClick={() => setVideoPreview(null)}
                className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full p-3 transition-colors"
                title="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              
              {/* Download button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  const link = document.createElement('a')
                  link.href = videoPreview.src
                  link.download = videoPreview.alt
                  document.body.appendChild(link)
                  link.click()
                  document.body.removeChild(link)
                }}
                className="absolute top-4 right-16 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full p-3 transition-colors"
                title="Download"
              >
                <Download className="w-5 h-5" />
              </button>
              
              {/* Video */}
              <video
                src={videoPreview.src}
                controls
                autoPlay
                className="max-w-full max-h-full object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        )}

        {/* Document Preview Modal */}
        {documentPreview && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm"
            onClick={() => setDocumentPreview(null)}
          >
            <div className="relative w-[95vw] h-[95vh] flex items-center justify-center">
              {/* Close button */}
              <button
                onClick={() => setDocumentPreview(null)}
                className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full p-3 transition-colors"
                title="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              
              {/* Download button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  const link = document.createElement('a')
                  link.href = documentPreview.src
                  link.download = documentPreview.fileName
                  document.body.appendChild(link)
                  link.click()
                  document.body.removeChild(link)
                }}
                className="absolute top-4 right-16 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full p-3 transition-colors"
                title="Download"
              >
                <Download className="w-5 h-5" />
              </button>
              
              {/* Document Preview */}
              <div className="bg-white rounded-lg shadow-2xl w-full h-full max-w-4xl max-h-[90vh] overflow-hidden">
                {documentPreview.fileType === 'application/pdf' ? (
                  <iframe
                    src={documentPreview.src}
                    className="w-full h-full border-0"
                    title={documentPreview.fileName}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-8">
                    <File className="w-24 h-24 text-gray-400 mb-4" />
                    <h3 className="text-xl font-semibold text-gray-800 mb-2">{documentPreview.fileName}</h3>
                    <p className="text-gray-600 mb-4">{(documentPreview.fileSize / 1024 / 1024).toFixed(2)} MB</p>
                    <p className="text-sm text-gray-500 text-center">
                      This file type cannot be previewed in the browser.<br />
                      Click the download button to save and view the file.
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        const link = document.createElement('a')
                        link.href = documentPreview.src
                        link.download = documentPreview.fileName
                        document.body.appendChild(link)
                        link.click()
                        document.body.removeChild(link)
                      }}
                      className="mt-4 bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg transition-colors"
                    >
                      Download File
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

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
                      selectedChat.profileImage ? (
                        <img
                          src={`${API_ORIGIN}${selectedChat.profileImage}`}
                          alt={selectedChat.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-green-500 flex items-center justify-center">
                          <Users className="w-5 h-5 text-white" />
                        </div>
                      )
                    )}
                  </div>
                  <div 
                    className={`${selectedChat.type === 'group' ? 'cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors' : ''}`}
                    onClick={() => {
                      if (selectedChat.type === 'group') {
                        window.location.href = `/group/${selectedChat.id}`
                      }
                    }}
                    title={selectedChat.type === 'group' ? 'Click to view group info' : ''}
                  >
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
                          : (isUserOnline(selectedChat.id) ? (
                              <span className="text-green-600 font-medium">Online</span>
                            ) : (
                              formatLastSeen(getUserStatus(selectedChat.id).lastSeen)
                            ))) 
                        : `${selectedChat.email}`
                      }
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  {selectedChat.type === 'personal' ? (
                    <>
                      <PhoneCall className="w-5 h-5 text-gray-600 cursor-pointer hover:text-gray-800" onClick={async () => {
                        if (!selectedChat || selectedChat.type !== 'personal') return
                        try {
                          const res = await callsAPI.initiate(selectedChat.id, 'voice')
                          const call = res.data?.data?.call
                          if (call && call._id) {
                            setIsIncomingCall(false)
                            setCallData({ callId: call._id, callType: 'voice', otherUser: call.otherUser })
                            setShowCallUI(true)
                            socket.emit('call-initiate', { receiverId: selectedChat.id, callType: 'voice', callId: call._id })
                          }
                        } catch (e) {
                          console.error('Failed to initiate call', e)
                        }
                      }} />
                      <Video className="w-5 h-5 text-gray-600 cursor-pointer hover:text-gray-800" onClick={async () => {
                        if (!selectedChat || selectedChat.type !== 'personal') return
                        try {
                          const res = await callsAPI.initiate(selectedChat.id, 'video')
                          const call = res.data?.data?.call
                          if (call && call._id) {
                            setIsIncomingCall(false)
                            setCallData({ callId: call._id, callType: 'video', otherUser: call.otherUser })
                            setShowCallUI(true)
                            socket.emit('call-initiate', { receiverId: selectedChat.id, callType: 'video', callId: call._id })
                          }
                        } catch (e) {
                          console.error('Failed to initiate video call', e)
                        }
                      }} />
                    </>
                  ) : (
                    <>
                      <PhoneCall className="w-5 h-5 text-gray-600 cursor-pointer hover:text-gray-800" onClick={async () => {
                        if (!selectedChat || selectedChat.type !== 'group') return
                        console.log('Initiating group call for:', selectedChat.id, selectedChat.name)
                        try {
                          const res = await groupCallsAPI.initiate(selectedChat.id, 'voice')
                          const call = res.data?.data?.call
                          if (call && call._id) {
                            setIsIncomingGroupCall(false)
                            setGroupCallData({ 
                              callId: call._id, 
                              callType: 'voice', 
                              groupId: selectedChat.id,
                              group: { name: selectedChat.name, avatar: selectedChat.profileImage }
                            })
                            setShowGroupCallUI(true)
                            // Notify via socket for realtime signaling
                            socket.emit('group-call-initiate', { 
                              groupId: selectedChat.id, 
                              callType: 'voice', 
                              callId: call._id 
                            })
                          }
                        } catch (e) {
                          console.error('Failed to initiate group call', e)
                          console.error('Error response:', e.response?.data)
                          const errorMessage = e.response?.data?.message || 'Failed to initiate group call'
                          toast.error(errorMessage)
                        }
                      }} />
                      <Video className="w-5 h-5 text-gray-600 cursor-pointer hover:text-gray-800" onClick={async () => {
                        if (!selectedChat || selectedChat.type !== 'group') return
                        console.log('Initiating group video call for:', selectedChat.id, selectedChat.name)
                        try {
                          const res = await groupCallsAPI.initiate(selectedChat.id, 'video')
                          const call = res.data?.data?.call
                          if (call && call._id) {
                            setIsIncomingGroupCall(false)
                            setGroupCallData({ 
                              callId: call._id, 
                              callType: 'video', 
                              groupId: selectedChat.id,
                              group: { name: selectedChat.name, avatar: selectedChat.profileImage }
                            })
                            setShowGroupCallUI(true)
                            // Notify via socket for realtime signaling
                            socket.emit('group-call-initiate', { 
                              groupId: selectedChat.id, 
                              callType: 'video', 
                              callId: call._id 
                            })
                          }
                        } catch (e) {
                          console.error('Failed to initiate group video call', e)
                          console.error('Error response:', e.response?.data)
                          const errorMessage = e.response?.data?.message || 'Failed to initiate group video call'
                          toast.error(errorMessage)
                        }
                      }} />
                    </>
                  )}
                  <MoreVertical className="w-5 h-5 text-gray-600 cursor-pointer hover:text-gray-800" />
                </div>
              </div>

              {/* Messages Area */}
              <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 bg-gray-50 relative">
                <div className="max-w-8xl mx-auto">
                  {/* Loading indicator at top */}
                  {loadingMore && (
                    <div className="flex justify-center py-2">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                    </div>
                  )}
                  {/* Show "Load More" button if there are more messages */}
                  {!loadingMore && hasMoreMessages && messages.length > 0 && (
                    <div className="flex justify-center py-2">
                      <button
                        onClick={() => {
                          const oldestMessageId = messages[0]?._id || messages[0]?.id
                          if (oldestMessageId) {
                            previousScrollHeightRef.current = messagesContainerRef.current?.scrollHeight || 0
                            fetchMessages(oldestMessageId)
                          }
                        }}
                        className="px-4 py-2 text-sm bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
                      >
                        Load Previous Messages
                      </button>
                    </div>
                  )}
                  {Array.isArray(messages) && messages.map((message, index) => {
                    // Check if we need to show a date separator
                    const showDateSeparator = index === 0 || (() => {
                      const currentMessageDate = new Date(message.createdAt || message.timestamp)
                      const previousMessageDate = new Date(messages[index - 1].createdAt || messages[index - 1].timestamp)
                      const currentDay = new Date(currentMessageDate.getFullYear(), currentMessageDate.getMonth(), currentMessageDate.getDate())
                      const previousDay = new Date(previousMessageDate.getFullYear(), previousMessageDate.getMonth(), previousMessageDate.getDate())
                      return currentDay.getTime() !== previousDay.getTime()
                    })()

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
                      <React.Fragment key={message.id || message._id || index}>
                        {/* Date Separator */}
                        {showDateSeparator && (
                          <div className="flex justify-center my-4">
                            <div className="bg-gray-200 text-gray-600 text-xs px-3 py-1 rounded-full">
                              {formatMessageDate(message.createdAt || message.timestamp)}
                            </div>
                          </div>
                        )}
                        
                        <div
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
                            className={`relative group flex flex-col px-3 py-2 rounded-lg ${
                              isCurrentUser
                                ? 'bg-green-500 text-white rounded-br-none'
                                : 'bg-gray-200 text-gray-900 rounded-bl-none'
                            } ${showActions && selectedMessage && (getMessageId(selectedMessage) === getMessageId(message)) ? 'ring-2 ring-blue-400' : ''}`}
                            onMouseDown={() => startLongPress(message)}
                            onMouseUp={cancelLongPress}
                            onMouseLeave={cancelLongPress}
                            onTouchStart={() => startLongPress(message)}
                            onTouchEnd={cancelLongPress}
                            onContextMenu={(e) => { e.preventDefault(); setSelectedMessage(message); setShowActions(true); }}
                          >
                            {/* Dropdown button for text messages */}
                            {message.messageType === 'text' && (
                              <>
                                <button
                                  onClick={(e) => handleDropdownToggle(getMessageId(message), e)}
                                  className={`absolute top-1 right-1 z-10 p-1 rounded-full transition-all duration-200 ${
                                    isCurrentUser 
                                      ? 'bg-green-600/80 hover:bg-green-700/80 text-white' 
                                      : 'bg-gray-300/80 hover:bg-gray-400/80 text-gray-700'
                                  } ${messageDropdown === getMessageId(message) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                                  title="More options"
                                >
                                  <ChevronDown className="w-3 h-3" />
                                </button>

                                {/* Dropdown menu for text messages */}
                                {messageDropdown === getMessageId(message) && (
                                  <div className="message-dropdown-container absolute top-8 right-1 z-20 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[120px]">
                                    <button
                                      onClick={() => handleDropdownAction('copy', message)}
                                      className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                    >
                                      <Copy className="w-4 h-4" />
                                      Copy
                                    </button>
                                    {(() => {
                                      const senderId = message.sender?.id || message.sender?._id || message.sender
                                      const isCurrentUserMessage = senderId === user.id || senderId === user._id || senderId === user.id?.toString() || senderId === user._id?.toString()
                                      return isCurrentUserMessage ? (
                                        <button
                                          onClick={() => handleDropdownAction('edit', message)}
                                          className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                        >
                                          <Edit className="w-4 h-4" />
                                          Edit
                                        </button>
                                      ) : null
                                    })()}
                                    <button
                                      onClick={() => handleDropdownAction('forward', message)}
                                      className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                    >
                                      <Forward className="w-4 h-4" />
                                      Forward
                                    </button>
                                  </div>
                                )}
                              </>
                            )}
                            {/* File Display */}
                            {message.fileUrl && (
                              <div className="mb-2">
                                {message.messageType === 'image' ? (
                                  <div className="relative group" onMouseDown={() => startLongPress(message)} onMouseUp={cancelLongPress} onMouseLeave={cancelLongPress} onTouchStart={() => startLongPress(message)} onTouchEnd={cancelLongPress}>
                                    {/* Dropdown button - WhatsApp style */}
                                    <button
                                      onClick={(e) => handleDropdownToggle(getMessageId(message), e)}
                                      className={`absolute top-2 right-2 z-10 p-1.5 rounded-full transition-all duration-200 ${
                                        isCurrentUser 
                                          ? 'bg-green-500/80 hover:bg-green-600/80 text-white' 
                                          : 'bg-gray-500/80 hover:bg-gray-600/80 text-white'
                                      } ${messageDropdown === getMessageId(message) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                                      title="More options"
                                    >
                                      <ChevronDown className="w-3 h-3" />
                                    </button>

                                    {/* Dropdown menu */}
                                    {messageDropdown === getMessageId(message) && (
                                      <div className="message-dropdown-container absolute top-10 right-2 z-20 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[120px]">
                                        <button
                                          onClick={() => handleDropdownAction('copy', message)}
                                          className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                        >
                                          <Copy className="w-4 h-4" />
                                          Copy
                                        </button>
                                        {message.messageType === 'text' && (() => {
                                          const senderId = message.sender?.id || message.sender?._id || message.sender
                                          const isCurrentUserMessage = senderId === user.id || senderId === user._id || senderId === user.id?.toString() || senderId === user._id?.toString()
                                          return isCurrentUserMessage ? (
                                            <button
                                              onClick={() => handleDropdownAction('edit', message)}
                                              className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                            >
                                              <Edit className="w-4 h-4" />
                                              Edit
                                            </button>
                                          ) : null
                                        })()}
                                        <button
                                          onClick={() => handleDropdownAction('forward', message)}
                                          className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                        >
                                          <Forward className="w-4 h-4" />
                                          Forward
                                        </button>
                                      </div>
                                    )}

                                    <img
                                      src={resolveUrl(message.fileUrl)}
                                      alt={message.fileName}
                                      className={`max-w-xs rounded-lg ${!isCurrentUser && !downloadedMap[(message.id || message._id)] ? 'blur-sm cursor-pointer' : 'cursor-pointer'} hover:opacity-90`}
                                      onClick={() => {
                                        if (!isCurrentUser && !downloadedMap[(message.id || message._id)]) {
                                          // Download if not downloaded yet
                                          downloadFile(message.fileUrl, message.fileName, message.id || message._id)
                                        } else {
                                          // Show preview if already downloaded or sent by current user
                                          openImagePreview({
                                            src: resolveUrl(message.fileUrl),
                                            alt: message.fileName,
                                            sender: message.sender?.name || 'User',
                                            timestamp: message.createdAt || message.timestamp
                                          })
                                        }
                                      }}
                                    />
                                    {/* Show download option and size only for receivers */}
                                    {!isCurrentUser && !downloadedMap[(message.id || message._id)] && (
                                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1 rounded-full flex items-center gap-1">
                                        <Download className="w-3 h-3" />
                                        {((message.fileSize || 0) / 1024 / 1024).toFixed(1)} MB
                                      </div>
                                    )}
                                    {downloadProgress[message.id || message._id] && (
                                      <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center">
                                        <div className="bg-black/60 rounded-lg px-3 py-2 text-center">
                                          <div className="w-8 h-8 border-4 border-white/40 border-t-white rounded-full animate-spin mx-auto mb-2"></div>
                                          <p className="text-sm text-white">
                                            {downloadProgress[message.id || message._id].progress}%
                                          </p>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ) : message.messageType === 'video' ? (
                                  <div className="relative group" onMouseDown={() => startLongPress(message)} onMouseUp={cancelLongPress} onMouseLeave={cancelLongPress} onTouchStart={() => startLongPress(message)} onTouchEnd={cancelLongPress}>
                                    {/* Dropdown button - WhatsApp style */}
                                    <button
                                      onClick={(e) => handleDropdownToggle(getMessageId(message), e)}
                                      className={`absolute top-2 right-2 z-10 p-1.5 rounded-full transition-all duration-200 ${
                                        isCurrentUser 
                                          ? 'bg-green-500/80 hover:bg-green-600/80 text-white' 
                                          : 'bg-gray-500/80 hover:bg-gray-600/80 text-white'
                                      } ${messageDropdown === getMessageId(message) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                                      title="More options"
                                    >
                                      <ChevronDown className="w-3 h-3" />
                                    </button>

                                    {/* Dropdown menu */}
                                    {messageDropdown === getMessageId(message) && (
                                      <div className="message-dropdown-container absolute top-10 right-2 z-20 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[120px]">
                                        <button
                                          onClick={() => handleDropdownAction('copy', message)}
                                          className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                        >
                                          <Copy className="w-4 h-4" />
                                          Copy
                                        </button>
                                        {message.messageType === 'text' && (() => {
                                          const senderId = message.sender?.id || message.sender?._id || message.sender
                                          const isCurrentUserMessage = senderId === user.id || senderId === user._id || senderId === user.id?.toString() || senderId === user._id?.toString()
                                          return isCurrentUserMessage ? (
                                            <button
                                              onClick={() => handleDropdownAction('edit', message)}
                                              className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                            >
                                              <Edit className="w-4 h-4" />
                                              Edit
                                            </button>
                                          ) : null
                                        })()}
                                        <button
                                          onClick={() => handleDropdownAction('forward', message)}
                                          className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                        >
                                          <Forward className="w-4 h-4" />
                                          Forward
                                        </button>
                                      </div>
                                    )}

                                    <video
                                      src={resolveUrl(message.fileUrl)}
                                      controls
                                      className={`max-w-xs rounded-lg ${!isCurrentUser && !downloadedMap[(message.id || message._id)] ? 'blur-sm' : ''} cursor-pointer`}
                                      onClick={() => {
                                        if (!isCurrentUser && !downloadedMap[(message.id || message._id)]) {
                                          // Download if not downloaded yet
                                          downloadFile(message.fileUrl, message.fileName, message.id || message._id)
                                        } else {
                                          // Show preview if already downloaded or sent by current user
                                          setVideoPreview({
                                            src: resolveUrl(message.fileUrl),
                                            alt: message.fileName,
                                            sender: message.sender?.name || 'User',
                                            timestamp: message.createdAt || message.timestamp
                                          })
                                        }
                                      }}
                                    />
                                    {/* Show download option and size only for receivers */}
                                    {!isCurrentUser && !downloadedMap[(message.id || message._id)] && (
                                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1 rounded-full flex items-center gap-1">
                                        <Download className="w-3 h-3" />
                                        {((message.fileSize || 0) / 1024 / 1024).toFixed(1)} MB
                                      </div>
                                    )}
                                    {downloadProgress[message.id || message._id] && (
                                      <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center">
                                        <div className="bg-black/60 rounded-lg px-3 py-2 text-center">
                                          <div className="w-8 h-8 border-4 border-white/40 border-t-white rounded-full animate-spin mx-auto mb-2"></div>
                                          <p className="text-sm text-white">
                                            {downloadProgress[message.id || message._id].progress}%
                                          </p>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex items-center space-x-2 p-2 bg-white bg-opacity-20 rounded-lg relative cursor-pointer" 
                                       onMouseDown={() => startLongPress(message)} 
                                       onMouseUp={cancelLongPress} 
                                       onMouseLeave={cancelLongPress} 
                                       onTouchStart={() => startLongPress(message)} 
                                       onTouchEnd={cancelLongPress}
                                       onClick={() => {
                                         if (!isCurrentUser && !downloadedMap[(message.id || message._id)]) {
                                           // Download if not downloaded yet
                                           downloadFile(message.fileUrl, message.fileName, message.id || message._id)
                                         } else {
                                           // Show preview if already downloaded or sent by current user
                                           setDocumentPreview({
                                             src: resolveUrl(message.fileUrl),
                                             fileName: message.fileName,
                                             fileSize: message.fileSize,
                                             fileType: message.fileType,
                                             sender: message.sender?.name || 'User',
                                             timestamp: message.createdAt || message.timestamp
                                           })
                                         }
                                       }}>
                                    <File className="w-5 h-5" />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium truncate">{message.fileName}</p>
                                      <p className="text-xs opacity-75">
                                        {(message.fileSize / 1024 / 1024).toFixed(2)} MB
                                      </p>
                                    </div>
                                    {!isCurrentUser && !downloadedMap[(message.id || message._id)] && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          downloadFile(message.fileUrl, message.fileName, message.id || message._id)
                                        }}
                                        className="p-1 hover:bg-white hover:bg-opacity-20 rounded"
                                        disabled={downloadProgress[message.id || message._id]?.downloading}
                                      >
                                        <Download className="w-4 h-4" />
                                      </button>
                                    )}
                                    {downloadProgress[message.id || message._id] && (
                                      <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center">
                                        <div className="bg-white rounded-lg p-2 text-center">
                                          <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-1"></div>
                                          <p className="text-xs text-white">
                                            {downloadProgress[message.id || message._id].progress}%
                                          </p>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* Message Text */}
                            {message.message && (
                              editingMessage && (getMessageId(editingMessage) === getMessageId(message)) ? (
                                <div className="mb-2">
                                  <input
                                    type="text"
                                    value={editText}
                                    onChange={(e) => setEditText(e.target.value)}
                                    className="w-full px-2 py-1 text-sm bg-white bg-opacity-20 rounded border-none focus:outline-none focus:ring-1 focus:ring-white"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveEdit()
                                      if (e.key === 'Escape') handleCancelEdit()
                                    }}
                                  />
                                  <div className="flex gap-1 mt-1">
                                    <button
                                      onClick={handleSaveEdit}
                                      className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={handleCancelEdit}
                                      className="text-xs px-2 py-1 bg-gray-600 text-white rounded hover:bg-gray-700"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-sm mb-1 break-words">
                                  {message.message}
                                  {(message.isEdited || message.editedAt) && (
                                    <span className="text-xs opacity-75 ml-1">(edited)</span>
                                  )}
                                </p>
                              )
                            )}
                            
                            <div className={`flex items-center gap-1 text-xs self-end ${
                              isCurrentUser ? 'text-green-100' : 'text-gray-500'
                            }`}>
                              <span>
                                {new Date(message.createdAt || message.timestamp).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                              </span>
                              {/* WhatsApp-style checkmarks for sent messages */}
                              {isCurrentUser && (
                                <span className="ml-1 relative inline-flex items-center" title={message.isRead || (message.readBy && message.readBy.length > 0) ? "Seen" : "Delivered"}>
                                  {message.isRead || (message.readBy && message.readBy.length > 0) ? (
                                    // Double blue checkmark for "seen" - WhatsApp style
                                    <svg className="w-4 h-4 text-blue-500" viewBox="0 0 16 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z" fill="currentColor"/>
                                    </svg>
                                  ) : (
                                    // Double gray checkmark for "delivered" - WhatsApp style
                                    <svg className="w-4 h-4 opacity-70" viewBox="0 0 16 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z" fill="currentColor"/>
                                    </svg>
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      </React.Fragment>
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
                  <div className="relative">
                    {/* File Options Modal */}
                    {showFileOptions && (
                      <div className="file-options-container absolute bottom-16 left-4 bg-white rounded-lg shadow-lg border border-gray-200 p-2 z-50">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleFileSelect('image')}
                            className="flex flex-col items-center p-3 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <ImageIcon className="w-8 h-8 text-green-600 mb-1" />
                            <span className="text-xs text-gray-700">Image</span>
                          </button>
                          <button
                            onClick={() => handleFileSelect('video')}
                            className="flex flex-col items-center p-3 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <Video className="w-8 h-8 text-blue-600 mb-1" />
                            <span className="text-xs text-gray-700">Video</span>
                          </button>
                          <button
                            onClick={() => handleFileSelect('document')}
                            className="flex flex-col items-center p-3 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <File className="w-8 h-8 text-purple-600 mb-1" />
                            <span className="text-xs text-gray-700">Document</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* File Preview */}
                    {selectedFile && (
                      <div className="mb-3 p-3 bg-gray-100 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            {filePreview ? (
                              <img src={filePreview} alt="Preview" className="w-12 h-12 object-cover rounded" />
                            ) : (
                              <File className="w-8 h-8 text-gray-500" />
                            )}
                            <div>
                              <p className="text-sm font-medium">{selectedFile.name}</p>
                              <p className="text-xs text-gray-500">
                                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={clearFile}
                            className="text-gray-500 hover:text-gray-700"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    )}

                    <form onSubmit={sendMessage} className="flex items-center space-x-3">
                      <button
                        type="button"
                        onClick={() => setShowFileOptions(!showFileOptions)}
                        className="p-2 text-gray-500 hover:text-gray-700"
                        title="Attach file"
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
                        disabled={!newMessage.trim() && !selectedFile}
                        className="bg-green-500 text-white p-2 rounded-full hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <Send className="w-5 h-5" />
                      </button>
                    </form>
                  </div>
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

      {/* WebRTC Call UI */}
      {showCallUI && callData && (
        <>
          {callData.callType === 'voice' ? (
            <WebRTCAudioCall
              user={user}
              callData={callData}
              isIncoming={isIncomingCall}
              onCallEnd={() => {
                setShowCallUI(false)
                setCallData(null)
                setIsIncomingCall(false)
              }}
              onCallAnswer={() => {
                setIsIncomingCall(false)
              }}
              onCallDecline={() => {
                setShowCallUI(false)
                setCallData(null)
                setIsIncomingCall(false)
              }}
            />
          ) : (
            <WebRTCCall
              user={user}
              callData={callData}
              isIncoming={isIncomingCall}
              onCallEnd={() => {
                setShowCallUI(false)
                setCallData(null)
                setIsIncomingCall(false)
              }}
              onCallAnswer={() => {
                setIsIncomingCall(false)
              }}
              onCallDecline={() => {
                setShowCallUI(false)
                setCallData(null)
                setIsIncomingCall(false)
              }}
            />
          )}
        </>
      )}

      {/* Group Call UI */}
      {showGroupCallUI && groupCallData && (
        <GroupCallUI
          user={user}
          callData={groupCallData}
          isIncoming={isIncomingGroupCall}
          onCallEnd={() => {
            setShowGroupCallUI(false)
            setGroupCallData(null)
            setIsIncomingGroupCall(false)
          }}
          onCallAnswer={() => {
            setIsIncomingGroupCall(false)
          }}
          onCallDecline={() => {
            setShowGroupCallUI(false)
            setGroupCallData(null)
            setIsIncomingGroupCall(false)
          }}
        />
      )}
    </div>
  )
}

export default UserDashboard