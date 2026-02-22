import { createSupabaseServerClient } from "@/lib/supabase-server";

export type ProjectRecord = {
    id: string;
    owner_id: string;
    name: string;
    slug: string;
    description: string | null;
    status: string;
    created_at: string;
    updated_at: string | null;
    archived_at: string | null;
    deleted_at: string | null;
};

export type ProjectListKpis = {
    project_id: string;
    total_roles: number;
    total_usage_count: number;
};

export type ProjectOverviewKpis = {
    total_permissions: number;
    enabled_permissions: number;
    total_roles: number;
    total_access_grants: number;
    total_api_keys: number;
    total_usage_count: number;
    last_activity_at: string | null;
};

/**
 * Get all projects for the current user
 */
export async function getProjects() {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
        .from("projects")
        .select("id, owner_id, name, slug, description, status, created_at, updated_at, archived_at, deleted_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

    if (error) {
        console.error(error);
        return [];
    }

    return (data ?? []) as ProjectRecord[];
}

export async function getProjectById(projectId: string) {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
        .from("projects")
        .select("id, owner_id, name, slug, description, status, created_at, updated_at, archived_at, deleted_at")
        .eq("id", projectId)
        .is("deleted_at", null)
        .single();

    if (error) {
        return null;
    }

    return data as ProjectRecord;
}

/**
 * Get a single project by slug (RLS-protected)
 */
export async function getProjectBySlug(projectSlug: string) {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
        .from("projects")
        .select("id, owner_id, name, slug, description, status, created_at, updated_at, archived_at, deleted_at")
        .eq("slug", projectSlug)
        .is("deleted_at", null)
        .single();

    if (error) {
        return null;
    }

    return data as ProjectRecord;
}

export async function getProjectListKpis(projectIds: string[]): Promise<Map<string, ProjectListKpis>> {
    const supabase = await createSupabaseServerClient();
    const ids = Array.from(new Set((projectIds ?? []).filter(Boolean)));
    const result = new Map<string, ProjectListKpis>();

    if (ids.length === 0) return result;

    const [{ data: roleRows }, { data: permissionRows }] = await Promise.all([
        supabase
            .from("roles")
            .select("project_id")
            .in("project_id", ids),
        supabase
            .from("permissions")
            .select("project_id, usage_count")
            .in("project_id", ids),
    ]);

    for (const id of ids) {
        result.set(id, {
            project_id: id,
            total_roles: 0,
            total_usage_count: 0,
        });
    }

    for (const row of roleRows ?? []) {
        const current = result.get(row.project_id);
        if (!current) continue;
        current.total_roles += 1;
    }

    for (const row of permissionRows ?? []) {
        const current = result.get(row.project_id);
        if (!current) continue;
        current.total_usage_count += row.usage_count ?? 0;
    }

    return result;
}

export async function getProjectOverviewKpis(projectId: string): Promise<ProjectOverviewKpis> {
    const supabase = await createSupabaseServerClient();

    const [
        { count: totalPermissions },
        { count: enabledPermissions },
        { count: totalRoles },
        { count: totalAccessGrants },
        { count: totalApiKeys },
        { data: permissionUsageRows },
        { data: lastActivityRow },
    ] = await Promise.all([
        supabase
            .from("permissions")
            .select("id", { count: "exact", head: true })
            .eq("project_id", projectId),
        supabase
            .from("permissions")
            .select("id", { count: "exact", head: true })
            .eq("project_id", projectId)
            .eq("enabled", true),
        supabase
            .from("roles")
            .select("id", { count: "exact", head: true })
            .eq("project_id", projectId),
        supabase
            .from("access_grants")
            .select("id", { count: "exact", head: true })
            .eq("project_id", projectId),
        supabase
            .from("api_keys")
            .select("id", { count: "exact", head: true })
            .eq("project_id", projectId),
        supabase
            .from("permissions")
            .select("usage_count")
            .eq("project_id", projectId),
        supabase
            .from("audit_logs")
            .select("created_at")
            .eq("project_id", projectId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
    ]);

    const totalUsageCount = (permissionUsageRows ?? []).reduce(
        (sum, row) => sum + (row.usage_count ?? 0),
        0
    );

    return {
        total_permissions: totalPermissions ?? 0,
        enabled_permissions: enabledPermissions ?? 0,
        total_roles: totalRoles ?? 0,
        total_access_grants: totalAccessGrants ?? 0,
        total_api_keys: totalApiKeys ?? 0,
        total_usage_count: totalUsageCount,
        last_activity_at: lastActivityRow?.created_at ?? null,
    };
}
