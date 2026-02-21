import { createSupabaseServerClient } from "@/lib/supabase-server";

export type AuditLogRecord = {
    id: string;
    project_id: string;
    user_id: string | null;
    entity_type: "permission" | "role" | "api_key" | "project" | string;
    entity_id: string | null;
    action: "created" | "updated" | "deleted" | "granted" | "revoked" | string;
    metadata: Record<string, unknown> | null;
    created_at: string;
};

export async function getAuditLogs(projectId: string, limit = 200): Promise<AuditLogRecord[]> {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
        .from("audit_logs")
        .select("id, project_id, user_id, entity_type, entity_id, action, metadata, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(limit);

    if (error) throw error;
    return (data ?? []) as AuditLogRecord[];
}

export async function logAuditEvent(input: {
    projectId: string;
    userId?: string | null;
    entityType: "permission" | "role" | "api_key" | "project";
    entityId?: string | null;
    action: "created" | "updated" | "deleted" | "granted" | "revoked";
    metadata?: Record<string, unknown>;
}) {
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase.from("audit_logs").insert({
        project_id: input.projectId,
        user_id: input.userId ?? null,
        entity_type: input.entityType,
        entity_id: input.entityId ?? null,
        action: input.action,
        metadata: input.metadata ?? null,
        created_at: new Date().toISOString(),
    });

    if (error) {
        console.error("Failed to write audit log", error);
    }
}
