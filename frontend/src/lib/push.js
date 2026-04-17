/**
 * Push notification subscription manager.
 * Subscribes the browser to web push using the VAPID public key from the backend.
 */
import { api } from "./api";

let subscribed = false;

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeToPush() {
  if (subscribed) return true;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.warn("Push notifications not supported");
    return false;
  }

  try {
    // Get VAPID public key from backend
    const { data } = await api.get("/push/vapid-key");
    const vapidKey = data.public_key;
    if (!vapidKey) return false;

    const registration = await navigator.serviceWorker.ready;

    // Check existing subscription
    let sub = await registration.pushManager.getSubscription();
    if (!sub) {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return false;

      sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
    }

    // Send subscription to backend
    const subJson = sub.toJSON();
    await api.post("/push/subscribe", {
      endpoint: subJson.endpoint,
      keys: subJson.keys,
    });

    subscribed = true;
    return true;
  } catch (err) {
    console.error("Push subscription failed:", err);
    return false;
  }
}

export async function unsubscribeFromPush() {
  try {
    const registration = await navigator.serviceWorker.ready;
    const sub = await registration.pushManager.getSubscription();
    if (sub) {
      const subJson = sub.toJSON();
      await api.post("/push/unsubscribe", {
        endpoint: subJson.endpoint,
        keys: subJson.keys,
      });
      await sub.unsubscribe();
    }
    subscribed = false;
    return true;
  } catch (err) {
    console.error("Push unsubscribe failed:", err);
    return false;
  }
}

export function isPushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function getPushPermission() {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission; // "granted" | "denied" | "default"
}
