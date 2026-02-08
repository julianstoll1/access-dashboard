import { LogoutButton } from "@/components/LogoutButton";

export default async function DashboardPage() {
    return (
        <div className="min-h-screen bg-[#0b0b0c] text-white">
            {/* Header */}
            <header className="flex items-center justify-between border-b border-white/10 px-8 py-5">
                <h1 className="text-lg font-semibold tracking-tight">
                    Dashboard
                </h1>
                <LogoutButton />
            </header>

            {/* Content */}
            <main className="mx-auto max-w-4xl px-8 py-16">
                <div className="rounded-2xl border border-white/10 bg-[#0f0f11] p-10 text-center">
                    <h2 className="text-xl font-semibold">
                        No projects yet
                    </h2>
                    <p className="mt-2 text-sm text-white/50">
                        Create your first project to start using Access.
                    </p>

                    <button
                        className="mt-6 rounded-md bg-white px-5 py-2 text-sm font-medium text-black hover:bg-white/90"
                    >
                        Create project
                    </button>
                </div>
            </main>
        </div>
    );
}