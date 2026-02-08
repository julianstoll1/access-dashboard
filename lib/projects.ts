import { createSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Get all projects for the current user
 */
export async function getProjects() {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
        .from("projects")
        .select("id, name, created_at")
        .order("created_at", { ascending: false });

    if (error) {
        console.error(error);
        return [];
    }

    return data;
}

/**
 * Get a single project by ID (RLS-protected)
 */
export async function getProject(projectId: string) {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
        .from("projects")
        .select("id, name, created_at")
        .eq("id", projectId)
        .single();

    if (error) {
        return null;
    }

    return data;
}