"use client";

export function CopyApiKeyButton({ value }: { value: string }) {
    return (
        <button
            onClick={() => navigator.clipboard.writeText(value)}
            className="text-xs text-white/70 hover:text-white"
        >
            Copy
        </button>
    );
}
