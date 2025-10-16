import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import axios from 'axios'
import { API_ORIGIN } from '../services/api'
import { 
  Calendar, 
  ArrowLeft,
  Users,
  Search,
  Image as ImageIcon,
  Video,
  ChevronLeft,
  ChevronRight,
  X,
  Filter,
  TrendingUp,
  Clock,
  Grid3x3,
  List,
  Download,
  File
} from 'lucide-react'

const ManageDailyUpdates = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [allUserUpdates, setAllUserUpdates] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedUser, setSelectedUser] = useState(null) // Selected user object
  const [previewMedia, setPreviewMedia] = useState(null)
  const [previewIndex, setPreviewIndex] = useState(0)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [viewMode, setViewMode] = useState('grid') // 'grid' or 'list'
  const [selectedDateUpdate, setSelectedDateUpdate] = useState(null) // For date popup

  // Helper function to convert date to local date string (YYYY-MM-DD) without timezone issues
  const getLocalDateString = (date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  useEffect(() => {
    fetchAllData()
  }, [])

  const fetchAllData = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      
      // Fetch all users
      console.log('🔍 Fetching all users from:', `${API_ORIGIN}/api/users`)
      const usersResponse = await axios.get(
        `${API_ORIGIN}/api/users`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      console.log('📊 Raw users response:', usersResponse.data)
      console.log('📊 Total users received:', usersResponse.data.length)
      
      // Check what roles we have
      const usersByRole = {}
      usersResponse.data.forEach(u => {
        usersByRole[u.role] = (usersByRole[u.role] || 0) + 1
      })
      console.log('📊 Users by role:', usersByRole)
      
      const regularUsers = usersResponse.data.filter(u => {
        const userId = u._id || u.id  // Check both _id and id
        console.log(`Checking user: ${u.name}, role: ${u.role}, _id: ${u._id}, id: ${u.id}`)
        return u.role === 'user' && userId
      })
      console.log('✅ Regular users found:', regularUsers.length)
      console.log('👥 Filtered Users:', regularUsers.map(u => ({ 
        _id: u._id, 
        id: u.id, 
        name: u.name, 
        role: u.role 
      })))
      setUsers(regularUsers)

      // Fetch updates for all users
      const allUpdates = []
      for (const usr of regularUsers) {
        // Get userId - check both _id and id
        const userId = usr._id || usr.id
        
        // Skip if user doesn't have valid id
        if (!userId) {
          console.warn('⚠️ User without id:', usr)
          continue
        }

        try {
          console.log(`📥 Fetching updates for: ${usr.name} (${userId})`)
          const response = await axios.get(
            `${API_ORIGIN}/api/daily-updates/user/${userId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          )
          console.log(`✅ ${usr.name}: ${response.data.length} updates`)
          response.data.forEach(update => {
            allUpdates.push({
              ...update,
              userName: usr.name,
              userEmail: usr.email,
              userImage: usr.profileImage
            })
          })
        } catch (err) {
          console.error(`❌ Failed to fetch updates for ${usr.name}:`, err.message)
        }
      }

      console.log('✅ Total updates from all users:', allUpdates.length)
      setAllUserUpdates(allUpdates.sort((a, b) => new Date(b.date) - new Date(a.date)))
    } catch (error) {
      console.error('❌ Error fetching data:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const openMediaPreview = (mediaArray, index) => {
    setPreviewMedia(mediaArray)
    setPreviewIndex(index)
  }

  const closeMediaPreview = () => {
    setPreviewMedia(null)
    setPreviewIndex(0)
  }

  const nextMedia = () => {
    if (previewMedia && previewIndex < previewMedia.length - 1) {
      setPreviewIndex(previewIndex + 1)
    }
  }

  const prevMedia = () => {
    if (previewIndex > 0) {
      setPreviewIndex(previewIndex - 1)
    }
  }

  const getColorForUpdate = (length) => {
    if (length > 500) return 'from-green-400 to-green-600'
    if (length > 200) return 'from-blue-400 to-blue-600'
    return 'from-purple-400 to-purple-600'
  }

  // Get updates for selected user
  const selectedUserUpdates = selectedUser 
    ? allUserUpdates.filter(update => {
        const updateUserId = update.user?._id || update.user
        const selectedUserId = selectedUser._id || selectedUser.id
        return updateUserId === selectedUserId
      })
    : []

  // Filter users based on search
  const filteredUsers = users.filter(u => 
    !searchTerm || 
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Get user update count
  const getUserUpdateCount = (userId) => {
    return allUserUpdates.filter(u => {
      const updateUserId = u.user?._id || u.user
      return updateUserId === userId
    }).length
  }

  // Calendar helper functions
  const getDaysInMonth = (date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()
    return { daysInMonth, startingDayOfWeek }
  }

  const getColorForDay = (dateStr) => {
    if (!selectedUser) return { color: '', update: null }
    const userId = selectedUser._id || selectedUser.id
    const dayUpdate = allUserUpdates.find(u => {
      const updateUserId = u.user?._id || u.user
      const updateDateStr = getLocalDateString(new Date(u.date))
      return updateUserId === userId && updateDateStr === dateStr
    })
    
    if (dayUpdate) {
      const length = dayUpdate.content.length
      let color = ''
      if (length > 500) color = 'bg-gradient-to-br from-green-400 to-green-600'
      else if (length > 200) color = 'bg-gradient-to-br from-blue-400 to-blue-600'
      else color = 'bg-gradient-to-br from-purple-400 to-purple-600'
      return { color, update: dayUpdate }
    }
    return { color: '', update: null }
  }

  const handleDateClick = (dateStr) => {
    const result = getColorForDay(dateStr)
    if (result.update) {
      setSelectedDateUpdate(result.update)
    }
  }

  const closeDatePopup = () => {
    setSelectedDateUpdate(null)
  }

  const handleDownloadMedia = async (mediaUrl, filename) => {
    try {
      const response = await fetch(mediaUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename || 'download'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('Download started!')
    } catch (error) {
      console.error('Download error:', error)
      toast.error('Failed to download file')
    }
  }

  const renderCalendar = () => {
    if (!selectedUser) return null
    
    const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentMonth)
    const days = []
    const monthYear = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

    // Empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="p-2"></div>)
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
      const dateStr = getLocalDateString(date)
      const isToday = date.toDateString() === new Date().toDateString()
      const result = getColorForDay(dateStr)
      const hasUpdate = result.color !== ''

      days.push(
        <button
          key={day}
          onClick={() => handleDateClick(dateStr)}
          disabled={!hasUpdate}
          className={`
            relative p-1.5 rounded-lg text-center transition-all text-xs
            ${hasUpdate
              ? `${result.color} text-white font-bold shadow cursor-pointer hover:scale-105`
              : isToday
              ? 'bg-gray-100 text-gray-900 font-semibold border border-blue-500 cursor-default'
              : 'bg-gray-50 text-gray-600 cursor-default'
            }
          `}
        >
          <span>{day}</span>
          {hasUpdate && (
            <div className="absolute top-0.5 right-0.5">
              <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
            </div>
          )}
        </button>
      )
    }

    return (
      <div className="bg-white rounded-lg shadow p-3 border border-gray-200 mb-3">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <h3 className="text-sm font-bold text-gray-800">{monthYear}</h3>
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center mb-2">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
            <div key={idx} className="text-[10px] font-bold text-gray-500">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days}
        </div>

        {/* Legend */}
        <div className="mt-3 pt-2 border-t border-gray-200">
          <div className="flex gap-2 text-[10px]">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-gradient-to-br from-purple-400 to-purple-600"></div>
              <span className="text-gray-600">Short</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-gradient-to-br from-blue-400 to-blue-600"></div>
              <span className="text-gray-600">Med</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-gradient-to-br from-green-400 to-green-600"></div>
              <span className="text-gray-600">Long</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-3 py-3">
        {/* Header - Compact */}
        <div className="bg-white rounded-lg shadow p-4 mb-3 border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-700" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-800">
                  Manage Daily Updates
                </h1>
                <p className="text-xs text-gray-500">Monitor user daily updates</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="bg-blue-50 px-3 py-2 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  <div className="text-right">
                    <p className="text-[10px] text-gray-600">Updates</p>
                    <p className="text-sm font-bold text-gray-800">{allUserUpdates.length}</p>
                  </div>
                </div>
              </div>
              <div className="bg-purple-50 px-3 py-2 rounded-lg border border-purple-200">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-600" />
                  <div className="text-right">
                    <p className="text-[10px] text-gray-600">Users</p>
                    <p className="text-sm font-bold text-gray-800">
                      {users.filter(u => getUserUpdateCount(u._id || u.id) > 0).length}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Two Panel Layout - Compact */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
          {/* Left Panel - Users List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow border border-gray-200 sticky top-3">
              <div className="p-3 border-b border-gray-200">
                <h2 className="text-sm font-bold text-gray-800 mb-2">Users ({users.length})</h2>
                
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Users List */}
              <div className="max-h-[calc(100vh-200px)] overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
                {loading ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="text-center py-4 text-gray-500">
                    <Users className="w-8 h-8 text-gray-300 mx-auto mb-1" />
                    <p className="text-xs">No users</p>
                  </div>
                ) : (
                  filteredUsers.map(u => {
                    const userId = u._id || u.id
                    const isSelected = selectedUser && (selectedUser._id === userId || selectedUser.id === userId)
                    const updateCount = getUserUpdateCount(userId)
                    
                    return (
                      <div
                        key={userId}
                        onClick={() => setSelectedUser(u)}
                        className={`p-2.5 rounded-lg cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-md'
                            : 'bg-gray-50 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {u.profileImage ? (
                            <img
                              src={`${API_ORIGIN}${u.profileImage}`}
                              alt={u.name}
                              className="w-9 h-9 rounded-full object-cover"
                            />
                          ) : (
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                              isSelected ? 'bg-white/20' : 'bg-blue-500'
                            }`}>
                              <span className="text-white font-bold text-sm">
                                {u.name?.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold truncate ${isSelected ? 'text-white' : 'text-gray-800'}`}>
                              {u.name}
                            </p>
                            {updateCount > 0 && (
                              <div className={`text-[10px] font-semibold ${isSelected ? 'text-white/90' : 'text-blue-600'}`}>
                                {updateCount} update{updateCount !== 1 ? 's' : ''}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right Panel - Selected User Updates */}
          <div className="lg:col-span-3">
            {loading ? (
              <div className="bg-white rounded-lg shadow p-8 text-center border border-gray-200">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-500 text-sm mt-3">Loading...</p>
              </div>
            ) : !selectedUser ? (
              <div className="bg-white rounded-lg shadow p-8 text-center border border-gray-200">
                <Users className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-gray-800 mb-1">Select a User</h3>
                <p className="text-sm text-gray-500">Choose from left panel</p>
              </div>
            ) : selectedUserUpdates.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center border border-gray-200">
                <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-gray-800 mb-1">{selectedUser.name} - No updates</h3>
                <p className="text-sm text-gray-500">User hasn't created any updates yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Calendar */}
                {renderCalendar()}
                {/* User Header - Compact */}
                <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {selectedUser.profileImage ? (
                        <img
                          src={`${API_ORIGIN}${selectedUser.profileImage}`}
                          alt={selectedUser.name}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                          <span className="text-white font-bold text-lg">
                            {selectedUser.name?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="flex-1">
                        <h2 className="text-lg font-bold text-gray-800">{selectedUser.name}</h2>
                        <p className="text-xs text-gray-500">{selectedUser.email}</p>
                        <p className="text-xs text-blue-600 font-semibold">
                          {selectedUserUpdates.length} update{selectedUserUpdates.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>

                    {/* View Toggle */}
                    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                      <button
                        onClick={() => setViewMode('grid')}
                        className={`p-1.5 rounded transition-all ${
                          viewMode === 'grid'
                            ? 'bg-white text-blue-600 shadow'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                        title="Grid View"
                      >
                        <Grid3x3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setViewMode('list')}
                        className={`p-1.5 rounded transition-all ${
                          viewMode === 'list'
                            ? 'bg-white text-blue-600 shadow'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                        title="List View"
                      >
                        <List className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Updates Grid or List */}
                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {selectedUserUpdates.map(update => {
                    const colorGradient = getColorForUpdate(update.content.length)
                    return (
                      <div
                        key={update._id}
                        className={`bg-gradient-to-br ${colorGradient} p-3 rounded-xl shadow hover:shadow-lg transition-all`}
                      >
                        {/* Date */}
                        <div className="bg-white/20 backdrop-blur-sm rounded-lg p-2 mb-2">
                          <div className="flex items-center justify-between">
                            <span className="text-white font-bold text-xs">
                              {new Date(update.date).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric'
                              })}
                            </span>
                            <span className="text-white/80 text-[10px] flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              {new Date(update.updatedAt).toLocaleTimeString('en-US', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </span>
                          </div>
                        </div>

                        {/* Content */}
                        <p className="text-white text-xs leading-relaxed mb-2 line-clamp-3">
                          {update.content}
                        </p>

                        {/* Media Preview */}
                        {update.media && update.media.length > 0 && (
                          <div className="grid grid-cols-3 gap-1 mt-2">
                            {update.media.slice(0, 3).map((media, idx) => {
                              const isLastVisible = idx === 2 && update.media.length > 3
                              const remainingCount = update.media.length - 3
                              return (
                                <div
                                  key={`${update._id}-media-${idx}`}
                                  className="relative rounded overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                                  onClick={() => openMediaPreview(update.media, idx)}
                                >
                                  {media.type === 'image' ? (
                                    <img
                                      src={media.url}
                                      alt={media.filename}
                                      className="w-full h-14 object-cover"
                                    />
                                  ) : media.type === 'video' ? (
                                    <div className="w-full h-14 bg-black/20 flex items-center justify-center">
                                      <Video className="w-4 h-4 text-white" />
                                    </div>
                                  ) : (
                                    <div className="w-full h-14 bg-gray-600/20 flex items-center justify-center">
                                      <File className="w-4 h-4 text-white" />
                                    </div>
                                  )}
                                  {isLastVisible && (
                                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                                      <span className="text-white ml-14 font-bold text-lg">+{remainingCount}</span>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {/* Footer */}
                        <div className="mt-2 pt-2 border-t border-white/20 text-white/70 text-[10px]">
                          {update.content.length} chars
                        </div>
                      </div>
                    )
                  })}
                  </div>
                ) : (
                  /* List View - Compact */
                  <div className="space-y-2">
                    {selectedUserUpdates.map(update => {
                      const colorGradient = getColorForUpdate(update.content.length)
                      return (
                        <div
                          key={update._id}
                          className={`bg-gradient-to-r ${colorGradient} p-3 rounded-lg shadow hover:shadow-md transition-all`}
                        >
                          <div className="flex items-start gap-3">
                            {/* Date Badge - Compact */}
                            <div className="flex-shrink-0">
                              <div className="bg-white/20 backdrop-blur-sm rounded-lg p-2 text-center min-w-[60px]">
                                <div className="text-white font-bold text-lg">
                                  {new Date(update.date).getDate()}
                                </div>
                                <div className="text-white/90 text-[10px] font-semibold uppercase">
                                  {new Date(update.date).toLocaleDateString('en-US', { month: 'short' })}
                                </div>
                              </div>
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-white font-bold text-sm">
                                  {new Date(update.date).toLocaleDateString('en-US', { weekday: 'long' })}
                                </span>
                                <span className="text-white/80 text-[10px] flex items-center gap-1">
                                  <Clock className="w-2.5 h-2.5" />
                                  {new Date(update.updatedAt).toLocaleTimeString('en-US', { 
                                    hour: '2-digit', 
                                    minute: '2-digit' 
                                  })}
                                </span>
                              </div>
                              
                              <p className="text-white/95 text-xs leading-relaxed mb-2 line-clamp-2">
                                {update.content}
                              </p>

                              {/* Media in List View */}
                              {update.media && update.media.length > 0 && (
                                <div className="flex gap-1.5 mb-2">
                                  {update.media.slice(0, 4).map((media, idx) => {
                                    const isLastVisible = idx === 3 && update.media.length > 4
                                    const remainingCount = update.media.length - 4
                                    return (
                                      <div
                                        key={`${update._id}-media-${idx}`}
                                        className="relative rounded overflow-hidden cursor-pointer hover:opacity-70 transition-opacity"
                                        onClick={() => openMediaPreview(update.media, idx)}
                                      >
                                        {media.type === 'image' ? (
                                          <img
                                            src={media.url}
                                            alt={media.filename}
                                            className="w-12 h-12 object-cover"
                                          />
                                        ) : media.type === 'video' ? (
                                          <div className="w-12 h-12 bg-transparent flex items-center justify-center">
                                            <Video className="w-3 h-3 text-white" />
                                          </div>
                                        ) : (
                                          <div className="w-12 h-12 bg-gray-600/10 flex items-center justify-center">
                                            <File className="w-3 h-3 text-white" />
                                          </div>
                                        )}
                                        {isLastVisible && (
                                          <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
                                            <span className="text-white font-bold text-xs">+{remainingCount}</span>
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              )}

                              <span className="text-white/70 text-[10px]">
                                {update.content.length} chars
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Date Update Popup */}
      {selectedDateUpdate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-500 to-purple-500 p-6 flex items-center justify-between">
              <div className="text-white">
                <h3 className="text-2xl font-bold mb-1">
                  {new Date(selectedDateUpdate.date).toLocaleDateString('en-US', { 
                    weekday: 'long',
                    month: 'long', 
                    day: 'numeric', 
                    year: 'numeric' 
                  })}
                </h3>
                <p className="text-white/80 text-sm">
                  Last updated: {new Date(selectedDateUpdate.updatedAt).toLocaleString()}
                </p>
              </div>
              <button
                onClick={closeDatePopup}
                className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="mb-4">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Update Content</label>
                <div className="mt-2 bg-gray-50 rounded-xl p-4 border-2 border-gray-200">
                  <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
                    {selectedDateUpdate.content}
                  </p>
                </div>
              </div>

              {/* Media Display */}
              {selectedDateUpdate.media && selectedDateUpdate.media.length > 0 && (
                <div className="mb-4">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Media ({selectedDateUpdate.media.length})
                  </label>
                  <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-3">
                    {selectedDateUpdate.media.map((media, idx) => (
                      <div
                        key={`popup-media-${idx}`}
                        className="relative rounded-xl overflow-hidden cursor-pointer hover:opacity-90 transition-opacity border-2 border-gray-200"
                        onClick={() => openMediaPreview(selectedDateUpdate.media, idx)}
                      >
                        {media.type === 'image' ? (
                          <img
                            src={media.url}
                            alt={media.filename}
                            className="w-full h-32 object-cover"
                          />
                        ) : media.type === 'video' ? (
                          <video
                            src={media.url}
                            className="w-full h-32 object-cover"
                          />
                        ) : (
                          <div className="w-full h-32 bg-gray-100 flex flex-col items-center justify-center p-3">
                            <File className="w-10 h-10 text-gray-500 mb-2" />
                            <span className="text-xs text-gray-600 text-center truncate w-full">
                              {media.filename}
                            </span>
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                          <span className="text-white text-xs flex items-center gap-1 truncate">
                            {media.type === 'image' ? <ImageIcon className="w-3 h-3" /> : media.type === 'video' ? <Video className="w-3 h-3" /> : <File className="w-3 h-3" />}
                            {media.filename}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                  <p className="text-xs font-semibold text-blue-600 mb-1">Character Count</p>
                  <p className="text-2xl font-bold text-blue-700">{selectedDateUpdate.content.length}</p>
                </div>
                {selectedDateUpdate.media && (
                  <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
                    <p className="text-xs font-semibold text-purple-600 mb-1">Media Files</p>
                    <p className="text-2xl font-bold text-purple-700">{selectedDateUpdate.media.length}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Media Preview Modal */}
      {previewMedia && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center">
          {/* Close Button */}
          <button
            onClick={closeMediaPreview}
            className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white p-3 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Download Button */}
          <button
            onClick={() => handleDownloadMedia(previewMedia[previewIndex].url, previewMedia[previewIndex].filename)}
            className="absolute top-4 right-20 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-full transition-colors flex items-center gap-2 shadow-lg"
          >
            <Download className="w-5 h-5" />
            <span className="text-sm font-semibold">Download</span>
          </button>

          {/* Navigation Arrows - Always Visible */}
          {previewMedia.length > 1 && (
            <>
              <button
                onClick={prevMedia}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-4 bg-black/50 hover:bg-black/70 rounded-full transition-all shadow-lg hover:scale-110"
                title="Previous"
              >
                <ChevronLeft className="w-8 h-8 text-white stroke-[3]" />
              </button>
              <button
                onClick={nextMedia}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-4 bg-black/50 hover:bg-black/70 rounded-full transition-all shadow-lg hover:scale-110"
                title="Next"
              >
                <ChevronRight className="w-8 h-8 text-white stroke-[3]" />
              </button>
            </>
          )}

          {/* Counter */}
          {previewMedia.length > 1 && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black/50 text-white px-4 py-2 rounded-full text-sm">
              {previewIndex + 1} / {previewMedia.length}
            </div>
          )}

          {/* Media Content */}
          <div className="max-w-7xl max-h-[90vh] w-full h-full flex items-center justify-center p-4">
            {previewMedia[previewIndex].type === 'image' ? (
              <img
                src={previewMedia[previewIndex].url}
                alt={previewMedia[previewIndex].filename}
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            ) : (
              <video
                src={previewMedia[previewIndex].url}
                controls
                autoPlay
                className="max-w-full max-h-full rounded-lg"
              />
            )}
          </div>

          {/* Filename & Instructions */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-2">
            <div className="bg-black/50 text-white px-4 py-2 rounded-full text-sm max-w-md truncate">
              {previewMedia[previewIndex].filename}
            </div>
            <div className="text-white/60 text-xs">
              Press ESC to close • Arrow keys to navigate • Click Download to save
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .line-clamp-3 {
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .line-clamp-4 {
          display: -webkit-box;
          -webkit-line-clamp: 4;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f3f4f6;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(to bottom, #3b82f6, #8b5cf6);
          border-radius: 10px;
        }
      `}} />
    </div>
  )
}

export default ManageDailyUpdates
