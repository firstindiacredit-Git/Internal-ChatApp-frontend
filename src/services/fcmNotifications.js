import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import axios from "axios";
import { config, firebaseConfig, firebaseVapidKey } from "../config";

let firebaseApp = null;
let messaging = null;

function initializeFirebase() {
  try {
    if (!firebaseApp) {
      firebaseApp = initializeApp(firebaseConfig);
      messaging = getMessaging(firebaseApp);
      console.log("✅ Firebase initialized");
    }
    return true;
  } catch (error) {
    console.error("❌ Firebase initialization failed:", error);
    return false;
  }
}

export async function registerFCMToken(userId) {
  try {
    if (!initializeFirebase()) {
      return { success: false, error: "Firebase init failed" };
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { success: false, error: "Permission denied" };
    }

    // Firebase VAPID key from config
    const currentToken = await getToken(messaging, {
      vapidKey: firebaseVapidKey,
    });

    if (currentToken) {
      console.log("✅ FCM Token:", currentToken.substring(0, 20) + "...");

      const API_BASE_URL = config.API_URL.replace(/\/?api\/?$/, "");
      const token = localStorage.getItem("token");

      await axios.post(
        `${API_BASE_URL}/api/fcm-notifications/register`,
        { userId, token: currentToken },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log("✅ FCM token registered with backend");
      localStorage.setItem("fcmToken", currentToken);
      return { success: true, token: currentToken };
    }

    return { success: false, error: "No token available" };
  } catch (error) {
    console.error("❌ FCM registration failed:", error);
    return { success: false, error: error.message };
  }
}

export async function initializeFCM(userId) {
  try {
    console.log("🔔 Initializing FCM...");
    const result = await registerFCMToken(userId);

    if (result.success && messaging) {
      onMessage(messaging, (payload) => {
        console.log("📨 FCM message received:", payload);
        const { title, body, icon } = payload.notification || {};
        if (Notification.permission === "granted") {
          new Notification(title || "New Message", {
            body: body || "You have a new message",
            icon: icon || "/icon.png",
          });
        }
      });
    }

    return result;
  } catch (error) {
    console.error("❌ FCM init failed:", error);
    return { success: false, error: error.message };
  }
}

export default { registerFCMToken, initializeFCM };
