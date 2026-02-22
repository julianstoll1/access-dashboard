"use client";

import { useMemo, useState } from "react";
import {
    deleteProjectApiKeyAction,
    generateProjectApiKeyAction,
    revealProjectApiKeyAction,
    rotateProjectApiKeyAction,
} from "./actions";
import { extractErrorMessage, useToast } from "@/components/feedback/ToastProvider";

type ApiKeyItem = {
    id: string;
    project_id: string;
    name: string;
    status: "active" | "revoked";
    usage_count: number;
    last_used_at: string | null;
    created_at: string;
    updated_at: string | null;
    description: string | null;
};

type BusyState =
    | { type: "generate"; id: null }
    | { type: "reveal"; id: string }
    | { type: "rotate"; id: string }
    | { type: "delete"; id: string }
    | null;

function formatDateTime(value: string | null) {
    if (!value) return "Never";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Never";
    return date.toLocaleString(undefined, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function formatUsage(value: number) {
    return (value ?? 0).toLocaleString("en-US");
}

function normalizeComparableName(name: string) {
    return name.trim().toLocaleLowerCase();
}

function getSuggestedKeyName(keys: ApiKeyItem[], baseName = "Primary key") {
    const taken = new Set(keys.map((key) => normalizeComparableName(key.name)));
    if (!taken.has(normalizeComparableName(baseName))) return baseName;

    let counter = 2;
    while (taken.has(normalizeComparableName(`${baseName} ${counter}`))) {
        counter += 1;
    }
    return `${baseName} ${counter}`;
}

export function ApiKeysManager({
    projectId,
    initialKeys,
}: {
    projectId: string;
    initialKeys: ApiKeyItem[];
}) {
    const toast = useToast();
    const [keys, setKeys] = useState<ApiKeyItem[]>(initialKeys ?? []);
    const [busy, setBusy] = useState<BusyState>(null);

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createName, setCreateName] = useState("Primary key");
    const [createDescription, setCreateDescription] = useState("");

    const [deleteTarget, setDeleteTarget] = useState<ApiKeyItem | null>(null);

    const [showNewKeyModal, setShowNewKeyModal] = useState(false);
    const [newKeyValue, setNewKeyValue] = useState("");
    const [newKeyName, setNewKeyName] = useState("");
    const [showRevealModal, setShowRevealModal] = useState(false);
    const [revealedKeyValue, setRevealedKeyValue] = useState("");
    const [revealedKeyName, setRevealedKeyName] = useState("");

    const activeKeys = useMemo(() => keys.filter((key) => key.status === "active"), [keys]);
    const activeCount = activeKeys.length;
    const hasKeys = activeKeys.length > 0;
    const createNameTaken = useMemo(() => {
        const comparable = normalizeComparableName(createName);
        if (!comparable) return false;
        return keys.some((key) => normalizeComparableName(key.name) === comparable);
    }, [createName, keys]);

    const openCreateModal = () => {
        setCreateName(getSuggestedKeyName(keys));
        setCreateDescription("");
        setShowCreateModal(true);
    };

    const closeCreateModal = () => {
        setShowCreateModal(false);
        setCreateName(getSuggestedKeyName(keys));
        setCreateDescription("");
    };

    const showOneTimeKey = (name: string, keyValue: string) => {
        setNewKeyName(name);
        setNewKeyValue(keyValue);
        setShowNewKeyModal(true);
    };

    const handleReveal = async (key: ApiKeyItem) => {
        setBusy({ type: "reveal", id: key.id });
        try {
            const result = await revealProjectApiKeyAction(projectId, key.id);
            if (!result.ok) {
                toast.error(result.error || "Failed to reveal API key.");
                return;
            }
            setRevealedKeyName(result.data.name);
            setRevealedKeyValue(result.data.key);
            setShowRevealModal(true);
        } catch (error) {
            toast.error(extractErrorMessage(error, "Failed to reveal API key."));
        } finally {
            setBusy(null);
        }
    };

    const handleCreate = async () => {
        if (!createName.trim()) {
            toast.error("API key name is required.");
            return;
        }
        if (createNameTaken) {
            toast.error("An API key with this name already exists in this project.");
            return;
        }
        setBusy({ type: "generate", id: null });
        try {
            const result = await generateProjectApiKeyAction(projectId, {
                name: createName,
                description: createDescription,
            });
            if (!result.ok) {
                toast.error(result.error || "Failed to generate API key.");
                return;
            }
            const updatedKeys = [result.data.record, ...keys];
            setKeys(updatedKeys);
            setShowCreateModal(false);
            setCreateName(getSuggestedKeyName(updatedKeys));
            setCreateDescription("");
            showOneTimeKey(result.data.record.name, result.data.key);
            toast.success("New API key generated.");
        } catch (error) {
            toast.error(extractErrorMessage(error, "Failed to generate API key."));
        } finally {
            setBusy(null);
        }
    };

    const handleRotate = async (key: ApiKeyItem) => {
        setBusy({ type: "rotate", id: key.id });
        try {
            const result = await rotateProjectApiKeyAction(projectId, key.id, {
                name: key.name,
                description: key.description ?? undefined,
            });
            if (!result.ok) {
                toast.error(result.error || "Failed to generate new API key.");
                return;
            }
            setKeys((prev) =>
                [
                    result.data.record,
                    ...prev.filter((item) => item.id !== key.id),
                ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            );
            showOneTimeKey(result.data.record.name, result.data.key);
            toast.success("API key regenerated.");
        } catch (error) {
            toast.error(extractErrorMessage(error, "Failed to generate new API key."));
        } finally {
            setBusy(null);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setBusy({ type: "delete", id: deleteTarget.id });
        try {
            const result = await deleteProjectApiKeyAction(projectId, deleteTarget.id);
            if (!result.ok) {
                toast.error(result.error || "Failed to delete API key.");
                return;
            }
            setKeys((prev) => prev.filter((key) => key.id !== deleteTarget.id));
            setDeleteTarget(null);
            toast.success("API key deleted.");
        } catch (error) {
            toast.error(extractErrorMessage(error, "Failed to delete API key."));
        } finally {
            setBusy(null);
        }
    };

    return (
        <>
            <div className="rounded-2xl border border-white/10 bg-[#0f141d] p-4 shadow-[0_20px_45px_-30px_rgba(0,0,0,0.9)] sm:p-5">
                <div className="flex flex-col gap-4 border-b border-white/10 pb-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h3 className="text-base font-semibold text-white">API Keys</h3>
                        <p className="mt-1 text-sm text-white/65">
                            Create and manage project keys for API access.
                        </p>
                        <div className="mt-3 inline-flex items-center rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/70">
                            {activeCount} {activeCount === 1 ? "key" : "keys"} available
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={openCreateModal}
                        disabled={busy !== null}
                        className="btn btn-primary w-full sm:w-auto"
                    >
                        {busy?.type === "generate" ? "Generating..." : "Generate New API Key"}
                    </button>
                </div>

                {hasKeys ? (
                    <>
                        <div className="mt-4 hidden lg:block">
                            <div className="grid grid-cols-[minmax(0,1.9fr)_96px_170px_170px_132px] items-center border-b border-white/10 px-4 py-2 text-[11px] uppercase tracking-[0.13em] text-white/45">
                                <span>Name</span>
                                <span>Usage</span>
                                <span>Last used</span>
                                <span>Created</span>
                                <span className="text-right">Actions</span>
                            </div>
                            <div className="divide-y divide-white/10">
                                {activeKeys.map((key) => {
                                    const isBusyForRow = busy?.id === key.id;
                                    return (
                                        <div
                                            key={key.id}
                                            className="grid grid-cols-[minmax(0,1.9fr)_96px_170px_170px_132px] items-center px-4 py-3 text-sm transition hover:bg-white/[0.02]"
                                        >
                                            <div className="min-w-0 pr-3">
                                                <p className="truncate font-semibold text-white">{key.name}</p>
                                                <p className="mt-0.5 truncate text-xs text-white/45">
                                                    {key.description || "No description"}
                                                </p>
                                            </div>
                                            <span className="text-white/80">{formatUsage(key.usage_count)}</span>
                                            <span className="whitespace-nowrap text-white/65">{formatDateTime(key.last_used_at)}</span>
                                            <span className="whitespace-nowrap text-white/65">{formatDateTime(key.created_at)}</span>
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleReveal(key)}
                                                    disabled={busy !== null}
                                                    className="btn-icon btn-icon-secondary"
                                                    title="Show and copy key value"
                                                    aria-label="Reveal API key"
                                                >
                                                    {busy?.type === "reveal" && isBusyForRow ? (
                                                        <svg viewBox="0 0 20 20" className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" strokeWidth="1.7">
                                                            <path d="M10 3a7 7 0 1 1-7 7" />
                                                        </svg>
                                                    ) : (
                                                        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                                                            <path d="M2 10s2.8-4.6 8-4.6S18 10 18 10s-2.8 4.6-8 4.6S2 10 2 10Z" />
                                                            <circle cx="10" cy="10" r="2.3" />
                                                        </svg>
                                                    )}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRotate(key)}
                                                    disabled={busy !== null}
                                                    className="btn-icon btn-icon-secondary"
                                                    title="Regenerate API key (keep name and description)"
                                                    aria-label="Regenerate API key"
                                                >
                                                    {busy?.type === "rotate" && isBusyForRow ? (
                                                        <svg viewBox="0 0 20 20" className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" strokeWidth="1.7">
                                                            <path d="M10 3a7 7 0 1 1-7 7" />
                                                        </svg>
                                                    ) : (
                                                        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                                                            <path d="M3.5 9.8a6.5 6.5 0 0 1 11.1-4.5" />
                                                            <path d="M14.6 2.8v2.9h-2.9" />
                                                            <path d="M16.5 10.2a6.5 6.5 0 0 1-11.1 4.5" />
                                                            <path d="M5.4 17.2v-2.9h2.9" />
                                                        </svg>
                                                    )}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setDeleteTarget(key)}
                                                    disabled={busy !== null}
                                                    className="btn-icon btn-icon-danger"
                                                    title="Delete API key"
                                                    aria-label="Delete API key"
                                                >
                                                    {busy?.type === "delete" && isBusyForRow ? (
                                                        <svg viewBox="0 0 20 20" className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" strokeWidth="1.7">
                                                            <path d="M10 3a7 7 0 1 1-7 7" />
                                                        </svg>
                                                    ) : (
                                                        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                                                            <path d="M4 6h12" />
                                                            <path d="M8 6V4h4v2" />
                                                            <path d="M6.7 6.7 7.4 16h5.2l.7-9.3" />
                                                        </svg>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="mt-4 space-y-3 lg:hidden">
                            {activeKeys.map((key) => {
                                const isBusyForRow = busy?.id === key.id;
                                return (
                                    <div key={key.id} className="rounded-xl border border-white/10 bg-[#0a0f16] p-3.5">
                                        <div className="min-w-0">
                                            <p className="truncate font-semibold text-white">{key.name}</p>
                                            <p className="mt-0.5 truncate text-xs text-white/45">{key.description || "No description"}</p>
                                        </div>
                                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-white/70">
                                            <div className="rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-2">
                                                <p className="text-white/45">Usage</p>
                                                <p className="mt-1">{formatUsage(key.usage_count)}</p>
                                            </div>
                                            <div className="rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-2">
                                                <p className="text-white/45">Created</p>
                                                <p className="mt-1">{formatDateTime(key.created_at)}</p>
                                            </div>
                                            <div className="col-span-2 rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-2">
                                                <p className="text-white/45">Last used</p>
                                                <p className="mt-1">{formatDateTime(key.last_used_at)}</p>
                                            </div>
                                        </div>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            <button
                                                type="button"
                                                onClick={() => handleReveal(key)}
                                                disabled={busy !== null}
                                                className="btn btn-secondary px-3 py-2 text-xs"
                                            >
                                                {busy?.type === "reveal" && isBusyForRow ? "Loading..." : "Reveal"}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleRotate(key)}
                                                disabled={busy !== null}
                                                className="btn btn-secondary px-3 py-2 text-xs"
                                            >
                                                {busy?.type === "rotate" && isBusyForRow ? "Generating..." : "Generate New"}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setDeleteTarget(key)}
                                                disabled={busy !== null}
                                                className="btn btn-danger px-3 py-2 text-xs"
                                            >
                                                {busy?.type === "delete" && isBusyForRow ? "Deleting..." : "Delete"}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                ) : (
                    <div className="mt-4 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-12 text-center">
                        <p className="text-sm text-white/75">No API keys yet.</p>
                        <p className="mt-1 text-xs text-white/50">
                            Generate your first key to start using the API.
                        </p>
                    </div>
                )}
            </div>

            {showCreateModal && (
                <ApiKeyCreateModal
                    title="Generate New API Key"
                    name={createName}
                    description={createDescription}
                    onNameChange={setCreateName}
                    onDescriptionChange={setCreateDescription}
                    onCancel={closeCreateModal}
                    onConfirm={handleCreate}
                    isBusy={busy?.type === "generate"}
                    confirmLabel="Generate New API Key"
                    nameError={createNameTaken ? "This name is already used in this project." : undefined}
                />
            )}

            {deleteTarget && (
                <ConfirmModal
                    title="Delete API key?"
                    message={`"${deleteTarget.name}" will be permanently removed.`}
                    confirmText={busy?.type === "delete" && busy.id === deleteTarget.id ? "Deleting..." : "Delete key"}
                    onCancel={() => setDeleteTarget(null)}
                    onConfirm={handleDelete}
                    isBusy={busy?.type === "delete" && busy.id === deleteTarget.id}
                    intent="danger"
                />
            )}

            {showNewKeyModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
                    <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0f141d] p-7 shadow-2xl">
                        <h3 className="text-xl font-semibold text-white">Store your new API key now</h3>
                        <p className="mt-2 text-sm text-white/60">
                            This is shown only once for <span className="text-white">{newKeyName}</span>.
                        </p>
                        <div className="mt-4 rounded-xl border border-white/10 bg-[#0a0f16] px-4 py-3">
                            <code className="break-all text-sm text-white/90">{newKeyValue}</code>
                        </div>
                        <div className="mt-6 flex justify-end gap-3 border-t border-white/10 pt-5">
                            <button
                                type="button"
                                onClick={async () => {
                                    await navigator.clipboard.writeText(newKeyValue);
                                    toast.success("API key copied.");
                                }}
                                className="btn btn-secondary"
                            >
                                Copy key
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowNewKeyModal(false);
                                    setNewKeyValue("");
                                    setNewKeyName("");
                                }}
                                className="btn btn-primary"
                            >
                                I stored it
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showRevealModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
                    <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0f141d] p-7 shadow-2xl">
                        <h3 className="text-xl font-semibold text-white">API key value</h3>
                        <p className="mt-2 text-sm text-white/60">
                            Key: <span className="text-white">{revealedKeyName}</span>
                        </p>
                        <div className="mt-4 rounded-xl border border-white/10 bg-[#0a0f16] px-4 py-3">
                            <code className="break-all text-sm text-white/90">{revealedKeyValue}</code>
                        </div>
                        <div className="mt-6 flex justify-end gap-3 border-t border-white/10 pt-5">
                            <button
                                type="button"
                                onClick={async () => {
                                    await navigator.clipboard.writeText(revealedKeyValue);
                                    toast.success("API key copied.");
                                }}
                                className="btn btn-secondary"
                            >
                                Copy key
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowRevealModal(false);
                                    setRevealedKeyName("");
                                    setRevealedKeyValue("");
                                }}
                                className="btn btn-primary"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

function ApiKeyCreateModal({
    title,
    subtitle,
    name,
    description,
    onNameChange,
    onDescriptionChange,
    onCancel,
    onConfirm,
    isBusy,
    confirmLabel,
    nameError,
}: {
    title: string;
    subtitle?: string;
    name: string;
    description: string;
    onNameChange: (value: string) => void;
    onDescriptionChange: (value: string) => void;
    onCancel: () => void;
    onConfirm: () => void;
    isBusy: boolean;
    confirmLabel: string;
    nameError?: string;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f141d] p-7 shadow-2xl">
                <h3 className="text-xl font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm text-white/60">
                    {subtitle ?? "Create a new key with a clear name for your integration."}
                </p>
                <div className="mt-5 space-y-4">
                    <label className="flex flex-col gap-2">
                        <span className="text-[11px] uppercase tracking-[0.13em] text-white/45">Key name</span>
                        <input
                            value={name}
                            onChange={(e) => onNameChange(e.target.value)}
                            disabled={isBusy}
                            className={`h-11 rounded-xl border bg-[#0a0f16] px-4 text-sm text-white focus:outline-none focus:ring-2 ${
                                nameError
                                    ? "border-rose-400/45 focus:border-rose-300/55 focus:ring-rose-400/20"
                                    : "border-white/10 focus:border-white/20 focus:ring-white/10"
                            }`}
                        />
                        {nameError && <span className="text-xs text-rose-300/85">{nameError}</span>}
                    </label>
                    <label className="flex flex-col gap-2">
                        <span className="text-[11px] uppercase tracking-[0.13em] text-white/45">Description</span>
                        <textarea
                            rows={3}
                            value={description}
                            onChange={(e) => onDescriptionChange(e.target.value)}
                            disabled={isBusy}
                            className="rounded-xl border border-white/10 bg-[#0a0f16] px-4 py-3 text-sm text-white focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/10"
                        />
                    </label>
                </div>
                <div className="mt-6 flex justify-end gap-3 border-t border-white/10 pt-5">
                    <button type="button" onClick={onCancel} disabled={isBusy} className="btn btn-secondary">
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isBusy || !name.trim() || Boolean(nameError)}
                        className="btn btn-primary"
                    >
                        {isBusy ? "Saving..." : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}

function ConfirmModal({
    title,
    message,
    confirmText,
    onCancel,
    onConfirm,
    isBusy,
    intent,
}: {
    title: string;
    message: string;
    confirmText: string;
    onCancel: () => void;
    onConfirm: () => void;
    isBusy: boolean;
    intent: "danger" | "default";
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f141d] p-7 shadow-2xl">
                <h3 className="text-xl font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm text-white/60">{message}</p>
                <div className="mt-6 flex justify-end gap-3 border-t border-white/10 pt-5">
                    <button type="button" onClick={onCancel} disabled={isBusy} className="btn btn-secondary">
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isBusy}
                        className={intent === "danger" ? "btn btn-danger" : "btn btn-primary"}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
