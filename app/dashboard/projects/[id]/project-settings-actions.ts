"use server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { logAuditEvent } from "@/lib/auditLogs";
import type { ProjectRecord } from "@/lib/projects";

type ActionResult<T> =
    | { ok: true; data: T }
    | { ok: false; error: string };

export type ProjectConfigPermission = {
    slug: string;
    name: string;
    description: string | null;
    risk_level: "low" | "medium" | "high";
    enabled: boolean;
    is_system: boolean;
};

export type ProjectConfigRole = {
    slug: string;
    name: string;
    description: string | null;
    is_system: boolean;
    permission_slugs: string[];
};

export type ProjectConfigExport = {
    version: 1;
    exported_at: string;
    project: {
        id: string;
        slug: string;
        name: string;
    };
    permissions: ProjectConfigPermission[];
    roles: ProjectConfigRole[];
};

export type ProjectConfigImportPreview = {
    permissionSummary: {
        create: number;
        update: number;
        skip: number;
    };
    roleSummary: {
        create: number;
        update: number;
        skip: number;
    };
    assignmentSummary: {
        update: number;
        missingPermissionReferences: number;
    };
    skippedInvalidPermissions: number;
    skippedInvalidRoles: number;
    conflicts: string[];
    notes: string[];
};

const SLUG_REGEX = /^[a-z0-9.]+$/;
const MAX_NAME_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 1000;
const VALID_STATUSES = new Set(["active", "archived"]);
const VALID_RISK_LEVELS = new Set(["low", "medium", "high"]);

function normalizeName(name: string) {
    return name.trim();
}

function normalizeSlug(slug: string) {
    return slug.trim().toLowerCase();
}

function normalizeDescription(description?: string) {
    const trimmed = (description ?? "").trim();
    return trimmed.length ? trimmed : null;
}

function validateName(name: string) {
    if (!name) return "Project name is required.";
    if (name.length < 2) return "Project name is too short.";
    if (name.length > MAX_NAME_LENGTH) return "Project name is too long.";
    return null;
}

function validateSlug(slug: string) {
    if (!slug) return "Project slug is required.";
    if (!SLUG_REGEX.test(slug)) {
        return "Slug can only contain lowercase letters, numbers and dots.";
    }
    return null;
}

function validateDescription(description?: string) {
    if (!description) return null;
    if (description.length > MAX_DESCRIPTION_LENGTH) {
        return "Description is too long.";
    }
    return null;
}

function validateStatus(status: string) {
    if (!VALID_STATUSES.has(status)) {
        return "Invalid project status.";
    }
    return null;
}

async function getProjectForUpdate(
    supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
    projectId: string
) {
    const { data, error } = await supabase
        .from("projects")
        .select("id, owner_id, name, slug, description, status, created_at, updated_at, archived_at, deleted_at")
        .eq("id", projectId)
        .is("deleted_at", null)
        .single();

    if (error || !data) {
        return { ok: false, error: "Project not found." } as const;
    }

    return { ok: true, data: data as ProjectRecord } as const;
}

async function ensureProjectAccess(
    supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
    projectId: string
) {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) {
        return { ok: false, error: "Unauthorized.", userId: null } as const;
    }

    const project = await getProjectForUpdate(supabase, projectId);
    if (!project.ok) {
        return { ok: false, error: project.error, userId: authData.user.id } as const;
    }

    return { ok: true, userId: authData.user.id, project: project.data } as const;
}

async function hasDuplicateProjectSlug(
    supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
    slug: string,
    excludeProjectId: string
) {
    const { data, error } = await supabase
        .from("projects")
        .select("id")
        .eq("slug", slug)
        .is("deleted_at", null)
        .neq("id", excludeProjectId)
        .limit(1);

    if (error) {
        return { ok: false, error: "Failed to validate project slug." } as const;
    }

    return { ok: true, exists: (data?.length ?? 0) > 0 } as const;
}

