<file_path>
elector/docs/blockchain.md
</file_path>

<edit_description>
Create blockchain architecture documentation
</edit_description>

# Blockchain Architecture

## Overview

Elector uses the Solana blockchain to provide immutable, verifiable records of election activities. The blockchain layer handles election lifecycle management and stores cryptographic commitments of votes, ensuring transparency and preventing tampering.

## Solana Program Structure

The election system is implemented as an Anchor program with the following key components:

### Program ID
`BCjKShjHXdo859DhoWVjbyZgSmC3ecjFzQ8W3BkUeqTr`

### Accounts

#### Election Account
Stores election metadata and state:

```rust
#[account]
pub struct Election {
    pub election_id: String,     // Unique election identifier
    pub title: String,           // Election title
    pub start_time: i64,         // Unix timestamp
    pub end_time: i64,           // Unix timestamp
    pub candidate_count: u8,     // Number of candidates (1-10)
    pub is_active: bool,         // Election status
    pub total_votes: u32,        // Total vote commitments
    pub authority: Pubkey,       // Election authority
}
```

#### Vote Commitment Account
Stores anonymous vote commitments:

```rust
#[account]
pub struct VoteCommitment {
    pub voter_hash: String,      // Hashed voter identifier
    pub commitment: [u8; 32],    // Cryptographic commitment
    pub timestamp: i64,          // Vote timestamp
}
```

### Instructions

#### Initialize Election
Creates a new election account with metadata.

**Parameters:**
- `election_id`: Unique string identifier
- `title`: Election title
- `start_time`: Start timestamp
- `end_time`: End timestamp
- `candidate_count`: Number of candidates

**Validation:**
- End time must be after start time
- Candidate count between 1-10

#### Start Election
Activates an election when the start time is reached.

**Requirements:**
- Caller must be the election authority
- Election not already active
- Current time >= start time

#### Submit Vote Commitment
Records a vote commitment on-chain.

**Parameters:**
- `voter_hash`: Hashed voter identifier
- `commitment`: 32-byte cryptographic commitment

**Validation:**
- Election must be active
- Current time within election period
- Prevents duplicate voting via account initialization

#### End Election
Deactivates an election after the end time.

**Requirements:**
- Caller must be the election authority
- Election currently active
- Current time >= end time

## Security Features

### Authority Control
Only the designated authority can start and end elections, preventing unauthorized manipulation.

### Timestamp Validation
All operations validate against blockchain timestamps to ensure proper sequencing.

### Unique Voting
Vote commitment accounts are initialized per voter per election, preventing double-voting.

### Cryptographic Commitments
Votes are stored as commitments rather than plaintext, maintaining voter privacy while ensuring verifiability.

## Integration with Backend

The Solana program integrates with the backend API through:

1. **Election Management**: Backend calls program instructions to create and manage elections
2. **Vote Recording**: Each database vote triggers an on-chain commitment
3. **Audit Trail**: Blockchain provides immutable record of all election activities

## Development Workflow

### Building the Program
```bash
cd packages/solana
anchor build
```

### Testing
```bash
anchor test
```

### Deployment
```bash
anchor deploy
```

## Client Integration

The TypeScript client (`packages/solana/app/client.ts`) provides methods to interact with the program:

- `initializeElection()`
- `startElection()`
- `submitVoteCommitment()`
- `endElection()`

## Future Enhancements

- **Zero-Knowledge Proofs**: Implement ZKPs for private voting
- **Multi-signature**: Require multiple authorities for critical operations
- **Cross-chain**: Support for multiple blockchain networks
- **Decentralized Identity**: Integration with DID systems for voter verification

## Performance Considerations

- Solana's high throughput enables real-time vote processing
- Account initialization prevents spam voting attempts
- Efficient data structures minimize storage costs
- Parallel transaction processing scales with network load

## Monitoring and Analytics

- Total vote counts available on-chain
- Election state changes logged in transaction history
- Authority actions traceable for audit purposes
- Performance metrics via Solana's RPC endpoints
</edit_description>