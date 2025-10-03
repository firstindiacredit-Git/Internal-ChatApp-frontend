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
    <div className="webrtc-call-container">
      <div className="video-container">
        {isVideoEnabled ? (
          <>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="remote-video"
            />
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="local-video"
            />
          </>
        ) : (
          <div className="audio-only-indicator">
            <p>Audio Only Call</p>
          </div>
        )}
      </div>

      <div className="call-info-overlay">
        <div className="call-user-info">
          <div className="call-avatar">
            {(callData?.otherUser?.avatar || callData?.receiver?.avatar || callData?.caller?.avatar) ? (
              <img src={callData.otherUser?.avatar || callData.receiver?.avatar || callData.caller?.avatar} alt={callData.otherUser?.name || callData.receiver?.name || callData.caller?.name} />
            ) : (
              <div className="default-avatar-large">
                {(callData?.otherUser?.name || callData?.receiver?.name || callData?.caller?.name)?.charAt(0)?.toUpperCase() || 'U'}
              </div>
            )}
          </div>
          <h2>{callData?.otherUser?.name || callData?.receiver?.name || callData?.caller?.name || 'Unknown'}</h2>
          <p className="call-status-text">
            {callStatus === 'incoming' && 'Incoming call...'}
            {callStatus === 'outgoing' && 'Calling...'}
            {callStatus === 'ringing' && 'Ringing...'}
            {callStatus === 'connected' && `Connected - ${formatDuration(callDuration)}`}
            {callStatus === 'declined' && 'Call declined'}
            {callStatus === 'ended' && 'Call ended'}
          </p>
        </div>
      </div>

      <div className="call-controls">
        {callStatus === 'incoming' && (
          <>
            <button 
              className="call-control-btn decline-btn"
              onClick={handleCallDecline}
            >
              📞❌
            </button>
            <button 
              className="call-control-btn answer-btn"
              onClick={handleCallAnswer}
            >
              📞✅
            </button>
          </>
        )}

        {callStatus === 'connected' && (
          <>
            <button 
              className={`call-control-btn ${isMuted ? 'muted' : ''}`}
              onClick={toggleMute}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? '🔇' : '🎤'}
            </button>
            {callData?.callType === 'video' && (
              <button 
                className={`call-control-btn ${!isVideoEnabled ? 'video-disabled' : ''}`}
                onClick={toggleVideo}
                title={isVideoEnabled ? 'Disable Video' : 'Enable Video'}
              >
                {isVideoEnabled ? '📹' : '📹❌'}
              </button>
            )}
            <button 
              className="call-control-btn end-btn"
              onClick={handleCallEnd}
              title="End Call"
            >
              📞❌
            </button>
          </>
        )}

        {(callStatus === 'outgoing' || callStatus === 'ringing') && (
          <button 
            className="call-control-btn end-btn"
            onClick={handleCallEnd}
            title="Cancel Call"
          >
            📞❌
          </button>
        )}
      </div>
    </div>
  );
};

export default WebRTCCall;


