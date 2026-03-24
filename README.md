# Elector

Elector is a secure, blockchain-based voting system designed for transparent and verifiable elections. It leverages the Solana blockchain for on-chain vote commitments, ensuring immutability and auditability, while using Aadhaar-based identity verification for voter authentication and age eligibility checks.

## Features

- **Blockchain Security**: Vote commitments stored on Solana for tamper-proof records
- **Identity Verification**: Aadhaar QR code scanning for secure, privacy-preserving authentication
- **Age Eligibility**: Automatic verification that voters are 18+ years old
- **One Vote Per User**: Enforced uniqueness per election to prevent double-voting
- **Real-time Results**: Live vote tallying and percentage calculations
- **Mobile-First**: React Native app for seamless voter experience
- **Type-Safe APIs**: End-to-end type safety with oRPC and Hono
- **Scalable Architecture**: Monorepo structure with Turborepo for optimized builds

## System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Mobile App    │    │   Backend API   │    │   Blockchain    │
│  (React Native) │◄──►│   (Hono/oRPC)  │◄──►│   (Solana)      │
│                 │    │                 │    │                 │
│ • QR Scanning   │    │ • Auth & Vote   │    │ • Vote Commits  │
│ • Vote Casting  │    │ • Results       │    │ • Audit Trail   │
│ • Results View  │    │ • Business Logic│    │ • Immutability  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Identity      │    │   Database      │    │   Smart         │
│   Verification  │    │   (PostgreSQL)  │    │   Contracts     │
│   (Aadhaar)     │    │                 │    │   (Anchor)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Component Overview

1. **Mobile App**: React Native interface for voters to authenticate via Aadhaar QR, browse elections, cast votes, and view results
2. **Backend API**: Hono server with oRPC providing type-safe endpoints for authentication, voting, and data retrieval
3. **Database**: PostgreSQL with Prisma ORM storing user data, elections, candidates, and votes
4. **Blockchain**: Solana program managing election lifecycle and storing vote commitments for auditability

### Data Flow

1. **Authentication**: User scans Aadhaar QR → API verifies identity and age → Hashed UID stored
2. **Voting**: User selects candidate → API validates eligibility → Vote recorded in DB + commitment on Solana
3. **Results**: API aggregates votes → Calculates real-time percentages → Returns sorted results

## Architecture Overview

Elector follows a modern, scalable architecture separating concerns across multiple layers:

### System Components

1. **Mobile App (React Native/Expo)**
   - Voter interface for identity verification, election browsing, and voting
   - QR code scanning for Aadhaar authentication
   - Real-time results viewing

2. **Backend API (Hono + oRPC)**
   - RESTful API with type-safe endpoints
   - Business logic for elections, voting, and results
   - Integration with database and blockchain

3. **Database (PostgreSQL + Prisma)**
   - User management with hashed Aadhaar UIDs
   - Election and candidate data
   - Vote records with referential integrity

4. **Blockchain Layer (Solana/Anchor)**
   - On-chain election management
   - Vote commitment storage for audit trails
   - Decentralized verification of election integrity

### Data Flow

1. **Registration**: User scans Aadhaar QR → API parses and verifies → User record created with hashed UID
2. **Voting**: User selects candidate → API validates eligibility → Vote recorded in DB → Commitment submitted to Solana
3. **Results**: API aggregates votes from DB → Calculates percentages → Returns real-time results

### Security Considerations

- **Privacy**: Aadhaar UIDs are hashed and never stored in plain text
- **Anonymity**: Vote commitments use cryptographic hashes to maintain voter privacy
- **Integrity**: Blockchain ensures vote records cannot be altered
- **Eligibility**: Age verification prevents underage voting

## Tech Stack

- **Frontend**: React Native, Expo, HeroUI, TailwindCSS
- **Backend**: Hono, oRPC, Node.js
- **Database**: PostgreSQL, Prisma ORM
- **Blockchain**: Solana, Anchor Framework
- **Build System**: Turborepo, pnpm workspaces
- **Type Safety**: TypeScript throughout
- **Development**: Expo CLI, Prisma Studio

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+
- PostgreSQL 13+
- Rust (for Solana development)
- Expo CLI (for mobile development)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/AzlanEh/Elector.git
   cd elector
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Set up the database:
   ```bash
   # Start PostgreSQL (if using Docker)
   pnpm run db:start

   # Push schema to database
   pnpm run db:push

   # Generate Prisma client
   pnpm run db:generate
   ```

