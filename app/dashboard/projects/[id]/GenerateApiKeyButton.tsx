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
            className="rounded-md bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90 disabled:opacity-50"
        >
            {pending ? "Generating…" : "Generate API key"}
        </button>
    );
}
