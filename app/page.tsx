import Link from "next/link";

export default function Home() {
    return (
        <main className="min-h-screen bg-[#0e1117] text-white">
            <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
                <h1 className="text-4xl font-semibold tracking-tight">Access Dashboard</h1>
                <p className="mt-4 max-w-xl text-white/70">
                    Manage projects, API keys, roles, and permissions from one central place.
                </p>
                <div className="mt-8 flex gap-3">
                    <Link
                        href="/login"
                        className="rounded-xl border border-white/20 px-5 py-2.5 text-sm font-medium text-white hover:border-white/35"
                    >
                        Sign in
                    </Link>
                    <Link
                        href="/dashboard"
                        className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-white/90"
                    >
                        Go to Dashboard
                    </Link>
                </div>
            </div>
        </main>
    );
}
