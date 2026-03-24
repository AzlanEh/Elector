import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  Button,
  Chip,
  Radio,
  RadioGroup,
  Separator,
  Spinner,
  Surface,
  useThemeColor,
} from "heroui-native";
import { useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  LinearTransition,
  ZoomIn,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useIdentity } from "@/hooks/useIdentity";
import { orpc } from "@/utils/orpc";

// ─── Result Bar ────────────────────────────────────────────────────────────────

function ResultBar({
  name,
  party,
  rank,
  voteCount,
  percentage,
  isWinner,
  isVotedFor,
  index,
}: {
  name: string;
  party: string | null;
  rank: number;
  voteCount: number;
  percentage: number;
  isWinner: boolean;
  isVotedFor: boolean;
  index: number;
}) {
  const foregroundColor = useThemeColor("foreground");
  const mutedColor = useThemeColor("muted");
  const accentColor = useThemeColor("accent");
  const successColor = useThemeColor("success");

  const barColor = isWinner ? successColor : accentColor;

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50).springify()}
      layout={LinearTransition.springify()}
    >
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          {/* Rank / trophy */}
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: isWinner ? successColor + "25" : foregroundColor + "10",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {isWinner ? (
              <Ionicons name="trophy" size={13} color={successColor} />
            ) : (
              <Text
                style={{ color: foregroundColor, fontSize: 11, fontWeight: "700" }}
              >
                {rank}
              </Text>
            )}
          </View>

          {/* Name + party */}
          <View style={{ flex: 1, gap: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text
                style={{
                  color: foregroundColor,
                  fontSize: 14,
                  fontWeight: isWinner ? "700" : "500",
                }}
              >
                {name}
              </Text>
              {isVotedFor && (
                <View
                  style={{
                    backgroundColor: accentColor + "20",
                    borderRadius: 6,
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                  }}
                >
                  <Text style={{ color: accentColor, fontSize: 10, fontWeight: "700" }}>
                    Your vote
                  </Text>
                </View>
              )}
            </View>
            {party && (
              <Text style={{ color: mutedColor, fontSize: 11 }}>{party}</Text>
            )}
          </View>

          {/* Percentage + count */}
          <View style={{ alignItems: "flex-end", gap: 1 }}>
            <Text
              style={{
                color: foregroundColor,
                fontSize: 15,
                fontWeight: "700",
                fontVariant: ["tabular-nums"],
              }}
            >
              {percentage}%
            </Text>
            <Text
              style={{ color: mutedColor, fontSize: 11, fontVariant: ["tabular-nums"] }}
            >
              {voteCount.toLocaleString()} votes
            </Text>
          </View>
        </View>

        {/* Progress bar */}
        <View
          style={{
            height: 6,
            backgroundColor: foregroundColor + "12",
            borderRadius: 3,
            overflow: "hidden",
          }}
        >
          <Animated.View
            entering={FadeIn.delay(index * 50 + 100).springify()}
            style={{
              height: "100%",
              width: `${percentage}%`,
              backgroundColor: barColor,
              borderRadius: 3,
            }}
          />
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function ElectionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { identity } = useIdentity();

  const [selectedCandidate, setSelectedCandidate] = useState<string | undefined>();

  const foregroundColor = useThemeColor("foreground");
  const mutedColor = useThemeColor("muted");
  const accentColor = useThemeColor("accent");
  const accentForegroundColor = useThemeColor("accent-foreground");
  const successColor = useThemeColor("success");
  const dangerColor = useThemeColor("danger");
  const backgroundColor = useThemeColor("background");

  // ── Data ────────────────────────────────────────────────────────────────────

  const electionQuery = useQuery(
    orpc.elections.getById.queryOptions({ input: { electionId: id } })
  );

  const resultsQuery = useQuery(
    orpc.results.getByElection.queryOptions({ input: { electionId: id } })
  );

  const hasVotedQuery = useQuery(
    orpc.vote.hasVoted.queryOptions({
      input: { electionId: id },
      enabled: !!identity?.voterToken,
    })
  );

  const submitVote = useMutation(orpc.vote.submit.mutationOptions());

  // ── Derived ─────────────────────────────────────────────────────────────────

  const election = electionQuery.data as any;
  const candidates: any[] = election?.candidates ?? [];
  const results: any[] = (resultsQuery.data as any)?.results ?? [];
  const totalVotes: number = (resultsQuery.data as any)?.totalVotes ?? 0;

  const now = new Date();
  const isLive = election
    ? now >= new Date(election.startTime) && now <= new Date(election.endTime)
    : false;
  const isUpcoming = election ? now < new Date(election.startTime) : false;

  const hasVoted = hasVotedQuery.data?.hasVoted ?? false;
  const votedCandidateId = hasVotedQuery.data?.votedCandidateId ?? null;

  const endDate = election
    ? new Date(election.endTime).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  const startDate = election
    ? new Date(election.startTime).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleVote = () => {
    if (!identity || !selectedCandidate) return;
    submitVote.mutate(
        {
          electionId: id,
          candidateId: selectedCandidate,
        },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: orpc.results.getByElection.queryOptions({
              input: { electionId: id },
            }).queryKey,
          });
          queryClient.invalidateQueries({
            queryKey: orpc.vote.hasVoted.queryOptions({
              input: { electionId: id },
            }).queryKey,
          });
          queryClient.invalidateQueries({
            queryKey: orpc.elections.list.queryOptions().queryKey,
          });
          Alert.alert("Vote Submitted", "Your vote has been recorded successfully.", [
            { text: "OK" },
          ]);
        },
        onError: (error: any) => Alert.alert("Vote Failed", error.message),
      }
    );
  };

  // ── Loading / error ──────────────────────────────────────────────────────────

  if (electionQuery.isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor }}>
        <Stack.Screen options={{ title: "Election" }} />
        <Spinner size="lg" />
        <Text style={{ color: mutedColor, fontSize: 13 }}>Loading...</Text>
      </View>
    );
  }

  if (!election) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 8, backgroundColor }}>
        <Stack.Screen options={{ title: "Election" }} />
        <Ionicons name="alert-circle-outline" size={40} color={mutedColor} />
        <Text style={{ color: foregroundColor, fontWeight: "600", fontSize: 16 }}>
          Election Not Found
        </Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: election.title, headerBackTitle: "Elections" }} />
      <ScrollView
        style={{ backgroundColor }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 36,
          gap: 20,
        }}
      >
        {/* ── Hero card ───────────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(40).springify()} style={{ paddingTop: 20 }}>
          <Surface
            variant="secondary"
            style={{ borderRadius: 24, padding: 20, gap: 14, borderCurve: "continuous" }}
          >
            {/* Status row */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {isLive && (
                <Chip variant="soft" color="success" size="sm">
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: successColor,
                      marginRight: 4,
                    }}
                  />
                  <Chip.Label>Live</Chip.Label>
                </Chip>
              )}
              {isUpcoming && (
                <Chip variant="soft" color="default" size="sm">
                  <Chip.Label>Upcoming</Chip.Label>
                </Chip>
              )}
              {!isLive && !isUpcoming && (
                <Chip variant="soft" color="default" size="sm">
                  <Chip.Label>Ended</Chip.Label>
                </Chip>
              )}
              <Chip variant="soft" color="default" size="sm">
                <Chip.Label>{candidates.length} candidates</Chip.Label>
              </Chip>
              <Chip variant="soft" color="default" size="sm">
                <Ionicons name="people-outline" size={11} color={mutedColor} />
                <Chip.Label> {totalVotes.toLocaleString()} votes</Chip.Label>
              </Chip>
            </View>

            {election.description && (
              <Text style={{ color: mutedColor, fontSize: 14, lineHeight: 20 }}>
                {election.description}
              </Text>
            )}

            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="calendar-outline" size={13} color={mutedColor} />
              <Text style={{ color: mutedColor, fontSize: 12 }}>
                {isUpcoming
                  ? `Starts ${startDate}`
                  : isLive
                    ? `Ends ${endDate}`
                    : `Ended ${endDate}`}
              </Text>
            </View>
          </Surface>
        </Animated.View>

        {/* ── Voting section (live elections only) ────────────────────────── */}
        {isLive && (
          <Animated.View entering={FadeInDown.delay(80).springify()} style={{ gap: 14 }}>
            <Text
              style={{
                color: foregroundColor,
                fontSize: 20,
                fontWeight: "800",
                letterSpacing: -0.4,
              }}
            >
              Cast Your Vote
            </Text>

            {/* Not verified */}
            {!identity ? (
              <Animated.View entering={FadeIn.springify()}>
                <Surface
                  variant="secondary"
                  style={{
                    borderRadius: 20,
                    padding: 16,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 14,
                    borderCurve: "continuous",
                  }}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      backgroundColor: dangerColor + "20",
                      alignItems: "center",
                      justifyContent: "center",
                      borderCurve: "continuous",
                    }}
                  >
                    <Ionicons name="shield-outline" size={22} color={dangerColor} />
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={{ color: foregroundColor, fontWeight: "600", fontSize: 14 }}>
                      Identity Required
                    </Text>
                    <Text style={{ color: mutedColor, fontSize: 12 }}>
                      Verify your Aadhaar identity to vote
                    </Text>
                  </View>
                  <Button
                    variant="primary"
                    size="sm"
                    onPress={() => router.push("/(drawer)/profile")}
                  >
                    <Button.Label>Verify</Button.Label>
                  </Button>
                </Surface>
              </Animated.View>
            ) : hasVoted ? (
              /* Already voted */
              <Animated.View entering={ZoomIn.springify()}>
                <Surface
                  variant="secondary"
                  style={{
                    borderRadius: 20,
                    padding: 16,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 14,
                    backgroundColor: successColor + "15",
                    borderCurve: "continuous",
                  }}
                >
                  <Ionicons name="checkmark-circle" size={32} color={successColor} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={{ color: foregroundColor, fontWeight: "700", fontSize: 15 }}>
                      Vote Submitted
                    </Text>
                    <Text style={{ color: mutedColor, fontSize: 12 }}>
                      Your vote has been securely recorded.
                    </Text>
                  </View>
                </Surface>
              </Animated.View>
            ) : (
              /* Voting form */
              <>
                {/* Identity badge */}
                <Animated.View entering={FadeIn.springify()}>
                  <View
                    style={{
                      borderRadius: 14,
                      padding: 12,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      backgroundColor: accentColor + "15",
                      borderCurve: "continuous",
                    }}
                  >
                    <Ionicons name="checkmark-circle" size={18} color={accentColor} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: foregroundColor, fontWeight: "600", fontSize: 13 }}>
                        Voting as {identity.displayName}
                      </Text>
                      <Text style={{ color: mutedColor, fontSize: 11, marginTop: 1 }}>
                        Identity verified via Aadhaar
                      </Text>
                    </View>
                  </View>
                </Animated.View>

                {/* Candidate list */}
                <Surface
                  variant="secondary"
                  style={{ borderRadius: 20, overflow: "hidden", borderCurve: "continuous" }}
                >
                  <RadioGroup
                    value={selectedCandidate}
                    onValueChange={(val) => setSelectedCandidate(val)}
                    isDisabled={submitVote.isPending}
                  >
                    {candidates.map((candidate, i) => (
                      <View key={candidate.id}>
                        <RadioGroup.Item value={candidate.id} className="px-4 py-3.5">
                          <View style={{ flex: 1, gap: 2 }}>
                            <Text
                              style={{ color: foregroundColor, fontSize: 15, fontWeight: "500" }}
                            >
                              {candidate.name}
                            </Text>
                            {(candidate.party || candidate.description) && (
                              <Text style={{ color: mutedColor, fontSize: 12 }}>
                                {candidate.party
                                  ? candidate.party
                                  : candidate.description}
                              </Text>
                            )}
                          </View>
                          <Radio />
                        </RadioGroup.Item>
                        {i < candidates.length - 1 && <Separator className="mx-4" />}
                      </View>
                    ))}
                  </RadioGroup>
                </Surface>

                {/* Submit */}
                <Button
                  variant="primary"
                  className="w-full"
                  onPress={handleVote}
                  isDisabled={!selectedCandidate || submitVote.isPending}
                >
                  {submitVote.isPending ? (
                    <>
                      <Spinner size="sm" color={accentForegroundColor} />
                      <Button.Label>Submitting...</Button.Label>
                    </>
                  ) : (
                    <>
                      <Ionicons
                        name="checkmark-done-outline"
                        size={17}
                        color={selectedCandidate ? accentForegroundColor : mutedColor}
                      />
                      <Button.Label>Submit Vote</Button.Label>
                    </>
                  )}
                </Button>

                <Text
                  style={{
                    color: mutedColor,
                    fontSize: 11,
                    textAlign: "center",
                    lineHeight: 16,
                  }}
                >
                  You can only vote once per election. This action cannot be undone.
                </Text>
              </>
            )}
          </Animated.View>
        )}

        {/* ── Candidates (upcoming) ────────────────────────────────────────── */}
        {isUpcoming && (
          <Animated.View entering={FadeInDown.delay(80).springify()} style={{ gap: 14 }}>
            <Text
              style={{
                color: foregroundColor,
                fontSize: 20,
                fontWeight: "800",
                letterSpacing: -0.4,
              }}
            >
              Candidates
            </Text>
            <Surface
              variant="secondary"
              style={{ borderRadius: 20, overflow: "hidden", borderCurve: "continuous" }}
            >
              {candidates.map((c, i) => (
                <View key={c.id}>
                  <View style={{ padding: 16, gap: 3 }}>
                    <Text
                      style={{ color: foregroundColor, fontSize: 15, fontWeight: "600" }}
                    >
                      {c.name}
                    </Text>
                    {(c.party || c.description) && (
                      <Text style={{ color: mutedColor, fontSize: 13 }}>
                        {c.party ?? c.description}
                      </Text>
                    )}
                  </View>
                  {i < candidates.length - 1 && <Separator style={{ marginHorizontal: 16 }} />}
                </View>
              ))}
            </Surface>
          </Animated.View>
        )}

        {/* ── Results section ──────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(120).springify()} style={{ gap: 14 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text
              style={{
                color: foregroundColor,
                fontSize: 20,
                fontWeight: "800",
                letterSpacing: -0.4,
              }}
            >
              {isLive ? "Live Tally" : "Results"}
            </Text>
            {resultsQuery.isFetching && <Spinner size="sm" />}
          </View>

          {results.length === 0 || totalVotes === 0 ? (
            <Surface
              variant="secondary"
              style={{
                borderRadius: 20,
                padding: 28,
                alignItems: "center",
                gap: 10,
                borderCurve: "continuous",
              }}
            >
              <Ionicons name="stats-chart-outline" size={36} color={mutedColor} />
              <Text style={{ color: mutedColor, fontSize: 14, textAlign: "center" }}>
                No votes recorded yet.
              </Text>
            </Surface>
          ) : (
            <Surface
              variant="secondary"
              style={{ borderRadius: 20, overflow: "hidden", borderCurve: "continuous" }}
            >
              {results.map((r, i) => (
                <View key={r.candidateId}>
                  <ResultBar
                    name={r.candidateName}
                    party={r.party}
                    rank={i + 1}
                    voteCount={r.voteCount}
                    percentage={r.percentage}
                    isWinner={i === 0 && totalVotes > 0}
                    isVotedFor={r.candidateId === votedCandidateId}
                    index={i}
                  />
                  {i < results.length - 1 && (
                    <Separator style={{ marginHorizontal: 16 }} />
                  )}
                </View>
              ))}
              {/* Total */}
              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: foregroundColor + "10",
                  padding: 14,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text style={{ color: mutedColor, fontSize: 12 }}>Total votes</Text>
                <Text
                  style={{
                    color: foregroundColor,
                    fontSize: 13,
                    fontWeight: "700",
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {totalVotes.toLocaleString()}
                </Text>
              </View>
            </Surface>
          )}
        </Animated.View>
      </ScrollView>
    </>
  );
}
