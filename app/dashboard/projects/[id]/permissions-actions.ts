"use server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createPermission, updatePermission, deletePermission, togglePermission } from "@/lib/permissions";

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

    const deleted = await deletePermission(id, projectId);

    if (!deleted.ok) {
        return { ok: false, error: "Failed to delete permission." };
    }

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

    return { ok: true, data: updated.data };
}
