import { supabase } from "../lib/supabase";
import type { Organization, OrganizationStats } from "../types/organization";

const BUCKET = "org-logos";

function mapRow(row: Record<string, unknown>): Organization {
  return {
    id:              row.id as string,
    name:            row.name as string,
    slug:            row.slug as string,
    logoDarkUrl:     (row.logo_dark_url as string) ?? undefined,
    logoLightUrl:    (row.logo_light_url as string) ?? undefined,
    primaryColor:    (row.primary_color as string) ?? "#6366f1",
    plan:            (row.plan as Organization["plan"]) ?? "basic",
    isActive:        row.is_active as boolean,
    diditWorkflowId: (row.didit_workflow_id as string) ?? undefined,
    maxUsers:        (row.max_users as number) ?? 50,
    contactEmail:    (row.contact_email as string) ?? undefined,
    createdAt:       row.created_at as string,
    brandPrimary:    (row.brand_primary    as string) ?? undefined,
    brandSecondary:  (row.brand_secondary  as string) ?? undefined,
    brandAccent:     (row.brand_accent     as string) ?? undefined,
    brandBackground: (row.brand_background as string) ?? undefined,
    phone:           (row.phone           as string) ?? undefined,
    address:         (row.address         as string) ?? undefined,
    city:            (row.city            as string) ?? undefined,
    province:        (row.province        as string) ?? undefined,
    postalCode:      (row.postal_code     as string) ?? undefined,
    taxId:           (row.tax_id          as string) ?? undefined,
    website:         (row.website         as string) ?? undefined,
  };
}

export async function listOrganizations(): Promise<Organization[]> {
  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

export async function getOrganizationBySlug(slug: string): Promise<Organization | null> {
  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapRow(data as Record<string, unknown>);
}

export async function getOrganization(id: string): Promise<Organization | null> {
  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapRow(data as Record<string, unknown>);
}

export async function getOrganizationStats(id: string): Promise<OrganizationStats> {
  const [usersRes, kycsRes, contractsRes] = await Promise.all([
    supabase.from("users").select("id, verification_status").eq("organization_id", id),
    supabase.from("identity_verifications").select("id, status").eq("organization_id", id).eq("status", "IN_REVIEW"),
    supabase.from("documents").select("id").eq("organization_id", id),
  ]);

  const users = usersRes.data ?? [];
  return {
    totalUsers:    users.length,
    activeUsers:   users.length,
    pendingKycs:   (kycsRes.data ?? []).length,
    verifiedUsers: users.filter((u: Record<string, unknown>) => u.verification_status === "VERIFIED").length,
    totalContracts: (contractsRes.data ?? []).length,
  };
}

export async function createOrganization(input: {
  name: string;
  slug: string;
  plan: Organization["plan"];
  maxUsers?: number;
  contactEmail?: string;
  diditWorkflowId?: string;
  primaryColor?: string;
}): Promise<Organization> {
  const { data, error } = await supabase
    .from("organizations")
    .insert({
      name:              input.name,
      slug:              input.slug,
      plan:              input.plan,
      max_users:         input.maxUsers ?? 50,
      contact_email:     input.contactEmail || null,
      didit_workflow_id: input.diditWorkflowId || null,
      primary_color:     input.primaryColor ?? "#6366f1",
    })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "No se pudo crear la organización");
  return mapRow(data as Record<string, unknown>);
}

export async function updateOrganization(id: string, updates: Partial<{
  name: string;
  logoDarkUrl: string | null;
  logoLightUrl: string | null;
  primaryColor: string;
  diditWorkflowId: string;
  maxUsers: number;
  contactEmail: string;
  isActive: boolean;
  brandPrimary:    string | null;
  brandSecondary:  string | null;
  brandAccent:     string | null;
  brandBackground: string | null;
  phone:     string | null;
  address:   string | null;
  city:      string | null;
  province:  string | null;
  postalCode: string | null;
  taxId:     string | null;
  website:   string | null;
}>): Promise<void> {
  const dbUpdates: Record<string, unknown> = {};
  if (updates.name !== undefined)            dbUpdates.name              = updates.name;
  if (updates.logoDarkUrl  !== undefined)    dbUpdates.logo_dark_url     = updates.logoDarkUrl;
  if (updates.logoLightUrl !== undefined)    dbUpdates.logo_light_url    = updates.logoLightUrl;
  if (updates.primaryColor !== undefined)    dbUpdates.primary_color     = updates.primaryColor;
  if (updates.diditWorkflowId !== undefined) dbUpdates.didit_workflow_id = updates.diditWorkflowId;
  if (updates.maxUsers !== undefined)        dbUpdates.max_users         = updates.maxUsers;
  if (updates.contactEmail !== undefined)    dbUpdates.contact_email     = updates.contactEmail;
  if (updates.isActive !== undefined)        dbUpdates.is_active         = updates.isActive;
  if (updates.brandPrimary    !== undefined) dbUpdates.brand_primary     = updates.brandPrimary;
  if (updates.brandSecondary  !== undefined) dbUpdates.brand_secondary   = updates.brandSecondary;
  if (updates.brandAccent     !== undefined) dbUpdates.brand_accent      = updates.brandAccent;
  if (updates.brandBackground !== undefined) dbUpdates.brand_background  = updates.brandBackground;
  if (updates.phone           !== undefined) dbUpdates.phone             = updates.phone;
  if (updates.address         !== undefined) dbUpdates.address           = updates.address;
  if (updates.city            !== undefined) dbUpdates.city              = updates.city;
  if (updates.province        !== undefined) dbUpdates.province          = updates.province;
  if (updates.postalCode      !== undefined) dbUpdates.postal_code       = updates.postalCode;
  if (updates.taxId           !== undefined) dbUpdates.tax_id            = updates.taxId;
  if (updates.website         !== undefined) dbUpdates.website           = updates.website;

  const { error } = await supabase.from("organizations").update(dbUpdates).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function uploadOrgLogo(
  orgId: string,
  file: File,
  variant: "dark" | "light"
): Promise<string> {
  const ext  = file.name.split(".").pop() ?? "png";
  const path = `${orgId}/${variant}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true });
  if (uploadError) throw new Error(uploadError.message);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function getMyOrganization(): Promise<Organization | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.organization_id) return null;

  return getOrganization(profile.organization_id as string);
}
