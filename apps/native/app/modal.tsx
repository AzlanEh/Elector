import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Button, Card, Chip, Separator, Surface, useThemeColor } from "heroui-native";
import { Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Container } from "@/components/container";

function Modal() {
  const accentForegroundColor = useThemeColor("accent-foreground");
  const foregroundColor = useThemeColor("foreground");

  const INFO_ITEMS = [
    {
      icon: "finger-print" as const,
      title: "DigiLocker Auth",
      desc: "We use India's official DigiLocker OAuth to verify your identity. Your Aadhaar number is hashed with SHA-256 and never stored.",
    },
    {
      icon: "lock-closed-outline" as const,
      title: "Vote Encryption",
      desc: "Your vote is encrypted with AES-256-GCM before submission. Only an aggregated tally is ever revealed.",
    },
    {
      icon: "cube-outline" as const,
      title: "Blockchain Commitment",
      desc: "A cryptographic commitment is recorded on the Solana blockchain, making your vote tamper-proof and publicly auditable.",
    },
    {
      icon: "eye-off-outline" as const,
      title: "Full Anonymity",
      desc: "The voter hash is derived from your Aadhaar but cannot be reversed. No one can link your vote back to your identity.",
    },
  ];

  return (
    <Container className="px-4">
      {/* Header */}
      <Animated.View entering={FadeInDown.delay(50).springify()} className="py-6 gap-2">
        <View className="w-12 h-12 rounded-2xl bg-accent items-center justify-center mb-2"
          style={{ borderCurve: "continuous" }}>
          <Ionicons name="information" size={24} color={accentForegroundColor} />
        </View>
        <Text className="text-2xl font-bold text-foreground">How Elector Works</Text>
        <Text className="text-muted text-sm leading-relaxed">
          Privacy-preserving, verifiable elections on the blockchain.
        </Text>
      </Animated.View>

      {/* Info Cards */}
      <Animated.View entering={FadeInDown.delay(100).springify()} className="gap-3 mb-5">
        {INFO_ITEMS.map((item, i) => (
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
      </Animated.View>

      {/* Close */}
      <Animated.View entering={FadeInDown.delay(200).springify()} className="mb-8">
        <Button variant="secondary" className="w-full" onPress={() => router.back()}>
          <Button.Label>Close</Button.Label>
        </Button>
      </Animated.View>
    </Container>
  );
}

export default Modal;
