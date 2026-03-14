import { Ionicons } from "@expo/vector-icons";
import {
  Button,
  Card,
  Chip,
  Description,
  Label,
  Radio,
  RadioGroup,
  Separator,
  Spinner,
  Surface,
  useThemeColor,
} from "heroui-native";
import { useState } from "react";
import { Alert, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, ZoomIn } from "react-native-reanimated";

import { Container } from "@/components/container";

type Candidate = {
  id: string;
  name: string;
  description: string;
  party?: string;
};

type Election = {
  id: string;
  title: string;
  description: string;
  endDate: string;
  candidates: Candidate[];
};

type User = {
  userId: string;
  voterHash: string;
  hasVoted: boolean;
};

const MOCK_ELECTION: Election = {
  id: "election-2024",
  title: "General Election 2024",
  description: "Cast your vote securely on the blockchain. Your identity remains anonymous.",
  endDate: "Dec 31, 2024",
  candidates: [
    {
      id: "candidate-1",
      name: "Alice Johnson",
      party: "Progress Party",
      description: "Technology & innovation leader with 12 years of public service experience.",
    },
    {
      id: "candidate-2",
      name: "Bob Smith",
      party: "Green Alliance",
      description: "Community advocate with strong environmental and renewable energy policies.",
    },
    {
      id: "candidate-3",
      name: "Carol Williams",
      party: "United Front",
      description: "Education reformer and economic development expert from rural India.",
    },
  ],
};

