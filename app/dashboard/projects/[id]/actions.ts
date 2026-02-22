"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { logAuditEvent } from "@/lib/auditLogs";
import {
    ApiKeyRecord,
    createApiKeyRecord,
    deleteApiKeyRecord,
    getDecryptedApiKeyValue,
    getApiKeysForProject,
} from "@/lib/apiKeys";

export type ApiKeyActionResult<T> =
    | { ok: true; data: T }
    | { ok: false; error: string };

const MAX_NAME_LENGTH = 80;
const MAX_DESCRIPTION_LENGTH = 500;

function normalizeName(name: string) {
    return name.trim();
}

function normalizeDescription(description?: string) {
    const trimmed = (description ?? "").trim();
    return trimmed.length ? trimmed : null;
}

function validateName(name: string) {
    if (!name) return "API key name is required.";
    if (name.length < 2) return "API key name is too short.";
    if (name.length > MAX_NAME_LENGTH) return "API key name is too long.";
    return null;
}

function validateDescription(description?: string) {
    if (!description) return null;
    if (description.length > MAX_DESCRIPTION_LENGTH) {
        return "Description is too long.";
    }
    return null;
}

function normalizeComparableName(name: string) {
    return name.trim().toLocaleLowerCase();
}

function hasDuplicateApiKeyName(keys: ApiKeyRecord[], name: string, ignoreKeyId?: string) {
    const comparableName = normalizeComparableName(name);
    if (!comparableName) return false;
    return keys.some((key) => {
        if (ignoreKeyId && key.id === ignoreKeyId) return false;
        return normalizeComparableName(key.name) === comparableName;
    });
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

async function ensureProjectAccess(projectId: string) {
    type EnsureProjectAccessResult =
        | { ok: true; userId: string }
        | { ok: false; error: string; userId: string | null };

    const supabase = await createSupabaseServerClient();
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) {
        return { ok: false, error: "Unauthorized.", userId: null } as EnsureProjectAccessResult;
    }

    const { data: project, error } = await supabase
        .from("projects")
        .select("id")
        .eq("id", projectId)
        .is("deleted_at", null)
        .single();

    if (error || !project) {
        return { ok: false, error: "Project not found.", userId: authData.user.id } as EnsureProjectAccessResult;
    }

    return { ok: true, userId: authData.user.id } as EnsureProjectAccessResult;
}

async function revalidateProjectPath(projectId: string) {
    const projectSlug = await getProjectSlugById(projectId);
    revalidatePath(`/dashboard/projects/${projectSlug ?? projectId}`);
}

export async function listProjectApiKeysAction(projectId: string): Promise<ApiKeyActionResult<ApiKeyRecord[]>> {
    const access = await ensureProjectAccess(projectId);
    if (!access.ok) return { ok: false, error: access.error };

    const keys = await getApiKeysForProject(projectId);
    return { ok: true, data: keys };
}

export async function generateProjectApiKeyAction(
    projectId: string,
    input: { name: string; description?: string }
): Promise<ApiKeyActionResult<{ key: string; record: ApiKeyRecord }>> {
    const access = await ensureProjectAccess(projectId);
    if (!access.ok) return { ok: false, error: access.error };

    const name = normalizeName(input.name);
    const description = normalizeDescription(input.description);

    const nameError = validateName(name);
    if (nameError) return { ok: false, error: nameError };
    const descriptionError = validateDescription(description ?? undefined);
    if (descriptionError) return { ok: false, error: descriptionError };

    const existingKeys = await getApiKeysForProject(projectId);
    if (hasDuplicateApiKeyName(existingKeys, name)) {
        return { ok: false, error: "An API key with this name already exists in this project." };
    }

    const created = await createApiKeyRecord({
        projectId,
        name,
        description,
    });

    if (!created.ok) return { ok: false, error: created.error };

    await logAuditEvent({
        projectId,
        userId: access.userId,
        entityType: "api_key",
        entityId: created.data.record.id,
        action: "created",
        metadata: {
            event: "api_key_generated",
            name: created.data.record.name,
            status: created.data.record.status,
        },
    });

    await revalidateProjectPath(projectId);
    return { ok: true, data: created.data };
}

