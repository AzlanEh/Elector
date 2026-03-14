import { Ionicons } from "@expo/vector-icons";
import { Link, Stack } from "expo-router";
import { Button, Card, useThemeColor } from "heroui-native";
import { Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Container } from "@/components/container";

export default function NotFoundScreen() {
  const accentForegroundColor = useThemeColor("accent-foreground");

  return (
    <>
      <Stack.Screen options={{ title: "Not Found" }} />
      <Container>
        <View className="flex-1 justify-center items-center px-6">
          <Animated.View entering={FadeInDown.springify()} className="w-full max-w-sm">
            <Card variant="secondary" className="rounded-2xl">
              <Card.Body className="items-center py-8 gap-4">
                <View
                  className="w-16 h-16 rounded-2xl bg-accent items-center justify-center"
                  style={{ borderCurve: "continuous" }}
                >
                  <Ionicons name="map-outline" size={32} color={accentForegroundColor} />
                </View>
                <View className="items-center gap-1">
                  <Card.Title className="text-xl">Page Not Found</Card.Title>
                  <Card.Description className="text-center text-sm leading-relaxed">
                    The page you're looking for doesn't exist or has been moved.
                  </Card.Description>
                </View>
                <Link href={"../" as any} asChild>
                  <Button variant="primary" size="md" className="w-full">
                    <Button.Label>Go Home</Button.Label>
                  </Button>
                </Link>
              </Card.Body>
            </Card>
          </Animated.View>
        </View>
      </Container>
    </>
  );
}
