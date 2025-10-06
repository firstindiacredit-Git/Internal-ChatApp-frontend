/**
 * Professional WebRTC Manager for Group Calls
 * Handles all WebRTC operations for group voice calls
 */

class GroupCallWebRTC {
  constructor() {
    this.peerConnections = new Map();
    this.localStream = null;
    this.remoteStreams = new Map();
    this.iceCandidateQueue = new Map();
    this.isInitialized = false;

    // Configuration
    this.rtcConfiguration = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    };
  }

  /**
   * Initialize WebRTC with local media stream
   */
  async initialize(isIncoming = false) {
    try {
      if (this.isInitialized) {
        console.log("🎤 WebRTC already initialized");
        return true;
      }

      // Get local media stream
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
        },
        video: false,
      });

      // Configure local audio tracks
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !isIncoming; // Disable for incoming calls until accepted
      });

      this.isInitialized = true;
      console.log("🎤 WebRTC initialized successfully");
      return true;
    } catch (error) {
      console.error("🎤 Failed to initialize WebRTC:", error);
      throw new Error("Failed to access microphone. Please check permissions.");
    }
  }

  /**
   * Create peer connection for a participant
   */
  createPeerConnection(participantId, onTrack, onConnectionStateChange) {
    try {
      const peerConnection = new RTCPeerConnection(this.rtcConfiguration);

      // Add local stream tracks
      if (this.localStream) {
        this.localStream.getTracks().forEach((track) => {
          peerConnection.addTrack(track, this.localStream);
        });
      }

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          // Emit ICE candidate to other participants
          this.onIceCandidate?.(participantId, event.candidate);
        }
      };

      // Handle remote tracks
      peerConnection.ontrack = (event) => {
        console.log("🎤 Remote track received from:", participantId);

        if (event.streams && event.streams[0]) {
          const remoteStream = event.streams[0];
          this.remoteStreams.set(participantId, remoteStream);

          // Call the provided callback
          onTrack?.(participantId, remoteStream);
        }
      };

      // Handle connection state changes
      peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState;
        console.log("🎤 Connection state changed:", participantId, state);

        onConnectionStateChange?.(participantId, state);

        if (state === "disconnected" || state === "failed") {
          this.closePeerConnection(participantId);
        }
      };

      this.peerConnections.set(participantId, peerConnection);
      console.log("🎤 Peer connection created for:", participantId);

      return peerConnection;
    } catch (error) {
      console.error("🎤 Failed to create peer connection:", error);
      throw error;
    }
  }

  /**
   * Create and send offer to a participant
   */
  async createOffer(participantId) {
    try {
      const peerConnection = this.peerConnections.get(participantId);
      if (!peerConnection) {
        throw new Error("Peer connection not found");
      }

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      console.log("🎤 Offer created for:", participantId);
      return offer;
    } catch (error) {
      console.error("🎤 Failed to create offer:", error);
      throw error;
    }
  }

  /**
   * Handle incoming offer from a participant
   */
  async handleOffer(participantId, offer) {
    try {
      let peerConnection = this.peerConnections.get(participantId);

      if (!peerConnection) {
        // Create new peer connection if it doesn't exist
        peerConnection = this.createPeerConnection(participantId);
      }

      await peerConnection.setRemoteDescription(offer);
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      console.log("🎤 Answer created for:", participantId);
      return answer;
    } catch (error) {
      console.error("🎤 Failed to handle offer:", error);
      throw error;
    }
  }

  /**
   * Handle incoming answer from a participant
   */
  async handleAnswer(participantId, answer) {
    try {
      const peerConnection = this.peerConnections.get(participantId);
      if (!peerConnection) {
        throw new Error("Peer connection not found");
      }

      await peerConnection.setRemoteDescription(answer);

      // Process queued ICE candidates
      this.processQueuedIceCandidates(participantId);

      console.log("🎤 Answer processed for:", participantId);
    } catch (error) {
      console.error("🎤 Failed to handle answer:", error);
      throw error;
    }
  }

  /**
   * Add ICE candidate
   */
  async addIceCandidate(participantId, candidate) {
    try {
      const peerConnection = this.peerConnections.get(participantId);

      if (!peerConnection) {
        // Queue the candidate for later processing
        if (!this.iceCandidateQueue.has(participantId)) {
          this.iceCandidateQueue.set(participantId, []);
        }
        this.iceCandidateQueue.get(participantId).push(candidate);
        console.log("🎤 ICE candidate queued for:", participantId);
        return;
      }

      const remoteDescription = peerConnection.remoteDescription;
      if (!remoteDescription) {
        // Queue the candidate for later processing
        if (!this.iceCandidateQueue.has(participantId)) {
          this.iceCandidateQueue.set(participantId, []);
        }
        this.iceCandidateQueue.get(participantId).push(candidate);
        console.log("🎤 ICE candidate queued for:", participantId);
        return;
      }

      await peerConnection.addIceCandidate(candidate);
      console.log("🎤 ICE candidate added for:", participantId);
    } catch (error) {
      console.error("🎤 Failed to add ICE candidate:", error);
      throw error;
    }
  }

  /**
   * Process queued ICE candidates
   */
  async processQueuedIceCandidates(participantId) {
    const queuedCandidates = this.iceCandidateQueue.get(participantId);
    if (!queuedCandidates || queuedCandidates.length === 0) {
      return;
    }

    const peerConnection = this.peerConnections.get(participantId);
    if (!peerConnection) {
      return;
    }

    try {
      for (const candidate of queuedCandidates) {
        await peerConnection.addIceCandidate(candidate);
      }

      this.iceCandidateQueue.delete(participantId);
      console.log("🎤 Queued ICE candidates processed for:", participantId);
    } catch (error) {
      console.error("🎤 Failed to process queued ICE candidates:", error);
    }
  }

  /**
   * Enable audio for all participants
   */
  enableAudio() {
    // Enable local audio tracks
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = true;
      });
    }

    // Enable remote audio tracks
    this.remoteStreams.forEach((stream, participantId) => {
      stream.getAudioTracks().forEach((track) => {
        track.enabled = true;
      });
    });

    console.log("🎤 Audio enabled for all participants");
  }

  /**
   * Disable audio for all participants
   */
  disableAudio() {
    // Disable local audio tracks
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
    }

    // Disable remote audio tracks
    this.remoteStreams.forEach((stream, participantId) => {
      stream.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
    });

    console.log("🎤 Audio disabled for all participants");
  }

  /**
   * Toggle mute for local audio
   */
  toggleMute(isMuted) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !isMuted;
      });
    }
    console.log("🎤 Local audio muted:", isMuted);
  }

  /**
   * Close peer connection for a participant
   */
  closePeerConnection(participantId) {
    const peerConnection = this.peerConnections.get(participantId);
    if (peerConnection) {
      peerConnection.close();
      this.peerConnections.delete(participantId);
      this.remoteStreams.delete(participantId);
      this.iceCandidateQueue.delete(participantId);
      console.log("🎤 Peer connection closed for:", participantId);
    }
  }

  /**
   * Close all peer connections and cleanup
   */
  cleanup() {
    // Close all peer connections
    this.peerConnections.forEach((peerConnection, participantId) => {
      this.closePeerConnection(participantId);
    });

    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    // Clear all maps
    this.peerConnections.clear();
    this.remoteStreams.clear();
    this.iceCandidateQueue.clear();
    this.isInitialized = false;

    console.log("🎤 WebRTC cleanup completed");
  }

  /**
   * Get local stream
   */
  getLocalStream() {
    return this.localStream;
  }

  /**
   * Get remote stream for a participant
   */
  getRemoteStream(participantId) {
    return this.remoteStreams.get(participantId);
  }

  /**
   * Get all remote streams
   */
  getAllRemoteStreams() {
    return this.remoteStreams;
  }

  /**
   * Check if WebRTC is initialized
   */
  isReady() {
    return this.isInitialized && this.localStream !== null;
  }

  /**
   * Get connection state for a participant
   */
  getConnectionState(participantId) {
    const peerConnection = this.peerConnections.get(participantId);
    return peerConnection ? peerConnection.connectionState : "disconnected";
  }

  /**
   * Get all connection states
   */
  getAllConnectionStates() {
    const states = new Map();
    this.peerConnections.forEach((peerConnection, participantId) => {
      states.set(participantId, peerConnection.connectionState);
    });
    return states;
  }
}

export default GroupCallWebRTC;

