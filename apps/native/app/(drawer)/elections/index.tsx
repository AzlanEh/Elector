import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Chip, Separator, Spinner, Surface, useThemeColor } from "heroui-native";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { orpc } from "@/utils/orpc";

type Candidate = { id: string; name: string; description: string | null; party: string | null };
type Election = {
  id: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  candidates: Candidate[];
  _count: { votes: number };
};

function ElectionStatusChip({ election }: { election: Election }) {
  const now = new Date();
  const start = new Date(election.startTime);
  const end = new Date(election.endTime);

  if (now < start)
    return (
      <Chip variant="soft" color="default" size="sm">
        <Chip.Label>Upcoming</Chip.Label>
      </Chip>
    );
  if (now > end)
    return (
      <Chip variant="soft" color="default" size="sm">
        <Chip.Label>Ended</Chip.Label>
      </Chip>
    );
  return (
    <Chip variant="soft" color="success" size="sm">
      <Chip.Label>Live</Chip.Label>
    </Chip>
  );
}

function ElectionCard({ election, index }: { election: Election; index: number }) {
  const router = useRouter();
  const foregroundColor = useThemeColor("foreground");
  const mutedColor = useThemeColor("muted");
  const accentColor = useThemeColor("accent");
  const successColor = useThemeColor("success");

  const now = new Date();
  const end = new Date(election.endTime);
  const start = new Date(election.startTime);
  const isLive = now >= start && now <= end;

  const dateLabel = isLive
    ? `Ends ${end.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
    : now < start
      ? `Starts ${start.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
      : `Ended ${end.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 70).springify()}
      layout={LinearTransition.springify()}
    >
      <Pressable
        onPress={() =>
          router.push({
            pathname: "/(drawer)/elections/[id]" as any,
            params: { id: election.id },
          })
        }
        style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
      >
        <Surface
          variant="secondary"
          style={{ borderRadius: 20, padding: 16, gap: 12, borderCurve: "continuous" }}
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
                name={isLive ? "pulse-outline" : "albums-outline"}
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
                {election.title}
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
                <Text style={{ color: mutedColor, fontSize: 12 }}>{dateLabel}</Text>
              </View>
            </View>

            <Ionicons name="chevron-forward" size={18} color={mutedColor} />
          </View>

          {election.description ? (
            <Text
              style={{ color: mutedColor, fontSize: 13, lineHeight: 18 }}
              numberOfLines={2}
            >
              {election.description}
            </Text>
          ) : null}

          <Separator />

          {/* Footer chips */}
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <ElectionStatusChip election={election} />
            <Chip variant="soft" color="default" size="sm">
              <Chip.Label>{election.candidates.length} candidates</Chip.Label>
            </Chip>
            <Chip variant="soft" color="default" size="sm">
              <Ionicons name="people-outline" size={11} color={mutedColor} />
              <Chip.Label> {election._count.votes.toLocaleString()} votes</Chip.Label>
            </Chip>
          </View>
        </Surface>
      </Pressable>
    </Animated.View>
  );
}

export default function ElectionsScreen() {
  const insets = useSafeAreaInsets();
  const foregroundColor = useThemeColor("foreground");
  const mutedColor = useThemeColor("muted");
  const accentColor = useThemeColor("accent");
  const backgroundColor = useThemeColor("background");

  const electionsQuery = useQuery(orpc.elections.list.queryOptions());
  const elections: Election[] = (electionsQuery.data as Election[] | undefined) ?? [];

  const liveElections = elections.filter((e) => {
    const now = new Date();
    return now >= new Date(e.startTime) && now <= new Date(e.endTime);
  });
  const upcomingElections = elections.filter((e) => new Date() < new Date(e.startTime));
  const pastElections = elections.filter((e) => new Date() > new Date(e.endTime));

  if (electionsQuery.isLoading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          backgroundColor,
        }}
      >
        <Spinner size="lg" />
        <Text style={{ color: mutedColor, fontSize: 13 }}>Loading elections...</Text>
      </View>
    );
  }

  const Section = ({
    title,
    items,
    startIndex,
  }: {
    title: string;
    items: Election[];
    startIndex: number;
  }) => {
    if (items.length === 0) return null;
    return (
      <View style={{ gap: 10 }}>
        <Text
          style={{
            color: mutedColor,
            fontSize: 12,
            fontWeight: "600",
            letterSpacing: 0.6,
            textTransform: "uppercase",
            paddingHorizontal: 2,
          }}
        >
          {title}
        </Text>
        {items.map((e, i) => (
          <ElectionCard key={e.id} election={e} index={startIndex + i} />
        ))}
      </View>
    );
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor }}
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingBottom: insets.bottom + 32,
        gap: 20,
      }}
      refreshControl={
        <RefreshControl
          refreshing={electionsQuery.isFetching && !electionsQuery.isLoading}
          onRefresh={() => electionsQuery.refetch()}
          tintColor={mutedColor}
        />
      }
    >
      {/* Header */}
      <Animated.View
        entering={FadeInDown.delay(40).springify()}
        style={{ paddingTop: 24, paddingBottom: 4, gap: 4 }}
      >
        <Text
          style={{
            fontSize: 32,
            fontWeight: "800",
            color: foregroundColor,
            letterSpacing: -0.8,
          }}
        >
          Elections
        </Text>
        <Text style={{ color: mutedColor, fontSize: 14 }}>
          {elections.length > 0
            ? `${liveElections.length} live · ${elections.length} total`
            : "No elections yet"}
        </Text>
      </Animated.View>

      {/* Empty state */}
      {elections.length === 0 && (
        <Animated.View
          entering={FadeIn.delay(100).springify()}
          style={{ alignItems: "center", paddingVertical: 60, gap: 12 }}
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
            <Ionicons name="albums-outline" size={40} color={accentColor} />
          </View>
          <Text
            style={{ color: foregroundColor, fontWeight: "700", fontSize: 18, marginTop: 4 }}
          >
            No Elections Yet
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
            Elections will appear here once they are created by an administrator.
          </Text>
        </Animated.View>
      )}

      {/* Sections */}
      <Section title="Live Now" items={liveElections} startIndex={0} />
      <Section
        title="Upcoming"
        items={upcomingElections}
        startIndex={liveElections.length}
      />
      <Section
        title="Past"
        items={pastElections}
        startIndex={liveElections.length + upcomingElections.length}
      />
    </ScrollView>
  );
}
