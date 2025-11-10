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

  const formatDateForExport = (date) => {
    try {
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
    } catch {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${day}/${month}/${year}`
    }
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
      const referenceDate = selectedCalendarDate || new Date()
      const exportYear = referenceDate.getFullYear()
      const exportMonth = referenceDate.getMonth()
      const daysInMonth = new Date(exportYear, exportMonth + 1, 0).getDate()
      const userId = selectedUser._id || selectedUser.id

      const updatesByDate = new Map()
      selectedUserUpdates.forEach(update => {
        const updateDate = new Date(update.date || update.createdAt)
        if (
          updateDate.getFullYear() !== exportYear ||
          updateDate.getMonth() !== exportMonth
        ) {
          return
        }

        const dateKey = getLocalDateString(updateDate)
        if (!updatesByDate.has(dateKey)) {
          updatesByDate.set(dateKey, [])
        }
        updatesByDate.get(dateKey).push(update)
      })

      let csvContent = 'data:text/csv;charset=utf-8,'
      csvContent += 'Date,User Name,Content,Review\n'

      for (let day = 1; day <= daysInMonth; day++) {
        const dateObj = new Date(exportYear, exportMonth, day)
        const dateKey = getLocalDateString(dateObj)
        const dateStr = formatDateForExport(dateObj)
        const updatesForDay = updatesByDate.get(dateKey) || []

        let contentText = '--'

        if (updatesForDay.length > 0) {
          const contentPieces = updatesForDay.map(update => {
            const content = (update.content || '').trim()
            if (content) return content
            if (update.media?.length) {
              return `(Media attachments: ${update.media.length})`
            }
            return '(No content)'
          }).filter(Boolean)

          contentText = contentPieces.join(' | ') || '(No content)'
        }

        const safeContent = `"${contentText.replace(/"/g, '""')}"`
        const safeName = `"${(selectedUser.name || 'Unknown User').replace(/"/g, '""')}"`

        csvContent += `"${dateStr}",${safeName},${safeContent},""\n`
      }

      const encodedUri = encodeURI(csvContent)
      const link = document.createElement('a')
      link.setAttribute('href', encodedUri)
      const referenceLabel = `${exportYear}-${String(exportMonth + 1).padStart(2, '0')}`
      link.setAttribute('download', `${selectedUser.name}_DailyUpdates_${referenceLabel}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      toast.success(`Monthly export ready for ${selectedUser.name}`)
    } catch (error) {
      console.error('Download error:', error)
      toast.error('Failed to download Excel file')
    }
  }

  const downloadAllUsersMonthlyExcel = () => {
    if (users.length === 0) {
      toast.error('No users available to export')
      return
    }

    const referenceDate = selectedCalendarDate || new Date()
    const exportYear = referenceDate.getFullYear()
    const exportMonth = referenceDate.getMonth()
    const daysInMonth = new Date(exportYear, exportMonth + 1, 0).getDate()

    try {
      // Build a map of updates grouped by userId and date for quick lookups
      const updatesByUserAndDate = new Map()
      allUserUpdates.forEach(update => {
        const updateDate = new Date(update.date || update.createdAt)
        if (
          updateDate.getFullYear() !== exportYear ||
          updateDate.getMonth() !== exportMonth
        ) {
          return
        }

        const userId = update.user?._id || update.user || update.userId
        const dateKey = getLocalDateString(updateDate)

        if (!updatesByUserAndDate.has(userId)) {
          updatesByUserAndDate.set(userId, new Map())
        }
        const userDateMap = updatesByUserAndDate.get(userId)

        if (!userDateMap.has(dateKey)) {
          userDateMap.set(dateKey, [])
        }
        userDateMap.get(dateKey).push(update)
      })

      const csvRows = []
      csvRows.push('Date,User Name,Content,Review\n')

      const monthLabel = `${referenceDate.getFullYear()}-${String(referenceDate.getMonth() + 1).padStart(2, '0')}`

      const sortedUsers = [...users].sort((a, b) =>
        (a.name || '').localeCompare(b.name || '')
      )

      sortedUsers.forEach(userData => {
        const userId = userData._id || userData.id
        const userName = userData.name || 'Unknown User'
        const safeUserName = `"${userName.replace(/"/g, '""')}"`

        for (let day = 1; day <= daysInMonth; day++) {
          const dateObj = new Date(exportYear, exportMonth, day)
          const dateKey = getLocalDateString(dateObj)
          const dateDisplay = formatDateForExport(dateObj)

          let contentText = '--'
          const userDateMap = updatesByUserAndDate.get(userId)
          const updatesForDay = userDateMap?.get(dateKey) || []

          if (updatesForDay.length > 0) {
            const contentPieces = updatesForDay.map(update => {
              const content = (update.content || '').trim()
              if (content) return content
              if (update.media?.length) {
                return `(Media attachments: ${update.media.length})`
              }
              return '(No content)'
            }).filter(Boolean)

            contentText = contentPieces.join(' | ') || '(No content)'
          }

          const safeDate = `"${dateDisplay}"`
          const safeContent = `"${contentText.replace(/"/g, '""')}"`

          csvRows.push(`${safeDate},${safeUserName},${safeContent},""\n`)
        }

        csvRows.push('\n')
      })

      const csvString = csvRows.join('')
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)

      const sanitizedMonthLabel = monthLabel.replace(/\s+/g, '_')
      const link = document.createElement('a')
      link.href = url
      link.setAttribute(
        'download',
        `AllUsers_DailyUpdates_${sanitizedMonthLabel}_${getLocalDateString(new Date())}.csv`
      )
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success(`Monthly export ready for ${monthLabel}`)
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

      let statusClass = 'bg-white text-gray-600 border border-gray-200'
      if (hasUpdate) {
        if (result.color.includes('green')) {
          statusClass = 'bg-emerald-100 text-emerald-700 border border-emerald-200'
        } else if (result.color.includes('blue')) {
          statusClass = 'bg-sky-100 text-sky-700 border border-sky-200'
        } else {
          statusClass = 'bg-violet-100 text-violet-700 border border-violet-200'
        }
      } else if (isToday) {
        statusClass = 'bg-gray-900 text-white border border-gray-900'
      }

      days.push(
        <button
          key={day}
          onClick={() => handleDateClick(dateStr)}
          disabled={!hasUpdate}
          className={`relative flex h-10 w-10 items-center justify-center rounded-md text-sm font-semibold transition-colors ${statusClass} ${hasUpdate ? 'hover:border-gray-400' : ''}`}
        >
          <span>{day}</span>
          {hasUpdate && (
            <div className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-white/80"></div>
          )}
        </button>
      )
    }

    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            {monthYear}
          </h3>
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-700" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-2 text-center mb-3">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
            <div key={idx} className="text-xs font-medium text-gray-500 py-2 uppercase tracking-wide">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2 place-items-center">
          {days}
        </div>

        {/* Legend */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex gap-4 text-xs justify-center text-gray-500">
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 rounded-md border border-violet-200 bg-violet-100"></span>
              Short
            </span>
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 rounded-md border border-sky-200 bg-sky-100"></span>
              Medium
            </span>
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 rounded-md border border-emerald-200 bg-emerald-100"></span>
              Long
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mb-8">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">
                  Manage Daily Updates
                </h1>
                <p className="text-sm text-gray-500 mt-1">Monitor and review daily updates across your team.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-100 text-blue-600">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500">Total Updates</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {allUserUpdates.length}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-indigo-100 text-indigo-600">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500">Active Users</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {users.filter(u => getUserUpdateCount(u._id || u.id) > 0).length}
                  </p>
                </div>
              </div>

              {/* Download All Users Button */}
              <button
                onClick={downloadAllUsersMonthlyExcel}
                disabled={allUserUpdates.length === 0}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                title="Download all users' monthly updates"
              >
                <Download className="w-4 h-4" />
                Download Excel
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Panel - Users List */}
          <div className="lg:col-span-1">
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm sticky top-6 overflow-hidden">
              <div className="border-b border-gray-200 p-5">
                <h2 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Users className="w-5 h-5 text-gray-500" />
                  Users ({users.length})
                </h2>

                {/* Search */}
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
                  />
                </div>
              </div>

              {/* Toggle View Button */}
              <div className="p-4">
                <button
                  onClick={() => setShowAllUsersCalendar(!showAllUsersCalendar)}
                  className="w-full rounded-lg border border-gray-200 bg-white py-2.5 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                >
                  <Calendar className="w-5 h-5" />
                  {showAllUsersCalendar ? 'View Users List' : 'View Calendar'}
                </button>
              </div>

              {/* Users List */}
              <div className="max-h-[calc(100vh-320px)] overflow-y-auto px-4 pb-4 space-y-2 custom-scrollbar">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="relative inline-block">
                      <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200"></div>
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-gray-500 absolute top-0 left-0"></div>
                    </div>
                    <p className="mt-3 text-sm text-gray-600 font-medium">Loading users...</p>
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 border border-dashed border-gray-200 rounded-lg">
                    <div className="p-3 bg-white border border-gray-200 rounded-lg w-fit mx-auto mb-3">
                      <Users className="w-8 h-8 text-gray-400" />
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
                        className={`group relative p-3 rounded-lg border cursor-pointer transition-colors ${
                          isSelected
                            ? 'border-gray-900 bg-gray-900/5'
                            : 'border-transparent bg-white hover:border-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            {u.profileImage ? (
                              <img
                                src={`${API_ORIGIN}${u.profileImage}`}
                                alt={u.name}
                                className="w-10 h-10 rounded-lg object-cover border border-gray-200"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center text-gray-600 font-semibold">
                                <span>
                                  {u.name?.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                            {updateCount > 0 && (
                              <div className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-white bg-gray-900 text-[10px] font-semibold text-white shadow-sm">
                                {updateCount}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${isSelected ? 'text-gray-900' : 'text-gray-800'}`}>
                              {u.name}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {u.email}
                            </p>
                            {updateCount > 0 && (
                              <div className="text-xs font-medium text-gray-500 mt-1">
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
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-gray-500 mx-auto"></div>
                <p className="text-gray-500 text-sm mt-3">Loading updates…</p>
              </div>
            ) : showAllUsersCalendar ? (
              /* Calendar and All Users Updates View */
              <div className="space-y-4">
                {/* Calendar Header */}
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-gray-500" />
                    All Users Calendar
                    </h3>
                    {/* Calendar Navigation */}
                    <button
                      onClick={() => setSelectedCalendarDate(new Date(selectedCalendarDate.getFullYear(), selectedCalendarDate.getMonth() - 1, selectedCalendarDate.getDate()))}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-sm font-medium text-gray-600 uppercase tracking-wide">
                      {selectedCalendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </span>
                    <button
                      onClick={() => setSelectedCalendarDate(new Date(selectedCalendarDate.getFullYear(), selectedCalendarDate.getMonth() + 1, selectedCalendarDate.getDate()))}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Calendar Grid */}
                  <div className="grid grid-cols-7 gap-2 text-sm">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => (
                      <div key={day} className="text-center text-gray-500 py-2 uppercase text-xs tracking-wide">
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
                          className={`h-10 w-10 rounded-md text-sm font-medium transition-colors ${
                            isSelected
                              ? 'bg-gray-900 text-white'
                              : isToday
                              ? 'border border-gray-900 text-gray-900'
                              : updatesForDate.length > 0
                              ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border border-gray-200 bg-white hover:bg-gray-100'
                          }`}
                        >
                          <span>{day}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Updates for Selected Date */}
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
                  <div className="p-5 border-b border-gray-200">
                    <h4 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-gray-500" />
                      {selectedCalendarDate.toLocaleDateString('en-US', { 
                        weekday: 'long',
                        month: 'long', 
                        day: 'numeric',
                        year: 'numeric'
                      })} Updates
                    </h4>
                  </div>
                  
                  <div className="p-5">
                    {(() => {
                      const updatesForSelectedDate = getAllUsersUpdatesForDate(selectedCalendarDate)
                      
                      if (updatesForSelectedDate.length === 0) {
                        return (
                          <div className="text-center py-8 text-gray-500 border border-dashed border-gray-200 rounded-lg">
                            <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                            <p className="text-sm font-medium">No updates for this date</p>
                            <p className="text-xs text-gray-400">Users haven’t created any updates yet</p>
                          </div>
                        )
                      }

                      return (
                        <div className="space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar">
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
              <div className="bg-white border border-dashed border-gray-200 rounded-xl p-12 text-center shadow-sm">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                  <Users className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Select a user</h3>
                <p className="text-sm text-gray-500">Choose a user from the list to review their daily updates.</p>
              </div>
            ) : selectedUserUpdates.length === 0 ? (
              <div className="bg-white border border-dashed border-gray-200 rounded-xl p-12 text-center shadow-sm">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                  <Calendar className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{selectedUser.name}</h3>
                <p className="text-sm text-gray-500">No updates available for the selected period.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Calendar */}
                {renderCalendar()}
                {/* User Header */}
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {selectedUser.profileImage ? (
                        <img
                          src={`${API_ORIGIN}${selectedUser.profileImage}`}
                          alt={selectedUser.name}
                          className="w-14 h-14 rounded-lg object-cover border border-gray-200"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-gray-200 flex items-center justify-center text-gray-600 font-semibold">
                          <span>
                            {selectedUser.name?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="flex-1">
                        <h2 className="text-lg font-semibold text-gray-900">{selectedUser.name}</h2>
                        <p className="text-sm text-gray-500">{selectedUser.email}</p>
                        <div className="mt-2 inline-flex items-center gap-2 rounded-md bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                          <Calendar className="w-4 h-4 text-gray-500" />
                          <span>
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
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                        title={`Download ${selectedUser.name}'s updates`}
                      >
                        <Download className="w-4 h-4" />
                        <span>Download Excel</span>
                      </button>

                      {/* View Toggle */}
                      <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden bg-white shadow-sm">
                        <button
                          onClick={() => setViewMode('grid')}
                          className={`px-4 py-2 text-sm font-medium transition-colors ${
                            viewMode === 'grid'
                              ? 'bg-gray-900 text-white'
                              : 'bg-transparent text-gray-600 hover:bg-gray-50'
                          }`}
                          title="Grid View"
                        >
                          <Grid3x3 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => setViewMode('list')}
                          className={`px-4 py-2 text-sm font-medium transition-colors ${
                            viewMode === 'list'
                              ? 'bg-gray-900 text-white'
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

                {/* Updates Grid or List */}
                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {selectedUserUpdates.map((update) => {
                      return (
                        <div
                          key={update._id}
                          className="group relative rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                        >
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                              <Calendar className="w-4 h-4 text-gray-500" />
                              <span>
                                {new Date(update.date).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </span>
                            </div>
                            <span className="flex items-center gap-1.5 text-xs text-gray-500">
                              <Clock className="w-3.5 h-3.5" />
                              {new Date(update.updatedAt).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>

                          <p className="text-sm leading-relaxed text-gray-700 mb-4 line-clamp-4">
                            {update.content || 'No content provided.'}
                          </p>

                          {update.media && update.media.length > 0 && (
                            <div className="grid grid-cols-3 gap-2 mb-4">
                              {update.media.slice(0, 3).map((media, idx) => {
                                const isLastVisible = idx === 2 && update.media.length > 3
                                const remainingCount = update.media.length - 3
                                return (
                                  <div
                                    key={`${update._id}-media-${idx}`}
                                    onClick={() => openMediaPreview(update.media, idx)}
                                    className="relative overflow-hidden rounded-md border border-gray-200 bg-gray-50 cursor-pointer hover:border-gray-400 transition-colors"
                                  >
                                    {media.type === 'image' ? (
                                      <img
                                        src={media.url}
                                        alt={media.filename}
                                        className="h-20 w-full object-cover"
                                      />
                                    ) : media.type === 'video' ? (
                                      <div className="flex h-20 w-full items-center justify-center text-gray-500">
                                        <Video className="w-6 h-6" />
                                      </div>
                                    ) : (
                                      <div className="flex h-20 w-full items-center justify-center text-gray-500">
                                        <File className="w-6 h-6" />
                                      </div>
                                    )}
                                    {isLastVisible && (
                                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-sm font-semibold text-white">
                                        +{remainingCount}
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}

                          <div className="flex items-center justify-between border-t border-gray-200 pt-3 text-xs text-gray-500">
                            <span>{update.content.length} characters</span>
                            <span>{update.media?.length || 0} attachments</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedUserUpdates.map((update) => (
                      <div
                        key={update._id}
                        className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-gray-900 mb-1">
                              {new Date(update.date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </p>
                            <p className="text-xs text-gray-500 flex items-center gap-1 mb-2">
                              <Clock className="w-3.5 h-3.5" />
                              {new Date(update.updatedAt).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                            <p className="text-sm text-gray-700">
                              {update.content || 'No content provided.'}
                            </p>
                          </div>
                          <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                            {update.media?.length || 0} files
                          </span>
                        </div>
                      </div>
                    ))}
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
            <div className="sticky top-0 border-b border-gray-200 bg-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {new Date(selectedDateUpdate.date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Last updated: {new Date(selectedDateUpdate.updatedAt).toLocaleString()}
                </p>
              </div>
              <button
                onClick={closeDatePopup}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
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
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
                  <p className="text-xs font-medium text-gray-500 mb-1">Character Count</p>
                  <p className="text-lg font-semibold text-gray-900">{selectedDateUpdate.content.length}</p>
                </div>
                {selectedDateUpdate.media && (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
                    <p className="text-xs font-medium text-gray-500 mb-1">Media Files</p>
                    <p className="text-lg font-semibold text-gray-900">{selectedDateUpdate.media.length}</p>
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


