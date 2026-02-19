"use client";

import { memo, useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiKeyDisplay } from "./ApiKeyDisplay";
import { GenerateApiKeyButton } from "./GenerateApiKeyButton";
import { BackButton } from "./BackButton";

interface Props {
    project: {
        id: string;
        name: string;
    };
    apiKey: {
        key: string;
        created_at: string;
        last_rotated_at: string | null;
    } | null;
    permissions: PermissionInput[];
    roles: Role[];
}

type Role = {
    id: string;
    project_id: string;
    name: string;
    slug: string;
    description: string | null;
    is_system: boolean;
    permission_ids: string[];
    created_at: string;
    updated_at: string | null;
    user_count: number;
};

type RoleSortKey = "name" | "created_at" | "permission_count";
type RoleValidationErrors = {
    name?: string;
    slug?: string;
};

type PermissionInput = {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    enabled: boolean;
    risk_level: "low" | "medium" | "high" | string;
    usage_count: number | null;
    last_used_at: string | null;
    is_system: boolean;
    created_at: string;
    updated_at: string | null;
};

export default function ProjectPageClient({
                                              project,
                                              apiKey,
                                              permissions,
                                              roles: initialRoles,
                                          }: Props) {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState("overview");
    const [permissionsState, setPermissionsState] = useState<Permission[]>(() =>
        (permissions ?? []).map(normalizePermission)
    );
    const [roles, setRoles] = useState<Role[]>(() =>
        (initialRoles ?? []).map(normalizeRole)
    );

    const usageMonth = 24193;
    const usageLimit = 100000;
    const usagePercent = Math.round((usageMonth / usageLimit) * 100);
    const handleTabSelect = useCallback(
        (tabId: string) => {
            setActiveTab(tabId);
            if (tabId === "roles" || tabId === "features") {
                router.refresh();
            }
        },
        [router]
    );

    return (
        <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#0e1117] text-white">
            <main className="mx-auto w-full max-w-full overflow-x-hidden px-12 py-20">

                <BackButton />

                {/* HEADER */}
                <div className="mt-12 border-b border-white/5 pb-10">
                    <h1 className="text-4xl font-semibold tracking-tight">
                        {project.name}
                    </h1>
                    <p className="mt-3 text-sm text-white/40">
                        Project ID · {project.id}
                    </p>
                </div>

                <div className="mt-16 grid w-full max-w-full grid-cols-[240px_1fr] gap-20 overflow-x-hidden">

                    {/* SIDEBAR */}
                    <aside className="space-y-3">
                        <SidebarItem id="overview" activeTab={activeTab} onTabSelect={handleTabSelect} label="Overview" />
                        <SidebarItem id="api" activeTab={activeTab} onTabSelect={handleTabSelect} label="API Keys" />
                        <SidebarItem id="roles" activeTab={activeTab} onTabSelect={handleTabSelect} label="Roles" />
                        <SidebarItem id="features" activeTab={activeTab} onTabSelect={handleTabSelect} label="Permissions" />
                        <SidebarItem id="integration" activeTab={activeTab} onTabSelect={handleTabSelect} label="Integration" />
                    </aside>

                    {/* CONTENT */}
                    <div className="min-w-0 max-w-full space-y-28">

                        {activeTab === "overview" && (
                            <div className="grid grid-cols-3 gap-12">
                                <MetricCard
                                    label="API Calls (30d)"
                                    value={usageMonth.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                                />
                                <MetricCard label="Usage" value={`${usagePercent}%`} />
                                <MetricCard label="Active Roles" value={roles.length.toString()} />
                            </div>
                        )}

                        {activeTab === "api" && (
                            <Section title="API Credentials">
                                {!apiKey ? (
                                    <>
                                        <p className="text-white/50">
                                            No API key generated yet.
                                        </p>
                                        <div className="mt-8">
                                            <GenerateApiKeyButton projectId={project.id} />
                                        </div>
                                    </>
                                ) : (
                                    <ApiKeyDisplay
                                        projectId={project.id}
                                        apiKey={apiKey.key}
                                        createdAt={apiKey.created_at}
                                        lastRotatedAt={apiKey.last_rotated_at}
                                    />
                                )}
                            </Section>
                        )}

                        {activeTab === "roles" && (
                            <Section title="Roles">
                                <RolesManager
                                    roles={roles}
                                    setRoles={setRoles}
                                    permissions={permissionsState}
                                    projectId={project.id}
                                />
                            </Section>
                        )}

                        {activeTab === "features" && (
                            <Section title="Permissions">

                                <PermissionsManager
                                    permissions={permissionsState}
                                    setPermissions={setPermissionsState}
                                    projectId={project.id}
                                />

                            </Section>
                        )}

                        {activeTab === "integration" && (
                            <Section title="Integration">
                <pre className="text-xs text-white/70 overflow-x-auto bg-[#151922] p-6 rounded-xl">
                  <code>{`await fetch("https://api.yourapp.com/access/check", {
  method: "POST",
  headers: {
    "Authorization": "Bearer sk_live_...",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    user_id: "user_123",
    resource: "feature_export"
  })
})`}</code>
                </pre>
                            </Section>
                        )}

                    </div>
                </div>
            </main>
        </div>
    );
}


/* ================= COMPONENTS ================= */

import {
    createPermissionAction as createPermissionActionRaw,
    updatePermissionAction as updatePermissionActionRaw,
    deletePermissionAction,
    togglePermissionAction,
} from "./permissions-actions";
import {
    createRoleAction as createRoleActionRaw,
    updateRoleAction as updateRoleActionRaw,
    deleteRoleAction,
} from "./roles-actions";

type Permission = {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    enabled: boolean;
    risk_level: "low" | "medium" | "high";
    usage_count: number;
    last_used_at: string | null;
    is_system: boolean;
    created_at: string;
    updated_at: string | null;
    created_at_display: string;
    last_used_at_display: string;
};

type SortKey = "name" | "usage_count" | "created_at" | "last_used_at";
type SortDirection = "asc" | "desc";
type ValidationErrors = {
    name?: string;
    slug?: string;
};

const SLUG_REGEX = /^[a-z0-9.]+$/;

function slugify(value: string) {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9.]+/g, ".")
        .replace(/\.{2,}/g, ".")
        .replace(/(^\.)|(\.$)/g, "");
}

function formatDateDisplay(value: string | null) {
    if (!value) return "Never";
    return value.slice(0, 10);
}

function formatDateTimeDisplay(value: string | null) {
    if (!value) return "Never";
    return value.replace("T", " ").slice(0, 16);
}

function normalizeRiskLevel(
    value: PermissionInput["risk_level"]
): Permission["risk_level"] {
    if (value === "low" || value === "medium" || value === "high") {
        return value;
    }
    return "low";
}

function normalizePermission(raw: PermissionInput): Permission {
    return {
        id: raw.id,
        name: raw.name,
        slug: raw.slug,
        description: raw.description ?? null,
        enabled: Boolean(raw.enabled),
        risk_level: normalizeRiskLevel(raw.risk_level),
        usage_count: raw.usage_count ?? 0,
        last_used_at: raw.last_used_at ?? null,
        is_system: Boolean(raw.is_system),
        created_at: raw.created_at,
        updated_at: raw.updated_at ?? null,
        created_at_display: formatDateDisplay(raw.created_at),
        last_used_at_display: formatDateDisplay(raw.last_used_at),
    };
}

function normalizeRole(raw: Role): Role {
    return {
        ...raw,
        slug: raw.slug ?? slugify(raw.name),
        description: raw.description ?? null,
        permission_ids: raw.permission_ids ?? [],
        updated_at: raw.updated_at ?? raw.created_at,
        user_count: raw.user_count ?? 0,
    };
}