export async function updateProjectSettingsAction(
    projectId: string,
    payload: {
        name: string;
        slug: string;
        description?: string;
        status: string;
    }
): Promise<ActionResult<ProjectRecord>> {
    const supabase = await createSupabaseServerClient();
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) return { ok: false, error: "Unauthorized." };

    const projectCheck = await getProjectForUpdate(supabase, projectId);
    if (!projectCheck.ok) return { ok: false, error: projectCheck.error };

    const name = normalizeName(payload.name);
    const slug = normalizeSlug(payload.slug);
    const description = normalizeDescription(payload.description);
    const status = payload.status;

    const nameError = validateName(name);
    if (nameError) return { ok: false, error: nameError };
    const slugError = validateSlug(slug);
    if (slugError) return { ok: false, error: slugError };
    const descriptionError = validateDescription(description ?? undefined);
    if (descriptionError) return { ok: false, error: descriptionError };
    const statusError = validateStatus(status);
    if (statusError) return { ok: false, error: statusError };

    const duplicateSlug = await hasDuplicateProjectSlug(supabase, slug, projectId);
    if (!duplicateSlug.ok) return { ok: false, error: duplicateSlug.error };
    if (duplicateSlug.exists) {
        return { ok: false, error: "Project slug already exists." };
    }

    const nextArchivedAt = status === "archived" ? (projectCheck.data.archived_at ?? new Date().toISOString()) : null;

    const { data: updated, error } = await supabase
        .from("projects")
        .update({
            name,
            slug,
            description,
            status,
            archived_at: nextArchivedAt,
            updated_at: new Date().toISOString(),
        })
        .eq("id", projectId)
        .is("deleted_at", null)
        .select("id, owner_id, name, slug, description, status, created_at, updated_at, archived_at, deleted_at")
        .single();

    if (error || !updated) {
        return { ok: false, error: "Failed to update project settings." };
    }

    await logAuditEvent({
        projectId,
        userId: authData.user.id,
        entityType: "project",
        entityId: updated.id,
        action: "updated",
        metadata: {
            event: "project_settings_updated",
            name: updated.name,
            slug: updated.slug,
            status: updated.status,
        },
    });

    return { ok: true, data: updated as ProjectRecord };
}

export async function changeProjectOwnerAction(
    projectId: string,
    nextOwnerId: string
): Promise<ActionResult<ProjectRecord>> {
    const supabase = await createSupabaseServerClient();
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) return { ok: false, error: "Unauthorized." };

    const normalizedOwnerId = nextOwnerId.trim();
    if (!normalizedOwnerId) {
        return { ok: false, error: "Owner ID is required." };
    }

    const projectCheck = await getProjectForUpdate(supabase, projectId);
    if (!projectCheck.ok) return { ok: false, error: projectCheck.error };

    const { data: updated, error } = await supabase
        .from("projects")
        .update({
            owner_id: normalizedOwnerId,
            updated_at: new Date().toISOString(),
        })
        .eq("id", projectId)
        .is("deleted_at", null)
        .select("id, owner_id, name, slug, description, status, created_at, updated_at, archived_at, deleted_at")
        .single();

    if (error || !updated) {
        return { ok: false, error: "Failed to update project owner." };
    }

    await logAuditEvent({
        projectId,
        userId: authData.user.id,
        entityType: "project",
        entityId: updated.id,
        action: "updated",
        metadata: {
            event: "project_owner_changed",
            owner_id: updated.owner_id,
        },
    });

    return { ok: true, data: updated as ProjectRecord };
}

