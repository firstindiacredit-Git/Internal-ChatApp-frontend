import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { groupsAPI, usersAPI } from '../services/api'
import { toast } from 'react-hot-toast'
import { 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Users, 
  UserPlus,
  X,
  Settings
} from 'lucide-react'

const GroupManagement = () => {
  const { user } = useAuth()
  const [groups, setGroups] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingGroup, setEditingGroup] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    members: []
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [groupsRes, usersRes] = await Promise.all([
        groupsAPI.getGroups(),
        usersAPI.getActiveUsers()
      ])
      
      console.log('Groups response:', groupsRes.data)
      console.log('First group:', groupsRes.data[0])
      console.log('First group ID:', groupsRes.data[0]?.id)
      console.log('First group _ID:', groupsRes.data[0]?._id)
      
      // Transform groups to ensure they have 'id' field
      const transformedGroups = groupsRes.data.map(group => ({
        ...group,
        id: group.id || group._id
      }))
      
      console.log('Transformed groups:', transformedGroups)
      setGroups(transformedGroups)
      setUsers(usersRes.data.filter(u => u.id !== user.id))
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validate form data
    if (!formData.name.trim()) {
      toast.error('Group name is required')
      return
    }
    
    if (formData.members.length === 0) {
      toast.error('Please add at least one member to the group')
      return
    }
    
    try {
      console.log('Submitting group data:', formData)
      console.log('Editing group:', editingGroup)
      console.log('Editing group ID:', editingGroup?.id)
      
      if (editingGroup) {
        if (!editingGroup.id) {
          console.error('No group ID found for editing:', editingGroup)
          toast.error('Invalid group ID for editing')
          return
        }
        await groupsAPI.updateGroup(editingGroup.id, formData)
        toast.success('Group updated successfully')
      } else {
        const result = await groupsAPI.createGroup(formData)
        console.log('Group creation result:', result.data)
        toast.success('Group created successfully')
      }
      
      setShowModal(false)
      setEditingGroup(null)
      setFormData({ name: '', description: '', members: [] })
      fetchData()
    } catch (error) {
      console.error('Group operation error:', error)
      toast.error(error.response?.data?.message || 'Operation failed')
    }
  }

  const handleDelete = async (groupId) => {
    if (window.confirm('Are you sure you want to delete this group?')) {
      try {
        await groupsAPI.deleteGroup(groupId)
        toast.success('Group deleted successfully')
        fetchData()
      } catch (error) {
        toast.error('Failed to delete group')
      }
    }
  }

  const handleEdit = (group) => {
    console.log('Editing group:', group)
    console.log('Group ID:', group.id)
    console.log('Group _id:', group._id)
    
    // Ensure we have a valid group ID
    const groupId = group.id || group._id
    if (!groupId) {
      console.error('No valid group ID found:', group)
      toast.error('Invalid group selected')
      return
    }
    
    // Create a new group object with the correct ID
    const groupWithId = { ...group, id: groupId }
    console.log('Group with ID:', groupWithId)
    
    setEditingGroup(groupWithId)
    setFormData({
      name: group.name,
      description: group.description || '',
      members: group.members?.map(member => ({
        user: member.user.id || member.user,
        role: member.role
      })) || []
    })
    setShowModal(true)
  }

  const openCreateModal = () => {
    setEditingGroup(null)
    setFormData({ name: '', description: '', members: [] })
    setShowModal(true)
  }

  const addMember = (userId) => {
    console.log('Adding member:', userId)
    console.log('Current members:', formData.members)
    
    if (!formData.members.find(m => m.user === userId)) {
      const newMember = { user: userId, role: 'member' }
      const updatedMembers = [...formData.members, newMember]
      console.log('Updated members:', updatedMembers)
      
      setFormData({
        ...formData,
        members: updatedMembers
      })
    } else {
      console.log('Member already exists')
    }
  }

  const removeMember = (userId) => {
    setFormData({
      ...formData,
      members: formData.members.filter(m => m.user !== userId)
    })
  }

  const filteredGroups = groups.filter(group => 
    group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    group.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const availableUsers = users.filter(userData => 
    !formData.members.find(m => m.user === userData.id)
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
              <h1 className="text-2xl font-bold text-gray-900">Group Management</h1>
              <p className="text-gray-600">Create and manage groups for team communication</p>
            </div>
            <button
              onClick={openCreateModal}
              className="btn-primary inline-flex items-center"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Group
            </button>
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
              placeholder="Search groups..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Groups Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGroups.map((group) => (
            <div key={group.id} className="card p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <Users className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{group.name}</h3>
                    <p className="text-sm text-gray-500">
                      {group.members?.length || 0} members
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleEdit(group)}
                    className="text-primary-600 hover:text-primary-900"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(group.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {group.description && (
                <p className="text-sm text-gray-600 mb-4">{group.description}</p>
              )}

              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700">Members:</h4>
                <div className="flex flex-wrap gap-2">
                  {group.members?.slice(0, 3).map((member, index) => (
                    <div key={index} className="flex items-center space-x-1 bg-gray-100 rounded-full px-2 py-1">
                      <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center">
                        <span className="text-xs font-medium text-primary-600">
                          {member.user?.name?.charAt(0) || 'U'}
                        </span>
                      </div>
                      <span className="text-xs text-gray-700">
                        {member.user?.name || 'Unknown'}
                      </span>
                    </div>
                  ))}
                  {group.members?.length > 3 && (
                    <span className="text-xs text-gray-500">
                      +{group.members.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredGroups.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No groups found</h3>
            <p className="text-gray-500">
              {searchTerm ? 'Try adjusting your search terms.' : 'Get started by creating your first group.'}
            </p>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editingGroup ? 'Edit Group' : 'Create Group'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Group Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field"
                  placeholder="Enter group name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input-field"
                  rows="3"
                  placeholder="Enter group description (optional)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Members
                </label>
                
                {/* Selected Members */}
                {formData.members.length > 0 && (
                  <div className="mb-3">
                    <div className="flex flex-wrap gap-2">
                      {formData.members.map((member, index) => {
                        const userData = users.find(u => u.id === member.user)
                        return (
                          <div key={index} className="flex items-center space-x-1 bg-primary-100 rounded-full px-3 py-1">
                            <span className="text-sm text-primary-700">{userData?.name}</span>
                            <button
                              type="button"
                              onClick={() => removeMember(member.user)}
                              className="text-primary-600 hover:text-primary-800"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Add Members */}
                <div className="border border-gray-300 rounded-lg p-3">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Add Members:</h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {availableUsers.map((userData) => (
                      <div key={userData.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                            <span className="text-xs font-medium text-primary-600">
                              {userData.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{userData.name}</p>
                            <p className="text-xs text-gray-500">{userData.email}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => addMember(userData.id)}
                          className="text-primary-600 hover:text-primary-800"
                        >
                          <UserPlus className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
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
                  {editingGroup ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default GroupManagement
