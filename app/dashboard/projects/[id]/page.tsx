import { notFound } from "next/navigation";
import { getProject } from "@/lib/projects";
import { getApiKeyForProject } from "@/lib/apiKeys";
import { getPermissions } from "@/lib/permissions";
import { getRoles } from "@/lib/roles";


import ProjectPageClient from "./ProjectPageClient";

export default async function ProjectPage({
                                              params,
                                          }: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const project = await getProject(id);
    if (!project) return notFound();

    const apiKey = await getApiKeyForProject(project.id);

    const permissions = await getPermissions(project.id);
    const roles = await getRoles(project.id);

    return (
        <ProjectPageClient
            project={project}
            apiKey={apiKey}
            permissions={permissions}
            roles={roles}
        />
    );
}