export async function archiveProjectAction(projectId: string): Promise<ActionResult<ProjectRecord>> {
    const supabase = await createSupabaseServerClient();
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) return { ok: false, error: "Unauthorized." };

    const projectCheck = await getProjectForUpdate(supabase, projectId);
    if (!projectCheck.ok) return { ok: false, error: projectCheck.error };

    const { data: updated, error } = await supabase
        .from("projects")
        .update({
            status: "archived",
            archived_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq("id", projectId)
        .is("deleted_at", null)
        .select("id, owner_id, name, slug, description, status, created_at, updated_at, archived_at, deleted_at")
        .single();

    if (error || !updated) {
        return { ok: false, error: "Failed to archive project." };
    }

    await logAuditEvent({
        projectId,
        userId: authData.user.id,
        entityType: "project",
        entityId: updated.id,
        action: "updated",
        metadata: {
            event: "project_archived",
            name: updated.name,
            slug: updated.slug,
        },
    });

    return { ok: true, data: updated as ProjectRecord };
}

export async function restoreProjectAction(projectId: string): Promise<ActionResult<ProjectRecord>> {
    const supabase = await createSupabaseServerClient();
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) return { ok: false, error: "Unauthorized." };

    const projectCheck = await getProjectForUpdate(supabase, projectId);
    if (!projectCheck.ok) return { ok: false, error: projectCheck.error };

    const { data: updated, error } = await supabase
        .from("projects")
        .update({
            status: "active",
            archived_at: null,
            updated_at: new Date().toISOString(),
        })
        .eq("id", projectId)
        .is("deleted_at", null)
        .select("id, owner_id, name, slug, description, status, created_at, updated_at, archived_at, deleted_at")
        .single();

    if (error || !updated) {
        return { ok: false, error: "Failed to restore project." };
    }

    await logAuditEvent({
        projectId,
        userId: authData.user.id,
        entityType: "project",
        entityId: updated.id,
        action: "updated",
        metadata: {
            event: "project_restored",
            name: updated.name,
            slug: updated.slug,
        },
    });

    return { ok: true, data: updated as ProjectRecord };
}

export async function deleteProjectAction(projectId: string): Promise<ActionResult<{ id: string }>> {
    const supabase = await createSupabaseServerClient();
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) return { ok: false, error: "Unauthorized." };

    const { error } = await supabase
        .from("projects")
        .delete()
        .eq("id", projectId);

    if (error) {
        return { ok: false, error: error.message || "Failed to delete project." };
    }

    return { ok: true, data: { id: projectId } };
}

function normalizeImportPermission(raw: ProjectConfigPermission): ProjectConfigPermission | null {
    const slug = normalizeSlug(raw.slug ?? "");
    const name = normalizeName(raw.name ?? "");
    const description = normalizeDescription(raw.description ?? undefined);
    const riskLevel = raw.risk_level;
    const enabled = Boolean(raw.enabled);
    const is_system = Boolean(raw.is_system);

    if (!slug || !name || !SLUG_REGEX.test(slug)) return null;
    if (!VALID_RISK_LEVELS.has(riskLevel)) return null;
    return {
        slug,
        name,
        description,
        risk_level: riskLevel,
        enabled,
        is_system,
    };
}

function normalizeImportRole(raw: ProjectConfigRole): ProjectConfigRole | null {
    const slug = normalizeSlug(raw.slug ?? "");
    const name = normalizeName(raw.name ?? "");
    const description = normalizeDescription(raw.description ?? undefined);
    const is_system = Boolean(raw.is_system);
    const permission_slugs = Array.from(
        new Set((raw.permission_slugs ?? []).map((item) => normalizeSlug(item)).filter(Boolean))
    );

    if (!slug || !name || !SLUG_REGEX.test(slug)) return null;
    return {
        slug,
        name,
        description,
        is_system,
        permission_slugs,
    };
}

function parseConfigPayload(input: unknown) {
    if (!input || typeof input !== "object") {
        return { ok: false, error: "Invalid config file format." } as const;
    }
    const payload = input as Partial<ProjectConfigExport>;

    if (payload.version !== 1) {
        return { ok: false, error: "Invalid config file format." } as const;
    }

    const rawPermissions = Array.isArray(payload.permissions) ? payload.permissions : [];
    const rawRoles = Array.isArray(payload.roles) ? payload.roles : [];

    const permissions = rawPermissions
        .map((permission) => normalizeImportPermission(permission))
        .filter((permission): permission is ProjectConfigPermission => Boolean(permission));
    const roles = rawRoles
        .map((role) => normalizeImportRole(role))
        .filter((role): role is ProjectConfigRole => Boolean(role));

    return {
        ok: true,
        permissions,
        roles,
        skippedInvalidPermissions: rawPermissions.length - permissions.length,
        skippedInvalidRoles: rawRoles.length - roles.length,
    } as const;
}

