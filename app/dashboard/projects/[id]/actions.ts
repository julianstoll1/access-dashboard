"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const ENCRYPTION_SECRET = process.env.API_KEY_ENCRYPTION_SECRET!;

function encrypt(text: string) {
    const iv = crypto.randomBytes(16);
    const key = crypto.createHash("sha256").update(ENCRYPTION_SECRET).digest();
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);

    const encrypted =
        cipher.update(text, "utf8", "hex") + cipher.final("hex");

    return `${iv.toString("hex")}:${encrypted}`;
}

function generateRawKey() {
    return `sk_live_${crypto.randomBytes(24).toString("hex")}`;
}

export async function generateApiKey(formData: FormData) {
    const projectId = formData.get("projectId") as string;
    if (!projectId) throw new Error("Missing projectId");

    const supabase = await createSupabaseServerClient();

    const rawKey = generateRawKey();

    const hash = crypto.createHash("sha256").update(rawKey).digest("hex");
    const encrypted = encrypt(rawKey);

    const { error } = await supabase.from("api_keys").insert({
        project_id: projectId,
        key_hash: hash,
        key_encrypted: encrypted,
    });

    if (error) throw new Error("Failed to generate API key");

    revalidatePath(`/dashboard/projects/${projectId}`);
}

export async function rotateApiKey(formData: FormData) {
    const projectId = formData.get("projectId") as string;
    if (!projectId) throw new Error("Missing projectId");

    const supabase = await createSupabaseServerClient();

    const rawKey = generateRawKey();
    const hash = crypto.createHash("sha256").update(rawKey).digest("hex");
    const encrypted = encrypt(rawKey);

    const { error } = await supabase
        .from("api_keys")
        .update({
            key_hash: hash,
            key_encrypted: encrypted,
            created_at: new Date().toISOString(),
        })
        .eq("project_id", projectId);

    if (error) throw new Error("Failed to rotate API key");

    revalidatePath(`/dashboard/projects/${projectId}`);
}