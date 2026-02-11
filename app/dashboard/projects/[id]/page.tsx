import { notFound } from "next/navigation";
import { getProject } from "@/lib/projects";
import { getApiKeyForProject } from "@/lib/apiKeys";

import { ApiKeyDisplay } from "./ApiKeyDisplay";
import { GenerateApiKeyButton } from "./GenerateApiKeyButton";
import { BackButton } from "./BackButton";

export default async function ProjectPage({
                                              params,
                                          }: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const project = await getProject(id);
    if (!project) return notFound();

    const apiKey = await getApiKeyForProject(project.id);

    // Dummy visual stats (rein optisch)
    const usageMonth = 24193;
    const usageLimit = 100000;
    const activeGrants = 182;
    const rolesCount = 3;

    return (
        <div className="min-h-screen bg-[#0e1117] text-white">
            <main className="mx-auto max-w-7xl px-12 py-24">

                {/* Back */}
                <BackButton />

                {/* HEADER */}
                <div className="mt-12 flex items-center justify-between">

                    <div>
                        <h1 className="text-3xl font-semibold tracking-tight">
                            {project.name}
                        </h1>

                        <p className="mt-3 text-sm text-white/40">
                            Project ID · {project.id}
                        </p>
                    </div>

                    <div className="flex items-center gap-10 text-right">

                        <div>
                            <p className="text-xs uppercase tracking-wider text-white/40">
                                Active Grants
                            </p>
                            <p className="mt-2 text-lg font-medium">
                                {activeGrants}
                            </p>
                        </div>

                        <div>
                            <p className="text-xs uppercase tracking-wider text-white/40">
                                Roles
                            </p>
                            <p className="mt-2 text-lg font-medium">
                                {rolesCount}
                            </p>
                        </div>

                    </div>
                </div>

                {/* MAIN GRID */}
                <div className="mt-20 grid grid-cols-12 gap-12">

                    {/* LEFT COLUMN */}
                    <div className="col-span-8 space-y-16">

                        {/* API KEY SECTION */}
                        <section className="rounded-3xl border border-white/5 bg-[#151922] p-12 shadow-[0_0_60px_rgba(0,0,0,0.4)]">

                            <div className="flex items-center justify-between">
                                <h2 className="text-sm uppercase tracking-widest text-white/40">
                                    API Credentials
                                </h2>

                                {apiKey && (
                                    <span className="rounded-full bg-emerald-500/10 px-4 py-2 text-xs font-medium text-emerald-400">
                    Active
                  </span>
                                )}
                            </div>

                            {!apiKey ? (
                                <div className="mt-10">
                                    <p className="text-sm text-white/50">
                                        No API key generated yet.
                                    </p>

                                    <div className="mt-8">
                                        <GenerateApiKeyButton projectId={project.id} />
                                    </div>
                                </div>
                            ) : (
                                <div className="mt-10">
                                    <ApiKeyDisplay
                                        projectId={project.id}
                                        apiKey={apiKey.key}
                                        createdAt={apiKey.created_at}
                                        lastRotatedAt={apiKey.last_rotated_at}
                                    />
                                </div>
                            )}
                        </section>

                        {/* ROLES SECTION */}
                        <section className="rounded-3xl border border-white/5 bg-[#151922] p-12 shadow-[0_0_60px_rgba(0,0,0,0.4)]">

                            <h2 className="text-sm uppercase tracking-widest text-white/40">
                                Roles & Permissions
                            </h2>

                            <div className="mt-10 space-y-6">

                                <div className="flex items-center justify-between rounded-2xl bg-black/30 px-8 py-6">
                                    <div>
                                        <p className="text-base font-medium">
                                            Premium
                                        </p>
                                        <p className="mt-1 text-xs text-white/40">
                                            4 permissions · 128 users
                                        </p>
                                    </div>

                                    <button className="text-xs text-white/50 hover:text-white">
                                        Manage
                                    </button>
                                </div>

                                <div className="flex items-center justify-between rounded-2xl bg-black/30 px-8 py-6">
                                    <div>
                                        <p className="text-base font-medium">
                                            Elite
                                        </p>
                                        <p className="mt-1 text-xs text-white/40">
                                            7 permissions · 42 users
                                        </p>
                                    </div>

                                    <button className="text-xs text-white/50 hover:text-white">
                                        Manage
                                    </button>
                                </div>

                            </div>

                            <button className="mt-10 rounded-md border border-white/10 px-5 py-2 text-sm text-white/70 hover:bg-white/5">
                                Create Role
                            </button>

                        </section>

                    </div>

                    {/* RIGHT COLUMN */}
                    <div className="col-span-4 space-y-16">

                        {/* USAGE */}
                        <section className="rounded-3xl border border-white/5 bg-[#151922] p-10 shadow-[0_0_60px_rgba(0,0,0,0.4)]">

                            <h2 className="text-sm uppercase tracking-widest text-white/40">
                                Usage
                            </h2>

                            <div className="mt-8">

                                <div className="flex justify-between text-sm text-white/60">
                  <span>
                    {usageMonth.toLocaleString()} requests
                  </span>
                                    <span>
                    {usageLimit.toLocaleString()} limit
                  </span>
                                </div>

                                <div className="mt-6 h-2 w-full rounded-full bg-white/10">
                                    <div
                                        className="h-2 rounded-full bg-indigo-500"
                                        style={{
                                            width:
                                                (usageMonth / usageLimit) * 100 + "%",
                                        }}
                                    />
                                </div>

                            </div>

                        </section>

                        {/* SECURITY */}
                        <section className="rounded-3xl border border-white/5 bg-[#151922] p-10 shadow-[0_0_60px_rgba(0,0,0,0.4)]">

                            <h2 className="text-sm uppercase tracking-widest text-white/40">
                                Security
                            </h2>

                            <div className="mt-8 space-y-4 text-sm text-white/50">

                                <div className="flex justify-between">
                                    <span>Key rotations</span>
                                    <span>3 last 30d</span>
                                </div>

                                <div className="flex justify-between">
                                    <span>IP restrictions</span>
                                    <span className="text-white/30">
                    Not configured
                  </span>
                                </div>

                            </div>

                        </section>

                    </div>
                </div>

            </main>
        </div>
    );
}