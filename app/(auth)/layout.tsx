import Link from "next/link";

export default function AuthLayout({
                                       children,
                                   }: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-[#0b0b0c] text-white flex items-center justify-center">
            <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-12 px-6">

                {/* Left content */}
                <div className="hidden lg:flex flex-col justify-center">
                    <h1 className="text-3xl font-semibold tracking-tight">
                        Access
                    </h1>
                    <p className="mt-3 text-base text-white/60 max-w-md">
                        Simple authorization infrastructure for developers.
                    </p>

                    <p className="mt-8 text-sm text-white/40 max-w-md">
                        Build access control once.
                        Use it everywhere.
                        No roles. No dashboards from hell.
                    </p>
                </div>

                {/* Auth card */}
                <div className="flex items-center justify-center">
                    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f0f11] p-8 shadow-xl">
                        {children}
                    </div>
                </div>

            </div>
        </div>
    );
}