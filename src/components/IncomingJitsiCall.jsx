import React from 'react';
import { Phone, PhoneOff, Video } from 'lucide-react';

/**
 * Incoming Jitsi Call Notification
 * Shows a modal when receiving an incoming video call
 */
const IncomingJitsiCall = ({ 
  callData, 
  onAccept, 
  onDecline 
}) => {
  const groupName = callData?.group?.name || callData?.groupName || 'Group Call';
  const initiatorName = callData?.initiator?.name || 'Someone';
  const callType = callData?.callType || 'video';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fadeIn">
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl shadow-2xl p-8 w-96 text-center text-white animate-slideUp">
        {/* Ringing Animation */}
        <div className="relative mb-6">
          <div className="w-24 h-24 rounded-full bg-white bg-opacity-20 flex items-center justify-center mx-auto animate-pulse">
            <Video size={48} className="text-white" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-32 h-32 rounded-full border-4 border-white border-opacity-30 animate-ping"></div>
          </div>
        </div>

        {/* Call Information */}
        <h2 className="text-2xl font-bold mb-2">{groupName}</h2>
        <p className="text-blue-100 mb-1">
          {initiatorName} is starting a {callType} call
        </p>
        <p className="text-sm text-blue-200 mb-8">
          {callType === 'video' ? 'Video call with screen sharing' : 'Voice call'}
        </p>

        {/* Call Type Badge */}
        <div className="inline-flex items-center gap-2 bg-white bg-opacity-20 px-4 py-2 rounded-full mb-8">
          <Video size={16} />
          <span className="text-sm font-medium">
            {callType === 'video' ? 'Video Call' : 'Voice Call'}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 justify-center">
          <button
            onClick={onDecline}
            className="w-16 h-16 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-110 active:scale-95"
            title="Decline"
          >
            <PhoneOff size={24} />
          </button>
          <button
            onClick={onAccept}
            className="w-16 h-16 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-110 active:scale-95 animate-bounce"
            title="Accept"
          >
            <Phone size={24} />
          </button>
        </div>

        {/* Incoming indicator */}
        <div className="mt-6 flex items-center justify-center gap-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span className="text-sm text-blue-100">Incoming call...</span>
        </div>
      </div>

      {/* Custom Animations */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideUp {
          from {
            transform: translateY(100px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }

        .animate-slideUp {
          animation: slideUp 0.4s ease-out;
        }
      `}} />
    </div>
  );
};

export default IncomingJitsiCall;

