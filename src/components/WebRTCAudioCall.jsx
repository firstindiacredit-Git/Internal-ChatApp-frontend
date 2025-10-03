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
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = event.streams[0];
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
          await peerConnectionRef.current.setRemoteDescription(data.offer);
          const answer = await peerConnectionRef.current.createAnswer();
          await peerConnectionRef.current.setLocalDescription(answer);
          socket.emit('call-answer-webrtc', {
            callId: callData.callId,
            answer: answer,
          });
        } catch (error) {
          setError('Failed to establish connection');
        }
      }
    };

    const handleCallAnswerWebRTC = async (data) => {
      if (data.callId === callData.callId) {
        try {
          await peerConnectionRef.current.setRemoteDescription(data.answer);
        } catch (error) {
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
      <div className="fixed inset-0 bg-black bg-opacity-90 flex flex-col items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full mx-4 text-center shadow-2xl">
          <div className="mb-6">
            {callData?.caller?.avatar ? (
              <img 
                src={callData.caller.avatar} 
                alt={callData.caller.name}
                className="w-24 h-24 rounded-full mx-auto object-cover"
              />
            ) : (
              <div className="w-24 h-24 rounded-full mx-auto bg-green-500 text-white flex items-center justify-center text-2xl font-bold">
                {callData?.caller?.name?.charAt(0) || 'U'}
              </div>
            )}
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {callData?.caller?.name || 'Unknown'}
          </h2>
          <p className="text-gray-600 mb-8">📞 Incoming voice call...</p>
          <div className="flex justify-center gap-6">
            <button 
              onClick={handleDecline}
              className="w-16 h-16 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-2xl transition-colors shadow-lg"
            >
              📞❌
            </button>
            <button 
              onClick={handleAnswer}
              className="w-16 h-16 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center justify-center text-2xl transition-colors shadow-lg"
            >
              📞✅
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full mx-4 text-center">
          <div className="text-6xl mb-4">❌</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Call Error</h3>
          <p className="text-gray-600 mb-6">{error}</p>
          <button 
            onClick={handleCallEnd}
            className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-green-400 to-green-600 flex flex-col items-center justify-center z-50 text-white">
      <audio ref={localAudioRef} muted autoPlay />
      <audio ref={remoteAudioRef} autoPlay />
      <div className="text-center mb-8">
        <h2 className="text-sm text-green-100 mb-2">
          {callStatus === 'connecting' ? 'Connecting...' : 
           callStatus === 'connected' ? 'Voice Call' : 
           callStatus === 'outgoing' ? 'Calling...' : 'Call'}
        </h2>
        <h1 className="text-2xl font-semibold">
          {callData?.otherUser?.name || callData?.caller?.name || 'Unknown'}
        </h1>
        {callStatus === 'connected' && (
          <p className="text-green-100 mt-2">
            {formatDuration(callDuration)}
          </p>
        )}
      </div>
      <div className="mb-12">
        {(callData?.otherUser?.avatar || callData?.caller?.avatar) ? (
          <img 
            src={callData?.otherUser?.avatar || callData?.caller?.avatar}
            alt={callData?.otherUser?.name || callData?.caller?.name}
            className="w-32 h-32 rounded-full object-cover shadow-2xl"
          />
        ) : (
          <div className="w-32 h-32 rounded-full bg-white bg-opacity-20 flex items-center justify-center text-4xl font-bold shadow-2xl">
            {(callData?.otherUser?.name || callData?.caller?.name)?.charAt(0) || 'U'}
          </div>
        )}
      </div>
      <div className="mb-8 text-center">
        {callStatus === 'outgoing' && (
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <span className="text-green-100">Calling...</span>
          </div>
        )}
        {callStatus === 'connecting' && (
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-white rounded-full animate-bounce"></div>
            <span className="text-green-100">Connecting...</span>
          </div>
        )}
        {callStatus === 'connected' && (
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-green-300 rounded-full"></div>
            <span className="text-green-100">Connected</span>
          </div>
        )}
      </div>
      <div className="flex gap-6">
        {callStatus === 'connected' && (
          <button
            onClick={toggleMute}
            className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl transition-all shadow-lg ${
              isMuted 
                ? 'bg-red-500 hover:bg-red-600' 
                : 'bg-white bg-opacity-20 hover:bg-opacity-30'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? '🔇' : '🎤'}
          </button>
        )}
        <button 
          onClick={handleCallEnd}
          className="w-16 h-16 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-2xl transition-colors shadow-lg"
          title="End Call"
        >
          📞❌
        </button>
      </div>
      {callStatus === 'connected' && (
        <div className="mt-8 text-center">
          <div className="flex items-center justify-center gap-1">
            <div className="w-1 h-2 bg-green-300 rounded"></div>
            <div className="w-1 h-3 bg-green-300 rounded"></div>
            <div className="w-1 h-4 bg-green-300 rounded"></div>
            <div className="w-1 h-3 bg-green-300 rounded"></div>
            <div className="w-1 h-2 bg-green-300 rounded"></div>
          </div>
          <span className="text-xs text-green-100 mt-1 block">Good quality</span>
        </div>
      )}
    </div>
  );
};

export default WebRTCAudioCall;