export async function deleteProjectApiKeyAction(
    projectId: string,
    keyId: string
): Promise<ApiKeyActionResult<{ id: string }>> {
    const access = await ensureProjectAccess(projectId);
    if (!access.ok) return { ok: false, error: access.error };

    const keys = await getApiKeysForProject(projectId);
    const target = keys.find((key) => key.id === keyId);
    if (!target) return { ok: false, error: "API key not found." };

    const deleted = await deleteApiKeyRecord(projectId, keyId);
    if (!deleted.ok) return { ok: false, error: deleted.error };

    await logAuditEvent({
        projectId,
        userId: access.userId,
        entityType: "api_key",
        entityId: keyId,
        action: "deleted",
        metadata: {
            event: "api_key_deleted",
            name: target.name,
            status: target.status,
        },
    });

    await revalidateProjectPath(projectId);
    return { ok: true, data: { id: keyId } };
}

export async function rotateProjectApiKeyAction(
    projectId: string,
    keyId: string,
    input: { name: string; description?: string }
): Promise<ApiKeyActionResult<{ key: string; record: ApiKeyRecord }>> {
    const access = await ensureProjectAccess(projectId);
    if (!access.ok) return { ok: false, error: access.error };

    const keys = await getApiKeysForProject(projectId);
    const oldKey = keys.find((key) => key.id === keyId);
    if (!oldKey) return { ok: false, error: "API key not found." };
    if (oldKey.status !== "active") {
        return { ok: false, error: "Only active API keys can be replaced." };
    }

    const name = normalizeName(input.name);
    const description = normalizeDescription(input.description);
    const nameError = validateName(name);
    if (nameError) return { ok: false, error: nameError };
    const descriptionError = validateDescription(description ?? undefined);
    if (descriptionError) return { ok: false, error: descriptionError };
    if (hasDuplicateApiKeyName(keys, name, keyId)) {
        return { ok: false, error: "An API key with this name already exists in this project." };
    }

    const created = await createApiKeyRecord({
        projectId,
        name,
        description,
    });
    if (!created.ok) return { ok: false, error: created.error };

    const deleted = await deleteApiKeyRecord(projectId, keyId);
    if (!deleted.ok) return { ok: false, error: deleted.error };

    await logAuditEvent({
        projectId,
        userId: access.userId,
        entityType: "api_key",
        entityId: created.data.record.id,
        action: "created",
        metadata: {
            event: "api_key_generated",
            name: created.data.record.name,
            status: created.data.record.status,
        },
    });

    await logAuditEvent({
        projectId,
        userId: access.userId,
        entityType: "api_key",
        entityId: keyId,
        action: "deleted",
        metadata: {
            event: "api_key_replaced",
            name: oldKey.name,
            status: oldKey.status,
            replaced_by: created.data.record.id,
        },
    });

    await revalidateProjectPath(projectId);
    return { ok: true, data: created.data };
}

export async function revealProjectApiKeyAction(
    projectId: string,
    keyId: string
): Promise<ApiKeyActionResult<{ id: string; key: string; name: string }>> {
    const access = await ensureProjectAccess(projectId);
    if (!access.ok) return { ok: false, error: access.error };

    const revealed = await getDecryptedApiKeyValue(projectId, keyId);
    if (!revealed.ok) return { ok: false, error: revealed.error };

    await logAuditEvent({
        projectId,
        userId: access.userId,
        entityType: "api_key",
        entityId: keyId,
        action: "updated",
        metadata: {
            event: "api_key_viewed",
            name: revealed.data.name,
        },
    });

    return { ok: true, data: revealed.data };
}
