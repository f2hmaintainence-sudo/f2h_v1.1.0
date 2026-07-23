"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { api } from "@/services/api.client";

export type NotificationStatus = "read" | "unread" | "remind_later" | "dismissed";

export type NotificationType =
  | "success"
  | "info"
  | "warning"
  | "error";

export interface INotification {
  id?: number;
  notification_id: string;
  title?: string;
  message: string;
  type?: NotificationType;
  priority?: "low" | "medium" | "high" | "critical";
  html?: string;
  image?: string;
  status?: NotificationStatus;
  read_at?: string | null;
  created_at?: string;
  recipient_id?: number;
}

interface NotificationContextType {
  notifications: INotification[];
  unreadCount: number;
  isLoading: boolean;
  fetchNotifications: () => Promise<void>;
  markAsRead: (recipientId: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  dismissNotification: (recipientId: number) => Promise<void>;
  dismissAllNotifications: () => Promise<void>;
  addNotification: (notification: INotification) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<INotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await api.get<{
        notifications: INotification[];
        unreadCount: number;
      }>("/notifications/with-count");

      if (!error && data) {
        // Transform API response to match INotification interface
        const transformedNotifications = (data.notifications || []).map((notif: any) => ({
          ...notif,
          recipient_id: notif.id || notif.recipient_id,
        }));
        setNotifications(transformedNotifications);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const markAsRead = useCallback(
    async (recipientId: number) => {
      try {
        const { error } = await api.put(`/notifications/${recipientId}/read`, {});

        if (!error) {
          setNotifications((prev) =>
            prev.map((n) =>
              n.recipient_id === recipientId
                ? { ...n, status: "read" as NotificationStatus }
                : n
            )
          );
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      } catch (err) {
        console.error("Failed to mark notification as read:", err);
      }
    },
    []
  );

  const markAllAsRead = useCallback(async () => {
    try {
      const { error } = await api.put("/notifications/mark-all/read", {});

      if (!error) {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, status: "read" as NotificationStatus }))
        );
        setUnreadCount(0);
      }
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  }, []);

  const dismissNotification = useCallback(
    async (recipientId: number) => {
      try {
        const { error } = await api.put(
          `/notifications/${recipientId}/dismiss`,
          {}
        );

        if (!error) {
          setNotifications((prev) =>
            prev.filter((n) => n.recipient_id !== recipientId)
          );
          const dismissed = notifications.find(
            (n) => n.recipient_id === recipientId
          );
          if (dismissed?.status === "unread") {
            setUnreadCount((prev) => Math.max(0, prev - 1));
          }
        }
      } catch (err) {
        console.error("Failed to dismiss notification:", err);
      }
    },
    [notifications]
  );

  const dismissAllNotifications = useCallback(async () => {
    try {
      // Use single endpoint to dismiss all at once (prevent rate limiting)
      const { error } = await api.put("/notifications/dismiss-all", {});

      if (!error) {
        setNotifications([]);
        setUnreadCount(0);
      }
    } catch (err) {
      console.error("Failed to dismiss all notifications:", err);
    }
  }, []);

  const addNotification = useCallback((notification: INotification) => {
    setNotifications((prev) => [notification, ...prev]);
    if (notification.status === "unread") {
      setUnreadCount((prev) => prev + 1);
    }
  }, []);

  // Fetch notifications on mount
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isLoading,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        dismissNotification,
        dismissAllNotifications,
        addNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotifications must be used within a NotificationProvider"
    );
  }
  return context;
}
