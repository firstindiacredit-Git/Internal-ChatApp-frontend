import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { SocketProvider } from './contexts/SocketProvider'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import UserDashboard from './pages/UserDashboard'
import Chat from './pages/Chat'
import UserManagement from './pages/UserManagement'
import TimeManagement from './pages/TimeManagement'
import GroupManagement from './pages/GroupManagement'
import GroupProfile from './pages/GroupProfile'
import Profile from './pages/Profile'
import Forward from './pages/Forward'
import LoadingSpinner from './components/LoadingSpinner'


function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth()
  
  if (loading) {
    return <LoadingSpinner />
  }
  
  if (!user) {
    return <Navigate to="/login" replace />
  }
  
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }
  
  return children
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Toaster position="top-right" />
          <AppRoutes />
        </div>
      </Router>
    </AuthProvider>
  )
}


function AppRoutes() {
  const { user, loading } = useAuth()
  
  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <>
      {user ? (
        <SocketProvider user={user}>
          
          <Routes>
            <Route 
              path="/login" 
              element={<Navigate to="/dashboard" replace />} 
            />
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  {user && user.role === 'user' ? <UserDashboard /> : <Dashboard />}
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/user-dashboard" 
              element={
                <ProtectedRoute allowedRoles={['user']}>
                  <UserDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/chat" 
              element={
                <ProtectedRoute>
                  <Chat />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/users" 
              element={
                <ProtectedRoute allowedRoles={['superadmin', 'admin']}>
                  <UserManagement />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/time-management" 
              element={
                <ProtectedRoute allowedRoles={['superadmin', 'admin']}>
                  <TimeManagement />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/groups" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <GroupManagement />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/group/:groupId" 
              element={
                <ProtectedRoute>
                  <GroupProfile />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/profile" 
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/forward" 
              element={
                <ProtectedRoute>
                  <Forward />
                </ProtectedRoute>
              } 
            />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </SocketProvider>
      ) : (
        <Routes>
          <Route 
            path="/login" 
            element={<Login />} 
          />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      )}
    </>
  )
}

export default App
