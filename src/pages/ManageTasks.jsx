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
  ArrowLeft,
  Users,
  Search,
  Calendar,
  Edit,
  Trash2,
  X,
  Grid3x3,
  List,
  TrendingUp,
  MessageCircle,
  Image,
  Video,
  Upload,
  Download,
  Send,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'

const ManageTasks = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  
  // Form states
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDescription, setTaskDescription] = useState('')
  const [taskPriority, setTaskPriority] = useState('medium')
  const [taskStatus, setTaskStatus] = useState('pending')
  const [taskStartDate, setTaskStartDate] = useState(new Date().toISOString().split('T')[0])
  const [taskDueDate, setTaskDueDate] = useState('')
  const [taskEndDate, setTaskEndDate] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [viewMode, setViewMode] = useState('grid') // 'grid' or 'list'
  
  // Form media attachments
  const [formMediaFiles, setFormMediaFiles] = useState([])
  const [formMediaPreviews, setFormMediaPreviews] = useState([])
  
  // Comment and Media states
  const [selectedTask, setSelectedTask] = useState(null)
  const [showComments, setShowComments] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const [previewMedia, setPreviewMedia] = useState(null)
  const [previewIndex, setPreviewIndex] = useState(0)

  useEffect(() => {
    fetchUsers()
  }, [])

  useEffect(() => {
    if (selectedUser) {
      const userId = selectedUser._id || selectedUser.id
      if (userId) {
        fetchUserTasks(userId)
      }
    }
  }, [selectedUser])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const response = await axios.get(
        `${API_ORIGIN}/api/users`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      console.log('Users fetched:', response.data.length)
      const regularUsers = response.data.filter(u => u.role === 'user' && (u._id || u.id))
      console.log('Regular users with id:', regularUsers.length)
      setUsers(regularUsers)
    } catch (error) {
      console.error('Error fetching users:', error)
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const fetchUserTasks = async (userId) => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      console.log('Fetching tasks for user:', userId)
      const response = await axios.get(
        `${API_ORIGIN}/api/tasks/user/${userId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      console.log('Tasks fetched:', response.data.length)
      setTasks(response.data)
    } catch (error) {
      console.error('Error fetching tasks:', error)
      console.error('Error response:', error.response?.data)
      toast.error('Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }

  // Handle form media selection (for create/edit task form)
  const handleFormMediaSelect = (e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return

    // Add new files to existing ones
    setFormMediaFiles(prev => [...prev, ...files])

    // Create preview URLs
    files.forEach(file => {
      const reader = new FileReader()
      reader.onloadend = () => {
        setFormMediaPreviews(prev => [...prev, {
          url: reader.result,
          type: file.type.startsWith('video/') ? 'video' : 'image',
          name: file.name
        }])
      }
      reader.readAsDataURL(file)
    })
  }

  // Remove media from form
  const handleRemoveFormMedia = (index) => {
    setFormMediaFiles(prev => prev.filter((_, i) => i !== index))
    setFormMediaPreviews(prev => prev.filter((_, i) => i !== index))
  }

  // Upload form media to Cloudinary
  const uploadFormMedia = async () => {
    if (formMediaFiles.length === 0) return []

    const token = localStorage.getItem('token')
    const mediaArray = []

    for (const file of formMediaFiles) {
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

    return mediaArray
  }

  // Media upload handler (for existing tasks) - Creates comment with media
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

  const handleCreateTask = async () => {
    if (!taskTitle.trim()) {
      toast.error('Please enter task title')
      return
    }

    if (!selectedUser) {
      toast.error('Please select a user')
      return
    }

    try {
      setUploadingMedia(true)
      const token = localStorage.getItem('token')
      const userId = selectedUser._id || selectedUser.id
      
      console.log('Creating task for user:', userId, selectedUser.name)
      
      // Upload media first if any
      let uploadedMedia = []
      if (formMediaFiles.length > 0) {
        toast.loading('Uploading attachments...', { id: 'upload' })
        uploadedMedia = await uploadFormMedia()
        toast.dismiss('upload')
      }
      
      const taskData = {
        userId: userId,
        title: taskTitle,
        description: taskDescription,
        priority: taskPriority,
        status: taskStatus,
        startDate: taskStartDate || new Date().toISOString().split('T')[0],
        dueDate: taskDueDate || null,
        endDate: taskEndDate || null,
        media: uploadedMedia // Include media in task creation
      }

      console.log('Task data:', taskData)

      let createdTask
      if (editingId) {
        const response = await axios.put(
          `${API_ORIGIN}/api/tasks/${editingId}/update`,
          taskData,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        createdTask = response.data
        toast.success('Task updated successfully')
      } else {
        const response = await axios.post(
          `${API_ORIGIN}/api/tasks/assign`,
          taskData,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        createdTask = response.data
        console.log('Created task with media:', createdTask)
        
        toast.success('Task created successfully!')
      }

      resetForm()
      fetchUserTasks(userId)
    } catch (error) {
      console.error('Error creating task:', error)
      console.error('Error response:', error.response?.data)
      const errorMsg = error.response?.data?.error || 'Failed to create task'
      toast.error(errorMsg)
    } finally {
      setUploadingMedia(false)
    }
  }

  const handleDeleteTask = async (id) => {
    if (!confirm('Are you sure you want to delete this task?')) return

    try {
      const token = localStorage.getItem('token')
      await axios.delete(
        `${API_ORIGIN}/api/tasks/${id}/delete`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success('Task deleted successfully')
      const userId = selectedUser._id || selectedUser.id
      fetchUserTasks(userId)
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
    setTaskStartDate(task.startDate ? task.startDate.split('T')[0] : new Date().toISOString().split('T')[0])
    setTaskDueDate(task.dueDate ? task.dueDate.split('T')[0] : '')
    setTaskEndDate(task.endDate ? task.endDate.split('T')[0] : '')
    setEditingId(task._id)
    setShowAddForm(true)
  }

  const resetForm = () => {
    setTaskTitle('')
    setTaskDescription('')
    setTaskPriority('medium')
    setTaskStatus('pending')
    setTaskStartDate(new Date().toISOString().split('T')[0])
    setTaskDueDate('')
    setTaskEndDate('')
    setEditingId(null)
    setShowAddForm(false)
    setFormMediaFiles([])
    setFormMediaPreviews([])
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
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

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-200  ">
      <div className="max-w-8xl mx-auto px-4 py-3">
        {/* Header */}
        <div className="bg-white  p-6 mb-2 border border-gray-100">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-gray-700" />
            </button>
            <div className="flex-1">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Manage User Tasks
              </h1>
              <p className="text-sm text-gray-600 mt-1">Create and assign tasks to users</p>
            </div>
            
            {selectedUser && (
              <div>
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 hover:from-blue-700 hover:to-purple-700 transition-all flex items-center justify-center gap-1 font-semibold"
                >
                  <Plus className="w-5 h-5" />
                  Create New Task for {selectedUser.name}
                </button>
              </div>
            )}
              
            <div className="flex items-center gap-3 bg-gradient-to-r from-blue-100 to-purple-100 px-3 py-0.5 ">
              <Users className="w-5 h-5 text-blue-600" />
              <div className="text-right">
                <p className="text-xs text-gray-600">Total Users</p>
                <p className="text-xl font-bold text-gray-800">{users.length}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
          {/* Users List */}
          <div className="lg:col-span-1">
            <div className="bg-white shadow p-4 border border-gray-200 sticky top-3 self-start">
              <h2 className="text-base font-semibold text-gray-700 mb-3">Select User</h2>
              
              {/* Search */}
              <div className="relative mb-3">
                <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Users List */}
              <div className="space-y-1 max-h-[60vh] overflow-y-auto scrollbar-hide">
                {filteredUsers.map(u => (
                  <div
                    key={u._id}
                    onClick={() => setSelectedUser(u)}
                    className={`p-2 rounded cursor-pointer transition-colors ${
                      selectedUser?._id === u._id
                        ? 'bg-gray-100 '
                        : 'bg-blue_500  hover:bg-gray-500'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {u.profileImage ? (
                        <img
                          src={`${API_ORIGIN}${u.profileImage}`}
                          alt={u.name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className={`w-8 h-8 rounded-full bg-blue_500 flex items-center justify-center ${
                          selectedUser?._id === u._id ? 'bg-gray-800/20' : 'bg-blue-500'
                        }`}>
                          <span className="text-blue_500 text-xs font-semibold">{u.name.charAt(0).toUpperCase()}</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${selectedUser?._id === u._id ? 'text-black' : 'text-blue_500'}`}>
                          {u.name}
                        </p>
                        <p className={`text-xs truncate ${selectedUser?._id === u._id ? 'text-gray-800/80' : 'text-gray-500'}`}>
                          {u.email}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tasks Section */}
          <div className="lg:col-span-2">
            {!selectedUser ? (
              <div className="bg-white  p-1 border border-gray-100 text-center">
                <Users className="w-20 h-20 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">Select a user to manage their tasks</p>
              </div>
            ) : (
              <>
                {/* Create Task Button */}
               

                {/* Add/Edit Task Form */}
                {showAddForm && (
                  <div className="bg-white p-6 border border-gray-100 mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-bold text-gray-800">
                        {editingId ? 'Edit Task' : 'Create New Task'}
                      </h2>
                      <button onClick={resetForm} className="text-gray-500 hover:text-gray-700">
                        <X className="w-6 h-6" />
                      </button>
                    </div>
                    
                    <div className="space-y-1">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Task Title *
                        </label>
                        <input
                          type="text"
                          value={taskTitle}
                          onChange={(e) => setTaskTitle(e.target.value)}
                          placeholder="Enter task title"
                          className="w-full px-4 py-2 border-2 border-gray-200  focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 ">
                          Description
                        </label>
                        <textarea
                          value={taskDescription}
                          onChange={(e) => setTaskDescription(e.target.value)}
                          placeholder="Enter task description"
                          className="w-full px-4 py-2 border-2 border-gray-200  focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                          rows="4"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 ">
                            Priority
                          </label>
                          <select
                            value={taskPriority}
                            onChange={(e) => setTaskPriority(e.target.value)}
                            className="w-full px-4 py-2 border-2 border-gray-200  focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 ">
                            Status
                          </label>
                          <select
                            value={taskStatus}
                            onChange={(e) => setTaskStatus(e.target.value)}
                            className="w-full px-4 py-2 border-2 border-gray-200  focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="pending">Pending</option>
                            <option value="in-progress">In Progress</option>
                            <option value="completed">Completed</option>
                          </select>
                        </div>
                      </div>

                      {/* Date Fields */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 ">
                            Start Date (Auto-filled)
                          </label>
                          <input
                            type="date"
                            value={taskStartDate}
                            onChange={(e) => setTaskStartDate(e.target.value)}
                            className="w-full px-4 py-2 border-2 border-gray-200  focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-blue-50"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 ">
                            Due Date (Optional)
                          </label>
                          <input
                            type="date"
                            value={taskDueDate}
                            onChange={(e) => setTaskDueDate(e.target.value)}
                            className="w-full px-4 py-2 border-2 border-gray-200  focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 ">
                            End Date (Optional)
                          </label>
                          <input
                            type="date"
                            value={taskEndDate}
                            onChange={(e) => setTaskEndDate(e.target.value)}
                            className="w-full px-4 py-2 border-2 border-gray-200  focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      </div>

                      {/* Attachments Section */}
                      <div>
                          <label className="block text-sm font-medium text-gray-700 ">
                          Attachments (Images/Videos)
                        </label>
                        
                        {/* Upload Button */}
                        <label className="cursor-pointer">
                          <div className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300  hover:border-blue-500 hover:bg-blue-50 transition-all">
                            <Upload className="w-5 h-5 text-gray-500" />
                            <span className="text-gray-600 font-medium">
                              {uploadingMedia ? 'Uploading...' : 'Click to upload files'}
                            </span>
                          </div>
                          <input
                            type="file"
                            multiple
                            accept="image/*,video/*"
                            onChange={handleFormMediaSelect}
                            className="hidden"
                            disabled={uploadingMedia}
                          />
                        </label>

                        {/* Media Previews */}
                        {formMediaPreviews.length > 0 && (
                          <div className="mt-3 grid grid-cols-4 gap-3">
                            {formMediaPreviews.map((media, idx) => (
                              <div key={idx} className="relative group">
                                <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                                  {media.type === 'image' ? (
                                    <img
                                      src={media.url}
                                      alt={media.name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <Video className="w-8 h-8 text-gray-400" />
                                    </div>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleRemoveFormMedia(idx)}
                                  className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
                                  title="Remove"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                                <p className="text-xs text-gray-600 mt-1 truncate" title={media.name}>
                                  {media.name}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 mb-1">
                        <button
                          onClick={handleCreateTask}
                          disabled={uploadingMedia}
                          className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3  hover:from-blue-700 hover:to-purple-700 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {uploadingMedia ? 'Uploading...' : editingId ? 'Update Task' : 'Create Task'}
                        </button>
                        <button
                          onClick={resetForm}
                          disabled={uploadingMedia}
                          className="px-6 py-3 bg-gray-200 text-gray-700  hover:bg-gray-300 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tasks List */}
                <div className="bg-white p-4 border border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-800">
                      {selectedUser.name}'s Tasks ({tasks.length})
                    </h2>
                    
                    {/* View Toggle */}
                    <div className="flex items-center gap-2 bg-gray-100  p-1">
                      <button
                        onClick={() => setViewMode('grid')}
                        className={`p-2 transition-all ${
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
                        className={`p-2  transition-all ${
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

                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-blue-600"></div>
                    </div>
                  ) : tasks.length === 0 ? (
                    <div className="text-center py-12">
                      <Circle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500 text-lg">No tasks assigned yet</p>
                    </div>
                  ) : viewMode === 'grid' ? (
                    /* Grid View */
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto scrollbar-hide">
                      {tasks.map(task => {
                        const progressPercent = task.progress || 0
                        const isCompleted = task.status === 'completed'
                        const isInProgress = task.status === 'in-progress'
                        
                        return (
                          <div 
                            key={task._id} 
                            className={`bg-white rounded-xl shadow-md hover:shadow-lg transition-all border-2 ${
                              isCompleted 
                                ? 'border-green-300' 
                                : isInProgress 
                                ? 'border-blue-300' 
                                : 'border-gray-200'
                            }`}
                          >
                            {/* Card Header */}
                            <div className={`p-4 rounded-t-xl border-b ${
                              isCompleted 
                                ? 'bg-green-50 border-green-200' 
                                : isInProgress 
                                ? 'bg-blue-50 border-blue-200' 
                                : 'bg-gray-50 border-gray-200'
                            }`}>
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h3 className={`text-base font-bold mb-1 ${
                                    isCompleted ? 'line-through text-gray-500' : 'text-gray-800'
                                  }`}>
                                    {task.title}
                                  </h3>
                                  <div className="flex flex-wrap gap-2">
                                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${getPriorityColor(task.priority)}`}>
                                      {task.priority}
                                    </span>
                                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${getStatusColor(task.status)}`}>
                                      {task.status === 'in-progress' ? 'In Progress' : task.status}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => handleEditTask(task)}
                                    className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                                    title="Edit Task"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteTask(task._id)}
                                    className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                                    title="Delete Task"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Card Body */}
                            <div className="p-4">
                              {task.description && (
                                <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                                  {task.description}
                                </p>
                              )}

                              {/* Progress Bar */}
                              <div className="mb-3">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-bold text-gray-700">Progress</span>
                                  <span className={`text-sm font-bold ${
                                    progressPercent === 100 ? 'text-green-600' : 'text-blue-600'
                                  }`}>
                                    {progressPercent}%
                                  </span>
                                </div>
                                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full transition-all duration-300 ${
                                      progressPercent === 100 
                                        ? 'bg-gradient-to-r from-green-400 to-green-600' 
                                        : progressPercent > 0
                                        ? 'bg-gradient-to-r from-blue-400 to-blue-600'
                                        : 'bg-gray-300'
                                    }`}
                                    style={{ width: `${progressPercent}%` }}
                                  ></div>
                                </div>
                              </div>

                              {/* Dates Timeline with Attachments */}
                              <div className="flex items-start gap-3 mb-3">
                                <div className="flex-1 space-y-2 text-xs">
                                  {task.startDate && (
                                    <div className="flex items-center gap-2 text-gray-600">
                                      <span className="font-semibold w-16">Start:</span>
                                      <span className="bg-blue-50 px-2 py-1 rounded">
                                        {new Date(task.startDate).toLocaleDateString('en-US', {
                                          month: 'short',
                                          day: 'numeric',
                                          year: 'numeric'
                                        })}
                                      </span>
                                    </div>
                                  )}
                                  {task.dueDate && (
                                    <div className="flex items-center gap-2 text-gray-600">
                                      <span className="font-semibold w-16">Due:</span>
                                      <span className="bg-yellow-50 px-2 py-1 rounded">
                                        {new Date(task.dueDate).toLocaleDateString('en-US', {
                                          month: 'short',
                                          day: 'numeric',
                                          year: 'numeric'
                                        })}
                                      </span>
                                    </div>
                                  )}
                                  {task.endDate && (
                                    <div className="flex items-center gap-2 text-gray-600">
                                      <span className="font-semibold w-16">End:</span>
                                      <span className="bg-green-50 px-2 py-1 rounded">
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
                                    className="flex flex-col items-center gap-1 p-2 bg-purple-50 hover:bg-purple-100 rounded-lg transition-all group"
                                    title={`${task.media.length} attachment(s) from task creation`}
                                  >
                                    <Image className="w-5 h-5 text-purple-600 group-hover:scale-110 transition-transform" />
                                    <span className="text-[10px] font-bold text-purple-600">
                                      {task.media.length}
                                    </span>
                                  </button>
                                )}
                              </div>

                              {/* Comments Preview - Last Comment with Media */}
                              {task.comments && task.comments.length > 0 && (
                                <div className="mb-3">
                                  <div className="flex items-center gap-1 mb-2">
                                    <MessageCircle className="w-3.5 h-3.5 text-blue-600" />
                                    <h4 className="text-xs font-bold text-gray-700">Comments ({task.comments.length})</h4>
                                  </div>
                                  <div className="bg-gray-50 rounded-lg p-2">
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
                                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-xs font-medium"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                  Comment
                                </button>
                                <label className="flex-1 cursor-pointer">
                                  <div className="flex items-center justify-center gap-1.5 py-2 px-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors text-xs font-medium">
                                    <Upload className="w-3.5 h-3.5" />
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
                  ) : (
                    /* List View */
                    <div className="space-y-3 max-h-[600px] overflow-y-auto scrollbar-hide">
                      {tasks.map(task => {
                        const progressPercent = task.progress || 0
                        const isCompleted = task.status === 'completed'
                        const isInProgress = task.status === 'in-progress'
                        
                        return (
                          <div 
                            key={task._id} 
                            className={`bg-white rounded-xl shadow-md hover:shadow-lg transition-all border-l-4 ${
                              isCompleted 
                                ? 'border-l-green-500' 
                                : isInProgress 
                                ? 'border-l-blue-500' 
                                : 'border-l-gray-300'
                            }`}
                          >
                            <div className="p-4">
                              <div className="flex items-start gap-4">
                                {/* Left Section - Title & Description */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between mb-2">
                                    <div className="flex-1">
                                      <h3 className={`text-lg font-bold mb-1 ${
                                        isCompleted ? 'line-through text-gray-500' : 'text-gray-800'
                                      }`}>
                                        {task.title}
                                      </h3>
                                      {task.description && (
                                        <p className="text-gray-600 text-sm line-clamp-2">
                                          {task.description}
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex gap-1 ml-3">
                                      <button
                                        onClick={() => handleEditTask(task)}
                                        className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                                        title="Edit Task"
                                      >
                                        <Edit className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteTask(task._id)}
                                        className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                                        title="Delete Task"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap gap-2 mb-3">
                                    <span className={`px-2 py-1 rounded-lg text-xs font-bold uppercase ${getPriorityColor(task.priority)}`}>
                                      {task.priority}
                                    </span>
                                    <span className={`px-2 py-1 rounded-lg text-xs font-bold uppercase ${getStatusColor(task.status)}`}>
                                      {task.status === 'in-progress' ? 'In Progress' : task.status}
                                    </span>
                                  </div>
                                </div>

                                {/* Right Section - Progress & Dates */}
                                <div className="w-64 flex-shrink-0">
                                  {/* Progress */}
                                  <div className="mb-3">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-xs font-bold text-gray-700">Progress</span>
                                      <span className={`text-sm font-bold ${
                                        progressPercent === 100 ? 'text-green-600' : 'text-blue-600'
                                      }`}>
                                        {progressPercent}%
                                      </span>
                                    </div>
                                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                                      <div 
                                        className={`h-full transition-all duration-300 ${
                                          progressPercent === 100 
                                            ? 'bg-gradient-to-r from-green-400 to-green-600' 
                                            : progressPercent > 0
                                            ? 'bg-gradient-to-r from-blue-400 to-blue-600'
                                            : 'bg-gray-300'
                                        }`}
                                        style={{ width: `${progressPercent}%` }}
                                      ></div>
                                    </div>
                                  </div>

                                  {/* Dates with Attachment Indicator */}
                                  <div className="flex items-start gap-2">
                                    <div className="flex-1 space-y-1.5 text-xs">
                                      {task.startDate && (
                                        <div className="flex items-center justify-between">
                                          <span className="text-gray-500 font-medium">Start:</span>
                                          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded font-semibold">
                                            {new Date(task.startDate).toLocaleDateString('en-US', {
                                              month: 'short',
                                              day: 'numeric'
                                            })}
                                          </span>
                                        </div>
                                      )}
                                      {task.dueDate && (
                                        <div className="flex items-center justify-between">
                                          <span className="text-gray-500 font-medium">Due:</span>
                                          <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded font-semibold">
                                            {new Date(task.dueDate).toLocaleDateString('en-US', {
                                              month: 'short',
                                              day: 'numeric'
                                            })}
                                          </span>
                                        </div>
                                      )}
                                      {task.endDate && (
                                        <div className="flex items-center justify-between">
                                          <span className="text-gray-500 font-medium">End:</span>
                                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded font-semibold">
                                            {new Date(task.endDate).toLocaleDateString('en-US', {
                                              month: 'short',
                                              day: 'numeric'
                                            })}
                                          </span>
                                        </div>
                                      )}
                                    </div>

                                    {/* Attachment Indicator - Shows task creation attachments */}
                                    {task.media && task.media.length > 0 && (
                                      <button
                                        onClick={() => openMediaPreview(task, 0)}
                                        className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 bg-purple-50 hover:bg-purple-100 rounded-lg transition-all group min-w-[50px]"
                                        title={`${task.media.length} attachment(s) from task creation`}
                                      >
                                        <Image className="w-4 h-4 text-purple-600 group-hover:scale-110 transition-transform" />
                                        <span className="text-[9px] font-bold text-purple-600">
                                          {task.media.length} files
                                        </span>
                                      </button>
                                    )}
                                  </div>

                                  {/* Comments in List View */}
                                  {task.comments && task.comments.length > 0 && (
                                    <div className="mt-3">
                                      <div className="bg-gray-50 rounded-lg p-2">
                                        <div className="flex items-center gap-2 mb-1">
                                          <MessageCircle className="w-3.5 h-3.5 text-blue-600" />
                                          <span className="text-xs font-bold text-gray-700">
                                            {task.comments.length} comment(s)
                                          </span>
                                        </div>
                                        
                                        {/* Last Comment Text */}
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
                                      </div>
                                    </div>
                                  )}

                                  {/* Action Buttons */}
                                  <div className="flex gap-2 mt-3">
                                    <button
                                      onClick={() => {
                                        setSelectedTask(task)
                                        setShowComments(true)
                                      }}
                                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-xs font-medium"
                                    >
                                      <MessageCircle className="w-3.5 h-3.5" />
                                      Comment
                                    </button>
                                    <label className="flex-1 cursor-pointer">
                                      <div className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors text-xs font-medium">
                                        <Upload className="w-3.5 h-3.5" />
                                        Upload
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
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Comment Modal */}
      {showComments && selectedTask && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">{selectedTask.title}</h3>
                <p className="text-sm opacity-90">Comments & Discussion</p>
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
            <div className="p-4 max-h-96 overflow-y-auto scrollbar-hide">
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

      <style dangerouslySetInnerHTML={{__html: `
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}} />
    </div>
  )
}

export default ManageTasks

