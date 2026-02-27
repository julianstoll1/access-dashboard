"use server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { logAuditEvent } from "@/lib/auditLogs";
import { createPermission } from "@/lib/permissions";
import { createRole } from "@/lib/roles";
import { createApiKeyRecord } from "@/lib/apiKeys";

export type CreateProjectResult =
    | {
    ok: true;
    data: {
        id: string;
        slug: string;
        name: string;
        description: string | null;
        status: string;
        onboarding: {
            created_permission: boolean;
            created_role: boolean;
            created_api_key: boolean;
            api_key_name: string | null;
            api_key_value: string | null;
        };
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

function slugify(value: string) {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9.]+/g, ".")
        .replace(/\.{2,}/g, ".")
        .replace(/(^\.)|(\.$)/g, "");
}

function buildUniqueValue(base: string, existing: Set<string>) {
    let candidate = base;
    let index = 2;
    while (existing.has(candidate)) {
        candidate = `${base}.${index}`;
        index += 1;
    }
    existing.add(candidate);
    return candidate;
}

export type ProjectTemplateKey = "blank" | "starter" | "admin";

export async function createProjectAction(input: {
    name: string;
    slug: string;
    description?: string;
    template?: ProjectTemplateKey;
    create_first_permission?: boolean;
    create_first_role?: boolean;
    create_first_api_key?: boolean;
    first_permission_name?: string;
    first_permission_slug?: string;
    first_role_name?: string;
    first_role_slug?: string;
    first_api_key_name?: string;
    first_api_key_description?: string;
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

    const template = input.template ?? "blank";
    const shouldCreatePermission = Boolean(input.create_first_permission) || template === "starter" || template === "admin";
    const shouldCreateRole = Boolean(input.create_first_role) || template === "starter" || template === "admin";
    const shouldCreateApiKey = Boolean(input.create_first_api_key) || template === "admin";

    const usedPermissionSlugs = new Set<string>();
    const usedRoleSlugs = new Set<string>();

    let createdPermissionId: string | null = null;
    let createdPermission = false;
    let createdRole = false;
    let createdApiKey = false;
    let apiKeyName: string | null = null;
    let apiKeyValue: string | null = null;

    if (shouldCreatePermission) {
        const basePermissionName =
            normalizeName(input.first_permission_name || (template === "admin" ? "Manage access" : "Read access")) || "Read access";
        const basePermissionSlug =
            normalizeSlug(input.first_permission_slug || slugify(basePermissionName) || (template === "admin" ? "access.manage" : "access.read"));

        const permissionPresets =
            template === "admin"
                ? [
                      {
                          name: basePermissionName,
                          slug: buildUniqueValue(basePermissionSlug, usedPermissionSlugs),
                          description: "Allows access management actions in this project.",
                          risk_level: "high" as const,
                      },
                      {
                          name: "Read access",
                          slug: buildUniqueValue("access.read", usedPermissionSlugs),
                          description: "Allows read access to protected resources.",
                          risk_level: "low" as const,
                      },
                  ]
                : [
                      {
                          name: basePermissionName,
                          slug: buildUniqueValue(basePermissionSlug, usedPermissionSlugs),
                          description: "Starter permission for this project.",
                          risk_level: "low" as const,
                      },
                  ];

        for (const preset of permissionPresets) {
            const permissionResult = await createPermission(created.id, {
                name: preset.name,
                slug: preset.slug,
                description: preset.description,
                risk_level: preset.risk_level,
            });

            if (!permissionResult.ok) {
                return { ok: false, error: "Project was created, but starter permissions could not be created." };
            }

            if (!createdPermissionId) {
                createdPermissionId = permissionResult.data.id;
            }
            createdPermission = true;

            await logAuditEvent({
                projectId: created.id,
                userId: authData.user.id,
                entityType: "permission",
                entityId: permissionResult.data.id,
                action: "created",
                metadata: {
                    event: "project_onboarding_permission_created",
                    name: permissionResult.data.name,
                    slug: permissionResult.data.slug,
                    risk_level: permissionResult.data.risk_level,
                },
            });
        }
    }

    if (shouldCreateRole) {
        const baseRoleName =
            normalizeName(input.first_role_name || (template === "admin" ? "Admin" : "Member")) || "Member";
        const baseRoleSlug =
            normalizeSlug(input.first_role_slug || slugify(baseRoleName) || (template === "admin" ? "admin" : "member"));

        const rolePresets =
            template === "admin"
                ? [
                      {
                          name: baseRoleName,
                          slug: buildUniqueValue(baseRoleSlug, usedRoleSlugs),
                          description: "Full access role for managing this project.",
                          is_system: false,
                          permission_ids: createdPermissionId ? [createdPermissionId] : [],
                      }
                  ]
                : [
                      {
                          name: baseRoleName,
                          slug: buildUniqueValue(baseRoleSlug, usedRoleSlugs),
                          description: "Starter role for assigning project access.",
                          is_system: false,
                          permission_ids: createdPermissionId ? [createdPermissionId] : [],
                      }
                  ];

        for (const preset of rolePresets) {
            const roleResult = await createRole(created.id, preset);
            if (!roleResult.ok) {
                return { ok: false, error: "Project was created, but starter roles could not be created." };
            }
            createdRole = true;

            await logAuditEvent({
                projectId: created.id,
                userId: authData.user.id,
                entityType: "role",
                entityId: roleResult.data.id,
                action: "created",
                metadata: {
                    event: "project_onboarding_role_created",
                    name: roleResult.data.name,
                    slug: roleResult.data.slug,
                    permission_count: roleResult.data.permission_ids.length,
                },
            });
        }
    }

    if (shouldCreateApiKey) {
        const keyName =
            normalizeName(input.first_api_key_name || (template === "admin" ? "Server key" : "Primary key")) || "Primary key";
        const keyDescription = normalizeDescription(input.first_api_key_description || "Created during project setup.");
        const apiKeyResult = await createApiKeyRecord({
            projectId: created.id,
            name: keyName,
            description: keyDescription,
        });
        if (!apiKeyResult.ok) {
            return { ok: false, error: apiKeyResult.error || "Project was created, but the first API key could not be generated." };
        }
        createdApiKey = true;
        apiKeyName = apiKeyResult.data.record.name;
        apiKeyValue = apiKeyResult.data.key;

        await logAuditEvent({
            projectId: created.id,
            userId: authData.user.id,
            entityType: "api_key",
            entityId: apiKeyResult.data.record.id,
            action: "created",
            metadata: {
                event: "project_onboarding_api_key_created",
                name: apiKeyResult.data.record.name,
                status: apiKeyResult.data.record.status,
            },
        });
    }

    return {
        ok: true,
        data: {
            ...created,
            onboarding: {
                created_permission: createdPermission,
                created_role: createdRole,
                created_api_key: createdApiKey,
                api_key_name: apiKeyName,
                api_key_value: apiKeyValue,
            },
        },
    };
}
