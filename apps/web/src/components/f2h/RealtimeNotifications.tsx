"use client";

import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import { showInfoToast, showWarningToast } from "@/components/Toast";

type ServerNotification = {
  notification_id?: string;
  title?: string;
  message: string;
  type?: "success" | "info" | "warning" | "error";
  timestamp?: string;
};

export function RealtimeNotifications() {
  const { user, logout } = useAuth();
  const { addNotification } = useNotifications();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!user?.user_id) return;

    const baseUrl = process.env.NEXT_PUBLIC_SOCKET_URL || window.location.origin;
    const socket = io(baseUrl, {
      path: "/socket.io",
      transports: ["websocket"],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on("notification", (payload: ServerNotification) => {
      // Show toast immediately
      const text = payload.title
        ? `${payload.title}: ${payload.message}`
        : payload.message;
      showInfoToast(text, 4500);

      // Add to context for persistent display
      if (payload.notification_id) {
        addNotification({
          notification_id: payload.notification_id,
          message: payload.message,
          title: payload.title,
          type: payload.type || "info",
          status: "unread",
          created_at: new Date().toISOString(),
        });
      }
    });

    socket.on("force_logout", (payload: { message?: string }) => {
      showWarningToast(
        payload?.message || "You have been logged out for security reasons.",
        5000
      );
      logout();
    });

    return () => {
      socket.removeAllListeners("notification");
      socket.removeAllListeners("force_logout");
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user?.user_id, logout, addNotification]);

  return null;
}

