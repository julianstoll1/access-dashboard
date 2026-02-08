"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    async function handleSignup(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setLoading(true);

        const { error } = await supabase.auth.signUp({
            email,
            password,
        });

        setLoading(false);

        if (error) {
            setError(error.message);
            return;
        }

        router.push("/dashboard");
    }

    return (
        <>
            <h2 className="text-xl font-semibold tracking-tight">
                Create account
            </h2>
            <p className="mt-1 text-sm text-white/50">
                Start using Access in minutes
            </p>

            <form onSubmit={handleSignup} className="mt-6 space-y-4">
                <input
                    className="w-full rounded-md bg-black/40 border border-white/10 px-3 py-2 text-sm placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />

                <input
                    className="w-full rounded-md bg-black/40 border border-white/10 px-3 py-2 text-sm placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />

                {error && (
                    <p className="text-sm text-red-400">
                        {error}
                    </p>
                )}

                <button
                    disabled={loading}
                    className="w-full rounded-md bg-white text-black py-2 text-sm font-medium hover:bg-white/90 disabled:opacity-50"
                >
                    {loading ? "Creating account…" : "Create account"}
                </button>
            </form>

            <p className="mt-6 text-sm text-white/50">
                Already have an account?{" "}
                <Link
                    href="/login"
                    className="text-white hover:underline"
                >
                    Sign in
                </Link>
            </p>
        </>
    );
}