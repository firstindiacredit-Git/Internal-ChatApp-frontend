import { createContext, useContext, useState, useEffect } from 'react'
import { authAPI } from '../services/api'
import { initializePushNotifications } from '../services/pushNotifications'
import { initializeFCM } from '../services/fcmNotifications'

const AuthContext = createContext()

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      authAPI.getCurrentUser()
        .then(response => {
          setUser(response.data.user)
          
          // Initialize push notifications - try FCM first, fallback to Web Push
          if (response.data.user?._id) {
            initializeFCM(response.data.user._id)
              .then(result => {
                if (result.success) {
                  console.log('✅ FCM initialized')
                } else {
                  console.log('ℹ️ FCM failed, trying Web Push...')
                  return initializePushNotifications(response.data.user._id)
                }
              })
              .then(result => {
                if (result && result.success) {
                  console.log('✅ Web Push initialized')
                }
              })
              .catch(error => {
                console.log('ℹ️ Notifications failed:', error)
              })
          }
        })
        .catch(error => {
          console.error('Auth check failed:', error)
          localStorage.removeItem('token')
        })
        .finally(() => {
          setLoading(false)
        })
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (email, password) => {
    try {
      const response = await authAPI.login(email, password)
      const { token, user: userData } = response.data
      
      localStorage.setItem('token', token)
      setUser(userData)
      
      // Initialize push notifications - try FCM first, fallback to Web Push
      if (userData?._id) {
        initializeFCM(userData._id)
          .then(result => {
            if (result.success) {
              console.log('✅ FCM enabled')
            } else {
              console.log('ℹ️ FCM failed, trying Web Push...')
              return initializePushNotifications(userData._id)
            }
          })
          .then(result => {
            if (result && result.success) {
              console.log('✅ Web Push enabled')
            }
          })
          .catch(error => {
            console.log('ℹ️ Notifications failed:', error)
          })
      }
      
      return { success: true, data: response.data }
    } catch (error) {
      // Check if user is disabled
      if (error.response?.data?.disabled) {
        return {
          success: false,
          error: "Your account has been disabled by administrator",
          disabled: true
        }
      }
      
      return { 
        success: false, 
        error: error.response?.data?.message || 'Login failed' 
      }
    }
  }

  const registerSuperAdmin = async (name, email, password) => {
    try {
      const response = await authAPI.registerSuperAdmin(name, email, password)
      const { token, user: userData } = response.data
      
      localStorage.setItem('token', token)
      setUser(userData)
      
      return { success: true, data: response.data }
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.message || 'Registration failed' 
      }
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    setUser(null)
  }

  const value = {
    user,
    setUser,
    login,
    registerSuperAdmin,
    logout,
    loading
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
