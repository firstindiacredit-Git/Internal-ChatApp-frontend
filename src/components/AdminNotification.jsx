import React from 'react';
import { useSocket } from '../contexts/SocketProvider';
import { Check, X, User } from 'lucide-react';

const AdminNotification = () => {
  const { notifications, handleActivateUser, handleCloseNotification, user } = useSocket();

  // Only show notifications to admin and superadmin users
  if (!user || !['admin', 'superadmin'].includes(user.role)) {
    return null;
  }

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-[9999] space-y-3 max-w-sm">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className="bg-white rounded-lg shadow-2xl border-l-4 border-l-orange-500 p-4 animate-fadeIn w-80"
        >
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-orange-600" />
              </div>
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-orange-700 flex items-center gap-2">
                <span>⚠️</span>
                Disabled User Login Attempt
              </div>
              <div className="mt-1 text-sm">
                <div className="font-semibold text-gray-900">{notification.userName}</div>
                <div className="text-gray-600">{notification.userEmail}</div>
                <div className="text-xs text-gray-500 mt-1">
                  Time: {new Date(notification.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
            
            <div className="flex-shrink-0">
              <button
                onClick={() => handleCloseNotification(notification.id)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="mt-3 flex space-x-2">
            <button
              onClick={() => handleActivateUser(notification.userId)}
              className="flex items-center space-x-1 bg-green-600 text-white px-3 py-1.5 rounded-md text-xs font-medium hover:bg-green-700 transition-colors"
            >
              <Check className="w-3 h-3" />
              <span>Activate</span>
            </button>
            
            <button
              onClick={() => handleCloseNotification(notification.id)}
              className="flex items-center space-x-1 bg-gray-100 text-gray-700 px-3 py-1.5 rounded-md text-xs font-medium hover:bg-gray-200 transition-colors"
            >
              <X className="w-3 h-3" />
              <span>Close</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AdminNotification;
