import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function getApiKeyForProject(projectId: string) {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
        .from("api_keys")
        .select("id, created_at")
        .eq("project_id", projectId)
        .single();

    if (error) {
        return null;
    }

    return data;
}