export async function previewProjectConfigImportAction(
    projectId: string,
    input: unknown
): Promise<ActionResult<ProjectConfigImportPreview>> {
    const supabase = await createSupabaseServerClient();
    const access = await ensureProjectAccess(supabase, projectId);
    if (!access.ok) return { ok: false, error: access.error };

    const parsed = parseConfigPayload(input);
    if (!parsed.ok) return { ok: false, error: parsed.error };

    const { data: existingPermissions, error: existingPermissionsError } = await supabase
        .from("permissions")
        .select("slug, is_system")
        .eq("project_id", projectId);
    if (existingPermissionsError) return { ok: false, error: "Failed to inspect existing permissions." };

    const { data: existingRoles, error: existingRolesError } = await supabase
        .from("roles")
        .select("slug, is_system")
        .eq("project_id", projectId);
    if (existingRolesError) return { ok: false, error: "Failed to inspect existing roles." };

    const existingPermissionBySlug = new Map(
        (existingPermissions ?? []).map((permission) => [permission.slug, permission])
    );
    const existingRoleBySlug = new Map((existingRoles ?? []).map((role) => [role.slug, role]));

    let permissionCreate = 0;
    let permissionUpdate = 0;
    let permissionSkip = 0;
    let roleCreate = 0;
    let roleUpdate = 0;
    let roleSkip = 0;
    let assignmentUpdate = 0;
    let missingPermissionReferences = 0;
    const conflicts: string[] = [];
    const notes: string[] = [];

    const importedPermissionSlugs = new Set(parsed.permissions.map((permission) => permission.slug));

    for (const permission of parsed.permissions) {
        const existing = existingPermissionBySlug.get(permission.slug);
        if (!existing) {
            permissionCreate += 1;
            continue;
        }
        if (existing.is_system) {
            permissionSkip += 1;
            conflicts.push(`Permission "${permission.slug}" is a system permission and will be skipped.`);
            continue;
        }
        permissionUpdate += 1;
    }

    for (const role of parsed.roles) {
        const existing = existingRoleBySlug.get(role.slug);
        if (!existing) {
            roleCreate += 1;
        } else if (existing.is_system) {
            roleSkip += 1;
            conflicts.push(`Role "${role.slug}" is a system role and will be skipped.`);
        } else {
            roleUpdate += 1;
        }

        const missingForRole = role.permission_slugs.filter((slug) => {
            if (importedPermissionSlugs.has(slug)) return false;
            return !existingPermissionBySlug.has(slug);
        });
        if (missingForRole.length > 0) {
            missingPermissionReferences += missingForRole.length;
            conflicts.push(
                `Role "${role.slug}" references missing permissions: ${missingForRole.slice(0, 4).join(", ")}${
                    missingForRole.length > 4 ? "..." : ""
                }.`
            );
        }
        assignmentUpdate += 1;
    }

    if (parsed.skippedInvalidPermissions > 0) {
        notes.push(`${parsed.skippedInvalidPermissions} invalid permission entries will be ignored.`);
    }
    if (parsed.skippedInvalidRoles > 0) {
        notes.push(`${parsed.skippedInvalidRoles} invalid role entries will be ignored.`);
    }
    if (assignmentUpdate === 0) {
        notes.push("No role assignments found in this file.");
    }

    return {
        ok: true,
        data: {
            permissionSummary: {
                create: permissionCreate,
                update: permissionUpdate,
                skip: permissionSkip,
            },
            roleSummary: {
                create: roleCreate,
                update: roleUpdate,
                skip: roleSkip,
            },
            assignmentSummary: {
                update: assignmentUpdate,
                missingPermissionReferences,
            },
            skippedInvalidPermissions: parsed.skippedInvalidPermissions,
            skippedInvalidRoles: parsed.skippedInvalidRoles,
            conflicts,
            notes,
        },
    };
}

