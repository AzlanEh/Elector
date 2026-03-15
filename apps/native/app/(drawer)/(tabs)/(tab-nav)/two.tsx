import { Ionicons } from "@expo/vector-icons";
import { Chip, Separator, Spinner, Surface, useThemeColor } from "heroui-native";
import { Pressable, ScrollView, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, LinearTransition } from "react-native-reanimated";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { orpc } from "@/utils/orpc";

type CandidateResult = {
  candidateId: string;
  candidateName: string;
  voteCount: number;
};

type ElectionResult = {
  electionId: string;
  electionTitle: string;
  endTime: Date | string;
  totalCommitments: number;
  results: CandidateResult[];
};

function ResultListCard({
  election,
  index,
}: {
  election: ElectionResult;
  index: number;
}) {
  const router = useRouter();
  const foregroundColor = useThemeColor("foreground");
  const mutedColor = useThemeColor("muted");
  const accentColor = useThemeColor("accent");
  const successColor = useThemeColor("success");

  const isLive = new Date(election.endTime) > new Date();
  const totalVotes = election.results.reduce((s, c) => s + c.voteCount, 0);
  const leader = election.results[0];
  const leadPercent =
    leader && totalVotes > 0
      ? Math.round((leader.voteCount / totalVotes) * 100)
      : 0;

  const endDate = new Date(election.endTime).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 60).springify()}
      layout={LinearTransition.springify()}
    >
      <Pressable
        onPress={() =>
          router.push({
            pathname: "/(drawer)/(tabs)/election/[id]" as any,
            params: { id: election.electionId },
          })
        }
        style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
      >
        <Surface
          variant="secondary"
          style={{
            borderRadius: 20,
            padding: 16,
            gap: 12,
            borderCurve: "continuous",
          }}
        >
          {/* Top row */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                backgroundColor: (isLive ? successColor : accentColor) + "20",
                alignItems: "center",
                justifyContent: "center",
                borderCurve: "continuous",
              }}
            >
              <Ionicons
                name={isLive ? "pulse-outline" : "bar-chart-outline"}
                size={22}
                color={isLive ? successColor : accentColor}
              />
            </View>

            <View style={{ flex: 1, gap: 3 }}>
              <Text
                style={{
                  color: foregroundColor,
                  fontSize: 16,
                  fontWeight: "700",
                  letterSpacing: -0.2,
                }}
                numberOfLines={1}
              >
                {election.electionTitle}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: isLive ? successColor : mutedColor,
                  }}
                />
                <Text style={{ color: mutedColor, fontSize: 12 }}>
                  {isLive ? `Live · Ends ${endDate}` : `Ended ${endDate}`}
                </Text>
              </View>
            </View>

            <Ionicons name="chevron-forward" size={18} color={mutedColor} />
          </View>

          <Separator />

          {/* Stats chips */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Chip variant="soft" color={isLive ? "success" : "default"} size="sm">
              <Chip.Label>{isLive ? "Live" : "Final"}</Chip.Label>
            </Chip>
            <Chip variant="soft" color="default" size="sm">
              <Chip.Label>
                {totalVotes.toLocaleString()} vote{totalVotes !== 1 ? "s" : ""}
              </Chip.Label>
            </Chip>
            {leader && totalVotes > 0 && (
              <Chip variant="soft" color="success" size="sm">
                <Ionicons name="trophy" size={10} color={successColor} />
                <Chip.Label>
                  {leader.candidateName.split(" ")[0]} {leadPercent}%
                </Chip.Label>
              </Chip>
            )}
          </View>
        </Surface>
      </Pressable>
    </Animated.View>
  );
}

export default function ResultsScreen() {
  const insets = useSafeAreaInsets();
  const foregroundColor = useThemeColor("foreground");
  const mutedColor = useThemeColor("muted");
  const accentColor = useThemeColor("accent");

  const backgroundColor = useThemeColor("background");

  const resultsQuery = useQuery(orpc.results.getAllResults.queryOptions());
  const allResults: ElectionResult[] =
    (resultsQuery.data as ElectionResult[] | undefined) ?? [];

  const sorted = [...allResults].sort((a, b) => {
    const now = new Date();
    const aLive = new Date(a.endTime) > now;
    const bLive = new Date(b.endTime) > now;
    if (aLive !== bLive) return aLive ? -1 : 1;
    return new Date(b.endTime).getTime() - new Date(a.endTime).getTime();
  });

  if (resultsQuery.isLoading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          paddingBottom: insets.bottom,
          backgroundColor,
        }}
      >
        <Spinner size="lg" />
        <Text style={{ color: mutedColor, fontSize: 13 }}>Loading results...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor }}
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingBottom: insets.bottom + 24,
        gap: 12,
      }}
    >
      {/* Header */}
      <Animated.View
        entering={FadeInDown.delay(40).springify()}
        style={{ paddingTop: 24, paddingBottom: 8, gap: 4 }}
      >
        <Text
          style={{
            fontSize: 32,
            fontWeight: "800",
            color: foregroundColor,
            letterSpacing: -0.8,
          }}
        >
          Results
        </Text>
        <Text style={{ color: mutedColor, fontSize: 14 }}>
          {sorted.length > 0
            ? `${sorted.length} election${sorted.length !== 1 ? "s" : ""}`
            : "No elections yet"}
        </Text>
      </Animated.View>

      {/* Empty state */}
      {sorted.length === 0 && (
        <Animated.View
          entering={FadeIn.delay(100).springify()}
          style={{ alignItems: "center", paddingVertical: 56, gap: 12 }}
        >
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 24,
              backgroundColor: accentColor + "15",
              alignItems: "center",
              justifyContent: "center",
              borderCurve: "continuous",
            }}
          >
            <Ionicons name="stats-chart-outline" size={40} color={accentColor} />
          </View>
          <Text
            style={{
              color: foregroundColor,
              fontWeight: "700",
              fontSize: 18,
              marginTop: 4,
            }}
          >
            No Results Yet
          </Text>
          <Text
            style={{
              color: mutedColor,
              fontSize: 14,
              textAlign: "center",
              lineHeight: 20,
              maxWidth: 260,
            }}
          >
            Results will appear here once elections have been created.
          </Text>
        </Animated.View>
      )}

      {/* Election cards */}
      {sorted.map((election, index) => (
        <ResultListCard key={election.electionId} election={election} index={index} />
      ))}
    </ScrollView>
  );
}
