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
  Power
} from 'lucide-react'

const UserManagement = () => {
  const { user } = useAuth()
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
      password: '', // Don't pre-fill password for security
      role: userData.role || 'user',
      phone: userData.phone || '',
      designation: userData.designation || '',
      bio: userData.bio || '',
      isActive: userData.isActive !== false // Default to true if not false
    })
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
            <div>
              <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
              <p className="text-gray-600">
                {user.role === 'superadmin' 
                  ? 'Manage admins and users in the system'
                  : 'Manage users in your organization'
                }
              </p>
            </div>
            {user.role === 'superadmin' && (
              <button
                onClick={openCreateModal}
                className="btn-primary inline-flex items-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Admin
              </button>
            )}
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

        {/* Users Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUsers.map((userData) => (
            <div key={userData.id} className={`card p-6 transition-all ${!userData.isActive ? 'bg-gray-50 border-gray-300 opacity-75' : 'hover:shadow-lg'}`}>
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
            </div>
          ))}
        </div>

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
              {editingUser ? 'Edit User' : 'Create Admin'}
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
                    Password {editingUser && '(leave blank to keep current)'}
                  </label>
                  <input
                    type="password"
                    required={!editingUser}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="input-field"
                    placeholder={editingUser ? 'Enter new password (optional)' : 'Enter password'}
                  />
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
                    <option value="admin">Admin</option>
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
