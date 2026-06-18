import { supabase } from "../../../shared/lib/supabase";

export type DashboardSummary = {
  stats: {
    documents: number;
    pendingSignatures: number;
    completedDocuments: number;
    rejectedDocuments: number;
  };
  recentDocuments: Array<Record<string, any>>;
  recentActivity: Array<Record<string, any>>;
};

export const dashboardApi = {
  async summary() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { count: documents } = await supabase
      .from("documents")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    const { count: pendingSignatures } = await supabase
      .from("signature_requests")
      .select("*", { count: "exact", head: true })
      .eq("signer_email", user.email)
      .eq("status", "PENDING");

    const { count: completedDocuments } = await supabase
      .from("documents")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "SIGNED");

    const { count: rejectedDocuments } = await supabase
      .from("documents")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "REJECTED");

    const { data: recentDocuments } = await supabase
      .from("documents")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(5);

    const { data: recentActivity } = await supabase
      .from("audit_logs")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    return {
      stats: {
        documents: documents ?? 0,
        pendingSignatures: pendingSignatures ?? 0,
        completedDocuments: completedDocuments ?? 0,
        rejectedDocuments: rejectedDocuments ?? 0,
      },
      recentDocuments: (recentDocuments ?? []) as Array<Record<string, any>>,
      recentActivity: (recentActivity ?? []) as Array<Record<string, any>>,
    } satisfies DashboardSummary;
  }
};
