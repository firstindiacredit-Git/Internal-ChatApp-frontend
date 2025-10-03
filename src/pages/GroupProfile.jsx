import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { groupsAPI, API_ORIGIN } from '../services/api'
import { toast } from 'react-hot-toast'
import { 
  ArrowLeft,
  Users,
  User as UserIcon,
  Calendar,
  Clock,
  Shield
} from 'lucide-react'

const GroupProfile = () => {
  const { groupId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [group, setGroup] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showMembers, setShowMembers] = useState(false)

  useEffect(() => {
    fetchGroupDetails()
  }, [groupId])

  const fetchGroupDetails = async () => {
    try {
      setLoading(true)
      const response = await groupsAPI.getGroups()
      const groupData = response.data.find(g => g.id === groupId)
      
      if (!groupData) {
        toast.error('Group not found')
        navigate('/chat')
        return
      }
      
      setGroup(groupData)
    } catch (error) {
      console.error('Error fetching group details:', error)
      toast.error('Failed to load group details')
      navigate('/chat')
    } finally {
      setLoading(false)
    }
  }

  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin':
        return <Shield className="w-4 h-4 text-blue-600" />
      default:
        return <UserIcon className="w-4 h-4 text-gray-600" />
    }
  }

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Group not found</h2>
          <p className="text-gray-600 mb-4">The group you're looking for doesn't exist.</p>
          <button
            onClick={() => navigate('/chat')}
            className="btn-primary"
          >
            Back to Chat
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center py-4">
            <button
              onClick={() => navigate('/chat')}
              className="mr-4 p-2 text-gray-600 hover:text-gray-900 transition-colors"
              title="Back to chat"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-semibold text-gray-900">Group Info</h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Group Avatar and Basic Info */}
        <div className="card p-8 text-center mb-6">
          <div className="flex justify-center mb-6">
            <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-100 border-4 border-white shadow-lg">
              {group.avatar ? (
                <img
                  src={`${API_ORIGIN}${group.avatar}`}
                  alt="Group avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-green-500 flex items-center justify-center">
                  <Users className="w-16 h-16 text-white" />
                </div>
              )}
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{group.name}</h2>
          
          {group.description && (
            <p className="text-gray-600 mb-4 max-w-md mx-auto">{group.description}</p>
          )}
          
          <div className="flex items-center justify-center space-x-6 text-sm text-gray-500">
            <div className="flex items-center space-x-1">
              <Users className="w-4 h-4" />
              <span>{group.members?.length || 0} members</span>
            </div>
            <div className="flex items-center space-x-1">
              <Calendar className="w-4 h-4" />
              <span>Created {formatDate(group.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Group Members */}
        <div className="card p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Members</h3>
            <button
              onClick={() => setShowMembers(!showMembers)}
              className="text-primary-600 hover:text-primary-800 transition-colors"
            >
              {showMembers ? 'Hide' : 'Show'} ({group.members?.length || 0})
            </button>
          </div>
          
          {showMembers && (
            <div className="space-y-3">
              {group.members?.map((member, index) => (
                <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200">
                    {member.user.profileImage ? (
                      <img
                        src={`${API_ORIGIN}${member.user.profileImage}`}
                        alt={member.user.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-primary-500 flex items-center justify-center">
                        <span className="text-white font-semibold text-sm">
                          {member.user.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-medium text-gray-900">{member.user.name}</h4>
                      <div className="flex items-center space-x-1">
                        {getRoleIcon(member.role)}
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(member.role)}`}>
                          {member.role}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-500">{member.user.email}</p>
                  </div>
                  
                  <div className="text-xs text-gray-400">
                    <div className="flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>Joined {formatDate(member.joinedAt)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>


        {/* Group Statistics */}
        <div className="card p-6 mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Group Statistics</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary-600">{group.members?.length || 0}</div>
              <div className="text-sm text-gray-500">Total Members</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {group.members?.filter(m => m.role === 'admin').length || 0}
              </div>
              <div className="text-sm text-gray-500">Admins</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {Math.ceil((group.members?.length || 0) / 2)}
              </div>
              <div className="text-sm text-gray-500">Active Conversations</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GroupProfile
