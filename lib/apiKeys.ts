import crypto from "crypto";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const ENCRYPTION_SECRET = process.env.API_KEY_ENCRYPTION_SECRET!;

export type ApiKeyStatus = "active" | "revoked";

export type ApiKeyRecord = {
    id: string;
    project_id: string;
    name: string;
    status: ApiKeyStatus;
    usage_count: number;
    last_used_at: string | null;
    created_at: string;
    updated_at: string | null;
    description: string | null;
};

export type ApiKeyAuthResult =
    | {
    ok: true;
    data: {
        keyId: string;
        projectId: string;
    };
}
    | {
    ok: false;
    error: string;
};

function getEncryptionKey() {
    return crypto.createHash("sha256").update(ENCRYPTION_SECRET).digest();
}

function decrypt(value: string) {
    const [ivHex, encrypted] = value.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", getEncryptionKey(), iv);
    return decipher.update(encrypted, "hex", "utf8") + decipher.final("utf8");
}

function encrypt(value: string) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-cbc", getEncryptionKey(), iv);
    const encrypted = cipher.update(value, "utf8", "hex") + cipher.final("hex");
    return `${iv.toString("hex")}:${encrypted}`;
}

export async function getDecryptedApiKeyValue(
    projectId: string,
    keyId: string
): Promise<{ ok: true; data: { id: string; key: string; name: string } } | { ok: false; error: string }> {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
        .from("api_keys")
        .select("id, name, key_encrypted")
        .eq("project_id", projectId)
        .eq("id", keyId)
        .maybeSingle();

    if (error || !data?.key_encrypted) {
        return { ok: false, error: "API key not found." };
    }

    try {
        const key = decrypt(data.key_encrypted);
        return {
            ok: true,
            data: {
                id: data.id,
                key,
                name: data.name,
            },
        };
    } catch {
        return { ok: false, error: "Failed to decrypt API key." };
    }
}

export function generateRawApiKey() {
    return `sk_live_${crypto.randomBytes(24).toString("hex")}`;
}

export function hashApiKey(rawKey: string) {
    return crypto.createHash("sha256").update(rawKey).digest("hex");
}

export async function getApiKeysForProject(projectId: string): Promise<ApiKeyRecord[]> {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
        .from("api_keys")
        .select("id, project_id, name, status, usage_count, last_used_at, created_at, updated_at, description")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

    if (error) throw error;
    return ((data ?? []) as ApiKeyRecord[]).map((row) => ({
        ...row,
        status: row.status === "revoked" ? "revoked" : "active",
        usage_count: row.usage_count ?? 0,
        description: row.description ?? null,
        updated_at: row.updated_at ?? null,
        last_used_at: row.last_used_at ?? null,
    }));
}

export async function createApiKeyRecord(input: {
    projectId: string;
    name: string;
    description: string | null;
}): Promise<{ ok: true; data: { key: string; record: ApiKeyRecord } } | { ok: false; error: string }> {
    const supabase = await createSupabaseServerClient();
    const rawKey = generateRawApiKey();
    const keyHash = hashApiKey(rawKey);
    const keyEncrypted = encrypt(rawKey);
    const now = new Date().toISOString();

    const { data, error } = await supabase
        .from("api_keys")
        .insert({
            project_id: input.projectId,
            name: input.name,
            description: input.description,
            status: "active",
            usage_count: 0,
            last_used_at: null,
            key_hash: keyHash,
            key_encrypted: keyEncrypted,
            created_at: now,
            updated_at: now,
        })
        .select("id, project_id, name, status, usage_count, last_used_at, created_at, updated_at, description")
        .single();

    if (error || !data) {
        if (error?.code === "23505" && error.message.toLowerCase().includes("unique_project")) {
            return {
                ok: false,
                error:
                    "Database still enforces one API key per project (unique_project). Remove that constraint to enable multi-key support.",
            };
        }
        return { ok: false, error: error?.message || "Failed to create API key." };
    }

    return {
        ok: true,
        data: {
            key: rawKey,
            record: {
                ...(data as ApiKeyRecord),
                status: data.status === "revoked" ? "revoked" : "active",
                usage_count: data.usage_count ?? 0,
                last_used_at: data.last_used_at ?? null,
                updated_at: data.updated_at ?? null,
                description: data.description ?? null,
            },
        },
    };
}

export async function revokeApiKeyRecord(
    projectId: string,
    keyId: string
): Promise<{ ok: true; data: ApiKeyRecord } | { ok: false; error: string }> {
    const supabase = await createSupabaseServerClient();
    const now = new Date().toISOString();

    const { data, error } = await supabase
        .from("api_keys")
        .update({
            status: "revoked",
            updated_at: now,
        })
        .eq("project_id", projectId)
        .eq("id", keyId)
        .eq("status", "active")
        .select("id, project_id, name, status, usage_count, last_used_at, created_at, updated_at, description")
        .single();

    if (error || !data) {
        return { ok: false, error: error?.message || "Failed to revoke API key." };
    }

    return {
        ok: true,
        data: {
            ...(data as ApiKeyRecord),
            status: "revoked",
            usage_count: data.usage_count ?? 0,
            last_used_at: data.last_used_at ?? null,
            updated_at: data.updated_at ?? null,
            description: data.description ?? null,
        },
    };
}

export async function deleteApiKeyRecord(
    projectId: string,
    keyId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
        .from("api_keys")
        .delete()
        .eq("project_id", projectId)
        .eq("id", keyId);

    if (error) {
        return { ok: false, error: error.message || "Failed to delete API key." };
    }

    return { ok: true };
}

export async function countActiveApiKeys(projectId: string): Promise<number> {
    const supabase = await createSupabaseServerClient();
    const { count } = await supabase
        .from("api_keys")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .eq("status", "active");

    return count ?? 0;
}

export async function authenticateAndTrackApiKey(rawKey: string): Promise<ApiKeyAuthResult> {
    const trimmed = rawKey.trim();
    if (!trimmed) return { ok: false, error: "Missing API key." };

    const supabase = await createSupabaseServerClient();
    const keyHash = hashApiKey(trimmed);

    const { data, error } = await supabase
        .from("api_keys")
        .select("id, project_id, status, usage_count")
        .eq("key_hash", keyHash)
        .eq("status", "active")
        .maybeSingle();

    if (error || !data) {
        return { ok: false, error: "Invalid API key." };
    }

    const now = new Date().toISOString();
    const usageCount = (data.usage_count ?? 0) + 1;

    const { error: updateError } = await supabase
        .from("api_keys")
        .update({
            usage_count: usageCount,
            last_used_at: now,
            updated_at: now,
        })
        .eq("id", data.id)
        .eq("status", "active");

    if (updateError) {
        return { ok: false, error: "Failed to update API key usage." };
    }

    return {
        ok: true,
        data: {
            keyId: data.id,
            projectId: data.project_id,
        },
    };
}

export async function authenticateAndTrackApiKeyFromAuthHeader(
    authorizationHeader: string | null
): Promise<ApiKeyAuthResult> {
    if (!authorizationHeader) {
        return { ok: false, error: "Missing Authorization header." };
    }
    const [scheme, token] = authorizationHeader.split(" ");
    if (scheme !== "Bearer" || !token) {
        return { ok: false, error: "Invalid Authorization header." };
    }
    return authenticateAndTrackApiKey(token);
}