4. Configure environment variables:
   - Copy `.env.example` to `apps/server/.env`
   - Set database URL and other required variables

5. Start development servers:
   ```bash
   # Start all services
   pnpm run dev

   # Or start individually
   pnpm run dev:server  # API server at http://localhost:3000
   pnpm run dev:native  # React Native app
   ```

### Blockchain Setup

For Solana development:

1. Install Solana CLI and Anchor
2. Build the program:
   ```bash
   cd packages/solana
   anchor build
   ```
3. Run tests:
   ```bash
   anchor test
   ```

## Project Structure

```
elector/
├── apps/
│   ├── native/              # React Native mobile app
│   │   ├── app/             # Expo Router pages
│   │   ├── components/      # Reusable UI components
│   │   ├── contexts/        # React contexts (theme, etc.)
│   │   └── utils/           # Utilities and API client
│   └── server/              # Hono API server
│       └── src/             # Server source code
├── packages/
│   ├── api/                 # Shared API logic and routers
│   │   ├── src/
│   │   │   ├── lib/         # Aadhaar parsing, utilities
│   │   │   └── routers/     # API route handlers
│   ├── blockchain/          # Shared blockchain utilities
│   ├── config/              # Shared TypeScript configs
│   ├── db/                  # Database schema and client
│   │   ├── prisma/
│   │   │   ├── schema/      # Prisma schema
│   │   │   └── generated/   # Generated client
│   ├── env/                 # Environment validation
│   └── solana/              # Solana program and client
│       ├── programs/elector/# Anchor program
│       ├── app/             # TypeScript client
│       └── tests/           # Program tests
├── scripts/                 # Utility scripts
└── turbo.json               # Turborepo configuration
```

## API Reference

### Authentication

- `POST /auth/verifyQR` - Verify Aadhaar QR and create/update user

### Elections

- `GET /elections/list` - Get all elections with candidates
- `GET /elections/getById` - Get specific election details

### Voting

- `POST /vote/submit` - Submit a vote
- `GET /vote/hasVoted` - Check if user has voted in election

### Results

- `GET /results/getByElection` - Get election results with vote counts

## Database Schema

### User
- `id`: CUID primary key
- `aadhaarHash`: Hashed Aadhaar UID (unique)
- `votes`: One-to-many relationship with Vote

### Election
- `id`: CUID primary key
- `title`, `description`: Election metadata
- `startTime`, `endTime`: Election period
- `candidates`: One-to-many with Candidate
- `votes`: One-to-many with Vote

### Candidate
- `id`: CUID primary key
- `name`, `description`, `party`: Candidate info
- `electionId`: Foreign key to Election

### Vote
- `id`: CUID primary key
- `userId`, `electionId`, `candidateId`: Foreign keys
- Unique constraint on (userId, electionId)

## Available Scripts

- `pnpm run dev` - Start all development servers
- `pnpm run build` - Build all packages and apps
- `pnpm run check-types` - Type check across monorepo
- `pnpm run dev:native` - Start React Native development
- `pnpm run dev:server` - Start API server
- `pnpm run db:push` - Push Prisma schema to database
- `pnpm run db:studio` - Open Prisma Studio
- `pnpm run db:migrate` - Run database migrations
- `pnpm run db:start` - Start PostgreSQL container
- `pnpm run db:stop` - Stop PostgreSQL container

## Development

### Environment Variables

Create `apps/server/.env` with:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/elector"
SOLANA_RPC_URL="https://api.devnet.solana.com"
SOLANA_PRIVATE_KEY="your-private-key"
```

### Testing

```bash
# Run API tests
pnpm run test

# Run Solana program tests
cd packages/solana && anchor test
```

### Deployment

1. Build all packages:
   ```bash
   pnpm run build
   ```

2. Deploy Solana program:
   ```bash
   cd packages/solana
   anchor deploy
   ```

3. Deploy API server to your preferred platform (Vercel, Railway, etc.)

4. Build and submit mobile app to app stores

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Documentation

- [API Reference](docs/api.md) - Detailed API endpoints and usage
- [Blockchain Architecture](docs/blockchain.md) - Solana program design and integration
- [Deployment Guide](docs/deployment.md) - Production setup and scaling

## License

This project is licensed under the MIT License.

## Security

This system handles sensitive identity data. Please review the security considerations and ensure proper key management for production deployments.