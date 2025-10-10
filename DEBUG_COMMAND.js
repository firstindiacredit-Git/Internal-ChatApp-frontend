/**
 * 🔍 Complete Diagnostic Command
 *
 * दोनों browsers में यह copy-paste करें (after joining call):
 */

(async function JitsiDiagnostic() {
  console.log("");
  console.log("🔍 ═══════════════════════════════════════════════════════");
  console.log("🔍           JITSI VIDEO CALL DIAGNOSTIC");
  console.log("🔍 ═══════════════════════════════════════════════════════");
  console.log("");

  // 1. Check Jitsi iframe
  console.log("1️⃣ JITSI IFRAME CHECK");
  console.log("─────────────────────────────────────────────────────────");
  const iframe =
    document.querySelector('iframe[name*="jitsi"]') ||
    document.querySelector('iframe[src*="8x8.vc"]') ||
    document.querySelector('iframe[src*="meet.jit.si"]');

  if (iframe) {
    console.log("   ✅ Iframe found");
    console.log("   📍 Iframe URL:", iframe.src);

    // Extract room name
    const roomMatch = iframe.src.match(/group-call-[a-z0-9-]+/i);
    if (roomMatch) {
      console.log("   🏠 Room Name:", roomMatch[0]);
      console.log("");
      console.log("   ⚠️  COPY THIS ROOM NAME! ⚠️");
      console.log("   ⚠️  Compare with other browser! ⚠️");
      console.log("");
    }

    // Check if iframe loaded
    try {
      const iframeLoaded = iframe.contentWindow !== null;
      console.log("   📄 Iframe loaded:", iframeLoaded ? "Yes ✅" : "No ❌");
    } catch (e) {
      console.log("   📄 Iframe loaded: Cannot check (cross-origin)");
    }
  } else {
    console.log("   ❌ Iframe NOT found");
    console.log("   🔧 Fix: Jitsi didn't load properly");
  }
  console.log("");

  // 2. Check Jitsi API
  console.log("2️⃣ JITSI API CHECK");
  console.log("─────────────────────────────────────────────────────────");
  if (window.JitsiMeetExternalAPI) {
    console.log("   ✅ JitsiMeetExternalAPI available");
  } else {
    console.log("   ❌ JitsiMeetExternalAPI NOT available");
    console.log("   🔧 Fix: Script didn't load");
  }
  console.log("");

  // 3. Check participant count in UI
  console.log("3️⃣ PARTICIPANT COUNT CHECK");
  console.log("─────────────────────────────────────────────────────────");
  const participantMatches = [
    ...document.body.textContent.matchAll(/(\d+)\s+participant/gi),
  ];

  if (participantMatches.length > 0) {
    participantMatches.forEach((match, i) => {
      console.log(`   ${i + 1}. Found: "${match[0]}" → Count: ${match[1]}`);
    });
  } else {
    console.log("   ⚠️  Participant count not visible in UI");
  }

  const isWaiting = document.body.textContent.includes("Waiting for others");
  console.log(
    "   ⏳ Waiting state:",
    isWaiting ? "Yes (waiting)" : "No (has participants)"
  );
  console.log("");

  // 4. Check media devices
  console.log("4️⃣ MEDIA DEVICES CHECK");
  console.log("─────────────────────────────────────────────────────────");
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter((d) => d.kind === "videoinput");
    const mics = devices.filter((d) => d.kind === "audioinput");

    console.log("   📷 Cameras:", cameras.length);
    cameras.forEach((cam, i) => {
      console.log(`      ${i + 1}. ${cam.label || "Camera " + (i + 1)}`);
    });

    console.log("   🎤 Microphones:", mics.length);
    mics.forEach((mic, i) => {
      console.log(`      ${i + 1}. ${mic.label || "Mic " + (i + 1)}`);
    });
  } catch (e) {
    console.log("   ❌ Cannot enumerate devices:", e.message);
  }
  console.log("");

  // 5. Test camera access
  console.log("5️⃣ CAMERA ACCESS TEST");
  console.log("─────────────────────────────────────────────────────────");
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    console.log("   ✅ Camera access: SUCCESS");
    console.log("   📹 Video tracks:", stream.getVideoTracks().length);
    console.log("   🎤 Audio tracks:", stream.getAudioTracks().length);

    // Check track states
    stream.getVideoTracks().forEach((track, i) => {
      console.log(`   📹 Video track ${i + 1}:`, {
        enabled: track.enabled,
        readyState: track.readyState,
        label: track.label,
      });
    });

    // Stop test stream
    stream.getTracks().forEach((track) => track.stop());
  } catch (error) {
    console.log("   ❌ Camera access: FAILED");
    console.log("   ❌ Error:", error.name);
    console.log("   ❌ Message:", error.message);

    if (error.name === "NotAllowedError") {
      console.log("   🔧 Fix: Allow camera/mic permission in browser");
    } else if (error.name === "NotReadableError") {
      console.log(
        "   🔧 Fix: Close other apps using camera (Zoom, Teams, etc.)"
      );
    } else if (error.name === "NotFoundError") {
      console.log("   🔧 Fix: Connect a camera to your device");
    }
  }
  console.log("");

  // 6. Check authentication
  console.log("6️⃣ AUTHENTICATION CHECK");
  console.log("─────────────────────────────────────────────────────────");
  const token = localStorage.getItem("token");
  console.log("   🔑 Auth token:", token ? "Present ✅" : "Missing ❌");

  if (token) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      console.log("   👤 User ID:", payload.userId || "Unknown");
      console.log("   📧 Email:", payload.email || "Unknown");
    } catch (e) {
      console.log("   ⚠️  Cannot decode token");
    }
  }
  console.log("");

  // 7. Check network
  console.log("7️⃣ NETWORK CHECK");
  console.log("─────────────────────────────────────────────────────────");
  console.log(
    "   🌐 Online status:",
    navigator.onLine ? "Connected ✅" : "Offline ❌"
  );
  console.log(
    "   🔗 Connection:",
    navigator.connection?.effectiveType || "Unknown"
  );
  console.log("");

  // 8. Check page URL
  console.log("8️⃣ PAGE INFO");
  console.log("─────────────────────────────────────────────────────────");
  console.log("   📄 Current URL:", window.location.href);
  console.log("   🌐 Domain:", window.location.hostname);
  console.log("   🔌 Port:", window.location.port);
  console.log("");

  // Final summary
  console.log("🎯 SUMMARY");
  console.log("═══════════════════════════════════════════════════════");

  const hasIframe = !!iframe;
  const hasAPI = !!window.JitsiMeetExternalAPI;
  const hasToken = !!token;
  const isOnline = navigator.onLine;

  console.log("   Jitsi Iframe:", hasIframe ? "✅" : "❌");
  console.log("   Jitsi API:", hasAPI ? "✅" : "❌");
  console.log("   Auth Token:", hasToken ? "✅" : "❌");
  console.log("   Internet:", isOnline ? "✅" : "❌");

  if (hasIframe && hasAPI && hasToken && isOnline) {
    console.log("");
    console.log("   🎉 ALL SYSTEMS OK! 🎉");
    console.log("");
    console.log("   ⚠️  IMPORTANT: ⚠️");
    console.log("   Compare ROOM NAME with other browser!");
    console.log("   They MUST be exactly the same!");
  } else {
    console.log("");
    console.log("   ⚠️  ISSUES FOUND! Fix them first!");
  }

  console.log("═══════════════════════════════════════════════════════");
  console.log("");
  console.log("📋 NEXT STEPS:");
  console.log("─────────────────────────────────────────────────────────");
  console.log("1. Run this command in OTHER browser too");
  console.log("2. Compare the ROOM NAMES");
  console.log("3. If same → Wait 30 seconds for connection");
  console.log("4. If different → Restart and try again");
  console.log("═══════════════════════════════════════════════════════");
  console.log("");
})();
