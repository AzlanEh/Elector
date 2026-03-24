# System Architecture

## High-Level Overview

Elector is a distributed voting system that combines traditional web/mobile interfaces with blockchain technology for secure, verifiable elections. The system ensures voter privacy, prevents double-voting, and provides transparent audit trails.

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

## Component Architecture

### 1. Client Layer

#### Mobile Application
- **Technology**: React Native + Expo
- **Responsibilities**:
  - User interface for election browsing
  - Aadhaar QR code scanning and parsing
  - Vote submission interface
  - Real-time results display
  - Offline capability for QR processing

#### Web Dashboard (Future)
- Admin interface for election management
- Results visualization
- Audit tools

### 2. API Layer

#### Authentication Router
```
POST /auth/verifyQR
├── Input: Base64 QR data
├── Process: Parse Aadhaar → Validate age → Hash UID → Upsert user
└── Output: User profile (no sensitive data)
```

#### Elections Router
```
GET /elections/list
├── Query: All elections
├── Include: Candidates, vote counts
└── Output: Election metadata

GET /elections/getById
├── Input: electionId
├── Include: Full election details
└── Output: Complete election data
```

#### Voting Router
```
POST /vote/submit
├── Input: userId, electionId, candidateId
├── Validation: Active election, no duplicate votes
├── Process: Create vote record, submit blockchain commitment
└── Output: Success confirmation

GET /vote/hasVoted
├── Input: userId, electionId
├── Check: Vote existence
└── Output: Voting status
```

#### Results Router
```
GET /results/getByElection
├── Input: electionId
├── Aggregate: Vote counts by candidate
├── Calculate: Percentages
└── Output: Sorted results
```

### 3. Data Layer

#### Database Schema
```
User (1) ──── (N) Vote
  │                │
  ├── id           ├── id
  ├── aadhaarHash  ├── userId
  └── timestamps   ├── electionId
                   ├── candidateId
                   └── timestamps

Election (1) ──── (N) Candidate
  │                     │
  ├── id                ├── id
  ├── title             ├── name
  ├── dates             ├── party
  ├── status            └── electionId
  └── metadata
```

#### Key Relationships
- **One User, Many Votes**: Enforces one vote per election
- **One Election, Many Candidates**: Supports multi-candidate elections
- **One Election, Many Votes**: Tracks participation
- **Referential Integrity**: Cascading deletes prevent orphaned records

### 4. Blockchain Layer

#### Solana Program Structure
```
Program ID: BCjKShjHXdo859DhoWVjbyZgSmC3ecjFzQ8W3BkUeqTr

Election PDA
├── Seeds: ["election", election_id]
├── Data: Metadata, timing, authority
└── State: Active/Inactive, vote count

Vote Commitment PDA
├── Seeds: ["vote_commitment", election_key, voter_key]
├── Data: Voter hash, commitment, timestamp
└── Purpose: Anonymous audit trail
```

#### Transaction Flow
```
1. Initialize Election
   Authority → Election PDA → Store metadata

2. Start Election
   Authority → Election PDA → Set active = true

3. Submit Vote
   Voter → Vote Commitment PDA → Store commitment
   Voter → Election PDA → Increment counter

4. End Election
   Authority → Election PDA → Set active = false
```

## Security Architecture

### Identity & Privacy
```
Aadhaar QR → Parse → Validate Age → Hash UID → Store Hash
                    ↓
Never store plain UID │ Only display fields returned
                    ↓
Cryptographic commitment → Blockchain (anonymous)
```

### Vote Integrity
```
Database Vote + Blockchain Commitment = Dual verification
├── Database: Relational integrity, fast queries
├── Blockchain: Immutable audit trail, public verification
└── Cross-validation prevents tampering
```

### Access Control
```
Public Endpoints: Election info, results
├── Authentication: Aadhaar verification
├── Authorization: Age checks, vote uniqueness
└── Admin: Authority signatures for election control
```

## Data Flow Diagrams

### Voter Registration
```
Mobile App → Scan QR → API /auth/verifyQR
    ↓
Parse Aadhaar → Validate age ≥ 18
    ↓
Hash UID → Upsert User record
    ↓
Return profile (name, photo, etc.)
```

### Vote Submission
```
Mobile App → Select candidate → API /vote/submit
    ↓
Validate: Election active, user eligible, not voted
    ↓
Create Vote record in DB
    ↓
Submit commitment to Solana
    ↓
Return success + vote ID
```

### Results Retrieval
```
Mobile App → Request results → API /results/getByElection
    ↓
Query votes from DB → Aggregate by candidate
    ↓
Calculate percentages → Sort by votes
    ↓
Return formatted results
```

## Deployment Architecture

### Development
```
Local Machine
├── PostgreSQL (Docker)
├── API Server (localhost:3000)
├── React Native (Expo)
└── Solana Localnet
```

### Production
```
Cloud Infrastructure
├── Database (Managed PostgreSQL)
├── API (Serverless/Vercel)
├── Mobile (App Stores)
└── Blockchain (Solana Mainnet)
```

### Scaling Considerations
- **API**: Horizontal scaling with load balancers
- **Database**: Read replicas for results queries
- **Blockchain**: High-throughput Solana network
- **Mobile**: CDN for assets, offline-first design

## Monitoring & Observability

### Key Metrics
- API response times and error rates
- Database query performance
- Blockchain transaction success rates
- Mobile app crash reports and usage

### Logging
- Structured logs for all API requests
- Blockchain transaction monitoring
- Database query analysis
- Security event logging

### Alerts
- Election timing violations
- Unusual voting patterns
- System performance degradation
- Security incidents