"use client";

import { useState, useTransition } from "react";
import { rotateApiKey } from "./actions";
import { CopyApiKeyButton } from "./CopyApiKeyButton";

interface Props {
    projectId: string;
    apiKey: string;
    createdAt: string;
    lastRotatedAt: string;
}

function formatDate(date: string) {
    return new Date(date).toLocaleString("de-DE", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}

export function ApiKeyDisplay({
                                  projectId,
                                  apiKey,
                                  createdAt,
                                  lastRotatedAt,
                              }: Props) {
    const [visible, setVisible] = useState(false);
    const [pending, startTransition] = useTransition();

    const masked =
        apiKey.slice(0, 10) + "••••" + apiKey.slice(-4);

    // ✅ Deterministic formatting (no hydration mismatch)
    const createdFormatted = formatDate(createdAt);
    const rotatedFormatted = formatDate(lastRotatedAt);

    return (
        <>
            <p className="mt-4 text-sm text-white/50">
                Active API key
            </p>

            {/* Key Display */}
            <div className="mt-3 flex items-center justify-between rounded-md bg-black/40 px-4 py-3 text-sm">
                <code className="truncate">
                    {visible ? apiKey : masked}
                </code>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setVisible(!visible)}
                        className="text-xs text-white/60 hover:text-white transition"
                    >
                        {visible ? "Hide" : "Show"}
                    </button>

                    <CopyApiKeyButton value={apiKey} />
                </div>
            </div>

            {/* Metadata */}
            <div className="mt-3 text-xs text-white/40 space-y-1">
                <p>Created: {createdFormatted}</p>
                <p>Last rotated: {rotatedFormatted}</p>
            </div>

            {/* Rotate Section */}
            <div className="mt-6 rounded-md border border-red-500/20 bg-red-500/5 p-4">
                <p className="text-xs text-red-400">
                    Rotating will immediately invalidate the current API key.
                    Make sure to update it in your application.
                </p>

                <button
                    onClick={() => {
                        const confirmed = confirm(
                            "Are you sure you want to rotate this API key? This will immediately invalidate the current key."
                        );

                        if (!confirmed) return;

                        startTransition(async () => {
                            const formData = new FormData();
                            formData.append("projectId", projectId);
                            await rotateApiKey(formData);
                        });
                    }}
                    disabled={pending}
                    className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition"
                >
                    {pending ? "Rotating…" : "Rotate API key"}
                </button>
            </div>
        </>
    );
}