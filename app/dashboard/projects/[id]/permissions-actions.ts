"use server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createPermission, updatePermission, deletePermission, togglePermission } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/auditLogs";

export type PermissionRecord = {
    id: string;
    project_id: string;
    name: string;
    slug: string;
    description: string | null;
    created_at: string;
    enabled: boolean;
    risk_level: "low" | "medium" | "high" | string;
    last_used_at: string | null;
    usage_count: number | null;
    updated_at: string | null;
    is_system: boolean;
};

export type ActionResult<T> =
    | { ok: true; data: T }
    | { ok: false; error: string };

const MAX_NAME_LENGTH = 64;
const MAX_DESCRIPTION_LENGTH = 500;
const VALID_RISK_LEVELS = new Set(["low", "medium", "high"]);

function normalizeName(name: string) {
    return name.trim();
}

function normalizeSlug(slug: string) {
    return slug.trim();
}

function normalizeDescription(description?: string) {
    const trimmed = (description ?? "").trim();
    return trimmed.length ? trimmed : null;
}

function validateName(name: string) {
    if (!name) return "Permission name is required.";
    if (name.length < 2) return "Permission name is too short.";
    if (name.length > MAX_NAME_LENGTH) return "Permission name is too long.";
    return null;
}

function validateSlug(slug: string) {
    if (!slug) return "Slug is required.";
    if (slug.length < 2) return "Slug is too short.";
    return null;
}

function validateDescription(description?: string) {
    if (!description) return null;
    if (description.length > MAX_DESCRIPTION_LENGTH) {
        return "Description is too long.";
    }
    return null;
}

function validateRiskLevel(riskLevel: string) {
    if (!VALID_RISK_LEVELS.has(riskLevel)) {
        return "Invalid risk level.";
    }
    return null;
}

async function verifyProjectAccess(
    supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
    projectId: string
) {
    const { data, error } = await supabase
        .from("projects")
        .select("id")
        .eq("id", projectId)
        .single();

    if (error || !data) {
        return { ok: false, error: "Project not found." } as const;
    }

    return { ok: true } as const;
}

async function hasDuplicateName(
    supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
    projectId: string,
    name: string,
    excludeId?: string
) {
    let query = supabase
        .from("permissions")
        .select("id")
        .eq("project_id", projectId)
        .ilike("name", name)
        .limit(1);

    if (excludeId) {
        query = query.neq("id", excludeId);
    }

    const { data, error } = await query;

    if (error) {
        return { ok: false, error: "Failed to validate permission name." } as const;
    }

    return { ok: true, exists: (data?.length ?? 0) > 0 } as const;
}

export async function createPermissionAction(
    projectId: string,
    data: {
        name: string;
        slug: string;
        description?: string;
        risk_level: "low" | "medium" | "high";
    }
): Promise<ActionResult<PermissionRecord>> {
    const supabase = await createSupabaseServerClient();
    const { data: authData } = await supabase.auth.getUser();

    if (!authData?.user) {
        return { ok: false, error: "Unauthorized." };
    }

    const projectCheck = await verifyProjectAccess(supabase, projectId);
    if (!projectCheck.ok) {
        return { ok: false, error: projectCheck.error };
    }

    const normalizedName = normalizeName(data.name);
    const normalizedSlug = normalizeSlug(data.slug);

    const nameError = validateName(normalizedName);
    if (nameError) return { ok: false, error: nameError };

    const slugError = validateSlug(normalizedSlug);
    if (slugError) return { ok: false, error: slugError };

    const descriptionError = validateDescription(data.description);
    if (descriptionError) return { ok: false, error: descriptionError };

    const riskError = validateRiskLevel(data.risk_level);
    if (riskError) return { ok: false, error: riskError };

    const duplicateCheck = await hasDuplicateName(
        supabase,
        projectId,
        normalizedName
    );
    if (!duplicateCheck.ok) return { ok: false, error: duplicateCheck.error };
    if (duplicateCheck.exists) {
        return { ok: false, error: "Permission name already exists." };
    }

    const created = await createPermission(projectId, {
        name: normalizedName,
        slug: normalizedSlug,
        description: normalizeDescription(data.description),
        risk_level: data.risk_level,
    });

    if (!created.ok) {
        return { ok: false, error: "Failed to create permission." };
    }

    await logAuditEvent({
        projectId,
        userId: authData.user.id,
        entityType: "permission",
        entityId: created.data.id,
        action: "created",
        metadata: {
            name: created.data.name,
            slug: created.data.slug,
            risk_level: created.data.risk_level,
        },
    });

    return { ok: true, data: created.data };
}

