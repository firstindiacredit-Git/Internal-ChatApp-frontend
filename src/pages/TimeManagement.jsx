import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { timeSettingsAPI, scheduledDisableAPI, usersAPI, API_ORIGIN } from '../services/api'
import { toast } from 'react-hot-toast'
import { 
  Clock, 
  Settings, 
  Save,
  ArrowLeft,
  Power,
  Info,
  Calendar,
  ToggleLeft,
  ToggleRight,
  Users,
  Plus,
  Edit,
  Trash2,
  User as UserIcon,
  RotateCcw
} from 'lucide-react'

const TimeManagement = () => {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [timeOffset, setTimeOffset] = useState(0)
  const [ntpInfo, setNtpInfo] = useState({ offset: 0, synced: false })
  
  // Scheduler state
  const [schedules, setSchedules] = useState([])
  const [users, setUsers] = useState([])
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState(null)
  const [scheduleForm, setScheduleForm] = useState({
    name: '',
    enableTime: '',
    disableTime: '',
    users: [],
    applyToAllUsers: false,
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  })

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

  useEffect(() => {
    syncTimeWithBackend()
    fetchSchedules()
    fetchUsers()
    
    // Update current time every second using backend IST offset
    const timer = setInterval(() => {
      setCurrentTime(new Date(Date.now() + timeOffset))
    }, 1000)

    // Sync with backend every 5 minutes to maintain accuracy
    const syncTimer = setInterval(() => {
      syncTimeWithBackend()
    }, 5 * 60 * 1000)

    return () => {
      clearInterval(timer)
      clearInterval(syncTimer)
    }
  }, [timeOffset])

  const syncTimeWithBackend = async () => {
    try {
      const response = await timeSettingsAPI.getCurrentTime()
      const serverTime = new Date(response.data.timestamp)
      const localTime = new Date()
      
      // Calculate offset between local time and server IST time
      const offset = serverTime.getTime() - localTime.getTime()
      setTimeOffset(offset)
      setCurrentTime(serverTime)
      
      // Store NTP information
      if (response.data.usingGlobalTime) {
        setNtpInfo({
          offset: response.data.ntpOffset || 0,
          synced: true,
          systemTime: response.data.systemTime,
          diff: response.data.globalTimeDiff
        })
        console.log('🌍 Time synced with Global NTP Server (NOT system time)')
        console.log('📡 NTP Offset:', response.data.globalTimeDiff)
        console.log('🇮🇳 IST Time:', response.data.formatted)
      } else {
        console.log('🕐 Time synced with backend IST:', response.data.formatted)
      }
    } catch (error) {
      console.error('Failed to sync time with backend:', error)
      // Fallback to local time if sync fails
      setTimeOffset(0)
      setNtpInfo({ offset: 0, synced: false })
      setCurrentTime(new Date())
    }
  }

  // Scheduler functions
  const fetchSchedules = async () => {
    try {
      const response = await scheduledDisableAPI.getSchedules()
      setSchedules(response.data)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching schedules:', error)
      setLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await usersAPI.getUsers()
      // Include ALL regular users (both active and disabled)
      const regularUsers = response.data.filter(u => u.role === 'user')
      setUsers(regularUsers)
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const handleScheduleSubmit = async (e) => {
    e.preventDefault()

    if (!scheduleForm.name.trim()) {
      toast.error('Please enter schedule name')
      return
    }

    if (!scheduleForm.enableTime && !scheduleForm.disableTime) {
      toast.error('Please set at least one time (Enable or Disable)')
      return
    }

    if (!scheduleForm.applyToAllUsers && scheduleForm.users.length === 0) {
      toast.error('Please select at least one user or enable "Apply to all users"')
      return
    }

    try {
      if (editingSchedule) {
        await scheduledDisableAPI.updateSchedule(editingSchedule._id, scheduleForm)
        toast.success('Schedule updated successfully')
      } else {
        await scheduledDisableAPI.createSchedule(scheduleForm)
        toast.success('Schedule created successfully')
      }

      setShowScheduleModal(false)
      setEditingSchedule(null)
      resetScheduleForm()
      fetchSchedules()
    } catch (error) {
      console.error('Schedule operation error:', error)
      toast.error(error.response?.data?.message || 'Operation failed')
    }
  }

  const handleScheduleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this schedule?')) {
      try {
        await scheduledDisableAPI.deleteSchedule(id)
        toast.success('Schedule deleted successfully')
        fetchSchedules()
      } catch (error) {
        toast.error('Failed to delete schedule')
      }
    }
  }

  const handleScheduleToggle = async (id) => {
    try {
      await scheduledDisableAPI.toggleSchedule(id)
      fetchSchedules()
    } catch (error) {
      toast.error('Failed to toggle schedule')
    }
  }

  const handleResetTrigger = async (id, scheduleName) => {
    if (window.confirm(`Reset "${scheduleName}"? This will allow it to trigger again today.`)) {
      try {
        await scheduledDisableAPI.resetTrigger(id)
        toast.success('Schedule reset - can trigger again today')
        fetchSchedules()
      } catch (error) {
        toast.error('Failed to reset schedule')
      }
    }
  }

  const handleScheduleEdit = (schedule) => {
    setEditingSchedule(schedule)
    setScheduleForm({
      name: schedule.name,
      enableTime: schedule.enableTime || '',
      disableTime: schedule.disableTime || '',
      users: schedule.users.map(u => u._id),
      applyToAllUsers: schedule.applyToAllUsers,
      days: schedule.days,
    })
    setShowScheduleModal(true)
  }

  const openScheduleModal = () => {
    setEditingSchedule(null)
    resetScheduleForm()
    setShowScheduleModal(true)
  }

  const resetScheduleForm = () => {
    setScheduleForm({
      name: '',
      enableTime: '',
      disableTime: '',
      users: [],
      applyToAllUsers: false,
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    })
  }

  const toggleDay = (day) => {
    setScheduleForm(prev => ({
      ...prev,
      days: prev.days.includes(day)
        ? prev.days.filter(d => d !== day)
        : [...prev.days, day]
    }))
  }

  const toggleUser = (userId) => {
    setScheduleForm(prev => ({
      ...prev,
      users: prev.users.includes(userId)
        ? prev.users.filter(id => id !== userId)
        : [...prev.users, userId]
    }))
  }

  const selectAllUsers = () => {
    setScheduleForm(prev => ({
      ...prev,
      users: users.map(u => u.id)
    }))
  }

  const deselectAllUsers = () => {
    setScheduleForm(prev => ({
      ...prev,
      users: []
    }))
  }

  const formatTime = (date) => {
    // Display time using backend-synced IST
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })
  }

  const formatDate = (date) => {
    // Display date using backend-synced IST
    return date.toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading schedules...</p>
        </div>
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
              <button
                onClick={() => window.history.back()}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
                title="Go back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                  <Calendar className="w-7 h-7 mr-3 text-primary-600" />
                  User Scheduler
                </h1>
                <p className="text-gray-600">Automatically enable or disable selected users at scheduled times</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Current Time Display */}
        <div className="card p-8 mb-6 bg-gradient-to-r from-primary-50 to-blue-50 border-primary-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <Calendar className="w-5 h-5 text-primary-600" />
                <p className="text-sm text-gray-600 font-medium">{formatDate(currentTime)}</p>
              </div>
              <h2 className="text-4xl font-bold text-gray-900">{formatTime(currentTime)}</h2>
              <p className="text-sm text-gray-600 mt-1">
                Current IST Time (India)
              </p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                  🌍 Global NTP Time
                </span>
                {ntpInfo.synced && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                    📡 Offset: {ntpInfo.diff}
                  </span>
                )}
              </div>
            </div>
            <div className="bg-white rounded-full p-6 shadow-lg">
              <Clock className="w-16 h-16 text-primary-600" />
            </div>
          </div>
        </div>

        {/* Schedules Section */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Scheduled Actions</h2>
            <p className="text-sm text-gray-600">Create schedules to automatically enable or disable selected users</p>
          </div>
          <button
            onClick={openScheduleModal}
            className="btn-primary inline-flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Schedule
          </button>
        </div>

        {/* Schedules List */}
        {schedules.length === 0 ? (
          <div className="card p-12 text-center">
            <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No schedules yet</h3>
            <p className="text-gray-500 mb-4">Create schedules to automatically enable or disable users at specific times</p>
            <button onClick={openScheduleModal} className="btn-primary inline-flex items-center">
              <Plus className="w-4 h-4 mr-2" />
              Create Schedule
            </button>
          </div>
        ) : (
              <div className="grid gap-6">
                {schedules.map(schedule => (
                  <div key={schedule._id} className="card p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{schedule.name}</h3>
                          {schedule.isActive ? (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              Active
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                              Inactive
                            </span>
                          )}
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 mb-3">
                          {schedule.enableTime && (
                            <div className="flex items-center bg-green-50 px-3 py-1.5 rounded-lg border border-green-200">
                              <span className="text-green-700 font-medium mr-1">✅</span>
                              <Clock className="w-4 h-4 mr-1 text-green-600" />
                              <span className="font-medium text-green-700">{schedule.enableTime}</span>
                              <span className="ml-1 text-green-600 text-xs">Enable</span>
                            </div>
                          )}

                          {schedule.disableTime && (
                            <div className="flex items-center bg-red-50 px-3 py-1.5 rounded-lg border border-red-200">
                              <span className="text-red-700 font-medium mr-1">🚫</span>
                              <Clock className="w-4 h-4 mr-1 text-red-600" />
                              <span className="font-medium text-red-700">{schedule.disableTime}</span>
                              <span className="ml-1 text-red-600 text-xs">Disable</span>
                            </div>
                          )}
                          
                          <div className="flex items-center">
                            <Users className="w-4 h-4 mr-1" />
                            <span>
                              {schedule.applyToAllUsers 
                                ? 'All Users' 
                                : `${schedule.users.length} Selected`
                              }
                            </span>
                          </div>

                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-1" />
                            <span>
                              {schedule.days.length === 7 ? 'Every day' : `${schedule.days.length} days`}
                            </span>
                          </div>
                        </div>

                        {/* Selected Users Preview */}
                        {!schedule.applyToAllUsers && schedule.users.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-3">
                            {schedule.users.slice(0, 5).map(u => (
                              <div key={u._id} className="flex items-center space-x-2 bg-gray-100 rounded-full px-3 py-1">
                                <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center overflow-hidden">
                                  {u.profileImage ? (
                                    <img src={`${API_ORIGIN}${u.profileImage}`} alt={u.name} className="w-6 h-6 object-cover" />
                                  ) : (
                                    <UserIcon className="w-3 h-3 text-primary-600" />
                                  )}
                                </div>
                                <span className="text-xs text-gray-700">{u.name}</span>
                              </div>
                            ))}
                            {schedule.users.length > 5 && (
                              <span className="text-xs text-gray-500 px-3 py-1">+{schedule.users.length - 5} more</span>
                            )}
                          </div>
                        )}

                        {/* Days */}
                        <div className="flex flex-wrap gap-1">
                          {daysOfWeek.map(day => (
                            <span
                              key={day}
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                schedule.days.includes(day)
                                  ? 'bg-primary-100 text-primary-700'
                                  : 'bg-gray-100 text-gray-400'
                              }`}
                            >
                              {day.slice(0, 3)}
                            </span>
                          ))}
                        </div>

                        {(schedule.lastTriggeredEnable || schedule.lastTriggeredDisable) && (
                          <div className="mt-4 pt-4 border-t text-xs text-gray-500 space-y-1">
                            {schedule.lastTriggeredEnable && (
                              <div className="flex items-center text-green-600">
                                <span className="font-medium mr-1">✅ Enable triggered:</span>
                                {new Date(schedule.lastTriggeredEnable).toLocaleString()}
                              </div>
                            )}
                            {schedule.lastTriggeredDisable && (
                              <div className="flex items-center text-red-600">
                                <span className="font-medium mr-1">🚫 Disable triggered:</span>
                                {new Date(schedule.lastTriggeredDisable).toLocaleString()}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 ml-4">
                        {(schedule.lastTriggeredEnable || schedule.lastTriggeredDisable) && (
                          <button
                            onClick={() => handleResetTrigger(schedule._id, schedule.name)}
                            className="text-orange-600 hover:text-orange-900"
                            title="Reset & allow re-trigger today"
                          >
                            <RotateCcw className="w-5 h-5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleScheduleToggle(schedule._id)}
                          className="text-gray-600 hover:text-gray-900"
                          title={schedule.isActive ? 'Disable' : 'Enable'}
                        >
                          {schedule.isActive ? (
                            <ToggleRight className="w-6 h-6 text-green-600" />
                          ) : (
                            <ToggleLeft className="w-6 h-6 text-gray-400" />
                          )}
                        </button>
                        <button
                          onClick={() => handleScheduleEdit(schedule)}
                          className="text-primary-600 hover:text-primary-900"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleScheduleDelete(schedule._id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

        {/* Info Card - Moved to bottom */}
        <div className="card p-6 mt-8 bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
            <Info className="w-5 h-5 mr-2 text-purple-600" />
            How it works
          </h3>
          <div className="space-y-2 text-sm text-gray-700">
            <p>🌍 System uses Global NTP Time Server (time.google.com or pool.ntp.org)</p>
            <p>🚫 Computer/System time is IGNORED - only global internet time is used</p>
            <p>🇮🇳 Global time is converted to IST (Indian Standard Time)</p>
            <p>🕐 The system runs a scheduled job every minute to check time</p>
            <p>📡 NTP sync happens automatically every hour for accuracy</p>
            <p>🚫 Create schedules to automatically DISABLE selected users at specific times</p>
            <p>✅ Create schedules to automatically ENABLE selected users at specific times</p>
            <p>👥 Only selected users in schedules will be affected (not all users)</p>
            <p>📱 Disabled users are immediately logged out from all devices</p>
          </div>
        </div>
      </div>

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editingSchedule ? 'Edit Schedule' : 'Create New Schedule'}
            </h3>

            <form onSubmit={handleScheduleSubmit} className="space-y-6">
              {/* Schedule Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Schedule Name
                </label>
                <input
                  type="text"
                  required
                  value={scheduleForm.name}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, name: e.target.value })}
                  className="input-field"
                  placeholder="e.g., Morning Auto-Enable"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Enable Time */}
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <label className="block text-sm font-medium text-green-800 mb-1 flex items-center">
                    <span className="mr-2">✅</span>
                    Enable Time (IST)
                  </label>
                  <input
                    type="time"
                    value={scheduleForm.enableTime}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, enableTime: e.target.value })}
                    className="input-field text-lg font-mono"
                    placeholder="Optional"
                  />
                  <p className="text-xs text-green-700 mt-1">Users will be enabled at this time</p>
                </div>

                {/* Disable Time */}
                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                  <label className="block text-sm font-medium text-red-800 mb-1 flex items-center">
                    <span className="mr-2">🚫</span>
                    Disable Time (IST)
                  </label>
                  <input
                    type="time"
                    value={scheduleForm.disableTime}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, disableTime: e.target.value })}
                    className="input-field text-lg font-mono"
                    placeholder="Optional"
                  />
                  <p className="text-xs text-red-700 mt-1">Users will be disabled at this time</p>
                </div>
              </div>

              {/* Info: At least one time required */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  💡 <strong>Tip:</strong> Set both times to create a complete on/off schedule. Example: Enable at 09:00, Disable at 18:00
                </p>
              </div>

              {/* Apply to All Users Toggle */}
              <div className="flex items-center p-4 bg-gray-50 rounded-lg border border-gray-200">
                <input
                  type="checkbox"
                  id="applyToAll"
                  checked={scheduleForm.applyToAllUsers}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, applyToAllUsers: e.target.checked, users: [] })}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="applyToAll" className="ml-3 block text-sm">
                  <span className="font-medium text-gray-900">Apply to all users</span>
                  <p className="text-gray-600">
                    This schedule will apply to all regular users at the specified times
                  </p>
                </label>
              </div>

              {/* User Selection */}
              {!scheduleForm.applyToAllUsers && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Select Users ({scheduleForm.users.length} selected)
                    </label>
                    <div className="space-x-2">
                      <button type="button" onClick={selectAllUsers} className="text-xs text-primary-600 hover:text-primary-800">
                        Select All
                      </button>
                      <button type="button" onClick={deselectAllUsers} className="text-xs text-gray-600 hover:text-gray-800">
                        Deselect All
                      </button>
                    </div>
                  </div>
                  <div className="border border-gray-300 rounded-lg p-4 max-h-64 overflow-y-auto">
                    {/* Status Filter Info */}
                    <div className="mb-3 pb-3 border-b flex items-center justify-between">
                      <div className="text-xs text-gray-600">
                        Showing all users (Active: {users.filter(u => u.isActive !== false).length}, Disabled: {users.filter(u => u.isActive === false).length})
                      </div>
                      <div className="flex gap-2 text-xs">
                        <span className="px-2 py-1 bg-green-50 text-green-700 rounded">✓ Active</span>
                        <span className="px-2 py-1 bg-gray-50 text-gray-700 rounded">✗ Disabled</span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {users.map(u => (
                        <label
                          key={u.id}
                          className={`flex items-center space-x-3 p-3 rounded cursor-pointer transition-colors ${
                            scheduleForm.users.includes(u.id) 
                              ? 'bg-primary-50 border border-primary-200' 
                              : u.isActive === false 
                                ? 'hover:bg-gray-50 opacity-75' 
                                : 'hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={scheduleForm.users.includes(u.id)}
                            onChange={() => toggleUser(u.id)}
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                          />
                          <div className="flex items-center space-x-2 flex-1">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center overflow-hidden ${
                              u.isActive === false ? 'bg-gray-100' : 'bg-primary-100'
                            }`}>
                              {u.profileImage ? (
                                <img 
                                  src={`${API_ORIGIN}${u.profileImage}`} 
                                  alt={u.name} 
                                  className={`w-8 h-8 object-cover ${u.isActive === false ? 'grayscale' : ''}`}
                                />
                              ) : (
                                <UserIcon className={`w-4 h-4 ${u.isActive === false ? 'text-gray-400' : 'text-primary-600'}`} />
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <div className={`text-sm font-medium ${u.isActive === false ? 'text-gray-600' : 'text-gray-900'}`}>
                                  {u.name}
                                </div>
                                {u.isActive === false ? (
                                  <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">Disabled</span>
                                ) : (
                                  <span className="px-1.5 py-0.5 bg-green-100 text-green-600 rounded text-xs">Active</span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500">{u.email}</div>
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Days Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Active Days ({scheduleForm.days.length} selected)
                </label>
                <div className="flex flex-wrap gap-2">
                  {daysOfWeek.map(day => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        scheduleForm.days.includes(day)
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowScheduleModal(false)
                    setEditingSchedule(null)
                    resetScheduleForm()
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingSchedule ? 'Update Schedule' : 'Create Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default TimeManagement

