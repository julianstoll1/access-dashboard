"use server";

import { revalidatePath } from "next/cache";
import {
    createPermission,
    deletePermission,
    togglePermission
} from "@/lib/permissions";

export async function createPermissionAction(projectId: string, name: string) {
    await createPermission(projectId, name);
    revalidatePath(`/dashboard/projects/${projectId}`);
}

export async function deletePermissionAction(projectId: string, id: string) {
    await deletePermission(id);
    revalidatePath(`/dashboard/projects/${projectId}`);
}

export async function togglePermissionAction(
    projectId: string,
    id: string,
    enabled: boolean
) {
    await togglePermission(id, enabled);
    revalidatePath(`/dashboard/projects/${projectId}`);
}