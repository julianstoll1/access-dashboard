import { LogoutButton } from "@/components/LogoutButton";
import { getProjectListKpis, getProjects } from "@/lib/projects";

export default async function DashboardPage() {
    const projects = await getProjects();
    const projectKpisById = await getProjectListKpis(projects.map((project) => project.id));

    return (
        <div className="min-h-screen bg-[#0e1117] text-white">
            <main className="mx-auto max-w-[1200px] px-10 py-20">

                {/* ================= CLEAN TOP BAR ================= */}
                <div className="flex items-center justify-between">

                    <h1 className="text-2xl font-semibold tracking-tight">
                        Projects
                    </h1>

                    <div className="flex items-center gap-4">
                        <a
                            href="/dashboard/new"
                            className="btn btn-primary"
                        >
                            + New Project
                        </a>

                        <LogoutButton />
                    </div>
                </div>


                {/* subtle divider */}
                <div className="mt-10 h-px w-full bg-white/5" />


                {/* ================= PROJECT SECTION ================= */}
                <div className="mt-14">

                    {projects.length === 0 ? (
                        <EmptyState />
                    ) : (
                        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">

                            {projects.map((project) => {
                                const projectKpis = projectKpisById.get(project.id);

                                return (
                                    <a
                                        key={project.id}
                                        href={`/dashboard/projects/${project.slug}`}
                                        className="group relative overflow-hidden rounded-3xl border border-white/5 bg-[#151922] p-10 transition hover:border-white/10 hover:bg-[#1a202c]"
                                    >
                                        {/* subtle top accent */}
                                        <div className="absolute top-0 left-0 h-[2px] w-full bg-gradient-to-r from-indigo-500/50 via-purple-500/50 to-transparent opacity-0 transition group-hover:opacity-100" />

                                        <div className="flex items-start justify-between">

                                            <div>
                                                <h3 className="text-xl font-semibold tracking-tight">
                                                    {project.name}
                                                </h3>

                                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                                    <p className="text-xs text-white/40 font-mono">
                                                        {project.id}
                                                    </p>
                                                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${
                                                        project.status === "archived"
                                                            ? "border-amber-400/25 bg-amber-500/10 text-amber-200"
                                                            : "border-emerald-400/25 bg-emerald-500/10 text-emerald-200"
                                                    }`}>
                                                        {project.status}
                                                    </span>
                                                </div>
                                                <p className="mt-2 text-xs text-white/35 font-mono">{project.slug}</p>
                                            </div>

                                            <span className="text-xs text-white/30 group-hover:text-white/60 transition">
                                                Open →
                                            </span>
                                        </div>

                                        <div className="mt-10 flex items-center justify-between text-sm text-white/50">

                                            <ProjectMeta
                                                label="API Calls"
                                                value={(projectKpis?.total_usage_count ?? 0).toLocaleString("en-US")}
                                            />

                                            <ProjectMeta
                                                label="Roles"
                                                value={(projectKpis?.total_roles ?? 0).toString()}
                                            />

                                            <ProjectMeta
                                                label="Created"
                                                value={new Date(project.created_at).toLocaleDateString("en-US")}
                                            />

                                        </div>
                                    </a>
                                );
                            })}

                        </div>
                    )}

                </div>

            </main>
        </div>
    );
}


/* ================= COMPONENTS ================= */

function ProjectMeta({
                         label,
                         value,
                     }: {
    label: string;
    value: string;
}) {
    return (
        <div className="text-left">
            <p className="text-xs text-white/30">{label}</p>
            <p className="mt-1 font-medium">{value}</p>
        </div>
    );
}

function EmptyState() {
    return (
        <div className="rounded-3xl border border-white/5 bg-[#151922] p-20 text-center">
            <p className="text-lg text-white/60">
                No projects yet
            </p>
            <p className="mt-3 text-sm text-white/40">
                Create your first project to start managing access.
            </p>

            <a
                href="/dashboard/new"
                className="btn btn-primary mt-8 inline-flex"
            >
                Create project
            </a>
        </div>
    );
}
