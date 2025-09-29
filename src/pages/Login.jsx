import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { authAPI } from '../services/api'
import { toast } from 'react-hot-toast'
import { User, Shield, Crown } from 'lucide-react'

const Login = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  })
  const [selectedRole, setSelectedRole] = useState('user')
  const [isRegistering, setIsRegistering] = useState(false)
  const [loading, setLoading] = useState(false)
  const [superAdminExists, setSuperAdminExists] = useState(false)
  const [checkingSuperAdmin, setCheckingSuperAdmin] = useState(true)
  
  const { login, registerSuperAdmin } = useAuth()

  // Check if super admin already exists
  useEffect(() => {
    const checkSuperAdmin = async () => {
      try {
        const response = await authAPI.checkSuperAdmin()
        setSuperAdminExists(response.data.exists)
      } catch (error) {
        console.error('Error checking super admin:', error)
      } finally {
        setCheckingSuperAdmin(false)
      }
    }
    
    checkSuperAdmin()
  }, [])

  const roles = [
    { value: 'user', label: 'User', icon: User, description: 'Chat with other users' },
    { value: 'admin', label: 'Admin', icon: Shield, description: 'Manage users and groups' },
    { value: 'superadmin', label: 'Super Admin', icon: Crown, description: 'Full system access' }
  ]

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (isRegistering && selectedRole === 'superadmin') {
        if (formData.password !== formData.confirmPassword) {
          toast.error('Passwords do not match')
          return
        }
        
        const result = await registerSuperAdmin(
          formData.name,
          formData.email,
          formData.password
        )
        
        if (result.success) {
          toast.success('Super Admin registered successfully!')
        } else {
          toast.error(result.error)
        }
      } else {
        const result = await login(formData.email, formData.password)
        
        if (result.success) {
          toast.success('Login successful!')
        } else {
          if (result.disabled) {
            toast.error('Your account has been disabled by administrator')
          } else {
            toast.error(result.error)
          }
        }
      }
    } catch (error) {
      toast.error('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const toggleMode = () => {
    if (!isRegistering && superAdminExists) {
      toast.error('Super admin already exists. Please login instead.')
      return
    }
    setIsRegistering(!isRegistering)
    setFormData({
      name: '',
      email: '',
      password: '',
      confirmPassword: ''
    })
  }

  if (checkingSuperAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h2 className="mt-6 text-3xl font-bold text-gray-900">
              Internal Chat App
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Checking system status...
            </p>
            <div className="flex justify-center mt-4">
              <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Internal Chat App
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {isRegistering ? 'Register as Super Admin' : 'Sign in to your account'}
          </p>
        </div>

        <div className="card p-8">
          {/* Role Selection */}
          {!isRegistering && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Select Role
              </label>
              <div className="grid grid-cols-1 gap-3">
                {roles.map((role) => {
                  const Icon = role.icon
                  return (
                    <button
                      key={role.value}
                      type="button"
                      onClick={() => setSelectedRole(role.value)}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        selectedRole === role.value
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <Icon className="w-5 h-5 text-gray-600" />
                        <div className="text-left">
                          <div className="font-medium text-gray-900">{role.label}</div>
                          <div className="text-sm text-gray-500">{role.description}</div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {isRegistering && (
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Full Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={handleInputChange}
                  className="input-field mt-1"
                  placeholder="Enter your full name"
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleInputChange}
                className="input-field mt-1"
                placeholder="Enter your email"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={formData.password}
                onChange={handleInputChange}
                className="input-field mt-1"
                placeholder="Enter your password"
              />
            </div>

            {isRegistering && (
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className="input-field mt-1"
                  placeholder="Confirm your password"
                />
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    {isRegistering ? 'Registering...' : 'Signing in...'}
                  </div>
                ) : (
                  isRegistering ? 'Register Super Admin' : 'Sign In'
                )}
              </button>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={toggleMode}
                disabled={checkingSuperAdmin}
                className="text-sm text-primary-600 hover:text-primary-500 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {checkingSuperAdmin 
                  ? 'Checking system status...'
                  : isRegistering 
                    ? 'Already have an account? Sign in' 
                    : superAdminExists
                      ? 'Super admin already exists. Please login instead.'
                      : 'Need to register Super Admin? Click here'
                }
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Login
