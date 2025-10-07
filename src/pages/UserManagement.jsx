import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { usersAPI, API_ORIGIN } from '../services/api'
import { toast } from 'react-hot-toast'
import { 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Users, 
  UserPlus,
  X,
  Settings,
  Mail,
  Phone,
  Crown,
  Shield,
  User as UserIcon,
  Check,
  XCircle,
  ToggleLeft,
  ToggleRight,
  Power,
  ArrowLeft,
  LayoutGrid,
  List as ListIcon,
  Eye,
  EyeOff,
  Clock,
  Calendar
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const UserManagement = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user',
    phone: '',
    designation: '',
    bio: '',
    isActive: true
  })
  const [currentPassword, setCurrentPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)

  // View and selection state
  const [viewMode, setViewMode] = useState('list') // 'grid' | 'list'
  const [selectedUserIds, setSelectedUserIds] = useState(new Set())

  const isSelected = (id) => selectedUserIds.has(id)
  const toggleSelect = (id) => {
    setSelectedUserIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  const clearSelection = () => setSelectedUserIds(new Set())
  const selectAllFiltered = () => setSelectedUserIds(new Set(filteredUsers.map(u => u.id)))

  const handleBulkSetActive = async (shouldBeActive) => {
    if (selectedUserIds.size === 0) return
    const confirmText = shouldBeActive ? 'enable' : 'disable'
    if (!window.confirm(`Are you sure you want to ${confirmText} ${selectedUserIds.size} selected user(s)?`)) return
    try {
      // Toggle only those which need change
      const idToUser = new Map(users.map(u => [u.id, u]))
      let successCount = 0
      let skipCount = 0
      
      for (const id of selectedUserIds) {
        const u = idToUser.get(id)
        if (!u) continue
        
        // Skip self, superadmins (if admin), and users already in desired state
        if (id === user?.id) {
          skipCount++
          continue
        }
        if (user.role === 'admin' && u.role === 'admin') {
          skipCount++
          continue
        }
        if ((u.isActive ?? true) === shouldBeActive) {
          skipCount++
          continue
        }
        
        try {
          await usersAPI.toggleUserStatus(id)
          successCount++
        } catch (err) {
          console.error(`Failed to toggle user ${id}:`, err)
          skipCount++
        }
      }
      
      if (successCount > 0) {
        toast.success(`${successCount} user(s) ${confirmText}d successfully`)
      }
      if (skipCount > 0) {
        toast.info(`${skipCount} user(s) skipped (already in desired state or cannot be modified)`)
      }
      clearSelection()
      fetchUsers()
    } catch (e) {
      console.error('Bulk toggle error', e)
     window.location.reload()
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const response = await usersAPI.getUsers()
      
      // Filter out superadmin users from regular admin view, show all to superadmin
      let filteredUsers = response.data
      if (user.role === 'admin') {
        filteredUsers = response.data.filter(u => u.role !== 'superadmin')
      }
      
      setUsers(filteredUsers)
    } catch (error) {
      console.error('Error fetching users:', error)
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validate form data
    if (!formData.name.trim()) {
      toast.error('Name is required')
      return
    }
    
    if (!formData.email.trim()) {
      toast.error('Email is required')
      return
    }

    // Only require password for new users
    if (!editingUser && !formData.password.trim()) {
      toast.error('Password is required')
      return
    }
    
    try {
      const userData = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        role: formData.role,
        phone: formData.phone.trim(),
        designation: formData.designation.trim(),
        bio: formData.bio.trim(),
        isActive: formData.isActive
      }

      if (editingUser) {
        // Update user
        if (formData.password.trim()) {
          userData.password = formData.password
        }
        await usersAPI.updateUser(editingUser.id, userData)
        toast.success('User updated successfully')
      } else {
        // Create new user
        userData.password = formData.password
        await usersAPI.createUser(userData)
        toast.success('User created successfully')
      }
      
      setShowModal(false)
      setEditingUser(null)
      setFormData({
        name: '',
        email: '',
        password: '',
        role: 'user',
        phone: '',
        designation: '',
        bio: '',
        isActive: true
      })
      fetchUsers()
    } catch (error) {
      console.error('User operation error:', error)
      toast.error(error.response?.data?.message || 'Operation failed')
    }
  }

  const handleDelete = async (userId) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        await usersAPI.deleteUser(userId)
        toast.success('User deleted successfully')
        fetchUsers()
      } catch (error) {
        toast.error('Failed to delete user')
      }
    }
  }

  const handleToggleUserStatus = async (userId, isActive) => {
    const action = isActive ? 'disable' : 'enable'
    if (window.confirm(`Are you sure you want to ${action} this user?`)) {
      try {
        await usersAPI.toggleUserStatus(userId)
        toast.success(`User ${action}d successfully`)
        fetchUsers()
      } catch (error) {
        toast.error(`Failed to ${action} user`)
      }
    }
  }

  const handleEdit = (userData) => {
    setEditingUser(userData)
    setFormData({
      name: userData.name || '',
      email: userData.email || '',
      password: '', // do not prefill new password with current password
      role: userData.role || 'user',
      phone: userData.phone || '',
      designation: userData.designation || '',
      bio: userData.bio || '',
      isActive: userData.isActive !== false // Default to true if not false
    })
    setCurrentPassword(userData.password || '') // Store current password for display
    setShowCurrentPassword(false)
    setShowModal(true)
  }

  const openCreateModal = () => {
    setEditingUser(null)
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'user',
      phone: '',
      designation: '',
      bio: '',
      isActive: true
    })
    setCurrentPassword('') // Clear current password for new user
    setShowModal(true)
  }

  const getRoleIcon = (role) => {
    switch (role) {
      case 'superadmin':
        return <Crown className="w-4 h-4 text-yellow-600" />
      case 'admin':
        return <Shield className="w-4 h-4 text-blue-600" />
      default:
        return <UserIcon className="w-4 h-4 text-gray-600" />
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

  const filteredUsers = users.filter(userData => 
    userData.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    userData.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    userData.designation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    userData.phone?.includes(searchTerm)
  )

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
              <button
                onClick={() => window.history.back()}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
                title="Go back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
                <p className="text-gray-600">
                  {user.role === 'superadmin' 
                    ? 'Manage admins and users in the system'
                    : 'Manage users in your organization'
                  }
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* View toggle */}
              <div className="flex items-center rounded-md border border-gray-300 overflow-hidden">
                <button
                  className={`px-3 py-2 text-sm ${viewMode==='grid' ? 'bg-gray-200 text-gray-900' : 'bg-white text-gray-600'}`}
                  onClick={() => setViewMode('grid')}
                  title="Grid view"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  className={`px-3 py-2 text-sm ${viewMode==='list' ? 'bg-gray-200 text-gray-900' : 'bg-white text-gray-600'}`}
                  onClick={() => setViewMode('list')}
                  title="List view"
                >
                  <ListIcon className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={() => navigate('/time-management')}
                className="btn-secondary inline-flex items-center"
                title="Time Management Settings"
              >
                <Clock className="w-4 h-4 mr-2" />
                Time Settings
              </button>
              <button
                onClick={openCreateModal}
                className="btn-primary inline-flex items-center"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Add New User
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search */}
        <div className="card p-6 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search users by name, email, designation, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Bulk selection bar */}
        {selectedUserIds.size > 0 && (
          <div className="card p-4 mb-4 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Selected {selectedUserIds.size} user(s)
            </div>
            <div className="flex items-center gap-2">
              <button onClick={selectAllFiltered} className="btn-secondary">Select all</button>
              <button onClick={clearSelection} className="btn-secondary">Clear</button>
              <button onClick={() => handleBulkSetActive(true)} className="btn-primary">Enable selected</button>
              <button onClick={() => handleBulkSetActive(false)} className="btn-secondary text-red-700">Disable selected</button>
            </div>
          </div>
        )}

        {/* Users - Grid or List */}
        {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUsers.map((userData) => (
            <div key={userData.id} className={`relative card p-6 transition-all ${!userData.isActive ? 'bg-gray-50 border-gray-300 opacity-75' : 'hover:shadow-lg'}`}>
              {/* Selection checkbox */}
              <label className="absolute top-3 left-3 inline-flex items-center gap-2 bg-white/80 px-2 py-1 rounded shadow">
                <input type="checkbox" checked={isSelected(userData.id)} onChange={() => toggleSelect(userData.id)} />
              </label>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className={`w-12 h-12 ${userData.isActive ? 'bg-primary-100' : 'bg-gray-100'} rounded-lg flex items-center justify-center overflow-hidden`}>
                    {userData.profileImage ? (
                      <img
                        src={`${API_ORIGIN}${userData.profileImage}`}
                        alt="Profile"
                        className={`w-12 h-12 rounded-lg object-cover ${!userData.isActive ? 'grayscale' : ''}`}
                      />
                    ) : (
                      <UserIcon className={`w-6 h-6 ${userData.isActive ? 'text-primary-600' : 'text-gray-400'}`} />
                    )}
                  </div>
                  <div>
                    <h3 className={`font-medium ${userData.isActive ? 'text-gray-900' : 'text-gray-600'}`}>{userData.name}</h3>
                    <div className="flex items-center space-x-1 mt-1">
                      {getRoleIcon(userData.role)}
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(userData.role)}`}>
                        {userData.role}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {/* Segmented Toggle Switch */}
                  {userData.id !== user?.id && (userData.role !== 'superadmin' || user?.role === 'superadmin') && (
                    <div 
                      className="relative inline-flex bg-gray-200 rounded-full p-1 cursor-pointer"
                      onClick={() => handleToggleUserStatus(userData.id, userData.isActive)}
                    >
                      {/* Background Slider */}
                      <div 
                        className={`absolute top-1 bg-white rounded-full shadow-sm transition-transform duration-300`}
                        style={{
                          width: '50%',
                          height: 'calc(100% - 8px)',
                          left: userData.isActive ? '4px' : 'calc(50% + 2px)',
                          transform: 'none'
                        }}
                      />
                      
                      {/* Active Option */}
                      <div 
                        className={`relative z-10 px-4 py-2 text-xs font-medium rounded-full flex items-center space-x-1 transition-colors duration-200 ${
                          userData.isActive ? 'text-primary-600' : 'text-gray-500'
                        }`}
                      >
                        <Check className="w-3 h-3" />
                        <span>Active</span>
                      </div>
                      
                      {/* Disabled Option */}
                      <div 
                        className={`relative z-10 px-4 py-2 text-xs font-medium rounded-full flex items-center space-x-1 transition-colors duration-200 ${
                          !userData.isActive ? 'text-primary-600' : 'text-gray-500'
                        }`}
                      >
                        <Power className="w-3 h-3" />
                        <span>Disabled</span>
                      </div>
                    </div>
                  )}
                  <button
                    onClick={() => handleEdit(userData)}
                    className="text-primary-600 hover:text-primary-900"
                    title="Edit user"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  {userData.role !== 'superadmin' && userData.id !== user?.id && (
                    <button
                      onClick={() => handleDelete(userData.id)}
                      className="text-red-600 hover:text-red-900"
                      title="Delete user"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center text-sm text-gray-600">
                  <Mail className="w-4 h-4 mr-2" />
                  <span className="truncate">{userData.email}</span>
                </div>
                
                <div className="flex items-center text-sm text-gray-600">
                  <Phone className="w-4 h-4 mr-2" />
                  <span>{userData.phone || 'Not provided'}</span>
                </div>
                
                <div className="flex items-center text-sm text-gray-600">
                  <Settings className="w-4 h-4 mr-2" />
                  <span>{userData.designation || 'Not provided'}</span>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600 line-clamp-2">
                  {userData.bio || 'No bio provided'}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1">
                    {userData.isActive ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600" />
                    )}
                    <span className={`text-sm font-medium px-2 py-1 rounded-full ${
                      userData.isActive 
                        ? 'text-green-700 bg-green-100' 
                        : 'text-red-700 bg-red-100'
                    }`}>
                      {userData.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                  {userData.lastSeen && (
                    <span className="text-xs text-gray-500">
                      Last seen: {new Date(userData.lastSeen).toLocaleDateString()}
                    </span>
                  )}
                </div>
                
                {/* Disable Info */}
                {!userData.isActive && userData.disabledAt && (
                  <div className="bg-red-50 border border-red-200 rounded p-2">
                    <div className="flex items-center text-xs text-red-700">
                      <Calendar className="w-3 h-3 mr-1" />
                      <span className="font-medium">Disabled:</span>
                      <span className="ml-1">{new Date(userData.disabledAt).toLocaleString()}</span>
                    </div>
                    {userData.disableReason && (
                      <div className="flex items-center text-xs text-red-600 mt-1">
                        <span className="font-medium">Reason:</span>
                        <span className="ml-1 capitalize">{userData.disableReason === 'auto' ? 'Auto-disabled' : 'Manually disabled'}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <input type="checkbox" onChange={(e)=> e.target.checked ? selectAllFiltered() : clearSelection()} checked={selectedUserIds.size>0 && selectedUserIds.size===filteredUsers.length} />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={isSelected(u.id)} onChange={()=>toggleSelect(u.id)} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded bg-gray-100 overflow-hidden flex items-center justify-center">
                          {u.profileImage ? (
                            <img src={`${API_ORIGIN}${u.profileImage}`} alt="Profile" className="w-10 h-10 object-cover" />
                          ) : (
                            <UserIcon className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                        <div>
                          <div className={`font-medium ${u.isActive ? 'text-gray-900' : 'text-gray-600'}`}>{u.name}</div>
                          <div className="text-xs text-gray-500">{u.designation || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(u.role)}`}>{u.role}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{u.email}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{u.phone || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${u.isActive ? 'text-green-700 bg-green-100' : 'text-red-700 bg-red-100'}`}>{u.isActive ? 'Active' : 'Disabled'}</span>
                        {!u.isActive && u.disabledAt && (
                          <div className="text-xs text-red-600" title={`Disabled at: ${new Date(u.disabledAt).toLocaleString()}`}>
                            {u.disableReason === 'auto' ? '⏰ Auto' : '👤 Manual'}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {u.id !== user?.id && (u.role !== 'superadmin' || user?.role === 'superadmin') && (
                          <button className="text-gray-600 hover:text-gray-900" title="Toggle status" onClick={()=>handleToggleUserStatus(u.id, u.isActive)}>
                            {u.isActive ? <ToggleRight className="w-5 h-5 text-green-600"/> : <ToggleLeft className="w-5 h-5 text-gray-400"/>}
                          </button>
                        )}
                        <button className="text-primary-600 hover:text-primary-900" title="Edit" onClick={()=>handleEdit(u)}>
                          <Edit className="w-4 h-4"/>
                        </button>
                        {u.role !== 'superadmin' && u.id !== user?.id && (
                          <button className="text-red-600 hover:text-red-900" title="Delete" onClick={()=>handleDelete(u.id)}>
                            <Trash2 className="w-4 h-4"/>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        )}

        {filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No users found</h3>
            <p className="text-gray-500">
              {searchTerm ? 'Try adjusting your search terms.' : 'No users have been created yet.'}
            </p>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editingUser ? 'Edit User' : 'Create New User'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input-field"
                    placeholder="Enter full name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="input-field"
                    placeholder="Enter email address"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {editingUser ? 'New Password' : 'Password'}
                    {editingUser && <span className="text-gray-500 text-xs ml-1">(leave blank to keep current)</span>}
                  </label>
                  <input
                    type="password"
                    required={!editingUser}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="input-field"
                    placeholder={editingUser ? 'Enter new password (optional)' : 'Enter password'}
                  />
                  {/* Always show current password when editing */}
                  {editingUser && (
                    <div className="mt-2 p-2 bg-gray-50 rounded border">
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-medium text-gray-600">Current Password</label>
                        <button type="button" className="text-xs text-primary-600 hover:text-primary-800 inline-flex items-center gap-1" onClick={()=>setShowCurrentPassword(v=>!v)}>
                          {showCurrentPassword ? <EyeOff className="w-3 h-3"/> : <Eye className="w-3 h-3"/>}
                          {showCurrentPassword ? 'Hide' : 'Show'}
                        </button>
                      </div>
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        readOnly
                        value={currentPassword || '[Password not available - please set new password]'}
                        className="w-full input-field font-mono"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="input-field"
                  >
                    <option value="user">User</option>
                    {user.role === 'superadmin' && (
                      <option value="admin">Admin</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="input-field"
                    placeholder="Enter phone number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Designation
                  </label>
                  <input
                    type="text"
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    className="input-field"
                    placeholder="Enter designation"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bio
                </label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  className="input-field"
                  rows="3"
                  placeholder="Enter bio (optional)"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
                  User is active
                </label>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                >
                  {editingUser ? 'Update User' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserManagement
