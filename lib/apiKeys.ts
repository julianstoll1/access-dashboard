import crypto from "crypto";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const ENCRYPTION_SECRET = process.env.API_KEY_ENCRYPTION_SECRET!;

function decrypt(value: string) {
    const [ivHex, encrypted] = value.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const key = crypto.createHash("sha256").update(ENCRYPTION_SECRET).digest();
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);

    return (
        decipher.update(encrypted, "hex", "utf8") +
        decipher.final("utf8")
    );
}

export async function getApiKeyForProject(projectId: string) {
    const supabase = await createSupabaseServerClient();

    const { data } = await supabase
        .from("api_keys")
        .select("key_encrypted, created_at")
        .eq("project_id", projectId)
        .single();

    if (!data) return null;

    return {
        key: decrypt(data.key_encrypted),
        created_at: data.created_at,
    };
}