export async function updatePermissionAction(
    id: string,
    data: {
        name: string;
        slug: string;
        description?: string;
        risk_level: "low" | "medium" | "high";
        enabled: boolean;
    }
): Promise<ActionResult<PermissionRecord>> {
    const supabase = await createSupabaseServerClient();
    const { data: authData } = await supabase.auth.getUser();

    if (!authData?.user) {
        return { ok: false, error: "Unauthorized." };
    }

    const normalizedName = normalizeName(data.name);
    const normalizedSlug = normalizeSlug(data.slug);

    const nameError = validateName(normalizedName);
    if (nameError) return { ok: false, error: nameError };

    const slugError = validateSlug(normalizedSlug);
    if (slugError) return { ok: false, error: slugError };

    const descriptionError = validateDescription(data.description);
    if (descriptionError) return { ok: false, error: descriptionError };

    const riskError = validateRiskLevel(data.risk_level);
    if (riskError) return { ok: false, error: riskError };

    const updated = await updatePermission(id, {
        name: normalizedName,
        slug: normalizedSlug,
        description: normalizeDescription(data.description),
        risk_level: data.risk_level,
        enabled: data.enabled,
    });

    if (!updated.ok) {
        return { ok: false, error: "Failed to update permission." };
    }

    await logAuditEvent({
        projectId: updated.data.project_id,
        userId: authData.user.id,
        entityType: "permission",
        entityId: updated.data.id,
        action: "updated",
        metadata: {
            name: updated.data.name,
            slug: updated.data.slug,
            enabled: updated.data.enabled,
            risk_level: updated.data.risk_level,
        },
    });

    return { ok: true, data: updated.data };
}

export async function deletePermissionAction(
    projectId: string,
    id: string
): Promise<ActionResult<{ id: string }>> {
    const supabase = await createSupabaseServerClient();
    const { data: authData } = await supabase.auth.getUser();

    if (!authData?.user) {
        return { ok: false, error: "Unauthorized." };
    }

    const projectCheck = await verifyProjectAccess(supabase, projectId);
    if (!projectCheck.ok) {
        return { ok: false, error: projectCheck.error };
    }

    const { data: existingPermission } = await supabase
        .from("permissions")
        .select("name, slug")
        .eq("id", id)
        .eq("project_id", projectId)
        .maybeSingle();

    const deleted = await deletePermission(id, projectId);

    if (!deleted.ok) {
        return { ok: false, error: "Failed to delete permission." };
    }

    await logAuditEvent({
        projectId,
        userId: authData.user.id,
        entityType: "permission",
        entityId: id,
        action: "deleted",
        metadata: {
            name: existingPermission?.name ?? null,
            slug: existingPermission?.slug ?? null,
        },
    });

    return { ok: true, data: { id } };
}

