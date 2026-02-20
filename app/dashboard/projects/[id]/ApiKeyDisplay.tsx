"use client";

import { useState, useTransition } from "react";
import { rotateApiKey } from "./actions";
import { CopyApiKeyButton } from "./CopyApiKeyButton";
import { extractErrorMessage, useToast } from "@/components/feedback/ToastProvider";

interface Props {
    projectId: string;
    apiKey: string;
    createdAt: string;
    lastRotatedAt: string | null;
}

function formatDate(date: string | null) {
    if (!date) return "Never";
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
    const [showGenerateNewKeyConfirm, setShowGenerateNewKeyConfirm] = useState(false);
    const [pending, startTransition] = useTransition();
    const toast = useToast();

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

            {/* Generate New Key Section */}
            <div className="mt-6 rounded-md border border-red-500/20 bg-red-500/5 p-4">
                <p className="text-xs text-red-400">
                    Generating a new API key will immediately invalidate the current one.
                    Make sure to update your application right away.
                </p>

                <button
                    onClick={() => setShowGenerateNewKeyConfirm(true)}
                    disabled={pending}
                    className="btn btn-danger-secondary mt-4"
                >
                    {pending ? "Generating…" : "Generate new API key"}
                </button>
            </div>

            {showGenerateNewKeyConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f141d] p-7 shadow-2xl">
                        <h3 className="text-xl font-semibold text-white">Generate new API key?</h3>
                        <p className="mt-2 text-sm text-white/60">
                            This will immediately invalidate the current API key.
                            Continue only if your application is ready for the new key.
                        </p>
                        <div className="mt-6 flex justify-end gap-3 border-t border-white/10 pt-5">
                            <button
                                type="button"
                                onClick={() => setShowGenerateNewKeyConfirm(false)}
                                disabled={pending}
                                className="btn btn-secondary"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    startTransition(async () => {
                                        try {
                                            const formData = new FormData();
                                            formData.append("projectId", projectId);
                                            await rotateApiKey(formData);
                                            setShowGenerateNewKeyConfirm(false);
                                            toast.success("New API key generated.");
                                        } catch (error) {
                                            toast.error(extractErrorMessage(error, "Failed to generate new API key."));
                                        }
                                    });
                                }}
                                disabled={pending}
                                className="btn btn-danger"
                            >
                                {pending ? "Generating..." : "Generate new API key"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
