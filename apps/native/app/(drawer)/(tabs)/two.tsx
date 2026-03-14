import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Button, Card, Chip, Separator, Surface, useThemeColor } from "heroui-native";
import { Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Container } from "@/components/container";

const MOCK_RESULTS = [
  { id: "candidate-1", name: "Alice Johnson", party: "Progress Party", votes: 2847, percent: 42 },
  { id: "candidate-2", name: "Bob Smith", party: "Green Alliance", votes: 2104, percent: 31 },
  { id: "candidate-3", name: "Carol Williams", party: "United Front", votes: 1849, percent: 27 },
];
const TOTAL_VOTES = MOCK_RESULTS.reduce((sum, c) => sum + c.votes, 0);

const PARTY_COLORS: Record<string, string> = {
  "Progress Party": "accent",
  "Green Alliance": "success",
  "United Front": "warning",
};

export default function ResultsScreen() {
  const accentForegroundColor = useThemeColor("accent-foreground");
  const successColor = useThemeColor("success");
  const foregroundColor = useThemeColor("foreground");

  const winner = MOCK_RESULTS[0];

  return (
    <Container className="px-4">
      {/* Header */}
      <Animated.View entering={FadeInDown.delay(50).springify()} className="py-6 gap-1">
        <Text className="text-3xl font-bold text-foreground tracking-tight">Results</Text>
        <Text className="text-muted text-sm">General Election 2024 · Live Tally</Text>
      </Animated.View>

      {/* Stats Row */}
      <Animated.View
        entering={FadeInDown.delay(100).springify()}
        className="flex-row gap-3 mb-5"
      >
        <Surface variant="secondary" className="flex-1 p-4 rounded-2xl items-center gap-1">
          <Text className="text-2xl font-bold text-foreground">
            {TOTAL_VOTES.toLocaleString()}
          </Text>
          <Text className="text-muted text-xs">Total Votes</Text>
        </Surface>
        <Surface variant="secondary" className="flex-1 p-4 rounded-2xl items-center gap-1">
          <Text className="text-2xl font-bold text-foreground">
            {MOCK_RESULTS.length}
          </Text>
          <Text className="text-muted text-xs">Candidates</Text>
        </Surface>
        <Surface variant="secondary" className="flex-1 p-4 rounded-2xl items-center gap-1">
          <Chip variant="soft" color="success" size="sm">
            <Chip.Label>Live</Chip.Label>
          </Chip>
          <Text className="text-muted text-xs">Status</Text>
        </Surface>
      </Animated.View>

      {/* Winner Card */}
      <Animated.View entering={FadeInDown.delay(130).springify()} className="mb-5">
        <Card variant="secondary" className="rounded-2xl overflow-hidden">
          <Card.Body className="gap-3">
            <View className="flex-row items-center gap-2">
              <Ionicons name="trophy" size={16} color={successColor} />
              <Text className="text-muted text-xs font-medium uppercase tracking-widest">
                Leading
              </Text>
            </View>
            <View className="flex-row items-center justify-between">
              <View className="gap-0.5">
                <Card.Title className="text-xl">{winner.name}</Card.Title>
                <Card.Description>{winner.party}</Card.Description>
              </View>
              <View className="items-end gap-1">
                <Text className="text-3xl font-bold text-foreground">{winner.percent}%</Text>
                <Text className="text-muted text-xs">{winner.votes.toLocaleString()} votes</Text>
              </View>
            </View>
            {/* Progress bar */}
            <View className="h-2 bg-default/30 rounded-full overflow-hidden">
              <Animated.View
                className="h-full bg-success rounded-full"
                style={{ width: `${winner.percent}%` }}
              />
            </View>
          </Card.Body>
        </Card>
      </Animated.View>

      {/* All Candidates */}
      <Animated.View entering={FadeInDown.delay(160).springify()} className="mb-5">
        <Text className="text-foreground font-semibold text-sm mb-3">All Candidates</Text>
        <Surface variant="secondary" className="rounded-2xl overflow-hidden">
          {MOCK_RESULTS.map((candidate, index) => (
            <View key={candidate.id}>
              <View className="px-4 py-3.5 gap-2.5">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2.5 flex-1">
                    <View className="w-7 h-7 rounded-full bg-default/30 items-center justify-center">
                      <Text className="text-foreground text-xs font-bold">{index + 1}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-foreground font-medium text-sm">{candidate.name}</Text>
                      <Text className="text-muted text-xs">{candidate.party}</Text>
                    </View>
                  </View>
                  <View className="items-end gap-0.5">
                    <Text className="text-foreground font-semibold text-sm">
                      {candidate.percent}%
                    </Text>
                    <Text className="text-muted text-xs">
                      {candidate.votes.toLocaleString()}
                    </Text>
                  </View>
                </View>
                {/* Bar */}
                <View className="h-1.5 bg-default/20 rounded-full overflow-hidden">
                  <View
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${candidate.percent}%` }}
                  />
                </View>
              </View>
              {index < MOCK_RESULTS.length - 1 && <Separator className="mx-4" />}
            </View>
          ))}
        </Surface>
      </Animated.View>

      {/* Transparency Note */}
      <Animated.View entering={FadeInDown.delay(200).springify()} className="mb-8">
        <Surface variant="tertiary" className="p-4 rounded-2xl">
          <View className="flex-row items-start gap-3">
            <Ionicons name="lock-closed-outline" size={16} color={foregroundColor} />
            <Text className="text-muted text-xs flex-1 leading-relaxed">
              Results are tallied from cryptographic vote commitments stored on the Solana
              blockchain. Voter identities remain fully anonymous.
            </Text>
          </View>
        </Surface>
      </Animated.View>
    </Container>
  );
}
