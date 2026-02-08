import { createSupabaseServerClient } from "@/lib/supabase-server";

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