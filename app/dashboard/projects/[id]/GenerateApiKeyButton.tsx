"use client";

import { useTransition } from "react";
import { generateApiKey } from "./actions";
import { extractErrorMessage, useToast } from "@/components/feedback/ToastProvider";

export function GenerateApiKeyButton({ projectId }: { projectId: string }) {
    const [pending, startTransition] = useTransition();
    const toast = useToast();

    return (
        <button
            onClick={() => {
                startTransition(async () => {
                    try {
                        const formData = new FormData();
                        formData.append("projectId", projectId);
                        await generateApiKey(formData);
                        toast.success("API key generated.");
                    } catch (error) {
                        toast.error(extractErrorMessage(error, "Failed to generate API key."));
                    }
                });
            }}
            disabled={pending}
            className="btn btn-primary"
        >
            {pending ? "Generating…" : "Generate API key"}
        </button>
    );
}
