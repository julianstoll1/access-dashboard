"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/feedback/ToastProvider";
import { createProjectAction } from "./actions";

export default function NewProjectPage() {
    const router = useRouter();
    const toast = useToast();
    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [slugTouched, setSlugTouched] = useState(false);
    const [description, setDescription] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
            });
            if (!result.ok) {
                setError(result.error);
                toast.error(result.error);
                return;
            }

            toast.success("Project created.");
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
                        Define project metadata now so your API access setup is clean from day one.
                    </p>

                    <form onSubmit={handleCreate} className="mt-8 space-y-5">
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
        </div>
    );
}
