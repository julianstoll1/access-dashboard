import { LogoutButton } from "@/components/LogoutButton";
import { getProjects } from "@/lib/projects";

export default async function DashboardPage() {
    const projects = await getProjects();

    return (
        <div className="min-h-screen bg-[#0b0b0c] text-white">
            {/* Header */}
            <header className="flex items-center justify-between border-b border-white/10 px-8 py-5">
                <h1 className="text-sm font-medium text-white/70">
                    Dashboard
                </h1>
                <LogoutButton />
            </header>

            {/* Content */}
            <main className="mx-auto max-w-5xl px-8 py-14">
                {/* Title */}
                <div className="mb-8 flex items-end justify-between">
                    <div>
                        <h2 className="text-2xl font-semibold tracking-tight">
                            Projects
                        </h2>
                        <p className="mt-1 text-sm text-white/40">
                            {projects.length} total
                        </p>
                    </div>

                    <a
                        href="/dashboard/new"
                        className="rounded-md bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90"
                    >
                        New project
                    </a>
                </div>

                {/* Projects */}
                {projects.length === 0 ? (
                    <div className="rounded-xl border border-white/10 bg-[#0f0f11] px-10 py-14 text-center">
                        <p className="text-sm text-white/50">
                            You don’t have any projects yet.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {projects.map((project) => (
                            <a
                                key={project.id}
                                href={`/dashboard/projects/${project.id}`}
                                className="group rounded-xl border border-white/10 bg-[#0f0f11] px-5 py-4 transition hover:border-white/20 hover:bg-[#131316]"
                            >
                                <p className="text-sm font-medium">
                                    {project.name}
                                </p>
                                <p className="mt-1 text-xs text-white/40">
                                    Created{" "}
                                    {new Date(project.created_at).toLocaleDateString()}
                                </p>

                                <p className="mt-4 text-xs text-white/30 opacity-0 transition group-hover:opacity-100">
                                    Open project →
                                </p>
                            </a>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}