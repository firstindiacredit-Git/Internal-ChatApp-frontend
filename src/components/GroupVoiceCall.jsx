import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../contexts/SocketProvider';
import { toast } from 'react-hot-toast';
import { groupCallsAPI } from '../services/api';

/**
 * Professional Group Voice Call Component
 * Handles group audio calls with proper state management and error handling
 */
const GroupVoiceCall = ({ 
  user, 
  callData, 
  isIncoming = false, 
  onCallEnd, 
  onCallAnswer,
  onCallDecline 
}) => {
  // ==================== STATE MANAGEMENT ====================
  const [callState, setCallState] = useState({
    status: isIncoming ? 'incoming' : 'outgoing',
    duration: 0,
    isMuted: false,
    isConnected: false,
    error: null
  });

  const [participants, setParticipants] = useState([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState({ 
    x: window.innerWidth - 400, 
    y: 20 
  });

  // ==================== REFS ====================
  const localAudioRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef(new Map());
  const callStartTimeRef = useRef(null);
  const durationIntervalRef = useRef(null);
  const participantsRefreshIntervalRef = useRef(null);
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // ==================== SOCKET ====================
  const { socket, isConnected } = useSocket();

  // ==================== WEBRTC CONFIGURATION ====================
  const rtcConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  // ==================== UTILITY FUNCTIONS ====================
  const formatDuration = useCallback((seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }, []);

  const log = useCallback((message, data = null) => {
    console.log(`🎤 [GroupVoiceCall] ${message}`, data || '');
  }, []);

  const logError = useCallback((message, error = null) => {
    console.error(`🎤 [GroupVoiceCall] ${message}`, error || '');
  }, []);

  // ==================== PARTICIPANT MANAGEMENT ====================
  const addParticipant = useCallback((participant) => {
    if (!participant) {
      log('Cannot add participant: participant is undefined');
      return;
    }
    
    setParticipants(prev => {
      const participantId = participant.id || participant._id;
      if (!participantId) {
        log('Cannot add participant: no valid ID found', participant);
        return prev;
      }
      
      const exists = prev.some(p => p.id === participantId);
      if (exists) {
        log('Participant already exists, skipping duplicate', participantId);
        return prev;
      }
      return [...prev, { ...participant, id: participantId }];
    });
  }, [log]);

  const removeParticipant = useCallback((participantId) => {
    if (!participantId) {
      log('Cannot remove participant: participantId is undefined');
      return;
    }
    
    setParticipants(prev => prev.filter(p => p.id !== participantId));
    closePeerConnection(participantId);
  }, [log]);

  const updateParticipant = useCallback((participantId, updates) => {
    if (!participantId) {
      log('Cannot update participant: participantId is undefined');
      return;
    }
    
    setParticipants(prev => 
      prev.map(p => p.id === participantId ? { ...p, ...updates } : p)
    );
  }, [log]);

  // ==================== WEBRTC MANAGEMENT ====================
  const createPeerConnection = useCallback((participantId) => {
    try {
      const peerConnection = new RTCPeerConnection(rtcConfiguration);
      
      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('group-call-ice-candidate', {
            callId: callData.callId,
            to: participantId,
            candidate: event.candidate.candidate,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
            sdpMid: event.candidate.sdpMid,
          });
        }
      };

      // Handle remote tracks
      peerConnection.ontrack = (event) => {
        log('Remote track received', { participantId, track: event.track.kind });
        
        if (event.streams && event.streams[0]) {
          const remoteStream = event.streams[0];
          
          // Enable audio tracks only when call is connected
          remoteStream.getAudioTracks().forEach(track => {
            track.enabled = callState.isConnected;
            log('Remote audio track configured', { 
              participantId, 
              enabled: track.enabled 
            });
          });

          // Update participant with stream
          updateParticipant(participantId, { stream: remoteStream });

          // Set remote audio for playback
          if (remoteAudioRef.current && callState.isConnected) {
            remoteAudioRef.current.srcObject = remoteStream;
            remoteAudioRef.current.volume = 1.0;
            remoteAudioRef.current.muted = false;
            remoteAudioRef.current.play().catch(error => {
              if (error.name !== 'AbortError') {
                logError('Error playing remote audio', error);
              }
            });
          }
        }
      };

      // Handle connection state changes
      peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState;
        log('Connection state changed', { participantId, state });
        
        if (state === 'connected') {
          updateParticipant(participantId, { isConnected: true });
        } else if (state === 'disconnected' || state === 'failed') {
          updateParticipant(participantId, { isConnected: false });
        }
      };

      peerConnectionsRef.current.set(participantId, peerConnection);
      return peerConnection;
    } catch (error) {
      logError('Failed to create peer connection', error);
      return null;
    }
  }, [socket, callData.callId, callState.isConnected, log, logError, updateParticipant]);

  const closePeerConnection = useCallback((participantId) => {
    const peerConnection = peerConnectionsRef.current.get(participantId);
    if (peerConnection) {
      peerConnection.close();
      peerConnectionsRef.current.delete(participantId);
      log('Peer connection closed', participantId);
    }
  }, [log]);

  // ==================== MEDIA MANAGEMENT ====================
  const initializeLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        },
        video: false
      });

      localStreamRef.current = stream;

      // Configure local audio tracks
      stream.getAudioTracks().forEach(track => {
        track.enabled = !isIncoming; // Disable for incoming calls until accepted
      });

      // Set up local audio element
      if (localAudioRef.current) {
        localAudioRef.current.srcObject = stream;
        localAudioRef.current.muted = true; // Prevent echo
        localAudioRef.current.play().catch(() => {});
      }

      log('Local stream initialized successfully');
      return true;
    } catch (error) {
      logError('Failed to initialize local stream', error);
      setCallState(prev => ({ 
        ...prev, 
        error: 'Failed to access microphone. Please check permissions.' 
      }));
      return false;
    }
  }, [isIncoming, log, logError]);

  const enableAudio = useCallback(() => {
    // Enable local audio tracks
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = true;
      });
    }

    // Enable remote audio
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = false;
      remoteAudioRef.current.volume = 1.0;
    }

    // Enable participant audio tracks
    participants.forEach(participant => {
      if (participant.stream) {
        participant.stream.getAudioTracks().forEach(track => {
          track.enabled = true;
        });
      }
    });

    log('Audio enabled for all participants');
  }, [participants, log]);

  // ==================== CALL MANAGEMENT ====================
  const joinCall = useCallback(async () => {
    try {
      if (!callData?.callId) {
        throw new Error('Call ID is required to join a call');
      }
      
      log('Attempting to join group call', { 
        callId: callData.callId, 
        groupId: callData.groupId,
        user: user?.id 
      });
      
      const response = await groupCallsAPI.join(callData.callId);
      
      log('Join API response', response);
      
      if (socket) {
        socket.emit('group-call-join', {
          callId: callData.callId,
          groupId: callData.groupId,
        });
      }

      log('Successfully joined group call');
      return true;
    } catch (error) {
      logError('Failed to join group call', {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status,
        callId: callData?.callId,
        groupId: callData?.groupId,
        userId: user?.id
      });
      setCallState(prev => ({ 
        ...prev, 
        error: `Failed to join group call: ${error.response?.data?.message || error.message}` 
      }));
      return false;
    }
  }, [socket, callData?.callId, callData?.groupId, user?.id, log, logError]);

  const leaveCall = useCallback(async () => {
    try {
      // Close all peer connections
      peerConnectionsRef.current.forEach((peerConnection, participantId) => {
        closePeerConnection(participantId);
      });

      // Stop local stream
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }

      // Clear intervals
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (participantsRefreshIntervalRef.current) {
        clearInterval(participantsRefreshIntervalRef.current);
      }

      // Emit leave event
      if (socket && callData?.callId) {
        socket.emit('group-call-leave', {
          callId: callData.callId,
          groupId: callData.groupId,
        });
      }

      log('Left group call successfully');
    } catch (error) {
      logError('Error leaving group call', error);
    }
  }, [socket, callData?.callId, closePeerConnection, log, logError]);

  // ==================== EVENT HANDLERS ====================
  const handleCallAnswer = useCallback(async () => {
    try {
      const success = await joinCall();
      if (!success) return;

      setCallState(prev => ({
        ...prev,
        status: 'connected',
        isConnected: true,
        error: null
      }));

      callStartTimeRef.current = Date.now();
      enableAudio();
      
      onCallAnswer && onCallAnswer();
      log('Call answered successfully');
    } catch (error) {
      logError('Failed to answer call', error);
      setCallState(prev => ({ 
        ...prev, 
        error: 'Failed to answer call' 
      }));
    }
  }, [joinCall, enableAudio, onCallAnswer, log, logError]);

  const handleCallDecline = useCallback(() => {
    setCallState(prev => ({ ...prev, status: 'declined' }));
    
    if (socket && callData?.callId) {
      socket.emit('group-call-decline', {
        callId: callData.callId,
        groupId: callData.groupId,
      });
    }

    onCallDecline && onCallDecline();
    log('Call declined');
  }, [socket, callData?.callId, onCallDecline, log]);

  const handleCallEnd = useCallback(() => {
    setCallState(prev => ({ ...prev, status: 'ended' }));
    leaveCall();
    onCallEnd && onCallEnd();
    log('Call ended');
  }, [leaveCall, onCallEnd, log]);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      const newMuteState = !callState.isMuted;
      
      audioTracks.forEach(track => {
        track.enabled = newMuteState;
      });

      setCallState(prev => ({ ...prev, isMuted: newMuteState }));
      
      // Update server
      if (callData?.callId && user?.id) {
        groupCallsAPI.updateParticipantStatus(callData.callId, user.id, { 
          isMuted: newMuteState 
        }).catch(error => {
          logError('Failed to update mute status', error);
        });
      } else {
        log('Cannot update mute status: missing callId or userId');
      }

      log('Mute toggled', { muted: newMuteState });
    }
  }, [callState.isMuted, callData?.callId, user?.id, log, logError]);

  // ==================== SOCKET EVENT HANDLERS ====================
  useEffect(() => {
    if (!socket) return;

    const handleParticipantJoined = (data) => {
      if (data.callId === callData?.callId) {
        addParticipant(data.participant);
        log('Participant joined', data.participant);
      }
    };

    const handleParticipantLeft = (data) => {
      if (data.callId === callData?.callId && data.participant) {
        const participantId = data.participant.id || data.participant._id;
        if (participantId) {
          removeParticipant(participantId);
        }
        log('Participant left', data.participant);
      }
    };

    const handleCallJoined = (data) => {
      if (data.callId === callData?.callId) {
        setCallState(prev => ({
          ...prev,
          status: 'connected',
          isConnected: true
        }));
        callStartTimeRef.current = Date.now();
        enableAudio();
        log('Call joined successfully');
      }
    };

    const handleIceCandidate = async (data) => {
      if (data.callId === callData?.callId) {
        const peerConnection = peerConnectionsRef.current.get(data.from);
        if (peerConnection) {
          try {
            await peerConnection.addIceCandidate({
              candidate: data.candidate,
              sdpMLineIndex: data.sdpMLineIndex,
              sdpMid: data.sdpMid,
            });
          } catch (error) {
            logError('Failed to add ICE candidate', error);
          }
        }
      }
    };

    // Register event listeners
    socket.on('group-call-participant-joined', handleParticipantJoined);
    socket.on('group-call-participant-left', handleParticipantLeft);
    socket.on('group-call-joined', handleCallJoined);
    socket.on('group-call-ice-candidate', handleIceCandidate);

    // Cleanup
    return () => {
      socket.off('group-call-participant-joined', handleParticipantJoined);
      socket.off('group-call-participant-left', handleParticipantLeft);
      socket.off('group-call-joined', handleCallJoined);
      socket.off('group-call-ice-candidate', handleIceCandidate);
    };
  }, [socket, callData?.callId, addParticipant, removeParticipant, enableAudio, log, logError]);

  // ==================== DURATION TIMER ====================
  useEffect(() => {
    if (callState.status === 'connected' && callStartTimeRef.current) {
      durationIntervalRef.current = setInterval(() => {
        const duration = Math.floor((Date.now() - callStartTimeRef.current) / 1000);
        setCallState(prev => ({ ...prev, duration }));
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
  }, [callState.status]);

  // ==================== INITIALIZATION ====================
  useEffect(() => {
    if (callData && callData.callId && isConnected) {
      initializeLocalStream();
    }

    return () => {
      leaveCall();
    };
  }, [callData, isConnected, initializeLocalStream, leaveCall]);

  // ==================== DRAG AND DROP ====================
  const handleMouseDown = useCallback((e) => {
    isDraggingRef.current = true;
    const rect = e.currentTarget.getBoundingClientRect();
    dragOffsetRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!isDraggingRef.current) return;
    
    const newX = e.clientX - dragOffsetRef.current.x;
    const newY = e.clientY - dragOffsetRef.current.y;
    
    const maxX = window.innerWidth - 400;
    const maxY = window.innerHeight - 200;
    
    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY))
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  useEffect(() => {
    if (isDraggingRef.current) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [handleMouseMove, handleMouseUp]);

  // ==================== RENDER ====================
  
  // Validate required props
  if (!user || !callData) {
    return (
      <div 
        className="fixed z-50"
        style={{ left: position.x, top: position.y }}
      >
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 w-80 text-center shadow-2xl border border-gray-700">
          <div className="text-4xl mb-3">⚠️</div>
          <h3 className="text-lg font-semibold text-white mb-2">Missing Required Data</h3>
          <p className="text-gray-300 mb-4 text-sm">
            {!user ? 'User data is required' : 'Call data is required'}
          </p>
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
  
  if (callState.error) {
    return (
      <div 
        className="fixed z-50"
        style={{ left: position.x, top: position.y }}
      >
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 w-80 text-center shadow-2xl border border-gray-700">
          <div className="text-4xl mb-3">❌</div>
          <h3 className="text-lg font-semibold text-white mb-2">Call Error</h3>
          <p className="text-gray-300 mb-4 text-sm">{callState.error}</p>
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
      style={{ left: position.x, top: position.y }}
    >
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-2xl border border-gray-700 p-6 w-80 text-center text-white relative">
        {/* Drag Handle */}
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

        {/* Audio Elements */}
        <audio ref={localAudioRef} muted autoPlay style={{ display: 'none' }} />
        <audio ref={remoteAudioRef} autoPlay style={{ display: 'none' }} />
        
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-sm text-gray-300 mb-2">
            {callState.status === 'incoming' && 'Incoming group call...'}
            {callState.status === 'outgoing' && 'Joining group call...'}
            {callState.status === 'connected' && 'Group Voice Call'}
            {callState.status === 'declined' && 'Call declined'}
            {callState.status === 'ended' && 'Call ended'}
          </h2>
          <h1 className="text-lg font-semibold">
            {callData?.group?.name || 'Group Call'}
          </h1>
          {callState.status === 'connected' && (
            <p className="text-gray-300 mt-1 text-sm">
              {formatDuration(callState.duration)}
            </p>
          )}
        </div>
        
        {/* Group Icon */}
        <div className="mb-6">
          <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center text-2xl font-bold shadow-2xl border-2 border-white mx-auto">
            G
          </div>
        </div>
        
        {/* Participants Count */}
        <div className="mb-4 text-center">
          <p className="text-gray-300 text-sm">
            {participants.length + 1} participant{(participants.length + 1) !== 1 ? 's' : ''}
          </p>
        </div>
        
        {/* Status */}
        <div className="mb-4 text-center">
          {callState.status === 'connected' && (
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span className="text-gray-300 text-sm">Connected</span>
            </div>
          )}
        </div>
        
        {/* Controls */}
        <div className="flex gap-4 justify-center">
          {callState.status === 'incoming' && (
            <>
              <button 
                onClick={handleCallDecline}
                className="w-12 h-12 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl"
                title="Decline"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <button 
                onClick={handleCallAnswer}
                className="w-12 h-12 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl"
                title="Answer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </button>
            </>
          )}

          {callState.status === 'connected' && (
            <>
              <button
                onClick={toggleMute}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl ${
                  callState.isMuted 
                    ? 'bg-red-500 hover:bg-red-600' 
                    : 'bg-white bg-opacity-20 hover:bg-opacity-30'
                }`}
                title={callState.isMuted ? 'Unmute' : 'Mute'}
              >
                {callState.isMuted ? (
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
              <button 
                onClick={handleCallEnd}
                className="w-12 h-12 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl"
                title="End Call"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </>
          )}

          {(callState.status === 'outgoing' || callState.status === 'ringing') && (
            <button 
              onClick={handleCallEnd}
              className="w-12 h-12 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl"
              title="Cancel Call"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        
        {/* Audio Quality Indicator */}
        {callState.status === 'connected' && (
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

export default GroupVoiceCall;
