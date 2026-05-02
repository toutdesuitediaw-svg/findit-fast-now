import { supabase } from "@/integrations/supabase/client";

export async function logAdminAction(params: {
  adminId: string;
  action: string;
  targetType?: string;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await supabase.from("activity_logs").insert([{
    admin_id: params.adminId,
    action: params.action,
    target_type: params.targetType ?? undefined,
    target_id: params.targetId ?? undefined,
    metadata: (params.metadata ?? {}) as never,
  }]);
}
