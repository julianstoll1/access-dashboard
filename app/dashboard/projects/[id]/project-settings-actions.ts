"use server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { logAuditEvent } from "@/lib/auditLogs";
import type { ProjectRecord } from "@/lib/projects";

type ActionResult<T> =
    | { ok: true; data: T }
    | { ok: false; error: string };

const SLUG_REGEX = /^[a-z0-9.]+$/;
const MAX_NAME_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 1000;
const VALID_STATUSES = new Set(["active", "archived"]);

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
