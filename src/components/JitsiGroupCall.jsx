import React, { useEffect, useState, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { X, Video, Users, Minimize2, Maximize2, Move } from 'lucide-react';

/**
 * Floating Jitsi Integration - Resizable & Draggable
 * Works like a floating video call window
 */
const JitsiGroupCall = ({ user, callData, onCallEnd }) => {
  const [participantCount, setParticipantCount] = useState(1);
  const [roomUrl, setRoomUrl] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  
  // Position and size state
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [size, setSize] = useState({ width: 800, height: 600 });
  
  const dragRef = useRef(null);
  const dragStart = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0 });

  useEffect(() => {
    // Generate Jitsi room URL
    const baseRoomName = callData?.roomName || `group-${callData?.groupId}-${Date.now()}`;
    const fullRoomName = `vpaas-magic-cookie-06fa758e7c18435681a16b81d4c43676/${baseRoomName}`;
    
    // Build URL with user info
    const userName = encodeURIComponent(user?.name || 'User');
    const userEmail = encodeURIComponent(user?.email || '');
    
    const url = `https://8x8.vc/${fullRoomName}?` +
      `displayName=${userName}&` +
      `email=${userEmail}&` +
      `config.startWithAudioMuted=false&` +
      `config.startWithVideoMuted=${callData?.callType === 'voice'}&` +
      `config.prejoinPageEnabled=true`;

    console.log('🎥 ========================================');
    console.log('🎥 JITSI VIDEO CALL');
    console.log('🎥 Room:', baseRoomName);
    console.log('🎥 Full Room:', fullRoomName);
    console.log('🎥 User:', user?.name);
    console.log('🎥 URL:', url);
    console.log('🎥 ========================================');

    setRoomUrl(url);

    // Show success message
    toast.success(`Joining ${callData?.group?.name || 'group call'}`, {
      icon: '🎥',
      duration: 2000
    });

    // Simulate participant tracking (Jitsi handles internally)
    const timer = setTimeout(() => {
      setParticipantCount(prev => prev + 1);
      console.log('👤 Participant count updated (simulated)');
    }, 30000);

    return () => clearTimeout(timer);
  }, [callData, user]);

  // Dragging handlers
  const handleMouseDown = (e) => {
    if (isFullscreen) return;
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  const handleMouseMove = (e) => {
    if (isDragging && !isFullscreen) {
      setPosition({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y
      });
    }
    if (isResizing && !isFullscreen) {
      const newWidth = Math.max(400, resizeStart.current.width + (e.clientX - resizeStart.current.x));
      const newHeight = Math.max(300, resizeStart.current.height + (e.clientY - resizeStart.current.y));
      setSize({ width: newWidth, height: newHeight });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
  };

  // Resize handler
  const handleResizeStart = (e) => {
    if (isFullscreen) return;
    e.stopPropagation();
    setIsResizing(true);
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height
    };
  };

  useEffect(() => {
    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, position, size]);

  const handleEndCall = () => {
    console.log('📞 Ending call');
    onCallEnd && onCallEnd();
  };

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  if (!roomUrl) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
        <div className="bg-gray-900 rounded-xl p-8 text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-white text-lg">Preparing call...</p>
        </div>
      </div>
    );
  }

  // Minimized view
  if (isMinimized) {
    return (
      <div 
        className="fixed bottom-4 right-4 z-50 bg-gradient-to-r from-gray-900 to-gray-800 rounded-xl shadow-2xl cursor-pointer hover:shadow-3xl transition-all"
        onClick={toggleMinimize}
      >
        <div className="px-6 py-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center animate-pulse">
            <Video size={24} className="text-white" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">
              {callData?.group?.name || 'Video Call'}
            </h3>
            <p className="text-xs text-gray-300 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              Call in progress
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Fullscreen or floating view
  const containerStyle = isFullscreen 
    ? { position: 'fixed', inset: 0, width: '100%', height: '100%' }
    : { 
        position: 'fixed', 
        left: position.x, 
        top: position.y, 
        width: size.width, 
        height: size.height 
      };

  return (
    <>
      {/* Background overlay */}
      <div className="fixed inset-0 bg-black bg-opacity-30 z-40" />
      
      {/* Floating/Fullscreen Call Window */}
      <div 
        ref={dragRef}
        className={`z-50 bg-gray-900 rounded-xl shadow-2xl overflow-hidden flex flex-col ${
          isDragging ? 'cursor-grabbing' : ''
        } ${isFullscreen ? '' : 'border-2 border-gray-700'}`}
        style={containerStyle}
      >
        {/* Header - Draggable */}
        <div 
          className={`bg-gradient-to-r from-gray-900 to-gray-800 px-4 py-3 flex items-center justify-between border-b border-gray-700 shadow-lg ${
            !isFullscreen ? 'cursor-grab active:cursor-grabbing' : ''
          }`}
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
              <Users size={20} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">
                {callData?.group?.name || 'Video Call'}
              </h3>
              <p className="text-xs text-gray-300 flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                Group {callData?.callType === 'voice' ? 'Voice' : 'Video'} Call
              </p>
            </div>
          </div>
          
          {/* Window Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMinimize}
              className="p-2 hover:bg-gray-700 rounded-lg transition-all text-gray-400 hover:text-white"
              title="Minimize"
            >
              <Minimize2 size={18} />
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-2 hover:bg-gray-700 rounded-lg transition-all text-gray-400 hover:text-white"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              <Maximize2 size={18} />
            </button>
            <button
              onClick={handleEndCall}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg transition-all text-white font-semibold shadow-lg hover:shadow-xl flex items-center gap-2"
              title="End Call"
            >
              <X size={16} />
              End
            </button>
          </div>
        </div>

        {/* Jitsi iframe */}
        <div className="flex-1 relative bg-black">
          <iframe
            src={roomUrl}
            allow="camera; microphone; fullscreen; display-capture; autoplay"
            className="w-full h-full border-0"
            title="Jitsi Meet"
            onLoad={() => {
              console.log('✅ Jitsi iframe loaded successfully');
              toast.success('Call connected', { icon: '✅', duration: 2000 });
            }}
            onError={() => {
              console.error('❌ Jitsi iframe load error');
              toast.error('Failed to load call');
            }}
          />
        </div>

        {/* Resize Handle (bottom-right corner) - Only in floating mode */}
        {!isFullscreen && (
          <div
            className="absolute bottom-0 right-0 w-8 h-8 cursor-nwse-resize hover:bg-blue-500 hover:bg-opacity-30 transition-all"
            onMouseDown={handleResizeStart}
            title="Drag to resize"
          >
            <div className="absolute bottom-1 right-1 flex flex-col gap-0.5">
              <div className="flex gap-0.5 justify-end">
                <div className="w-1 h-1 bg-gray-500 rounded-full"></div>
                <div className="w-1 h-1 bg-gray-500 rounded-full"></div>
              </div>
              <div className="flex gap-0.5 justify-end">
                <div className="w-1 h-1 bg-gray-500 rounded-full"></div>
              </div>
            </div>
          </div>
        )}

        {/* Draggable indicator */}
        {!isFullscreen && (
          <div className="absolute top-3 right-1/2 transform translate-x-1/2 flex gap-1 pointer-events-none">
            <Move size={16} className="text-gray-500" />
          </div>
        )}
      </div>
    </>
  );
};

export default JitsiGroupCall;
