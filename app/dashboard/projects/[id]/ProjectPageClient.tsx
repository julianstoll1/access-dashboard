"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiKeyDisplay } from "./ApiKeyDisplay";
import { GenerateApiKeyButton } from "./GenerateApiKeyButton";
import { BackButton } from "./BackButton";
import { useToast } from "@/components/feedback/ToastProvider";

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
    auditLogs: AuditLogInput[];
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

type AuditLogInput = {
    id: string;
    project_id: string;
    user_id: string | null;
    entity_type: string;
    entity_id: string | null;
    action: string;
    metadata: Record<string, unknown> | null;
    created_at: string;
};

export default function ProjectPageClient({
                                              project,
                                              apiKey,
                                              permissions,
                                              roles: initialRoles,
                                              auditLogs,
                                          }: Props) {
    const router = useRouter();
    const [rolesHasUnsavedChanges, setRolesHasUnsavedChanges] = useState(false);
    const [permissionsHasUnsavedChanges, setPermissionsHasUnsavedChanges] = useState(false);
    const [pendingTabSwitch, setPendingTabSwitch] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState("overview");
    const [permissionsState, setPermissionsState] = useState<Permission[]>(() =>
        (permissions ?? []).map(normalizePermission)
    );
    const [roles, setRoles] = useState<Role[]>(() =>
        (initialRoles ?? []).map(normalizeRole)
    );

    const hasUnsavedChanges = rolesHasUnsavedChanges || permissionsHasUnsavedChanges;

    useEffect(() => {
        if (!hasUnsavedChanges) return;
        const handler = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = "";
        };
        window.addEventListener("beforeunload", handler);
        return () => window.removeEventListener("beforeunload", handler);
    }, [hasUnsavedChanges]);

    const performTabSelect = useCallback((tabId: string) => {
        setActiveTab(tabId);
        if (tabId === "roles" || tabId === "features" || tabId === "audit") {
            router.refresh();
        }
    }, [router]);

    const usageMonth = 24193;
    const usageLimit = 100000;
    const usagePercent = Math.round((usageMonth / usageLimit) * 100);
    const handleTabSelect = useCallback(
        (tabId: string) => {
            if (tabId === activeTab) return;
            if (hasUnsavedChanges) {
                setPendingTabSwitch(tabId);
                return;
            }
            performTabSelect(tabId);
        },
        [activeTab, hasUnsavedChanges, performTabSelect]
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
                        <SidebarItem id="audit" activeTab={activeTab} onTabSelect={handleTabSelect} label="Audit Log" />
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
                                    onHasUnsavedChangesChange={setRolesHasUnsavedChanges}
                                />
                            </Section>
                        )}

                        {activeTab === "features" && (
                            <Section title="Permissions">

                                <PermissionsManager
                                    permissions={permissionsState}
                                    setPermissions={setPermissionsState}
                                    projectId={project.id}
                                    roles={roles}
                                    onHasUnsavedChangesChange={setPermissionsHasUnsavedChanges}
                                />

                            </Section>
                        )}

                        {activeTab === "audit" && (
                            <Section title="Audit Log">
                                <AuditLogTimeline logs={auditLogs} />
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
            {pendingTabSwitch && (
                <DiscardChangesModal
                    title="Discard unsaved changes?"
                    message="You have unsaved changes in an open form. If you continue, those changes will be lost."
                    onCancel={() => setPendingTabSwitch(null)}
                    onConfirm={() => {
                        const tabId = pendingTabSwitch;
                        setPendingTabSwitch(null);
                        performTabSelect(tabId);
                    }}
                />
            )}
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

function buildUniqueRoleName(baseName: string, roles: Role[]) {
    const base = (baseName || "Role").trim();
    const existing = new Set(roles.map((role) => role.name.trim().toLowerCase()));
    let candidate = `${base} Copy`;
    let index = 2;
    while (existing.has(candidate.toLowerCase())) {
        candidate = `${base} Copy ${index}`;
        index += 1;
    }
    return candidate;
}

function buildUniqueRoleSlug(baseSlug: string, roles: Role[]) {
    const normalizedBase = slugify(baseSlug) || "role";
    const existing = new Set(roles.map((role) => role.slug));
    let candidate = `${normalizedBase}.copy`;
    let index = 2;
    while (existing.has(candidate)) {
        candidate = `${normalizedBase}.copy${index}`;
        index += 1;
    }
    return candidate;
}

function RolesManager({
    roles,
    setRoles,
    permissions,
    projectId,
    onHasUnsavedChangesChange,
}: {
    roles: Role[];
    setRoles: React.Dispatch<React.SetStateAction<Role[]>>;
    permissions: Permission[];
    projectId: string;
    onHasUnsavedChangesChange: (value: boolean) => void;
}) {
    const toast = useToast();
    const availablePermissions = useMemo(() => permissions ?? [], [permissions]);
    const [query, setQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState("all");
    const [sortKey, setSortKey] = useState<RoleSortKey>("created_at");
    const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const [deletingRole, setDeletingRole] = useState<Role | null>(null);
    const [isRoleSaving, setIsRoleSaving] = useState(false);
    const [isRoleDeleting, setIsRoleDeleting] = useState(false);
    const [createFormDirty, setCreateFormDirty] = useState(false);
    const [editFormDirty, setEditFormDirty] = useState(false);
    const [viewingRoleId, setViewingRoleId] = useState<string | null>(null);
    const hasUnsavedChanges = createFormDirty || editFormDirty;

    useEffect(() => {
        onHasUnsavedChangesChange(hasUnsavedChanges);
        return () => onHasUnsavedChangesChange(false);
    }, [hasUnsavedChanges, onHasUnsavedChangesChange]);

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
            setIsRoleSaving(true);
            try {
                const result = await createRoleActionRaw(projectId, data);
                if (result.ok) {
                    setRoles((prev) => [normalizeRole(result.data), ...prev]);
                    setIsCreateOpen(false);
                    toast.success("Role created.");
                } else {
                    toast.error(result.error || "Failed to create role.");
                }
                return result;
            } finally {
                setIsRoleSaving(false);
            }
        },
        [projectId, setRoles, toast]
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
            setIsRoleSaving(true);
            try {
                const result = await updateRoleActionRaw(projectId, id, data);
                if (result.ok) {
                    setRoles((prev) =>
                        prev.map((item) =>
                            item.id === id ? normalizeRole(result.data) : item
                        )
                    );
                    setEditingRole(null);
                    toast.success("Role saved.");
                } else {
                    toast.error(result.error || "Failed to save role.");
                }
                return result;
            } finally {
                setIsRoleSaving(false);
            }
        },
        [projectId, setRoles, toast]
    );

    const handleDelete = useCallback(async () => {
        if (!deletingRole || deletingRole.is_system) return;
        setIsRoleDeleting(true);
        try {
            const result = await deleteRoleAction(projectId, deletingRole.id);
            if (result.ok) {
                const id = deletingRole.id;
                setRoles((prev) => prev.filter((item) => item.id !== id));
                if (viewingRoleId === id) {
                    setViewingRoleId(null);
                }
                setDeletingRole(null);
                toast.success("Role deleted.");
            } else {
                toast.error(result.error || "Failed to delete role.");
            }
            return result;
        } finally {
            setIsRoleDeleting(false);
        }
    }, [projectId, setRoles, deletingRole, viewingRoleId, toast]);

    const handleDuplicate = useCallback(
        async (role: Role) => {
            setIsRoleSaving(true);
            try {
                const duplicateName = buildUniqueRoleName(role.name, roles);
                const duplicateSlug = buildUniqueRoleSlug(role.slug, roles);
                const result = await createRoleActionRaw(projectId, {
                    name: duplicateName,
                    slug: duplicateSlug,
                    description: role.description ?? "",
                    permission_ids: role.permission_ids,
                    is_system: role.is_system,
                });
                if (result.ok) {
                    setRoles((prev) => [normalizeRole(result.data), ...prev]);
                    toast.success("Role duplicated.");
                } else {
                    toast.error(result.error || "Failed to duplicate role.");
                }
                return result;
            } finally {
                setIsRoleSaving(false);
            }
        },
        [projectId, roles, setRoles, toast]
    );

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
                isBusy={isRoleSaving}
            />

            {isCreateOpen && (
                <RoleEditorModal
                    mode="create"
                    roles={roles}
                    availablePermissions={availablePermissions}
                    onClose={() => {
                        if (!isRoleSaving) setIsCreateOpen(false);
                    }}
                    onSubmit={handleCreate}
                    isSaving={isRoleSaving}
                    onDirtyChange={setCreateFormDirty}
                />
            )}

            {editingRole && (
                <RoleEditorModal
                    mode="edit"
                    role={editingRole}
                    roles={roles}
                    availablePermissions={availablePermissions}
                    onClose={() => {
                        if (!isRoleSaving) setEditingRole(null);
                    }}
                    onSubmit={(data) => handleUpdate(editingRole.id, data)}
                    isSaving={isRoleSaving}
                    onDirtyChange={setEditFormDirty}
                />
            )}

            {viewingRole && (
                <RoleDetailModal
                    role={viewingRole}
                    permissionById={permissionById}
                    onClose={() => setViewingRoleId(null)}
                    onDuplicate={async (role) => {
                        const result = await handleDuplicate(role);
                        if (result?.ok) {
                            setViewingRoleId(null);
                            setEditingRole(normalizeRole(result.data));
                        }
                    }}
                    onEdit={(role) => {
                        setViewingRoleId(null);
                        setEditingRole(role);
                    }}
                    onDelete={(role) => {
                        setViewingRoleId(null);
                        setDeletingRole(role);
                    }}
                    isBusy={isRoleSaving}
                />
            )}

            {deletingRole && (
                <ConfirmDeleteRoleModal
                    role={deletingRole}
                    permissionById={permissionById}
                    onClose={() => {
                        if (!isRoleDeleting) setDeletingRole(null);
                    }}
                    onConfirm={handleDelete}
                    isDeleting={isRoleDeleting}
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
                    className="btn btn-primary h-10 w-full shrink-0 whitespace-nowrap lg:h-11 lg:w-auto lg:min-w-[168px]"
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
    isBusy,
}: {
    roles: Role[];
    permissionById: Map<string, Permission>;
    onView: (role: Role) => void;
    onEdit: (role: Role) => void;
    onDelete: (role: Role) => void;
    isBusy: boolean;
}) {
    return (
        <div className="mt-6 w-full min-w-0 max-w-full overflow-x-auto rounded-2xl border border-white/10 bg-[#0f141d] shadow-[0_20px_45px_-30px_rgba(0,0,0,0.9)] lg:overflow-x-hidden">
            <div className="min-w-[980px] max-w-full lg:min-w-0 lg:w-full">
                <div className="grid grid-cols-[minmax(260px,2fr)_200px_130px_170px_130px_190px] border-b border-white/10 bg-[#111827] px-6 py-3 text-[11px] font-medium uppercase tracking-[0.15em] text-white/45 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,0.6fr)_minmax(0,1fr)]">
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
                        isBusy={isBusy}
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
    isBusy,
}: {
    role: Role;
    permissionById: Map<string, Permission>;
    onView: (role: Role) => void;
    onEdit: (role: Role) => void;
    onDelete: (role: Role) => void;
    isBusy: boolean;
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
            className="group grid min-w-[980px] grid-cols-[minmax(260px,2fr)_200px_130px_170px_130px_190px] items-center border-t border-white/10 px-6 py-5 text-sm transition hover:bg-white/[0.03] cursor-pointer lg:min-w-0 lg:w-full lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,0.6fr)_minmax(0,1fr)]"
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
                    disabled={isBusy}
                    title="Edit role"
                    aria-label="Edit role"
                    className="btn-icon btn-icon-secondary"
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
                    disabled={role.is_system || isBusy}
                    title={role.is_system ? "System roles cannot be deleted" : "Delete role"}
                    aria-label="Delete role"
                    className="btn-icon btn-icon-danger"
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
    isSaving,
    onDirtyChange,
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
    isSaving: boolean;
    onDirtyChange: (value: boolean) => void;
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
    const [showDiscardPrompt, setShowDiscardPrompt] = useState(false);

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

    const validPermissionIdSet = useMemo(
        () => new Set(availablePermissions.map((permission) => permission.id)),
        [availablePermissions]
    );
    const selectedPermissionsValid = useMemo(
        () => selectedPermissions.filter((id) => validPermissionIdSet.has(id)),
        [selectedPermissions, validPermissionIdSet]
    );
    const initialSelectedPermissions = useMemo(
        () => (role?.permission_ids ?? []).filter((id) => validPermissionIdSet.has(id)).sort(),
        [role?.permission_ids, validPermissionIdSet]
    );
    const currentSelectedPermissions = useMemo(
        () => [...selectedPermissionsValid].sort(),
        [selectedPermissionsValid]
    );
    const isDirty = useMemo(
        () =>
            name !== (role?.name ?? "") ||
            slug !== (role?.slug ?? "") ||
            description !== (role?.description ?? "") ||
            isSystem !== (role?.is_system ?? false) ||
            currentSelectedPermissions.join("|") !== initialSelectedPermissions.join("|"),
        [name, slug, description, isSystem, role, currentSelectedPermissions, initialSelectedPermissions]
    );

    useEffect(() => {
        onDirtyChange(isDirty);
        return () => onDirtyChange(false);
    }, [isDirty, onDirtyChange]);

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
        if (!canSubmit || isSaving) return;
        await onSubmit({
            name: name.trim(),
            slug: slug.trim(),
            description: description.trim(),
            permission_ids: selectedPermissionsValid,
            is_system: isSystem,
        });
    };

    const requestClose = () => {
        if (isSaving) return;
        if (isDirty) {
            setShowDiscardPrompt(true);
            return;
        }
        onClose();
    };

    return (
        <>
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
                    <button onClick={requestClose} disabled={isSaving} className="btn btn-secondary text-xs px-3 py-1.5">
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
                            <label className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.14em] text-white/45">
                                Slug
                                <InfoTip text="A slug is the short ID of this role. It is used in API calls and access rules. It is auto-filled from the name. Use lowercase letters, numbers, and dots. It must be unique." />
                            </label>
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
                            <p className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.14em] text-white/45">
                                Type
                                <InfoTip text="System roles are built-in and protected. Custom roles are for your own setup." />
                            </p>
                            <div className="mt-3 flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-white/90">
                                        {isSystem ? "System role" : "Custom role"}
                                    </p>
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
                                {selectedPermissionsValid.length} selected
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
                                            disabled={isSaving}
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
                        <button type="button" onClick={requestClose} disabled={isSaving} className="btn btn-secondary">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!canSubmit || isSaving}
                            className="btn btn-primary"
                        >
                            {isSaving ? "Saving..." : mode === "create" ? "Create role" : "Save role"}
                        </button>
                    </div>
                </form>
                </div>
            </div>
            {showDiscardPrompt && (
                <DiscardChangesModal
                    title="Discard unsaved changes?"
                    message="You have unsaved changes in this role form. If you close now, those changes will be lost."
                    onCancel={() => setShowDiscardPrompt(false)}
                    onConfirm={() => {
                        setShowDiscardPrompt(false);
                        onClose();
                    }}
                />
            )}
        </>
    );
}

