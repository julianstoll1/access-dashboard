import { getProject } from "@/lib/projects";
import { getApiKeyForProject } from "@/lib/apiKeys";
import { notFound } from "next/navigation";

export default async function ProjectPage({
                                              params,
                                          }: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params; // 🔑 WICHTIG

    const project = await getProject(id);
    if (!project) return notFound();

    const apiKey = await getApiKeyForProject(project.id);

    return (
        <div className="min-h-screen bg-[#0b0b0c] text-white">
            <main className="mx-auto max-w-3xl px-8 py-16">
                <h1 className="text-2xl font-semibold tracking-tight">
                    {project.name}
                </h1>

                <p className="mt-1 text-sm text-white/40">
                    Project ID · {project.id}
                </p>

                <div className="mt-10 rounded-xl border border-white/10 bg-[#0f0f11] p-6">
                    <h2 className="text-sm font-medium">API Key</h2>

                    {!apiKey ? (
                        <p className="mt-2 text-sm text-white/50">
                            No API key has been generated yet.
                        </p>
                    ) : (
                        <p className="mt-2 text-sm text-white/50">
                            An API key exists for this project.
                        </p>
                    )}
                </div>
            </main>
        </div>
    );
}