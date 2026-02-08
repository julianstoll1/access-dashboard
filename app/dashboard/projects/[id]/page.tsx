import { notFound } from "next/navigation";
import { getProject } from "@/lib/projects";
import { getApiKeyForProject } from "@/lib/apiKeys";

import { GenerateApiKeyButton } from "./GenerateApiKeyButton";
import { CopyApiKeyButton } from "./CopyApiKeyButton";
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

    const maskedKey =
        apiKey &&
        `${apiKey.key.slice(0, 10)}••••${apiKey.key.slice(-4)}`;

    return (
        <div className="min-h-screen bg-[#0b0b0c] text-white">
            <main className="mx-auto max-w-3xl px-8 py-16">
                {/* Back */}
                <BackButton />

                {/* Header */}
                <div className="mt-6">
                    <h1 className="text-2xl font-semibold tracking-tight">
                        {project.name}
                    </h1>
                    <p className="mt-1 text-sm text-white/40">
                        Project ID · {project.id}
                    </p>
                </div>

                {/* API Key */}
                <div className="mt-10 rounded-xl border border-white/10 bg-[#0f0f11] p-6">
                    <h2 className="text-sm font-medium">API Key</h2>

                    {!apiKey ? (
                        <>
                            <p className="mt-2 text-sm text-white/50">
                                No API key has been generated yet.
                            </p>

                            <div className="mt-4">
                                <GenerateApiKeyButton projectId={project.id} />
                            </div>
                        </>
                    ) : (
                        <>
                            <p className="mt-2 text-sm text-white/50">
                                API key for this project
                            </p>

                            <div className="mt-4 flex items-center justify-between rounded-md bg-black/40 px-4 py-3 text-sm">
                                <code>{maskedKey}</code>
                                <CopyApiKeyButton value={apiKey.key} />
                            </div>
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}