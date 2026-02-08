"use client";

import { useRouter } from "next/navigation";

export function BackButton() {
    const router = useRouter();

    return (
        <button
            onClick={() => router.back()}
            className="inline-flex items-center text-sm text-white/50 hover:text-white"
        >
            ← Back to projects
        </button>
    );
}