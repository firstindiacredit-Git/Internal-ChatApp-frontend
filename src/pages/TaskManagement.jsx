import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import axios from 'axios'
import { API_ORIGIN } from '../services/api'
import { 
  CheckCircle, 
  Circle, 
  Plus, 
  Edit, 
  Trash2, 
  ArrowLeft,
  Calendar,
  Filter,
  MessageCircle,
  Image,
  Video,
  Upload,
  X,
  Download,
  Send,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'

const TaskManagement = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tasks, setTasks] = useState([])
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDescription, setTaskDescription] = useState('')
  const [taskPriority, setTaskPriority] = useState('medium')
  const [taskStatus, setTaskStatus] = useState('pending')
  const [taskDueDate, setTaskDueDate] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')
  const [showAddForm, setShowAddForm] = useState(false)
  
  // Comment and Media states
  const [selectedTask, setSelectedTask] = useState(null)
  const [showComments, setShowComments] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const [previewMedia, setPreviewMedia] = useState(null)
  const [previewIndex, setPreviewIndex] = useState(0)

  useEffect(() => {
    fetchTasks()
  }, [filterStatus])

  const fetchTasks = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const params = filterStatus !== 'all' ? `?status=${filterStatus}` : ''
      const response = await axios.get(
        `${API_ORIGIN}/api/tasks${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setTasks(response.data)
    } catch (error) {
      console.error('Error fetching tasks:', error)
      toast.error('Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveTask = async () => {
    if (!taskTitle.trim()) {
      toast.error('Please enter a task title')
      return
    }

    try {
      const token = localStorage.getItem('token')
      const taskData = {
        title: taskTitle,
        description: taskDescription,
        priority: taskPriority,
        status: taskStatus,
        dueDate: taskDueDate || null
      }

      if (editingId) {
        await axios.put(
          `${API_ORIGIN}/api/tasks/${editingId}`,
          taskData,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        toast.success('Task updated successfully')
      } else {
        await axios.post(
          `${API_ORIGIN}/api/tasks`,
          taskData,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        toast.success('Task created successfully')
      }
      
      resetForm()
      fetchTasks()
    } catch (error) {
      console.error('Error saving task:', error)
      toast.error('Failed to save task')
    }
  }

  // Media upload handler - Creates comment with media
  const handleMediaUpload = async (e, taskId) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return

    setUploadingMedia(true)
    try {
      const token = localStorage.getItem('token')
      const mediaArray = []

      // Upload each file to Cloudinary
      for (const file of files) {
        const formData = new FormData()
        formData.append('file', file)

        const uploadResponse = await axios.post(
          `${API_ORIGIN}/api/tasks/upload-media`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'multipart/form-data',
            },
          }
        )

        mediaArray.push(uploadResponse.data)
      }

      // Create a comment with the uploaded media
      const response = await axios.post(
        `${API_ORIGIN}/api/tasks/${taskId}/comment`,
        { 
          text: '', // Empty text, only media
          media: mediaArray 
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      // Update task in state
      setTasks(tasks.map(t => (t._id === taskId ? response.data : t)))
      if (selectedTask && selectedTask._id === taskId) {
        setSelectedTask(response.data)
      }

      toast.success(`${mediaArray.length} file(s) uploaded as comment!`)
    } catch (error) {
      console.error('Error uploading media:', error)
      toast.error('Failed to upload media')
    } finally {
      setUploadingMedia(false)
    }
  }

  // Add comment handler
  const handleAddComment = async (taskId) => {
    if (!newComment.trim()) return

    try {
      const token = localStorage.getItem('token')
      const response = await axios.post(
        `${API_ORIGIN}/api/tasks/${taskId}/comment`,
        { text: newComment },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      // Update task in state
      setTasks(tasks.map(t => (t._id === taskId ? response.data : t)))
      if (selectedTask && selectedTask._id === taskId) {
        setSelectedTask(response.data)
      }

      setNewComment('')
      toast.success('Comment added!')
    } catch (error) {
      console.error('Error adding comment:', error)
      toast.error('Failed to add comment')
    }
  }

  // Media preview handlers - Gets media from task or comments
  const openMediaPreview = (source, index = 0) => {
    // Source can be either a task object or a comment object
    if (source.media && source.media.length > 0) {
      setPreviewMedia(source.media)
      setPreviewIndex(index)
    }
  }

  const closeMediaPreview = () => {
    setPreviewMedia(null)
    setPreviewIndex(0)
  }

  const nextMedia = () => {
    setPreviewIndex((prev) => (prev + 1) % previewMedia.length)
  }

  const prevMedia = () => {
    setPreviewIndex((prev) => (prev - 1 + previewMedia.length) % previewMedia.length)
  }

  const handleDownloadMedia = async (url, filename) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = filename || 'download'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)
      toast.success('Download started!')
    } catch (error) {
      console.error('Error downloading media:', error)
      toast.error('Failed to download')
    }
  }

  const handleToggleStatus = async (id, currentStatus) => {
    try {
      // Cycle through statuses: pending → in-progress → completed → pending
      let newStatus = 'pending'
      let newProgress = 0
      
      if (currentStatus === 'pending') {
        newStatus = 'in-progress'
        newProgress = 50
      } else if (currentStatus === 'in-progress') {
        newStatus = 'completed'
        newProgress = 100
      } else {
        newStatus = 'pending'
        newProgress = 0
      }
      
      // Optimistic update - Update UI immediately
      setTasks(prevTasks => prevTasks.map(task => 
        task._id === id 
          ? { ...task, status: newStatus, progress: newProgress }
          : task
      ))
      
      toast.success(`Status: ${newStatus === 'in-progress' ? 'In Progress' : newStatus}`)
      
      // Save to backend
      const token = localStorage.getItem('token')
      await axios.put(
        `${API_ORIGIN}/api/tasks/${id}`,
        { status: newStatus, progress: newProgress },
        { headers: { Authorization: `Bearer ${token}` } }
      )
    } catch (error) {
      console.error('Error updating task status:', error)
      toast.error('Failed to update task status')
      // Revert on error
      fetchTasks()
    }
  }

  const handleProgressChange = async (id, newProgress) => {
    try {
      // Auto-update status based on progress
      let newStatus = 'pending'
      if (newProgress > 0 && newProgress < 100) newStatus = 'in-progress'
      else if (newProgress === 100) newStatus = 'completed'
      
      // Optimistic update - Update UI immediately
      setTasks(prevTasks => prevTasks.map(task => 
        task._id === id 
          ? { ...task, progress: newProgress, status: newStatus }
          : task
      ))
      
      // Save to backend
      const token = localStorage.getItem('token')
      await axios.put(
        `${API_ORIGIN}/api/tasks/${id}`,
        { progress: newProgress, status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      )
    } catch (error) {
      console.error('Error updating progress:', error)
      toast.error('Failed to update progress')
      // Revert on error
      fetchTasks()
    }
  }

  const handleDeleteTask = async (id) => {
    if (!confirm('Are you sure you want to delete this task?')) return

    try {
      const token = localStorage.getItem('token')
      await axios.delete(
        `${API_ORIGIN}/api/tasks/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success('Task deleted successfully')
      fetchTasks()
    } catch (error) {
      console.error('Error deleting task:', error)
      toast.error('Failed to delete task')
    }
  }

  const handleEditTask = (task) => {
    setTaskTitle(task.title)
    setTaskDescription(task.description)
    setTaskPriority(task.priority)
    setTaskStatus(task.status)
    setTaskDueDate(task.dueDate ? task.dueDate.split('T')[0] : '')
    setEditingId(task._id)
    setShowAddForm(true)
  }

  const resetForm = () => {
    setTaskTitle('')
    setTaskDescription('')
    setTaskPriority('medium')
    setTaskStatus('pending')
    setTaskDueDate('')
    setEditingId(null)
    setShowAddForm(false)
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 border border-red-200'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border border-yellow-200'
      case 'low':
        return 'bg-green-100 text-green-800 border border-green-200'
      default:
        return 'bg-gray-100 text-gray-800 border border-gray-200'
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'in-progress':
        return 'bg-blue-100 text-blue-800'
      case 'pending':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header - Modern */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 mb-6 border border-white/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 hover:bg-gray-100 rounded-xl transition-all hover:scale-110"
              >
                <ArrowLeft className="w-6 h-6 text-gray-700" />
              </button>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  My Tasks
                </h1>
                <p className="text-sm text-gray-600 mt-1">Track and manage your assigned tasks</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-r from-blue-100 to-blue-200 px-4 py-3 rounded-xl">
                <div className="text-center">
                  <p className="text-xs text-blue-700 font-medium">Total Tasks</p>
                  <p className="text-2xl font-bold text-blue-900">{tasks.length}</p>
                </div>
              </div>
              <div className="bg-gradient-to-r from-green-100 to-green-200 px-4 py-3 rounded-xl">
                <div className="text-center">
                  <p className="text-xs text-green-700 font-medium">Completed</p>
                  <p className="text-2xl font-bold text-green-900">
                    {tasks.filter(t => t.status === 'completed').length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Tabs - Modern */}
        <div className="flex gap-3 mb-6">
          {['all', 'pending', 'in-progress', 'completed'].map(status => {
            const count = status === 'all' ? tasks.length : tasks.filter(t => t.status === status).length
            return (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`flex-1 py-4 px-6 rounded-xl font-semibold capitalize transition-all transform ${
                  filterStatus === status
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg scale-105'
                    : 'bg-white text-gray-700 hover:bg-gray-50 shadow'
                }`}
              >
                <div className="text-sm opacity-90">
                  {status === 'in-progress' ? 'In Progress' : status}
                </div>
                <div className="text-2xl font-bold mt-1">{count}</div>
              </button>
            )
          })}
        </div>

        {/* Tasks Grid */}
        {loading ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto"></div>
            <p className="text-gray-500 mt-4">Loading your tasks...</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-12 text-center">
            <CheckCircle className="w-20 h-20 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 text-lg font-semibold">No tasks found</p>
            <p className="text-gray-400 text-sm mt-2">Your admin will assign tasks to you</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tasks.map((task) => {
                const progressPercent = task.progress || 0
                const isCompleted = task.status === 'completed'
                const isInProgress = task.status === 'in-progress'
                
                return (
                  <div 
                    key={task._id} 
                    className={`bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 border-2 ${
                      isCompleted 
                        ? 'border-green-200' 
                        : isInProgress 
                        ? 'border-blue-200' 
                        : 'border-gray-200'
                    }`}
                  >
                    {/* Card Header */}
                    <div className={`p-4 rounded-t-2xl ${
                      isCompleted 
                        ? 'bg-gradient-to-r from-green-50 to-emerald-50' 
                        : isInProgress 
                        ? 'bg-gradient-to-r from-blue-50 to-indigo-50' 
                        : 'bg-gradient-to-r from-gray-50 to-slate-50'
                    }`}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <button
                            onClick={() => handleToggleStatus(task._id, task.status)}
                            className="flex-shrink-0 group mt-0.5"
                            title="Click to cycle status"
                          >
                            {isCompleted ? (
                              <div className="relative">
                                <CheckCircle className="w-8 h-8 text-green-600 group-hover:scale-110 transition-transform drop-shadow" />
                                <div className="absolute inset-0 bg-green-400 rounded-full blur-xl opacity-30 group-hover:opacity-50"></div>
                              </div>
                            ) : isInProgress ? (
                              <div className="relative">
                                <Circle className="w-8 h-8 text-blue-600 group-hover:scale-110 transition-transform" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="w-3.5 h-3.5 bg-blue-600 rounded-full animate-pulse"></div>
                                </div>
                              </div>
                            ) : (
                              <Circle className="w-8 h-8 text-gray-400 group-hover:text-blue-600 group-hover:scale-110 transition-all" />
                            )}
                          </button>
                          
                          <div className="flex-1">
                            <h3 className={`text-base font-bold mb-1 ${
                              isCompleted ? 'line-through text-gray-500' : 'text-gray-800'
                            }`}>
                              {task.title}
                            </h3>
                            <div className="flex flex-wrap gap-2">
                              <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${getPriorityColor(task.priority)}`}>
                                {task.priority}
                              </span>
                              <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${getStatusColor(task.status)}`}>
                                {task.status === 'in-progress' ? 'In Progress' : task.status}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="p-4">
                      {task.description && (
                        <p className="text-gray-600 text-sm mb-4 line-clamp-2 leading-relaxed">
                          {task.description}
                        </p>
                      )}

                      {/* Progress Section - Editable Progress Bar */}
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-bold text-gray-700">
                            Progress (Click to edit)
                          </label>
                          <span className={`text-lg font-bold ${
                            progressPercent === 100 ? 'text-green-600' : 'text-blue-600'
                          }`}>
                            {progressPercent}%
                          </span>
                        </div>
                        
                        {/* Clickable Progress Bar with Slider Inside */}
                        <div className="relative group">
                          <div className="h-8 bg-gray-100 rounded-full overflow-hidden shadow-inner cursor-pointer">
                            <div 
                              className={`h-full transition-all duration-500 ease-out relative ${
                                progressPercent === 100 
                                  ? 'bg-gradient-to-r from-green-400 via-green-500 to-green-600' 
                                  : progressPercent > 0
                                  ? 'bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600'
                                  : 'bg-gray-200'
                              }`}
                              style={{ width: `${progressPercent}%` }}
                            >
                              {progressPercent > 0 && (
                                <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                              )}
                            </div>
                            
                            {/* Hidden Slider Overlay */}
                            <input
                              type="range"
                              min="0"
                              max="100"
                              step="5"
                              value={progressPercent}
                              onChange={(e) => handleProgressChange(task._id, parseInt(e.target.value))}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                          </div>
                          
                          {/* Percentage Markers */}
                          <div className="flex justify-between mt-1 px-1">
                            {[0, 25, 50, 75, 100].map(val => (
                              <button
                                key={val}
                                onClick={() => handleProgressChange(task._id, val)}
                                className="text-[10px] text-gray-400 hover:text-blue-600 font-medium transition-colors"
                              >
                                {val}%
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Dates & Attachment Indicator */}
                      <div className="mb-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 space-y-2">
                            {task.startDate && (
                              <div className="flex items-center gap-2 text-sm">
                                <Calendar className="w-4 h-4 text-blue-600" />
                                <span className="text-gray-600 font-medium">Start:</span>
                                <span className="bg-blue-50 text-blue-800 px-2 py-1 rounded text-xs font-semibold">
                                  {new Date(task.startDate).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                  })}
                                </span>
                              </div>
                            )}
                            {task.dueDate && (
                              <div className="flex items-center gap-2 text-sm">
                                <Calendar className="w-4 h-4 text-yellow-600" />
                                <span className="text-gray-600 font-medium">Due:</span>
                                <span className="bg-yellow-50 text-yellow-800 px-2 py-1 rounded text-xs font-semibold">
                                  {new Date(task.dueDate).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                  })}
                                </span>
                              </div>
                            )}
                            {task.endDate && (
                              <div className="flex items-center gap-2 text-sm">
                                <Calendar className="w-4 h-4 text-green-600" />
                                <span className="text-gray-600 font-medium">End:</span>
                                <span className="bg-green-50 text-green-800 px-2 py-1 rounded text-xs font-semibold">
                                  {new Date(task.endDate).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                  })}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Attachment Indicator - Shows task creation attachments */}
                          {task.media && task.media.length > 0 && (
                            <button
                              onClick={() => openMediaPreview(task, 0)}
                              className="flex flex-col items-center gap-1 p-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition-all group"
                              title={`${task.media.length} attachment(s) from task creation`}
                            >
                              <Image className="w-6 h-6 text-purple-600 group-hover:scale-110 transition-transform" />
                              <span className="text-xs font-bold text-purple-600">
                                {task.media.length}
                              </span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Comments Preview - Last Comment Only */}
                      {task.comments && task.comments.length > 0 && (
                        <div className="mb-4">
                          <div className="flex items-center gap-2 mb-2">
                            <MessageCircle className="w-4 h-4 text-blue-600" />
                            <h4 className="text-xs font-bold text-gray-700">
                              Comments ({task.comments.length})
                            </h4>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold text-gray-700">
                                {task.comments[task.comments.length - 1].userName}
                              </span>
                              <span className="text-[10px] text-gray-500">
                                {new Date(task.comments[task.comments.length - 1].createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            
                            {/* Comment Text */}
                            {task.comments[task.comments.length - 1].text && (
                              <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                                {task.comments[task.comments.length - 1].text}
                              </p>
                            )}
                            
                            {/* Comment Media Indicator - No Preview */}
                            {task.comments[task.comments.length - 1].media && task.comments[task.comments.length - 1].media.length > 0 && (
                              <div className="flex items-center gap-1.5 mt-2 text-purple-600">
                                <Image className="w-3.5 h-3.5" />
                                <span className="text-xs font-medium">
                                  {task.comments[task.comments.length - 1].media.length} attachment{task.comments[task.comments.length - 1].media.length > 1 ? 's' : ''}
                                </span>
                              </div>
                            )}
                            
                            {task.comments.length > 1 && (
                              <button
                                onClick={() => {
                                  setSelectedTask(task)
                                  setShowComments(true)
                                }}
                                className="text-[10px] text-blue-600 hover:underline mt-1"
                              >
                                +{task.comments.length - 1} more comment{task.comments.length - 1 > 1 ? 's' : ''}
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-2 pt-3 border-t border-gray-100">
                        <button
                          onClick={() => {
                            setSelectedTask(task)
                            setShowComments(true)
                          }}
                          className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                        >
                          <MessageCircle className="w-4 h-4" />
                          Add Comment
                        </button>
                        <label className="flex-1 cursor-pointer">
                          <div className="flex items-center justify-center gap-2 py-2 px-3 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors text-sm font-medium">
                            <Upload className="w-4 h-4" />
                            {uploadingMedia && selectedTask?._id === task._id ? 'Uploading...' : 'Upload'}
                          </div>
                          <input
                            type="file"
                            multiple
                            accept="image/*,video/*"
                            onChange={(e) => handleMediaUpload(e, task._id)}
                            className="hidden"
                            disabled={uploadingMedia}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                )
              })}
          </div>
        )}
      </div>

      {/* Comment Modal */}
      {showComments && selectedTask && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">{selectedTask.title}</h3>
                <p className="text-sm opacity-90">Add your comments</p>
              </div>
              <button
                onClick={() => {
                  setShowComments(false)
                  setNewComment('')
                }}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Comments List */}
            <div className="p-4 max-h-96 overflow-y-auto custom-scrollbar">
              {selectedTask.comments && selectedTask.comments.length > 0 ? (
                <div className="space-y-3">
                  {selectedTask.comments.map((comment, idx) => (
                    <div key={idx} className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-gray-800">
                          {comment.userName}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(comment.createdAt).toLocaleString()}
                        </span>
                      </div>
                      
                      {/* Comment Text */}
                      {comment.text && (
                        <p className="text-gray-700 mb-2">{comment.text}</p>
                      )}
                      
                      {/* Comment Media */}
                      {comment.media && comment.media.length > 0 && (
                        <div className="grid grid-cols-3 gap-2 mt-2">
                          {comment.media.map((media, mediaIdx) => (
                            <div
                              key={mediaIdx}
                              onClick={() => openMediaPreview(comment, mediaIdx)}
                              className="relative aspect-square rounded-lg overflow-hidden cursor-pointer hover:scale-105 transition-transform group"
                            >
                              {media.type === 'image' ? (
                                <img
                                  src={media.url}
                                  alt={media.filename}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                                  <Video className="w-8 h-8 text-gray-400" />
                                </div>
                              )}
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all"></div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500">No comments yet. Be the first to comment!</p>
                </div>
              )}
            </div>

            {/* Add Comment Input */}
            <div className="p-4 border-t border-gray-200">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleAddComment(selectedTask._id)
                    }
                  }}
                  placeholder="Write your comment..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                
                {/* Upload Media Button */}
                <label className="cursor-pointer">
                  <div className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2">
                    <Image className="w-4 h-4" />
                    <span>{uploadingMedia ? 'Uploading...' : 'Media'}</span>
                  </div>
                  <input
                    type="file"
                    multiple
                    accept="image/*,video/*"
                    onChange={(e) => selectedTask && handleMediaUpload(e, selectedTask._id)}
                    className="hidden"
                    disabled={uploadingMedia}
                  />
                </label>
                
                <button
                  onClick={() => handleAddComment(selectedTask._id)}
                  disabled={!newComment.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Media Preview Modal */}
      {previewMedia && previewMedia.length > 0 && (
        <div 
          className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={closeMediaPreview}
        >
          <div className="relative max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
            {/* Close Button */}
            <button
              onClick={closeMediaPreview}
              className="absolute top-4 right-4 z-10 p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>

            {/* Download Button */}
            <button
              onClick={() => handleDownloadMedia(previewMedia[previewIndex].url, previewMedia[previewIndex].filename)}
              className="absolute top-4 right-16 z-10 p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
              title="Download"
            >
              <Download className="w-6 h-6 text-white" />
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

            {/* Media Content */}
            <div className="bg-white rounded-lg overflow-hidden max-h-[80vh]">
              {previewMedia[previewIndex].type === 'image' ? (
                <img
                  src={previewMedia[previewIndex].url}
                  alt={previewMedia[previewIndex].filename}
                  className="w-full h-full object-contain max-h-[70vh]"
                />
              ) : (
                <video
                  src={previewMedia[previewIndex].url}
                  controls
                  className="w-full h-full object-contain max-h-[70vh]"
                />
              )}
              
              {/* Media Info */}
              <div className="p-4 bg-gray-50">
                <p className="text-sm font-medium text-gray-800">{previewMedia[previewIndex].filename}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {previewIndex + 1} of {previewMedia.length}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Custom Styles */}
      <style dangerouslySetInnerHTML={{__html: `
        input[type="range"]::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          border: 3px solid currentColor;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          transition: all 0.2s;
        }
        input[type="range"]::-webkit-slider-thumb:hover {
          transform: scale(1.2);
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #888;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #555;
        }
      `}} />
    </div>
  )
}

export default TaskManagement