function validatePermissionForm({
    name,
    slug,
    existingPermissions,
    currentPermissionId,
}: {
    name: string;
    slug: string;
    existingPermissions: Permission[];
    currentPermissionId?: string;
}): ValidationErrors {
    const errors: ValidationErrors = {};
    const normalizedName = name.trim();
    const normalizedSlug = slug.trim();

    if (!normalizedName) {
        errors.name = "Name required";
    }
    if (!normalizedSlug) {
        errors.slug = "Slug required";
        return errors;
    }
    if (!SLUG_REGEX.test(normalizedSlug)) {
        errors.slug = "Only lowercase letters, numbers and dots allowed";
        return errors;
    }
    const duplicate = existingPermissions.some(
        (permission) =>
            permission.slug === normalizedSlug && permission.id !== currentPermissionId
    );
    if (duplicate) {
        errors.slug = "Slug already exists";
    }
    return errors;
}

function validateRoleForm({
    name,
    slug,
    existingRoles,
    currentRoleId,
}: {
    name: string;
    slug: string;
    existingRoles: Role[];
    currentRoleId?: string;
}): RoleValidationErrors {
    const errors: RoleValidationErrors = {};
    const normalizedName = name.trim();

    if (!normalizedName) {
        errors.name = "Name required";
        return errors;
    }
    if (normalizedName.length < 2) {
        errors.name = "Name too short";
        return errors;
    }
    if (normalizedName.length > 64) {
        errors.name = "Name too long";
        return errors;
    }
    const normalizedSlug = slug.trim();
    if (!normalizedSlug) {
        errors.slug = "Slug required";
        return errors;
    }
    if (!SLUG_REGEX.test(normalizedSlug)) {
        errors.slug = "Only lowercase letters, numbers and dots allowed";
        return errors;
    }

    const duplicate = existingRoles.some(
        (role) =>
            role.name.trim().toLowerCase() === normalizedName.toLowerCase() &&
            role.id !== currentRoleId
    );
    if (duplicate) {
        errors.name = "Role name already exists";
    }
    const duplicateSlug = existingRoles.some(
        (role) => role.slug === normalizedSlug && role.id !== currentRoleId
    );
    if (duplicateSlug) {
        errors.slug = "Role slug already exists";
    }

    return errors;
}

function RolesManager({
    roles,
    setRoles,
    permissions,
    projectId,
}: {
    roles: Role[];
    setRoles: React.Dispatch<React.SetStateAction<Role[]>>;
    permissions: Permission[];
    projectId: string;
}) {
    const availablePermissions = useMemo(() => permissions ?? [], [permissions]);
    const [query, setQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState("all");
    const [sortKey, setSortKey] = useState<RoleSortKey>("created_at");
    const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const [deletingRole, setDeletingRole] = useState<Role | null>(null);
    const [viewingRoleId, setViewingRoleId] = useState<string | null>(null);

    const permissionById = useMemo(() => {
        return new Map(availablePermissions.map((permission) => [permission.id, permission]));
    }, [availablePermissions]);

    const filteredRoles = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        let list = roles;

        if (normalizedQuery) {
            list = list.filter((role) => {
                const inName = role.name.toLowerCase().includes(normalizedQuery);
                const inSlug = role.slug.toLowerCase().includes(normalizedQuery);
                const inDescription = (role.description ?? "")
                    .toLowerCase()
                    .includes(normalizedQuery);
                return inName || inSlug || inDescription;
            });
        }

        if (typeFilter !== "all") {
            list = list.filter((role) =>
                typeFilter === "system" ? role.is_system : !role.is_system
            );
        }

        return list;
    }, [roles, query, typeFilter]);

    const sortedRoles = useMemo(() => {
        const sorted = [...filteredRoles];
        sorted.sort((a, b) => {
            let comparison = 0;
            if (sortKey === "name") {
                comparison = a.name.localeCompare(b.name);
            }
            if (sortKey === "created_at") {
                comparison =
                    new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            }
            if (sortKey === "permission_count") {
                comparison = a.permission_ids.length - b.permission_ids.length;
            }
            return sortDirection === "asc" ? comparison : -comparison;
        });
        return sorted;
    }, [filteredRoles, sortKey, sortDirection]);

    const viewingRole = useMemo(
        () => roles.find((role) => role.id === viewingRoleId) ?? null,
        [roles, viewingRoleId]
    );

    const handleSortChange = useCallback(
        (value: RoleSortKey) => {
            if (value === sortKey) {
                setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
            } else {
                setSortKey(value);
                setSortDirection("desc");
            }
        },
        [sortKey]
    );

    const handleCreate = useCallback(
        async (data: {
            name: string;
            slug: string;
            description?: string;
            permission_ids: string[];
            is_system: boolean;
        }) => {
            const result = await createRoleActionRaw(projectId, data);
            if (result.ok && result.data) {
                setRoles((prev) => [normalizeRole(result.data), ...prev]);
                setIsCreateOpen(false);
            }
            return result;
        },
        [projectId, setRoles]
    );

    const handleUpdate = useCallback(
        async (
            id: string,
            data: {
                name: string;
                slug: string;
                description?: string;
                permission_ids: string[];
                is_system: boolean;
            }
        ) => {
            const result = await updateRoleActionRaw(projectId, id, data);
            if (result.ok && result.data) {
                setRoles((prev) =>
                    prev.map((item) =>
                        item.id === id ? normalizeRole(result.data) : item
                    )
                );
                setEditingRole(null);
            }
            return result;
        },
        [projectId, setRoles]
    );

    const handleDelete = useCallback(async () => {
        if (!deletingRole || deletingRole.is_system) return;
        const result = await deleteRoleAction(projectId, deletingRole.id);
        if (result.ok) {
            const id = deletingRole.id;
            setRoles((prev) => prev.filter((item) => item.id !== id));
            if (viewingRoleId === id) {
                setViewingRoleId(null);
            }
            setDeletingRole(null);
        }
        return result;
    }, [projectId, setRoles, deletingRole, viewingRoleId]);

    return (
        <>
            <RoleFilterBar
                query={query}
                onQueryChange={setQuery}
                typeFilter={typeFilter}
                onTypeFilterChange={setTypeFilter}
                sortKey={sortKey}
                onSortChange={handleSortChange}
                onCreate={() => setIsCreateOpen(true)}
            />

            <RolesTable
                roles={sortedRoles}
                permissionById={permissionById}
                onView={(role) => setViewingRoleId(role.id)}
                onEdit={(role) => setEditingRole(role)}
                onDelete={(role) => setDeletingRole(role)}
            />

            {isCreateOpen && (
                <RoleEditorModal
                    mode="create"
                    roles={roles}
                    availablePermissions={availablePermissions}
                    onClose={() => setIsCreateOpen(false)}
                    onSubmit={handleCreate}
                />
            )}

            {editingRole && (
                <RoleEditorModal
                    mode="edit"
                    role={editingRole}
                    roles={roles}
                    availablePermissions={availablePermissions}
                    onClose={() => setEditingRole(null)}
                    onSubmit={(data) => handleUpdate(editingRole.id, data)}
                />
            )}

            {viewingRole && (
                <RoleDetailModal
                    role={viewingRole}
                    permissionById={permissionById}
                    onClose={() => setViewingRoleId(null)}
                    onEdit={(role) => {
                        setViewingRoleId(null);
                        setEditingRole(role);
                    }}
                    onDelete={(role) => {
                        setViewingRoleId(null);
                        setDeletingRole(role);
                    }}
                />
            )}

            {deletingRole && (
                <ConfirmDeleteRoleModal
                    role={deletingRole}
                    onClose={() => setDeletingRole(null)}
                    onConfirm={handleDelete}
                />
            )}
        </>
    );
}

