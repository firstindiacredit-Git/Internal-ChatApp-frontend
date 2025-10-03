import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../contexts/SocketProvider';

const ModernCallUI = ({ 
  user, 
  callData, 
  isIncoming = false, 
  onCallEnd, 
  onCallAnswer,
  onCallDecline 
}) => {
  const { socket, isConnected } = useSocket();
  const [callStatus, setCallStatus] = useState(isIncoming ? 'incoming' : 'outgoing');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(callData?.callType === 'video');
  const [callDuration, setCallDuration] = useState(0);
  const [error, setError] = useState(null);
  const [isMinimized, setIsMinimized] = useState(true);
  const [position, setPosition] = useState({ x: window.innerWidth - 320, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const callStartTimeRef = useRef(null);
  const durationIntervalRef = useRef(null);
  const answerProcessedRef = useRef(false);
  const processedCallIdRef = useRef(null);
  const callEndedRef = useRef(false);
  const offerCreatedRef = useRef(false);
  const iceCandidateQueueRef = useRef([]);
  const webrtcInitializedRef = useRef(false);
  const dragRef = useRef(null);

  const rtcConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  useEffect(() => {
    if (callData && callData.callId && isConnected) {
      initializeWebRTC();
    }
    return () => {
      cleanup();
    };
  }, [callData, isConnected]);

  useEffect(() => {
    if (callStatus === 'connected' && callStartTimeRef.current) {
      durationIntervalRef.current = setInterval(() => {
        const duration = Math.floor((Date.now() - callStartTimeRef.current) / 1000);
        setCallDuration(duration);
      }, 1000);
    } else if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, [callStatus]);

  const initializeWebRTC = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('WebRTC not supported in this browser or requires HTTPS');
        setError('Video calls require HTTPS connection or are not supported in this browser. Please use HTTPS or try a different browser.');
        return;
      }

      if (typeof RTCPeerConnection === 'undefined') {
        console.error('RTCPeerConnection not supported');
        setError('WebRTC is not supported in this browser. Please use a modern browser like Chrome, Firefox, or Safari.');
        return;
      }

      answerProcessedRef.current = false;
      processedCallIdRef.current = null;
      callEndedRef.current = false;
      offerCreatedRef.current = false;
      iceCandidateQueueRef.current = [];
      webrtcInitializedRef.current = false;
      
      const constraints = {
        audio: true,
        video: isVideoEnabled ? { width: 640, height: 480 } : false,
      };
      
      try {
        localStreamRef.current = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (mediaError) {
        if (mediaError.name === 'NotAllowedError' || mediaError.name === 'PermissionDeniedError') {
          setError('Camera/microphone access denied. Please allow access and try again.');
        } else if (mediaError.name === 'NotFoundError' || mediaError.name === 'DevicesNotFoundError') {
          setError('Camera/microphone not found. Please check your devices.');
        } else if (mediaError.name === 'NotReadableError' || mediaError.name === 'TrackStartError') {
          setError('Camera/microphone is being used by another application.');
        } else if (mediaError.name === 'SecurityError') {
          setError('Video calls require HTTPS connection. Please access the site via HTTPS.');
        } else {
          setError(`Media access failed: ${mediaError.message}`);
        }
        return;
      }
      
      const localAudioTracks = localStreamRef.current.getAudioTracks();
      localAudioTracks.forEach(track => { track.enabled = true; });
      const localVideoTracks = localStreamRef.current.getVideoTracks();
      localVideoTracks.forEach(track => { track.enabled = true; });
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
        localVideoRef.current.play().catch(() => {});
      }

      try {
        peerConnectionRef.current = new RTCPeerConnection(rtcConfiguration);
      } catch (pcError) {
        setError(`Failed to create peer connection: ${pcError.message}`);
        return;
      }

      try {
        localStreamRef.current.getTracks().forEach(track => {
          peerConnectionRef.current.addTrack(track, localStreamRef.current);
        });
      } catch (trackError) {
        setError(`Failed to add tracks to peer connection: ${trackError.message}`);
        return;
      }

      peerConnectionRef.current.ontrack = (event) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
          remoteVideoRef.current.play().catch(() => {});
          const remoteStream = event.streams[0];
          remoteStream.getAudioTracks().forEach(track => { track.enabled = true; });
          remoteStream.getVideoTracks().forEach(track => { track.enabled = true; });
          if (remoteVideoRef.current.volume !== undefined) {
            remoteVideoRef.current.volume = 1.0;
          }
        }
      };

      peerConnectionRef.current.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('ice-candidate', {
            callId: callData.callId,
            candidate: event.candidate.candidate,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
            sdpMid: event.candidate.sdpMid,
          });
        }
      };

      peerConnectionRef.current.onconnectionstatechange = () => {
        const state = peerConnectionRef.current.connectionState;
        if (state === 'connected') {
          setCallStatus('connected');
          callStartTimeRef.current = Date.now();
        } else if (state === 'disconnected' || state === 'failed') {
          handleCallEnd();
        }
      };

      setupSocketListeners();
      webrtcInitializedRef.current = true;

      if (!isIncoming) {
        await createAndSendOffer();
      }
    } catch (error) {
      webrtcInitializedRef.current = false;
      setError('Failed to access camera/microphone. Please check permissions.');
    }
  };

  const setupSocketListeners = () => {
    if (!socket) return;

    socket.off('call-answered');
    socket.off('call-declined');
    socket.off('call-ended');
    socket.off('call-error');
    socket.off('call-offer');
    socket.off('ice-candidate');

    socket.on('call-answered', async (data) => {
      if (data.callId === callData.callId) {
        if (processedCallIdRef.current === data.callId) return;
        try {
          if (data.answer && peerConnectionRef.current) {
            const parsedAnswer = typeof data.answer === 'string' ? JSON.parse(data.answer) : data.answer;
            const currentState = peerConnectionRef.current.signalingState;
            if (currentState === 'have-local-offer' && !answerProcessedRef.current) {
              await peerConnectionRef.current.setRemoteDescription(parsedAnswer);
              answerProcessedRef.current = true;
              processedCallIdRef.current = data.callId;
              await processQueuedIceCandidates();
            }
          }
          setCallStatus('connected');
          callStartTimeRef.current = Date.now();
        } catch (error) {
          setError('Failed to handle call answer');
        }
      }
    });

    socket.on('call-declined', (data) => {
      if (data.callId === callData.callId) {
        setCallStatus('declined');
        setTimeout(() => {
          onCallEnd && onCallEnd();
        }, 2000);
      }
    });

    socket.on('call-ended', (data) => {
      if (data.callId === callData.callId) {
        handleCallEnd();
      }
    });

    socket.on('ice-candidate', async (data) => {
      if (data.callId === callData.callId && peerConnectionRef.current) {
        try {
          const currentState = peerConnectionRef.current.signalingState;
          if (currentState === 'stable' || currentState === 'have-local-offer' || currentState === 'have-remote-offer') {
            await peerConnectionRef.current.addIceCandidate({
              candidate: data.candidate,
              sdpMLineIndex: data.sdpMLineIndex,
              sdpMid: data.sdpMid,
            });
          } else {
            iceCandidateQueueRef.current.push({
              candidate: data.candidate,
              sdpMLineIndex: data.sdpMLineIndex,
              sdpMid: data.sdpMid,
            });
          }
        } catch (error) {}
      }
    });

    socket.on('call-error', (data) => {
      setError(data.error);
    });

    socket.on('call-offer', async (data) => {
      if (data.callId === callData.callId && isIncoming) {
        try {
          const offer = typeof data.offer === 'string' ? JSON.parse(data.offer) : data.offer;
          if (peerConnectionRef.current) {
            const currentState = peerConnectionRef.current.signalingState;
            if (currentState === 'stable') {
              await peerConnectionRef.current.setRemoteDescription(offer);
              await processQueuedIceCandidates();
            }
          }
        } catch (error) {
          setError('Failed to handle call offer');
        }
      }
    });
  };

  const processQueuedIceCandidates = async () => {
    if (iceCandidateQueueRef.current.length > 0) {
      for (const candidate of iceCandidateQueueRef.current) {
        try {
          await peerConnectionRef.current.addIceCandidate(candidate);
        } catch (error) {}
      }
      iceCandidateQueueRef.current = [];
    }
  };

  const createAndSendOffer = async () => {
    try {
      if (!webrtcInitializedRef.current) {
        setError('WebRTC not initialized yet');
        return;
      }
      if (!peerConnectionRef.current) {
        setError('Peer connection not available');
        return;
      }
      if (!socket || !socket.connected) {
        setError('Socket connection not available');
        return;
      }
      if (!callData || !callData.callId) {
        setError('Call data not available');
        return;
      }
      if (offerCreatedRef.current) return;
      const currentState = peerConnectionRef.current.signalingState;
      if (currentState !== 'stable') {
        setError(`Cannot create offer in state: ${currentState}`);
        return;
      }
      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);
      offerCreatedRef.current = true;
      socket.emit('call-offer', {
        callId: callData.callId,
        offer: offer,
      });
      setCallStatus('ringing');
    } catch (error) {
      setError(`Failed to create call offer: ${error.message}`);
    }
  };

  const handleCallAnswer = async () => {
    try {
      if (peerConnectionRef.current) {
        const currentState = peerConnectionRef.current.signalingState;
        if (currentState === 'have-remote-offer') {
          const answer = await peerConnectionRef.current.createAnswer();
          await peerConnectionRef.current.setLocalDescription(answer);
          socket.emit('call-answer', {
            callId: callData.callId,
            answer: answer,
          });
          setCallStatus('connected');
          callStartTimeRef.current = Date.now();
          onCallAnswer && onCallAnswer();
        } else {
          setError('Cannot answer call in current state');
        }
      } else {
        setError('Call connection not ready');
      }
    } catch (error) {
      setError('Failed to answer call');
    }
  };

  const handleCallDecline = () => {
    if (socket) {
      socket.emit('call-decline', {
        callId: callData.callId,
      });
    }
    setCallStatus('declined');
    onCallDecline && onCallDecline();
    setTimeout(() => {
      onCallEnd && onCallEnd();
    }, 1000);
  };

  const handleCallEnd = () => {
    if (callEndedRef.current) return;
    callEndedRef.current = true;
    if (socket) {
      socket.emit('call-end', { callId: callData.callId });
    }
    setCallStatus('ended');
    onCallEnd && onCallEnd();
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => { track.enabled = isMuted; });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      const newVideoState = !isVideoEnabled;
      videoTracks.forEach(track => { track.enabled = newVideoState; });
      setIsVideoEnabled(newVideoState);
    }
  };

  const cleanup = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
  };

  const formatDuration = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Drag and drop functionality
  const handleMouseDown = (e) => {
    if (e.target.closest('.call-controls')) return; // Don't drag when clicking controls
    setIsDragging(true);
    const rect = dragRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;
    
    // Keep within viewport bounds
    const maxX = window.innerWidth - 300; // 300px is approximate width
    const maxY = window.innerHeight - 200; // 200px is approximate height
    
    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY))
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  if (error) {
    return (
      <div
        className="fixed bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-2xl border border-gray-700 p-6 z-50 transition-all duration-300"
        style={{
          left: position.x,
          top: position.y,
          width: '300px',
          height: '200px'
        }}
      >
        <div className="text-center">
          <div className="text-4xl mb-3">❌</div>
          <h3 className="text-lg font-semibold text-white mb-2">Call Error</h3>
          <p className="text-sm text-gray-300 mb-4">{error}</p>
          <button 
            onClick={onCallEnd}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors text-sm"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  if (isMinimized) {
    return (
      <div
        ref={dragRef}
        className="fixed bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-2xl border border-gray-700 z-50 transition-all duration-300 hover:shadow-3xl"
        style={{
          left: position.x,
          top: position.y,
          width: '280px',
          height: '70px'
        }}
      >
        {/* Header for Minimized View */}
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200">
              {(callData?.otherUser?.avatar || callData?.receiver?.avatar || callData?.caller?.avatar) ? (
                <img 
                  src={callData.otherUser?.avatar || callData.receiver?.avatar || callData.caller?.avatar} 
                  alt={callData?.otherUser?.name || callData?.receiver?.name || callData?.caller?.name} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-green-500 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">
                    {(callData?.otherUser?.name || callData?.receiver?.name || callData?.caller?.name)?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                </div>
              )}
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">
                {callData?.otherUser?.name || callData?.receiver?.name || callData?.caller?.name || 'Unknown'}
              </h3>
              <p className="text-xs text-gray-300">
                {callStatus === 'connected' ? formatDuration(callDuration) : 'Calling...'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {/* Drag Handle Button for Minimized View */}
            <button
              onMouseDown={handleMouseDown}
              className="p-1.5 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors cursor-move"
              title="Drag to move call window"
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16M8 4v16M16 4v16" />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsMinimized(false);
              }}
              className="p-1.5 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors"
              title="Expand"
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCallEnd();
              }}
              className="p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors"
              title="End Call"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={dragRef}
      className="fixed bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-2xl border border-gray-700 overflow-hidden z-50 transition-all duration-300"
      style={{
        left: position.x,
        top: position.y,
        width: '300px',
        height: '400px'
      }}
    >
      {/* Header */}
      <div className="bg-black bg-opacity-20 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200">
            {(callData?.otherUser?.avatar || callData?.receiver?.avatar || callData?.caller?.avatar) ? (
              <img 
                src={callData.otherUser?.avatar || callData.receiver?.avatar || callData.caller?.avatar} 
                alt={callData?.otherUser?.name || callData?.receiver?.name || callData?.caller?.name} 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-green-500 flex items-center justify-center">
                <span className="text-white font-bold">
                  {(callData?.otherUser?.name || callData?.receiver?.name || callData?.caller?.name)?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
            )}
          </div>
          <div>
            <h3 className="font-semibold text-white text-sm">
              {callData?.otherUser?.name || callData?.receiver?.name || callData?.caller?.name || 'Unknown'}
            </h3>
            <p className="text-xs text-gray-300">
              {callStatus === 'incoming' && 'Incoming call...'}
              {callStatus === 'outgoing' && 'Calling...'}
              {callStatus === 'ringing' && 'Ringing...'}
              {callStatus === 'connected' && `Connected - ${formatDuration(callDuration)}`}
              {callStatus === 'declined' && 'Call declined'}
              {callStatus === 'ended' && 'Call ended'}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {/* Drag Handle Button */}
          <button
            onMouseDown={handleMouseDown}
            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors cursor-move"
            title="Drag to move call window"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16M8 4v16M16 4v16" />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsMinimized(true);
            }}
            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors"
            title="Minimize"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCallEnd();
            }}
            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors"
            title="Close"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Video Container */}
      <div className="relative h-48 bg-black">
        {isVideoEnabled ? (
          <>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-3 right-3 w-16 h-12 bg-gray-800 rounded-lg overflow-hidden border-2 border-white">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-24 h-24 rounded-full bg-gray-700 flex items-center justify-center mb-4">
                <span className="text-4xl text-white">
                  {(callData?.otherUser?.name || callData?.receiver?.name || callData?.caller?.name)?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
              <p className="text-white text-sm">Audio Only Call</p>
            </div>
          </div>
        )}
      </div>

      {/* Call Controls */}
      <div className="bg-black bg-opacity-20 p-4">
        <div className="call-controls flex justify-center space-x-3" onMouseDown={(e) => e.stopPropagation()}>
          {callStatus === 'incoming' && (
            <>
              <button 
                className="w-12 h-12 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl"
                onClick={handleCallDecline}
                title="Decline"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <button 
                className="w-12 h-12 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl"
                onClick={handleCallAnswer}
                title="Answer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </button>
            </>
          )}

          {callStatus === 'connected' && (
            <>
                <button 
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl ${
                    isMuted 
                      ? 'bg-red-500 hover:bg-red-600 text-white' 
                      : 'bg-white bg-opacity-20 hover:bg-opacity-30 text-white'
                  }`}
                  onClick={toggleMute}
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  )}
                </button>
              
              {callData?.callType === 'video' && (
                <button 
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl ${
                    !isVideoEnabled 
                      ? 'bg-red-500 hover:bg-red-600 text-white' 
                      : 'bg-white bg-opacity-20 hover:bg-opacity-30 text-white'
                  }`}
                  onClick={toggleVideo}
                  title={isVideoEnabled ? 'Disable Video' : 'Enable Video'}
                >
                  {isVideoEnabled ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                    </svg>
                  )}
                </button>
              )}
              
              <button 
                className="w-12 h-12 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl"
                onClick={handleCallEnd}
                title="End Call"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </>
          )}

          {(callStatus === 'outgoing' || callStatus === 'ringing') && (
            <button 
              className="w-12 h-12 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl"
              onClick={handleCallEnd}
              title="Cancel Call"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModernCallUI;