export async function exportProjectConfigAction(
    projectId: string
): Promise<ActionResult<ProjectConfigExport>> {
    const supabase = await createSupabaseServerClient();
    const access = await ensureProjectAccess(supabase, projectId);
    if (!access.ok) return { ok: false, error: access.error };

    const { data: permissions, error: permissionsError } = await supabase
        .from("permissions")
        .select("id, slug, name, description, risk_level, enabled, is_system")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });

    if (permissionsError) return { ok: false, error: "Failed to export permissions." };

    const { data: roles, error: rolesError } = await supabase
        .from("roles")
        .select("id, slug, name, description, is_system")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });

    if (rolesError) return { ok: false, error: "Failed to export roles." };

    const roleIds = (roles ?? []).map((role) => role.id);
    const { data: rolePermissions, error: rolePermissionsError } = roleIds.length
        ? await supabase
              .from("role_permissions")
              .select("role_id, permission_id")
              .in("role_id", roleIds)
        : { data: [], error: null };

    if (rolePermissionsError) return { ok: false, error: "Failed to export role assignments." };

    const permissionSlugById = new Map<string, string>();
    for (const permission of permissions ?? []) {
        permissionSlugById.set(permission.id, permission.slug);
    }

    const permissionSlugsByRoleId = new Map<string, string[]>();
    for (const row of rolePermissions ?? []) {
        const slug = permissionSlugById.get(row.permission_id);
        if (!slug) continue;
        const current = permissionSlugsByRoleId.get(row.role_id) ?? [];
        current.push(slug);
        permissionSlugsByRoleId.set(row.role_id, current);
    }

    const payload: ProjectConfigExport = {
        version: 1,
        exported_at: new Date().toISOString(),
        project: {
            id: access.project.id,
            slug: access.project.slug,
            name: access.project.name,
        },
        permissions: (permissions ?? []).map((permission) => ({
            slug: permission.slug,
            name: permission.name,
            description: permission.description,
            risk_level: permission.risk_level,
            enabled: permission.enabled,
            is_system: permission.is_system,
        })),
        roles: (roles ?? []).map((role) => ({
            slug: role.slug,
            name: role.name,
            description: role.description,
            is_system: role.is_system,
            permission_slugs: permissionSlugsByRoleId.get(role.id) ?? [],
        })),
    };

    await logAuditEvent({
        projectId,
        userId: access.userId,
        entityType: "project",
        entityId: projectId,
        action: "updated",
        metadata: {
            event: "project_config_exported",
            permission_count: payload.permissions.length,
            role_count: payload.roles.length,
        },
    });

    return { ok: true, data: payload };
}

export async function importProjectConfigAction(
    projectId: string,
    input: unknown
): Promise<
    ActionResult<{
        importedPermissions: number;
        importedRoles: number;
        assignmentUpdates: number;
        skippedInvalidPermissions: number;
        skippedInvalidRoles: number;
    }>