function RoleFilterBar({
    query,
    onQueryChange,
    typeFilter,
    onTypeFilterChange,
    sortKey,
    onSortChange,
    onCreate,
}: {
    query: string;
    onQueryChange: (value: string) => void;
    typeFilter: string;
    onTypeFilterChange: (value: string) => void;
    sortKey: RoleSortKey;
    onSortChange: (value: RoleSortKey) => void;
    onCreate: () => void;
}) {
    return (
        <div className="mt-2 w-full min-w-0 max-w-full border-b border-white/10 pb-4">
            <div className="flex min-w-0 max-w-full flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-4">
                <div className="grid w-full min-w-0 max-w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(280px,1fr)_180px_180px]">
                    <label className="flex flex-col gap-2">
                        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
                            Search
                        </span>
                        <input
                            value={query}
                            onChange={(e) => onQueryChange(e.target.value)}
                            placeholder="Search Roles"
                            className="h-11 rounded-xl border border-white/10 bg-[#0a0f16] px-4 text-sm text-white placeholder:text-white/35 focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/10"
                        />
                    </label>

                    <label className="flex flex-col gap-2">
                        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
                            Type
                        </span>
                        <select
                            value={typeFilter}
                            onChange={(e) => onTypeFilterChange(e.target.value)}
                            className="h-11 rounded-xl border border-white/10 bg-[#0a0f16] px-3 text-sm text-white/85 focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/10"
                        >
                            <option value="all">All types</option>
                            <option value="system">System</option>
                            <option value="custom">Custom</option>
                        </select>
                    </label>

                    <label className="flex flex-col gap-2">
                        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
                            Sort
                        </span>
                        <select
                            value={sortKey}
                            onChange={(e) => onSortChange(e.target.value as RoleSortKey)}
                            className="h-11 rounded-xl border border-white/10 bg-[#0a0f16] px-3 text-sm text-white/85 focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/10"
                        >
                            <option value="name">Name</option>
                            <option value="permission_count">Permissions</option>
                            <option value="created_at">Created</option>
                        </select>
                    </label>
                </div>

                <button
                    type="button"
                    onClick={onCreate}
                    className="h-10 w-full shrink-0 whitespace-nowrap rounded-lg bg-white px-3.5 text-sm font-semibold text-black transition hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-white/20 lg:h-11 lg:w-auto lg:min-w-[168px]"
                >
                    + New Role
                </button>
            </div>
        </div>
    );
}

function RolesTable({
    roles,
    permissionById,
    onView,
    onEdit,
    onDelete,
}: {
    roles: Role[];
    permissionById: Map<string, Permission>;
    onView: (role: Role) => void;
    onEdit: (role: Role) => void;
    onDelete: (role: Role) => void;
}) {
    return (
        <div className="mt-6 w-full min-w-0 max-w-full overflow-x-auto rounded-2xl border border-white/10 bg-[#0f141d] shadow-[0_20px_45px_-30px_rgba(0,0,0,0.9)] lg:overflow-x-hidden">
            <div className="min-w-[980px] max-w-full lg:min-w-0 lg:w-full">
                <div className="grid grid-cols-[minmax(260px,2fr)_200px_130px_170px_130px_160px] border-b border-white/10 bg-[#111827] px-6 py-3 text-[11px] font-medium uppercase tracking-[0.15em] text-white/45 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,0.6fr)_minmax(0,0.8fr)]">
                    <span className="whitespace-nowrap">Role</span>
                    <span className="whitespace-nowrap">Slug</span>
                    <span className="whitespace-nowrap">Type</span>
                    <span className="whitespace-nowrap">Permissions</span>
                    <span className="whitespace-nowrap">Users</span>
                    <span className="whitespace-nowrap text-right">Actions</span>
                </div>

                {roles.map((role) => (
                    <RoleListRow
                        key={role.id}
                        role={role}
                        permissionById={permissionById}
                        onView={onView}
                        onEdit={onEdit}
                        onDelete={onDelete}
                    />
                ))}

                {roles.length === 0 && (
                    <div className="px-8 py-14 text-center text-sm text-white/45">
                        No roles found
                    </div>
                )}
            </div>
        </div>
    );
}

const RoleListRow = memo(function RoleListRow({
    role,
    permissionById,
    onView,
    onEdit,
    onDelete,
}: {
    role: Role;
    permissionById: Map<string, Permission>;
    onView: (role: Role) => void;
    onEdit: (role: Role) => void;
    onDelete: (role: Role) => void;
}) {
    const typeColor = role.is_system
        ? "border-blue-400/20 bg-blue-500/10 text-blue-200"
        : "border-white/10 bg-white/5 text-white/70";

    const permissionPreview = role.permission_ids
        .map((id) => permissionById.get(id)?.name)
        .filter(Boolean)
        .slice(0, 2)
        .join(", ");

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={() => onView(role)}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onView(role);
                }
            }}
            className="group grid min-w-[980px] grid-cols-[minmax(260px,2fr)_200px_130px_170px_130px_160px] items-center border-t border-white/10 px-6 py-5 text-sm transition hover:bg-white/[0.03] cursor-pointer lg:min-w-0 lg:w-full lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,0.6fr)_minmax(0,0.8fr)]"
        >
            <div className="min-w-0 max-w-full overflow-hidden">
                <p title={role.name} className="truncate font-semibold text-white">
                    {role.name}
                </p>
                <p
                    title={role.description || "No description"}
                    className="mt-1 truncate text-xs text-white/45"
                >
                    {role.description || "No description"}
                </p>
            </div>
            <span className="truncate font-mono text-xs text-white/65" title={role.slug}>
                {role.slug}
            </span>

            <span
                className={`inline-flex w-fit whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${typeColor}`}
            >
                {role.is_system ? "System" : "Custom"}
            </span>

            <div className="min-w-0">
                <p className="whitespace-nowrap font-medium text-white/85">
                    {role.permission_ids.length} assigned
                </p>
                <p className="mt-1 truncate text-xs text-white/45">
                    {permissionPreview || "No permissions selected"}
                </p>
            </div>

            <span className="whitespace-nowrap text-white/70">{role.user_count}</span>

            <div className="flex items-center justify-end gap-2 whitespace-nowrap opacity-70 transition group-hover:opacity-100">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onEdit(role);
                    }}
                    title="Edit role"
                    aria-label="Edit role"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.02] text-white/65 transition hover:border-white/25 hover:text-white"
                >
                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                        <path d="M3 14.8V17h2.2L15.6 6.6a1.55 1.55 0 0 0 0-2.2l-.02-.02a1.55 1.55 0 0 0-2.2 0L3 14.8Z" />
                        <path d="M11.8 5.2l3 3" />
                    </svg>
                </button>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        if (!role.is_system) {
                            onDelete(role);
                        }
                    }}
                    disabled={role.is_system}
                    title={role.is_system ? "System roles cannot be deleted" : "Delete role"}
                    aria-label="Delete role"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-400/20 bg-red-500/10 text-red-300 transition hover:border-red-300/40 hover:text-red-200 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.02] disabled:text-white/30"
                >
                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                        <path d="M4 6h12" />
                        <path d="M8 6V4h4v2" />
                        <path d="M6.7 6.7 7.4 16h5.2l.7-9.3" />
                    </svg>
                </button>
            </div>
        </div>
    );
});

