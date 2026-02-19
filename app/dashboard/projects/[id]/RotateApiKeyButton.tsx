"use client";

import { useTransition } from "react";
import { rotateApiKey } from "./actions";

export function RotateApiKeyButton({ projectId }: { projectId: string }) {
    const [pending, startTransition] = useTransition();

    return (
        <button
            onClick={() => {
                startTransition(async () => {
                    const formData = new FormData();
                    formData.append("projectId", projectId);
                    await rotateApiKey(formData);
                });
            }}
            disabled={pending}
            className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-50"
        >
            {pending ? "Rotating…" : "Rotate API key"}
        </button>
    );
}
