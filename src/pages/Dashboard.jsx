import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { usersAPI, groupsAPI, messagesAPI, API_ORIGIN } from '../services/api'
import { toast } from 'react-hot-toast'
import { Link } from 'react-router-dom'
import { 
  Users, 
  MessageSquare, 
  UserPlus, 
  Settings, 
  Crown, 
  Shield, 
  User as UserIcon,
  Plus,
  MessageCircle,
  Bell,
  X,
  Check,
  LogOut
} from 'lucide-react'
import { useSocket } from '../contexts/SocketProvider'
import WebRTCAudioCall from '../components/WebRTCAudioCall'
import WebRTCCall from '../components/WebRTCCall'
import GroupCallUI from '../components/GroupCallUI'
import JitsiGroupCall from '../components/JitsiGroupCall'
import IncomingJitsiCall from '../components/IncomingJitsiCall'

const Dashboard = () => {
  const { user, logout } = useAuth()
  const { socket, notifications, handleActivateUser, handleCloseNotification } = useSocket()
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalGroups: 0,
    activeUsers: 0,
    disabledUsers: 0
  })
  const [loading, setLoading] = useState(true)
  const [showNotificationPanel, setShowNotificationPanel] = useState(false)
  const [showAccountMenu, setShowAccountMenu] = useState(false)

  // Call UI state
  const [showCallUI, setShowCallUI] = useState(false)
  const [callData, setCallData] = useState(null)
  const [isIncomingCall, setIsIncomingCall] = useState(false)

  // Group call UI state
  const [showGroupCallUI, setShowGroupCallUI] = useState(false)
  const [groupCallData, setGroupCallData] = useState(null)
  const [isIncomingGroupCall, setIsIncomingGroupCall] = useState(false)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  // Setup socket listeners for incoming calls
  useEffect(() => {
    if (!socket) return

    console.log('🔧 Setting up Admin Dashboard call listeners...')

    // WebRTC call events - for 1-on-1 calls
    socket.off('incoming-call')
    socket.on('incoming-call', (data) => {
      console.log('📞 Admin Dashboard - Incoming call received:', data)
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
      console.log('📤 Admin Dashboard - Call initiated:', data)
      setIsIncomingCall(false)
      setCallData({ callId: data.callId, callType: data.callType, otherUser: data.receiver })
      setShowCallUI(true)
    })

    socket.off('call-error')
    socket.on('call-error', (data) => {
      console.error('❌ Admin Dashboard - Call error:', data)
      toast.error(data.error || 'Call failed', {
        duration: 4000
      })
    })

    // Group call events
    socket.off('incoming-group-call')
    socket.on('incoming-group-call', (data) => {
      console.log('📞 Admin Dashboard - Incoming group call received:', data)
      toast.success(`Incoming group ${data.callType} call from ${data.initiator?.name || 'Unknown'}`, {
        duration: 5000,
        icon: '📞'
      })
      setIsIncomingGroupCall(true)
      setGroupCallData({ 
        callId: data.callId, 
        callType: data.callType, 
        groupId: data.groupId,
        roomName: data.roomName,
        group: data.group || { name: data.groupName },
        initiator: data.initiator 
      })
      setShowGroupCallUI(true)
    })

    socket.off('group-call-initiated')
    socket.on('group-call-initiated', (data) => {
      console.log('📤 Admin Dashboard - Group call initiated:', data)
      setIsIncomingGroupCall(false)
      setGroupCallData({ 
        callId: data.callId, 
        callType: data.callType, 
        groupId: data.groupId,
        roomName: data.roomName,
        group: data.group 
      })
      setShowGroupCallUI(true)
    })

    socket.off('group-call-error')
    socket.on('group-call-error', (data) => {
      console.error('❌ Admin Dashboard - Group call error:', data)
      toast.error(data.error || 'Group call failed', {
        duration: 4000
      })
    })

    // Cleanup function
    return () => {
      socket.off('incoming-call')
      socket.off('call-initiated')
      socket.off('call-error')
      socket.off('incoming-group-call')
      socket.off('group-call-initiated')
      socket.off('group-call-error')
    }
  }, [socket])

  // Listen for push notification clicks from service worker
  useEffect(() => {
    const handleServiceWorkerMessage = (event) => {
      console.log('🔔 Dashboard - Received Service Worker Message:', event.data)
      const message = event.data
      
      if (!message || !message.type) {
        console.warn('Dashboard - Invalid message received from service worker')
        return
      }
      
      if (message.type === 'notification-clicked' || message.type === 'answer-call') {
        console.log('🔔 Dashboard - Processing notification click/answer:', message.type)
        const notificationData = message.data
        
        if (!notificationData) {
          console.warn('Dashboard - No notification data found')
          return
        }
        
        // Handle incoming call notifications
        if (notificationData.type === 'incoming-call') {
          console.log('📞 Dashboard - Showing incoming call UI from notification click')
          console.log('Dashboard - Call data:', notificationData)
          
          // Fetch call details and show UI
          const callDataObj = {
            callId: notificationData.callId,
            callType: notificationData.callType || 'voice',
            caller: {
              _id: notificationData.senderId,
              name: notificationData.senderName,
              profileImage: notificationData.senderImage
            }
          }
          
          console.log('Dashboard - Setting call UI with data:', callDataObj)
          setIsIncomingCall(true)
          setCallData(callDataObj)
          setShowCallUI(true)
          
          toast.success(`Incoming ${callDataObj.callType} call from ${callDataObj.caller.name}`, {
            duration: 5000,
            icon: '📞'
          })
        }
        
        // Handle incoming group call notifications
        else if (notificationData.type === 'incoming-group-call') {
          console.log('📞 Dashboard - Showing incoming group call UI from notification click')
          console.log('Dashboard - Group call data:', notificationData)
          
          const groupCallDataObj = {
            callId: notificationData.callId,
            callType: notificationData.callType || 'voice',
            groupId: notificationData.groupId,
            roomName: notificationData.roomName,
            group: {
              _id: notificationData.groupId,
              name: notificationData.groupName
            },
            initiator: {
              _id: notificationData.senderId,
              name: notificationData.senderName,
              profileImage: notificationData.senderImage
            }
          }
          
          console.log('Dashboard - Setting group call UI with data:', groupCallDataObj)
          setIsIncomingGroupCall(true)
          setGroupCallData(groupCallDataObj)
          setShowGroupCallUI(true)
          
          toast.success(`Incoming group ${groupCallDataObj.callType} call from ${groupCallDataObj.initiator.name}`, {
            duration: 5000,
            icon: '📞'
          })
        }
      }
      
      // Handle decline call from notification
      else if (message.type === 'decline-call') {
        console.log('❌ Declining call from notification')
        setShowCallUI(false)
        setShowGroupCallUI(false)
        setCallData(null)
        setGroupCallData(null)
      }
    }
    
    console.log('📡 Dashboard - Setting up service worker message listener')
    
    // Add event listener for service worker messages
    if (navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage)
      console.log('✅ Dashboard - Service worker message listener attached')
    } else {
      console.warn('⚠️ Dashboard - Service worker not available')
    }
    
    // Check URL parameters for notification data (when opening in new tab)
    const urlParams = new URLSearchParams(window.location.search)
    const notificationDataParam = urlParams.get('notificationData')
    
    if (notificationDataParam) {
      console.log('📎 Dashboard - Found notification data in URL')
      try {
        const decoded = atob(notificationDataParam)
        const message = JSON.parse(decoded)
        console.log('🔔 Dashboard - Notification data from URL:', message)
        
        // Process the notification data
        handleServiceWorkerMessage({ data: message })
        
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname)
      } catch (error) {
        console.error('Dashboard - Error parsing notification data from URL:', error)
      }
    }
    
    // Cleanup
    return () => {
      console.log('🧹 Dashboard - Removing service worker message listener')
      if (navigator.serviceWorker) {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage)
      }
    }
  }, [])

  // Close notification panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showNotificationPanel) {
        const notificationPanel = document.querySelector('.notification-panel');
        if (notificationPanel && !notificationPanel.contains(event.target)) {
          setShowNotificationPanel(false);
        }
      }
    };

    if (showNotificationPanel) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotificationPanel])

  // Close account menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showAccountMenu) {
        const menu = document.querySelector('.account-menu-container')
        if (menu && !menu.contains(event.target)) {
          setShowAccountMenu(false)
        }
      }
    }

    if (showAccountMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showAccountMenu])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      
      const [usersRes, groupsRes] = await Promise.all([
        user.role === 'user' ? usersAPI.getActiveUsers() : usersAPI.getUsers(),
        groupsAPI.getMyGroups()
      ])

      const allUsers = Array.isArray(usersRes.data) ? usersRes.data : []
      const activeUsers = allUsers.filter(u => (u.isActive ?? true) === true).length
      const disabledUsers = allUsers.filter(u => (u.isActive ?? true) === false).length

      setStats({
        totalUsers: allUsers.length,
        totalGroups: groupsRes.data.length,
        activeUsers,
        disabledUsers
      })
    } catch (error) {
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const getRoleIcon = (role) => {
    switch (role) {
      case 'superadmin':
        return <Crown className="w-5 h-5 text-yellow-600" />
      case 'admin':
        return <Shield className="w-5 h-5 text-blue-600" />
      default:
        return <UserIcon className="w-5 h-5 text-gray-600" />
    }
  }

  const getRoleColor = (role) => {
    switch (role) {
      case 'superadmin':
        return 'bg-yellow-100 text-yellow-800'
      case 'admin':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary-200"></div>
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-primary-600 absolute top-0 left-0"></div>
          </div>
          <p className="mt-4 text-gray-600 font-medium">Loading Dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40">
      {/* Premium Header with Glassmorphism */}
      <div className="bg-white/80 backdrop-blur-xl shadow-lg border-b border-white/20 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-5">
            <div className="flex items-center space-x-4">
              <Link to="/profile" className="flex items-center space-x-4 group">
                <div className="relative">
                  {user.profileImage ? (
                    <img
                      src={`${API_ORIGIN}${user.profileImage}`}
                      alt="Profile"
                      className="w-14 h-14 rounded-2xl object-cover ring-4 ring-primary-100 group-hover:ring-primary-200 transition-all duration-300 shadow-lg"
                    />
                  ) : (
                    <div className="w-14 h-14 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center ring-4 ring-primary-100 group-hover:ring-primary-200 transition-all duration-300 shadow-lg">
                      <span className="text-white font-bold text-xl">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-md"></div>
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                    Dashboard
                  </h1>
                  <p className="text-sm text-gray-600 font-medium">Welcome back, {user.name}!</p>
                </div>
              </Link>
            </div>
            <div className="flex items-center space-x-3">
              {/* Notification Bell - Only for Admin and SuperAdmin */}
              {(user.role === 'admin' || user.role === 'superadmin') && (
                <div className="relative">
                  <button
                    onClick={() => setShowNotificationPanel(!showNotificationPanel)}
                    className="relative p-3 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-all duration-200 group"
                  >
                    <Bell className="w-6 h-6 group-hover:scale-110 transition-transform" />
                    {notifications.length > 0 && (
                      <span className="absolute -top-1 -right-1 bg-gradient-to-r from-red-500 to-red-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-lg animate-pulse">
                        {notifications.length}
                      </span>
                    )}
                  </button>
                </div>
              )}
              
              <div className="relative account-menu-container">
                <button
                  onClick={() => setShowAccountMenu((v) => !v)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold hover:shadow-lg transition-all duration-200 transform hover:scale-105 ${getRoleColor(user.role)}`}
                >
                  <div className="flex items-center space-x-2">
                    {getRoleIcon(user.role)}
                    <span className="capitalize">{user.role}</span>
                  </div>
                </button>

                {showAccountMenu && (
                  <div className="absolute right-0 mt-3 w-48 bg-white/95 backdrop-blur-xl border border-gray-200 rounded-2xl shadow-2xl z-20 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <button
                      onClick={() => {
                        setShowAccountMenu(false)
                        logout()
                        toast.success('Logged out successfully')
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Logout</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Premium Notification Panel */}
      {showNotificationPanel && (user.role === 'admin' || user.role === 'superadmin') && (
        <div className="notification-panel bg-white/80 backdrop-blur-xl border-b border-white/20 shadow-xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-primary-100 rounded-xl">
                  <Bell className="w-5 h-5 text-primary-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Notifications</h2>
                {notifications.length > 0 && (
                  <span className="bg-gradient-to-r from-red-500 to-red-600 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center shadow-lg">
                    {notifications.length}
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowNotificationPanel(false)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-xl transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-3">
              {notifications.length === 0 ? (
                <div className="text-center py-12 text-gray-500 bg-white/50 rounded-2xl backdrop-blur">
                  <div className="p-4 bg-gray-100 rounded-2xl w-fit mx-auto mb-4">
                    <Bell className="w-12 h-12 text-gray-300" />
                  </div>
                  <p className="font-medium">No notifications yet</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="border border-orange-200/50 bg-gradient-to-br from-orange-50 to-orange-100/50 rounded-2xl p-4 shadow-md hover:shadow-lg transition-all duration-200"
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-500 rounded-xl flex items-center justify-center shadow-md">
                          <UserIcon className="w-5 h-5 text-white" />
                        </div>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-orange-800 flex items-center gap-2 mb-2">
                          <span>⚠️</span>
                          Disabled User Login Attempt
                        </div>
                        <div className="text-sm space-y-1">
                          <div className="font-semibold text-gray-900">{notification.userName}</div>
                          <div className="text-gray-700">{notification.userEmail}</div>
                          <div className="text-xs text-gray-500 mt-2 bg-white/60 rounded-lg px-2 py-1 inline-block">
                            🕒 {new Date(notification.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex-shrink-0 flex items-center space-x-2">
                        <button
                          onClick={() => handleActivateUser(notification.userId)}
                          className="flex items-center space-x-1 bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-2 rounded-xl text-xs font-semibold hover:shadow-lg transition-all duration-200 transform hover:scale-105"
                        >
                          <Check className="w-3 h-3" />
                          <span>Activate</span>
                        </button>
                        
                        <button
                          onClick={() => handleCloseNotification(notification.id)}
                          className="flex items-center space-x-1 bg-white text-gray-700 px-4 py-2 rounded-xl text-xs font-semibold hover:bg-gray-50 border border-gray-200 transition-all duration-200 transform hover:scale-105"
                        >
                          <X className="w-3 h-3" />
                          <span>Close</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Premium Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <a href="/users" className="group relative overflow-hidden bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer border border-white/20 hover:scale-105 hover:-translate-y-1">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg group-hover:shadow-blue-500/50 transition-shadow duration-300">
                  <Users className="w-7 h-7 text-white" />
                </div>
                <div className="text-xs font-semibold text-blue-600 bg-blue-100 px-3 py-1 rounded-full">All</div>
              </div>
              <p className="text-sm font-semibold text-gray-600 mb-1">Total Users</p>
              <p className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent">{stats.totalUsers}</p>
            </div>
          </a>

          <a href="/groups" className="group relative overflow-hidden bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer border border-white/20 hover:scale-105 hover:-translate-y-1">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-500/10 to-green-600/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-green-500 to-green-600 shadow-lg group-hover:shadow-green-500/50 transition-shadow duration-300">
                  <MessageSquare className="w-7 h-7 text-white" />
                </div>
                <div className="text-xs font-semibold text-green-600 bg-green-100 px-3 py-1 rounded-full">Active</div>
              </div>
              <p className="text-sm font-semibold text-gray-600 mb-1">My Groups</p>
              <p className="text-3xl font-bold bg-gradient-to-r from-green-600 to-green-500 bg-clip-text text-transparent">{stats.totalGroups}</p>
            </div>
          </a>

          <a href="/users" className="group relative overflow-hidden bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer border border-white/20 hover:scale-105 hover:-translate-y-1">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg group-hover:shadow-emerald-500/50 transition-shadow duration-300">
                  <Users className="w-7 h-7 text-white" />
                </div>
                <div className="text-xs font-semibold text-emerald-600 bg-emerald-100 px-3 py-1 rounded-full">Online</div>
              </div>
              <p className="text-sm font-semibold text-gray-600 mb-1">Active Users</p>
              <p className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent">{stats.activeUsers}</p>
            </div>
          </a>

          <a href="/users" className="group relative overflow-hidden bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer border border-white/20 hover:scale-105 hover:-translate-y-1">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-red-500/10 to-red-600/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-red-500 to-red-600 shadow-lg group-hover:shadow-red-500/50 transition-shadow duration-300">
                  <Users className="w-7 h-7 text-white" />
                </div>
                <div className="text-xs font-semibold text-red-600 bg-red-100 px-3 py-1 rounded-full">Offline</div>
              </div>
              <p className="text-sm font-semibold text-gray-600 mb-1">Disabled Users</p>
              <p className="text-3xl font-bold bg-gradient-to-r from-red-600 to-red-500 bg-clip-text text-transparent">{stats.disabledUsers}</p>
            </div>
          </a>
        </div>

        {/* Premium Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chat Section */}
          <div className="group relative overflow-hidden bg-white/70 backdrop-blur-sm rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 border border-white/20">
            <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-purple-500/10 to-purple-600/5 rounded-full -mr-20 -mt-20 group-hover:scale-150 transition-transform duration-500"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xl font-bold text-gray-900">Quick Chat</h3>
                <div className="p-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg">
                  <MessageSquare className="w-6 h-6 text-white" />
                </div>
              </div>
              <p className="text-gray-600 mb-6 leading-relaxed">
                Start chatting with other users or join group conversations instantly.
              </p>
              <a
                href="/chat"
                className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-xl font-semibold shadow-lg hover:shadow-purple-500/50 transition-all duration-200 transform hover:scale-105"
              >
                <MessageSquare className="w-5 h-5 mr-2" />
                Open Chat
              </a>
            </div>
          </div>

          {/* Management Section */}
          {user.role !== 'user' && (
            <div className="group relative overflow-hidden bg-white/70 backdrop-blur-sm rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 border border-white/20">
              <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-indigo-500/10 to-indigo-600/5 rounded-full -mr-20 -mt-20 group-hover:scale-150 transition-transform duration-500"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-xl font-bold text-gray-900">Management</h3>
                  <div className="p-3 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl shadow-lg">
                    <Settings className="w-6 h-6 text-white" />
                  </div>
                </div>
                <p className="text-gray-600 mb-6 leading-relaxed">
                  {user.role === 'superadmin' 
                    ? 'Manage admins and view all users in the system.'
                    : 'Manage users and create groups for team communication.'
                  }
                </p>
                <div className="space-y-3">
                  {/* Manage Users Button */}
                  <a
                    href="/users"
                    className="group/btn w-full inline-flex items-center justify-between px-5 py-4 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white rounded-xl shadow-lg hover:shadow-teal-500/50 transition-all duration-200 transform hover:scale-105"
                  >
                    <div className="flex items-center">
                      <UserIcon className="w-6 h-6 mr-3" />
                      <span className="font-semibold">Manage Users</span>
                    </div>
                    <Plus className="w-5 h-5 group-hover/btn:rotate-90 transition-transform" />
                  </a>
                  
                  {/* Manage Groups Button */}
                  {user.role === 'admin' && (
                    <a
                      href="/groups"
                      className="group/btn w-full inline-flex items-center justify-between px-5 py-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl shadow-lg hover:shadow-blue-500/50 transition-all duration-200 transform hover:scale-105"
                    >
                      <div className="flex items-center">
                        <Users className="w-6 h-6 mr-3" />
                        <span className="font-semibold">Manage Groups</span>
                      </div>
                      <Plus className="w-5 h-5 group-hover/btn:rotate-90 transition-transform" />
                    </a>
                  )}
                  
                  {/* Manage Daily Updates Button */}
                  <a
                    href="/manage-daily-updates"
                    className="group/btn w-full inline-flex items-center justify-between px-5 py-4 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl shadow-lg hover:shadow-orange-500/50 transition-all duration-200 transform hover:scale-105"
                  >
                    <div className="flex items-center">
                      <MessageCircle className="w-6 h-6 mr-3" />
                      <span className="font-semibold">Daily Updates</span>
                    </div>
                    <Plus className="w-5 h-5 group-hover/btn:rotate-90 transition-transform" />
                  </a>
                  
                  {/* Manage Tasks Button */}
                  <a
                    href="/manage-tasks"
                    className="group/btn w-full inline-flex items-center justify-between px-5 py-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-xl shadow-lg hover:shadow-green-500/50 transition-all duration-200 transform hover:scale-105"
                  >
                    <div className="flex items-center">
                      <Shield className="w-6 h-6 mr-3" />
                      <span className="font-semibold">Manage Tasks</span>
                    </div>
                    <Plus className="w-5 h-5 group-hover/btn:rotate-90 transition-transform" />
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* User Info Section */}
          <div className="group relative overflow-hidden bg-white/70 backdrop-blur-sm rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 border border-white/20">
            <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 rounded-full -mr-20 -mt-20 group-hover:scale-150 transition-transform duration-500"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xl font-bold text-gray-900">Account Info</h3>
                <div className="p-3 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl shadow-lg">
                  <UserIcon className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-gray-50 to-gray-100/50 rounded-xl p-4 border border-gray-200/50">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</span>
                  <p className="text-gray-900 font-semibold mt-1">{user.name}</p>
                </div>
                <div className="bg-gradient-to-r from-gray-50 to-gray-100/50 rounded-xl p-4 border border-gray-200/50">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</span>
                  <p className="text-gray-900 font-semibold mt-1">{user.email}</p>
                </div>
                <div className="bg-gradient-to-r from-gray-50 to-gray-100/50 rounded-xl p-4 border border-gray-200/50">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</span>
                  <div className="mt-2">
                    <span className={`px-4 py-2 rounded-xl text-sm font-semibold inline-flex items-center gap-2 shadow-md ${getRoleColor(user.role)}`}>
                      {getRoleIcon(user.role)}
                      <span className="capitalize">{user.role}</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* System Info (Super Admin only) */}
          {user.role === 'superadmin' && (
            <div className="group relative overflow-hidden bg-gradient-to-br from-yellow-50 to-amber-50 rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 border border-yellow-200/50">
              <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-yellow-400/20 to-yellow-600/10 rounded-full -mr-20 -mt-20 group-hover:scale-150 transition-transform duration-500"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-xl font-bold text-gray-900">System Overview</h3>
                  <div className="p-3 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl shadow-lg">
                    <Crown className="w-6 h-6 text-white" />
                  </div>
                </div>
                <p className="text-gray-700 mb-6 leading-relaxed font-medium">
                  You have full access to manage the entire system including admins and all users.
                </p>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 bg-white/60 backdrop-blur rounded-xl p-3 border border-yellow-200/50">
                    <div className="w-2 h-2 rounded-full bg-yellow-500 mt-1.5 flex-shrink-0"></div>
                    <p className="text-sm font-medium text-gray-700">Create and manage admin accounts</p>
                  </div>
                  <div className="flex items-start gap-3 bg-white/60 backdrop-blur rounded-xl p-3 border border-yellow-200/50">
                    <div className="w-2 h-2 rounded-full bg-yellow-500 mt-1.5 flex-shrink-0"></div>
                    <p className="text-sm font-medium text-gray-700">View all system users</p>
                  </div>
                  <div className="flex items-start gap-3 bg-white/60 backdrop-blur rounded-xl p-3 border border-yellow-200/50">
                    <div className="w-2 h-2 rounded-full bg-yellow-500 mt-1.5 flex-shrink-0"></div>
                    <p className="text-sm font-medium text-gray-700">Monitor system activity</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* WebRTC Call UI - for 1-on-1 calls */}
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

      {/* Incoming Jitsi Call Notification - for group video calls */}
      {showGroupCallUI && groupCallData && isIncomingGroupCall && groupCallData.callType === 'video' && (
        <IncomingJitsiCall
          callData={groupCallData}
          onAccept={() => {
            console.log('📞 Admin Dashboard - Accepting incoming video call')
            setIsIncomingGroupCall(false)
            
            // Notify via socket for real-time updates
            if (socket && groupCallData?.callId) {
              socket.emit('group-call-join', {
                callId: groupCallData.callId,
                groupId: groupCallData.groupId,
              })
            }
          }}
          onDecline={() => {
            setShowGroupCallUI(false)
            setGroupCallData(null)
            setIsIncomingGroupCall(false)
            // Notify via socket that call was declined
            if (socket && groupCallData?.callId) {
              socket.emit('group-call-decline', {
                callId: groupCallData.callId,
                groupId: groupCallData.groupId,
              })
            }
          }}
        />
      )}

      {/* Group Call UI - Use Jitsi for video calls, WebRTC for voice calls */}
      {showGroupCallUI && groupCallData && !isIncomingGroupCall && (
        groupCallData.callType === 'video' ? (
          // Use Jitsi Meet for video calls
          <JitsiGroupCall
            user={user}
            callData={groupCallData}
            onCallEnd={() => {
              setShowGroupCallUI(false)
              setGroupCallData(null)
              setIsIncomingGroupCall(false)
            }}
          />
        ) : (
          // Use WebRTC for voice-only calls
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
        )
      )}
    </div>
  )
}

export default Dashboard
