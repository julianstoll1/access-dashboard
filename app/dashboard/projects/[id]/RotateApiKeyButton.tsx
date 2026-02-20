"use client";

import { useTransition } from "react";
import { rotateApiKey } from "./actions";
import { extractErrorMessage, useToast } from "@/components/feedback/ToastProvider";

export function RotateApiKeyButton({ projectId }: { projectId: string }) {
    const [pending, startTransition] = useTransition();
    const toast = useToast();

    return (
        <button
            onClick={() => {
                startTransition(async () => {
                    try {
                        const formData = new FormData();
                        formData.append("projectId", projectId);
                        await rotateApiKey(formData);
                        toast.success("New API key generated.");
                    } catch (error) {
                        toast.error(extractErrorMessage(error, "Failed to generate new API key."));
                    }
                });
            }}
            disabled={pending}
            className="btn btn-danger-secondary"
        >
            {pending ? "Generating…" : "Generate new API key"}
        </button>
    );
}
