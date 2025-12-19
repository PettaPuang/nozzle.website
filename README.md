# Nozzl - Your System Evolve

Evolusi Operasional SPBU Independen
SPBU Manajemen System berbasis web untuk operasional, keuangan, dan pelaporan yang terintegrasi.

## Tech Stack

- **Framework**: Next.js 16.0.1 (App Router)
- **UI**: Shadcn UI + Tailwind CSS
- **Database**: PostgreSQL + Prisma ORM 6.18.0
- **Auth**: NextAuth.js v5
- **Language**: TypeScript 5.x
- **React**: 19.2.0

## Features

- **Operational Management**

  - Operator shift management
  - Nozzle reading (open/close)
  - Tank reading dengan approval workflow
  - Unload management dengan purchase tracking

- **Financial Management**

  - Transaction journal entries
  - Deposit verification
  - Chart of Accounts (COA)
  - Financial & operational reports
  - Export Excel & PDF

- **Infrastructure Management**

  - Gas station management
  - Tank & station configuration
  - Product & nozzle setup
  - Multi-station support

- **User & Role Management**
  - Role-based access control (OWNER, MANAGER, OPERATOR, FINANCE, dll)
  - User profile management
  - Permission system

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database
- npm/yarn/pnpm

### Installation

1. Clone repository:

```bash
git clone <repository-url>
cd nozzl
```

2. Install dependencies:

```bash
npm install
```

3. Setup environment variables:

```bash
cp .env.example .env
# Edit .env dengan konfigurasi database dan auth
```

4. Setup database:

```bash
# Generate Prisma Client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed database (optional)
npm run db:seed
```

5. Run development server:

```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run db:generate` - Generate Prisma Client
- `npm run db:push` - Push schema changes to database (dev)
- `npm run db:migrate` - Run database migrations
- `npm run db:seed` - Seed database
- `npm run schema:sync` - Sync schema and generate client (dev)

## Project Structure

```
app/
├── (auth)/              # Auth routes
├── (dashboard)/         # Dashboard routes
├── api/                 # API routes
└── generated/prisma/    # Prisma generated client

components/
├── ui/                  # Shadcn components
└── [feature]/           # Feature-specific components

lib/
├── services/            # READ operations (Prisma queries)
├── actions/             # WRITE operations ("use server")
├── validations/         # Zod schemas
└── utils/              # Helper functions

prisma/
├── schema.prisma       # Database schema
└── migrations/         # Migration history
```

## Documentation

- [Architecture & Patterns](./docs/ARCHITECTURE.md) - Detailed architecture documentation


## Database Workflow

### Development

```bash
# Edit schema.prisma, then:
npm run schema:sync
```

### Production

```bash
# Edit schema.prisma, then:
npm run db:migrate
npm run db:generate
```

## License

MIT License - see [LICENSE](./LICENSE) file for details
