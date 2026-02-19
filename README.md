# Access Dashboard

A Next.js dashboard for managing API access at the project level.

## What you can do
- Create and manage projects
- Generate and rotate API keys
- Create, edit, enable/disable, and delete permissions
- Create, edit, and delete roles
- Assign permissions to roles
- Use stable slugs for API-side access checks

## Tech stack
- Next.js (App Router)
- React + TypeScript
- Supabase (Auth + Postgres)
- Tailwind CSS

## Core data model
- `projects`
- `api_keys`
- `permissions`
- `roles`
- `role_permissions` (many-to-many)
- `user_roles` (user-role assignment per project)

## Project structure
- `app/dashboard/projects/[id]/ProjectPageClient.tsx` - Main project UI (tabs, tables, modals)
- `app/dashboard/projects/[id]/permissions-actions.ts` - Permission validation + CRUD actions
- `app/dashboard/projects/[id]/roles-actions.ts` - Role validation + CRUD actions
- `app/dashboard/projects/[id]/actions.ts` - API key generation/rotation actions
- `lib/permissions.ts` - DB layer for permissions
- `lib/roles.ts` - DB layer for roles
- `lib/projects.ts` - Project loading

## Local setup
1. Install dependencies:
```bash
npm install
```
2. Configure environment variables in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `API_KEY_ENCRYPTION_SECRET`

3. Start development server:
```bash
npm run dev
```

4. Open:
- `http://localhost:3000/login`

## Build and checks
```bash
npm run lint
npm run build
```

## Notes
- API keys are hashed and encrypted before storage.
- System roles/permissions (`is_system = true`) are protected from destructive actions.
- Validation (name/slug uniqueness, format, and constraints) is enforced on server actions.
