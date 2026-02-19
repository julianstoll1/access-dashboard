# Access Dashboard

Zentrale Oberfläche für Access- und Rollenverwaltung pro Projekt.

Das Dashboard ist für zwei Zielgruppen gedacht:
- **Produkt-/Backend-Teams**, die Berechtigungen und Rollen verwalten
- **API-Integratoren**, die diese Regeln in ihrer Anwendung verwenden

---

## Inhaltsverzeichnis
- [Was ist das?](#was-ist-das)
- [Was kann ich damit machen?](#was-kann-ich-damit-machen)
- [Typischer Ablauf (aus User-Sicht)](#typischer-ablauf-aus-user-sicht)
- [Integration (API-Nutzer)](#integration-api-nutzer)
- [Tech Stack](#tech-stack)
- [Architekturüberblick](#architekturüberblick)
- [Projektstruktur](#projektstruktur)
- [Lokales Setup](#lokales-setup)
- [Umgebungsvariablen](#umgebungsvariablen)
- [Datenmodell (Supabase)](#datenmodell-supabase)
- [Sicherheits- und Betriebsnotizen](#sicherheits--und-betriebsnotizen)
- [Scripts](#scripts)

---

## Was ist das?
**Access Dashboard** ist ein Next.js-basiertes Admin-Frontend, mit dem du Zugriffsregeln pro Projekt verwaltest:
- API Keys
- Permissions
- Rollen
- Zuordnung von Permissions zu Rollen

Damit entsteht eine zentrale Quelle für Zugriffslogik, die du in deiner API/App konsumierst.

---

## Was kann ich damit machen?

### 1) Projekte verwalten
- Projekte erstellen
- Projektübersicht öffnen

### 2) API Keys verwalten
- API Key pro Projekt generieren
- API Key rotieren
- Sichere Speicherung (Hash + verschlüsselt)

### 3) Permissions verwalten
- Permissions anlegen, bearbeiten, löschen
- `enabled` togglen
- Risiko-Level (`low`, `medium`, `high`) setzen
- Suche, Filter, Sortierung

### 4) Rollen verwalten
- Rollen anlegen, bearbeiten, löschen
- `slug` inkl. Auto-Vorschlag und Validierung
- `is_system` als Rolle-Typ (`system`/`custom`)
- Permissions pro Rolle zuweisen (`role_permissions`)

### 5) Für API-Checks vorbereiten
- Berechtigungen sauber modellieren
- Rollen stabil über Slugs pflegen
- Regeln in deiner API auswerten (z. B. über `resource` / Permission-Slug)

---

## Typischer Ablauf (aus User-Sicht)
1. **Projekt erstellen**
2. **API Key generieren**
3. **Permissions definieren** (z. B. `billing.read`, `export.csv`)
4. **Rollen anlegen** (z. B. `admin`, `premium`, `support`)
5. **Permissions Rollen zuordnen**
6. In deinem Backend/User-Service Usern Rollen zuweisen (`user_roles`)
7. In deiner API bei Requests gegen Regeln prüfen

---

## Integration (API-Nutzer)
Das Dashboard selbst ist das Management-Frontend. Deine Laufzeit-API (Access Check) liegt typischerweise in deinem Backend-Service.

Im Projekt ist dafür im Integration-Tab ein Request-Muster hinterlegt:

```ts
await fetch("https://api.yourapp.com/access/check", {
  method: "POST",
  headers: {
    "Authorization": "Bearer sk_live_...",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    user_id: "user_123",
    resource: "feature_export"
  })
})
```

### Erwartetes Integrationsmodell
- **Input**: `user_id`, gewünschte `resource` (oder Permission-Slug)
- **Regelbasis**:
  - `user_roles` (welche Rollen hat der User?)
  - `role_permissions` (welche Permissions ergeben sich daraus?)
  - `permissions.enabled` + weitere Regeln
- **Output**: erlaubt / nicht erlaubt (+ optional Grund)

---

## Tech Stack
- **Framework**: Next.js 16 (App Router)
- **UI**: React 19 + Tailwind CSS 4
- **Sprache**: TypeScript
- **Backend as a Service**: Supabase (`@supabase/ssr`)
- **Auth**: Supabase Auth
- **Datenzugriff**: Server Components + Server Actions

---

## Architekturüberblick
- **Server Components** laden initiale Daten (`projects`, `permissions`, `roles`, `api_keys`)
- **Client UI** übernimmt Interaktion (Tabs, Modals, Filter)
- **Server Actions** übernehmen validierte Schreiboperationen
- **Lib-Layer** kapselt DB-Zugriffe

Das sorgt für:
- klare Trennung von UI und Datenlogik
- saubere Validierung serverseitig
- gute Wartbarkeit

---

## Projektstruktur
```text
app/
  (auth)/
    login/page.tsx
    signup/page.tsx
  dashboard/
    page.tsx
    new/page.tsx
    projects/[id]/
      page.tsx
      ProjectPageClient.tsx
      actions.ts
      permissions-actions.ts
      roles-actions.ts

lib/
  auth.ts
  supabase.ts
  supabase-server.ts
  projects.ts
  apiKeys.ts
  permissions.ts
  roles.ts
```

Wichtige Dateien:
- `app/dashboard/projects/[id]/ProjectPageClient.tsx`: komplette Projekt-UI (Tabs, Manager)
- `app/dashboard/projects/[id]/permissions-actions.ts`: serverseitige Permission-Validierung + CRUD
- `app/dashboard/projects/[id]/roles-actions.ts`: serverseitige Role-Validierung + CRUD
- `lib/permissions.ts`, `lib/roles.ts`: DB-Zugriffsschicht

---

## Lokales Setup

### Voraussetzungen
- Node.js 20+
- npm 10+
- laufendes Supabase-Projekt mit passendem Schema

### Schritte
1. Dependencies installieren
```bash
npm install
```

2. `.env.local` erstellen (siehe unten)

3. Dev-Server starten
```bash
npm run dev
```

4. Öffnen
- [http://localhost:3000](http://localhost:3000)

---

## Umgebungsvariablen

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
API_KEY_ENCRYPTION_SECRET=...
```

Hinweise:
- `API_KEY_ENCRYPTION_SECRET` muss stabil und geheim sein.
- Ohne gültige Supabase-Variablen funktionieren Auth und DB-Zugriffe nicht.

---

## Datenmodell (Supabase)
Relevante Tabellen:
- `projects`
- `api_keys`
- `permissions`
- `roles`
- `role_permissions`
- `user_roles`
- `access_grants`

Beziehungen (vereinfacht):
- `projects` 1:n `permissions`
- `projects` 1:n `roles`
- `roles` n:m `permissions` über `role_permissions`
- `user_roles` verbindet User ↔ Rollen je Projekt

Empfohlene Constraints:
- `permissions`: Unique auf (`project_id`, `slug`)
- `roles`: Unique auf (`project_id`, `slug`)
- `role_permissions`: Unique auf (`role_id`, `permission_id`)

---

## Sicherheits- und Betriebsnotizen
- API Keys werden nicht im Klartext gespeichert, sondern gehasht und verschlüsselt abgelegt.
- Schreiboperationen laufen über Server Actions mit serverseitiger Validierung.
- System-Rollen (`is_system = true`) sind geschützt (z. B. nicht löschbar).
- In streng offline/isolierten Umgebungen kann `next/font`-Download beim Build fehlschlagen.

---

## Scripts
```bash
npm run dev      # Entwicklungsserver
npm run build    # Production Build
npm run start    # Production Server
npm run lint     # Linting
```

---

Wenn du möchtest, ergänze ich als nächsten Schritt noch eine kompakte **API-Playbook-Sektion** mit konkreten Check-Strategien (z. B. direktes SQL-Mapping vs. denormalisierte Cache-Tabelle) für hohe Last.
