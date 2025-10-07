import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { usersAPI, API_ORIGIN } from '../services/api'
import { toast } from 'react-hot-toast'
import { 
  User as UserIcon,
  Mail,
  Phone,
  Briefcase,
  Camera,
  Save,
  Edit,
  ArrowLeft,
  Upload,
  X
} from 'lucide-react'
import { Link } from 'react-router-dom'

const Profile = () => {
  const { user, setUser } = useAuth()
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone: '',
    designation: '',
    profileImage: '',
    bio: ''
  })
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [imagePreview, setImagePreview] = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)

  useEffect(() => {
    if (user) {
      setProfile({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        designation: user.designation || '',
        profileImage: user.profileImage || '',
        bio: user.bio || ''
      })
      setImagePreview(user.profileImage || null)
    }
  }, [user])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setProfile(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setSelectedFile(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        setImagePreview(e.target.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const removeImage = () => {
    setSelectedFile(null)
    setImagePreview(null)
    setProfile(prev => ({
      ...prev,
      profileImage: ''
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const formData = new FormData()
      formData.append('name', profile.name)
      
      // Only append fields if they have values
      if (profile.phone && profile.phone.trim()) {
        formData.append('phone', profile.phone.trim())
      }
      if (profile.designation && profile.designation.trim()) {
        formData.append('designation', profile.designation.trim())
      }
      if (profile.bio && profile.bio.trim()) {
        formData.append('bio', profile.bio.trim())
      }
      
      if (selectedFile) {
        formData.append('profileImage', selectedFile)
      }

      const res = await usersAPI.updateProfile(formData)
      const updated = res.data?.user || {}
      // Update local UI state
      setProfile(prev => ({
        ...prev,
        name: updated.name ?? prev.name,
        phone: updated.phone ?? prev.phone,
        designation: updated.designation ?? prev.designation,
        bio: updated.bio ?? prev.bio,
        profileImage: updated.profileImage ?? prev.profileImage,
      }))
      if (updated.profileImage) setImagePreview(updated.profileImage)
      // Update auth context so header/avatar reflect immediately
      setUser(curr => curr ? ({ ...curr, ...updated }) : updated)
      toast.success('Profile updated successfully')
      setIsEditing(false)
      setSelectedFile(null) // Clear selected file after successful upload
      
      // Refresh page after a short delay to show the success message
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } catch (error) {
      console.error('Profile update error:', error)
      const errorMessage = error.response?.data?.message || error.response?.data?.error || 'Failed to update profile'
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    setProfile({
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      designation: user.designation || '',
      profileImage: user.profileImage || '',
      bio: user.bio || ''
    })
    setImagePreview(user.profileImage || null)
    setSelectedFile(null)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <div className="flex items-center space-x-4">
              <Link
                to="/dashboard"
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
                <p className="text-gray-600">Manage your profile information</p>
              </div>
            </div>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="btn-primary inline-flex items-center"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit Profile
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile Card */}
          <div className="lg:col-span-1">
            <div className="card p-6">
              <div className="text-center">
                <div className="relative inline-block">
                  {imagePreview ? (
                    <img
                      src={imagePreview.startsWith('http') || imagePreview.startsWith('data:') ? imagePreview : `${API_ORIGIN}${imagePreview}`}
                      alt="Profile"
                      className="w-32 h-32 rounded-full object-cover mx-auto"
                    />
                  ) : (
                    <div className="w-32 h-32 bg-primary-100 rounded-full flex items-center justify-center mx-auto">
                      <UserIcon className="w-16 h-16 text-primary-600" />
                    </div>
                  )}
                  
                  {isEditing && (
                    <div className="absolute bottom-0 right-0">
                      <label className="bg-primary-600 text-white p-2.5 rounded-full cursor-pointer hover:bg-primary-700 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center border-2 border-white">
                        <Camera className="w-4 h-4" />
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          className="hidden"
                        />
                      </label>
                    </div>
                  )}
                </div>

                <h2 className="text-xl font-bold text-gray-900 mt-4">{profile.name}</h2>
                <p className="text-gray-600">{profile.designation || 'No designation'}</p>
                <p className="text-sm text-gray-500 mt-2">{profile.email}</p>

                {isEditing && imagePreview && (
                  <button
                    onClick={removeImage}
                    className="mt-2 text-red-600 hover:text-red-700 text-sm inline-flex items-center"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Remove Image
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Profile Form */}
          <div className="lg:col-span-2">
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">
                {isEditing ? 'Edit Profile Information' : 'Profile Information'}
              </h3>

              {isEditing ? (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Full Name
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={profile.name}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={profile.phone}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="+1 (555) 123-4567"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Designation
                      </label>
                      <input
                        type="text"
                        name="designation"
                        value={profile.designation}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="Software Developer"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email
                      </label>
                      <input
                        type="email"
                        value={profile.email}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Bio
                    </label>
                    <textarea
                      name="bio"
                      value={profile.bio}
                      onChange={handleInputChange}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Tell us about yourself..."
                    />
                  </div>

                  <div className="flex justify-end space-x-4">
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="btn-primary inline-flex items-center"
                    >
                      {loading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Save Changes
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex items-center space-x-3">
                      <UserIcon className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Name</p>
                        <p className="text-sm text-gray-600">{profile.name || 'Not provided'}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <Phone className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Phone</p>
                        <p className="text-sm text-gray-600">{profile.phone || 'Not provided'}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <Briefcase className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Designation</p>
                        <p className="text-sm text-gray-600">{profile.designation || 'Not provided'}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <Mail className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Email</p>
                        <p className="text-sm text-gray-600">{profile.email}</p>
                      </div>
                    </div>
                  </div>

                  {profile.bio && (
                    <div>
                      <p className="text-sm font-medium text-gray-900 mb-2">Bio</p>
                      <p className="text-sm text-gray-600 bg-gray-50 p-4 rounded-lg">
                        {profile.bio}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Profile