export default function VoteScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<string | undefined>(undefined);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isVoting, setIsVoting] = useState(false);

  const successColor = useThemeColor("success");
  const accentForegroundColor = useThemeColor("accent-foreground");
  const foregroundColor = useThemeColor("foreground");
  const mutedColor = useThemeColor("muted");

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      await new Promise((r) => setTimeout(r, 1200));
      setUser({
        userId: `user-${Date.now()}`,
        voterHash: `0x${Math.random().toString(16).slice(2, 10)}...${Math.random().toString(16).slice(2, 6)}`,
        hasVoted: false,
      });
    } catch (error: any) {
      Alert.alert("Login Failed", error.message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleVote = async () => {
    if (!user || !selectedCandidate) return;
    setIsVoting(true);
    try {
      await new Promise((r) => setTimeout(r, 1500));
      const voteHash = `0x${Math.random().toString(16).slice(2, 18)}`;
      setUser({ ...user, hasVoted: true });
      Alert.alert(
        "Vote Recorded",
        `Your vote has been committed to the blockchain.\n\nCommitment: ${voteHash}`,
        [{ text: "OK" }]
      );
    } catch (error: any) {
      Alert.alert("Vote Failed", error.message);
    } finally {
      setIsVoting(false);
    }
  };

  const selectedCandidateName = MOCK_ELECTION.candidates.find(
    (c) => c.id === selectedCandidate
  )?.name;

  return (
    <Container className="px-4">
      {/* Header */}
      <Animated.View entering={FadeInDown.delay(50).springify()} className="py-6 gap-1">
        <View className="flex-row items-center gap-2 mb-1">
          <Chip variant="secondary" color="success" size="sm">
            <View className="w-1.5 h-1.5 rounded-full bg-success mr-1" />
            <Chip.Label>Active</Chip.Label>
          </Chip>
          <Chip variant="secondary" color="default" size="sm">
            <Chip.Label>Ends {MOCK_ELECTION.endDate}</Chip.Label>
          </Chip>
        </View>
        <Text className="text-3xl font-bold text-foreground tracking-tight">
          {MOCK_ELECTION.title}
        </Text>
        <Text className="text-muted text-sm leading-relaxed mt-1">
          {MOCK_ELECTION.description}
        </Text>
      </Animated.View>

      {/* Auth Section */}
      <Animated.View entering={FadeInDown.delay(100).springify()}>
        {!user ? (
          <Surface variant="secondary" className="p-4 rounded-2xl mb-5">
            <View className="flex-row items-center gap-3 mb-4">
              <View className="w-10 h-10 rounded-full bg-accent items-center justify-center">
                <Ionicons name="shield-checkmark" size={20} color={accentForegroundColor} />
              </View>
              <View className="flex-1">
                <Text className="text-foreground font-semibold">Verify Your Identity</Text>
                <Text className="text-muted text-xs mt-0.5">
                  Authenticate securely via DigiLocker
                </Text>
              </View>
            </View>
            <Button
              variant="primary"
              className="w-full"
              onPress={handleLogin}
              isDisabled={isLoggingIn}
            >
              {isLoggingIn ? (
                <Spinner size="sm" color={accentForegroundColor} />
              ) : (
                <>
                  <Ionicons name="finger-print" size={18} color={accentForegroundColor} />
                  <Button.Label>Login with DigiLocker</Button.Label>
                </>
              )}
            </Button>
          </Surface>
        ) : (
          <Animated.View entering={FadeIn.springify()}>
            <Surface variant="secondary" className="p-4 rounded-2xl mb-5">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-3">
                  <View className="w-10 h-10 rounded-full bg-success/20 items-center justify-center">
                    <Ionicons name="checkmark-circle" size={22} color={successColor} />
                  </View>
                  <View>
                    <Text className="text-foreground font-semibold text-sm">
                      Identity Verified
                    </Text>
                    <Text className="text-muted text-xs mt-0.5" selectable>
                      {user.voterHash}
                    </Text>
                  </View>
                </View>
                <Chip
                  variant="soft"
                  color={user.hasVoted ? "success" : "warning"}
                  size="sm"
                >
                  <Chip.Label>{user.hasVoted ? "Voted" : "Pending"}</Chip.Label>
                </Chip>
              </View>
            </Surface>
          </Animated.View>
        )}
      </Animated.View>

      {/* Candidates Section */}
      <Animated.View entering={FadeInDown.delay(150).springify()} className="mb-5">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-foreground font-semibold text-base">Candidates</Text>
          <Text className="text-muted text-xs">
            {MOCK_ELECTION.candidates.length} candidates
          </Text>
        </View>

        <Surface variant="secondary" className="rounded-2xl overflow-hidden">
          <RadioGroup
            value={selectedCandidate}
            onValueChange={(val) => {
              if (user && !user.hasVoted) setSelectedCandidate(val);
            }}
            isDisabled={!user || user.hasVoted}
          >
            {MOCK_ELECTION.candidates.map((candidate, index) => (
              <View key={candidate.id}>
                <RadioGroup.Item
                  value={candidate.id}
                  className="px-4 py-3.5"
                >
                  <View className="flex-1 gap-0.5">
                    <View className="flex-row items-center gap-2">
                      <Label className="text-foreground font-medium text-sm">
                        {candidate.name}
                      </Label>
                      {candidate.party && (
                        <Chip variant="tertiary" color="default" size="sm">
                          <Chip.Label>{candidate.party}</Chip.Label>
                        </Chip>
                      )}
                    </View>
                    <Description className="text-xs leading-relaxed">
                      {candidate.description}
                    </Description>
                  </View>
                  <Radio />
                </RadioGroup.Item>
                {index < MOCK_ELECTION.candidates.length - 1 && (
                  <Separator className="mx-4" />
                )}
              </View>
            ))}
          </RadioGroup>
        </Surface>
      </Animated.View>

      {/* Vote Action */}
      {user && !user.hasVoted && (
        <Animated.View entering={FadeInDown.delay(200).springify()} className="mb-6 gap-3">
          {selectedCandidate && (
            <Animated.View entering={FadeIn.springify()}>
              <Surface variant="tertiary" className="p-3 rounded-xl">
                <View className="flex-row items-center gap-2">
                  <Ionicons name="checkmark-circle-outline" size={16} color={foregroundColor} />
                  <Text className="text-foreground text-sm">
                    Selected:{" "}
                    <Text className="font-semibold">{selectedCandidateName}</Text>
                  </Text>
                </View>
              </Surface>
            </Animated.View>
          )}

          <Button
            variant="primary"
            className="w-full"
            onPress={handleVote}
            isDisabled={!selectedCandidate || isVoting}
          >
            {isVoting ? (
              <>
                <Spinner size="sm" color={accentForegroundColor} />
                <Button.Label>Submitting to Blockchain...</Button.Label>
              </>
            ) : (
              <>
                <Ionicons name="shield-checkmark-outline" size={18} color={
                  selectedCandidate ? accentForegroundColor : mutedColor
                } />
                <Button.Label>Submit Vote Securely</Button.Label>
              </>
            )}
          </Button>

          <Text className="text-muted text-xs text-center">
            Your vote is encrypted and committed to Solana. You cannot change it after submission.
          </Text>
        </Animated.View>
      )}

      {/* Already Voted State */}
      {user?.hasVoted && (
        <Animated.View entering={ZoomIn.springify()} className="mb-6">
          <Card variant="secondary" className="rounded-2xl">
            <Card.Body className="items-center py-6 gap-3">
              <View className="w-16 h-16 rounded-full bg-success/20 items-center justify-center">
                <Ionicons name="checkmark-circle" size={36} color={successColor} />
              </View>
              <Card.Title className="text-center">Vote Submitted!</Card.Title>
              <Card.Description className="text-center text-sm leading-relaxed">
                Your anonymous vote has been recorded on the Solana blockchain. Thank you for
                participating.
              </Card.Description>
              <Chip variant="secondary" color="success">
                <Ionicons name="lock-closed" size={12} color={successColor} />
                <Chip.Label>Cryptographically Secured</Chip.Label>
              </Chip>
            </Card.Body>
          </Card>
        </Animated.View>
      )}
    </Container>
  );
}
