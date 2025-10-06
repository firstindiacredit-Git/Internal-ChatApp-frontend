import { useState, useRef, useCallback, useEffect } from "react";
import { useSocket } from "../contexts/SocketProvider";
import { groupCallsAPI } from "../services/api";

/**
 * Custom hook for managing group call state and functionality
 * Provides a clean interface for group call operations
 */
export const useGroupCall = (callData, user) => {
  // ==================== STATE ====================
  const [callState, setCallState] = useState({
    status: "idle", // idle, incoming, outgoing, connected, ended, declined
    duration: 0,
    isMuted: false,
    isConnected: false,
    error: null,
  });

  const [participants, setParticipants] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // ==================== REFS ====================
  const callStartTimeRef = useRef(null);
  const durationIntervalRef = useRef(null);
  const participantsRefreshIntervalRef = useRef(null);

  // ==================== SOCKET ====================
  const { socket, isConnected } = useSocket();

  // ==================== UTILITY FUNCTIONS ====================
  const log = useCallback((message, data = null) => {
    console.log(`🎤 [useGroupCall] ${message}`, data || "");
  }, []);

  const logError = useCallback((message, error = null) => {
    console.error(`🎤 [useGroupCall] ${message}`, error || "");
  }, []);

  // ==================== CALL STATE MANAGEMENT ====================
  const updateCallState = useCallback((updates) => {
    setCallState((prev) => ({ ...prev, ...updates }));
  }, []);

  const startCall = useCallback(async () => {
    try {
      if (!callData?.groupId) {
        throw new Error("Group ID is required to start a call");
      }

      setIsLoading(true);
      updateCallState({
        status: "outgoing",
        error: null,
      });

      const response = await groupCallsAPI.create({
        groupId: callData.groupId,
        callType: "audio",
      });

      if (response.data.success) {
        log("Call started successfully", response.data.call);
        return response.data.call;
      } else {
        throw new Error(response.data.message || "Failed to start call");
      }
    } catch (error) {
      logError("Failed to start call", error);
      updateCallState({
        status: "idle",
        error: "Failed to start call",
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [callData?.groupId, updateCallState, log, logError]);

  const answerCall = useCallback(async () => {
    try {
      if (!callData?.callId) {
        throw new Error("Call ID is required to answer a call");
      }

      setIsLoading(true);
      updateCallState({
        status: "connected",
        isConnected: true,
        error: null,
      });

      await groupCallsAPI.join(callData.callId);

      if (socket) {
        socket.emit("group-call-join", {
          callId: callData.callId,
          groupId: callData.groupId,
        });
      }

      callStartTimeRef.current = Date.now();
      log("Call answered successfully");
    } catch (error) {
      logError("Failed to answer call", error);
      updateCallState({
        status: "idle",
        error: "Failed to answer call",
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [
    callData?.callId,
    callData?.groupId,
    socket,
    updateCallState,
    log,
    logError,
  ]);

  const declineCall = useCallback(async () => {
    try {
      updateCallState({ status: "declined" });

      if (socket && callData?.callId) {
        socket.emit("group-call-decline", {
          callId: callData.callId,
          groupId: callData.groupId,
        });
      }

      log("Call declined");
    } catch (error) {
      logError("Failed to decline call", error);
    }
  }, [callData?.callId, socket, updateCallState, log, logError]);

  const endCall = useCallback(async () => {
    try {
      updateCallState({ status: "ended" });

      if (socket && callData?.callId) {
        socket.emit("group-call-leave", {
          callId: callData.callId,
          groupId: callData.groupId,
        });
      }

      // Clear intervals
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
      if (participantsRefreshIntervalRef.current) {
        clearInterval(participantsRefreshIntervalRef.current);
        participantsRefreshIntervalRef.current = null;
      }

      log("Call ended");
    } catch (error) {
      logError("Failed to end call", error);
    }
  }, [callData?.callId, socket, updateCallState, log, logError]);

  // ==================== PARTICIPANT MANAGEMENT ====================
  const addParticipant = useCallback(
    (participant) => {
      if (!participant) {
        log("Cannot add participant: participant is undefined");
        return;
      }

      setParticipants((prev) => {
        const participantId = participant.id || participant._id;
        if (!participantId) {
          log("Cannot add participant: no valid ID found", participant);
          return prev;
        }

        const exists = prev.some((p) => p.id === participantId);
        if (exists) {
          log("Participant already exists, skipping duplicate", participantId);
          return prev;
        }
        return [...prev, { ...participant, id: participantId }];
      });
    },
    [log]
  );

  const removeParticipant = useCallback(
    (participantId) => {
      if (!participantId) {
        log("Cannot remove participant: participantId is undefined");
        return;
      }

      setParticipants((prev) => prev.filter((p) => p.id !== participantId));
      log("Participant removed", participantId);
    },
    [log]
  );

  const updateParticipant = useCallback(
    (participantId, updates) => {
      if (!participantId) {
        log("Cannot update participant: participantId is undefined");
        return;
      }

      setParticipants((prev) =>
        prev.map((p) => (p.id === participantId ? { ...p, ...updates } : p))
      );
    },
    [log]
  );

  const refreshParticipants = useCallback(async () => {
    if (!callData?.callId || !user?.id) return;

    try {
      const response = await fetch(`/api/group-calls/${callData.callId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (response.ok) {
        const callDetails = await response.json();
        const allParticipants = callDetails.data.call.participants
          .filter((p) => p.isActive && p.user._id !== user.id)
          .map((p) => ({ ...p.user, id: p.user._id }));

        // Remove duplicates
        const uniqueParticipants = allParticipants.filter(
          (participant, index, self) =>
            index === self.findIndex((p) => p.id === participant.id)
        );

        setParticipants(uniqueParticipants);
        log("Participants refreshed", uniqueParticipants);
      }
    } catch (error) {
      logError("Failed to refresh participants", error);
    }
  }, [callData?.callId, user?.id, log, logError]);

  // ==================== MUTE MANAGEMENT ====================
  const toggleMute = useCallback(async () => {
    try {
      if (!callData?.callId || !user?.id) {
        log("Cannot toggle mute: missing callId or userId");
        return;
      }

      const newMuteState = !callState.isMuted;
      updateCallState({ isMuted: newMuteState });

      await groupCallsAPI.updateParticipantStatus(callData.callId, user.id, {
        isMuted: newMuteState,
      });

      log("Mute toggled", { muted: newMuteState });
    } catch (error) {
      logError("Failed to toggle mute", error);
      // Revert state on error
      updateCallState({ isMuted: !callState.isMuted });
    }
  }, [
    callState.isMuted,
    callData?.callId,
    user?.id,
    updateCallState,
    log,
    logError,
  ]);

  // ==================== DURATION TIMER ====================
  useEffect(() => {
    if (callState.status === "connected" && callStartTimeRef.current) {
      durationIntervalRef.current = setInterval(() => {
        const duration = Math.floor(
          (Date.now() - callStartTimeRef.current) / 1000
        );
        updateCallState({ duration });
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
  }, [callState.status, updateCallState]);

  // ==================== SOCKET EVENT HANDLERS ====================
  useEffect(() => {
    if (!socket || !callData?.callId) return;

    const handleParticipantJoined = (data) => {
      if (data.callId === callData.callId) {
        addParticipant(data.participant);
      }
    };

    const handleParticipantLeft = (data) => {
      if (data.callId === callData.callId) {
        removeParticipant(data.participant.id);
      }
    };

    const handleCallJoined = (data) => {
      if (data.callId === callData.callId) {
        updateCallState({
          status: "connected",
          isConnected: true,
        });
        callStartTimeRef.current = Date.now();
      }
    };

    const handleCallEnded = (data) => {
      if (data.callId === callData.callId) {
        updateCallState({ status: "ended" });
      }
    };

    // Register event listeners
    socket.on("group-call-participant-joined", handleParticipantJoined);
    socket.on("group-call-participant-left", handleParticipantLeft);
    socket.on("group-call-joined", handleCallJoined);
    socket.on("group-call-ended", handleCallEnded);

    // Cleanup
    return () => {
      socket.off("group-call-participant-joined", handleParticipantJoined);
      socket.off("group-call-participant-left", handleParticipantLeft);
      socket.off("group-call-joined", handleCallJoined);
      socket.off("group-call-ended", handleCallEnded);
    };
  }, [
    socket,
    callData.callId,
    addParticipant,
    removeParticipant,
    updateCallState,
  ]);

  // ==================== CLEANUP ====================
  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (participantsRefreshIntervalRef.current) {
        clearInterval(participantsRefreshIntervalRef.current);
      }
    };
  }, []);

  // ==================== RETURN API ====================
  return {
    // State
    callState,
    participants,
    isLoading,

    // Actions
    startCall,
    answerCall,
    declineCall,
    endCall,
    toggleMute,
    refreshParticipants,

    // Participant management
    addParticipant,
    removeParticipant,
    updateParticipant,

    // Utilities
    updateCallState,
  };
};
