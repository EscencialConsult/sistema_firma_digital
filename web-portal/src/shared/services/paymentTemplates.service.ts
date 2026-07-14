import { supabase } from "../lib/supabase";

export interface PaymentTemplate {
  id:               string;
  organizationId:   string;
  name:             string;
  description:      string | null;
  totalAmount:      number;
  installmentCount: number;
  installmentAmount: number | null;
  frequency:        string;
  hasMora:          boolean;
  moraRate:         number;
  extraVariables:   Record<string, unknown> | null;
  createdAt:        string;
  updatedAt:        string;
}

function mapRow(r: Record<string, unknown>): PaymentTemplate {
  return {
    id:               r.id as string,
    organizationId:   r.organization_id as string,
    name:             r.name as string,
    description:      (r.description as string) ?? null,
    totalAmount:      Number(r.total_amount),
    installmentCount: Number(r.installment_count),
    installmentAmount: r.installment_amount != null ? Number(r.installment_amount) : null,
    frequency:        (r.frequency as string) ?? "monthly",
    hasMora:          (r.has_mora as boolean) ?? true,
    moraRate:         Number(r.mora_rate) ?? 3,
    extraVariables:   (r.extra_variables as Record<string, unknown>) ?? null,
    createdAt:        r.created_at as string,
    updatedAt:        r.updated_at as string,
  };
}

export async function getPaymentTemplates(): Promise<PaymentTemplate[]> {
  const { data, error } = await supabase
    .from("payment_templates")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRow);
}

export async function getPaymentTemplate(id: string): Promise<PaymentTemplate | null> {
  const { data, error } = await supabase
    .from("payment_templates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapRow(data as Record<string, unknown>) : null;
}

export async function createPaymentTemplate(input: {
  name:             string;
  description?:     string;
  totalAmount:      number;
  installmentCount: number;
  installmentAmount?: number;
  frequency?:       string;
  hasMora?:         boolean;
  moraRate?:        number;
  extraVariables?:  Record<string, unknown>;
}): Promise<PaymentTemplate> {
  const { data, error } = await supabase
    .from("payment_templates")
    .insert({
      name:               input.name,
      description:        input.description ?? null,
      total_amount:       input.totalAmount,
      installment_count:  input.installmentCount,
      installment_amount: input.installmentAmount ?? Math.round(input.totalAmount / input.installmentCount),
      frequency:          input.frequency ?? "monthly",
      has_mora:           input.hasMora ?? true,
      mora_rate:          input.moraRate ?? 3,
      extra_variables:    input.extraVariables ?? null,
    })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "Error creando plantilla de pago");
  return mapRow(data as Record<string, unknown>);
}

export async function updatePaymentTemplate(
  id: string,
  input: Partial<{
    name:             string;
    description:      string | null;
    totalAmount:      number;
    installmentCount: number;
    installmentAmount: number;
    frequency:        string;
    hasMora:          boolean;
    moraRate:         number;
    extraVariables:   Record<string, unknown> | null;
  }>,
): Promise<PaymentTemplate> {
  const updates: Record<string, unknown> = {};
  if (input.name !== undefined)             updates.name               = input.name;
  if (input.description !== undefined)      updates.description        = input.description;
  if (input.totalAmount !== undefined)      updates.total_amount       = input.totalAmount;
  if (input.installmentCount !== undefined) updates.installment_count  = input.installmentCount;
  if (input.installmentAmount !== undefined) updates.installment_amount = input.installmentAmount;
  if (input.frequency !== undefined)        updates.frequency          = input.frequency;
  if (input.hasMora !== undefined)          updates.has_mora           = input.hasMora;
  if (input.moraRate !== undefined)         updates.mora_rate          = input.moraRate;
  if (input.extraVariables !== undefined)   updates.extra_variables    = input.extraVariables;
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("payment_templates")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "Error actualizando plantilla");
  return mapRow(data as Record<string, unknown>);
}

export async function deletePaymentTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from("payment_templates")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export function computeInstallmentAmount(totalAmount: number, installmentCount: number): number {
  return Math.round(totalAmount / installmentCount);
}

export const FREQUENCY_LABELS: Record<string, string> = {
  monthly:  "Mensual",
  bimonthly: "Bimestral",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  annual:   "Anual",
};
