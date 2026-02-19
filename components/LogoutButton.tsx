"use client";

import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export function LogoutButton() {
    const router = useRouter();

    async function handleLogout() {
        await supabase.auth.signOut();
        router.push("/login");
    }

    return (
        <button
            onClick={handleLogout}
            className="btn btn-secondary"
        >
            Logout
        </button>
    );
}
