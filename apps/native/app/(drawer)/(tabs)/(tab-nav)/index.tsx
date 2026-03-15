import { Ionicons } from "@expo/vector-icons";
import { Chip, Separator, Spinner, Surface, useThemeColor } from "heroui-native";
import { Pressable, ScrollView, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, LinearTransition } from "react-native-reanimated";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { orpc } from "@/utils/orpc";

type Election = {
  id: string;
  title: string;
  description?: string | null;
  startTime: Date | string;
  endTime: Date | string;
  candidates: { id: string; name: string; description?: string | null }[];
};

function ElectionListCard({
  election,
  index,
}: {
  election: Election;
  index: number;
}) {
  const router = useRouter();
  const foregroundColor = useThemeColor("foreground");
  const mutedColor = useThemeColor("muted");
  const accentColor = useThemeColor("accent");
  const successColor = useThemeColor("success");

  const endDate = new Date(election.endTime).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const isLive = new Date(election.endTime) > new Date();

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 60).springify()}
      layout={LinearTransition.springify()}
    >
      <Pressable
        onPress={() =>
          router.push({
            pathname: "/(drawer)/(tabs)/election/[id]" as any,
            params: { id: election.id },
          })
        }
        style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
      >
        <Surface
          variant="secondary"
          style={{
            borderRadius: 20,
            padding: 16,
            borderCurve: "continuous",
            gap: 12,
          }}
        >
          {/* Top row */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            {/* Icon badge */}
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                backgroundColor: accentColor + "20",
                alignItems: "center",
                justifyContent: "center",
                borderCurve: "continuous",
              }}
            >
              <Ionicons name="albums-outline" size={24} color={accentColor} />
            </View>

            {/* Text */}
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
                <Text style={{ color: mutedColor, fontSize: 12 }}>
                  {isLive ? `Active · Ends ${endDate}` : `Ended ${endDate}`}
                </Text>
              </View>
            </View>

            {/* Chevron */}
            <Ionicons name="chevron-forward" size={18} color={mutedColor} />
          </View>

          <Separator />

          {/* Bottom row: chips */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Chip variant="soft" color={isLive ? "success" : "default"} size="sm">
              <Chip.Label>{isLive ? "Open" : "Closed"}</Chip.Label>
            </Chip>
            <Chip variant="soft" color="default" size="sm">
              <Chip.Label>{election.candidates.length} candidates</Chip.Label>
            </Chip>
          </View>
        </Surface>
      </Pressable>
    </Animated.View>
  );
}

export default function VoteScreen() {
  const insets = useSafeAreaInsets();
  const foregroundColor = useThemeColor("foreground");
  const mutedColor = useThemeColor("muted");
  const accentColor = useThemeColor("accent");

  const backgroundColor = useThemeColor("background");

  const electionsQuery = useQuery(orpc.elections.list.queryOptions());
  const elections: Election[] = (electionsQuery.data as Election[] | undefined) ?? [];

  if (electionsQuery.isLoading) {
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
        <Text style={{ color: mutedColor, fontSize: 13 }}>Loading elections...</Text>
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
          Elections
        </Text>
        <Text style={{ color: mutedColor, fontSize: 14 }}>
          {elections.length > 0
            ? `${elections.length} active election${elections.length !== 1 ? "s" : ""}`
            : "No active elections"}
        </Text>
      </Animated.View>

      {/* Empty state */}
      {elections.length === 0 && !electionsQuery.isLoading && (
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
            <Ionicons name="time-outline" size={40} color={accentColor} />
          </View>
          <Text
            style={{
              color: foregroundColor,
              fontWeight: "700",
              fontSize: 18,
              marginTop: 4,
            }}
          >
            No Active Elections
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
            There are no elections currently open for voting. Check back later.
          </Text>
        </Animated.View>
      )}

      {/* Election cards */}
      {elections.map((election, index) => (
        <ElectionListCard key={election.id} election={election} index={index} />
      ))}
    </ScrollView>
  );
}
