import { LogoutButton } from "@/components/LogoutButton";
import { getProjects } from "@/lib/projects";

export default async function DashboardPage() {
    const projects = await getProjects();

    return (
        <div className="min-h-screen bg-[#0b0b0c] text-white">
            <header className="flex items-center justify-between border-b border-white/10 px-8 py-5">
                <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>
                <LogoutButton />
            </header>

            <main className="mx-auto max-w-4xl px-8 py-12">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold">Projects</h2>
                    <a
                        href="/dashboard/new"
                        className="rounded-md bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90"
                    >
                        New project
                    </a>
                </div>

                {projects.length === 0 ? (
                    <div className="rounded-xl border border-white/10 bg-[#0f0f11] p-10 text-center">
                        <p className="text-sm text-white/50">
                            You don’t have any projects yet.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {projects.map((project) => (
                            <div
                                key={project.id}
                                className="rounded-lg border border-white/10 bg-[#0f0f11] px-4 py-3"
                            >
                                <p className="font-medium">{project.name}</p>
                                <p className="text-xs text-white/40">
                                    Created {new Date(project.created_at).toLocaleDateString()}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}