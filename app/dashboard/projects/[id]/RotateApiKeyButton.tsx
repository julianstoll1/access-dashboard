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
            className="btn btn-danger-secondary"
        >
            {pending ? "Rotating…" : "Rotate API key"}
        </button>
    );
}
