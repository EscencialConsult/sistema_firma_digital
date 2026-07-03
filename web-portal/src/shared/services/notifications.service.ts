import { supabase } from "../lib/supabase";

export interface DbNotification {
  id: string;
  user_id: string;
  title: string;
  description: string;
  type: "info" | "success" | "warning" | "error";
  read: boolean;
  link: string;
  created_at: string;
}

export async function getNotifications(userId: string): Promise<DbNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching notifications:", error);
    throw error;
  }
  return data || [];
}

export async function markNotificationAsRead(id: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", id);

  if (error) {
    console.error("Error marking notification as read:", error);
    throw error;
  }
}

export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false);

  if (error) {
    console.error("Error marking all notifications as read:", error);
    throw error;
  }
}

export async function createDbNotification(
  userId: string,
  title: string,
  description: string,
  type: "info" | "success" | "warning" | "error",
  link: string
): Promise<DbNotification> {
  const { data, error } = await supabase
    .from("notifications")
    .insert({
      user_id: userId,
      title,
      description,
      type,
      read: false,
      link
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating notification:", error);
    throw error;
  }
  return data;
}
