"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { logAuditEvent } from "@/lib/auditLogs";

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

async function getProjectSlugById(projectId: string) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
        .from("projects")
        .select("slug")
        .eq("id", projectId)
        .is("deleted_at", null)
        .maybeSingle();

    return data?.slug ?? null;
}

export async function generateApiKey(formData: FormData) {
    const projectId = formData.get("projectId") as string;
    if (!projectId) throw new Error("Missing projectId");

    const supabase = await createSupabaseServerClient();
    const { data: authData } = await supabase.auth.getUser();

    const rawKey = generateRawKey();
    const hash = crypto.createHash("sha256").update(rawKey).digest("hex");
    const encrypted = encrypt(rawKey);

    const { data: createdKey, error } = await supabase.from("api_keys").insert({
        project_id: projectId,
        key_hash: hash,
        key_encrypted: encrypted,
        created_at: new Date().toISOString(),
        last_rotated_at: new Date().toISOString(),
    }).select("id").single();

    if (error) throw new Error("Failed to generate API key");

    await logAuditEvent({
        projectId,
        userId: authData?.user?.id ?? null,
        entityType: "api_key",
        entityId: createdKey?.id ?? null,
        action: "created",
        metadata: { event: "api_key_generated" },
    });

    const projectSlug = await getProjectSlugById(projectId);
    revalidatePath(`/dashboard/projects/${projectSlug ?? projectId}`);
}

export async function rotateApiKey(formData: FormData) {
    const projectId = formData.get("projectId") as string;
    if (!projectId) throw new Error("Missing projectId");

    const supabase = await createSupabaseServerClient();
    const { data: authData } = await supabase.auth.getUser();

    const rawKey = generateRawKey();
    const hash = crypto.createHash("sha256").update(rawKey).digest("hex");
    const encrypted = encrypt(rawKey);

    const { error } = await supabase
        .from("api_keys")
        .update({
            key_hash: hash,
            key_encrypted: encrypted,
            last_rotated_at: new Date().toISOString(),
        })
        .eq("project_id", projectId);

    if (error) throw new Error("Failed to rotate API key");

    await logAuditEvent({
        projectId,
        userId: authData?.user?.id ?? null,
        entityType: "api_key",
        action: "updated",
        metadata: { event: "api_key_rotated" },
    });

    const projectSlug = await getProjectSlugById(projectId);
    revalidatePath(`/dashboard/projects/${projectSlug ?? projectId}`);
}
