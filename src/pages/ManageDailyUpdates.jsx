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
  const [showAllUsersCalendar, setShowAllUsersCalendar] = useState(false) // For all users calendar view
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(new Date()) // Selected date for calendar

  // Helper function to convert date to local date string (YYYY-MM-DD) without timezone issues
  const getLocalDateString = (date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Get all users' updates for a specific date
  const getAllUsersUpdatesForDate = (date) => {
    const dateString = getLocalDateString(date)
    console.log('🔍 Searching for updates on:', dateString)
    console.log('📊 Total allUserUpdates:', allUserUpdates.length)
    
    const filtered = allUserUpdates.filter(update => {
      // Check both date and createdAt fields
      const updateDateField = update.date || update.createdAt
      if (!updateDateField) {
        console.log('⚠️ Update without date:', update)
        return false
      }
      const updateDate = getLocalDateString(new Date(updateDateField))
      const matches = updateDate === dateString
      if (matches) {
        console.log('✅ Found matching update:', { updateDate, content: update.content?.substring(0, 50) })
      }
      return matches
    })
    
    console.log('📊 Filtered updates count:', filtered.length)
    return filtered
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
      if (allUpdates.length > 0) {
        console.log('📋 Sample update structure:', {
          date: allUpdates[0].date,
          createdAt: allUpdates[0].createdAt,
          content: allUpdates[0].content?.substring(0, 50),
          userName: allUpdates[0].userName
        })
      }
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

  // Excel Download Functions
  const downloadIndividualUserExcel = () => {
    if (!selectedUser || selectedUserUpdates.length === 0) {
      toast.error('No updates to download')
      return
    }

    try {
      // Create CSV content
      let csvContent = 'data:text/csv;charset=utf-8,'
      
      // Add headers
      csvContent += 'Date,Day,Content,Character Count,Media Count,Created At,Updated At\n'
      
      // Add data rows
      selectedUserUpdates.forEach(update => {
        const date = new Date(update.date)
        const dateStr = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        const dayStr = date.toLocaleDateString('en-US', { weekday: 'long' })
        const content = `"${(update.content || '').replace(/"/g, '""')}"`
        const charCount = update.content?.length || 0
        const mediaCount = update.media?.length || 0
        const createdAt = new Date(update.createdAt).toLocaleString()
        const updatedAt = new Date(update.updatedAt).toLocaleString()
        
        csvContent += `"${dateStr}","${dayStr}",${content},${charCount},${mediaCount},"${createdAt}","${updatedAt}"\n`
      })

      // Create download link
      const encodedUri = encodeURI(csvContent)
      const link = document.createElement('a')
      link.setAttribute('href', encodedUri)
      link.setAttribute('download', `${selectedUser.name}_DailyUpdates_${new Date().toISOString().split('T')[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      toast.success(`Downloaded ${selectedUserUpdates.length} updates for ${selectedUser.name}`)
    } catch (error) {
      console.error('Download error:', error)
      toast.error('Failed to download Excel file')
    }
  }

  const downloadAllUsersMonthlyExcel = () => {
    if (allUserUpdates.length === 0) {
      toast.error('No updates to download')
      return
    }

    try {
      // Create CSV content
      let csvContent = 'data:text/csv;charset=utf-8,'
      
      // Add headers
      csvContent += 'User Name,User Email,Date,Day,Content,Character Count,Media Count,Created At\n'
      
      // Group updates by user
      const updatesByUser = {}
      allUserUpdates.forEach(update => {
        const userId = update.user?._id || update.user || update.userId
        if (!updatesByUser[userId]) {
          updatesByUser[userId] = []
        }
        updatesByUser[userId].push(update)
      })

      // Add data rows
      Object.keys(updatesByUser).forEach(userId => {
        const userUpdates = updatesByUser[userId]
        const userData = users.find(u => (u._id || u.id) === userId)
        const userName = userData?.name || 'Unknown User'
        const userEmail = userData?.email || 'N/A'
        
        userUpdates.forEach(update => {
          const date = new Date(update.date || update.createdAt)
          const dateStr = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
          const dayStr = date.toLocaleDateString('en-US', { weekday: 'long' })
          const content = `"${(update.content || '').replace(/"/g, '""')}"`
          const charCount = update.content?.length || 0
          const mediaCount = update.media?.length || 0
          const createdAt = new Date(update.createdAt).toLocaleString()
          
          csvContent += `"${userName}","${userEmail}","${dateStr}","${dayStr}",${content},${charCount},${mediaCount},"${createdAt}"\n`
        })
      })

      // Create download link
      const encodedUri = encodeURI(csvContent)
      const link = document.createElement('a')
      link.setAttribute('href', encodedUri)
      const monthYear = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
      link.setAttribute('download', `AllUsers_DailyUpdates_${monthYear}_${new Date().toISOString().split('T')[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      toast.success(`Downloaded ${allUserUpdates.length} updates from ${Object.keys(updatesByUser).length} users`)
    } catch (error) {
      console.error('Download error:', error)
      toast.error('Failed to download Excel file')
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
            relative p-2 rounded-xl text-center transition-all duration-200 text-sm font-semibold
            ${hasUpdate
              ? `${result.color} text-white shadow-lg cursor-pointer hover:scale-110 hover:shadow-xl transform`
              : isToday
              ? 'bg-gradient-to-br from-primary-100 to-primary-200 text-primary-900 font-bold border-2 border-primary-500 cursor-default shadow-md'
              : 'bg-gray-100/50 text-gray-600 cursor-default hover:bg-gray-200/50'
            }
          `}
        >
          <span>{day}</span>
          {hasUpdate && (
            <div className="absolute top-1 right-1">
              <div className="w-2 h-2 bg-white rounded-full shadow-lg animate-pulse"></div>
            </div>
          )}
        </button>
      )
    }

    return (
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg p-5 border border-white/20 mb-5">
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
            className="p-2 hover:bg-primary-50 rounded-xl transition-all duration-200 transform hover:scale-110"
          >
            <ChevronLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h3 className="text-lg font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
            {monthYear}
          </h3>
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
            className="p-2 hover:bg-primary-50 rounded-xl transition-all duration-200 transform hover:scale-110"
          >
            <ChevronRight className="w-5 h-5 text-gray-700" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-2 text-center mb-3">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
            <div key={idx} className="text-xs font-bold text-gray-600 py-2">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {days}
        </div>

        {/* Premium Legend */}
        <div className="mt-5 pt-4 border-t border-gray-200/50">
          <div className="flex gap-4 text-xs justify-center">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-lg bg-gradient-to-br from-purple-400 to-purple-600 shadow-md"></div>
              <span className="text-gray-700 font-semibold">Short</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 shadow-md"></div>
              <span className="text-gray-700 font-semibold">Medium</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-lg bg-gradient-to-br from-green-400 to-green-600 shadow-md"></div>
              <span className="text-gray-700 font-semibold">Long</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Premium Header */}
        <div className="bg-white/80 backdrop-blur-xl shadow-lg rounded-2xl p-6 mb-6 border border-white/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center justify-center w-12 h-12 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-all duration-200 transform hover:scale-110"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                  Manage Daily Updates
                </h1>
                <p className="text-sm text-gray-600 font-medium mt-1">Monitor and track user daily updates</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="group relative overflow-hidden bg-gradient-to-br from-blue-50 to-blue-100/50 px-5 py-3 rounded-xl border border-blue-200/50 shadow-md hover:shadow-lg transition-all duration-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-gray-600">Total Updates</p>
                    <p className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent">
                      {allUserUpdates.length}
                    </p>
                  </div>
                </div>
              </div>
              <div className="group relative overflow-hidden bg-gradient-to-br from-purple-50 to-purple-100/50 px-5 py-3 rounded-xl border border-purple-200/50 shadow-md hover:shadow-lg transition-all duration-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-gray-600">Active Users</p>
                    <p className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-purple-500 bg-clip-text text-transparent">
                      {users.filter(u => getUserUpdateCount(u._id || u.id) > 0).length}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Download All Users Button */}
              <button
                onClick={downloadAllUsersMonthlyExcel}
                disabled={allUserUpdates.length === 0}
                className="group relative overflow-hidden bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 px-5 py-3 rounded-xl shadow-lg hover:shadow-green-500/50 transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                title="Download all users' monthly updates"
              >
                <div className="flex items-center gap-2">
                  <Download className="w-5 h-5 text-white" />
                  <div className="text-left">
                    <p className="text-xs font-semibold text-white/90">Export All</p>
                    <p className="text-sm font-bold text-white">Download Excel</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Premium Two Panel Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Panel - Users List */}
          <div className="lg:col-span-1">
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 sticky top-6 overflow-hidden">
              <div className="bg-gradient-to-r from-primary-500 to-primary-600 p-5">
                <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Users ({users.length})
                </h2>
                
                {/* Premium Search */}
                <div className="relative">
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                    <Search className="text-white/70 w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 text-sm bg-white/20 backdrop-blur border-2 border-white/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 text-white placeholder:text-white/70 font-medium transition-all duration-200"
                  />
                </div>
              </div>

              {/* Toggle View Button */}
              <div className="p-4">
                <button
                  onClick={() => setShowAllUsersCalendar(!showAllUsersCalendar)}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-3.5 px-4 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-purple-500/50 transform hover:scale-105"
                >
                  <Calendar className="w-5 h-5" />
                  {showAllUsersCalendar ? 'View Users List' : 'View Calendar'}
                </button>
              </div>

              {/* Premium Users List */}
              <div className="max-h-[calc(100vh-320px)] overflow-y-auto px-4 pb-4 space-y-2 custom-scrollbar">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="relative inline-block">
                      <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-200"></div>
                      <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-primary-600 absolute top-0 left-0"></div>
                    </div>
                    <p className="mt-3 text-sm text-gray-600 font-medium">Loading users...</p>
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="text-center py-8 bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-xl">
                    <div className="p-3 bg-gray-200 rounded-xl w-fit mx-auto mb-3">
                      <Users className="w-10 h-10 text-gray-400" />
                    </div>
                    <p className="text-sm font-semibold text-gray-700">No users found</p>
                    <p className="text-xs text-gray-500 mt-1">Try adjusting your search</p>
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
                        className={`group relative p-3 rounded-xl cursor-pointer transition-all duration-200 ${
                          isSelected
                            ? 'bg-gradient-to-r from-primary-500 to-primary-600 shadow-lg shadow-primary-500/50 scale-105'
                            : 'bg-white/70 backdrop-blur hover:bg-white hover:shadow-md'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            {u.profileImage ? (
                              <img
                                src={`${API_ORIGIN}${u.profileImage}`}
                                alt={u.name}
                                className={`w-12 h-12 rounded-xl object-cover ring-2 ${
                                  isSelected ? 'ring-white/50' : 'ring-primary-100'
                                } transition-all duration-200`}
                              />
                            ) : (
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-md ${
                                isSelected ? 'bg-white/20 ring-2 ring-white/50' : 'bg-gradient-to-br from-primary-400 to-primary-600'
                              }`}>
                                <span className="text-white font-bold text-lg">
                                  {u.name?.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                            {updateCount > 0 && (
                              <div className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shadow-lg ${
                                isSelected ? 'bg-white text-primary-600' : 'bg-gradient-to-br from-green-500 to-green-600 text-white'
                              }`}>
                                {updateCount}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-bold truncate ${isSelected ? 'text-white' : 'text-gray-800'}`}>
                              {u.name}
                            </p>
                            <p className={`text-xs font-medium truncate ${isSelected ? 'text-white/80' : 'text-gray-500'}`}>
                              {u.email}
                            </p>
                            {updateCount > 0 && (
                              <div className={`text-xs font-semibold mt-1 ${isSelected ? 'text-white/90' : 'text-primary-600'}`}>
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
            ) : showAllUsersCalendar ? (
              /* Calendar and All Users Updates View */
              <div className="space-y-4">
                {/* Calendar Header */}
                <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-3">
                    <Calendar className="w-5 h-5 text-purple-600" />
                    All Users Calendar
                  </h3>
                  
                  {/* Calendar Navigation */}
                  <div className="flex items-center justify-between mb-3">
                    <button
                      onClick={() => setSelectedCalendarDate(new Date(selectedCalendarDate.getFullYear(), selectedCalendarDate.getMonth() - 1, selectedCalendarDate.getDate()))}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-lg font-medium text-gray-800">
                      {selectedCalendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </span>
                    <button
                      onClick={() => setSelectedCalendarDate(new Date(selectedCalendarDate.getFullYear(), selectedCalendarDate.getMonth() + 1, selectedCalendarDate.getDate()))}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Calendar Grid */}
                  <div className="grid grid-cols-7 gap-1 text-sm">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => (
                      <div key={day} className="text-center text-gray-500 py-2 font-medium">
                        {day}
                      </div>
                    ))}
                    
                    {Array.from({ length: new Date(selectedCalendarDate.getFullYear(), selectedCalendarDate.getMonth() + 1, 0).getDate() }, (_, i) => {
                      const day = i + 1
                      const date = new Date(selectedCalendarDate.getFullYear(), selectedCalendarDate.getMonth(), day)
                      const dateString = getLocalDateString(date)
                      const updatesForDate = getAllUsersUpdatesForDate(date)
                      const isSelected = getLocalDateString(selectedCalendarDate) === dateString
                      const isToday = getLocalDateString(new Date()) === dateString
                      
                      return (
                        <button
                          key={day}
                          onClick={() => setSelectedCalendarDate(date)}
                          className={`p-2 rounded-lg text-sm transition-all ${
                            isSelected
                              ? 'bg-purple-500 text-white font-bold'
                              : isToday
                              ? 'bg-blue-100 text-blue-600 font-semibold'
                              : updatesForDate.length > 0
                              ? 'bg-green-100 text-green-600 hover:bg-green-200'
                              : 'hover:bg-gray-100'
                          }`}
                        >
                          <div className="flex flex-col items-center">
                            <span>{day}</span>
                            {updatesForDate.length > 0 && (
                              <span className="text-xs">({updatesForDate.length})</span>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Updates for Selected Date */}
                <div className="bg-white rounded-lg shadow border border-gray-200">
                  <div className="p-4 border-b border-gray-200">
                    <h4 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-green-600" />
                      {selectedCalendarDate.toLocaleDateString('en-US', { 
                        weekday: 'long',
                        month: 'long', 
                        day: 'numeric',
                        year: 'numeric'
                      })} Updates
                    </h4>
                  </div>
                  
                  <div className="p-4">
                    {(() => {
                      const updatesForSelectedDate = getAllUsersUpdatesForDate(selectedCalendarDate)
                      
                      if (updatesForSelectedDate.length === 0) {
                        return (
                          <div className="text-center py-8 text-gray-500">
                            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-lg font-medium">No updates for this date</p>
                            <p className="text-sm">Users haven't created any updates yet</p>
                          </div>
                        )
                      }

                      return (
                        <div className="space-y-4 max-h-[500px] overflow-y-auto">
                          {updatesForSelectedDate.map((update, index) => {
                            const user = users.find(u => (u._id || u.id) === (update.userId || update.user))
                            return (
                              <div key={update._id || index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                <div className="flex items-start gap-3">
                                  {user?.profileImage ? (
                                    <img
                                      src={`${API_ORIGIN}${user.profileImage}`}
                                      alt={user.name}
                                      className="w-10 h-10 rounded-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
                                      <span className="text-white text-sm font-bold">
                                        {user?.name?.charAt(0).toUpperCase() || 'U'}
                                      </span>
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-sm font-semibold text-gray-800">
                                        {user?.name || 'Unknown'}
                                      </span>
                                      <span className="text-xs text-gray-500">
                                        {new Date(update.createdAt).toLocaleTimeString([], { 
                                          hour: '2-digit', 
                                          minute: '2-digit' 
                                        })}
                                      </span>
                                    </div>
                                    <p className="text-sm text-gray-700 mb-3">{update.content}</p>
                                    
                                    {/* Media attachments */}
                                    {update.attachments && update.attachments.length > 0 && (
                                      <div className="flex gap-2">
                                        {update.attachments.map((attachment, idx) => (
                                          <div key={idx} className="flex items-center gap-1 text-xs text-gray-600 bg-white px-2 py-1 rounded border">
                                            {attachment.type === 'image' ? (
                                              <ImageIcon className="w-4 h-4" />
                                            ) : attachment.type === 'video' ? (
                                              <Video className="w-4 h-4" />
                                            ) : (
                                              <File className="w-4 h-4" />
                                            )}
                                            <span>{attachment.type}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })()}
                  </div>
                </div>
              </div>
            ) : !selectedUser ? (
              <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg p-12 text-center border border-white/20">
                <div className="p-6 bg-gradient-to-br from-gray-100 to-gray-200/50 rounded-2xl w-fit mx-auto mb-6">
                  <Users className="w-20 h-20 text-gray-400" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Select a User</h3>
                <p className="text-sm text-gray-600 font-medium">Choose a user from the left panel to view their daily updates</p>
              </div>
            ) : selectedUserUpdates.length === 0 ? (
              <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg p-12 text-center border border-white/20">
                <div className="p-6 bg-gradient-to-br from-blue-100 to-blue-200/50 rounded-2xl w-fit mx-auto mb-6">
                  <Calendar className="w-20 h-20 text-blue-400" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{selectedUser.name}</h3>
                <p className="text-sm text-gray-600 font-medium">No updates available yet</p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Calendar */}
                {renderCalendar()}
                {/* Premium User Header */}
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg p-6 border border-white/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {selectedUser.profileImage ? (
                        <img
                          src={`${API_ORIGIN}${selectedUser.profileImage}`}
                          alt={selectedUser.name}
                          className="w-16 h-16 rounded-2xl object-cover ring-4 ring-primary-100 shadow-lg"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center ring-4 ring-primary-100 shadow-lg">
                          <span className="text-white font-bold text-2xl">
                            {selectedUser.name?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="flex-1">
                        <h2 className="text-xl font-bold text-gray-900">{selectedUser.name}</h2>
                        <p className="text-sm text-gray-600 font-medium">{selectedUser.email}</p>
                        <div className="mt-2 inline-flex items-center gap-2 bg-gradient-to-r from-primary-100 to-primary-200 px-3 py-1 rounded-lg">
                          <Calendar className="w-4 h-4 text-primary-600" />
                          <span className="text-sm text-primary-900 font-bold">
                            {selectedUserUpdates.length} update{selectedUserUpdates.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Download Individual User Button */}
                      <button
                        onClick={downloadIndividualUserExcel}
                        disabled={selectedUserUpdates.length === 0}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-xl font-semibold shadow-lg hover:shadow-green-500/50 transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                        title={`Download ${selectedUser.name}'s updates`}
                      >
                        <Download className="w-5 h-5" />
                        <span>Download Excel</span>
                      </button>

                      {/* Premium View Toggle */}
                      <div className="flex items-center rounded-xl border border-gray-200 overflow-hidden bg-white/50 backdrop-blur shadow-sm">
                        <button
                          onClick={() => setViewMode('grid')}
                          className={`px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                            viewMode === 'grid'
                              ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-md'
                              : 'bg-transparent text-gray-600 hover:bg-gray-50'
                          }`}
                          title="Grid View"
                        >
                          <Grid3x3 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => setViewMode('list')}
                          className={`px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                            viewMode === 'list'
                              ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-md'
                              : 'bg-transparent text-gray-600 hover:bg-gray-50'
                          }`}
                          title="List View"
                        >
                          <List className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Premium Updates Grid or List */}
                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {selectedUserUpdates.map(update => {
                    const colorGradient = getColorForUpdate(update.content.length)
                    return (
                      <div
                        key={update._id}
                        className={`group relative bg-gradient-to-br ${colorGradient} p-5 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 border border-white/20`}
                      >
                        {/* Date Header */}
                        <div className="bg-white/30 backdrop-blur-md rounded-xl p-3 mb-4 shadow-md">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-white" />
                              <span className="text-white font-bold text-sm">
                                {new Date(update.date).toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                              </span>
                            </div>
                            <span className="text-white/90 text-xs font-medium flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5" />
                              {new Date(update.updatedAt).toLocaleTimeString('en-US', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </span>
                          </div>
                        </div>

                        {/* Content */}
                        <p className="text-white text-sm leading-relaxed mb-4 line-clamp-4 font-medium">
                          {update.content}
                        </p>

                        {/* Media Preview */}
                        {update.media && update.media.length > 0 && (
                          <div className="grid grid-cols-3 gap-2 mb-4">
                            {update.media.slice(0, 3).map((media, idx) => {
                              const isLastVisible = idx === 2 && update.media.length > 3
                              const remainingCount = update.media.length - 3
                              return (
                                <div
                                  key={`${update._id}-media-${idx}`}
                                  className="relative rounded-xl overflow-hidden cursor-pointer transform hover:scale-105 transition-transform duration-200 shadow-md"
                                  onClick={() => openMediaPreview(update.media, idx)}
                                >
                                  {media.type === 'image' ? (
                                    <img
                                      src={media.url}
                                      alt={media.filename}
                                      className="w-full h-20 object-cover"
                                    />
                                  ) : media.type === 'video' ? (
                                    <div className="w-full h-20 bg-black/30 flex items-center justify-center backdrop-blur">
                                      <Video className="w-6 h-6 text-white" />
                                    </div>
                                  ) : (
                                    <div className="w-full h-20 bg-white/20 flex items-center justify-center backdrop-blur">
                                      <File className="w-6 h-6 text-white" />
                                    </div>
                                  )}
                                  {isLastVisible && (
                                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center">
                                      <span className="text-white font-bold text-xl">+{remainingCount}</span>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {/* Footer */}
                        <div className="flex items-center justify-between pt-3 border-t border-white/30">
                          <span className="text-white/80 text-xs font-semibold">
                            {update.content.length} characters
                          </span>
                          <div className="w-2 h-2 bg-white rounded-full shadow-lg"></div>
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