function RoleEditorModal({
    mode,
    role,
    roles,
    availablePermissions,
    onClose,
    onSubmit,
}: {
    mode: "create" | "edit";
    role?: Role;
    roles: Role[];
    availablePermissions: Permission[];
    onClose: () => void;
    onSubmit: (data: {
        name: string;
        slug: string;
        description?: string;
        permission_ids: string[];
        is_system: boolean;
    }) => Promise<unknown>;
}) {
    const [name, setName] = useState(role?.name ?? "");
    const [slug, setSlug] = useState(role?.slug ?? "");
    const [slugTouched, setSlugTouched] = useState(
        role ? role.slug !== slugify(role.name) : false
    );
    const [description, setDescription] = useState(role?.description ?? "");
    const [isSystem, setIsSystem] = useState(role?.is_system ?? false);
    const [selectedPermissions, setSelectedPermissions] = useState<string[]>(
        role?.permission_ids ?? []
    );
    const [permissionSearch, setPermissionSearch] = useState("");
    const [submitted, setSubmitted] = useState(false);

    const errors = useMemo(
        () =>
            validateRoleForm({
                name,
                slug,
                existingRoles: roles,
                currentRoleId: role?.id,
            }),
        [name, slug, roles, role?.id]
    );
    const canSubmit = !errors.name && !errors.slug;

    const handleNameChange = (value: string) => {
        setName(value);
        if (!slugTouched) {
            setSlug(slugify(value));
        }
    };

    const filteredPermissions = useMemo(() => {
        const normalized = permissionSearch.trim().toLowerCase();
        if (!normalized) return availablePermissions;
        return availablePermissions.filter(
            (permission) =>
                permission.name.toLowerCase().includes(normalized) ||
                permission.slug.toLowerCase().includes(normalized)
        );
    }, [availablePermissions, permissionSearch]);

    const togglePermission = (permissionId: string) => {
        setSelectedPermissions((prev) =>
            prev.includes(permissionId)
                ? prev.filter((id) => id !== permissionId)
                : [...prev, permissionId]
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitted(true);
        if (!canSubmit) return;
        await onSubmit({
            name: name.trim(),
            slug: slug.trim(),
            description: description.trim(),
            permission_ids: selectedPermissions,
            is_system: isSystem,
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
            <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-[#0f141d] p-7 shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
                    <div>
                        <h3 className="text-xl font-semibold text-white">
                            {mode === "create" ? "New role" : "Edit role"}
                        </h3>
                        <p className="mt-1 text-sm text-white/45">
                            Configure metadata and assign permissions from the Permissions tab.
                        </p>
                    </div>
                    <button onClick={onClose} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:border-white/25 hover:text-white">
                        Close
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="mt-6 space-y-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="text-xs uppercase tracking-[0.14em] text-white/45">Name</label>
                            <input
                                value={name}
                                onChange={(e) => handleNameChange(e.target.value)}
                                className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0a0f16] px-4 text-sm text-white focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/10"
                            />
                            {(submitted || name.length > 0) && errors.name && (
                                <p className="mt-2 text-xs text-red-300">{errors.name}</p>
                            )}
                        </div>

                        <div>
                            <label className="text-xs uppercase tracking-[0.14em] text-white/45">Slug</label>
                            <input
                                value={slug}
                                onChange={(e) => {
                                    setSlugTouched(true);
                                    setSlug(e.target.value);
                                }}
                                className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0a0f16] px-4 text-sm font-mono text-white focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/10"
                            />
                            <p className="mt-2 text-xs text-white/35">Auto-suggested from name until edited.</p>
                            {(submitted || slug.length > 0) && errors.slug && (
                                <p className="mt-2 text-xs text-red-300">{errors.slug}</p>
                            )}
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="text-xs uppercase tracking-[0.14em] text-white/45">Description</label>
                            <input
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0a0f16] px-4 text-sm text-white focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/10"
                            />
                        </div>
                        <div className="rounded-xl border border-white/10 bg-[#0a0f16] px-4 py-3">
                            <p className="text-xs uppercase tracking-[0.14em] text-white/45">Type</p>
                            <div className="mt-3 flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-white/90">
                                        {isSystem ? "System role" : "Custom role"}
                                    </p>
                                    <p className="text-xs text-white/40">System roles are protected from deletion.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsSystem((prev) => !prev)}
                                    className={`relative h-6 w-11 rounded-full border transition ${
                                        isSystem ? "border-blue-400/50 bg-blue-500" : "border-white/20 bg-white/15"
                                    }`}
                                >
                                    <div
                                        className={`absolute left-[2px] top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white transition ${
                                            isSystem ? "translate-x-5" : "translate-x-0"
                                        }`}
                                    />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div>
                        <div className="mb-2 flex items-center justify-between">
                            <label className="text-xs uppercase tracking-[0.14em] text-white/45">
                                Role permissions
                            </label>
                            <span className="text-xs text-white/45">
                                {selectedPermissions.length} selected
                            </span>
                        </div>
                        <input
                            value={permissionSearch}
                            onChange={(e) => setPermissionSearch(e.target.value)}
                            placeholder="Filter permissions by name or slug"
                            className="h-10 w-full rounded-xl border border-white/10 bg-[#0a0f16] px-4 text-sm text-white placeholder:text-white/35 focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/10"
                        />
                        <div className="mt-3 max-h-64 space-y-2 overflow-y-auto rounded-xl border border-white/10 bg-[#0a0f16] p-3">
                            {filteredPermissions.map((permission) => {
                                const checked = selectedPermissions.includes(permission.id);
                                return (
                                    <label
                                        key={permission.id}
                                        className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/8 bg-white/[0.015] px-3 py-2.5 transition hover:border-white/20"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => togglePermission(permission.id)}
                                            className="mt-0.5 h-4 w-4 rounded border-white/20 bg-[#0a0f16] text-white focus:ring-white/20"
                                        />
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium text-white">
                                                {permission.name}
                                            </p>
                                            <p className="truncate font-mono text-xs text-white/45">
                                                {permission.slug}
                                            </p>
                                        </div>
                                    </label>
                                );
                            })}
                            {filteredPermissions.length === 0 && (
                                <p className="px-1 py-4 text-center text-xs text-white/45">
                                    No permissions found
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 border-t border-white/10 pt-5">
                        <button type="button" onClick={onClose} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/70 hover:border-white/20 hover:text-white">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!canSubmit}
                            className="rounded-xl bg-white px-5 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {mode === "create" ? "Create role" : "Save role"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function RoleDetailModal({
    role,
    permissionById,
    onClose,
    onEdit,
    onDelete,
}: {
    role: Role;
    permissionById: Map<string, Permission>;
    onClose: () => void;
    onEdit: (role: Role) => void;
    onDelete: (role: Role) => void;
}) {
    const rolePermissions = role.permission_ids
        .map((id) => permissionById.get(id))
        .filter(Boolean) as Permission[];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
            <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-[#0f141d] p-7 shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
                    <div>
                        <h3 className="text-xl font-semibold text-white">Role details</h3>
                        <p className="mt-1 text-sm text-white/45">
                            Assigned permissions and metadata for this role.
                        </p>
                    </div>
                    <button onClick={onClose} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:border-white/25 hover:text-white">
                        Close
                    </button>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-white/10 bg-[#0a0f16] p-4">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-white/45">Name</p>
                        <p className="mt-2 text-base font-semibold text-white">{role.name}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-[#0a0f16] p-4">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-white/45">Slug</p>
                        <p className="mt-2 truncate font-mono text-sm text-white/85">{role.slug}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-[#0a0f16] p-4">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-white/45">Type</p>
                        <p className="mt-2 text-sm text-white/85">{role.is_system ? "System role" : "Custom role"}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-[#0a0f16] p-4 sm:col-span-2">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-white/45">Description</p>
                        <p className="mt-2 text-sm text-white/80">{role.description || "No description"}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-[#0a0f16] p-4">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-white/45">Users with role</p>
                        <p className="mt-2 text-sm text-white/85">{role.user_count}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-[#0a0f16] p-4">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-white/45">Updated at</p>
                        <p className="mt-2 text-sm text-white/85">{formatDateTimeDisplay(role.updated_at)}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-[#0a0f16] p-4 sm:col-span-2">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-white/45">Assigned permissions</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {rolePermissions.map((permission) => (
                                <span
                                    key={permission.id}
                                    className="inline-flex rounded-full border border-white/12 bg-white/5 px-2.5 py-1 text-xs text-white/85"
                                >
                                    {permission.name}
                                </span>
                            ))}
                            {rolePermissions.length === 0 && (
                                <span className="text-xs text-white/45">No permissions assigned</span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex justify-end gap-3 border-t border-white/10 pt-5">
                    <button type="button" onClick={onClose} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/70 hover:border-white/20 hover:text-white">
                        Close
                    </button>
                    <button
                        type="button"
                        onClick={() => onEdit(role)}
                        className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white hover:border-white/30"
                    >
                        Edit Role
                    </button>
                    <button
                        type="button"
                        onClick={() => onDelete(role)}
                        disabled={role.is_system}
                        className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
}

function ConfirmDeleteRoleModal({
    role,
    onClose,
    onConfirm,
}: {
    role: Role;
    onClose: () => void;
    onConfirm: () => void;
}) {
    const isBlocked = role.is_system;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f141d] p-7">
                <h3 className="text-xl font-semibold text-white">Delete role</h3>
                <p className="mt-2 text-sm text-white/50">
                    {isBlocked
                        ? "System roles cannot be deleted."
                        : `Are you sure you want to delete ${role.name}?`}
                </p>
                <div className="mt-6 flex justify-end gap-3 border-t border-white/10 pt-5">
                    <button onClick={onClose} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/70 hover:border-white/20 hover:text-white">
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isBlocked}
                        className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
}

function PermissionsManager({
    permissions,
    setPermissions,
    projectId,
}: {
    permissions: Permission[];
    setPermissions: React.Dispatch<React.SetStateAction<Permission[]>>;
    projectId: string;
}) {
    const [query, setQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [riskFilter, setRiskFilter] = useState("all");
    const [sortKey, setSortKey] = useState<SortKey>("created_at");
    const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingPermission, setEditingPermission] = useState<Permission | null>(null);
    const [deletingPermission, setDeletingPermission] = useState<Permission | null>(null);
    const [viewingPermissionId, setViewingPermissionId] = useState<string | null>(null);

    const filteredPermissions = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        let list = permissions;

        if (normalizedQuery) {
            list = list.filter((permission) =>
                permission.name.toLowerCase().includes(normalizedQuery) ||
                permission.slug.toLowerCase().includes(normalizedQuery)
            );
        }

        if (statusFilter !== "all") {
            list = list.filter((permission) =>
                statusFilter === "enabled" ? permission.enabled : !permission.enabled
            );
        }

        if (riskFilter !== "all") {
            list = list.filter((permission) => permission.risk_level === riskFilter);
        }

        return list;
    }, [permissions, query, statusFilter, riskFilter]);

    const sortedPermissions = useMemo(() => {
        const sorted = [...filteredPermissions];
        sorted.sort((a, b) => {
            let comparison = 0;
            if (sortKey === "name") {
                comparison = a.name.localeCompare(b.name);
            }
            if (sortKey === "usage_count") {
                comparison = a.usage_count - b.usage_count;
            }
            if (sortKey === "created_at") {
                comparison =
                    new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            }
            if (sortKey === "last_used_at") {
                comparison =
                    (a.last_used_at ? new Date(a.last_used_at).getTime() : 0) -
                    (b.last_used_at ? new Date(b.last_used_at).getTime() : 0);
            }
            return sortDirection === "asc" ? comparison : -comparison;
        });
        return sorted;
    }, [filteredPermissions, sortKey, sortDirection]);

    const viewingPermission = useMemo(
        () => permissions.find((permission) => permission.id === viewingPermissionId) ?? null,
        [permissions, viewingPermissionId]
    );

    const handleSortChange = useCallback(
        (value: SortKey) => {
            if (value === sortKey) {
                setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
            } else {
                setSortKey(value);
                setSortDirection("desc");
            }
        },
        [sortKey]
    );

    const handleToggle = useCallback(async (permission: Permission) => {
        const nextEnabled = !permission.enabled;
        setPermissions((prev) =>
            prev.map((item) =>
                item.id === permission.id
                    ? normalizePermission({ ...item, enabled: nextEnabled })
                    : item
            )
        );
        const result = await togglePermissionAction(projectId, permission.id, nextEnabled);
        if (!result.ok) {
            setPermissions((prev) =>
                prev.map((item) =>
                    item.id === permission.id
                        ? normalizePermission({ ...item, enabled: permission.enabled })
                        : item
                )
            );
        }
    }, [projectId, setPermissions]);

    const handleCreate = useCallback(
        async (data: {
            name: string;
            slug: string;
            description?: string;
            risk_level: Permission["risk_level"];
        }) => {
            const result = await createPermissionActionRaw(projectId, data);
            if (result.ok && result.data) {
                setPermissions((prev) => [normalizePermission(result.data), ...prev]);
                setIsCreateOpen(false);
            }
            return result;
        },
        [projectId, setPermissions]
    );

    const handleUpdate = useCallback(
        async (id: string, data: {
            name: string;
            slug: string;
            description?: string;
            risk_level: Permission["risk_level"];
            enabled: boolean;
        }) => {
            setPermissions((prev) =>
                prev.map((item) =>
                    item.id === id ? normalizePermission({ ...item, ...data }) : item
                )
            );
            const result = await updatePermissionActionRaw(id, data);
            if (result.ok && result.data) {
                setPermissions((prev) =>
                    prev.map((item) =>
                        item.id === id ? normalizePermission(result.data) : item
                    )
                );
                setEditingPermission(null);
            }
            return result;
        },
        [setPermissions]
    );

    const handleDelete = useCallback(async () => {
        if (!deletingPermission || deletingPermission.is_system) return;
        const result = await deletePermissionAction(projectId, deletingPermission.id);
        if (result.ok) {
            setPermissions((prev) =>
                prev.filter((item) => item.id !== deletingPermission.id)
            );
            if (viewingPermissionId === deletingPermission.id) {
                setViewingPermissionId(null);
            }
            setDeletingPermission(null);
        }
        return result;
    }, [projectId, deletingPermission, viewingPermissionId, setPermissions]);

    return (
        <>
            <FilterBar
                query={query}
                onQueryChange={setQuery}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                riskFilter={riskFilter}
                onRiskFilterChange={setRiskFilter}
                sortKey={sortKey}
                onSortChange={handleSortChange}
                onCreate={() => setIsCreateOpen(true)}
            />

            <PermissionsTable
                permissions={sortedPermissions}
                onView={(permission) => setViewingPermissionId(permission.id)}
                onToggle={handleToggle}
                onEdit={(permission) => setEditingPermission(permission)}
                onDelete={(permission) => setDeletingPermission(permission)}
            />

            {isCreateOpen && (
                <CreatePermissionModal
                    permissions={permissions}
                    onClose={() => setIsCreateOpen(false)}
                    onCreate={handleCreate}
                />
            )}

            {editingPermission && (
                <EditPermissionModal
                    permissions={permissions}
                    permission={editingPermission}
                    onClose={() => setEditingPermission(null)}
                    onSave={handleUpdate}
                />
            )}

            {viewingPermission && (
                <PermissionDetailModal
                    permission={viewingPermission}
                    onClose={() => setViewingPermissionId(null)}
                    onEdit={(permission) => {
                        setViewingPermissionId(null);
                        setEditingPermission(permission);
                    }}
                    onDelete={(permission) => {
                        setViewingPermissionId(null);
                        setDeletingPermission(permission);
                    }}
                />
            )}

            {deletingPermission && (
                <ConfirmDeleteModal
                    permission={deletingPermission}
                    onClose={() => setDeletingPermission(null)}
                    onConfirm={handleDelete}
                />
            )}
        </>
    );
}

function FilterBar({
    query,
    onQueryChange,
    statusFilter,
    onStatusFilterChange,
    riskFilter,
    onRiskFilterChange,
    sortKey,
    onSortChange,
    onCreate,
}: {
    query: string;
    onQueryChange: (value: string) => void;
    statusFilter: string;
    onStatusFilterChange: (value: string) => void;
    riskFilter: string;
    onRiskFilterChange: (value: string) => void;
    sortKey: SortKey;
    onSortChange: (value: SortKey) => void;
    onCreate: () => void;
}) {
    return (
        <div className="mt-2 w-full min-w-0 max-w-full border-b border-white/10 pb-4">
            <div className="flex min-w-0 max-w-full flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-4">
                <div className="grid w-full min-w-0 max-w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(280px,1fr)_160px_160px_160px]">
                    <label className="flex flex-col gap-2">
                        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
                            Search
                        </span>
                        <input
                            value={query}
                            onChange={(e) => onQueryChange(e.target.value)}
                            placeholder="Search Permissions"
                            className="h-11 rounded-xl border border-white/10 bg-[#0a0f16] px-4 text-sm text-white placeholder:text-white/35 focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/10"
                        />
                    </label>

                    <label className="flex flex-col gap-2">
                        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
                            Status
                        </span>
                        <select
                            value={statusFilter}
                            onChange={(e) => onStatusFilterChange(e.target.value)}
                            className="h-11 rounded-xl border border-white/10 bg-[#0a0f16] px-3 text-sm text-white/85 focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/10"
                        >
                            <option value="all">All status</option>
                            <option value="enabled">Enabled</option>
                            <option value="disabled">Disabled</option>
                        </select>
                    </label>

                    <label className="flex flex-col gap-2">
                        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
                            Risk
                        </span>
                        <select
                            value={riskFilter}
                            onChange={(e) => onRiskFilterChange(e.target.value)}
                            className="h-11 rounded-xl border border-white/10 bg-[#0a0f16] px-3 text-sm text-white/85 focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/10"
                        >
                            <option value="all">All risk</option>
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                        </select>
                    </label>

                    <label className="flex flex-col gap-2">
                        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
                            Sort
                        </span>
                        <select
                            value={sortKey}
                            onChange={(e) => onSortChange(e.target.value as SortKey)}
                            className="h-11 rounded-xl border border-white/10 bg-[#0a0f16] px-3 text-sm text-white/85 focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/10"
                        >
                            <option value="name">Name</option>
                            <option value="usage_count">Usage</option>
                            <option value="created_at">Created</option>
                            <option value="last_used_at">Last used</option>
                        </select>
                    </label>
                </div>

                <button
                    type="button"
                    onClick={onCreate}
                    className="h-10 w-full shrink-0 whitespace-nowrap rounded-lg bg-white px-3.5 text-sm font-semibold text-black transition hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-white/20 lg:h-11 lg:w-auto lg:min-w-[168px]"
                >
                    + New Permission
                </button>
            </div>
        </div>
    );
}

function PermissionsTable({
    permissions,
    onView,
    onToggle,
    onEdit,
    onDelete,
}: {
    permissions: Permission[];
    onView: (permission: Permission) => void;
    onToggle: (permission: Permission) => void;
    onEdit: (permission: Permission) => void;
    onDelete: (permission: Permission) => void;
}) {
    return (
        <div className="mt-6 w-full min-w-0 max-w-full overflow-x-auto rounded-2xl border border-white/10 bg-[#0f141d] shadow-[0_20px_45px_-30px_rgba(0,0,0,0.9)] lg:overflow-x-hidden">
            <div className="min-w-[920px] max-w-full lg:min-w-0 lg:w-full">
                <div className="grid grid-cols-[minmax(340px,2.4fr)_200px_130px_130px_150px_170px] border-b border-white/10 bg-[#111827] px-6 py-3 text-[11px] font-medium uppercase tracking-[0.15em] text-white/45 lg:grid-cols-[minmax(0,2.4fr)_minmax(0,1.2fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,0.9fr)_minmax(0,1fr)]">
                    <span className="whitespace-nowrap">Name</span>
                    <span className="whitespace-nowrap">Status</span>
                    <span className="whitespace-nowrap">Risk</span>
                    <span className="whitespace-nowrap">Usage</span>
                    <span className="whitespace-nowrap">Last used</span>
                    <span className="whitespace-nowrap text-right">Actions</span>
                </div>

                {permissions.map((permission) => (
                    <PermissionRow
                        key={permission.id}
                        permission={permission}
                        onView={onView}
                        onToggle={onToggle}
                        onEdit={onEdit}
                        onDelete={onDelete}
                    />
                ))}

                {permissions.length === 0 && (
                    <div className="px-8 py-14 text-center text-sm text-white/45">
                        No permissions found
                    </div>
                )}
            </div>
        </div>
    );
}

const PermissionRow = memo(function PermissionRow({
    permission,
    onView,
    onToggle,
    onEdit,
    onDelete,
}: {
    permission: Permission;
    onView: (permission: Permission) => void;
    onToggle: (permission: Permission) => void;
    onEdit: (permission: Permission) => void;
    onDelete: (permission: Permission) => void;
}) {
    const [copied, setCopied] = useState(false);

    const riskColor =
        permission.risk_level === "low"
            ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
            : permission.risk_level === "medium"
                ? "border-amber-400/20 bg-amber-400/10 text-amber-200"
                : "border-red-400/20 bg-red-400/10 text-red-300";

    const statusColor = permission.enabled
        ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-300"
        : "border-white/10 bg-white/5 text-white/60";

    const formatCount = (value: number) =>
        value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

    const handleCopy = async () => {
        await navigator.clipboard?.writeText(permission.slug);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
    };

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={() => onView(permission)}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onView(permission);
                }
            }}
            className="group grid min-w-[920px] grid-cols-[minmax(340px,2.4fr)_200px_130px_130px_150px_170px] items-center border-t border-white/10 px-6 py-5 text-sm transition hover:bg-white/[0.03] cursor-pointer lg:min-w-0 lg:w-full lg:grid-cols-[minmax(0,2.4fr)_minmax(0,1.2fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,0.9fr)_minmax(0,1fr)]"
        >
            <div className="min-w-0 max-w-full overflow-hidden">
                <p title={permission.name} className="truncate font-semibold text-white">
                    {permission.name}
                </p>
                <p title={permission.slug} className="mt-1 truncate font-mono text-xs text-white/55">
                    {permission.slug}
                </p>
                <p
                    title={permission.description || "No description"}
                    className="mt-1 truncate text-xs text-white/40"
                >
                    {permission.description || "No description"}
                </p>
            </div>

            <div className="min-w-0 flex items-center gap-3">
                <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${statusColor}`}>
                    {permission.enabled ? "Enabled" : "Disabled"}
                </span>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggle(permission);
                    }}
                    title={permission.enabled ? "Disable permission" : "Enable permission"}
                    aria-label={permission.enabled ? "Disable permission" : "Enable permission"}
                    className={`relative h-6 w-11 rounded-full border transition ${
                        permission.enabled ? "border-emerald-400/50 bg-emerald-500" : "border-white/20 bg-white/15"
                    }`}
                >
                    <div
                        className={`absolute left-[2px] top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white transition ${
                            permission.enabled ? "translate-x-5" : "translate-x-0"
                        }`}
                    />
                </button>
            </div>

            <span className={`inline-flex w-fit whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${riskColor}`}>
                {permission.risk_level}
            </span>

            <span className="whitespace-nowrap font-medium text-white/80">{formatCount(permission.usage_count)}</span>

            <span className="whitespace-nowrap text-white/60">{permission.last_used_at_display}</span>

            <div className="flex items-center justify-end gap-2 whitespace-nowrap opacity-70 transition group-hover:opacity-100">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        handleCopy();
                    }}
                    title={copied ? "Copied" : "Copy slug"}
                    aria-label={copied ? "Copied" : "Copy slug"}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.02] text-white/65 transition hover:border-white/25 hover:text-white"
                >
                    {copied ? (
                        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
                            <path d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.2 7.263a1 1 0 0 1-1.42.006L3.29 9.25a1 1 0 0 1 1.42-1.408l4.092 4.138 6.487-6.543a1 1 0 0 1 1.415-.147Z" />
                        </svg>
                    ) : (
                        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                            <rect x="7" y="7" width="9" height="9" rx="2" />
                            <path d="M4 13V5a2 2 0 0 1 2-2h8" />
                        </svg>
                    )}
                </button>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onEdit(permission);
                    }}
                    title="Edit permission"
                    aria-label="Edit permission"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.02] text-white/65 transition hover:border-white/25 hover:text-white"
                >
                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                        <path d="M3 14.8V17h2.2L15.6 6.6a1.55 1.55 0 0 0 0-2.2l-.02-.02a1.55 1.55 0 0 0-2.2 0L3 14.8Z" />
                        <path d="M11.8 5.2l3 3" />
                    </svg>
                </button>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        if (!permission.is_system) {
                            onDelete(permission);
                        }
                    }}
                    disabled={permission.is_system}
                    title={permission.is_system ? "System permissions cannot be deleted" : "Delete permission"}
                    aria-label="Delete permission"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-400/20 bg-red-500/10 text-red-300 transition hover:border-red-300/40 hover:text-red-200 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.02] disabled:text-white/30"
                >
                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                        <path d="M4 6h12" />
                        <path d="M8 6V4h4v2" />
                        <path d="M6.7 6.7 7.4 16h5.2l.7-9.3" />
                    </svg>
                </button>
            </div>
        </div>
    );
});

function CreatePermissionModal({
    permissions,
    onClose,
    onCreate,
}: {
    permissions: Permission[];
    onClose: () => void;
    onCreate: (data: {
        name: string;
        slug: string;
        description?: string;
        risk_level: Permission["risk_level"];
    }) => Promise<unknown>;
}) {
    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [slugTouched, setSlugTouched] = useState(false);
    const [description, setDescription] = useState("");
    const [riskLevel, setRiskLevel] = useState<Permission["risk_level"]>("low");
    const [submitted, setSubmitted] = useState(false);

    const handleNameChange = (value: string) => {
        setName(value);
        if (!slugTouched) {
            setSlug(slugify(value));
        }
    };

    const errors = useMemo(
        () =>
            validatePermissionForm({
                name,
                slug,
                existingPermissions: permissions,
            }),
        [name, slug, permissions]
    );
    const canSubmit = !errors.name && !errors.slug;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitted(true);
        if (!canSubmit) return;
        await onCreate({
            name: name.trim(),
            slug: slug.trim(),
            description: description.trim(),
            risk_level: riskLevel,
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0f141d] p-7 shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
                    <div>
                        <h3 className="text-xl font-semibold text-white">New permission</h3>
                        <p className="mt-1 text-sm text-white/45">Define name, slug, and risk level.</p>
                    </div>
                    <button onClick={onClose} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:border-white/25 hover:text-white">
                        Close
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="mt-6 space-y-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="text-xs uppercase tracking-[0.14em] text-white/45">Name</label>
                            <input
                                value={name}
                                onChange={(e) => handleNameChange(e.target.value)}
                                className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0a0f16] px-4 text-sm text-white focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/10"
                            />
                            {(submitted || name.length > 0) && errors.name && (
                                <p className="mt-2 text-xs text-red-300">{errors.name}</p>
                            )}
                        </div>
                        <div>
                            <label className="text-xs uppercase tracking-[0.14em] text-white/45">Slug</label>
                            <input
                                value={slug}
                                onChange={(e) => {
                                    setSlugTouched(true);
                                    setSlug(e.target.value);
                                }}
                                className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0a0f16] px-4 text-sm font-mono text-white focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/10"
                            />
                            <p className="mt-2 text-xs text-white/35">Auto-suggested from name until edited.</p>
                            {(submitted || slug.length > 0) && errors.slug && (
                                <p className="mt-2 text-xs text-red-300">{errors.slug}</p>
                            )}
                        </div>
                    </div>
                    <div>
                        <label className="text-xs uppercase tracking-[0.14em] text-white/45">Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            className="mt-2 w-full rounded-xl border border-white/10 bg-[#0a0f16] px-4 py-3 text-sm text-white focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/10"
                        />
                    </div>
                    <div>
                        <label className="text-xs uppercase tracking-[0.14em] text-white/45">Risk level</label>
                        <select
                            value={riskLevel}
                            onChange={(e) => setRiskLevel(e.target.value as Permission["risk_level"])}
                            className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0a0f16] px-4 text-sm text-white focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/10"
                        >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                        </select>
                    </div>
                    <div className="flex justify-end gap-3 border-t border-white/10 pt-5">
                        <button type="button" onClick={onClose} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/70 hover:border-white/20 hover:text-white">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!canSubmit}
                            className="rounded-xl bg-white px-5 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Create
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function EditPermissionModal({
    permissions,
    permission,
    onClose,
    onSave,
}: {
    permissions: Permission[];
    permission: Permission;
    onClose: () => void;
    onSave: (id: string, data: {
        name: string;
        slug: string;
        description?: string;
        risk_level: Permission["risk_level"];
        enabled: boolean;
    }) => Promise<unknown>;
}) {
    const [name, setName] = useState(permission.name);
    const [slug, setSlug] = useState(permission.slug);
    const [slugTouched, setSlugTouched] = useState(
        permission.slug !== slugify(permission.name)
    );
    const [description, setDescription] = useState(permission.description ?? "");
    const [riskLevel, setRiskLevel] = useState<Permission["risk_level"]>(permission.risk_level);
    const [enabled, setEnabled] = useState(permission.enabled);
    const [submitted, setSubmitted] = useState(false);

    const handleNameChange = (value: string) => {
        setName(value);
        if (!slugTouched) {
            setSlug(slugify(value));
        }
    };

    const errors = useMemo(
        () =>
            validatePermissionForm({
                name,
                slug,
                existingPermissions: permissions,
                currentPermissionId: permission.id,
            }),
        [name, slug, permissions, permission.id]
    );
    const canSubmit = !errors.name && !errors.slug;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitted(true);
        if (!canSubmit) return;
        await onSave(permission.id, {
            name: name.trim(),
            slug: slug.trim(),
            description: description.trim(),
            risk_level: riskLevel,
            enabled,
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0f141d] p-7 shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
                    <div>
                        <h3 className="text-xl font-semibold text-white">Edit permission</h3>
                        <p className="mt-1 text-sm text-white/45">Update metadata and deployment status.</p>
                    </div>
                    <button onClick={onClose} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:border-white/25 hover:text-white">
                        Close
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="mt-6 space-y-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="text-xs uppercase tracking-[0.14em] text-white/45">Name</label>
                            <input
                                value={name}
                                onChange={(e) => handleNameChange(e.target.value)}
                                className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0a0f16] px-4 text-sm text-white focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/10"
                            />
                            {(submitted || name.length > 0) && errors.name && (
                                <p className="mt-2 text-xs text-red-300">{errors.name}</p>
                            )}
                        </div>
                        <div>
                            <label className="text-xs uppercase tracking-[0.14em] text-white/45">Slug</label>
                            <input
                                value={slug}
                                onChange={(e) => {
                                    setSlugTouched(true);
                                    setSlug(e.target.value);
                                }}
                                className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0a0f16] px-4 text-sm font-mono text-white focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/10"
                            />
                            {(submitted || slug.length > 0) && errors.slug && (
                                <p className="mt-2 text-xs text-red-300">{errors.slug}</p>
                            )}
                        </div>
                    </div>
                    <div>
                        <label className="text-xs uppercase tracking-[0.14em] text-white/45">Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            className="mt-2 w-full rounded-xl border border-white/10 bg-[#0a0f16] px-4 py-3 text-sm text-white focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/10"
                        />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="rounded-xl border border-white/10 bg-[#0a0f16] px-4 py-3">
                            <p className="text-xs uppercase tracking-[0.14em] text-white/45">Enabled</p>
                            <div className="mt-3 flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-white/90">Live in production</p>
                                    <p className="text-xs text-white/40">Controls access checks immediately.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setEnabled((prev) => !prev)}
                                    className={`relative h-6 w-11 rounded-full border transition ${
                                        enabled ? "border-emerald-400/50 bg-emerald-500" : "border-white/20 bg-white/15"
                                    }`}
                                >
                                    <div
                                        className={`absolute left-[2px] top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white transition ${
                                            enabled ? "translate-x-5" : "translate-x-0"
                                        }`}
                                    />
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs uppercase tracking-[0.14em] text-white/45">Risk level</label>
                            <select
                                value={riskLevel}
                                onChange={(e) => setRiskLevel(e.target.value as Permission["risk_level"])}
                                className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0a0f16] px-4 text-sm text-white focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/10"
                            >
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 border-t border-white/10 pt-5">
                        <button type="button" onClick={onClose} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/70 hover:border-white/20 hover:text-white">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!canSubmit}
                            className="rounded-xl bg-white px-5 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Save
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function PermissionDetailModal({
    permission,
    onClose,
    onEdit,
    onDelete,
}: {
    permission: Permission;
    onClose: () => void;
    onEdit: (permission: Permission) => void;
    onDelete: (permission: Permission) => void;
}) {
    const statusColor = permission.enabled
        ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-300"
        : "border-white/10 bg-white/5 text-white/60";
    const riskColor =
        permission.risk_level === "low"
            ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
            : permission.risk_level === "medium"
                ? "border-amber-400/20 bg-amber-400/10 text-amber-200"
                : "border-red-400/20 bg-red-400/10 text-red-300";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
            <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-[#0f141d] p-7 shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
                    <div>
                        <h3 className="text-xl font-semibold text-white">Permission details</h3>
                        <p className="mt-1 text-sm text-white/45">Full permission metadata and usage details.</p>
                    </div>
                    <button onClick={onClose} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:border-white/25 hover:text-white">
                        Close
                    </button>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-white/10 bg-[#0a0f16] p-4">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-white/45">Name</p>
                        <p className="mt-2 text-base font-semibold text-white">{permission.name}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-[#0a0f16] p-4">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-white/45">Slug</p>
                        <p className="mt-2 truncate font-mono text-sm text-white/85">{permission.slug}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-[#0a0f16] p-4 sm:col-span-2">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-white/45">Description</p>
                        <p className="mt-2 text-sm text-white/80">{permission.description || "No description"}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-[#0a0f16] p-4">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-white/45">Status</p>
                        <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusColor}`}>
                            {permission.enabled ? "Enabled" : "Disabled"}
                        </span>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-[#0a0f16] p-4">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-white/45">Risk</p>
                        <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${riskColor}`}>
                            {permission.risk_level}
                        </span>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-[#0a0f16] p-4">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-white/45">Usage count</p>
                        <p className="mt-2 text-sm text-white/85">{permission.usage_count.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-[#0a0f16] p-4">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-white/45">Last used</p>
                        <p className="mt-2 text-sm text-white/85">{permission.last_used_at_display}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-[#0a0f16] p-4">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-white/45">Created at</p>
                        <p className="mt-2 text-sm text-white/85">{formatDateTimeDisplay(permission.created_at)}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-[#0a0f16] p-4">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-white/45">Updated at</p>
                        <p className="mt-2 text-sm text-white/85">{formatDateTimeDisplay(permission.updated_at)}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-[#0a0f16] p-4 sm:col-span-2">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-white/45">Type</p>
                        <p className="mt-2 text-sm text-white/85">{permission.is_system ? "System permission" : "Custom permission"}</p>
                    </div>
                </div>

                <div className="mt-6 flex justify-end gap-3 border-t border-white/10 pt-5">
                    <button type="button" onClick={onClose} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/70 hover:border-white/20 hover:text-white">
                        Close
                    </button>
                    <button
                        type="button"
                        onClick={() => onEdit(permission)}
                        className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white hover:border-white/30"
                    >
                        Edit Permission
                    </button>
                    <button
                        type="button"
                        onClick={() => onDelete(permission)}
                        disabled={permission.is_system}
                        className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
}

function ConfirmDeleteModal({
    permission,
    onClose,
    onConfirm,
}: {
    permission: Permission;
    onClose: () => void;
    onConfirm: () => void;
}) {
    const isBlocked = permission.is_system;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f141d] p-7">
                <h3 className="text-xl font-semibold text-white">Delete permission</h3>
                <p className="mt-2 text-sm text-white/50">
                    {isBlocked
                        ? "System permissions cannot be deleted."
                        : `Are you sure you want to delete ${permission.name}?`}
                </p>
                <div className="mt-6 flex justify-end gap-3 border-t border-white/10 pt-5">
                    <button onClick={onClose} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/70 hover:border-white/20 hover:text-white">
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isBlocked}
                        className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
}

function SidebarItem({
                         label,
                         id,
                         activeTab,
                         onTabSelect,
                     }: {
    label: string;
    id: string;
    activeTab: string;
    onTabSelect: (id: string) => void;
}) {
    const active = activeTab === id;

    return (
        <div
            onClick={() => onTabSelect(id)}
            className={`px-4 py-3 rounded-lg text-sm cursor-pointer transition ${
                active
                    ? "bg-white/5 text-white"
                    : "text-white/50 hover:bg-white/5 hover:text-white"
            }`}
        >
            {label}
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="w-full min-w-0 max-w-full">
            <h2 className="text-2xl font-semibold tracking-tight">
                {title}
            </h2>
            <div className="mt-10 w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-white/5 bg-[#151922] p-12">
                {children}
            </div>
        </section>
    );
}

function MetricCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-2xl border border-white/5 bg-[#151922] p-10">
            <p className="text-xs uppercase tracking-wider text-white/40">
                {label}
            </p>
            <p className="mt-6 text-2xl font-semibold">
                {value}
            </p>
        </div>
    );
}
