# Elector API Documentation

## Overview

The Elector API is built with Hono and oRPC, providing type-safe endpoints for election management, voting, and results. All endpoints return JSON responses.

Base URL: `http://localhost:3000` (development)

## Authentication

The API uses Aadhaar-based authentication. Users verify their identity by scanning QR codes, which are processed server-side.

### Endpoints

#### POST /auth/verifyQR

Verifies an Aadhaar QR code and creates or updates a user record.

**Request Body:**
```json
{
  "qrData": "base64-encoded-qr-bytes"
}
```

For development, use `"qrData": "dev"` to get synthetic test data.

**Response:**
```json
{
  "userId": "string",
  "displayName": "string",
  "dob": "YYYY-MM-DD",
  "age": 25,
  "gender": "MALE|FEMALE|OTHER",
  "photo": "base64-jpeg-or-null",
  "signatureValid": true,
  "qrFormat": "SECURE_QR|V5"
}
```

**Error Responses:**
- `400`: Invalid QR data
- `403`: User under 18 years old

## Aadhaar QR Parsing

The system supports parsing Aadhaar QR codes in multiple formats:

### Supported Formats
- **Secure QR**: Zlib-compressed XML with RSA-SHA256 signature (new format)
- **Legacy QR**: Uncompressed XML with embedded signature
- **V5 Pipe-Delimited**: Binary format with JPEG 2000 photos

### Security Features
- RSA signature verification using UIDAI public certificates
- Age validation (must be 18+)
- UID hashing (never stored in plain text)
- Photo transcoding (JP2/J2C to JPEG for mobile compatibility)

### Development Mode
Pass `"qrData": "dev"` to receive synthetic test data without scanning.

## Elections


Endpoints for retrieving election information.

#### GET /elections/list

Returns all elections with their candidates and current vote counts.

**Response:**
```json
[
  {
    "id": "string",
    "title": "string",
    "description": "string",
    "startTime": "2024-01-01T00:00:00.000Z",
    "endTime": "2024-01-02T00:00:00.000Z",
    "candidates": [
      {
        "id": "string",
        "name": "string",
        "description": "string",
        "party": "string"
      }
    ],
    "_count": {
      "votes": 150
    }
  }
]
```

#### GET /elections/getById

Returns detailed information for a specific election.

**Query Parameters:**
- `electionId` (string, required)

**Response:**
```json
{
  "id": "string",
  "title": "string",
  "description": "string",
  "startTime": "2024-01-01T00:00:00.000Z",
  "endTime": "2024-01-02T00:00:00.000Z",
  "candidates": [
    {
      "id": "string",
      "name": "string",
      "description": "string",
      "party": "string"
    }
  ],
  "_count": {
    "votes": 150
  }
}
```

**Error Responses:**
- `404`: Election not found

## Voting

Endpoints for casting and checking votes.

#### POST /vote/submit

Submits a vote for a candidate in an election.

**Request Body:**
```json
{
  "userId": "string",
  "electionId": "string",
  "candidateId": "string"
}
```

**Response:**
```json
{
  "success": true,
  "voteId": "string"
}
```

**Error Responses:**
- `400`: Election not active, already voted, or invalid candidate
- `404`: Election or candidate not found

#### GET /vote/hasVoted

Checks if a user has voted in a specific election.

**Query Parameters:**
- `userId` (string, required)
- `electionId` (string, required)

**Response:**
```json
{
  "hasVoted": true,
  "votedCandidateId": "string-or-null"
}
```

## Results

Endpoints for retrieving election results.

#### GET /results/getByElection

Returns vote counts and percentages for all candidates in an election.

**Query Parameters:**
- `electionId` (string, required)

**Response:**
```json
{
  "electionId": "string",
  "totalVotes": 300,
  "results": [
    {
      "candidateId": "string",
      "candidateName": "string",
      "party": "string",
      "voteCount": 150,
      "percentage": 50
    }
  ]
}
```

## Health Check

#### GET /healthCheck

Returns server health status.

**Response:**
```json
"OK"
```

## Error Handling

All endpoints follow standard HTTP status codes:

- `200`: Success
- `400`: Bad Request (validation errors)
- `403`: Forbidden (age restriction, etc.)
- `404`: Not Found
- `500`: Internal Server Error

Error responses include a message field with details.

## Rate Limiting

API endpoints are rate-limited to prevent abuse. Contact the development team for specific limits.

## Type Safety

The API is fully type-safe. Client libraries can be generated using oRPC for end-to-end type safety in TypeScript projects.