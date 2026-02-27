"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/feedback/ToastProvider";
import { createProjectAction, type ProjectTemplateKey } from "./actions";

export default function NewProjectPage() {
    const router = useRouter();
    const toast = useToast();
    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [slugTouched, setSlugTouched] = useState(false);
    const [description, setDescription] = useState("");
    const [template, setTemplate] = useState<ProjectTemplateKey>("starter");
    const [createFirstPermission, setCreateFirstPermission] = useState(true);
    const [createFirstRole, setCreateFirstRole] = useState(true);
    const [createFirstApiKey, setCreateFirstApiKey] = useState(false);
    const [firstPermissionName, setFirstPermissionName] = useState("Read access");
    const [firstPermissionSlug, setFirstPermissionSlug] = useState("access.read");
    const [firstRoleName, setFirstRoleName] = useState("Member");
    const [firstRoleSlug, setFirstRoleSlug] = useState("member");
    const [firstApiKeyName, setFirstApiKeyName] = useState("Primary key");
    const [firstApiKeyDescription, setFirstApiKeyDescription] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [createdProjectSlug, setCreatedProjectSlug] = useState<string | null>(null);
    const [createdApiKeyName, setCreatedApiKeyName] = useState<string | null>(null);
    const [createdApiKeyValue, setCreatedApiKeyValue] = useState<string | null>(null);

    function slugify(value: string) {
        return value
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9.]+/g, ".")
            .replace(/\.{2,}/g, ".")
            .replace(/(^\.)|(\.$)/g, "");
    }

    function handleNameChange(value: string) {
        setName(value);
        if (!slugTouched) {
            setSlug(slugify(value));
        }
    }

    useEffect(() => {
        if (template === "blank") {
            setCreateFirstPermission(false);
            setCreateFirstRole(false);
            setCreateFirstApiKey(false);
            setFirstPermissionName("Read access");
            setFirstPermissionSlug("access.read");
            setFirstRoleName("Member");
            setFirstRoleSlug("member");
            setFirstApiKeyName("Primary key");
            setFirstApiKeyDescription("");
            return;
        }

        if (template === "starter") {
            setCreateFirstPermission(true);
            setCreateFirstRole(true);
            setCreateFirstApiKey(false);
            setFirstPermissionName("Read access");
            setFirstPermissionSlug("access.read");
            setFirstRoleName("Member");
            setFirstRoleSlug("member");
            setFirstApiKeyName("Primary key");
            setFirstApiKeyDescription("");
            return;
        }

        setCreateFirstPermission(true);
        setCreateFirstRole(true);
        setCreateFirstApiKey(true);
        setFirstPermissionName("Manage access");
        setFirstPermissionSlug("access.manage");
        setFirstRoleName("Admin");
        setFirstRoleSlug("admin");
        setFirstApiKeyName("Server key");
        setFirstApiKeyDescription("Created during project setup.");
    }, [template]);

    const localErrors = useMemo(() => {
        const errors: { name?: string; slug?: string } = {};
        const trimmedName = name.trim();
        const trimmedSlug = slug.trim();
        if (!trimmedName) errors.name = "Project name is required.";
        if (!trimmedSlug) errors.slug = "Project slug is required.";
        if (trimmedSlug && !/^[a-z0-9.]+$/.test(trimmedSlug)) {
            errors.slug = "Use lowercase letters, numbers, and dots only.";
        }
        return errors;
    }, [name, slug]);

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        if (localErrors.name || localErrors.slug) return;
        setError(null);
        setLoading(true);
        try {
            const result = await createProjectAction({
                name: name.trim(),
                slug: slug.trim(),
                description: description.trim(),
                template,
                create_first_permission: createFirstPermission,
                create_first_role: createFirstRole,
                create_first_api_key: createFirstApiKey,
                first_permission_name: firstPermissionName.trim(),
                first_permission_slug: firstPermissionSlug.trim(),
                first_role_name: firstRoleName.trim(),
                first_role_slug: firstRoleSlug.trim(),
                first_api_key_name: firstApiKeyName.trim(),
                first_api_key_description: firstApiKeyDescription.trim(),
            });
            if (!result.ok) {
                setError(result.error);
                toast.error(result.error);
                return;
            }

            toast.success("Project created.");
            if (result.data.onboarding.api_key_value) {
                setCreatedProjectSlug(result.data.slug);
                setCreatedApiKeyName(result.data.onboarding.api_key_name);
                setCreatedApiKeyValue(result.data.onboarding.api_key_value);
                return;
            }
            router.push(`/dashboard/projects/${result.data.slug}?tab=settings`);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-[#0e1117] text-white">
            <main className="mx-auto w-full max-w-4xl px-8 py-16">
                <a href="/dashboard" className="text-sm text-white/55 hover:text-white/80">
                    ← Back to projects
                </a>

                <div className="mt-8 rounded-3xl border border-white/10 bg-[#151922] p-8 shadow-[0_30px_60px_-40px_rgba(0,0,0,0.9)]">
                    <h1 className="text-3xl font-semibold tracking-tight">Create project</h1>
                    <p className="mt-2 text-sm text-white/55">
                        Define project metadata and choose how much setup you want to create right away.
                    </p>

                    <form onSubmit={handleCreate} className="mt-8 space-y-5">
                        <div>
                            <span className="text-[11px] uppercase tracking-[0.14em] text-white/45">Start from template</span>
                            <div className="mt-3 grid gap-3 md:grid-cols-3">
                                {[
                                    {
                                        key: "blank" as const,
                                        title: "Blank",
                                        text: "Create only the project and configure everything manually.",
                                    },
                                    {
                                        key: "starter" as const,
                                        title: "Starter",
                                        text: "Create a first permission and role so the project is ready faster.",
                                    },
                                    {
                                        key: "admin" as const,
                                        title: "Admin-ready",
                                        text: "Create starter access objects and the first API key for backend use.",
                                    },
                                ].map((option) => (
                                    <button
                                        key={option.key}
                                        type="button"
                                        onClick={() => setTemplate(option.key)}
                                        className={`rounded-2xl border p-4 text-left transition ${
                                            template === option.key
                                                ? "border-white/25 bg-white/[0.06]"
                                                : "border-white/10 bg-[#0a0f16] hover:border-white/20"
                                        }`}
                                    >
                                        <p className="text-sm font-semibold text-white">{option.title}</p>
                                        <p className="mt-2 text-xs text-white/55">{option.text}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <label className="block">
                            <span className="text-[11px] uppercase tracking-[0.14em] text-white/45">Project name</span>
                            <input
                                className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0a0f16] px-4 text-sm text-white focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/10"
                                placeholder="My access project"
                                value={name}
                                onChange={(e) => handleNameChange(e.target.value)}
                                disabled={loading}
                                required
                            />
                            {localErrors.name && <p className="mt-2 text-xs text-red-300">{localErrors.name}</p>}
                        </label>

                        <label className="block">
                            <span className="text-[11px] uppercase tracking-[0.14em] text-white/45">Slug</span>
                            <input
                                className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0a0f16] px-4 text-sm font-mono text-white focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/10"
                                placeholder="my.access.project"
                                value={slug}
                                onChange={(e) => {
                                    setSlugTouched(true);
                                    setSlug(e.target.value);
                                }}
                                disabled={loading}
                                required
                            />
                            <p className="mt-2 text-xs text-white/45">
                                URL preview: <span className="font-mono text-white/70">/dashboard/projects/{slug || "project.slug"}</span>
                            </p>
                            {localErrors.slug && <p className="mt-2 text-xs text-red-300">{localErrors.slug}</p>}
                        </label>

                        <label className="block">
                            <span className="text-[11px] uppercase tracking-[0.14em] text-white/45">Description</span>
                            <textarea
                                className="mt-2 w-full rounded-xl border border-white/10 bg-[#0a0f16] px-4 py-3 text-sm text-white focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/10"
                                placeholder="Short context about this project and its API usage."
                                rows={4}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                disabled={loading}
                            />
                        </label>

                        <div className="rounded-2xl border border-white/10 bg-[#0a0f16] p-5">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h2 className="text-sm font-semibold text-white">Optional setup</h2>
                                    <p className="mt-1 text-xs text-white/50">
                                        Create the first objects now so the project is usable immediately.
                                    </p>
                                </div>
                            </div>

                            <div className="mt-4 space-y-4">
                                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                                    <label className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm text-white/88">Create first permission</p>
                                            <p className="mt-1 text-xs text-white/50">Good for your first integration example.</p>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={createFirstPermission}
                                            onChange={(e) => setCreateFirstPermission(e.target.checked)}
                                            className="h-4 w-4 rounded border-white/20 bg-[#0a0f16] text-white focus:ring-white/20"
                                        />
                                    </label>
                                    {createFirstPermission && (
                                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                                            <input
                                                value={firstPermissionName}
                                                onChange={(e) => {
                                                    setFirstPermissionName(e.target.value);
                                                    setFirstPermissionSlug(slugify(e.target.value) || firstPermissionSlug);
                                                }}
                                                className="h-10 rounded-xl border border-white/10 bg-[#0e131b] px-4 text-sm text-white focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/10"
                                                placeholder="Permission name"
                                            />
                                            <input
                                                value={firstPermissionSlug}
                                                onChange={(e) => setFirstPermissionSlug(e.target.value)}
                                                className="h-10 rounded-xl border border-white/10 bg-[#0e131b] px-4 text-sm font-mono text-white focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/10"
                                                placeholder="permission.slug"
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                                    <label className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm text-white/88">Create first role</p>
                                            <p className="mt-1 text-xs text-white/50">Useful when you want to start assigning access rules immediately.</p>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={createFirstRole}
                                            onChange={(e) => setCreateFirstRole(e.target.checked)}
                                            className="h-4 w-4 rounded border-white/20 bg-[#0a0f16] text-white focus:ring-white/20"
                                        />
                                    </label>
                                    {createFirstRole && (
                                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                                            <input
                                                value={firstRoleName}
                                                onChange={(e) => {
                                                    setFirstRoleName(e.target.value);
                                                    setFirstRoleSlug(slugify(e.target.value) || firstRoleSlug);
                                                }}
                                                className="h-10 rounded-xl border border-white/10 bg-[#0e131b] px-4 text-sm text-white focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/10"
                                                placeholder="Role name"
                                            />
                                            <input
                                                value={firstRoleSlug}
                                                onChange={(e) => setFirstRoleSlug(e.target.value)}
                                                className="h-10 rounded-xl border border-white/10 bg-[#0e131b] px-4 text-sm font-mono text-white focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/10"
                                                placeholder="role.slug"
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                                    <label className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm text-white/88">Generate first API key</p>
                                            <p className="mt-1 text-xs text-white/50">Recommended if you want to test the API right after project creation.</p>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={createFirstApiKey}
                                            onChange={(e) => setCreateFirstApiKey(e.target.checked)}
                                            className="h-4 w-4 rounded border-white/20 bg-[#0a0f16] text-white focus:ring-white/20"
                                        />
                                    </label>
                                    {createFirstApiKey && (
                                        <div className="mt-3 grid gap-3">
                                            <input
                                                value={firstApiKeyName}
                                                onChange={(e) => setFirstApiKeyName(e.target.value)}
                                                className="h-10 rounded-xl border border-white/10 bg-[#0e131b] px-4 text-sm text-white focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/10"
                                                placeholder="API key name"
                                            />
                                            <textarea
                                                rows={3}
                                                value={firstApiKeyDescription}
                                                onChange={(e) => setFirstApiKeyDescription(e.target.value)}
                                                className="rounded-xl border border-white/10 bg-[#0e131b] px-4 py-3 text-sm text-white focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/10"
                                                placeholder="Optional description"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="rounded-xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                                {error}
                            </div>
                        )}

                        <div className="flex items-center justify-end gap-3 border-t border-white/10 pt-5">
                            <a href="/dashboard" className="btn btn-secondary">
                                Cancel
                            </a>
                            <button
                                disabled={loading || Boolean(localErrors.name) || Boolean(localErrors.slug)}
                                className="btn btn-primary min-w-[170px]"
                            >
                                {loading ? "Creating..." : "Create project"}
                            </button>
                        </div>
                    </form>
                </div>
            </main>

            {createdProjectSlug && createdApiKeyValue && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
                    <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#151922] p-7 shadow-2xl">
                        <h2 className="text-xl font-semibold text-white">Store your first API key now</h2>
                        <p className="mt-2 text-sm text-white/55">
                            This key for <span className="text-white">{createdApiKeyName || "API key"}</span> is shown only once.
                        </p>
                        <div className="mt-4 rounded-xl border border-white/10 bg-[#0a0f16] px-4 py-3">
                            <code className="break-all text-sm text-white/90">{createdApiKeyValue}</code>
                        </div>
                        <div className="mt-6 flex justify-end gap-3 border-t border-white/10 pt-5">
                            <button
                                type="button"
                                onClick={async () => {
                                    await navigator.clipboard.writeText(createdApiKeyValue);
                                    toast.success("API key copied.");
                                }}
                                className="btn btn-secondary"
                            >
                                Copy key
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    router.push(`/dashboard/projects/${createdProjectSlug}?tab=api`);
                                }}
                                className="btn btn-primary"
                            >
                                Continue to project
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
