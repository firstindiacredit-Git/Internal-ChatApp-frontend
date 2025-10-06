import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../contexts/SocketProvider';
import { toast } from 'react-hot-toast';
import { groupCallsAPI } from '../services/api';

const GroupCallUI = ({ 
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
  const [participants, setParticipants] = useState([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState({ x: window.innerWidth - 400, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isLeaving, setIsLeaving] = useState(false);
  const [isCallEstablished, setIsCallEstablished] = useState(false);
  const participantsRefreshIntervalRef = useRef(null);

  // WebRTC refs for each participant - following WebRTCCall pattern
  const localVideoRef = useRef(null);
  const localAudioRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef(new Map());
  const callStartTimeRef = useRef(null);
  const durationIntervalRef = useRef(null);
  const webrtcInitializedRef = useRef(false);
  const dragRef = useRef(null);
  
  // Additional refs for better state management
  const answerProcessedRef = useRef(false);
  const processedCallIdRef = useRef(null);
  const callEndedRef = useRef(false);
  const offerCreatedRef = useRef(false);
  const iceCandidateQueueRef = useRef([]);
  const queuedIceCandidatesRef = useRef(new Map()); // Store ICE candidates by peer connection
  const processedAnswersRef = useRef(new Set()); // Track processed answers to prevent duplicates

  const rtcConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
    ],
    iceCandidatePoolSize: 10,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
  };

  useEffect(() => {
    if (callData && callData.callId && callData.groupId && isConnected) {
      console.log('🚀 Initializing WebRTC for group call:', {
        callId: callData.callId,
        groupId: callData.groupId,
        callType: callData.callType,
        isIncoming: isIncoming
      });
      initializeWebRTC();
    } else {
      console.log('⏳ Waiting for call data to initialize WebRTC:', {
        hasCallData: !!callData,
        hasCallId: !!callData?.callId,
        hasGroupId: !!callData?.groupId,
        isConnected: isConnected
      });
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
      // Check if WebRTC is supported - following WebRTCCall pattern
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('WebRTC not supported in this browser or requires HTTPS');
        setError('Video calls require HTTPS connection or are not supported in this browser. Please use HTTPS or try a different browser.');
        return;
      }

      // Check if RTCPeerConnection is supported
      if (typeof RTCPeerConnection === 'undefined') {
        console.error('RTCPeerConnection not supported');
        setError('WebRTC is not supported in this browser. Please use a modern browser like Chrome, Firefox, or Safari.');
        return;
      }

      // Reset state refs - following WebRTCCall pattern
      answerProcessedRef.current = false;
      processedCallIdRef.current = null;
      callEndedRef.current = false;
      offerCreatedRef.current = false;
      iceCandidateQueueRef.current = [];
      processedAnswersRef.current.clear();
      webrtcInitializedRef.current = false;
      
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1,
          latency: 0.01
        },
        video: isVideoEnabled ? { 
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 30, max: 60 }
        } : false,
      };
      
      try {
        localStreamRef.current = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('🎤 Media stream obtained successfully');
      } catch (mediaError) {
        console.error('🎤 Media access error:', mediaError);
        
        // Error handling following WebRTCCall pattern
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
      
      // Enable all tracks - following WebRTCCall pattern
      const localAudioTracks = localStreamRef.current.getAudioTracks();
      localAudioTracks.forEach(track => { track.enabled = true; });
      const localVideoTracks = localStreamRef.current.getVideoTracks();
      localVideoTracks.forEach(track => { track.enabled = isVideoEnabled; });
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
        localVideoRef.current.play().catch(() => {});
      }

        // Set up local audio element - following WebRTCAudioCall pattern
        if (localAudioRef.current) {
          localAudioRef.current.srcObject = localStreamRef.current;
          localAudioRef.current.muted = true; // Prevent echo
          localAudioRef.current.play().catch(() => {});
        }

      setupSocketListeners();
      webrtcInitializedRef.current = true;

      // Set call as established early to allow ICE candidates
      console.log('🚀 Setting call as established to allow ICE candidates');
      setIsCallEstablished(true);

      if (!isIncoming) {
        // Join the group call
        await joinGroupCall();
      } else {
        // For incoming calls, also join via API to get participants
        console.log('📞 Incoming call - joining via API to get participants');
        try {
          await groupCallsAPI.join(callData.callId);
        } catch (error) {
          console.error('Error joining incoming call:', error);
        }
      }
    } catch (error) {
      webrtcInitializedRef.current = false;
      setError('Failed to access camera/microphone. Please check permissions.');
    }
  };

  const setupSocketListeners = () => {
    if (!socket) return;

    socket.off('group-call-initiated');
    socket.off('group-call-joined');
    socket.off('group-call-left');
    socket.off('group-call-ended');
    socket.off('group-call-error');
    socket.off('group-call-participant-joined');
    socket.off('group-call-participant-left');
    socket.off('group-call-offer');
    socket.off('group-call-answer');
    socket.off('group-call-ice-candidate');

    socket.on('group-call-initiated', (data) => {
      if (data.callId === callData.callId) {
        console.log('Group call initiated:', data);
        setCallStatus('ringing');
      }
    });

    socket.on('group-call-joined', async (data) => {
      if (data.callId === callData.callId) {
        console.log('Group call joined:', data);
        setCallStatus('connected');
        setIsCallEstablished(true);
        callStartTimeRef.current = Date.now();
        
        // Fetch existing participants and establish mesh connections
        try {
          const response = await fetch(`/api/group-calls/${callData.callId}`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          });
          if (response.ok) {
            const callDetails = await response.json();
            const existingParticipants = callDetails.data.call.participants
              .filter(p => p.isActive && p.user._id !== user.id)
              .map(p => ({ ...p.user, id: p.user._id }));
            
            if (existingParticipants.length > 0) {
              console.log('📞 Found existing participants:', existingParticipants);
              // Add existing participants to state
              setParticipants(existingParticipants);
              await establishMeshConnections(existingParticipants);
            } else {
              console.log('📞 No existing participants found');
            }
            
            // Start periodic refresh of participants for outgoing calls too
            participantsRefreshIntervalRef.current = setInterval(refreshParticipants, 5000);
          }
        } catch (error) {
          console.error('Error fetching call details:', error);
        }
      }
    });

    socket.on('group-call-left', (data) => {
      if (data.callId === callData.callId && !isLeaving) {
        console.log('Group call left:', data);
        // Don't call handleCallEnd() here to prevent loop
        // Just update the UI state
        setCallStatus('ended');
        onCallEnd && onCallEnd();
      }
    });

    socket.on('group-call-ended', (data) => {
      if (data.callId === callData.callId && !isLeaving) {
        console.log('Group call ended:', data);
        
        // Show notification about call end
        if (data.reason === "Initiator left the call") {
          toast.success(`Call ended - ${data.endedBy?.name || 'Host'} left the call`);
        } else {
          toast.success('Call ended');
        }
        
        // Don't call handleCallEnd() here to prevent loop
        // Just update the UI state
        setCallStatus('ended');
        onCallEnd && onCallEnd();
      }
    });

    socket.on('group-call-error', (data) => {
      console.error('Group call error:', data);
      setError(data.error);
    });

    socket.on('group-call-participant-joined', (data) => {
      if (data.callId === callData.callId) {
        console.log('📞 Participant joined socket event:', {
          data: data,
          newParticipant: data.newParticipant,
          hasNewParticipant: !!data.newParticipant,
          newParticipantId: data.newParticipant?.id,
          newParticipantName: data.newParticipant?.name
        });
        console.log('📞 Current participants before adding:', participants);
        setParticipants(prev => {
          // Ensure participant has id field (handle both id and _id)
          const participant = {
            ...data.newParticipant,
            id: data.newParticipant.id || data.newParticipant._id
          };
          
          // Check if participant already exists to prevent duplicates
          const exists = prev.some(p => p.id === participant.id);
          if (exists) {
            console.log('📞 Participant already exists, skipping duplicate');
            return prev;
          }
          const newParticipants = [...prev, participant];
          console.log('📞 Updated participants after adding:', newParticipants);
          return newParticipants;
        });
        // Create peer connection for new participant
        const participant = {
          ...data.newParticipant,
          id: data.newParticipant.id || data.newParticipant._id
        };
        handleParticipantJoined(participant);
      }
    });

    socket.on('group-call-participant-left', (data) => {
      if (data.callId === callData.callId) {
        console.log('📞 Participant left:', data);
        setParticipants(prev => {
          const updatedParticipants = prev.filter(p => p.id !== data.leftParticipant.id);
          console.log('📞 Updated participants after removal:', updatedParticipants);
          return updatedParticipants;
        });
        // Close peer connection for leaving participant
        closePeerConnection(data.leftParticipant.id);
      }
    });

    socket.on('group-call-offer', async (data) => {
      if (data.callId === callData.callId) {
        console.log('Group call offer received:', data);
        await handleGroupCallOffer(data);
      }
    });

    socket.on('group-call-answer', async (data) => {
      if (data.callId === callData.callId) {
        console.log('Group call answer received:', data);
        await handleGroupCallAnswer(data);
      }
    });

    socket.on('group-call-ice-candidate', async (data) => {
      if (data.callId === callData.callId) {
        console.log('Group call ICE candidate received:', data);
        await handleGroupCallIceCandidate(data);
      }
    });
  };

  const createPeerConnection = async (targetUserId) => {
    try {
      console.log('🔗 Creating peer connection for target user:', targetUserId);
      const peerConnection = new RTCPeerConnection(rtcConfiguration);

      // Add local stream tracks with proper audio handling
      if (localStreamRef.current) {
        const audioTracks = localStreamRef.current.getAudioTracks();
        const videoTracks = localStreamRef.current.getVideoTracks();
        
        // Add audio tracks with proper configuration
        audioTracks.forEach(track => {
          // Ensure audio track is properly configured
          track.enabled = !isMuted;
          const sender = peerConnection.addTrack(track, localStreamRef.current);
          console.log('🎤 Added audio track to peer connection:', track.label, 'enabled:', track.enabled);
          
          // Configure audio sender parameters for better quality
          if (sender && sender.getParameters) {
            const params = sender.getParameters();
            if (params.encodings && params.encodings[0]) {
              params.encodings[0].maxBitrate = 64000; // 64kbps for voice
              params.encodings[0].priority = 'high';
              sender.setParameters(params);
            }
          }
        });
        
        // Add video tracks if enabled
        videoTracks.forEach(track => {
          track.enabled = isVideoEnabled;
          const sender = peerConnection.addTrack(track, localStreamRef.current);
          console.log('🎥 Added video track to peer connection:', track.label, 'enabled:', track.enabled);
          
          // Configure video sender parameters
          if (sender && sender.getParameters) {
            const params = sender.getParameters();
            if (params.encodings && params.encodings[0]) {
              params.encodings[0].maxBitrate = 1000000; // 1Mbps for video
              params.encodings[0].maxFramerate = 30;
              sender.setParameters(params);
            }
          }
        });
      }

      peerConnection.ontrack = (event) => {
        console.log('🎵 Remote track received from:', targetUserId);
        console.log('🎵 Track details:', {
          kind: event.track.kind,
          label: event.track.label,
          enabled: event.track.enabled,
          readyState: event.track.readyState,
          streamsCount: event.streams.length
        });
        
        // Handle remote stream with better audio processing
        const remoteStream = event.streams[0];
        if (remoteStream) {
          console.log('🎵 Remote stream received:', {
            id: remoteStream.id,
            active: remoteStream.active,
            audioTracks: remoteStream.getAudioTracks().length,
            videoTracks: remoteStream.getVideoTracks().length
          });
          
          // Process audio tracks for better quality
          const audioTracks = remoteStream.getAudioTracks();
          audioTracks.forEach(track => {
            console.log('🔊 Processing remote audio track:', track.label, 'enabled:', track.enabled);
            // Ensure audio track is enabled
            track.enabled = true;
          });
          
          // Update participant's stream in state
          setParticipants(prev => {
            const updatedParticipants = prev.map(p => 
              p.id === targetUserId ? { ...p, stream: remoteStream } : p
            );
            console.log('🔊 Updated participants with stream:', updatedParticipants);
            return updatedParticipants;
          });
        }
      };

      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('🧊 ICE candidate event received:', {
            hasTargetUserId: !!targetUserId,
            targetUserId: targetUserId,
            hasSocket: !!socket,
            hasCallData: !!callData,
            hasCallId: !!callData?.callId,
            hasGroupId: !!callData?.groupId,
            candidateType: event.candidate.type,
            candidateProtocol: event.candidate.protocol
          });
          
          if (targetUserId && socket && callData && callData.callId && callData.groupId) {
            console.log('🧊 ICE candidate generated for participant:', targetUserId, {
              hasCallData: !!callData,
              callId: callData?.callId,
              groupId: callData?.groupId,
              isCallEstablished: isCallEstablished,
              candidate: event.candidate.candidate,
              type: event.candidate.type,
              protocol: event.candidate.protocol
            });
            
            const iceCandidateData = {
              callId: callData.callId,
              groupId: callData.groupId,
              targetUserId: targetUserId,
              candidate: event.candidate.candidate,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
              sdpMid: event.candidate.sdpMid,
            };
            
            console.log('🚀 Sending ICE candidate with data:', iceCandidateData);
            socket.emit('group-call-ice-candidate', iceCandidateData);
          } else {
            // Queue ICE candidate for later when we have target user
            if (!queuedIceCandidatesRef.current.has(targetUserId || 'unknown')) {
              queuedIceCandidatesRef.current.set(targetUserId || 'unknown', []);
            }
            queuedIceCandidatesRef.current.get(targetUserId || 'unknown').push(event.candidate);
            console.log('🧊 ICE candidate queued for later sending:', {
              targetUserId: targetUserId || 'unknown',
              candidate: event.candidate.candidate,
              type: event.candidate.type
            });
          }
        } else {
          console.log('🧊 ICE gathering completed for participant:', targetUserId);
        }
      };

      peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState;
        console.log(`Connection state with ${targetUserId}:`, state);
        if (state === 'connected') {
          console.log(`✅ WebRTC connection established with ${targetUserId}`);
        } else if (state === 'disconnected') {
          console.log(`⚠️ WebRTC connection disconnected with ${targetUserId}`);
          // Wait before attempting reconnection
          setTimeout(() => {
            if (peerConnectionsRef.current.has(targetUserId) && 
                peerConnection.connectionState === 'disconnected') {
              console.log(`🔄 Attempting to reconnect to ${targetUserId}`);
              // Try to restart ICE first
              try {
                peerConnection.restartIce();
              } catch (error) {
                console.log(`❌ ICE restart failed, recreating connection to ${targetUserId}`);
                closePeerConnection(targetUserId);
                createPeerConnection(targetUserId);
              }
            }
          }, 5000);
        } else if (state === 'failed') {
          console.log(`❌ WebRTC connection failed with ${targetUserId}:`, state);
          // Attempt to reconnect after a delay
          setTimeout(() => {
            if (peerConnectionsRef.current.has(targetUserId)) {
              console.log(`🔄 Attempting to reconnect to ${targetUserId}`);
              // Recreate peer connection
              closePeerConnection(targetUserId);
              createPeerConnection(targetUserId);
            }
          }, 3000);
        }
      };

      peerConnection.oniceconnectionstatechange = () => {
        const state = peerConnection.iceConnectionState;
        console.log(`ICE connection state with ${targetUserId}:`, state);
        
        if (state === 'connected' || state === 'completed') {
          console.log(`✅ ICE connection established with ${targetUserId}`);
        } else if (state === 'failed') {
          console.log(`❌ ICE connection failed with ${targetUserId}, attempting restart`);
          // Try to restart ICE gathering
          peerConnection.restartIce();
        } else if (state === 'disconnected') {
          console.log(`⚠️ ICE connection disconnected with ${targetUserId}`);
          // Wait a bit before considering it failed
          setTimeout(() => {
            if (peerConnection.iceConnectionState === 'disconnected') {
              console.log(`🔄 Restarting ICE for ${targetUserId}`);
              peerConnection.restartIce();
            }
          }, 3000);
        }
      };

      peerConnectionsRef.current.set(targetUserId, peerConnection);
      
      // Process any queued ICE candidates for this user
      setTimeout(() => {
        processQueuedIceCandidatesForUser(targetUserId);
      }, 100);
      
      return peerConnection;
    } catch (error) {
      console.error('Error creating peer connection:', error);
    }
  };

  const closePeerConnection = (targetUserId) => {
    const peerConnection = peerConnectionsRef.current.get(targetUserId);
    if (peerConnection) {
      peerConnection.close();
      peerConnectionsRef.current.delete(targetUserId);
    }
  };

  const handleGroupCallOffer = async (data) => {
    try {
      console.log('🎯 Group call offer data received:', {
        data: data,
        from: data.from,
        hasFrom: !!data.from,
        fromId: data.from?.id,
        fromName: data.from?.name,
        hasOffer: !!data.offer
      });
      
      // Handle both id and _id fields for compatibility
      const fromUserId = data.from.id || data.from._id;
      
      if (!fromUserId) {
        console.error('❌ Cannot handle offer: missing from user ID', {
          from: data.from,
          hasId: !!data.from?.id,
          hasUnderscoreId: !!data.from?._id
        });
        return;
      }
      
      const peerConnection = await createPeerConnection(fromUserId);
      if (peerConnection) {
        try {
          await peerConnection.setRemoteDescription(data.offer);
          const answer = await peerConnection.createAnswer();
          console.log('📞 Created answer for participant:', fromUserId, {
            hasAnswer: !!answer,
            answerType: answer?.type,
            answerSdp: answer?.sdp ? answer.sdp.substring(0, 100) + '...' : 'No SDP'
          });
          await peerConnection.setLocalDescription(answer);
          
          if (callData && callData.callId && callData.groupId && answer) {
            socket.emit('group-call-answer', {
              callId: callData.callId,
              groupId: callData.groupId,
              targetUserId: fromUserId,
              answer: answer,
            });
            
            // Send any queued ICE candidates for this participant
            sendQueuedIceCandidates(fromUserId);
            
            // Process any queued ICE candidates after setting local description
            setTimeout(() => {
              processQueuedIceCandidatesForUser(fromUserId);
            }, 100);
          } else {
            console.warn('Skipping answer: call data not ready yet', {
              hasCallData: !!callData,
              hasCallId: !!callData?.callId,
              hasGroupId: !!callData?.groupId,
              hasAnswer: !!answer,
            });
          }
        } catch (answerError) {
          console.error('Error creating answer for participant:', fromUserId, answerError);
        }
      }
    } catch (error) {
      console.error('Error handling group call offer:', error);
    }
  };

  const handleGroupCallAnswer = async (data) => {
    try {
      console.log('🎯 Group call answer data received:', {
        data: data,
        from: data.from,
        hasFrom: !!data.from,
        fromId: data.from?.id,
        fromUnderscoreId: data.from?._id,
        fromName: data.from?.name,
        hasAnswer: !!data.answer
      });
      
      // Handle both id and _id fields for compatibility
      const fromUserId = data.from.id || data.from._id;
      
      if (!fromUserId) {
        console.error('❌ Cannot handle answer: missing from user ID', {
          from: data.from,
          hasId: !!data.from?.id,
          hasUnderscoreId: !!data.from?._id
        });
        return;
      }
      
      // Create a unique identifier for this answer to prevent duplicates
      const answerId = `${fromUserId}-${data.answer?.sdp?.substring(0, 50) || 'unknown'}`;
      
      if (processedAnswersRef.current.has(answerId)) {
        console.log('🔄 Answer already processed, skipping duplicate:', answerId);
        return;
      }
      
      const peerConnection = peerConnectionsRef.current.get(fromUserId);
      if (peerConnection) {
        // Check peer connection state before setting remote description
        console.log('🔍 Peer connection state for', fromUserId, ':', {
          connectionState: peerConnection.connectionState,
          iceConnectionState: peerConnection.iceConnectionState,
          signalingState: peerConnection.signalingState,
          currentRemoteDescription: !!peerConnection.currentRemoteDescription
        });
        
        // Only set remote description if we're in the right state
        if (peerConnection.signalingState === 'have-local-offer' || 
            peerConnection.signalingState === 'have-local-pranswer') {
        try {
          await peerConnection.setRemoteDescription(data.answer);
          processedAnswersRef.current.add(answerId);
          console.log('✅ Answer processed for participant:', fromUserId);
          
          // Process any queued ICE candidates after setting remote description
          setTimeout(() => {
            processQueuedIceCandidatesForUser(fromUserId);
          }, 100);
        } catch (setDescError) {
          console.error('❌ Failed to set remote description for', fromUserId, ':', setDescError);
        }
        } else {
          console.warn('⚠️ Cannot set remote description - wrong signaling state:', {
            participant: fromUserId,
            signalingState: peerConnection.signalingState,
            expectedStates: ['have-local-offer', 'have-local-pranswer']
          });
        }
      } else {
        console.warn('⚠️ No peer connection found for participant:', fromUserId);
      }
    } catch (error) {
      console.error('Error handling group call answer:', error);
    }
  };

  const handleGroupCallIceCandidate = async (data) => {
    try {
      console.log('🎯 Group call ICE candidate data received:', {
        data: data,
        from: data.from,
        hasFrom: !!data.from,
        fromId: data.from?.id,
        fromUnderscoreId: data.from?._id,
        fromName: data.from?.name,
        hasCandidate: !!data.candidate,
        candidate: data.candidate ? data.candidate.substring(0, 100) + '...' : 'No candidate'
      });
      
      // Handle both id and _id fields for compatibility
      const fromUserId = data.from.id || data.from._id;
      
      if (!fromUserId) {
        console.error('❌ Cannot handle ICE candidate: missing from user ID', {
          from: data.from,
          hasId: !!data.from?.id,
          hasUnderscoreId: !!data.from?._id
        });
        return;
      }
      
      const peerConnection = peerConnectionsRef.current.get(fromUserId);
      if (peerConnection) {
        // Check if peer connection is in a valid state
        if (peerConnection.signalingState === 'closed') {
          console.warn('⚠️ Peer connection is closed, cannot add ICE candidate for:', fromUserId);
          return;
        }
        
        try {
          await peerConnection.addIceCandidate({
            candidate: data.candidate,
            sdpMLineIndex: data.sdpMLineIndex,
            sdpMid: data.sdpMid,
          });
          console.log('✅ ICE candidate processed for participant:', fromUserId);
        } catch (addCandidateError) {
          console.error('❌ Failed to add ICE candidate for', fromUserId, ':', addCandidateError);
          // If adding candidate fails, it might be because the connection is in a bad state
          if (addCandidateError.name === 'InvalidStateError') {
            console.log('🔄 Peer connection in invalid state, attempting to recreate for:', fromUserId);
            closePeerConnection(fromUserId);
            // Don't recreate immediately, let the connection state handler deal with it
          }
        }
      } else {
        console.warn('⚠️ No peer connection found for ICE candidate from participant:', fromUserId);
        // Queue the candidate for when the peer connection is created
        if (!queuedIceCandidatesRef.current.has(fromUserId)) {
          queuedIceCandidatesRef.current.set(fromUserId, []);
        }
        queuedIceCandidatesRef.current.get(fromUserId).push({
          candidate: data.candidate,
          sdpMLineIndex: data.sdpMLineIndex,
          sdpMid: data.sdpMid,
        });
        console.log('🧊 ICE candidate queued for participant:', fromUserId);
      }
    } catch (error) {
      console.error('Error handling group call ICE candidate:', error);
    }
  };

  const joinGroupCall = async () => {
    try {
      // First join via API to add user to participants
      await groupCallsAPI.join(callData.callId);
      
      // Then emit socket event for real-time notifications
      if (socket) {
        socket.emit('group-call-join', {
          callId: callData.callId,
          groupId: callData.groupId,
        });
      }
    } catch (error) {
      console.error('Error joining group call:', error);
      setError('Failed to join group call');
    }
  };

  // Enhanced mesh networking - create connections with all existing participants
  const establishMeshConnections = async (existingParticipants) => {
    try {
      for (const participant of existingParticipants) {
        if (participant.id !== user.id && participant.isActive) {
          console.log(`Creating mesh connection with ${participant.name}`);
          const peerConnection = await createPeerConnection(participant.id);
          
          if (peerConnection) {
            // Create and send offer to establish connection
            try {
              const offer = await peerConnection.createOffer();
              console.log('📞 Created offer for participant:', participant.id, {
                hasOffer: !!offer,
                offerType: offer?.type,
                offerSdp: offer?.sdp ? offer.sdp.substring(0, 100) + '...' : 'No SDP'
              });
              await peerConnection.setLocalDescription(offer);
            
            if (callData && callData.callId && callData.groupId && offer) {
              socket.emit('group-call-offer', {
                callId: callData.callId,
                groupId: callData.groupId,
                targetUserId: participant.id,
                offer: offer,
              });
              
              // Send any queued ICE candidates for this participant
              sendQueuedIceCandidates(participant.id);
              
              // Process any queued ICE candidates after setting local description
              setTimeout(() => {
                processQueuedIceCandidatesForUser(participant.id);
              }, 100);
            } else {
              console.warn('Skipping offer: call data not ready yet', {
                hasCallData: !!callData,
                hasCallId: !!callData?.callId,
                hasGroupId: !!callData?.groupId,
                hasOffer: !!offer,
              });
            }
            } catch (offerError) {
              console.error('Error creating offer for participant:', participant.id, offerError);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error establishing mesh connections:', error);
    }
  };

  // Handle participant joining - create connection with new participant
  const handleParticipantJoined = async (newParticipant) => {
    try {
      console.log('🎯 New participant data received:', {
        newParticipant: newParticipant,
        hasId: !!newParticipant?.id,
        id: newParticipant?.id,
        hasName: !!newParticipant?.name,
        name: newParticipant?.name,
        currentUserId: user?.id
      });
      
      // Handle both id and _id fields for compatibility
      const participantId = newParticipant.id || newParticipant._id;
      
      if (participantId && participantId !== user.id) {
        console.log(`New participant joined: ${newParticipant.name} (ID: ${participantId})`);
        const peerConnection = await createPeerConnection(participantId);
        
        if (peerConnection) {
          // Create and send offer to new participant
          try {
            const offer = await peerConnection.createOffer();
            console.log('📞 Created offer for new participant:', participantId, {
              hasOffer: !!offer,
              offerType: offer?.type,
              offerSdp: offer?.sdp ? offer.sdp.substring(0, 100) + '...' : 'No SDP'
            });
            await peerConnection.setLocalDescription(offer);
            
            if (callData && callData.callId && callData.groupId && offer) {
              socket.emit('group-call-offer', {
                callId: callData.callId,
                groupId: callData.groupId,
                targetUserId: participantId,
                offer: offer,
              });
              
              // Send any queued ICE candidates for this participant
              sendQueuedIceCandidates(participantId);
              
              // Process any queued ICE candidates after setting local description
              setTimeout(() => {
                processQueuedIceCandidatesForUser(participantId);
              }, 100);
            } else {
              console.warn('Skipping offer: call data not ready yet', {
                hasCallData: !!callData,
                hasCallId: !!callData?.callId,
                hasGroupId: !!callData?.groupId,
                hasOffer: !!offer,
              });
            }
          } catch (offerError) {
            console.error('Error creating offer for new participant:', participantId, offerError);
          }
        }
      }
    } catch (error) {
      console.error('Error handling participant joined:', error);
    }
  };

  // Function to refresh participants list
  const refreshParticipants = async () => {
    if (!callData?.callId) return;
    
    try {
      const response = await fetch(`/api/group-calls/${callData.callId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const callDetails = await response.json();
        const allParticipants = callDetails.data.call.participants
          .filter(p => p.isActive && p.user._id !== user.id)
          .map(p => ({ ...p.user, id: p.user._id }));
        
        console.log('📞 Refreshed participants:', allParticipants);
        setParticipants(allParticipants);
      }
    } catch (error) {
      console.error('Error refreshing participants:', error);
    }
  };

  const handleCallAnswer = async () => {
    try {
      await joinGroupCall();
      
      // Fetch and display all participants when answering
      await refreshParticipants();
      
      // Start periodic refresh of participants
      participantsRefreshIntervalRef.current = setInterval(refreshParticipants, 5000);
      
      onCallAnswer && onCallAnswer();
    } catch (error) {
      console.error('Error answering group call:', error);
      setError('Failed to answer group call');
    }
  };

  const handleCallDecline = () => {
    if (socket) {
      socket.emit('group-call-leave', {
        callId: callData.callId,
        groupId: callData.groupId,
      });
    }
    setCallStatus('declined');
    onCallDecline && onCallDecline();
    setTimeout(() => {
      onCallEnd && onCallEnd();
    }, 1000);
  };

  const handleCallEnd = () => {
    if (isLeaving) return; // Prevent multiple calls
    
    setIsLeaving(true);
    setIsCallEstablished(false);
    
    // Clean up WebRTC connections
    cleanup();
    
    // Clear participants refresh interval
    if (participantsRefreshIntervalRef.current) {
      clearInterval(participantsRefreshIntervalRef.current);
      participantsRefreshIntervalRef.current = null;
    }
    
    if (socket) {
      socket.emit('group-call-leave', {
        callId: callData.callId,
        groupId: callData.groupId,
      });
    }
    setCallStatus('ended');
    onCallEnd && onCallEnd();
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => { track.enabled = isMuted; });
      setIsMuted(!isMuted);
      
      // Update participant status on server
      groupCallsAPI.updateParticipantStatus(callData.callId, user.id, { isMuted: !isMuted })
        .then(() => console.log('🎤 Mute status updated on server'))
        .catch(error => console.error('Error updating mute status:', error));
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      const newVideoState = !isVideoEnabled;
      videoTracks.forEach(track => { track.enabled = newVideoState; });
      setIsVideoEnabled(newVideoState);
      
      // Update participant status on server
      groupCallsAPI.updateParticipantStatus(callData.callId, user.id, { isVideoEnabled: newVideoState })
        .then(() => console.log('🎥 Video status updated on server'))
        .catch(error => console.error('Error updating video status:', error));
    }
  };

  // Remove participant from call (host only)
  const removeParticipant = async (participantId) => {
    try {
      const response = await groupCallsAPI.removeParticipant(callData.callId, participantId);
      
      if (response.data.success) {
        // Close peer connection
        closePeerConnection(participantId);
        // Remove from participants list
        setParticipants(prev => prev.filter(p => p.id !== participantId));
        toast.success('Participant removed from call');
      }
    } catch (error) {
      console.error('Error removing participant:', error);
      toast.error('Failed to remove participant');
    }
  };

  // Mute/unmute specific participant (host only)
  const toggleParticipantMute = async (participantId, isMuted) => {
    try {
      const response = await groupCallsAPI.updateParticipantStatus(callData.callId, participantId, { isMuted: !isMuted });
      
      if (response.data.success) {
        // Update local state
        setParticipants(prev => prev.map(p => 
          p.id === participantId ? { ...p, isMuted: !isMuted } : p
        ));
        toast.success(`Participant ${!isMuted ? 'muted' : 'unmuted'}`);
      }
    } catch (error) {
      console.error('Error toggling participant mute:', error);
      toast.error('Failed to toggle participant mute');
    }
  };

  // Toggle video for specific participant (host only)
  const toggleParticipantVideo = async (participantId, isVideoEnabled) => {
    try {
      const response = await groupCallsAPI.updateParticipantStatus(callData.callId, participantId, { isVideoEnabled: !isVideoEnabled });
      
      if (response.data.success) {
        // Update local state
        setParticipants(prev => prev.map(p => 
          p.id === participantId ? { ...p, isVideoEnabled: !isVideoEnabled } : p
        ));
        toast.success(`Participant video ${!isVideoEnabled ? 'enabled' : 'disabled'}`);
      }
    } catch (error) {
      console.error('Error toggling participant video:', error);
      toast.error('Failed to toggle participant video');
    }
  };

  const cleanup = () => {
    // Clear stored remote streams
    if (window.remoteStreams) {
      window.remoteStreams = new Map();
    }
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (peerConnectionsRef.current) {
      peerConnectionsRef.current.forEach(peerConnection => {
        peerConnection.close();
      });
      peerConnectionsRef.current.clear();
    }
    
    // Clear processed answers tracking
    processedAnswersRef.current.clear();
    
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
  };

  const formatDuration = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Process queued ICE candidates - following WebRTCCall pattern
  const processQueuedIceCandidates = async () => {
    if (iceCandidateQueueRef.current.length > 0) {
      console.log('🧊 Processing queued ICE candidates:', iceCandidateQueueRef.current.length);
      peerConnectionsRef.current.forEach(async (peerConnection, targetUserId) => {
        const remoteDescription = peerConnection.remoteDescription;
        if (remoteDescription) {
          for (const candidate of iceCandidateQueueRef.current) {
            try {
              await peerConnection.addIceCandidate(candidate);
              console.log('🧊 Queued ICE candidate added successfully for:', targetUserId);
            } catch (error) {
              console.error('🧊 Failed to add queued ICE candidate for:', targetUserId, error);
            }
          }
        }
      });
      iceCandidateQueueRef.current = [];
      console.log('🧊 All queued ICE candidates processed');
    }
  };

  const sendQueuedIceCandidates = (targetUserId) => {
    // Send candidates for the specific user
    const queuedCandidates = queuedIceCandidatesRef.current.get(targetUserId);
    if (queuedCandidates && queuedCandidates.length > 0 && socket && callData) {
      console.log(`🚀 Sending ${queuedCandidates.length} queued ICE candidates for ${targetUserId}`);
      queuedCandidates.forEach(candidate => {
        const iceCandidateData = {
          callId: callData.callId,
          groupId: callData.groupId,
          targetUserId: targetUserId,
          candidate: candidate.candidate,
          sdpMLineIndex: candidate.sdpMLineIndex,
          sdpMid: candidate.sdpMid,
        };
        socket.emit('group-call-ice-candidate', iceCandidateData);
      });
      // Clear the queued candidates for this user
      queuedIceCandidatesRef.current.delete(targetUserId);
    }
    
    // Also send any 'unknown' candidates to this user (candidates generated before we had target users)
    const unknownCandidates = queuedIceCandidatesRef.current.get('unknown');
    if (unknownCandidates && unknownCandidates.length > 0 && socket && callData) {
      console.log(`🚀 Sending ${unknownCandidates.length} 'unknown' queued ICE candidates to ${targetUserId}`);
      unknownCandidates.forEach(candidate => {
        const iceCandidateData = {
          callId: callData.callId,
          groupId: callData.groupId,
          targetUserId: targetUserId,
          candidate: candidate.candidate,
          sdpMLineIndex: candidate.sdpMLineIndex,
          sdpMid: candidate.sdpMid,
        };
        socket.emit('group-call-ice-candidate', iceCandidateData);
      });
    }
  };

  // Process queued ICE candidates when peer connection is ready
  const processQueuedIceCandidatesForUser = async (targetUserId) => {
    const peerConnection = peerConnectionsRef.current.get(targetUserId);
    if (!peerConnection) {
      console.warn('⚠️ No peer connection found to process queued candidates for:', targetUserId);
      return;
    }

    const queuedCandidates = queuedIceCandidatesRef.current.get(targetUserId);
    if (!queuedCandidates || queuedCandidates.length === 0) {
      console.log('📝 No queued ICE candidates to process for:', targetUserId);
      return;
    }

    console.log(`🧊 Processing ${queuedCandidates.length} queued ICE candidates for ${targetUserId}`);
    
    for (const candidate of queuedCandidates) {
      try {
        await peerConnection.addIceCandidate({
          candidate: candidate.candidate,
          sdpMLineIndex: candidate.sdpMLineIndex,
          sdpMid: candidate.sdpMid,
        });
        console.log('✅ Queued ICE candidate added for:', targetUserId);
      } catch (error) {
        console.error('❌ Failed to add queued ICE candidate for:', targetUserId, error);
      }
    }
    
    // Clear the processed candidates
    queuedIceCandidatesRef.current.delete(targetUserId);
    console.log(`🧊 Finished processing queued ICE candidates for ${targetUserId}`);
  };


  // Drag and drop functionality
  const handleMouseDown = (e) => {
    if (e.target.closest('.call-controls')) return;
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
    
    const maxX = window.innerWidth - 400;
    const maxY = window.innerHeight - 300;
    
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

  // Effect to ensure audio elements are properly set up
  useEffect(() => {
    if (localStreamRef.current && localAudioRef.current) {
      localAudioRef.current.srcObject = localStreamRef.current;
      localAudioRef.current.muted = true; // Prevent echo
      localAudioRef.current.play().catch(() => {});
    }
  }, [localStreamRef.current, localAudioRef.current]);

  if (error) {
    return (
      <div
        className="fixed bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-2xl border border-gray-700 p-6 z-50 transition-all duration-300"
        style={{
          left: position.x,
          top: position.y,
          width: '400px',
          height: '300px'
        }}
      >
        <div className="text-center">
          <div className="text-4xl mb-3">❌</div>
          <h3 className="text-lg font-semibold text-white mb-2">Group Call Error</h3>
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
          width: '320px',
          height: '80px'
        }}
      >
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200">
              {callData?.group?.avatar ? (
                <img 
                  src={callData.group.avatar} 
                  alt={callData.group.name} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-blue-500 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">G</span>
                </div>
              )}
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">
                {callData?.group?.name || 'Group Call'}
              </h3>
              <p className="text-xs text-gray-300">
                {callStatus === 'connected' ? `${participants.length + 1} participants` : 'Group call...'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
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
        width: '500px',
        height: '600px'
      }}
    >
      {/* Header */}
      <div className="bg-black bg-opacity-20 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200">
            {callData?.group?.avatar ? (
              <img 
                src={callData.group.avatar} 
                alt={callData.group.name} 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-blue-500 flex items-center justify-center">
                <span className="text-white font-bold">G</span>
              </div>
            )}
          </div>
          <div>
            <h3 className="font-semibold text-white text-sm">
              {callData?.group?.name || 'Group Call'}
            </h3>
            <p className="text-xs text-gray-300">
              {callStatus === 'incoming' && 'Incoming group call...'}
              {callStatus === 'outgoing' && 'Joining group call...'}
              {callStatus === 'ringing' && 'Ringing...'}
              {callStatus === 'connected' && `Connected - ${formatDuration(callDuration)}`}
              {callStatus === 'declined' && 'Call declined'}
              {callStatus === 'ended' && 'Call ended'}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
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

      {/* Audio Elements - following WebRTCAudioCall pattern */}
      <audio ref={localAudioRef} muted autoPlay style={{ display: 'none' }} />
      
      {/* Video Container */}
      <div className="relative h-80 bg-black">
        {isVideoEnabled ? (
          <>
            {/* Local Video */}
            <div className="absolute bottom-3 right-3 w-24 h-20 bg-gray-800 rounded-lg overflow-hidden border-2 border-white">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            </div>
            
            {/* Remote Videos Grid */}
            <div className="grid grid-cols-2 gap-2 p-2 h-full">
              {participants.map((participant, index) => (
                <div key={participant.id} className="bg-gray-800 rounded-lg overflow-hidden">
                  {participant.stream ? (
                    <>
                      {callData.callType === 'video' ? (
                        <video
                          autoPlay
                          playsInline
                          className="w-full h-full object-cover"
                          ref={(video) => {
                            if (video && participant.stream) {
                              video.srcObject = participant.stream;
                            }
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center relative">
                          <audio
                            autoPlay
                            playsInline
                             ref={(audio) => {
                               if (audio && participant.stream) {
                                 audio.srcObject = participant.stream;
                                 audio.volume = 1.0;
                                 audio.muted = false;
                               }
                             }}
                            style={{ display: 'none' }}
                          />
                          <div className="text-center">
                            <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center mb-2">
                              <span className="text-white text-xl font-semibold">
                                {participant.name?.charAt(0)?.toUpperCase() || 'U'}
                              </span>
                            </div>
                            <p className="text-white text-sm font-medium">{participant.name}</p>
                            <div className="flex items-center justify-center mt-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                              <span className="text-green-400 text-xs ml-1">Speaking</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-12 h-12 rounded-full bg-gray-600 flex items-center justify-center mb-2">
                          <span className="text-white text-lg">
                            {participant.name?.charAt(0)?.toUpperCase() || 'U'}
                          </span>
                        </div>
                        <p className="text-white text-xs">{participant.name}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col">
            {/* Audio Call Header */}
            <div className="flex items-center justify-center py-4 border-b border-gray-700">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center mb-2 mx-auto">
                  <span className="text-2xl text-white">G</span>
                </div>
                <p className="text-white text-sm font-medium">Group Audio Call</p>
                <p className="text-gray-300 text-xs mt-1">
                  {participants.length + 1} participant{(participants.length + 1) !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            
            {/* Participants List */}
            <div className="flex-1 p-4 overflow-y-auto">
              <div className="space-y-3">
                {/* Local User */}
                <div className="flex items-center space-x-3 p-3 bg-gray-800 rounded-lg">
                  {/* Hidden audio element for local user - removed to prevent echo */}
                  
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    isMuted ? 'bg-red-600' : 'bg-green-600'
                  }`}>
                    <span className="text-white text-sm font-semibold">
                      {user.name?.charAt(0)?.toUpperCase() || 'U'}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium">{user.name} (You)</p>
                    <div className="flex items-center">
                      <div className={`w-2 h-2 rounded-full ${
                        isMuted ? 'bg-red-500' : 'bg-green-500 animate-pulse'
                      }`}></div>
                      <span className={`text-xs ml-1 ${
                        isMuted ? 'text-red-400' : 'text-green-400'
                      }`}>
                        {isMuted ? 'Muted' : 'Speaking'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-300 text-xs">Host</p>
                    {isMuted && (
                      <div className="w-2 h-2 bg-red-500 rounded-full mt-1"></div>
                    )}
                  </div>
                </div>
                
                {/* Remote Participants */}
                {participants.map((participant, index) => (
                  <div key={participant.id} className="flex items-center space-x-3 p-3 bg-gray-800 rounded-lg">
                    {/* Audio element for remote participant */}
                    {participant.stream && (
                      <audio
                        autoPlay
                        playsInline
                         ref={(audio) => {
                           if (audio && participant.stream) {
                             audio.srcObject = participant.stream;
                             audio.volume = 1.0;
                             audio.muted = false;
                           }
                         }}
                        style={{ display: 'none' }}
                      />
                    )}
                    
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      participant.stream ? 'bg-blue-600' : 'bg-gray-600'
                    }`}>
                      <span className="text-white text-sm font-semibold">
                        {participant.name?.charAt(0)?.toUpperCase() || 'U'}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="text-white text-sm font-medium">{participant.name}</p>
                      <div className="flex items-center">
                        <div className={`w-2 h-2 rounded-full ${
                          participant.stream 
                            ? 'bg-green-500 animate-pulse' 
                            : 'bg-yellow-500'
                        }`}></div>
                        <span className={`text-xs ml-1 ${
                          participant.stream 
                            ? 'text-green-400' 
                            : 'text-yellow-400'
                        }`}>
                          {participant.stream ? 'Speaking' : 'Connecting...'}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-300 text-xs">Participant</p>
                      {participant.stream && (
                        <div className="w-2 h-2 bg-green-500 rounded-full mt-1 animate-pulse"></div>
                      )}
                    </div>
                  </div>
                ))}
                
                {participants.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-gray-400 text-sm">Waiting for other participants...</p>
                  </div>
                )}
              </div>
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
        
        {/* Audio Quality Indicator */}
        {callStatus === 'connected' && !isVideoEnabled && (
          <div className="mt-4 text-center">
            <div className="flex items-center justify-center gap-1 mb-2">
              <div className="w-1 h-2 bg-green-400 rounded"></div>
              <div className="w-1 h-3 bg-green-400 rounded"></div>
              <div className="w-1 h-4 bg-green-400 rounded"></div>
              <div className="w-1 h-3 bg-green-400 rounded"></div>
              <div className="w-1 h-2 bg-green-400 rounded"></div>
            </div>
            <span className="text-xs text-gray-300">Good audio quality</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupCallUI;
