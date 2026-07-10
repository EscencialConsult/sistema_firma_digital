import { supabase } from "../lib/supabase";

export interface ContractType {
  id:             string;
  organizationId: string | null;
  name:           string;
  slug:           string;
  isSystem:       boolean;
  createdAt:      string;
}

function mapRow(r: Record<string, unknown>): ContractType {
  return {
    id:             r.id as string,
    organizationId: (r.organization_id as string) ?? null,
    name:           r.name as string,
    slug:           r.slug as string,
    isSystem:       (r.is_system as boolean) ?? false,
    createdAt:      r.created_at as string,
  };
}

export async function getContractTypes(orgId?: string): Promise<ContractType[]> {
  let query = supabase
    .from("contract_types")
    .select("*")
    .order("is_system", { ascending: false })
    .order("name");

  if (orgId) {
    query = query.or(`organization_id.is.null,organization_id.eq.${orgId}`);
  } else {
    query = query.is("organization_id", null);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRow);
}

export async function createContractType(input: {
  orgId: string;
  name:  string;
}): Promise<ContractType> {
  const slug = input.name
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

  const { data, error } = await supabase
    .from("contract_types")
    .insert({
      organization_id: input.orgId,
      name:            input.name,
      slug,
      is_system:       false,
    })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "Error creando tipo");
  return mapRow(data as Record<string, unknown>);
}

export async function deleteContractType(id: string): Promise<void> {
  const { error } = await supabase
    .from("contract_types")
    .delete()
    .eq("id", id)
    .eq("is_system", false);
  if (error) throw new Error(error.message);
}
