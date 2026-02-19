"use server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
    createRole,
    deleteRole,
    RoleWithPermissions,
    updateRole,
} from "@/lib/roles";

export type ActionResult<T> =
    | { ok: true; data: T }
    | { ok: false; error: string };

const MAX_NAME_LENGTH = 64;
const MAX_DESCRIPTION_LENGTH = 500;
const SLUG_REGEX = /^[a-z0-9.]+$/;

function normalizeName(name: string) {
    return name.trim();
}

function normalizeDescription(description?: string) {
    const trimmed = (description ?? "").trim();
    return trimmed.length ? trimmed : null;
}

function normalizeSlug(slug: string) {
    return slug.trim().toLowerCase();
}

function normalizePermissionIds(permissionIds: string[]) {
    return Array.from(new Set((permissionIds ?? []).filter(Boolean)));
}

function validateName(name: string) {
    if (!name) return "Role name is required.";
    if (name.length < 2) return "Role name is too short.";
    if (name.length > MAX_NAME_LENGTH) return "Role name is too long.";
    return null;
}

function validateDescription(description?: string) {
    if (!description) return null;
    if (description.length > MAX_DESCRIPTION_LENGTH) {
        return "Description is too long.";
    }
    return null;
}

function validateSlug(slug: string) {
    if (!slug) return "Slug is required.";
    if (slug.length < 2) return "Slug is too short.";
    if (slug.length > 64) return "Slug is too long.";
    if (!SLUG_REGEX.test(slug)) {
        return "Slug can only contain lowercase letters, numbers and dots.";
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
        .from("roles")
        .select("id")
        .eq("project_id", projectId)
        .ilike("name", name)
        .limit(1);

    if (excludeId) {
        query = query.neq("id", excludeId);
    }

    const { data, error } = await query;

    if (error) {
        return { ok: false, error: "Failed to validate role name." } as const;
    }

    return { ok: true, exists: (data?.length ?? 0) > 0 } as const;
}

async function hasDuplicateSlug(
    supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
    projectId: string,
    slug: string,
    excludeId?: string
) {
    let query = supabase
        .from("roles")
        .select("id")
        .eq("project_id", projectId)
        .ilike("slug", slug)
        .limit(1);

    if (excludeId) {
        query = query.neq("id", excludeId);
    }

    const { data, error } = await query;

    if (error) {
        return { ok: false, error: "Failed to validate role slug." } as const;
    }

    return { ok: true, exists: (data?.length ?? 0) > 0 } as const;
}

async function validatePermissionsBelongToProject(
    supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
    projectId: string,
    permissionIds: string[]
) {
    if (permissionIds.length === 0) {
        return { ok: true } as const;
    }

    const { data, error } = await supabase
        .from("permissions")
        .select("id")
        .eq("project_id", projectId)
        .in("id", permissionIds);

    if (error) {
        return { ok: false, error: "Failed to validate permissions." } as const;
    }

    const validIds = new Set((data ?? []).map((row) => row.id));
    const invalid = permissionIds.some((id) => !validIds.has(id));

    if (invalid) {
        return { ok: false, error: "Invalid permissions selected." } as const;
    }

    return { ok: true } as const;
}

export async function createRoleAction(
    projectId: string,
    data: {
        name: string;
        slug: string;
        description?: string;
        permission_ids: string[];
        is_system?: boolean;
    }
): Promise<ActionResult<RoleWithPermissions>> {
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
    const normalizedDescription = normalizeDescription(data.description);
    const normalizedPermissionIds = normalizePermissionIds(data.permission_ids);

    const nameError = validateName(normalizedName);
    if (nameError) return { ok: false, error: nameError };
    const slugError = validateSlug(normalizedSlug);
    if (slugError) return { ok: false, error: slugError };

    const descriptionError = validateDescription(normalizedDescription ?? undefined);
    if (descriptionError) return { ok: false, error: descriptionError };

    const duplicateCheck = await hasDuplicateName(supabase, projectId, normalizedName);
    if (!duplicateCheck.ok) return { ok: false, error: duplicateCheck.error };
    if (duplicateCheck.exists) {
        return { ok: false, error: "Role name already exists." };
    }
    const duplicateSlugCheck = await hasDuplicateSlug(supabase, projectId, normalizedSlug);
    if (!duplicateSlugCheck.ok) return { ok: false, error: duplicateSlugCheck.error };
    if (duplicateSlugCheck.exists) {
        return { ok: false, error: "Role slug already exists." };
    }

    const permissionsCheck = await validatePermissionsBelongToProject(
        supabase,
        projectId,
        normalizedPermissionIds
    );
    if (!permissionsCheck.ok) {
        return { ok: false, error: permissionsCheck.error };
    }

    const created = await createRole(projectId, {
        name: normalizedName,
        slug: normalizedSlug,
        description: normalizedDescription,
        permission_ids: normalizedPermissionIds,
        is_system: Boolean(data.is_system),
    });

    if (!created.ok) {
        return { ok: false, error: "Failed to create role." };
    }

    return { ok: true, data: created.data };
}

export async function updateRoleAction(
    projectId: string,
    id: string,
    data: {
        name: string;
        slug: string;
        description?: string;
        permission_ids: string[];
        is_system: boolean;
    }
): Promise<ActionResult<RoleWithPermissions>> {
    const supabase = await createSupabaseServerClient();
    const { data: authData } = await supabase.auth.getUser();

    if (!authData?.user) {
        return { ok: false, error: "Unauthorized." };
    }

    const projectCheck = await verifyProjectAccess(supabase, projectId);
    if (!projectCheck.ok) {
        return { ok: false, error: projectCheck.error };
    }

    const { data: existingRole, error: roleError } = await supabase
        .from("roles")
        .select("id, is_system")
        .eq("id", id)
        .eq("project_id", projectId)
        .single();

    if (roleError || !existingRole) {
        return { ok: false, error: "Role not found." };
    }

    const normalizedName = normalizeName(data.name);
    const normalizedSlug = normalizeSlug(data.slug);
    const normalizedDescription = normalizeDescription(data.description);
    const normalizedPermissionIds = normalizePermissionIds(data.permission_ids);

    const nameError = validateName(normalizedName);
    if (nameError) return { ok: false, error: nameError };
    const slugError = validateSlug(normalizedSlug);
    if (slugError) return { ok: false, error: slugError };

    const descriptionError = validateDescription(normalizedDescription ?? undefined);
    if (descriptionError) return { ok: false, error: descriptionError };

    const duplicateCheck = await hasDuplicateName(
        supabase,
        projectId,
        normalizedName,
        id
    );
    if (!duplicateCheck.ok) return { ok: false, error: duplicateCheck.error };
    if (duplicateCheck.exists) {
        return { ok: false, error: "Role name already exists." };
    }
    const duplicateSlugCheck = await hasDuplicateSlug(
        supabase,
        projectId,
        normalizedSlug,
        id
    );
    if (!duplicateSlugCheck.ok) return { ok: false, error: duplicateSlugCheck.error };
    if (duplicateSlugCheck.exists) {
        return { ok: false, error: "Role slug already exists." };
    }

    const permissionsCheck = await validatePermissionsBelongToProject(
        supabase,
        projectId,
        normalizedPermissionIds
    );
    if (!permissionsCheck.ok) {
        return { ok: false, error: permissionsCheck.error };
    }

    const updated = await updateRole(id, projectId, {
        name: normalizedName,
        slug: normalizedSlug,
        description: normalizedDescription,
        permission_ids: normalizedPermissionIds,
        is_system: Boolean(data.is_system),
    });

    if (!updated.ok) {
        return { ok: false, error: "Failed to update role." };
    }

    return { ok: true, data: updated.data };
}

export async function deleteRoleAction(
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

    const { data: existingRole, error: roleError } = await supabase
        .from("roles")
        .select("id, is_system")
        .eq("id", id)
        .eq("project_id", projectId)
        .single();

    if (roleError || !existingRole) {
        return { ok: false, error: "Role not found." };
    }

    if (existingRole.is_system) {
        return { ok: false, error: "System roles cannot be deleted." };
    }

    const deleted = await deleteRole(id, projectId);

    if (!deleted.ok) {
        return { ok: false, error: "Failed to delete role." };
    }

    return { ok: true, data: { id } };
}
