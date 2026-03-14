import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Card,
  Chip,
  Separator,
  Spinner,
  Surface,
  useThemeColor,
} from "heroui-native";
import { Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Container } from "@/components/container";
import { orpc } from "@/utils/orpc";

export default function Home() {
  const healthCheck = useQuery(orpc.healthCheck.queryOptions());
  const successColor = useThemeColor("success");
  const dangerColor = useThemeColor("danger");
  const accentForegroundColor = useThemeColor("accent-foreground");
  const mutedColor = useThemeColor("muted");

  const isConnected = healthCheck?.data === "OK";
  const isLoading = healthCheck?.isLoading;

  return (
    <Container className="px-4">
      {/* Hero Header */}
      <Animated.View entering={FadeInDown.delay(50).springify()} className="py-8 gap-2">
        <View className="w-14 h-14 rounded-2xl bg-accent items-center justify-center mb-3"
          style={{ borderCurve: "continuous" }}>
          <Ionicons name="shield-checkmark" size={28} color={accentForegroundColor} />
        </View>
        <Text className="text-3xl font-bold text-foreground tracking-tight">Elector</Text>
        <Text className="text-muted text-sm leading-relaxed">
          Secure, anonymous blockchain voting powered by Solana and Aadhaar.
        </Text>
      </Animated.View>

      {/* System Status Card */}
      <Animated.View entering={FadeInDown.delay(100).springify()} className="mb-5">
        <Surface variant="secondary" className="p-4 rounded-2xl gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-foreground font-semibold text-sm">System Status</Text>
            {isLoading ? (
              <Chip variant="secondary" color="default" size="sm">
                <Chip.Label>Checking...</Chip.Label>
              </Chip>
            ) : (
              <Chip variant="soft" color={isConnected ? "success" : "danger"} size="sm">
                <View
                  className={`w-1.5 h-1.5 rounded-full mr-1 ${isConnected ? "bg-success" : "bg-danger"}`}
                />
                <Chip.Label>{isConnected ? "All Systems Go" : "Degraded"}</Chip.Label>
              </Chip>
            )}
          </View>

          <Separator />

          {/* Backend Status Row */}
          <Surface variant="tertiary" className="p-3 rounded-xl">
            <View className="flex-row items-center gap-3">
              <View
                className={`w-9 h-9 rounded-xl items-center justify-center ${isConnected ? "bg-success/20" : "bg-danger/20"}`}
                style={{ borderCurve: "continuous" }}
              >
                <Ionicons
                  name={isConnected ? "server" : "server-outline"}
                  size={18}
                  color={isConnected ? successColor : dangerColor}
                />
              </View>
              <View className="flex-1">
                <Text className="text-foreground text-sm font-medium">oRPC Backend</Text>
                <Text className="text-muted text-xs mt-0.5">
                  {isLoading
                    ? "Checking connection..."
                    : isConnected
                      ? "Connected and healthy"
                      : "Unable to reach server"}
                </Text>
              </View>
              {isLoading && <Spinner size="sm" color={mutedColor} />}
              {!isLoading && isConnected && (
                <Ionicons name="checkmark-circle" size={20} color={successColor} />
              )}
              {!isLoading && !isConnected && (
                <Ionicons name="close-circle" size={20} color={dangerColor} />
              )}
            </View>
          </Surface>

          {/* Blockchain Row */}
          <Surface variant="tertiary" className="p-3 rounded-xl">
            <View className="flex-row items-center gap-3">
              <View
                className="w-9 h-9 rounded-xl items-center justify-center bg-accent/20"
                style={{ borderCurve: "continuous" }}
              >
                <Ionicons name="cube-outline" size={18} color={accentForegroundColor} />
              </View>
              <View className="flex-1">
                <Text className="text-foreground text-sm font-medium">Solana Blockchain</Text>
                <Text className="text-muted text-xs mt-0.5">Devnet · Vote commitments</Text>
              </View>
              <Chip variant="tertiary" color="default" size="sm">
                <Chip.Label>Devnet</Chip.Label>
              </Chip>
            </View>
          </Surface>
        </Surface>
      </Animated.View>

      {/* Feature Highlights */}
      <Animated.View entering={FadeInDown.delay(150).springify()} className="mb-5">
        <Text className="text-foreground font-semibold text-sm mb-3">How It Works</Text>
        <View className="gap-3">
          {[
            {
              icon: "finger-print" as const,
              title: "Anonymous Auth",
              desc: "Login via DigiLocker. Your Aadhaar is hashed, never stored.",
            },
            {
              icon: "lock-closed-outline" as const,
              title: "Encrypted Vote",
              desc: "Your choice is AES-256-GCM encrypted before submission.",
            },
            {
              icon: "link-outline" as const,
              title: "On-Chain Commitment",
              desc: "A cryptographic commitment is recorded on Solana immutably.",
            },
          ].map((item, i) => (
            <Card key={i} variant="secondary" className="rounded-2xl">
              <Card.Body>
                <View className="flex-row items-start gap-3">
                  <View
                    className="w-9 h-9 rounded-xl bg-accent/20 items-center justify-center mt-0.5"
                    style={{ borderCurve: "continuous" }}
                  >
                    <Ionicons name={item.icon} size={18} color={accentForegroundColor} />
                  </View>
                  <View className="flex-1">
                    <Card.Title className="text-sm">{item.title}</Card.Title>
                    <Card.Description className="text-xs mt-1 leading-relaxed">
                      {item.desc}
                    </Card.Description>
                  </View>
                </View>
              </Card.Body>
            </Card>
          ))}
        </View>
      </Animated.View>

      {/* CTA */}
      <Animated.View entering={FadeInDown.delay(200).springify()} className="mb-8">
        <Button variant="primary" className="w-full" onPress={() => {}}>
          <Ionicons name="checkmark-done-outline" size={18} color={accentForegroundColor} />
          <Button.Label>Go to Voting</Button.Label>
        </Button>
      </Animated.View>
    </Container>
  );
}
