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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <Link to="/profile" className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
                {user.profileImage ? (
                  <img
                    src={`${API_ORIGIN}${user.profileImage}`}
                    alt="Profile"
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-primary-600 font-medium text-lg">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                  <p className="text-gray-600">Welcome back, {user.name}!</p>
                </div>
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              {/* Notification Bell - Only for Admin and SuperAdmin */}
              {(user.role === 'admin' || user.role === 'superadmin') && (
                <div className="relative">
                  <button
                    onClick={() => setShowNotificationPanel(!showNotificationPanel)}
                    className="relative p-2 text-gray-600 hover:text-primary-600 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <Bell className="w-6 h-6" />
                    {notifications.length > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                        {notifications.length}
                      </span>
                    )}
                  </button>
                </div>
              )}
              
              <div className="relative account-menu-container">
                <button
                  onClick={() => setShowAccountMenu((v) => !v)}
                  className={`px-3 py-1 rounded-full text-sm font-medium hover:opacity-90 transition ${getRoleColor(user.role)}`}
                >
                  <div className="flex items-center space-x-1">
                    {getRoleIcon(user.role)}
                    <span className="capitalize">{user.role}</span>
                  </div>
                </button>

                {showAccountMenu && (
                  <div className="absolute right-0 mt-2 w-44 bg-white border border-gray-200 rounded-md shadow-lg z-20">
                    <button
                      onClick={() => {
                        setShowAccountMenu(false)
                        logout()
                        toast.success('Logged out successfully')
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
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

      {/* Notification Panel */}
      {showNotificationPanel && (user.role === 'admin' || user.role === 'superadmin') && (
        <div className="notification-panel bg-white border-b shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Bell className="w-5 h-5 text-primary-600" />
                <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
                {notifications.length > 0 && (
                  <span className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {notifications.length}
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowNotificationPanel(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-3">
              {notifications.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p>No notifications yet</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="border border-orange-200 bg-orange-50 rounded-lg p-4"
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                          <UserIcon className="w-4 h-4 text-orange-600" />
                        </div>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-orange-700 flex items-center gap-2">
                          <span>⚠️</span>
                          Disabled User Login Attempt
                        </div>
                        <div className="mt-1 text-sm">
                          <div className="font-semibold text-gray-900">{notification.userName}</div>
                          <div className="text-gray-600">{notification.userEmail}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            Time: {new Date(notification.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex-shrink-0 flex items-center space-x-2">
                        <button
                          onClick={() => handleActivateUser(notification.userId)}
                          className="flex items-center space-x-1 bg-green-600 text-white px-3 py-1.5 rounded-md text-xs font-medium hover:bg-green-700 transition-colors"
                        >
                          <Check className="w-3 h-3" />
                          <span>Activate</span>
                        </button>
                        
                        <button
                          onClick={() => handleCloseNotification(notification.id)}
                          className="flex items-center space-x-1 bg-gray-100 text-gray-700 px-3 py-1.5 rounded-md text-xs font-medium hover:bg-gray-200 transition-colors"
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
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="card p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalUsers}</p>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-100">
                <MessageSquare className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">My Groups</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalGroups}</p>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-100">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Users</p>
                <p className="text-2xl font-bold text-gray-900">{stats.activeUsers}</p>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-red-100">
                <Users className="w-6 h-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Disabled Users</p>
                <p className="text-2xl font-bold text-gray-900">{stats.disabledUsers}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Chat Section */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Quick Chat</h3>
              <MessageSquare className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-gray-600 mb-4">
              Start chatting with other users or join group conversations.
            </p>
            <a
              href="/chat"
              className="btn-primary inline-flex items-center"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Open Chat
            </a>
          </div>

          {/* Management Section */}
          {user.role !== 'user' && (
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Management</h3>
                <Settings className="w-5 h-5 text-gray-400" />
              </div>
              <p className="text-gray-600 mb-4">
                {user.role === 'superadmin' 
                  ? 'Manage admins and view all users in the system.'
                  : 'Manage users and create groups for team communication.'
                }
              </p>
              <div className="space-y-3">
                <a
                  href="/users"
                  className="btn-secondary w-full inline-flex items-center justify-center"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  {user.role === 'superadmin' ? 'Manage Admins' : 'Manage Users'}
                </a>
                {user.role === 'admin' && (
                  <a
                    href="/groups"
                    className="btn-primary w-full inline-flex items-center justify-center"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Manage Groups
                  </a>
                )}
              </div>
            </div>
          )}

          {/* User Info Section */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Account Info</h3>
              <UserIcon className="w-5 h-5 text-gray-400" />
            </div>
            <div className="space-y-2">
              <div>
                <span className="text-sm font-medium text-gray-600">Name:</span>
                <span className="ml-2 text-gray-900">{user.name}</span>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600">Email:</span>
                <span className="ml-2 text-gray-900">{user.email}</span>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600">Role:</span>
                <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                  {user.role}
                </span>
              </div>
            </div>
          </div>

          {/* System Info (Super Admin only) */}
          {user.role === 'superadmin' && (
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">System Overview</h3>
                <Crown className="w-5 h-5 text-yellow-600" />
              </div>
              <p className="text-gray-600 mb-4">
                You have full access to manage the entire system including admins and all users.
              </p>
              <div className="text-sm text-gray-500">
                <p>• Create and manage admin accounts</p>
                <p>• View all system users</p>
                <p>• Monitor system activity</p>
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
