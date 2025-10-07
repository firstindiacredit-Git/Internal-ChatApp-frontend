import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../contexts/SocketProvider';

const WebRTCCall = ({ 
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

  // Build RTC configuration with optional TURN support via env variables
  const buildRtcConfiguration = () => {
    const iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ];
    const turnUrl = import.meta?.env?.VITE_TURN_URL;
    const turnUsername = import.meta?.env?.VITE_TURN_USERNAME;
    const turnCredential = import.meta?.env?.VITE_TURN_CREDENTIAL;
    if (turnUrl && turnUsername && turnCredential) {
      iceServers.push({ urls: turnUrl, username: turnUsername, credential: turnCredential });
    }
    return { iceServers };
  };

  const rtcConfiguration = buildRtcConfiguration();

  useEffect(() => {
    console.log('WebRTCCall useEffect - callData:', callData, 'isIncoming:', isIncoming);
    if (callData && callData.callId && isConnected && !webrtcInitializedRef.current) {
      initializeWebRTC();
    }
    return () => {
      cleanup();
    };
  }, [callData?.callId, isConnected]);

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

  // Restore remote video if component remounts or video ref becomes available
  useEffect(() => {
    if (window.remoteStream && remoteVideoRef.current && isVideoEnabled) {
      console.log('🎥 Restoring remote video stream after remount');
      remoteVideoRef.current.srcObject = window.remoteStream;
      remoteVideoRef.current.play().catch((error) => {
        if (error.name !== 'AbortError') {
          console.error('🎥 Error playing restored remote video:', error);
        }
      });
    }
  }, [isVideoEnabled, remoteVideoRef.current]);

  // Check for stored remote stream when video ref becomes available
  useEffect(() => {
    if (window.remoteStream && remoteVideoRef.current && !remoteVideoRef.current.srcObject) {
      console.log('🎥 Video ref available, attaching stored remote stream');
      remoteVideoRef.current.srcObject = window.remoteStream;
      remoteVideoRef.current.play().catch((error) => {
        if (error.name !== 'AbortError') {
          console.error('🎥 Error playing stored remote video:', error);
        }
      });
    }
  }, [remoteVideoRef.current]);

  const initializeWebRTC = async () => {
    try {
      // Check if WebRTC is supported
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
        console.log('🎥 Remote track received:', event);
        console.log('🎥 Event streams:', event.streams);
        console.log('🎥 Remote video ref:', remoteVideoRef.current);
        console.log('🎥 isVideoEnabled:', isVideoEnabled);
        
        if (event.streams && event.streams[0]) {
          const remoteStream = event.streams[0];
          console.log('🎥 Setting remote video stream:', remoteStream);
          console.log('🎥 Stream tracks:', remoteStream.getTracks());
          
          // Store the remote stream for later use
          if (!window.remoteStream) {
            window.remoteStream = remoteStream;
          }
          
          // If video ref is not available yet, wait for it
          if (!remoteVideoRef.current) {
            console.log('🎥 Remote video ref not available, waiting...');
            const checkVideoRef = () => {
              if (remoteVideoRef.current) {
                console.log('🎥 Remote video ref now available, setting stream');
                attachRemoteStream(remoteStream);
              } else {
                setTimeout(checkVideoRef, 100);
              }
            };
            checkVideoRef();
          } else {
            attachRemoteStream(remoteStream);
          }
        } else {
          console.error('🎥 No remote video ref or stream available');
        }
      };
      
      // Helper function to attach remote stream
      const attachRemoteStream = (remoteStream) => {
        if (!remoteVideoRef.current) {
          console.error('🎥 Cannot attach stream: remote video ref not available');
          return;
        }
        
        console.log('🎥 Attaching remote stream to video element');
        
        // Wait for video element to be ready
        const playRemoteVideo = async () => {
          try {
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = remoteStream;
              console.log('🎥 Set srcObject on remote video element');
              
              // Wait for video to be ready
              if (remoteVideoRef.current.readyState >= 2) {
                await remoteVideoRef.current.play();
                console.log('🎥 Remote video playing successfully');
              } else {
                // Wait for video to be ready
                remoteVideoRef.current.addEventListener('loadeddata', async () => {
                  try {
        if (remoteVideoRef.current) {
                      await remoteVideoRef.current.play();
                      console.log('🎥 Remote video playing after load');
                    }
                  } catch (error) {
                    if (error.name !== 'AbortError') {
                      console.error('🎥 Error playing remote video after load:', error);
                    }
                  }
                }, { once: true });
              }
            }
          } catch (error) {
            if (error.name !== 'AbortError') {
              console.error('🎥 Error playing remote video:', error);
            }
          }
        };
        
        playRemoteVideo();
        
        // Enable all tracks
        remoteStream.getAudioTracks().forEach(track => { 
          track.enabled = true; 
          console.log('🎥 Remote audio track enabled:', track);
        });
        remoteStream.getVideoTracks().forEach(track => { 
          track.enabled = true; 
          console.log('🎥 Remote video track enabled:', track);
        });
        
        if (remoteVideoRef.current && remoteVideoRef.current.volume !== undefined) {
          remoteVideoRef.current.volume = 1.0;
        }
        
        // Force video to be visible
        setIsVideoEnabled(true);
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
        console.log('🔗 Connection state changed:', state);
        if (state === 'connected') {
          console.log('✅ WebRTC connection established');
          setCallStatus('connected');
          callStartTimeRef.current = Date.now();
        } else if (state === 'disconnected' || state === 'failed') {
          console.log('❌ WebRTC connection failed:', state);
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

    console.log('Setting up socket listeners for call:', callData.callId, 'isIncoming:', isIncoming);
    
    // Only set up listeners once per call
    if (webrtcInitializedRef.current) {
      console.log('Socket listeners already set up, skipping...');
      return;
    }

    socket.off('call-answered');
    socket.off('call-declined');
    socket.off('call-ended');
    socket.off('call-error');
    socket.off('call-offer');
    socket.off('ice-candidate');

    socket.on('call-answered', async (data) => {
      console.log('📞 Call answered received:', data);
      if (data.callId === callData.callId) {
        if (processedCallIdRef.current === data.callId) return;
        try {
          if (data.answer && peerConnectionRef.current) {
            const parsedAnswer = typeof data.answer === 'string' ? JSON.parse(data.answer) : data.answer;
            const currentState = peerConnectionRef.current.signalingState;
            console.log('📞 Processing answer, current state:', currentState);
            if (currentState === 'have-local-offer' && !answerProcessedRef.current) {
              await peerConnectionRef.current.setRemoteDescription(parsedAnswer);
              console.log('📞 Set remote description, new state:', peerConnectionRef.current.signalingState);
              answerProcessedRef.current = true;
              processedCallIdRef.current = data.callId;
              // Process any queued ICE candidates after setting remote description
              setTimeout(() => {
                processQueuedIceCandidates();
              }, 100);
            }
          }
          setCallStatus('connected');
          callStartTimeRef.current = Date.now();
        } catch (error) {
          console.error('📞 Failed to handle call answer:', error);
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
      console.log('🧊 ICE candidate received:', data);
      if (data.callId === callData.callId && peerConnectionRef.current) {
        try {
          const currentState = peerConnectionRef.current.signalingState;
          const remoteDescription = peerConnectionRef.current.remoteDescription;
          console.log('🧊 Current signaling state:', currentState);
          console.log('🧊 Remote description:', remoteDescription ? 'set' : 'null');
          
          // Only add ICE candidates if remote description is set
          if (remoteDescription && (currentState === 'stable' || currentState === 'have-local-offer' || currentState === 'have-remote-offer')) {
            await peerConnectionRef.current.addIceCandidate({
              candidate: data.candidate,
              sdpMLineIndex: data.sdpMLineIndex,
              sdpMid: data.sdpMid,
            });
            console.log('🧊 ICE candidate added successfully');
          } else {
            console.log('🧊 Queuing ICE candidate for later (remote description not set)');
            iceCandidateQueueRef.current.push({
              candidate: data.candidate,
              sdpMLineIndex: data.sdpMLineIndex,
              sdpMid: data.sdpMid,
            });
          }
        } catch (error) {
          console.error('🧊 Failed to add ICE candidate:', error);
          // Queue the candidate for later processing
          console.log('🧊 Queuing failed ICE candidate for later');
          iceCandidateQueueRef.current.push({
            candidate: data.candidate,
            sdpMLineIndex: data.sdpMLineIndex,
            sdpMid: data.sdpMid,
          });
        }
      }
    });

    socket.on('call-error', (data) => {
      setError(data.error);
    });

    socket.on('call-offer', async (data) => {
      console.log('Received call-offer event:', data);
      if (data.callId === callData.callId && isIncoming) {
        try {
          const offer = typeof data.offer === 'string' ? JSON.parse(data.offer) : data.offer;
          console.log('Parsed offer:', offer);
          
          // Ensure WebRTC is initialized for incoming calls
          if (!peerConnectionRef.current && !webrtcInitializedRef.current) {
            console.log('Peer connection not ready, initializing WebRTC...');
            await initializeWebRTC();
          }
          
          if (peerConnectionRef.current) {
            const currentState = peerConnectionRef.current.signalingState;
            console.log('Received offer, current state:', currentState);
            if (currentState === 'stable') {
              await peerConnectionRef.current.setRemoteDescription(offer);
              console.log('Set remote description, new state:', peerConnectionRef.current.signalingState);
              // Process any queued ICE candidates after setting remote description
              setTimeout(() => {
                processQueuedIceCandidates();
              }, 100);
            } else {
              console.log('Cannot set remote description in state:', currentState);
            }
          } else {
            console.error('Peer connection not available when handling offer');
          }
        } catch (error) {
          console.error('Failed to handle call offer:', error);
          setError('Failed to handle call offer');
        }
      }
    });
  };

  const processQueuedIceCandidates = async () => {
    if (iceCandidateQueueRef.current.length > 0 && peerConnectionRef.current) {
      console.log('🧊 Processing queued ICE candidates:', iceCandidateQueueRef.current.length);
      const remoteDescription = peerConnectionRef.current.remoteDescription;
      
      if (remoteDescription) {
        for (const candidate of iceCandidateQueueRef.current) {
          try {
            await peerConnectionRef.current.addIceCandidate(candidate);
            console.log('🧊 Queued ICE candidate added successfully');
          } catch (error) {
            console.error('🧊 Failed to add queued ICE candidate:', error);
          }
        }
        iceCandidateQueueRef.current = [];
        console.log('🧊 All queued ICE candidates processed');
      } else {
        console.log('🧊 Cannot process queued ICE candidates: remote description not set');
      }
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
      console.log('Sending call-offer with offer:', offer);
      socket.emit('call-offer', {
        callId: callData.callId,
        offer: offer,
      });
      console.log('Call-offer sent for call:', callData.callId);
      setCallStatus('ringing');
    } catch (error) {
      setError(`Failed to create call offer: ${error.message}`);
    }
  };

  const handleCallAnswer = async () => {
    try {
      if (peerConnectionRef.current) {
        const currentState = peerConnectionRef.current.signalingState;
        console.log('Answering call, current state:', currentState);
        
        if (currentState === 'have-remote-offer') {
          // Normal flow - offer already set
          const answer = await peerConnectionRef.current.createAnswer();
          await peerConnectionRef.current.setLocalDescription(answer);
          socket.emit('call-answer', {
            callId: callData.callId,
            answer: answer,
          });
          setCallStatus('connected');
          callStartTimeRef.current = Date.now();
          onCallAnswer && onCallAnswer();
        } else if (currentState === 'stable') {
          // Offer not set yet, this shouldn't happen if offer was received
          console.log('Offer not set yet, this indicates a timing issue');
          setError('Call offer not processed yet. Please wait a moment and try again.');
        } else {
          console.error('Cannot answer call in state:', currentState);
          setError(`Cannot answer call in current state: ${currentState}`);
        }
      } else {
        setError('Call connection not ready');
      }
    } catch (error) {
      console.error('Failed to answer call:', error);
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
      
      // Ensure remote video is visible when video is enabled
      if (newVideoState && remoteVideoRef.current) {
        console.log('Video enabled, ensuring remote video is visible');
        // Use stored remote stream or current srcObject
        const remoteStream = window.remoteStream || remoteVideoRef.current.srcObject;
        if (remoteStream) {
          remoteVideoRef.current.srcObject = null;
          setTimeout(() => {
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = remoteStream;
              remoteVideoRef.current.play().catch((error) => {
                if (error.name !== 'AbortError') {
                  console.error('Error playing remote video after toggle:', error);
                }
              });
            }
          }, 100);
        }
      }
    }
  };

  const cleanup = () => {
    // Clear stored remote stream
    if (window.remoteStream) {
      window.remoteStream = null;
    }
    
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


  if (error) {
    return (
      <div className="call-error-container">
        <div className="call-error">
          <div className="error-icon">❌</div>
          <h3>Call Error</h3>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={onCallEnd}>
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-2xl border border-gray-700 overflow-hidden w-96">
        {/* Header */}
        <div className="bg-black bg-opacity-20 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200">
              {(callData?.otherUser?.avatar || callData?.receiver?.avatar || callData?.caller?.avatar) ? (
                <img 
                  src={callData.otherUser?.avatar || callData.receiver?.avatar || callData.caller?.avatar} 
                  alt={callData.otherUser?.name || callData.receiver?.name || callData.caller?.name} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-green-500 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">
                {(callData?.otherUser?.name || callData?.receiver?.name || callData?.caller?.name)?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
              </div>
            )}
          </div>
            <div>
              <h3 className="font-semibold text-white text-lg">
                {callData?.otherUser?.name || callData?.receiver?.name || callData?.caller?.name || 'Unknown'}
              </h3>
              <p className="text-sm text-gray-300">
            {callStatus === 'incoming' && 'Incoming call...'}
            {callStatus === 'outgoing' && 'Calling...'}
            {callStatus === 'ringing' && 'Ringing...'}
            {callStatus === 'connected' && `Connected - ${formatDuration(callDuration)}`}
            {callStatus === 'declined' && 'Call declined'}
            {callStatus === 'ended' && 'Call ended'}
          </p>
        </div>
          </div>
        </div>

        {/* Video Container */}
        <div className="relative h-80 bg-black">
          {isVideoEnabled ? (
            <>
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-3 right-3 w-24 h-20 bg-gray-800 rounded-lg overflow-hidden border-2 border-white">
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
                <div className="w-32 h-32 rounded-full bg-gray-700 flex items-center justify-center mb-4">
                  <span className="text-3xl text-white">
                    {(callData?.otherUser?.name || callData?.receiver?.name || callData?.caller?.name)?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                </div>
                <p className="text-white text-sm">Audio Only Call</p>
              </div>
            </div>
          )}
      </div>

        {/* Call Controls */}
        <div className="bg-black bg-opacity-20 p-6">
          <div className="flex justify-center space-x-4">
        {callStatus === 'incoming' && (
          <>
            <button 
                  className="w-16 h-16 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl"
              onClick={handleCallDecline}
              title="Decline"
            >
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <button 
              className="w-16 h-16 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl"
              onClick={handleCallAnswer}
              title="Answer"
            >
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </button>
          </>
        )}

        {callStatus === 'connected' && (
          <>
            <button 
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl ${
                    isMuted 
                      ? 'bg-red-500 hover:bg-red-600 text-white' 
                      : 'bg-white bg-opacity-20 hover:bg-opacity-30 text-white'
                  }`}
              onClick={toggleMute}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
                  {isMuted ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  )}
            </button>
                
            {callData?.callType === 'video' && (
              <button 
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl ${
                      !isVideoEnabled 
                        ? 'bg-red-500 hover:bg-red-600 text-white' 
                        : 'bg-white bg-opacity-20 hover:bg-opacity-30 text-white'
                    }`}
                onClick={toggleVideo}
                title={isVideoEnabled ? 'Disable Video' : 'Enable Video'}
              >
                    {isVideoEnabled ? (
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    ) : (
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                      </svg>
                    )}
              </button>
            )}
                
            <button 
                  className="w-16 h-16 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl"
              onClick={handleCallEnd}
              title="End Call"
            >
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
            </button>
          </>
        )}

        {(callStatus === 'outgoing' || callStatus === 'ringing') && (
          <button 
                className="w-16 h-16 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl"
            onClick={handleCallEnd}
            title="Cancel Call"
          >
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
          </button>
        )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WebRTCCall;


