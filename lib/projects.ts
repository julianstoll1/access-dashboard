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
