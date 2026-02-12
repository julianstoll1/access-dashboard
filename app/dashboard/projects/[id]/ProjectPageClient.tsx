"use client";

import { useState } from "react";
import { ApiKeyDisplay } from "./ApiKeyDisplay";
import { GenerateApiKeyButton } from "./GenerateApiKeyButton";
import { BackButton } from "./BackButton";

interface Props {
    project: any;
    apiKey: any;
    permissions: any[];
}

export default function ProjectPageClient({
                                              project,
                                              apiKey,
                                              permissions,
                                          }: Props) {
    const [activeTab, setActiveTab] = useState("overview");

    const usageMonth = 24193;
    const usageLimit = 100000;
    const usagePercent = Math.round((usageMonth / usageLimit) * 100);

    return (
        <div className="min-h-screen bg-[#0e1117] text-white">
            <main className="mx-auto max-w-[1400px] px-12 py-20">

                <BackButton />

                {/* HEADER */}
                <div className="mt-12 border-b border-white/5 pb-10">
                    <h1 className="text-4xl font-semibold tracking-tight">
                        {project.name}
                    </h1>
                    <p className="mt-3 text-sm text-white/40">
                        Project ID · {project.id}
                    </p>
                </div>

                <div className="mt-16 grid grid-cols-[240px_1fr] gap-20">

                    {/* SIDEBAR */}
                    <aside className="space-y-3">
                        <SidebarItem id="overview" activeTab={activeTab} setActiveTab={setActiveTab} label="Overview" />
                        <SidebarItem id="api" activeTab={activeTab} setActiveTab={setActiveTab} label="API Keys" />
                        <SidebarItem id="roles" activeTab={activeTab} setActiveTab={setActiveTab} label="Roles" />
                        <SidebarItem id="features" activeTab={activeTab} setActiveTab={setActiveTab} label="Features" />
                        <SidebarItem id="integration" activeTab={activeTab} setActiveTab={setActiveTab} label="Integration" />
                    </aside>

                    {/* CONTENT */}
                    <div className="space-y-28">

                        {activeTab === "overview" && (
                            <div className="grid grid-cols-3 gap-12">
                                <MetricCard
                                    label="API Calls (30d)"
                                    value={usageMonth.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                                />
                                <MetricCard label="Usage" value={`${usagePercent}%`} />
                                <MetricCard label="Active Roles" value="3" />
                            </div>
                        )}

                        {activeTab === "api" && (
                            <Section title="API Credentials">
                                {!apiKey ? (
                                    <>
                                        <p className="text-white/50">
                                            No API key generated yet.
                                        </p>
                                        <div className="mt-8">
                                            <GenerateApiKeyButton projectId={project.id} />
                                        </div>
                                    </>
                                ) : (
                                    <ApiKeyDisplay
                                        projectId={project.id}
                                        apiKey={apiKey.key}
                                        createdAt={apiKey.created_at}
                                        lastRotatedAt={apiKey.last_rotated_at}
                                    />
                                )}
                            </Section>
                        )}

                        {activeTab === "roles" && (
                            <Section title="Roles">
                                <RoleRow name="Premium" permissions={4} users={128} />
                                <RoleRow name="Elite" permissions={7} users={42} />
                            </Section>
                        )}

                        {activeTab === "features" && (
                            <Section title="Permissions">

                                <PermissionsManager
                                    permissions={permissions}
                                    projectId={project.id}
                                />

                            </Section>
                        )}

                        {activeTab === "integration" && (
                            <Section title="Integration">
                <pre className="text-xs text-white/70 overflow-x-auto bg-[#151922] p-6 rounded-xl">
                  <code>{`await fetch("https://api.yourapp.com/access/check", {
  method: "POST",
  headers: {
    "Authorization": "Bearer sk_live_...",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    user_id: "user_123",
    resource: "feature_export"
  })
})`}</code>
                </pre>
                            </Section>
                        )}

                    </div>
                </div>
            </main>
        </div>
    );
}


/* ================= COMPONENTS ================= */

import {
    createPermissionAction,
    deletePermissionAction,
    togglePermissionAction
} from "./permission-actions";

function PermissionsManager({ permissions, projectId }: any) {

    const [query, setQuery] = useState("");

    const filtered = permissions.filter((p: any) =>
        p.name.toLowerCase().includes(query.toLowerCase())
    );

    return (
        <>
            {/* TOPBAR */}
            <div className="flex items-center justify-between">

                <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search permission..."
                    className="w-80 rounded-lg border border-white/10 bg-[#0c0f14] px-4 py-2 text-sm"
                />

                <form
                    action={async (formData) => {
                        const name = formData.get("name") as string;
                        if (!name) return;
                        await createPermissionAction(projectId, name);
                    }}
                >
                    <input name="name" hidden />
                    <button
                        type="submit"
                        onClick={(e)=>{
                            e.preventDefault()
                            const name = prompt("Permission name")
                            if(!name) return
                            const input = (e.currentTarget.form!.elements.namedItem("name") as HTMLInputElement)
                            input.value = name
                            e.currentTarget.form!.requestSubmit()
                        }}
                        className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black"
                    >
                        + Create
                    </button>
                </form>

            </div>


            {/* TABLE */}
            <div className="mt-10 overflow-hidden rounded-xl border border-white/10">

                <div className="grid grid-cols-[1.8fr_1fr_160px] bg-white/[0.02] px-6 py-3 text-xs uppercase text-white/40">
                    <span>Name</span>
                    <span>Status</span>
                    <span className="text-right">Actions</span>
                </div>

                {filtered.map((p:any)=>(
                    <PermissionRow
                        key={p.id}
                        item={p}
                        projectId={projectId}
                    />
                ))}

                {filtered.length===0 && (
                    <div className="p-10 text-center text-sm text-white/40">
                        No permissions found
                    </div>
                )}

            </div>
        </>
    );
}

function PermissionRow({ item, onToggle }: any) {

    const riskColor =
        item.risk==="low"
            ? "text-emerald-400"
            : item.risk==="medium"
                ? "text-amber-400"
                : "text-red-400"

    return (
        <div className="group grid grid-cols-[1.8fr_1fr_1fr_1fr_160px] items-center border-t border-white/5 px-6 py-4 text-sm hover:bg-white/[0.02] transition">

            <div>
                <p className="font-mono text-white/90">{item.name}</p>
                <p className="text-xs text-white/30">Permission flag</p>
            </div>

            <span className="text-white/70">{item.users}</span>
            <span className="text-white/50">{item.lastUsed}</span>
            <span className={`text-xs font-medium ${riskColor}`}>{item.risk}</span>

            <div className="flex items-center justify-end gap-3 opacity-0 transition group-hover:opacity-100">

                {/* Toggle */}
                <button
                    onClick={onToggle}
                    className={`h-6 w-11 rounded-full transition ${
                        item.enabled ? "bg-emerald-500" : "bg-white/20"
                    }`}
                >
                    <div
                        className={`h-5 w-5 rounded-full bg-white transition ${
                            item.enabled ? "translate-x-5" : "translate-x-0"
                        }`}
                    />
                </button>

                {/* Edit */}
                <button
                    onClick={()=>alert("Edit modal would open")}
                    className="text-xs text-white/60 hover:text-white"
                >
                    Edit
                </button>

                {/* Delete */}
                <button
                    onClick={()=>alert("Delete confirm modal")}
                    className="text-xs text-red-400 hover:text-red-300"
                >
                    Delete
                </button>

            </div>
        </div>
    )
}

function SidebarItem({
                         label,
                         id,
                         activeTab,
                         setActiveTab,
                     }: any) {
    const active = activeTab === id;

    return (
        <div
            onClick={() => setActiveTab(id)}
            className={`px-4 py-3 rounded-lg text-sm cursor-pointer transition ${
                active
                    ? "bg-white/5 text-white"
                    : "text-white/50 hover:bg-white/5 hover:text-white"
            }`}
        >
            {label}
        </div>
    );
}

function Section({ title, children }: any) {
    return (
        <section>
            <h2 className="text-2xl font-semibold tracking-tight">
                {title}
            </h2>
            <div className="mt-10 rounded-2xl border border-white/5 bg-[#151922] p-12">
                {children}
            </div>
        </section>
    );
}

function MetricCard({ label, value }: any) {
    return (
        <div className="rounded-2xl border border-white/5 bg-[#151922] p-10">
            <p className="text-xs uppercase tracking-wider text-white/40">
                {label}
            </p>
            <p className="mt-6 text-2xl font-semibold">
                {value}
            </p>
        </div>
    );
}

function RoleRow({ name, permissions, users }: any) {
    return (
        <div className="flex items-center justify-between rounded-xl border border-white/5 bg-[#151922] px-8 py-6">
            <div>
                <p className="font-medium">{name}</p>
                <p className="mt-2 text-xs text-white/40">
                    {permissions} permissions · {users} users
                </p>
            </div>
            <button className="text-sm text-white/50 hover:text-white">
                Manage
            </button>
        </div>
    );
}

function FeatureRow({ name }: any) {
    return (
        <div className="flex items-center justify-between rounded-xl border border-white/5 bg-[#151922] px-8 py-5">
            <p className="font-mono text-sm text-white/80">
                {name}
            </p>
            <button className="text-sm text-white/50 hover:text-white">
                Manage
            </button>
        </div>
    );
}