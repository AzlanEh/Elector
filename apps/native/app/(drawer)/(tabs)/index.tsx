import { Button } from "heroui-native";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { Container } from "@/components/container";

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [election, setElection] = useState<any>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
  const [isVoting, setIsVoting] = useState(false);

  // Simple test - fetch election data
  useEffect(() => {
    const fetchElection = async () => {
      try {
        // For now, hardcode the election data since API integration is complex
        setElection({
          id: "sample-election-1",
          title: "Sample Election 2024",
          description: "A demonstration election for the blockchain voting system",
          candidates: [
            {
              id: "candidate-1",
              name: "Alice Johnson",
              description: "Experienced leader with focus on technology and innovation",
            },
            {
              id: "candidate-2",
              name: "Bob Smith",
              description: "Community advocate with strong environmental policies",
            },
            {
              id: "candidate-3",
              name: "Carol Williams",
              description: "Education reformer and economic development expert",
            },
          ],
        });
      } catch (error) {
        console.error("Failed to fetch election:", error);
      }
    };
    fetchElection();
  }, []);

  const handleLogin = async () => {
    try {
      // Mock login for now
      const mockUser = {
        userId: `user-${Date.now()}`,
        voterHash: `voter-mock-${Date.now()}`,
        hasVoted: false,
      };
      setUser(mockUser);
      Alert.alert("Success", `Logged in as ${mockUser.voterHash}`);
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  const handleVote = async () => {
    if (!user || !selectedCandidate) return;

    setIsVoting(true);
    try {
      // Mock vote submission
      const voteHash = `vote-${selectedCandidate}-${user.voterHash}-${Date.now()}`;
      setIsVoting(false);
      Alert.alert("Success", `Vote submitted! Hash: ${voteHash}`);
      setUser({ ...user, hasVoted: true });
    } catch (error: any) {
      setIsVoting(false);
      Alert.alert("Error", error.message);
    }
  };

  return (
    <Container style={styles.container}>
      <View style={styles.content}>
        {/* User Status */}
        <View style={styles.section}>
          {user ? (
            <View style={styles.userCard}>
              <Text style={styles.boldText}>Logged In</Text>
              <Text>Voter Hash: {user.voterHash}</Text>
              <Text>Has Voted: {user.hasVoted ? "Yes" : "No"}</Text>
            </View>
          ) : (
            <Button onPress={handleLogin}>
              <Text>Login with Mock DigiLocker</Text>
            </Button>
          )}
        </View>

        {/* Election Info */}
        {election && (
          <View style={styles.section}>
            <Text style={styles.title}>{election.title}</Text>
            <Text style={styles.description}>{election.description}</Text>

            <Text style={styles.subtitle}>Candidates:</Text>
            {election.candidates.map((candidate: any) => (
              <Button
                key={candidate.id}
                variant={selectedCandidate === candidate.id ? "primary" : "secondary"}
                style={styles.candidateButton}
                onPress={() => setSelectedCandidate(candidate.id)}
                isDisabled={user?.hasVoted || !user}
              >
                <View>
                  <Text>{candidate.name}</Text>
                  {candidate.description && (
                    <Text style={styles.candidateDesc}>{candidate.description}</Text>
                  )}
                </View>
              </Button>
            ))}
          </View>
        )}

        {/* Vote Button */}
        {user && !user.hasVoted && selectedCandidate && (
          <Button onPress={handleVote} isDisabled={isVoting} style={styles.voteButton}>
            <Text style={styles.voteButtonText}>
              {isVoting ? "Submitting Vote..." : "Submit Vote"}
            </Text>
          </Button>
        )}

        {/* Status Messages */}
        {user?.hasVoted && (
          <View style={styles.votedCard}>
            <Text style={[styles.boldText, styles.centerText]}>
              You have already voted in this election.
            </Text>
          </View>
        )}
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
  },
  content: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  userCard: {
    backgroundColor: '#d1fae5',
    padding: 16,
    borderRadius: 8,
  },
  boldText: {
    fontWeight: 'bold',
  },
  centerText: {
    textAlign: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  description: {
    color: '#666',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  candidateButton: {
    marginBottom: 8,
  },
  candidateDesc: {
    fontSize: 14,
    color: '#666',
  },
  voteButton: {
    backgroundColor: '#3b82f6',
  },
  voteButtonText: {
    color: 'white',
  },
  votedCard: {
    backgroundColor: '#dbeafe',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
  },
});