import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function getPermissions(projectId: string) {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
        .from("permissions")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
}

export async function createPermission(
    projectId: string,
    data: {
        name: string;
        slug: string;
        description: string | null;
        risk_level: "low" | "medium" | "high";
    }
) {
    const supabase = await createSupabaseServerClient();

    const { data: created, error } = await supabase
        .from("permissions")
        .insert({
            project_id: projectId,
            name: data.name,
            slug: data.slug,
            description: data.description,
            risk_level: data.risk_level,
        })
        .select("*")
        .single();

    if (error || !created) return { ok: false as const, error };
    return { ok: true as const, data: created };
}

export async function deletePermission(id: string, projectId: string) {
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
        .from("permissions")
        .delete()
        .eq("id", id)
        .eq("project_id", projectId);

    if (error) return { ok: false as const, error };
    return { ok: true as const };
}

export async function togglePermission(id: string, enabled: boolean, projectId: string) {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
        .from("permissions")
        .update({ enabled })
        .eq("id", id)
        .eq("project_id", projectId)
        .select("*")
        .single();

    if (error || !data) return { ok: false as const, error };
    return { ok: true as const, data };
}

export async function updatePermission(
    id: string,
    data: {
        name: string;
        slug: string;
        description: string | null;
        risk_level: "low" | "medium" | "high";
        enabled: boolean;
    }
) {
    const supabase = await createSupabaseServerClient();

    const { data: updated, error } = await supabase
        .from("permissions")
        .update({
            name: data.name,
            slug: data.slug,
            description: data.description,
            risk_level: data.risk_level,
            enabled: data.enabled,
        })
        .eq("id", id)
        .select("*")
        .single();

    if (error || !updated) return { ok: false as const, error };
    return { ok: true as const, data: updated };
}
