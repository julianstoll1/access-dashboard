"use server";

import { revalidatePath } from "next/cache";
import {
    createPermission,
    deletePermission,
    togglePermission,
    updatePermission
} from "@/lib/permissions";

export async function createPermissionAction(
    projectId: string,
    name: string,
    description?: string,
    riskLevel: "low" | "medium" | "high" = "low",
    slug: string = ""
) {
    const result = await createPermission(projectId, {
        name,
        slug,
        description: description ?? null,
        risk_level: riskLevel,
    });
    if (!result.ok) throw new Error("Failed to create permission");
    revalidatePath(`/dashboard/projects/${projectId}`);
}

export async function deletePermissionAction(projectId: string, id: string) {
    const result = await deletePermission(id, projectId);
    if (!result.ok) throw new Error("Failed to delete permission");
    revalidatePath(`/dashboard/projects/${projectId}`);
}

export async function togglePermissionAction(
    projectId: string,
    id: string,
    enabled: boolean
) {
    const result = await togglePermission(id, enabled, projectId);
    if (!result.ok) throw new Error("Failed to toggle permission");
    revalidatePath(`/dashboard/projects/${projectId}`);
}

export async function updatePermissionAction(
    projectId: string,
    id: string,
    name: string,
    description?: string,
    riskLevel: "low" | "medium" | "high" = "low",
    enabled: boolean = true,
    slug: string = ""
) {
    const result = await updatePermission(id, {
        name,
        slug,
        description: description ?? null,
        risk_level: riskLevel,
        enabled,
    });
    if (!result.ok) throw new Error("Failed to update permission");
    revalidatePath(`/dashboard/projects/${projectId}`);
}