function RoleDetailModal({
    role,
    permissionById,
    onClose,
    onDuplicate,
    onEdit,
    onDelete,
    isBusy,
}: {
    role: Role;
    permissionById: Map<string, Permission>;
    onClose: () => void;
    onDuplicate: (role: Role) => Promise<void>;
    onEdit: (role: Role) => void;
    onDelete: (role: Role) => void;
    isBusy: boolean;
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
                    <button onClick={onClose} className="btn btn-secondary text-xs px-3 py-1.5">
                        Close
                    </button>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-white/10 bg-[#0a0f16] p-4">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-white/45">Name</p>
                        <p className="mt-2 text-base font-semibold text-white">{role.name}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-[#0a0f16] p-4">
                        <p className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.14em] text-white/45">
                            Slug
                            <InfoTip text="A slug is the short ID of this role. It is used in API calls and access rules. Use lowercase letters, numbers, and dots. It must be unique." />
                        </p>
                        <p className="mt-2 truncate font-mono text-sm text-white/85">{role.slug}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-[#0a0f16] p-4">
                        <p className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.14em] text-white/45">
                            Type
                            <InfoTip text="System roles are protected. Custom roles are fully editable." />
                        </p>
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
                    <button type="button" onClick={onClose} className="btn btn-secondary">
                        Close
                    </button>
                    <button
                        type="button"
                        onClick={() => onDuplicate(role)}
                        disabled={isBusy}
                        className="btn btn-secondary"
                    >
                        {isBusy ? "Duplicating..." : "Duplicate as new role"}
                    </button>
                    <button
                        type="button"
                        onClick={() => onEdit(role)}
                        disabled={isBusy}
                        className="btn btn-secondary"
                    >
                        Edit role
                    </button>
                    <button
                        type="button"
                        onClick={() => onDelete(role)}
                        disabled={role.is_system || isBusy}
                        className="btn btn-danger"
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
    permissionById,
    onClose,
    onConfirm,
    isDeleting,
}: {
    role: Role;
    permissionById: Map<string, Permission>;
    onClose: () => void;
    onConfirm: () => void;
    isDeleting: boolean;
}) {
    const isBlocked = role.is_system;
    const affectedPermissions = role.permission_ids
        .map((id) => permissionById.get(id)?.name)
        .filter(Boolean) as string[];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f141d] p-7">
                <h3 className="text-xl font-semibold text-white">Delete role</h3>
                <p className="mt-2 text-sm text-white/60">
                    {isBlocked
                        ? "System roles cannot be deleted."
                        : `You are about to delete ${role.name}. This action cannot be undone.`}
                </p>
                {!isBlocked && (
                    <div className="mt-4 rounded-xl border border-white/10 bg-[#0b121c] p-4">
                        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/50">
                            Impact Preview
                        </p>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                            <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                                <p className="text-[11px] uppercase tracking-[0.12em] text-white/45">Affected users</p>
                                <p className="mt-1 text-sm font-semibold text-white">{role.user_count}</p>
                            </div>
                            <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                                <p className="text-[11px] uppercase tracking-[0.12em] text-white/45">Attached permissions</p>
                                <p className="mt-1 text-sm font-semibold text-white">{affectedPermissions.length}</p>
                            </div>
                        </div>
                        {affectedPermissions.length > 0 && (
                            <div className="mt-3">
                                <p className="mb-2 text-xs text-white/55">Permissions that will no longer be grouped by this role:</p>
                                <div className="flex max-h-24 flex-wrap gap-2 overflow-y-auto">
                                    {affectedPermissions.map((name, index) => (
                                        <span
                                            key={`${name}-${index}`}
                                            className="inline-flex rounded-full border border-white/12 bg-white/[0.04] px-2 py-0.5 text-xs text-white/75"
                                        >
                                            {name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
                <div className="mt-6 flex justify-end gap-3 border-t border-white/10 pt-5">
                    <button onClick={onClose} disabled={isDeleting} className="btn btn-secondary">
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isBlocked || isDeleting}
                        className="btn btn-danger"
                    >
                        {isDeleting ? "Deleting..." : "Delete"}
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
    roles,
    onHasUnsavedChangesChange,
}: {
    permissions: Permission[];
    setPermissions: React.Dispatch<React.SetStateAction<Permission[]>>;
    projectId: string;
    roles: Role[];
    onHasUnsavedChangesChange: (value: boolean) => void;
}) {
    const toast = useToast();
    const [query, setQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [riskFilter, setRiskFilter] = useState("all");
    const [sortKey, setSortKey] = useState<SortKey>("created_at");
    const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingPermission, setEditingPermission] = useState<Permission | null>(null);
    const [deletingPermission, setDeletingPermission] = useState<Permission | null>(null);
    const [savingPermissionMode, setSavingPermissionMode] = useState<"create" | "edit" | null>(null);
    const [deletingPermissionId, setDeletingPermissionId] = useState<string | null>(null);
    const [togglingPermissionId, setTogglingPermissionId] = useState<string | null>(null);
    const [createFormDirty, setCreateFormDirty] = useState(false);
    const [editFormDirty, setEditFormDirty] = useState(false);
    const [viewingPermissionId, setViewingPermissionId] = useState<string | null>(null);
    const hasUnsavedChanges = createFormDirty || editFormDirty;

    useEffect(() => {
        onHasUnsavedChangesChange(hasUnsavedChanges);
        return () => onHasUnsavedChangesChange(false);
    }, [hasUnsavedChanges, onHasUnsavedChangesChange]);

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
    const affectedRolesForDeletingPermission = useMemo(() => {
        if (!deletingPermission) return [];
        return roles.filter((role) => role.permission_ids.includes(deletingPermission.id));
    }, [roles, deletingPermission]);
    const affectedUsersForDeletingPermission = useMemo(
        () =>
            affectedRolesForDeletingPermission.reduce(
                (sum, role) => sum + (role.user_count ?? 0),
                0
            ),
        [affectedRolesForDeletingPermission]
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
        setTogglingPermissionId(permission.id);
        const nextEnabled = !permission.enabled;
        setPermissions((prev) =>
            prev.map((item) =>
                item.id === permission.id
                    ? normalizePermission({ ...item, enabled: nextEnabled })
                    : item
            )
        );
        try {
            const result = await togglePermissionAction(projectId, permission.id, nextEnabled);
            if (!result.ok) {
                setPermissions((prev) =>
                    prev.map((item) =>
                        item.id === permission.id
                            ? normalizePermission({ ...item, enabled: permission.enabled })
                            : item
                    )
                );
                toast.error(result.error || "Failed to update permission status.");
            } else {
                toast.success(nextEnabled ? "Permission enabled." : "Permission disabled.");
            }
        } finally {
            setTogglingPermissionId(null);
        }
    }, [projectId, setPermissions, toast]);

    const handleCreate = useCallback(
        async (data: {
            name: string;
            slug: string;
            description?: string;
            risk_level: Permission["risk_level"];
        }) => {
            setSavingPermissionMode("create");
            try {
                const result = await createPermissionActionRaw(projectId, data);
                if (result.ok) {
                    setPermissions((prev) => [normalizePermission(result.data), ...prev]);
                    setIsCreateOpen(false);
                    toast.success("Permission created.");
                } else {
                    toast.error(result.error || "Failed to create permission.");
                }
                return result;
            } finally {
                setSavingPermissionMode(null);
            }
        },
        [projectId, setPermissions, toast]
    );

    const handleUpdate = useCallback(
        async (id: string, data: {
            name: string;
            slug: string;
            description?: string;
            risk_level: Permission["risk_level"];
            enabled: boolean;
        }) => {
            setSavingPermissionMode("edit");
            setPermissions((prev) =>
                prev.map((item) =>
                    item.id === id ? normalizePermission({ ...item, ...data }) : item
                )
            );
            try {
                const result = await updatePermissionActionRaw(id, data);
                if (result.ok) {
                    setPermissions((prev) =>
                        prev.map((item) =>
                            item.id === id ? normalizePermission(result.data) : item
                        )
                    );
                    setEditingPermission(null);
                    toast.success("Permission saved.");
                } else {
                    toast.error(result.error || "Failed to save permission.");
                }
                return result;
            } finally {
                setSavingPermissionMode(null);
            }
        },
        [setPermissions, toast]
    );

    const handleDelete = useCallback(async () => {
        if (!deletingPermission || deletingPermission.is_system) return;
        setDeletingPermissionId(deletingPermission.id);
        try {
            const result = await deletePermissionAction(projectId, deletingPermission.id);
            if (result.ok) {
                setPermissions((prev) =>
                    prev.filter((item) => item.id !== deletingPermission.id)
                );
                if (viewingPermissionId === deletingPermission.id) {
                    setViewingPermissionId(null);
                }
                setDeletingPermission(null);
                toast.success("Permission deleted.");
            } else {
                toast.error(result.error || "Failed to delete permission.");
            }
            return result;
        } finally {
            setDeletingPermissionId(null);
        }
    }, [projectId, deletingPermission, viewingPermissionId, setPermissions, toast]);

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
                togglingPermissionId={togglingPermissionId}
                onEdit={(permission) => setEditingPermission(permission)}
                onDelete={(permission) => setDeletingPermission(permission)}
            />

            {isCreateOpen && (
                <CreatePermissionModal
                    permissions={permissions}
                    onClose={() => {
                        if (savingPermissionMode !== "create") setIsCreateOpen(false);
                    }}
                    onCreate={handleCreate}
                    isSaving={savingPermissionMode === "create"}
                    onDirtyChange={setCreateFormDirty}
                />
            )}

            {editingPermission && (
                <EditPermissionModal
                    permissions={permissions}
                    permission={editingPermission}
                    onClose={() => {
                        if (savingPermissionMode !== "edit") setEditingPermission(null);
                    }}
                    onSave={handleUpdate}
                    isSaving={savingPermissionMode === "edit"}
                    onDirtyChange={setEditFormDirty}
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
                    affectedRoles={affectedRolesForDeletingPermission}
                    affectedUsers={affectedUsersForDeletingPermission}
                    onClose={() => {
                        if (deletingPermissionId !== deletingPermission.id) setDeletingPermission(null);
                    }}
                    onConfirm={handleDelete}
                    isDeleting={deletingPermissionId === deletingPermission.id}
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
                            placeholder="Permissions suchen"
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
                            <option value="all">All statuses</option>
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
                            <option value="all">All risks</option>
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
                    className="btn btn-primary h-10 w-full shrink-0 whitespace-nowrap lg:h-11 lg:w-auto lg:min-w-[168px]"
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
    togglingPermissionId,
    onEdit,
    onDelete,
}: {
    permissions: Permission[];
    onView: (permission: Permission) => void;
    onToggle: (permission: Permission) => void;
    togglingPermissionId: string | null;
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
                        isToggling={togglingPermissionId === permission.id}
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
    isToggling,
    onEdit,
    onDelete,
}: {
    permission: Permission;
    onView: (permission: Permission) => void;
    onToggle: (permission: Permission) => void;
    isToggling: boolean;
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
                    {isToggling ? "Saving..." : permission.enabled ? "Enabled" : "Disabled"}
                </span>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggle(permission);
                    }}
                    disabled={isToggling}
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
                    className="btn-icon btn-icon-secondary"
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
                    className="btn-icon btn-icon-secondary"
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
                    className="btn-icon btn-icon-danger"
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
    isSaving,
    onDirtyChange,
}: {
    permissions: Permission[];
    onClose: () => void;
    onCreate: (data: {
        name: string;
        slug: string;
        description?: string;
        risk_level: Permission["risk_level"];
    }) => Promise<unknown>;
    isSaving: boolean;
    onDirtyChange: (value: boolean) => void;
}) {
    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [slugTouched, setSlugTouched] = useState(false);
    const [description, setDescription] = useState("");
    const [riskLevel, setRiskLevel] = useState<Permission["risk_level"]>("low");
    const [submitted, setSubmitted] = useState(false);
    const [showDiscardPrompt, setShowDiscardPrompt] = useState(false);

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
    const isDirty = useMemo(
        () =>
            name !== "" ||
            slug !== "" ||
            description !== "" ||
            riskLevel !== "low",
        [name, slug, description, riskLevel]
    );

    useEffect(() => {
        onDirtyChange(isDirty);
        return () => onDirtyChange(false);
    }, [isDirty, onDirtyChange]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitted(true);
        if (!canSubmit || isSaving) return;
        await onCreate({
            name: name.trim(),
            slug: slug.trim(),
            description: description.trim(),
            risk_level: riskLevel,
        });
    };

    const requestClose = () => {
        if (isSaving) return;
        if (isDirty) {
            setShowDiscardPrompt(true);
            return;
        }
        onClose();
    };

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
                <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0f141d] p-7 shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
                    <div>
                        <h3 className="text-xl font-semibold text-white">New permission</h3>
                        <p className="mt-1 text-sm text-white/45">Define name, slug, and risk level.</p>
                    </div>
                    <button onClick={requestClose} disabled={isSaving} className="btn btn-secondary text-xs px-3 py-1.5">
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
                            <label className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.14em] text-white/45">
                                Slug
                                <InfoTip text="A slug is the short ID of this permission. It is used in API checks and rules. It is auto-filled from the name. Use lowercase letters, numbers, and dots. It must be unique." />
                            </label>
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
                    <div>
                        <label className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.14em] text-white/45">
                            Risk level
                            <InfoTip text="Choose how sensitive this permission is: low, medium, or high. Higher levels should be reviewed more carefully." />
                        </label>
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
                        <button type="button" onClick={requestClose} disabled={isSaving} className="btn btn-secondary">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!canSubmit || isSaving}
                            className="btn btn-primary"
                        >
                            {isSaving ? "Saving..." : "Create"}
                        </button>
                    </div>
                </form>
                </div>
            </div>
            {showDiscardPrompt && (
                <DiscardChangesModal
                    title="Discard unsaved changes?"
                    message="You have unsaved changes in this permission form. If you close now, those changes will be lost."
                    onCancel={() => setShowDiscardPrompt(false)}
                    onConfirm={() => {
                        setShowDiscardPrompt(false);
                        onClose();
                    }}
                />
            )}
        </>
    );
}

