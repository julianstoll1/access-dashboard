"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function NewProjectPage() {
    const router = useRouter();
    const [name, setName] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);

        const { error } = await supabase
            .from("projects")
            .insert({ name });

        if (error) {
            alert(error.message);
            console.error(error);
            return;
        }

        setLoading(false);
        router.push("/dashboard");
        router.refresh();
    }

    return (
        <div className="min-h-screen bg-[#0b0b0c] text-white">
            <main className="mx-auto max-w-md px-8 py-20">
                <h1 className="text-xl font-semibold">Create project</h1>

                <form onSubmit={handleCreate} className="mt-6 space-y-4">
                    <input
                        className="w-full rounded-md bg-black/40 border border-white/10 px-3 py-2 text-sm"
                        placeholder="Project name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                    />

                    <button
                        disabled={loading}
                        className="w-full rounded-md bg-white py-2 text-sm font-medium text-black"
                    >
                        {loading ? "Creating…" : "Create project"}
                    </button>
                </form>
            </main>
        </div>
    );
}
