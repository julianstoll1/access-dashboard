import Link from "next/link";

export default function ProjectNotFoundPage() {
    return (
        <div className="min-h-screen bg-[#0e1117] text-white">
            <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-8 py-20">
                <div className="w-full rounded-3xl border border-white/10 bg-[#151922] p-10 shadow-[0_20px_45px_-30px_rgba(0,0,0,0.9)]">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-white/40">Project</p>
                    <h1 className="mt-3 text-3xl font-semibold tracking-tight">Project not found</h1>
                    <p className="mt-3 text-sm text-white/55">
                        This project does not exist anymore or your link is outdated.
                    </p>
                    <div className="mt-8">
                        <Link href="/dashboard" className="btn btn-primary">
                            Back to project overview
                        </Link>
                    </div>
                </div>
            </main>
        </div>
    );
}
