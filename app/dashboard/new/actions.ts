"use server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { logAuditEvent } from "@/lib/auditLogs";

export type CreateProjectResult =
    | {
    ok: true;
    data: {
        id: string;
        slug: string;
        name: string;
        description: string | null;
        status: string;
    };
}
    | { ok: false; error: string };

const SLUG_REGEX = /^[a-z0-9.]+$/;
const MAX_NAME_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 1000;

function normalizeName(value: string) {
    return value.trim();
}

function normalizeSlug(value: string) {
    return value.trim().toLowerCase();
}

function normalizeDescription(value?: string) {
    const trimmed = (value ?? "").trim();
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
        return "Use lowercase letters, numbers, and dots only.";
    }
    if (slug.length < 2) return "Project slug is too short.";
    if (slug.length > 120) return "Project slug is too long.";
    return null;
}

function validateDescription(description?: string) {
    if (!description) return null;
    if (description.length > MAX_DESCRIPTION_LENGTH) {
        return "Description is too long.";
    }
    return null;
}

export async function createProjectAction(input: {
    name: string;
    slug: string;
    description?: string;
}): Promise<CreateProjectResult> {
    const supabase = await createSupabaseServerClient();
    const { data: authData } = await supabase.auth.getUser();

    if (!authData?.user) {
        return { ok: false, error: "Unauthorized." };
    }

    const name = normalizeName(input.name);
    const slug = normalizeSlug(input.slug);
    const description = normalizeDescription(input.description);

    const nameError = validateName(name);
    if (nameError) return { ok: false, error: nameError };

    const slugError = validateSlug(slug);
    if (slugError) return { ok: false, error: slugError };

    const descriptionError = validateDescription(description ?? undefined);
    if (descriptionError) return { ok: false, error: descriptionError };

    const { data: duplicate, error: duplicateError } = await supabase
        .from("projects")
        .select("id")
        .eq("slug", slug)
        .is("deleted_at", null)
        .limit(1);

    if (duplicateError) {
        return { ok: false, error: "Failed to validate project slug." };
    }

    if ((duplicate?.length ?? 0) > 0) {
        return { ok: false, error: "Project slug already exists. Please choose another one." };
    }

    const now = new Date().toISOString();

    const { data: created, error: createError } = await supabase
        .from("projects")
        .insert({
            owner_id: authData.user.id,
            name,
            slug,
            description,
            status: "active",
            created_at: now,
            updated_at: now,
            archived_at: null,
            deleted_at: null,
        })
        .select("id, slug, name, description, status")
        .single();

    if (createError || !created) {
        return { ok: false, error: "Failed to create project." };
    }

    await logAuditEvent({
        projectId: created.id,
        userId: authData.user.id,
        entityType: "project",
        entityId: created.id,
        action: "created",
        metadata: {
            event: "project_created",
            name: created.name,
            slug: created.slug,
            status: created.status,
        },
    });

    return { ok: true, data: created };
}
