import { createSupabaseServerClient } from "@/lib/supabase-server";

export type RoleRecord = {
    id: string;
    project_id: string;
    name: string;
    slug: string;
    description: string | null;
    is_system: boolean;
    created_at: string;
    updated_at: string | null;
};

export type RoleWithPermissions = RoleRecord & {
    permission_ids: string[];
    user_count: number;
};

type RolePermissionsRow = {
    permission_id: string;
};

type UserRoleRow = {
    id: string;
};

function mapRoleRow(
    role: RoleRecord & {
        role_permissions?: RolePermissionsRow[] | null;
        user_roles?: UserRoleRow[] | null;
    }
): RoleWithPermissions {
    return {
        id: role.id,
        project_id: role.project_id,
        name: role.name,
        slug: role.slug,
        description: role.description ?? null,
        is_system: Boolean(role.is_system),
        created_at: role.created_at,
        updated_at: role.updated_at ?? null,
        permission_ids: (role.role_permissions ?? [])
            .map((entry) => entry.permission_id)
            .filter(Boolean),
        user_count: (role.user_roles ?? []).length,
    };
}

export async function getRoles(projectId: string): Promise<RoleWithPermissions[]> {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
        .from("roles")
        .select("id, project_id, name, slug, description, is_system, created_at, updated_at, role_permissions(permission_id), user_roles(id)")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

    if (error) throw error;

    return (data ?? []).map((row) =>
        mapRoleRow(
            row as RoleRecord & {
                role_permissions?: RolePermissionsRow[] | null;
                user_roles?: UserRoleRow[] | null;
            }
        )
    );
}

export async function createRole(
    projectId: string,
    data: {
        name: string;
        slug: string;
        description: string | null;
        permission_ids: string[];
        is_system?: boolean;
    }
) {
    const supabase = await createSupabaseServerClient();

    const { data: created, error } = await supabase
        .from("roles")
        .insert({
            project_id: projectId,
            name: data.name,
            slug: data.slug,
            description: data.description,
            is_system: Boolean(data.is_system),
        })
        .select("id, project_id, name, slug, description, is_system, created_at, updated_at")
        .single();

    if (error || !created) return { ok: false as const, error };

    const roleId = created.id;

    if (data.permission_ids.length > 0) {
        const inserts = data.permission_ids.map((permissionId) => ({
            role_id: roleId,
            permission_id: permissionId,
        }));

        const { error: rpError } = await supabase
            .from("role_permissions")
            .insert(inserts);

        if (rpError) {
            await supabase.from("roles").delete().eq("id", roleId).eq("project_id", projectId);
            return { ok: false as const, error: rpError };
        }
    }

    const { data: joined, error: joinedError } = await supabase
        .from("roles")
        .select("id, project_id, name, slug, description, is_system, created_at, updated_at, role_permissions(permission_id), user_roles(id)")
        .eq("id", roleId)
        .eq("project_id", projectId)
        .single();

    if (joinedError || !joined) return { ok: false as const, error: joinedError };

    return {
        ok: true as const,
        data: mapRoleRow(
            joined as RoleRecord & {
                role_permissions?: RolePermissionsRow[] | null;
                user_roles?: UserRoleRow[] | null;
            }
        ),
    };
}

export async function updateRole(
    id: string,
    projectId: string,
    data: {
        name: string;
        slug: string;
        description: string | null;
        permission_ids: string[];
        is_system: boolean;
    }
) {
    const supabase = await createSupabaseServerClient();

    const { data: updatedRole, error: updateError } = await supabase
        .from("roles")
        .update({
            name: data.name,
            slug: data.slug,
            description: data.description,
            is_system: data.is_system,
        })
        .eq("id", id)
        .eq("project_id", projectId)
        .select("id")
        .single();

    if (updateError || !updatedRole) return { ok: false as const, error: updateError };

    const { error: deleteJoinError } = await supabase
        .from("role_permissions")
        .delete()
        .eq("role_id", id);

    if (deleteJoinError) return { ok: false as const, error: deleteJoinError };

    if (data.permission_ids.length > 0) {
        const inserts = data.permission_ids.map((permissionId) => ({
            role_id: id,
            permission_id: permissionId,
        }));

        const { error: insertJoinError } = await supabase
            .from("role_permissions")
            .insert(inserts);

        if (insertJoinError) return { ok: false as const, error: insertJoinError };
    }

    const { data: joined, error: joinedError } = await supabase
        .from("roles")
        .select("id, project_id, name, slug, description, is_system, created_at, updated_at, role_permissions(permission_id), user_roles(id)")
        .eq("id", id)
        .eq("project_id", projectId)
        .single();

    if (joinedError || !joined) return { ok: false as const, error: joinedError };

    return {
        ok: true as const,
        data: mapRoleRow(
            joined as RoleRecord & {
                role_permissions?: RolePermissionsRow[] | null;
                user_roles?: UserRoleRow[] | null;
            }
        ),
    };
}

export async function deleteRole(id: string, projectId: string) {
    const supabase = await createSupabaseServerClient();

    const { error: deleteJoinsError } = await supabase
        .from("role_permissions")
        .delete()
        .eq("role_id", id);

    if (deleteJoinsError) return { ok: false as const, error: deleteJoinsError };

    const { error } = await supabase
        .from("roles")
        .delete()
        .eq("id", id)
        .eq("project_id", projectId);

    if (error) return { ok: false as const, error };
    return { ok: true as const };
}
