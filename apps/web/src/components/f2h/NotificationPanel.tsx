"use client";

import {
  Bell,
  Check,
  CheckCheck,
  X,
  Clock,
  Info,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  UserCheck,
  Zap,
  Sparkles,
  Shield,
  Trash2,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useNotifications } from "@/context/NotificationContext";
import "./NotificationPanel.css";

export function NotificationPanel() {
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    dismissAllNotifications,
  } = useNotifications();

  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isMarking, setIsMarking] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const closePanel = () => {
    if (!isOpen || isClosing) return;
    setIsClosing(true);
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
      closeTimeoutRef.current = null;
    }, 550);
  };

  const openPanel = () => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    setIsClosing(false);
    setIsOpen(true);
  };

  const togglePanel = () => {
    if (isOpen && !isClosing) {
      closePanel();
    } else {
      openPanel();
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node)
      ) {
        closePanel();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, [isOpen, isClosing]);

  const handleMarkAsRead = async (recipientId?: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!recipientId) return;
    setIsMarking(true);
    await markAsRead(recipientId);
    setIsMarking(false);
  };

  const handleMarkAllAsRead = async () => {
    setIsMarking(true);
    await markAllAsRead();
    setIsMarking(false);
  };

  const handleClearAll = async () => {
    setIsMarking(true);
    await dismissAllNotifications();
    setIsMarking(false);
  };

  const handleDismiss = async (recipientId?: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!recipientId) return;
    await dismissNotification(recipientId);
  };

  const getNotificationCategory = (notif: any) => {
    const title = (notif?.title || "").toLowerCase();
    const type = (notif?.type || "").toLowerCase();
    const priority = (notif?.priority || "").toLowerCase();

    if (title.includes("login") || title.includes("auth") || title.includes("logged")) {
      return "auth";
    }
    if (title.includes("cron") || title.includes("job") || title.includes("scheduled")) {
      return "cron";
    }
    if (title.includes("order") || title.includes("payment") || title.includes("wallet")) {
      return "success";
    }

    if (type === "success") return "success";
    if (type === "warning" || priority === "high") return "warning";
    if (type === "error" || priority === "critical") return "danger";
    return "info";
  };

  const getNotificationIconBox = (notif: any) => {
    const category = getNotificationCategory(notif);

    switch (category) {
      case "auth":
        return (
          <div className="notif-icon-box box-auth" title="Login Security">
            <UserCheck size={18} />
          </div>
        );
      case "cron":
        return (
          <div className="notif-icon-box box-cron" title="System Process">
            <Zap size={18} />
          </div>
        );
      case "success":
        return (
          <div className="notif-icon-box box-success" title="Success">
            <CheckCircle2 size={18} />
          </div>
        );
      case "warning":
        return (
          <div className="notif-icon-box box-warning" title="Warning">
            <AlertTriangle size={18} />
          </div>
        );
      case "danger":
        return (
          <div className="notif-icon-box box-danger" title="Critical">
            <AlertCircle size={18} />
          </div>
        );
      default:
        return (
          <div className="notif-icon-box box-info" title="Info">
            <Info size={18} />
          </div>
        );
    }
  };

  const cleanTitle = (str?: string) => {
    if (!str) return "";
    return str.replace(/^[^a-zA-Z0-9]+/g, "").trim() || str;
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return "Just now";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
    });
  };

  return (
    <div ref={panelRef} className="notification-panel">
      {/* Bell Icon Button */}
      <button
        onClick={togglePanel}
        className={`notification-bell ${isOpen && !isClosing ? "active" : ""}`}
        title={`${unreadCount} unread notifications`}
      >
        <Bell size={19} className={`notification-icon ${unreadCount > 0 ? "bell-wiggle" : ""}`} />
        {unreadCount > 0 && (
          <span className="notification-badge">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Popover Dropdown */}
      {(isOpen || isClosing) && (
        <div
          className={`notification-dropdown shadow-modern ${
            isClosing ? "panel-flush-close" : "panel-flush-open"
          }`}
        >
          {/* Header */}
          <div className="notification-header">
            <div className="notification-header-title">
              <h3>Notifications</h3>
              {unreadCount > 0 ? (
                <span className="unread-counter-pill">{unreadCount} new</span>
              ) : (
                <span className="read-counter-pill">Up to date</span>
              )}
            </div>
            <div className="notification-header-actions">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  disabled={isMarking}
                  className="notif-header-btn btn-mark-read"
                  title="Mark all as read"
                >
                  <CheckCheck size={14} />
                  <span>Mark all read</span>
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={handleClearAll}
                  disabled={isMarking}
                  className="notif-header-btn btn-clear-all"
                  title="Clear all notifications"
                >
                  <Trash2 size={13} />
                  <span>Clear</span>
                </button>
              )}
            </div>
          </div>

          {/* Notifications List */}
          <div className="notification-list">
            {isLoading ? (
              <div className="notification-empty">
                <div className="notif-spinner" />
                <p>Loading notifications...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="notification-empty">
                <div className="empty-icon-wrapper">
                  <Sparkles size={26} />
                </div>
                <h4>All caught up!</h4>
                <p>You have no pending notifications right now.</p>
              </div>
            ) : (
              notifications.map((notif) => {
                const isUnread = notif.status === "unread";
                const category = getNotificationCategory(notif);
                return (
                  <div
                    key={notif.recipient_id}
                    className={`notification-item ${isUnread ? "unread-card" : "read-card"}`}
                  >
                    {/* Unread Left Accent Bar */}
                    {isUnread && <div className={`unread-accent-bar bar-${category}`} />}

                    {/* Category Icon Box */}
                    {getNotificationIconBox(notif)}

                    {/* Content */}
                    <div className="notification-content">
                      {notif.title && (
                        <div className="notification-title">
                          <span>{cleanTitle(notif.title)}</span>
                          {isUnread && (
                            <span className={`unread-dot-badge badge-${category}`}>
                              New
                            </span>
                          )}
                        </div>
                      )}
                      <div className="notification-message">{notif.message}</div>
                      <div className="notification-meta">
                        <Clock size={12} className="clock-icon" />
                        <span>{formatTime(notif.created_at)}</span>
                      </div>
                    </div>

                    {/* Item Actions */}
                    <div className="notification-actions">
                      {isUnread && (
                        <button
                          onClick={(e) => handleMarkAsRead(notif.recipient_id, e)}
                          disabled={isMarking}
                          className="item-action-btn item-read-btn"
                          title="Mark as read"
                        >
                          <Check size={14} />
                        </button>
                      )}
                      <button
                        onClick={(e) => handleDismiss(notif.recipient_id, e)}
                        className="item-action-btn item-dismiss-btn"
                        title="Dismiss notification"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="notification-footer">
            <div className="footer-left">
              <span>{unreadCount > 0 ? `${unreadCount} unread` : "No unread"}</span>
              <span className="footer-divider">•</span>
              <span>{notifications.length} total</span>
            </div>
            <div className="footer-right">
              <span className="live-pulse-dot" />
              <span>Live updates</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
