"use client";
import { useState } from "react";
import { Bell } from "lucide-react";
type Notification = { id: string; title: string; body: string; link: string | null; readAt: string | null; createdAt: string };
export function NotificationBell() {
  const [items, setItems] = useState<Notification[]>([]); const [open, setOpen] = useState(false);
  const unread = items.filter((item) => !item.readAt).length;
  async function load() { const response = await fetch("/api/notifications", { cache: "no-store" }); if (response.ok) setItems(await response.json()); }
  async function markRead() { await fetch("/api/notifications", { method: "PATCH" }); await load(); }
  return <div className="notification-bell">
    <button type="button" className="bell-button" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} aria-expanded={open} onClick={() => { setOpen((value) => !value); if (!open) void load(); }}>
      <Bell size={18} aria-hidden="true" />{unread > 0 && <span aria-hidden="true">{unread > 99 ? "99+" : unread}</span>}
    </button>
    {open && <div className="notification-popover"><div className="popover-heading"><strong>Notifications</strong>{unread > 0 && <button type="button" onClick={() => void markRead()}>Mark all read</button>}</div>{items.map((item) => <a href={item.link || "#"} key={item.id} className={item.readAt ? "" : "unread"}><strong>{item.title}</strong><p>{item.body}</p><small>{new Date(item.createdAt).toLocaleString()}</small></a>)}{items.length === 0 && <p className="empty-copy">No notifications yet.</p>}</div>}
  </div>;
}
