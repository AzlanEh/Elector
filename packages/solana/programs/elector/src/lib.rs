use anchor_lang::prelude::*;

declare_id!("BCjKShjHXdo859DhoWVjbyZgSmC3ecjFzQ8W3BkUeqTr");

#[program]
pub mod elector {
    use super::*;

    // Initialize a new election
    pub fn initialize_election(
        ctx: Context<InitializeElection>,
        election_id: String,
        title: String,
        start_time: i64,
        end_time: i64,
        candidate_count: u8,
    ) -> Result<()> {
        let election = &mut ctx.accounts.election;
        let clock = Clock::get()?;

        // Validate election parameters
        require!(start_time < end_time, ElectionError::InvalidTimeRange);
        require!(
            start_time > clock.unix_timestamp,
            ElectionError::ElectionAlreadyStarted
        );
        require!(
            candidate_count > 0 && candidate_count <= 10,
            ElectionError::InvalidCandidateCount
        );

        election.election_id = election_id;
        election.title = title;
        election.start_time = start_time;
        election.end_time = end_time;
        election.candidate_count = candidate_count;
        election.is_active = false;
        election.total_votes = 0;
        election.authority = *ctx.accounts.authority.key;

        msg!("Election initialized: {}", election.title);
        Ok(())
    }

    // Start the election (only authority can call this)
    pub fn start_election(ctx: Context<StartElection>) -> Result<()> {
        let election = &mut ctx.accounts.election;
        let clock = Clock::get()?;

        // Validate caller is authority
        require!(
            election.authority == *ctx.accounts.authority.key,
            ElectionError::Unauthorized
        );

        // Validate timing
        require!(!election.is_active, ElectionError::ElectionAlreadyActive);
        require!(
            clock.unix_timestamp >= election.start_time,
            ElectionError::ElectionNotReady
        );

        election.is_active = true;
        msg!("Election started: {}", election.title);
        Ok(())
    }

    // Submit a vote commitment
    pub fn submit_vote_commitment(
        ctx: Context<SubmitVoteCommitment>,
        voter_hash: String,
        commitment: [u8; 32],
    ) -> Result<()> {
        let election = &mut ctx.accounts.election;
        let vote_commitment = &mut ctx.accounts.vote_commitment;
        let clock = Clock::get()?;

        // Validate election is active
        require!(election.is_active, ElectionError::ElectionNotActive);
        require!(
            clock.unix_timestamp <= election.end_time,
            ElectionError::ElectionEnded
        );

        // Check if voter already voted - init will fail if account exists
        // Initialize vote commitment
        vote_commitment.voter_hash = voter_hash;
        vote_commitment.commitment = commitment;
        vote_commitment.timestamp = clock.unix_timestamp;

        // Increment total votes
        election.total_votes += 1;

        msg!(
            "Vote commitment submitted for voter: {}",
            vote_commitment.voter_hash
        );
        Ok(())
    }

    // End the election (only authority can call this)
    pub fn end_election(ctx: Context<EndElection>) -> Result<()> {
        let election = &mut ctx.accounts.election;
        let clock = Clock::get()?;

        // Validate caller is authority
        require!(
            election.authority == *ctx.accounts.authority.key,
            ElectionError::Unauthorized
        );

        // Validate election can be ended
        require!(election.is_active, ElectionError::ElectionNotActive);
        require!(
            clock.unix_timestamp >= election.end_time,
            ElectionError::ElectionNotEnded
        );

        election.is_active = false;
        msg!("Election ended: {}", election.title);
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(election_id: String)]
pub struct InitializeElection<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Election::LEN,
        seeds = [b"election", election_id.as_bytes()],
        bump
    )]
    pub election: Account<'info, Election>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct StartElection<'info> {
    #[account(mut, has_one = authority)]
    pub election: Account<'info, Election>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(voter_hash: String)]
pub struct SubmitVoteCommitment<'info> {
    #[account(mut)]
    pub election: Account<'info, Election>,

    #[account(
        init,
        payer = voter,
        space = 8 + VoteCommitment::LEN,
        seeds = [b"vote_commitment", election.key().as_ref(), voter_hash.as_bytes()],
        bump
    )]
    pub vote_commitment: Account<'info, VoteCommitment>,

    #[account(mut)]
    pub voter: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct EndElection<'info> {
    #[account(mut, has_one = authority)]
    pub election: Account<'info, Election>,

    pub authority: Signer<'info>,
}

#[account]
pub struct Election {
    pub election_id: String, // 4 + 36 = 40
    pub title: String,       // 4 + 100 = 104
    pub start_time: i64,     // 8
    pub end_time: i64,       // 8
    pub candidate_count: u8, // 1
    pub is_active: bool,     // 1
    pub total_votes: u32,    // 4
    pub authority: Pubkey,   // 32
}

impl Election {
    pub const LEN: usize = 4 + 36 + 4 + 100 + 8 + 8 + 1 + 1 + 4 + 32;
}

#[account]
pub struct VoteCommitment {
    pub voter_hash: String,   // 4 + 64 = 68
    pub commitment: [u8; 32], // 32
    pub timestamp: i64,       // 8
}

impl VoteCommitment {
    pub const LEN: usize = 4 + 64 + 32 + 8;
}

#[error_code]
pub enum ElectionError {
    #[msg("Invalid time range for election")]
    InvalidTimeRange,

    #[msg("Election has already started")]
    ElectionAlreadyStarted,

    #[msg("Invalid number of candidates")]
    InvalidCandidateCount,

    #[msg("Unauthorized access")]
    Unauthorized,

    #[msg("Election is already active")]
    ElectionAlreadyActive,

    #[msg("Election is not ready to start")]
    ElectionNotReady,

    #[msg("Election is not active")]
    ElectionNotActive,

    #[msg("Election has already ended")]
    ElectionEnded,

    #[msg("Voter has already voted")]
    AlreadyVoted,

    #[msg("Election has not ended yet")]
    ElectionNotEnded,
}