> {
    const supabase = await createSupabaseServerClient();
    const access = await ensureProjectAccess(supabase, projectId);
    if (!access.ok) return { ok: false, error: access.error };

    const parsed = parseConfigPayload(input);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    const { permissions, roles, skippedInvalidPermissions, skippedInvalidRoles } = parsed;

    const { data: existingPermissions, error: existingPermissionsError } = await supabase
        .from("permissions")
        .select("id, slug, is_system")
        .eq("project_id", projectId);
    if (existingPermissionsError) return { ok: false, error: "Failed to load existing permissions." };

    const existingPermissionBySlug = new Map(
        (existingPermissions ?? []).map((permission) => [permission.slug, permission])
    );

    let importedPermissions = 0;

    for (const permission of permissions) {
        const existing = existingPermissionBySlug.get(permission.slug);
        if (!existing) {
            const { data: created, error } = await supabase
                .from("permissions")
                .insert({
                    project_id: projectId,
                    slug: permission.slug,
                    name: permission.name,
                    description: permission.description,
                    risk_level: permission.risk_level,
                    enabled: permission.enabled,
                    is_system: permission.is_system,
                })
                .select("id, slug, is_system")
                .single();
            if (error || !created) continue;
            existingPermissionBySlug.set(created.slug, created);
            importedPermissions += 1;
            continue;
        }

        if (existing.is_system) continue;

        const { error } = await supabase
            .from("permissions")
            .update({
                name: permission.name,
                description: permission.description,
                risk_level: permission.risk_level,
                enabled: permission.enabled,
                is_system: permission.is_system,
                updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id)
            .eq("project_id", projectId);
        if (!error) importedPermissions += 1;
    }

    const { data: allPermissions, error: allPermissionsError } = await supabase
        .from("permissions")
        .select("id, slug")
        .eq("project_id", projectId);
    if (allPermissionsError) return { ok: false, error: "Failed to refresh permissions." };
    const permissionIdBySlug = new Map((allPermissions ?? []).map((permission) => [permission.slug, permission.id]));

    const { data: existingRoles, error: existingRolesError } = await supabase
        .from("roles")
        .select("id, slug, is_system")
        .eq("project_id", projectId);
    if (existingRolesError) return { ok: false, error: "Failed to load existing roles." };
    const existingRoleBySlug = new Map((existingRoles ?? []).map((role) => [role.slug, role]));

    let importedRoles = 0;
    let assignmentUpdates = 0;

    for (const role of roles) {
        const permissionIds = role.permission_slugs
            .map((slug) => permissionIdBySlug.get(slug))
            .filter((id): id is string => Boolean(id));

        const existing = existingRoleBySlug.get(role.slug);
        if (!existing) {
            const { data: createdRole, error: createRoleError } = await supabase
                .from("roles")
                .insert({
                    project_id: projectId,
                    slug: role.slug,
                    name: role.name,
                    description: role.description,
                    is_system: role.is_system,
                })
                .select("id, slug, is_system")
                .single();
            if (createRoleError || !createdRole) continue;

            if (permissionIds.length > 0) {
                const inserts = permissionIds.map((permissionId) => ({
                    role_id: createdRole.id,
                    permission_id: permissionId,
                }));
                const { error: linkError } = await supabase.from("role_permissions").insert(inserts);
                if (!linkError) assignmentUpdates += 1;
            }
            importedRoles += 1;
            existingRoleBySlug.set(createdRole.slug, createdRole);
            continue;
        }

        if (existing.is_system) continue;

        const { error: updateRoleError } = await supabase
            .from("roles")
            .update({
                name: role.name,
                description: role.description,
                is_system: role.is_system,
                updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id)
            .eq("project_id", projectId);
        if (!updateRoleError) importedRoles += 1;

        const { error: deleteLinksError } = await supabase
            .from("role_permissions")
            .delete()
            .eq("role_id", existing.id);
        if (deleteLinksError) continue;

        if (permissionIds.length > 0) {
            const inserts = permissionIds.map((permissionId) => ({
                role_id: existing.id,
                permission_id: permissionId,
            }));
            const { error: insertLinksError } = await supabase.from("role_permissions").insert(inserts);
            if (insertLinksError) continue;
        }
        assignmentUpdates += 1;
    }

    await logAuditEvent({
        projectId,
        userId: access.userId,
        entityType: "project",
        entityId: projectId,
        action: "updated",
        metadata: {
            event: "project_config_imported",
            imported_permissions: importedPermissions,
            imported_roles: importedRoles,
            assignment_updates: assignmentUpdates,
            skipped_invalid_permissions: skippedInvalidPermissions,
            skipped_invalid_roles: skippedInvalidRoles,
        },
    });

    return {
        ok: true,
        data: {
            importedPermissions,
            importedRoles,
            assignmentUpdates,
            skippedInvalidPermissions,
            skippedInvalidRoles,
        },
    };
}
