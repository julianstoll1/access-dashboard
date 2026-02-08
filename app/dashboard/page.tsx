import { getCurrentUser } from "@/lib/auth";
import { LogoutButton } from "@/components/LogoutButton";

export default async function DashboardPage() {
    const user = await getCurrentUser();

    return (
        <main className="p-8">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Dashboard</h1>
                <LogoutButton />
            </div>

            <pre className="mt-4 rounded bg-gray-100 p-4 text-sm">
        {JSON.stringify(user, null, 2)}
      </pre>
        </main>
    );
}