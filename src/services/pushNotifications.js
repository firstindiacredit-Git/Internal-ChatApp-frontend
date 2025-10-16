import axios from "axios";
import { config } from "../config";

const API_BASE_URL = config.API_URL.replace(/\/?api\/?$/, "");

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, "+")
    .replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

// Check if push notifications are supported
export const isPushSupported = () => {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
};

// Get VAPID public key from server
export const getVapidPublicKey = async () => {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/api/push-notifications/vapid-public-key`
    );
    return response.data;
  } catch (error) {
    console.error("Failed to get VAPID key:", error);
    throw error;
  }
};

// Request notification permission
export const requestNotificationPermission = async () => {
  if (!("Notification" in window)) {
    console.log("This browser does not support notifications");
    return "denied";
  }

  if (Notification.permission === "granted") {
    console.log("✅ Notification permission already granted");
    return "granted";
  }

  if (Notification.permission === "denied") {
    console.warn(
      "⚠️ Notification permission is denied. Please enable it in browser settings."
    );
    return "denied";
  }

  // Permission is "default" (not yet asked)
  console.log("🔔 Requesting notification permission...");
  const permission = await Notification.requestPermission();

  if (permission === "granted") {
    console.log("✅ Notification permission granted!");
  } else {
    console.warn("⚠️ Notification permission denied by user");
  }

  return permission;
};

// Register service worker
export const registerServiceWorker = async () => {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service Workers not supported");
  }

  try {
    const registration = await navigator.serviceWorker.register("/push-sw.js", {
      scope: "/",
    });
    console.log("✅ Service Worker registered:", registration);
    return registration;
  } catch (error) {
    console.error("❌ Service Worker registration failed:", error);
    throw error;
  }
};

// Subscribe to push notifications
export const subscribeToPushNotifications = async (userId) => {
  try {
    // Check if push is supported
    if (!isPushSupported()) {
      throw new Error("Push notifications are not supported");
    }

    // Request permission
    const permission = await requestNotificationPermission();
    if (permission !== "granted") {
      throw new Error("Notification permission denied");
    }

    // Get VAPID public key
    const { publicKey, configured } = await getVapidPublicKey();
    if (!configured || !publicKey) {
      throw new Error("Push notifications not configured on server");
    }

    // Register service worker
    const registration = await registerServiceWorker();
    await navigator.serviceWorker.ready;

    // Subscribe to push
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    console.log("✅ Push subscription created:", subscription);

    // Send subscription to server with user ID
    const token = localStorage.getItem("token");
    await axios.post(
      `${API_BASE_URL}/api/push-notifications/subscribe`,
      {
        ...subscription.toJSON(),
        userId: userId, // Include user ID for backend tracking
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Push subscription saved to server");

    // Store subscription endpoint locally
    localStorage.setItem("pushSubscriptionEndpoint", subscription.endpoint);

    return { success: true, subscription };
  } catch (error) {
    console.error("❌ Push subscription failed:", error);
    return { success: false, error: error.message };
  }
};

// Unsubscribe from push notifications
export const unsubscribeFromPushNotifications = async () => {
  try {
    if (!("serviceWorker" in navigator)) {
      return { success: false, error: "Service Workers not supported" };
    }

    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      return { success: false, error: "No service worker registered" };
    }

    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      return { success: false, error: "No active subscription" };
    }

    // Unsubscribe from push
    await subscription.unsubscribe();

    // Remove from server
    const token = localStorage.getItem("token");
    await axios.post(
      `${API_BASE_URL}/api/push-notifications/unsubscribe`,
      {
        endpoint: subscription.endpoint,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Remove from localStorage
    localStorage.removeItem("pushSubscriptionEndpoint");

    console.log("✅ Unsubscribed from push notifications");
    return { success: true };
  } catch (error) {
    console.error("❌ Unsubscribe failed:", error);
    return { success: false, error: error.message };
  }
};

// Check if user is subscribed
export const checkPushSubscription = async () => {
  try {
    if (!("serviceWorker" in navigator)) {
      return { subscribed: false };
    }

    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      return { subscribed: false };
    }

    const subscription = await registration.pushManager.getSubscription();
    return {
      subscribed: !!subscription,
      subscription: subscription,
    };
  } catch (error) {
    console.error("❌ Check subscription failed:", error);
    return { subscribed: false };
  }
};

// Initialize push notifications for logged-in user
export const initializePushNotifications = async (userId) => {
  try {
    console.log("🔔 Initializing push notifications...");

    // Check if already subscribed
    const { subscribed } = await checkPushSubscription();
    if (subscribed) {
      console.log("✅ Already subscribed to push notifications");
      return { success: true, alreadySubscribed: true };
    }

    // Auto-subscribe
    const result = await subscribeToPushNotifications(userId);
    return result;
  } catch (error) {
    console.error("❌ Push initialization failed:", error);
    return { success: false, error: error.message };
  }
};

export default {
  isPushSupported,
  requestNotificationPermission,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  checkPushSubscription,
  initializePushNotifications,
};
