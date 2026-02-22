import { notFound, redirect } from "next/navigation";
import { getProjectById, getProjectBySlug, getProjectOverviewKpis } from "@/lib/projects";
import { getApiKeyForProject } from "@/lib/apiKeys";
import { getPermissions } from "@/lib/permissions";
import { getRoles } from "@/lib/roles";
import { getAuditLogs } from "@/lib/auditLogs";


import ProjectPageClient from "./ProjectPageClient";

export default async function ProjectPage({
                                              params,
                                          }: {
    params: Promise<{ id: string }>;
}) {
    const { id: slugOrId } = await params;

    let project = await getProjectBySlug(slugOrId);
    if (!project) {
        const byId = await getProjectById(slugOrId);
        if (byId) {
            redirect(`/dashboard/projects/${byId.slug}`);
        }
    }
    project = project ?? null;
    if (!project) return notFound();

    const apiKey = await getApiKeyForProject(project.id);

    const permissions = await getPermissions(project.id);
    const roles = await getRoles(project.id);
    const auditLogs = await getAuditLogs(project.id);
    const projectKpis = await getProjectOverviewKpis(project.id);

    return (
        <ProjectPageClient
            project={project}
            apiKey={apiKey}
            permissions={permissions}
            roles={roles}
            auditLogs={auditLogs}
            projectKpis={projectKpis}
        />
    );
}