export async function togglePermissionAction(
    projectId: string,
    id: string,
    enabled: boolean
): Promise<ActionResult<PermissionRecord>> {
    const supabase = await createSupabaseServerClient();
    const { data: authData } = await supabase.auth.getUser();

    if (!authData?.user) {
        return { ok: false, error: "Unauthorized." };
    }

    const projectCheck = await verifyProjectAccess(supabase, projectId);
    if (!projectCheck.ok) {
        return { ok: false, error: projectCheck.error };
    }

    const updated = await togglePermission(id, enabled, projectId);

    if (!updated.ok) {
        return { ok: false, error: "Failed to toggle permission." };
    }

    await logAuditEvent({
        projectId,
        userId: authData.user.id,
        entityType: "permission",
        entityId: updated.data.id,
        action: "updated",
        metadata: {
            event: enabled ? "permission_enabled" : "permission_disabled",
            name: updated.data.name,
            slug: updated.data.slug,
            enabled,
        },
    });

    return { ok: true, data: updated.data };
}

export async function bulkTogglePermissionsAction(
    projectId: string,
    ids: string[],
    enabled: boolean
): Promise<ActionResult<PermissionRecord[]>> {
    const supabase = await createSupabaseServerClient();
    const { data: authData } = await supabase.auth.getUser();

    if (!authData?.user) {
        return { ok: false, error: "Unauthorized." };
    }

    const projectCheck = await verifyProjectAccess(supabase, projectId);
    if (!projectCheck.ok) {
        return { ok: false, error: projectCheck.error };
    }

    const normalizedIds = Array.from(new Set((ids ?? []).filter(Boolean)));
    if (normalizedIds.length === 0) {
        return { ok: true, data: [] };
    }

    const { data: updatedRows, error: updateError } = await supabase
        .from("permissions")
        .update({ enabled })
        .eq("project_id", projectId)
        .in("id", normalizedIds)
        .select("*");

    if (updateError) {
        return { ok: false, error: "Failed to update permissions." };
    }

    const updated = (updatedRows ?? []) as PermissionRecord[];

    await Promise.all(
        updated.map((permission) =>
            logAuditEvent({
                projectId,
                userId: authData.user.id,
                entityType: "permission",
                entityId: permission.id,
                action: "updated",
                metadata: {
                    event: enabled ? "permission_enabled" : "permission_disabled",
                    name: permission.name,
                    slug: permission.slug,
                    enabled,
                    source: "bulk",
                },
            })
        )
    );

    return { ok: true, data: updated };
}

export async function bulkDeletePermissionsAction(
    projectId: string,
    ids: string[]
): Promise<ActionResult<{
    deletedIds: string[];
    skippedSystemIds: string[];
    failedIds: string[];
}>> {
    const supabase = await createSupabaseServerClient();
    const { data: authData } = await supabase.auth.getUser();

    if (!authData?.user) {
        return { ok: false, error: "Unauthorized." };
    }

    const projectCheck = await verifyProjectAccess(supabase, projectId);
    if (!projectCheck.ok) {
        return { ok: false, error: projectCheck.error };
    }

    const normalizedIds = Array.from(new Set((ids ?? []).filter(Boolean)));
    if (normalizedIds.length === 0) {
        return {
            ok: true,
            data: { deletedIds: [], skippedSystemIds: [], failedIds: [] },
        };
    }

    const { data: existing, error: existingError } = await supabase
        .from("permissions")
        .select("id, is_system, name, slug")
        .eq("project_id", projectId)
        .in("id", normalizedIds);

    if (existingError) {
        return { ok: false, error: "Failed to load permissions." };
    }

    const deletedIds: string[] = [];
    const skippedSystemIds: string[] = [];
    const failedIds: string[] = [];

    for (const permission of existing ?? []) {
        if (permission.is_system) {
            skippedSystemIds.push(permission.id);
            continue;
        }

        const deleted = await deletePermission(permission.id, projectId);
        if (!deleted.ok) {
            failedIds.push(permission.id);
            continue;
        }

        deletedIds.push(permission.id);

        await logAuditEvent({
            projectId,
            userId: authData.user.id,
            entityType: "permission",
            entityId: permission.id,
            action: "deleted",
            metadata: {
                name: permission.name,
                slug: permission.slug,
                source: "bulk",
            },
        });
    }

    return { ok: true, data: { deletedIds, skippedSystemIds, failedIds } };
}
