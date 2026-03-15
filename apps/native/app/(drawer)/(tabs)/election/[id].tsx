import { Ionicons } from "@expo/vector-icons";
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
import { Alert, Linking, Pressable, ScrollView, Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  LinearTransition,
  ZoomIn,
} from "react-native-reanimated";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, Stack } from "expo-router";
import { useURL } from "expo-linking";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { orpc } from "@/utils/orpc";

const REDIRECT_URI = "elector://auth/callback";

type User = {
  userId: string;
  voterHash: string;
  hasVoted: boolean;
};

// ─── Candidate Result Bar ─────────────────────────────────────────────────────

function CandidateBar({
  name,
  rank,
  voteCount,
  totalVotes,
  isWinner,
  index,
}: {
  name: string;
  rank: number;
  voteCount: number;
  totalVotes: number;
  isWinner: boolean;
  index: number;
}) {
  const foregroundColor = useThemeColor("foreground");
  const mutedColor = useThemeColor("muted");
  const accentColor = useThemeColor("accent");
  const successColor = useThemeColor("success");

  const percent = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
  const barColor = isWinner ? successColor : accentColor;

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50).springify()}
      layout={LinearTransition.springify()}
    >
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}>
        {/* Name row */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              backgroundColor: isWinner ? successColor + "25" : foregroundColor + "12",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {isWinner ? (
              <Ionicons name="trophy" size={13} color={successColor} />
            ) : (
              <Text
                style={{
                  color: foregroundColor,
                  fontSize: 11,
                  fontWeight: "700",
                  fontVariant: ["tabular-nums"],
                }}
              >
                {rank}
              </Text>
            )}
          </View>
          <Text
            style={{
              flex: 1,
              color: foregroundColor,
              fontSize: 14,
              fontWeight: isWinner ? "700" : "500",
            }}
          >
            {name}
          </Text>
          <View style={{ alignItems: "flex-end", gap: 1 }}>
            <Text
              style={{
                color: foregroundColor,
                fontSize: 15,
                fontWeight: "700",
                fontVariant: ["tabular-nums"],
              }}
            >
              {percent}%
            </Text>
            <Text
              style={{
                color: mutedColor,
                fontSize: 11,
                fontVariant: ["tabular-nums"],
              }}
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
              width: `${percent}%`,
              backgroundColor: barColor,
              borderRadius: 3,
            }}
          />
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ElectionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [user, setUser] = useState<User | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<string | undefined>();

  const foregroundColor = useThemeColor("foreground");
  const mutedColor = useThemeColor("muted");
  const accentColor = useThemeColor("accent");
  const accentForegroundColor = useThemeColor("accent-foreground");
  const successColor = useThemeColor("success");
  const backgroundColor = useThemeColor("background");

  // Data fetching
  const electionQuery = useQuery(
    orpc.elections.getById.queryOptions({ input: { electionId: id } })
  );
  const resultsQuery = useQuery(
    orpc.results.getAllResults.queryOptions()
  );

  const submitVote = useMutation(orpc.vote.submit.mutationOptions());
  const getAuthUrl = useMutation(orpc.auth.getAuthUrl.mutationOptions());
  const authCallback = useMutation(orpc.auth.callback.mutationOptions());

  const isLoggingIn = getAuthUrl.isPending || authCallback.isPending;
  const isVoting = submitVote.isPending;

  // Handle OAuth deep-link callback
  const url = useURL();
  if (url && !user && !authCallback.isPending) {
    const parsed = new URL(url);
    if (parsed.hostname === "auth" && parsed.pathname === "/callback") {
      const code = parsed.searchParams.get("code");
      if (code) {
        authCallback.mutate(
          { code, redirectUri: REDIRECT_URI } as any,
          {
            onSuccess: (data: any) => {
              setUser({ userId: data.userId, voterHash: data.voterHash, hasVoted: false });
            },
            onError: (error: any) => Alert.alert("Login Failed", error.message),
          }
        );
      }
    }
  }

  const handleLogin = () => {
    getAuthUrl.mutate(
      { redirectUri: REDIRECT_URI } as any,
      {
        onSuccess: (data: any) => {
          const authUrl = data.authUrl;
          if (authUrl.startsWith("elector://")) {
            const parsed = new URL(authUrl);
            const code = parsed.searchParams.get("code");
            if (code) {
              authCallback.mutate(
                { code, redirectUri: REDIRECT_URI } as any,
                {
                  onSuccess: (cbData: any) => {
                    setUser({ userId: cbData.userId, voterHash: cbData.voterHash, hasVoted: false });
                  },
                  onError: (error: any) => Alert.alert("Login Failed", error.message),
                }
              );
            }
            return;
          }
          Linking.openURL(authUrl).catch(() =>
            Alert.alert("Login Failed", "Could not open DigiLocker.")
          );
        },
        onError: (error: any) => Alert.alert("Login Failed", error.message),
      }
    );
  };

  const handleVote = () => {
    if (!user || !selectedCandidate) return;
    submitVote.mutate(
      { userId: user.userId, candidateId: selectedCandidate, voterHash: user.voterHash } as any,
      {
        onSuccess: (data: any) => {
          queryClient.invalidateQueries({
            queryKey: orpc.results.getAllResults.queryOptions().queryKey,
          });
          setUser((u) => (u ? { ...u, hasVoted: true } : u));
          Alert.alert(
            "Vote Recorded",
            `Your vote is committed to the Solana blockchain.\n\nCommitment: ${data.commitment.slice(0, 16)}...`,
            [{ text: "OK" }]
          );
        },
        onError: (error: any) => Alert.alert("Vote Failed", error.message),
      }
    );
  };

  const election = electionQuery.data as any;
  const allResults: any[] = (resultsQuery.data as any[] | undefined) ?? [];
  const electionResult = allResults.find((r) => r.electionId === id);

  const candidates: any[] = election?.candidates ?? [];
  const results: any[] = electionResult?.results ?? [];
  const totalVotes: number = results.reduce((s: number, c: any) => s + c.voteCount, 0);
  const isLive = election ? new Date(election.endTime) > new Date() : false;

  const endDate = election
    ? new Date(election.endTime).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "";

  const selectedCandidateName = candidates.find((c) => c.id === selectedCandidate)?.name;

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
      <Stack.Screen options={{ title: election.title }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 32,
          gap: 20,
        }}
      >
        {/* ── Hero card ── */}
        <Animated.View entering={FadeInDown.delay(40).springify()} style={{ paddingTop: 20 }}>
          <Surface
            variant="secondary"
            style={{ borderRadius: 24, padding: 20, gap: 14, borderCurve: "continuous" }}
          >
            {/* Status row */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Chip variant="soft" color={isLive ? "success" : "default"} size="sm">
                <Chip.Label>{isLive ? "Live" : "Closed"}</Chip.Label>
              </Chip>
              <Chip variant="soft" color="default" size="sm">
                <Chip.Label>{candidates.length} candidates</Chip.Label>
              </Chip>
              {totalVotes > 0 && (
                <Chip variant="soft" color="default" size="sm">
                  <Chip.Label>{totalVotes.toLocaleString()} votes</Chip.Label>
                </Chip>
              )}
            </View>

            {election.description && (
              <Text style={{ color: mutedColor, fontSize: 14, lineHeight: 20 }}>
                {election.description}
              </Text>
            )}

            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="calendar-outline" size={13} color={mutedColor} />
              <Text style={{ color: mutedColor, fontSize: 12 }}>
                {isLive ? `Ends ${endDate}` : `Ended ${endDate}`}
              </Text>
            </View>
          </Surface>
        </Animated.View>

        {/* ── VOTING SECTION (only for live elections) ── */}
        {isLive && (
          <Animated.View entering={FadeInDown.delay(80).springify()} style={{ gap: 14 }}>
            {/* Section heading */}
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

            {/* Auth gate */}
            {!user ? (
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
                      backgroundColor: accentColor + "20",
                      alignItems: "center",
                      justifyContent: "center",
                      borderCurve: "continuous",
                    }}
                  >
                    <Ionicons name="shield-checkmark-outline" size={22} color={accentColor} />
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={{ color: foregroundColor, fontWeight: "600", fontSize: 14 }}>
                      Verify identity to vote
                    </Text>
                    <Text style={{ color: mutedColor, fontSize: 12 }}>
                      Authenticate once to participate in this election
                    </Text>
                  </View>
                  <Button
                    variant="primary"
                    size="sm"
                    onPress={handleLogin}
                    isDisabled={isLoggingIn}
                  >
                    {isLoggingIn ? (
                      <Spinner size="sm" color={accentForegroundColor} />
                    ) : (
                      <Button.Label>Login</Button.Label>
                    )}
                  </Button>
                </Surface>
              </Animated.View>
            ) : user.hasVoted ? (
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
                  <Ionicons name="checkmark-circle" size={28} color={successColor} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={{ color: foregroundColor, fontWeight: "700", fontSize: 15 }}>
                      Vote Submitted
                    </Text>
                    <Text style={{ color: mutedColor, fontSize: 12 }}>
                      Your anonymous vote is secured on Solana.
                    </Text>
                  </View>
                </Surface>
              </Animated.View>
            ) : (
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
                        Identity Verified
                      </Text>
                      <Text
                        selectable
                        numberOfLines={1}
                        style={{ color: mutedColor, fontSize: 11, marginTop: 1 }}
                      >
                        {user.voterHash}
                      </Text>
                    </View>
                  </View>
                </Animated.View>

                {/* Candidate radio list */}
                <Surface
                  variant="secondary"
                  style={{ borderRadius: 20, overflow: "hidden", borderCurve: "continuous" }}
                >
                  <RadioGroup
                    value={selectedCandidate}
                    onValueChange={(val) => setSelectedCandidate(val)}
                    isDisabled={isVoting}
                  >
                    {candidates.map((candidate, i) => (
                      <View key={candidate.id}>
                        <RadioGroup.Item value={candidate.id} className="px-4 py-3.5">
                          <View style={{ flex: 1, gap: 2 }}>
                            <Text
                              style={{
                                color: foregroundColor,
                                fontSize: 15,
                                fontWeight: "500",
                              }}
                            >
                              {candidate.name}
                            </Text>
                            {candidate.description && (
                              <Text style={{ color: mutedColor, fontSize: 12 }}>
                                {candidate.description}
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

                {/* Selected preview */}
                {selectedCandidate && (
                  <Animated.View entering={FadeInDown.duration(200).springify()}>
                    <View
                      style={{
                        backgroundColor: foregroundColor + "08",
                        borderRadius: 12,
                        padding: 12,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        borderCurve: "continuous",
                      }}
                    >
                      <Ionicons name="checkmark-circle-outline" size={16} color={accentColor} />
                      <Text style={{ color: foregroundColor, fontSize: 13 }}>
                        Selected:{" "}
                        <Text style={{ fontWeight: "700" }}>{selectedCandidateName}</Text>
                      </Text>
                    </View>
                  </Animated.View>
                )}

                {/* Submit button */}
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
                      <Ionicons
                        name="shield-checkmark-outline"
                        size={17}
                        color={selectedCandidate ? accentForegroundColor : mutedColor}
                      />
                      <Button.Label>Submit Vote Securely</Button.Label>
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
                  Your vote is encrypted and committed to Solana. This cannot be undone.
                </Text>
              </>
            )}
          </Animated.View>
        )}

        {/* ── RESULTS SECTION ── */}
        <Animated.View entering={FadeInDown.delay(120).springify()} style={{ gap: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text
              style={{
                color: foregroundColor,
                fontSize: 20,
                fontWeight: "800",
                letterSpacing: -0.4,
              }}
            >
              {isLive ? "Live Tally" : "Final Results"}
            </Text>
            {resultsQuery.isLoading && <Spinner size="sm" />}
          </View>

          {results.length === 0 ? (
            <Surface
              variant="secondary"
              style={{
                borderRadius: 20,
                padding: 24,
                alignItems: "center",
                gap: 10,
                borderCurve: "continuous",
              }}
            >
              <Ionicons name="stats-chart-outline" size={36} color={mutedColor} />
              <Text style={{ color: mutedColor, fontSize: 14, textAlign: "center" }}>
                {totalVotes === 0
                  ? "No votes recorded yet."
                  : "Results will be available once the election ends."}
              </Text>
            </Surface>
          ) : (
            <Surface
              variant="secondary"
              style={{ borderRadius: 20, overflow: "hidden", borderCurve: "continuous" }}
            >
              {results.map((candidate, i) => (
                <View key={candidate.candidateId}>
                  <CandidateBar
                    name={candidate.candidateName}
                    rank={i + 1}
                    voteCount={candidate.voteCount}
                    totalVotes={totalVotes}
                    isWinner={i === 0 && totalVotes > 0}
                    index={i}
                  />
                  {i < results.length - 1 && (
                    <Separator style={{ marginHorizontal: 16 }} />
                  )}
                </View>
              ))}
            </Surface>
          )}
        </Animated.View>

        {/* ── Blockchain transparency note ── */}
        <Animated.View entering={FadeInDown.delay(160).springify()}>
          <Surface
            variant="tertiary"
            style={{
              borderRadius: 16,
              padding: 14,
              flexDirection: "row",
              alignItems: "flex-start",
              gap: 10,
              borderCurve: "continuous",
            }}
          >
            <Ionicons name="lock-closed-outline" size={15} color={mutedColor} />
            <Text style={{ color: mutedColor, fontSize: 12, flex: 1, lineHeight: 18 }}>
              Results are tallied from cryptographic vote commitments stored on the Solana
              blockchain. Voter identities remain fully anonymous.
            </Text>
          </Surface>
        </Animated.View>
      </ScrollView>
    </>
  );
}
