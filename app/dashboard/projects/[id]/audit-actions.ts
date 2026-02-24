"use server";

import { createSupabaseServerClient } from "@/lib/supabase-server";

type AuditLogRow = {
    id: string;
    project_id: string;
    user_id: string | null;
    entity_type: string;
    entity_id: string | null;
    action: string;
    metadata: Record<string, unknown> | null;
    created_at: string;
};

export type AuditLogFilterInput = {
    entityType?: string;
    action?: string;
    userId?: string;
    dateFrom?: string;
    dateTo?: string;
    query?: string;
};

type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

const MAX_PAGE_SIZE = 100;
const MAX_EXPORT_ROWS = 5000;

function normalizeText(value?: string) {
    const trimmed = (value ?? "").trim();
    return trimmed.length > 0 ? trimmed : null;
}

function normalizeFilters(filters?: AuditLogFilterInput): Required<AuditLogFilterInput> {
    return {
        entityType: normalizeText(filters?.entityType) ?? "",
        action: normalizeText(filters?.action) ?? "",
        userId: normalizeText(filters?.userId) ?? "",
        dateFrom: normalizeText(filters?.dateFrom) ?? "",
        dateTo: normalizeText(filters?.dateTo) ?? "",
        query: normalizeText(filters?.query) ?? "",
    };
}

function toStartOfDayUtc(dateValue: string) {
    return `${dateValue}T00:00:00.000Z`;
}

function toEndOfDayUtcExclusive(dateValue: string) {
    const date = new Date(`${dateValue}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString();
}

function escapeLikeValue(value: string) {
    return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_").replaceAll(",", " ");
}

async function ensureProjectAccess(projectId: string): Promise<{ ok: true } | { ok: false; error: string }> {
    const supabase = await createSupabaseServerClient();
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) return { ok: false, error: "Unauthorized." };

    const { data: project, error } = await supabase
        .from("projects")
        .select("id")
        .eq("id", projectId)
        .is("deleted_at", null)
        .single();

    if (error || !project) return { ok: false, error: "Project not found." };
    return { ok: true };
}

export async function listAuditLogsAction(
    projectId: string,
    input?: {
        filters?: AuditLogFilterInput;
        page?: number;
        pageSize?: number;
    }
): Promise<ApiResult<{ rows: AuditLogRow[]; hasMore: boolean }>> {
    const access = await ensureProjectAccess(projectId);
    if (!access.ok) return { ok: false, error: access.error };

    const page = Math.max(1, input?.page ?? 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(10, input?.pageSize ?? 40));
    const from = (page - 1) * pageSize;
    const to = from + pageSize + 1;
    const filters = normalizeFilters(input?.filters);

    const supabase = await createSupabaseServerClient();
    let query = supabase
        .from("audit_logs")
        .select("id, project_id, user_id, entity_type, entity_id, action, metadata, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
    if (filters.entityType) {
        query = query.eq("entity_type", filters.entityType);
    }
    if (filters.action) {
        query = query.eq("action", filters.action);
    }
    if (filters.userId) {
        query = query.eq("user_id", filters.userId);
    }
    if (filters.dateFrom) {
        query = query.gte("created_at", toStartOfDayUtc(filters.dateFrom));
    }
    if (filters.dateTo) {
        query = query.lt("created_at", toEndOfDayUtcExclusive(filters.dateTo));
    }
    if (filters.query) {
        const like = `%${escapeLikeValue(filters.query)}%`;
        query = query.or(
            `action.ilike.${like},entity_type.ilike.${like},user_id.ilike.${like},entity_id.ilike.${like}`
        );
    }
    const { data, error } = await query.range(from, to);
    if (error) return { ok: false, error: "Failed to load audit logs." };

    const raw = (data ?? []) as AuditLogRow[];
    const hasMore = raw.length > pageSize;
    const rows = raw.slice(0, pageSize);

    return { ok: true, data: { rows, hasMore } };
}

export async function exportAuditLogsAction(
    projectId: string,
    filters?: AuditLogFilterInput
): Promise<ApiResult<{ rows: AuditLogRow[]; truncated: boolean }>> {
    const access = await ensureProjectAccess(projectId);
    if (!access.ok) return { ok: false, error: access.error };

    const normalized = normalizeFilters(filters);
    const supabase = await createSupabaseServerClient();

    let query = supabase
        .from("audit_logs")
        .select("id, project_id, user_id, entity_type, entity_id, action, metadata, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
    if (normalized.entityType) {
        query = query.eq("entity_type", normalized.entityType);
    }
    if (normalized.action) {
        query = query.eq("action", normalized.action);
    }
    if (normalized.userId) {
        query = query.eq("user_id", normalized.userId);
    }
    if (normalized.dateFrom) {
        query = query.gte("created_at", toStartOfDayUtc(normalized.dateFrom));
    }
    if (normalized.dateTo) {
        query = query.lt("created_at", toEndOfDayUtcExclusive(normalized.dateTo));
    }
    if (normalized.query) {
        const like = `%${escapeLikeValue(normalized.query)}%`;
        query = query.or(
            `action.ilike.${like},entity_type.ilike.${like},user_id.ilike.${like},entity_id.ilike.${like}`
        );
    }
    const { data, error } = await query.limit(MAX_EXPORT_ROWS + 1);
    if (error) return { ok: false, error: "Failed to export audit logs." };

    const raw = (data ?? []) as AuditLogRow[];
    const truncated = raw.length > MAX_EXPORT_ROWS;
    const rows = raw.slice(0, MAX_EXPORT_ROWS);
    return { ok: true, data: { rows, truncated } };
}
