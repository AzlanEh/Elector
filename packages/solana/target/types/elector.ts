/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/elector.json`.
 */
export type Elector = {
  "address": "BCjKShjHXdo859DhoWVjbyZgSmC3ecjFzQ8W3BkUeqTr",
  "metadata": {
    "name": "elector",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "endElection",
      "discriminator": [
        26,
        248,
        92,
        184,
        33,
        221,
        94,
        215
      ],
      "accounts": [
        {
          "name": "election",
          "writable": true
        },
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "election"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "initializeElection",
      "discriminator": [
        59,
        166,
        191,
        126,
        195,
        0,
        153,
        168
      ],
      "accounts": [
        {
          "name": "election",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  108,
                  101,
                  99,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "arg",
                "path": "electionId"
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "electionId",
          "type": "string"
        },
        {
          "name": "title",
          "type": "string"
        },
        {
          "name": "startTime",
          "type": "i64"
        },
        {
          "name": "endTime",
          "type": "i64"
        },
        {
          "name": "candidateCount",
          "type": "u8"
        }
      ]
    },
    {
      "name": "startElection",
      "discriminator": [
        84,
        120,
        181,
        159,
        113,
        70,
        98,
        143
      ],
      "accounts": [
        {
          "name": "election",
          "writable": true
        },
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "election"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "submitVoteCommitment",
      "discriminator": [
        149,
        248,
        142,
        52,
        170,
        150,
        52,
        110
      ],
      "accounts": [
        {
          "name": "election",
          "writable": true
        },
        {
          "name": "voteCommitment",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  111,
                  116,
                  101,
                  95,
                  99,
                  111,
                  109,
                  109,
                  105,
                  116,
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "election"
              },
              {
                "kind": "account",
                "path": "voter"
              }
            ]
          }
        },
        {
          "name": "voter",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "voterHash",
          "type": "string"
        },
        {
          "name": "commitment",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "election",
      "discriminator": [
        68,
        191,
        164,
        85,
        35,
        105,
        152,
        202
      ]
    },
    {
      "name": "voteCommitment",
      "discriminator": [
        9,
        154,
        172,
        4,
        64,
        22,
        11,
        94
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidTimeRange",
      "msg": "Invalid time range for election"
    },
    {
      "code": 6001,
      "name": "electionAlreadyStarted",
      "msg": "Election has already started"
    },
    {
      "code": 6002,
      "name": "invalidCandidateCount",
      "msg": "Invalid number of candidates"
    },
    {
      "code": 6003,
      "name": "unauthorized",
      "msg": "Unauthorized access"
    },
    {
      "code": 6004,
      "name": "electionAlreadyActive",
      "msg": "Election is already active"
    },
    {
      "code": 6005,
      "name": "electionNotReady",
      "msg": "Election is not ready to start"
    },
    {
      "code": 6006,
      "name": "electionNotActive",
      "msg": "Election is not active"
    },
    {
      "code": 6007,
      "name": "electionEnded",
      "msg": "Election has already ended"
    },
    {
      "code": 6008,
      "name": "alreadyVoted",
      "msg": "Voter has already voted"
    },
    {
      "code": 6009,
      "name": "electionNotEnded",
      "msg": "Election has not ended yet"
    }
  ],
  "types": [
    {
      "name": "election",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "electionId",
            "type": "string"
          },
          {
            "name": "title",
            "type": "string"
          },
          {
            "name": "startTime",
            "type": "i64"
          },
          {
            "name": "endTime",
            "type": "i64"
          },
          {
            "name": "candidateCount",
            "type": "u8"
          },
          {
            "name": "isActive",
            "type": "bool"
          },
          {
            "name": "totalVotes",
            "type": "u32"
          },
          {
            "name": "authority",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "voteCommitment",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "voterHash",
            "type": "string"
          },
          {
            "name": "commitment",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    }
  ]
};