function EditPermissionModal({
    permissions,
    permission,
    onClose,
    onSave,
    isSaving,
    onDirtyChange,
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
    isSaving: boolean;
    onDirtyChange: (value: boolean) => void;
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
    const [showDiscardPrompt, setShowDiscardPrompt] = useState(false);

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
    const isDirty = useMemo(
        () =>
            name !== permission.name ||
            slug !== permission.slug ||
            description !== (permission.description ?? "") ||
            riskLevel !== permission.risk_level ||
            enabled !== permission.enabled,
        [name, slug, description, riskLevel, enabled, permission]
    );

    useEffect(() => {
        onDirtyChange(isDirty);
        return () => onDirtyChange(false);
    }, [isDirty, onDirtyChange]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitted(true);
        if (!canSubmit || isSaving) return;
        await onSave(permission.id, {
            name: name.trim(),
            slug: slug.trim(),
            description: description.trim(),
            risk_level: riskLevel,
            enabled,
        });
    };

    const requestClose = () => {
        if (isSaving) return;
        if (isDirty) {
            setShowDiscardPrompt(true);
            return;
        }
        onClose();
    };

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
                <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0f141d] p-7 shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
                    <div>
                        <h3 className="text-xl font-semibold text-white">Edit permission</h3>
                        <p className="mt-1 text-sm text-white/45">Update metadata and deployment status.</p>
                    </div>
                    <button onClick={requestClose} disabled={isSaving} className="btn btn-secondary text-xs px-3 py-1.5">
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
                            <label className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.14em] text-white/45">
                                Slug
                                <InfoTip text="A slug is the short ID of this permission (for example: feature.export). It is used in API checks and rules. Use lowercase letters, numbers, and dots. It must be unique." />
                            </label>
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
                            <label className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.14em] text-white/45">
                                Risk level
                                <InfoTip text="Higher risk means this permission should have stricter review and rollout checks." />
                            </label>
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
                        <button type="button" onClick={requestClose} disabled={isSaving} className="btn btn-secondary">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!canSubmit || isSaving}
                            className="btn btn-primary"
                        >
                            {isSaving ? "Saving..." : "Save"}
                        </button>
                    </div>
                </form>
                </div>
            </div>
            {showDiscardPrompt && (
                <DiscardChangesModal
                    title="Discard unsaved changes?"
                    message="You have unsaved changes in this permission form. If you close now, those changes will be lost."
                    onCancel={() => setShowDiscardPrompt(false)}
                    onConfirm={() => {
                        setShowDiscardPrompt(false);
                        onClose();
                    }}
                />
            )}
        </>
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
                    <button onClick={onClose} className="btn btn-secondary text-xs px-3 py-1.5">
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
                        <p className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.14em] text-white/45">
                            Risk
                            <InfoTip text="Shows how sensitive this permission is, so teams can prioritize review and safeguards." />
                        </p>
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
                        <p className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.14em] text-white/45">
                            Type
                            <InfoTip text="System permissions are built-in and protected. Custom permissions are for your own feature access rules." />
                        </p>
                        <p className="mt-2 text-sm text-white/85">{permission.is_system ? "System permission" : "Custom permission"}</p>
                    </div>
                </div>

                <div className="mt-6 flex justify-end gap-3 border-t border-white/10 pt-5">
                    <button type="button" onClick={onClose} className="btn btn-secondary">
                        Close
                    </button>
                    <button
                        type="button"
                        onClick={() => onEdit(permission)}
                        className="btn btn-secondary"
                    >
                        Edit permission
                    </button>
                    <button
                        type="button"
                        onClick={() => onDelete(permission)}
                        disabled={permission.is_system}
                        className="btn btn-danger"
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
    affectedRoles,
    affectedUsers,
    onClose,
    onConfirm,
    isDeleting,
}: {
    permission: Permission;
    affectedRoles: Role[];
    affectedUsers: number;
    onClose: () => void;
    onConfirm: () => void;
    isDeleting: boolean;
}) {
    const isBlocked = permission.is_system;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f141d] p-7">
                <h3 className="text-xl font-semibold text-white">Delete permission</h3>
                <p className="mt-2 text-sm text-white/60">
                    {isBlocked
                        ? "System permissions cannot be deleted."
                        : `You are about to delete ${permission.name}. This action cannot be undone.`}
                </p>
                {!isBlocked && (
                    <div className="mt-4 rounded-xl border border-white/10 bg-[#0b121c] p-4">
                        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/50">
                            Impact Preview
                        </p>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                            <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                                <p className="text-[11px] uppercase tracking-[0.12em] text-white/45">Affected roles</p>
                                <p className="mt-1 text-sm font-semibold text-white">{affectedRoles.length}</p>
                            </div>
                            <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                                <p className="text-[11px] uppercase tracking-[0.12em] text-white/45">Potential user impact</p>
                                <p className="mt-1 text-sm font-semibold text-white">{affectedUsers}</p>
                            </div>
                        </div>
                        {affectedRoles.length > 0 && (
                            <div className="mt-3">
                                <p className="mb-2 text-xs text-white/55">Roles currently using this permission:</p>
                                <div className="max-h-28 space-y-1 overflow-y-auto rounded-lg border border-white/10 bg-[#0a0f16] px-2 py-2">
                                    {affectedRoles.map((role) => (
                                        <div key={role.id} className="flex items-center justify-between gap-3 text-xs text-white/75">
                                            <span className="truncate">{role.name}</span>
                                            <span className="shrink-0 text-white/50">{role.user_count} users</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
                <div className="mt-6 flex justify-end gap-3 border-t border-white/10 pt-5">
                    <button onClick={onClose} disabled={isDeleting} className="btn btn-secondary">
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isBlocked || isDeleting}
                        className="btn btn-danger"
                    >
                        {isDeleting ? "Deleting..." : "Delete"}
                    </button>
                </div>
            </div>
        </div>
    );
}

function AuditLogTimeline({ logs }: { logs: AuditLogInput[] }) {
    const getMetaString = (log: AuditLogInput, key: string) => {
        const value = log.metadata?.[key];
        return typeof value === "string" ? value : null;
    };

    const getMetaNumber = (log: AuditLogInput, key: string) => {
        const value = log.metadata?.[key];
        return typeof value === "number" ? value : null;
    };

    const getMetaBoolean = (log: AuditLogInput, key: string) => {
        const value = log.metadata?.[key];
        return typeof value === "boolean" ? value : null;
    };

    const getActionVariant = (log: AuditLogInput) => {
        const event = getMetaString(log, "event");
        if (event === "permission_enabled") return "enabled";
        if (event === "permission_disabled") return "disabled";
        return log.action;
    };

    const actionLabel = (action: string) => {
        if (action === "created") return "Created";
        if (action === "updated") return "Updated";
        if (action === "deleted") return "Deleted";
        if (action === "enabled") return "Enabled";
        if (action === "disabled") return "Disabled";
        if (action === "granted") return "Enabled";
        if (action === "revoked") return "Disabled";
        return action;
    };

    const actionStyle = (action: string) => {
        if (action === "created" || action === "enabled" || action === "granted") {
            return "border-emerald-400/20 bg-emerald-500/10 text-emerald-200";
        }
        if (action === "deleted" || action === "disabled" || action === "revoked") {
            return "border-red-400/20 bg-red-500/10 text-red-200";
        }
        return "border-white/10 bg-white/5 text-white/70";
    };

    const actionDotStyle = (action: string) => {
        if (action === "created" || action === "enabled" || action === "granted") {
            return "bg-emerald-300";
        }
        if (action === "deleted" || action === "disabled" || action === "revoked") {
            return "bg-red-300";
        }
        return "bg-white/40";
    };

    const entityLabel = (entityType: string) => {
        if (entityType === "permission") return "Permission";
        if (entityType === "role") return "Role";
        if (entityType === "api_key") return "API key";
        return entityType;
    };

    const eventTitle = (log: AuditLogInput) => {
        const variant = getActionVariant(log);
        const entity = entityLabel(log.entity_type);
        const name =
            getMetaString(log, "name") ??
            getMetaString(log, "slug") ??
            (log.entity_type === "api_key" ? "API key" : entity.toLowerCase());

        if (log.entity_type === "permission" && variant === "enabled") {
            return `Permission "${name}" enabled`;
        }
        if (log.entity_type === "permission" && variant === "disabled") {
            return `Permission "${name}" disabled`;
        }
        return `${entity} "${name}" ${actionLabel(variant).toLowerCase()}`;
    };

    const detailLine = (log: AuditLogInput) => {
        const permissionCount = getMetaNumber(log, "permission_count");
        const riskLevel = getMetaString(log, "risk_level");
        const event = getMetaString(log, "event");
        const enabled = getMetaBoolean(log, "enabled");

        if (event === "api_key_rotated") return "Credentials rotated for this project.";
        if (event === "api_key_generated") return "New credentials generated for this project.";
        if (permissionCount !== null) {
            return `${permissionCount} permission${permissionCount === 1 ? "" : "s"} linked.`;
        }
        if (riskLevel) return `Risk level: ${riskLevel}.`;
        if (enabled !== null) return `Current status: ${enabled ? "enabled" : "disabled"}.`;
        return null;
    };

    const formatTime = (value: string) => {
        const d = new Date(value);
        return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    };

    const dayLabel = (value: string) => {
        const d = new Date(value);
        const now = new Date();
        const startNow = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const startDate = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        const diffDays = Math.round((startNow - startDate) / 86400000);
        if (diffDays === 0) return "Today";
        if (diffDays === 1) return "Yesterday";
        return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" });
    };

    const groupedLogs = useMemo(() => {
        const groups: Array<{ key: string; label: string; items: AuditLogInput[] }> = [];
        for (const log of logs) {
            const key = new Date(log.created_at).toISOString().slice(0, 10);
            const existing = groups.find((group) => group.key === key);
            if (existing) {
                existing.items.push(log);
            } else {
                groups.push({ key, label: dayLabel(log.created_at), items: [log] });
            }
        }
        return groups;
    }, [logs]);

    return (
        <div className="mt-2 rounded-2xl border border-white/10 bg-gradient-to-b from-[#121a27] to-[#0f141d] p-5">
            {logs.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/15 bg-[#0a0f16] px-6 py-10 text-center text-sm text-white/45">
                    No audit events yet.
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#0b111b]/90 px-4 py-2.5 text-xs text-white/50">
                        <span>{logs.length} events</span>
                        <span>Newest first</span>
                    </div>
                    <div className="max-h-[620px] space-y-5 overflow-y-auto pr-1">
                        {groupedLogs.map((group) => (
                            <div key={group.key}>
                                <p className="mb-2 px-1 text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
                                    {group.label}
                                </p>
                                <div className="space-y-2 rounded-xl border border-white/8 bg-[#0a1019] p-2.5">
                                    {group.items.map((log) => {
                                        const variant = getActionVariant(log);
                                        const detail = detailLine(log);
                                        return (
                                            <div
                                                key={log.id}
                                                className="group relative overflow-hidden rounded-xl border border-white/10 bg-[#0b121d] px-4 py-3 transition hover:border-white/20 hover:bg-[#0c1521]"
                                            >
                                                <span className={`absolute left-0 top-0 h-full w-[2px] ${actionDotStyle(variant)}`} />
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className={`h-1.5 w-1.5 rounded-full ${actionDotStyle(variant)}`} />
                                                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.12em] ${actionStyle(variant)}`}>
                                                                {actionLabel(variant)}
                                                            </span>
                                                            <p className="truncate text-sm font-semibold text-white/92">
                                                                {eventTitle(log)}
                                                            </p>
                                                        </div>
                                                        {detail && (
                                                            <p className="mt-1 text-xs text-white/62">{detail}</p>
                                                        )}
                                                        <p className="mt-1 text-xs text-white/45">
                                                            By {log.user_id ? `${log.user_id.slice(0, 8)}...` : "system"}
                                                        </p>
                                                    </div>
                                                    <span className="shrink-0 rounded-md bg-white/[0.04] px-2 py-0.5 text-xs text-white/50">
                                                        {formatTime(log.created_at)}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function DiscardChangesModal({
    title,
    message,
    onCancel,
    onConfirm,
}: {
    title: string;
    message: string;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f141d] p-7 shadow-2xl">
                <h3 className="text-xl font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm text-white/60">{message}</p>
                <div className="mt-6 flex justify-end gap-3 border-t border-white/10 pt-5">
                    <button type="button" onClick={onCancel} className="btn btn-secondary">
                        Keep editing
                    </button>
                    <button type="button" onClick={onConfirm} className="btn btn-danger">
                        Discard changes
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

function InfoTip({ text }: { text: string }) {
    return (
        <span className="group relative ml-1 inline-flex shrink-0 items-center align-middle">
            <button
                type="button"
                aria-label={text}
                className="m-0 inline-flex h-4 w-4 appearance-none items-center justify-center rounded-sm p-0 text-white/35 outline-none transition hover:text-white/70 focus:text-white/70"
            >
                <svg
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <circle cx="10" cy="10" r="7.25" />
                    <path d="M10 9v4" />
                    <circle cx="10" cy="6.5" r="0.7" fill="currentColor" stroke="none" />
                </svg>
            </button>
            <span
                role="tooltip"
                className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 w-64 -translate-x-1/2 rounded-md border border-white/10 bg-[#0c121b]/95 px-3 py-2 text-[11px] font-normal normal-case tracking-normal text-white/80 opacity-0 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-sm transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-hover:scale-100 group-focus-within:translate-y-0 group-focus-within:opacity-100 group-focus-within:scale-100 translate-y-1 scale-[0.98]"
            >
                <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-l border-t border-white/10 bg-[#0c121b]/95" />
                {text}
            </span>
        </span>
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
