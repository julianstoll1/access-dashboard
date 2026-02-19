"use client";

import { useTransition } from "react";
import { generateApiKey } from "./actions";

export function GenerateApiKeyButton({ projectId }: { projectId: string }) {
    const [pending, startTransition] = useTransition();

    return (
        <button
            onClick={() => {
                startTransition(async () => {
                    const formData = new FormData();
                    formData.append("projectId", projectId);
                    await generateApiKey(formData);
                });
            }}
            disabled={pending}
            className="btn btn-primary"
        >
            {pending ? "Generating…" : "Generate API key"}
        </button>
    );
}
