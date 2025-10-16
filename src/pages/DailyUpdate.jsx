import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import axios from 'axios'
import { API_ORIGIN } from '../services/api'
import { 
  Calendar, 
  Plus, 
  Save, 
  Edit, 
  Trash2, 
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Clock,
  TrendingUp,
  Grid3x3,
  List,
  Image as ImageIcon,
  Video,
  X,
  Upload,
  Download,
  File
} from 'lucide-react'

const DailyUpdate = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [allUpdates, setAllUpdates] = useState([])
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [updateText, setUpdateText] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [updatesMap, setUpdatesMap] = useState({})
  const [viewMode, setViewMode] = useState('grid') // 'grid' or 'list'
  const [mediaFiles, setMediaFiles] = useState([])
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const [previewMedia, setPreviewMedia] = useState(null) // For media preview modal
  const [previewIndex, setPreviewIndex] = useState(0)

  // Helper function to convert date to local date string (YYYY-MM-DD) without timezone issues
  const getLocalDateString = (date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Helper function to check if date is in the future
  const isFutureDate = (date) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const checkDate = new Date(date)
    checkDate.setHours(0, 0, 0, 0)
    return checkDate > today
  }

  useEffect(() => {
    fetchAllUpdates()
  }, [])

  useEffect(() => {
    // Update selected date's text when selection changes
    const dateStr = getLocalDateString(selectedDate)
    const update = updatesMap[dateStr]
    if (update) {
      setUpdateText(update.content)
      setEditingId(update._id)
      setMediaFiles(update.media || [])
    } else {
      setUpdateText('')
      setEditingId(null)
      setMediaFiles([])
    }
  }, [selectedDate, updatesMap])

  const fetchAllUpdates = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      console.log('🔍 Fetching daily updates from:', `${API_ORIGIN}/api/daily-updates`)
      const response = await axios.get(
        `${API_ORIGIN}/api/daily-updates`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      console.log('✅ Daily updates fetched:', response.data)
      console.log('📊 Total updates:', response.data.length)
      setAllUpdates(response.data)
      
      // Create a map of date -> update for quick lookup using local date strings
      const map = {}
      response.data.forEach(update => {
        const dateStr = getLocalDateString(new Date(update.date))
        map[dateStr] = update
      })
      setUpdatesMap(map)
    } catch (error) {
      console.error('❌ Error fetching updates:', error)
      console.error('Error details:', error.response?.data)
      toast.error('Failed to load updates')
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return

    setUploadingMedia(true)
    const token = localStorage.getItem('token')

    try {
      const uploadedMedia = []

      for (const file of files) {
        const formData = new FormData()
        formData.append('file', file)

        const response = await axios.post(
          `${API_ORIGIN}/api/daily-updates/upload-media`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'multipart/form-data',
            },
          }
        )

        uploadedMedia.push(response.data)
      }

      setMediaFiles([...mediaFiles, ...uploadedMedia])
      toast.success(`${uploadedMedia.length} file(s) uploaded successfully`)
    } catch (error) {
      console.error('Error uploading media:', error)
      toast.error('Failed to upload media')
    } finally {
      setUploadingMedia(false)
    }
  }

  const handleRemoveMedia = (index) => {
    setMediaFiles(mediaFiles.filter((_, i) => i !== index))
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

  const handleKeyPress = (e) => {
    if (!previewMedia) return
    if (e.key === 'Escape') closeMediaPreview()
    if (e.key === 'ArrowRight') nextMedia()
    if (e.key === 'ArrowLeft') prevMedia()
  }

  useEffect(() => {
    if (previewMedia) {
      window.addEventListener('keydown', handleKeyPress)
      return () => window.removeEventListener('keydown', handleKeyPress)
    }
  }, [previewMedia, previewIndex])

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

  const handleSaveUpdate = async () => {
    if (!updateText.trim()) {
      toast.error('Please enter an update')
      return
    }

    // Prevent saving updates for future dates
    if (isFutureDate(selectedDate)) {
      toast.error('Cannot create updates for future dates')
      return
    }

    try {
      const token = localStorage.getItem('token')
      const dateStr = getLocalDateString(selectedDate)

      if (editingId) {
        // Update existing
        await axios.put(
          `${API_ORIGIN}/api/daily-updates/${editingId}`,
          { content: updateText, media: mediaFiles },
          { headers: { Authorization: `Bearer ${token}` } }
        )
        toast.success('Update saved successfully')
      } else {
        // Create new
        await axios.post(
          `${API_ORIGIN}/api/daily-updates`,
          { date: dateStr, content: updateText, media: mediaFiles },
          { headers: { Authorization: `Bearer ${token}` } }
        )
        toast.success('Update added successfully')
      }
      
      fetchAllUpdates()
    } catch (error) {
      console.error('Error saving update:', error)
      const errorMessage = error.response?.data?.error || 'Failed to save update'
      toast.error(errorMessage)
    }
  }

  const handleDeleteUpdate = async (id) => {
    if (!confirm('Are you sure you want to delete this update?')) return

    try {
      const token = localStorage.getItem('token')
      await axios.delete(
        `${API_ORIGIN}/api/daily-updates/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success('Update deleted successfully')
      setUpdateText('')
      setEditingId(null)
      setMediaFiles([])
      fetchAllUpdates()
    } catch (error) {
      console.error('Error deleting update:', error)
      toast.error('Failed to delete update')
    }
  }

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
    if (updatesMap[dateStr]) {
      const length = updatesMap[dateStr].content.length
      if (length > 500) return 'bg-gradient-to-br from-green-400 to-green-600'
      if (length > 200) return 'bg-gradient-to-br from-blue-400 to-blue-600'
      return 'bg-gradient-to-br from-purple-400 to-purple-600'
    }
    return ''
  }

  const renderCalendar = () => {
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
      const isSelected = date.toDateString() === selectedDate.toDateString()
      const isToday = date.toDateString() === new Date().toDateString()
      const isFuture = isFutureDate(date)
      const hasUpdate = updatesMap[dateStr]
      const colorClass = getColorForDay(dateStr)

      days.push(
        <button
          key={day}
          onClick={() => !isFuture && setSelectedDate(date)}
          disabled={isFuture}
          className={`
            relative p-3 rounded-xl text-center transition-all transform
            ${!isFuture ? 'hover:scale-105' : 'cursor-not-allowed opacity-40'}
            ${isSelected 
              ? 'ring-4 ring-blue-500 ring-offset-2 scale-105' 
              : ''
            }
            ${hasUpdate
              ? `${colorClass} text-white font-bold shadow-lg`
              : isToday
              ? 'bg-gray-100 text-gray-900 font-semibold border-2 border-blue-500'
              : isFuture
              ? 'bg-gray-100 text-gray-400'
              : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
            }
          `}
        >
          <span className="text-sm">{day}</span>
          {hasUpdate && (
            <div className="absolute top-1 right-1">
              <CheckCircle className="w-3 h-3 text-white" />
            </div>
          )}
        </button>
      )
    }

    return (
      <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-6 h-6 text-gray-600" />
          </button>
          <h3 className="text-xl font-bold text-gray-800">{monthYear}</h3>
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-2 text-center mb-3">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {days}
        </div>

        {/* Legend */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <p className="text-xs font-semibold text-gray-600 mb-2">Update Length:</p>
          <div className="flex gap-3 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-gradient-to-br from-purple-400 to-purple-600"></div>
              <span className="text-gray-600">Short</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-gradient-to-br from-blue-400 to-blue-600"></div>
              <span className="text-gray-600">Medium</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-gradient-to-br from-green-400 to-green-600"></div>
              <span className="text-gray-600">Long</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <ArrowLeft className="w-6 h-6 text-gray-700" />
              </button>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Daily Updates
                </h1>
                <p className="text-sm text-gray-600 mt-1">Track your daily progress and achievements</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-gradient-to-r from-blue-100 to-purple-100 px-4 py-3 rounded-xl">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <div className="text-right">
                <p className="text-xs text-gray-600">Total Updates</p>
                <p className="text-xl font-bold text-gray-800">{allUpdates.length}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar Section */}
          <div className="lg:col-span-1">
            {renderCalendar()}
            
            {/* Quick Stats */}
            <div className="mt-6 bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                This Month
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Updates Created</span>
                  <span className="text-lg font-bold text-blue-600">
                    {allUpdates.filter(u => {
                      const date = new Date(u.date)
                      return date.getMonth() === currentMonth.getMonth() && 
                             date.getFullYear() === currentMonth.getFullYear()
                    }).length}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Current Streak</span>
                  <span className="text-lg font-bold text-green-600">🔥 {allUpdates.length > 0 ? '1' : '0'} days</span>
                </div>
              </div>
            </div>
          </div>

          {/* Update Form & All Updates Panel */}
          <div className="lg:col-span-2 space-y-6">
            {/* Current Day Editor */}
            <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-800">
                <Edit className="w-6 h-6 text-blue-600" />
                <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  {selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </span>
              </h2>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-blue-600"></div>
                </div>
              ) : (
                <>
                  {isFutureDate(selectedDate) && (
                    <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center gap-3">
                      <div className="flex-shrink-0">
                        <svg className="w-6 h-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-semibold text-yellow-800">Future Date Selected</h4>
                        <p className="text-sm text-yellow-700">You cannot create updates for future dates. Please select today or a past date.</p>
                      </div>
                    </div>
                  )}
                  <textarea
                    value={updateText}
                    onChange={(e) => setUpdateText(e.target.value)}
                    placeholder="✨ What amazing things did you accomplish today? Share your progress, learnings, and wins..."
                    className="w-full p-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none transition-all"
                    rows="8"
                    disabled={isFutureDate(selectedDate)}
                  />

                  {/* Media Upload Section */}
                  <div className="mt-4">
                    <label className={`flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl transition-colors w-fit ${!isFutureDate(selectedDate) ? 'hover:bg-gray-200 cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}>
                      <Upload className="w-5 h-5" />
                      <span className="font-medium">Upload Files (Images/Videos/Documents)</span>
                      <input
                        type="file"
                        multiple
                        accept="image/*,video/*,.pdf,.zip,.cdr,.psd,.ai,.ps,.doc,.docx,.xls,.xlsx"
                        onChange={handleFileUpload}
                        className="hidden"
                        disabled={uploadingMedia || isFutureDate(selectedDate)}
                      />
                    </label>
                    {uploadingMedia && (
                      <p className="text-sm text-blue-600 mt-2">Uploading...</p>
                    )}
                  </div>

                  {/* Media Preview */}
                  {mediaFiles.length > 0 && (
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
                      {mediaFiles.map((media, index) => (
                        <div 
                          key={index} 
                          className="relative group rounded-xl overflow-hidden border-2 border-gray-200 cursor-pointer"
                          onClick={() => media.type === 'image' && openMediaPreview(mediaFiles, index)}
                        >
                          {media.type === 'image' ? (
                            <img
                              src={media.url}
                              alt={media.filename}
                              className="w-full h-32 object-cover hover:scale-105 transition-transform"
                            />
                          ) : media.type === 'video' ? (
                            <video
                              src={media.url}
                              className="w-full h-32 object-cover"
                              controls
                            />
                          ) : (
                            <div className="w-full h-32 bg-gray-100 flex flex-col items-center justify-center p-4">
                              <File className="w-12 h-12 text-gray-500 mb-2" />
                              <span className="text-xs text-gray-600 text-center truncate w-full px-2">
                                {media.filename}
                              </span>
                            </div>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemoveMedia(index)
                            }}
                            className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                            <span className="text-white text-xs flex items-center gap-1 truncate">
                              {media.type === 'image' ? <ImageIcon className="w-3 h-3" /> : media.type === 'video' ? <Video className="w-3 h-3" /> : <File className="w-3 h-3" />}
                              {media.filename}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={handleSaveUpdate}
                      className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all flex items-center justify-center gap-2 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105"
                    >
                      <Save className="w-5 h-5" />
                      {editingId ? 'Update' : 'Save'} Daily Update
                    </button>

                    {editingId && (
                      <button
                        onClick={() => handleDeleteUpdate(editingId)}
                        className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 transition-all flex items-center gap-2 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105"
                      >
                        <Trash2 className="w-5 h-5" />
                        Delete
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* All Updates Panel - Color Palette Style */}
            <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold flex items-center gap-2 text-gray-800">
                  <Calendar className="w-6 h-6 text-purple-600" />
                  All Updates
                </h3>
                
                {/* View Toggle */}
                <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-1">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded-lg transition-all ${
                      viewMode === 'grid'
                        ? 'bg-white text-blue-600 shadow-md'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    title="Grid View"
                  >
                    <Grid3x3 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded-lg transition-all ${
                      viewMode === 'list'
                        ? 'bg-white text-blue-600 shadow-md'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    title="List View"
                  >
                    <List className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              {allUpdates.length === 0 ? (
                <div className="text-center py-12">
                  <div className="bg-gray-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                    <Calendar className="w-10 h-10 text-gray-400" />
                  </div>
                  <p className="text-gray-500 text-lg">No updates yet</p>
                  <p className="text-gray-400 text-sm mt-2">Start tracking your daily progress!</p>
                </div>
              ) : viewMode === 'grid' ? (
                /* Grid View */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                  {allUpdates.map((update) => {
                    const dateStr = getLocalDateString(new Date(update.date))
                    const colorClass = getColorForDay(dateStr)
                    const isSelected = dateStr === getLocalDateString(selectedDate)
                    
                    return (
                      <div
                        key={update._id}
                        onClick={() => setSelectedDate(new Date(update.date))}
                        className={`${colorClass} p-5 rounded-xl cursor-pointer transition-all transform hover:scale-105 hover:shadow-xl ${
                          isSelected ? 'ring-4 ring-blue-500 ring-offset-2 scale-105' : 'shadow-lg'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <span className="text-white font-bold text-lg">
                              {new Date(update.date).toLocaleDateString('en-US', { 
                                weekday: 'short',
                                month: 'short', 
                                day: 'numeric', 
                                year: 'numeric' 
                              })}
                            </span>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-white/80 text-xs">
                                {new Date(update.updatedAt).toLocaleTimeString('en-US', { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })}
                              </span>
                            </div>
                          </div>
                          <CheckCircle className="w-6 h-6 text-white" />
                        </div>
                        <p className="text-white line-clamp-4 text-sm leading-relaxed">
                          {update.content}
                        </p>
                        
                        {/* Media Preview in Grid */}
                        {update.media && update.media.length > 0 && (
                          <div className="mt-3 grid grid-cols-2 gap-2 relative">
                            {update.media.slice(0, 2).map((media, idx) => (
                              <div 
                                key={idx} 
                                className="relative rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (media.type === 'image') {
                                    openMediaPreview(update.media, idx)
                                  } else {
                                    window.open(media.url, '_blank')
                                  }
                                }}
                              >
                                {media.type === 'image' ? (
                                  <img
                                    src={media.url}
                                    alt={media.filename}
                                    className="w-full h-20 object-cover"
                                  />
                                ) : media.type === 'video' ? (
                                  <div className="w-full h-20 bg-black/20 flex items-center justify-center">
                                    <Video className="w-6 h-6 text-white" />
                                  </div>
                                ) : (
                                  <div className="w-full h-20 bg-black/20 flex flex-col items-center justify-center p-2">
                                    <File className="w-5 h-5 text-white mb-1" />
                                    <span className="text-white text-[10px] truncate w-full text-center">{media.filename}</span>
                                  </div>
                                )}
                              </div>
                            ))}
                            {update.media.length > 2 && (
                              <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                                +{update.media.length - 2} more
                              </div>
                            )}
                          </div>
                        )}
                        
                        {update.content.length > 150 && (
                          <button className="text-white/90 text-xs font-semibold mt-2 hover:text-white transition-colors">
                            Read more →
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                /* List View */
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                  {allUpdates.map((update) => {
                    const dateStr = getLocalDateString(new Date(update.date))
                    const colorClass = getColorForDay(dateStr)
                    const isSelected = dateStr === getLocalDateString(selectedDate)
                    
                    return (
                      <div
                        key={update._id}
                        onClick={() => setSelectedDate(new Date(update.date))}
                        className={`${colorClass} p-4 rounded-xl cursor-pointer transition-all hover:shadow-xl ${
                          isSelected ? 'ring-4 ring-blue-500 ring-offset-2' : 'shadow-md'
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0">
                            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3 text-center min-w-[80px]">
                              <div className="text-white font-bold text-2xl">
                                {new Date(update.date).getDate()}
                              </div>
                              <div className="text-white/90 text-xs font-semibold uppercase">
                                {new Date(update.date).toLocaleDateString('en-US', { 
                                  month: 'short'
                                })}
                              </div>
                              <div className="text-white/80 text-xs">
                                {new Date(update.date).getFullYear()}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-white font-bold text-base">
                                {new Date(update.date).toLocaleDateString('en-US', { 
                                  weekday: 'long'
                                })}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-white/80 text-xs">
                                  {new Date(update.updatedAt).toLocaleTimeString('en-US', { 
                                    hour: '2-digit', 
                                    minute: '2-digit' 
                                  })}
                                </span>
                                <CheckCircle className="w-5 h-5 text-white" />
                              </div>
                            </div>
                            <p className="text-white/95 text-sm leading-relaxed line-clamp-2">
                              {update.content}
                            </p>
                            
                            {/* Media Preview in List */}
                            {update.media && update.media.length > 0 && (
                              <div className="mt-3 flex gap-2">
                                {update.media.slice(0, 3).map((media, idx) => (
                                  <div 
                                    key={idx} 
                                    className="relative rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      if (media.type === 'image') {
                                        openMediaPreview(update.media, idx)
                                      } else {
                                        window.open(media.url, '_blank')
                                      }
                                    }}
                                  >
                                    {media.type === 'image' ? (
                                      <img
                                        src={media.url}
                                        alt={media.filename}
                                        className="w-16 h-16 object-cover"
                                      />
                                    ) : media.type === 'video' ? (
                                      <div className="w-16 h-16 bg-black/20 flex items-center justify-center">
                                        <Video className="w-4 h-4 text-white" />
                                      </div>
                                    ) : (
                                      <div className="w-16 h-16 bg-black/20 flex flex-col items-center justify-center p-1">
                                        <File className="w-4 h-4 text-white" />
                                      </div>
                                    )}
                                  </div>
                                ))}
                                {update.media.length > 3 && (
                                  <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                                    <span className="text-white font-bold text-xs">+{update.media.length - 3}</span>
                                  </div>
                                )}
                              </div>
                            )}
                            
                            <div className="flex items-center justify-between mt-2">
                               
                              {update.content.length > 100 && (
                                <button className="text-white/90 text-xs font-semibold hover:text-white transition-colors">
                                  Read more →
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Media Preview Modal */}
      {previewMedia && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center">
          {/* Close Button */}
          <button
            onClick={closeMediaPreview}
            className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white p-3 rounded-full transition-colors z-10"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Download Button */}
          <button
            onClick={() => handleDownloadMedia(previewMedia[previewIndex].url, previewMedia[previewIndex].filename)}
            className="absolute top-4 right-20 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-full transition-colors flex items-center gap-2 shadow-lg z-10"
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

      {/* Custom Scrollbar Styles */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(to bottom, #3b82f6, #8b5cf6);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(to bottom, #2563eb, #7c3aed);
        }
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
      `}} />
    </div>
  )
}

export default DailyUpdate

