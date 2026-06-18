import { supabase } from "../../../shared/lib/supabase";
import type { AuthUser } from "../../../shared/services/auth.service";

export const usersApi = {
  async updateMe(fullName: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    const { data, error } = await supabase
      .from("users")
      .update({ full_name: fullName })
      .eq("id", user.id)
      .select("id, email, full_name, role, verification_status, certificate_status")
      .single();
    if (error) throw error;
    return {
      id: data.id,
      email: data.email,
      fullName: data.full_name,
      role: data.role,
      verificationStatus: data.verification_status,
      certificateStatus: data.certificate_status
    } satisfies AuthUser;
  }
};
