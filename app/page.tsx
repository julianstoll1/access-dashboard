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
                        className="btn btn-secondary"
                    >
                        Sign in
                    </Link>
                    <Link
                        href="/dashboard"
                        className="btn btn-primary"
                    >
                        Go to Dashboard
                    </Link>
                </div>
            </div>
        </main>
    );
}
