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

export async function createPermission(projectId: string, name: string) {
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
        .from("permissions")
        .insert({
            project_id: projectId,
            name,
        });

    if (error) throw error;
}

export async function deletePermission(id: string) {
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
        .from("permissions")
        .delete()
        .eq("id", id);

    if (error) throw error;
}

export async function togglePermission(id: string, enabled: boolean) {
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
        .from("permissions")
        .update({ enabled })
        .eq("id", id);

    if (error) throw error;
}