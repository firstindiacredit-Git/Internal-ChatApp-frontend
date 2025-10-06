import React, { useEffect, useRef, useState } from 'react';
import { useSocket } from '../contexts/SocketProvider';

const WebRTCAudioCall = ({ 
  user, 
  callData, 
  isIncoming = false, 
  onCallEnd, 
  onCallAnswer,
  onCallDecline 
}) => {
  const { socket } = useSocket();
  const [callStatus, setCallStatus] = useState(isIncoming ? 'incoming' : 'outgoing');
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [error, setError] = useState(null);
  const [position, setPosition] = useState({ x: window.innerWidth - 350, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  const localAudioRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const callTimerRef = useRef(null);

  const rtcConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  const initializeWebRTC = async () => {
    try {
      // Check if WebRTC is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('WebRTC not supported in this browser or requires HTTPS');
        setError('Audio calls require HTTPS connection or are not supported in this browser. Please use HTTPS or try a different browser.');
        return false;
      }

      // Check if RTCPeerConnection is supported
      if (typeof RTCPeerConnection === 'undefined') {
        console.error('RTCPeerConnection not supported');
        setError('WebRTC is not supported in this browser. Please use a modern browser like Chrome, Firefox, or Safari.');
        return false;
      }

      peerConnectionRef.current = new RTCPeerConnection(rtcConfiguration);

      peerConnectionRef.current.onicecandidate = (event) => {
        if (event.candidate && socket) {
          try {
            socket.emit('ice-candidate', {
              callId: callData.callId,
              candidate: event.candidate.candidate,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
              sdpMid: event.candidate.sdpMid,
            });
          } catch (error) {
            console.error('Error sending ICE candidate:', error);
          }
        }
      };

      peerConnectionRef.current.ontrack = (event) => {
        console.log('🎵 Remote audio track received:', event);
        console.log('🎵 Track details:', {
          kind: event.track.kind,
          label: event.track.label,
          enabled: event.track.enabled,
          readyState: event.track.readyState,
          streamsCount: event.streams.length
        });
        
        if (event.streams && event.streams[0]) {
          const remoteStream = event.streams[0];
          console.log('🎵 Setting remote audio stream:', remoteStream);
          console.log('🎵 Stream tracks:', remoteStream.getTracks());
          
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = remoteStream;
            
            // Only enable audio tracks if call is connected (accepted)
            remoteStream.getAudioTracks().forEach(track => { 
              track.enabled = callStatus === 'connected'; 
              console.log('🎵 Remote audio track enabled:', track.enabled, 'callStatus:', callStatus);
            });
            
            // Set volume to maximum
            if (remoteAudioRef.current.volume !== undefined) {
              remoteAudioRef.current.volume = 1.0;
            }
            
            // Only play audio if call is connected (accepted)
            if (callStatus === 'connected') {
              remoteAudioRef.current.muted = false;
              remoteAudioRef.current.play().catch((error) => {
                if (error.name !== 'AbortError') {
                  console.error('🎵 Error playing remote audio:', error);
                }
              });
              console.log('🎵 Remote audio playing after call connected');
            } else {
              // Mute until call is accepted
              remoteAudioRef.current.muted = true;
              console.log('🎵 Remote audio muted until call is accepted');
            }
          }
        }
      };

      peerConnectionRef.current.onconnectionstatechange = () => {
        const state = peerConnectionRef.current.connectionState;
        if (state === 'connected') {
          setCallStatus('connected');
          startCallTimer();
        } else if (state === 'disconnected' || state === 'failed') {
          handleCallEnd();
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      });
      
      localStreamRef.current = stream;
      if (localAudioRef.current) {
        localAudioRef.current.srcObject = stream;
      }

      stream.getAudioTracks().forEach(track => {
        peerConnectionRef.current.addTrack(track, stream);
      });

      return true;
    } catch (error) {
      console.error('Error initializing WebRTC:', error);
      
      // Provide specific error messages
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setError('Microphone access denied. Please allow microphone permissions in your browser settings.');
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        setError('No microphone found. Please connect a microphone and try again.');
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        setError('Microphone is being used by another application. Please close other apps and try again.');
      } else if (error.name === 'OverconstrainedError') {
        setError('Could not access microphone with the required settings.');
      } else if (error.name === 'SecurityError') {
        setError('Audio calls require HTTPS connection. Please access the site via HTTPS.');
      } else {
        setError(`Failed to access microphone: ${error.message || 'Unknown error'}`);
      }
      
      return false;
    }
  };

  const startCallTimer = () => {
    callTimerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  const stopCallTimer = () => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Drag and drop functionality
  const handleMouseDown = (e) => {
    setIsDragging(true);
    const rect = e.currentTarget.getBoundingClientRect();
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
    const maxX = window.innerWidth - 320;
    const maxY = window.innerHeight - 200;
    
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

  const handleAnswer = async () => {
    const initialized = await initializeWebRTC();
    if (!initialized) return;

    setCallStatus('connecting');
    onCallAnswer && onCallAnswer();

    if (socket) {
      socket.emit('call-answer', {
        callId: callData.callId,
      });
    }
  };

  const handleDecline = () => {
    setCallStatus('declined');
    onCallDecline && onCallDecline();

    if (socket) {
      socket.emit('call-decline', {
        callId: callData.callId,
      });
    }
  };

  const handleCallEnd = () => {
    stopCallTimer();
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    setCallStatus('ended');
    onCallEnd && onCallEnd();

    if (socket) {
      socket.emit('call-end', {
        callId: callData.callId,
      });
    }
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  useEffect(() => {
    if (!socket) return;

    const handleCallAnswered = async (data) => {
      if (data.callId === callData.callId) {
        setCallStatus('connecting');
        try {
          const offer = await peerConnectionRef.current.createOffer();
          await peerConnectionRef.current.setLocalDescription(offer);
          socket.emit('call-offer', {
            callId: callData.callId,
            offer: offer,
          });
        } catch (error) {
          setError('Failed to establish connection');
        }
      }
    };

    const handleCallOffer = async (data) => {
      if (data.callId === callData.callId) {
        try {
          const currentState = peerConnectionRef.current.signalingState;
          console.log('📞 Processing offer, current state:', currentState);
          
          if (currentState === 'stable') {
            await peerConnectionRef.current.setRemoteDescription(data.offer);
            const answer = await peerConnectionRef.current.createAnswer();
            await peerConnectionRef.current.setLocalDescription(answer);
            socket.emit('call-answer-webrtc', {
              callId: callData.callId,
              answer: answer,
            });
          } else {
            console.warn('⚠️ Cannot process offer in state:', currentState);
            setError('Call connection not ready');
          }
        } catch (error) {
          console.error('❌ Failed to handle call offer:', error);
          setError('Failed to establish connection');
        }
      }
    };

    const handleCallAnswerWebRTC = async (data) => {
      if (data.callId === callData.callId) {
        try {
          const currentState = peerConnectionRef.current.signalingState;
          console.log('📞 Processing answer, current state:', currentState);
          
          if (currentState === 'have-local-offer' || currentState === 'have-local-pranswer') {
            await peerConnectionRef.current.setRemoteDescription(data.answer);
            console.log('✅ Answer processed successfully');
          } else if (currentState === 'stable') {
            // Connection already established
            console.log('🔄 Connection already established, skipping answer');
          } else {
            console.warn('⚠️ Cannot process answer in state:', currentState);
            setError('Call connection not ready');
          }
        } catch (error) {
          console.error('❌ Failed to handle call answer:', error);
          setError('Failed to establish connection');
        }
      }
    };

    const handleIceCandidate = async (data) => {
      if (data.callId === callData.callId && peerConnectionRef.current) {
        try {
          const candidate = new RTCIceCandidate({
            candidate: data.candidate,
            sdpMLineIndex: data.sdpMLineIndex,
            sdpMid: data.sdpMid,
          });
          await peerConnectionRef.current.addIceCandidate(candidate);
        } catch (error) {}
      }
    };

    const handleCallDeclined = (data) => {
      if (data.callId === callData.callId) {
        setCallStatus('declined');
        handleCallEnd();
      }
    };

    const handleCallEnded = (data) => {
      if (data.callId === callData.callId) {
        handleCallEnd();
      }
    };

    socket.on('call-answered', handleCallAnswered);
    socket.on('call-offer', handleCallOffer);
    socket.on('call-answer-webrtc', handleCallAnswerWebRTC);
    socket.on('ice-candidate', handleIceCandidate);
    socket.on('call-declined', handleCallDeclined);
    socket.on('call-ended', handleCallEnded);

    return () => {
      socket.off('call-answered', handleCallAnswered);
      socket.off('call-offer', handleCallOffer);
      socket.off('call-answer-webrtc', handleCallAnswerWebRTC);
      socket.off('ice-candidate', handleIceCandidate);
      socket.off('call-declined', handleCallDeclined);
      socket.off('call-ended', handleCallEnded);
    };
  }, [socket, callData.callId]);

  useEffect(() => {
    if (!isIncoming && callStatus === 'outgoing') {
      initializeWebRTC();
    }
  }, [isIncoming, callStatus]);

  // Enable audio when call is connected
  useEffect(() => {
    if (callStatus === 'connected' && remoteAudioRef.current) {
      // Unmute remote audio when call is connected
      remoteAudioRef.current.muted = false;
      remoteAudioRef.current.volume = 1.0;
      remoteAudioRef.current.play().catch((error) => {
        if (error.name !== 'AbortError') {
          console.error('🎵 Error playing remote audio after call connected:', error);
        }
      });
      console.log('🎵 Remote audio unmuted after call connected');
    }
  }, [callStatus]);

  useEffect(() => {
    return () => {
      stopCallTimer();
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  if (isIncoming && callStatus === 'incoming') {
    return (
      <div 
        className="fixed z-50"
        style={{
          left: position.x,
          top: position.y,
        }}
      >
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 w-80 text-center shadow-2xl border border-gray-700 relative">
          {/* Drag Handle Button */}
          <div className="absolute top-2 right-2">
            <button
              onMouseDown={handleMouseDown}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors cursor-move"
              title="Drag to move call window"
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16M8 4v16M16 4v16" />
              </svg>
            </button>
          </div>
          <div className="mb-4">
            {callData?.caller?.avatar ? (
              <img 
                src={callData.caller.avatar} 
                alt={callData.caller.name}
                className="w-16 h-16 rounded-full mx-auto object-cover border-2 border-white"
              />
            ) : (
              <div className="w-16 h-16 rounded-full mx-auto bg-green-500 text-white flex items-center justify-center text-lg font-bold border-2 border-white">
                {callData?.caller?.name?.charAt(0) || 'U'}
              </div>
            )}
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">
            {callData?.caller?.name || 'Unknown'}
          </h2>
          <p className="text-gray-300 mb-6 text-sm">📞 Incoming voice call...</p>
          <div className="flex justify-center gap-4">
            <button 
              onClick={handleDecline}
              className="w-12 h-12 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <button 
              onClick={handleAnswer}
              className="w-12 h-12 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div 
        className="fixed z-50"
        style={{
          left: position.x,
          top: position.y,
        }}
      >
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 w-80 text-center shadow-2xl border border-gray-700 relative">
          {/* Drag Handle Button */}
          <div className="absolute top-2 right-2">
            <button
              onMouseDown={handleMouseDown}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors cursor-move"
              title="Drag to move call window"
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16M8 4v16M16 4v16" />
              </svg>
            </button>
          </div>
          <div className="text-4xl mb-3">❌</div>
          <h3 className="text-lg font-semibold text-white mb-2">Call Error</h3>
          <p className="text-gray-300 mb-4 text-sm">{error}</p>
          <button 
            onClick={handleCallEnd}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors text-sm"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed z-50"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-2xl border border-gray-700 p-6 w-80 text-center text-white relative">
        {/* Drag Handle Button */}
        <div className="absolute top-2 right-2">
          <button
            onMouseDown={handleMouseDown}
            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors cursor-move"
            title="Drag to move call window"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16M8 4v16M16 4v16" />
            </svg>
          </button>
        </div>
        <audio ref={localAudioRef} muted autoPlay />
        <audio ref={remoteAudioRef} autoPlay />
        
        {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-sm text-gray-300 mb-2">
          {callStatus === 'connecting' ? 'Connecting...' : 
           callStatus === 'connected' ? 'Voice Call' : 
           callStatus === 'outgoing' ? 'Calling...' : 'Call'}
        </h2>
        <h1 className="text-lg font-semibold">
          {callData?.otherUser?.name || callData?.caller?.name || 'Unknown'}
        </h1>
        {callStatus === 'connected' && (
          <p className="text-gray-300 mt-1 text-sm">
            {formatDuration(callDuration)}
          </p>
        )}
      </div>
      
      {/* Avatar */}
      <div className="mb-6">
        {(callData?.otherUser?.avatar || callData?.caller?.avatar) ? (
          <img 
            src={callData?.otherUser?.avatar || callData?.caller?.avatar}
            alt={callData?.otherUser?.name || callData?.caller?.name}
            className="w-20 h-20 rounded-full object-cover shadow-2xl border-2 border-white mx-auto"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center text-2xl font-bold shadow-2xl border-2 border-white mx-auto">
            {(callData?.otherUser?.name || callData?.caller?.name)?.charAt(0) || 'U'}
          </div>
        )}
      </div>
      
      {/* Status */}
      <div className="mb-4 text-center">
        {callStatus === 'outgoing' && (
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <span className="text-gray-300 text-sm">Calling...</span>
          </div>
        )}
        {callStatus === 'connecting' && (
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-white rounded-full animate-bounce"></div>
            <span className="text-gray-300 text-sm">Connecting...</span>
          </div>
        )}
        {callStatus === 'connected' && (
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <span className="text-gray-300 text-sm">Connected</span>
          </div>
        )}
      </div>
      
      {/* Controls */}
      <div className="flex gap-4 justify-center">
        {callStatus === 'connected' && (
          <button
            onClick={toggleMute}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl ${
              isMuted 
                ? 'bg-red-500 hover:bg-red-600' 
                : 'bg-white bg-opacity-20 hover:bg-opacity-30'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            )}
          </button>
        )}
        <button 
          onClick={handleCallEnd}
          className="w-12 h-12 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl"
          title="End Call"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      {/* Audio Quality Indicator */}
      {callStatus === 'connected' && (
        <div className="mt-4 text-center">
          <div className="flex items-center justify-center gap-1">
            <div className="w-1 h-2 bg-green-400 rounded"></div>
            <div className="w-1 h-3 bg-green-400 rounded"></div>
            <div className="w-1 h-4 bg-green-400 rounded"></div>
            <div className="w-1 h-3 bg-green-400 rounded"></div>
            <div className="w-1 h-2 bg-green-400 rounded"></div>
          </div>
          <span className="text-xs text-gray-300 mt-1 block">Good quality</span>
        </div>
      )}
      </div>
    </div>
  );
};

export default WebRTCAudioCall;


