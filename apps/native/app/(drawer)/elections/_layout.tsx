import { Ionicons } from "@expo/vector-icons";
import { Stack, useNavigation } from "expo-router";
import { useThemeColor } from "heroui-native";
import { useCallback } from "react";
import { Pressable } from "react-native";

import { ThemeToggle } from "@/components/theme-toggle";

export default function ElectionsLayout() {
  const foregroundColor = useThemeColor("foreground");
  const backgroundColor = useThemeColor("background");
  const navigation = useNavigation("/(drawer)");

  const openDrawer = useCallback(() => {
    (navigation as any).openDrawer?.();
  }, [navigation]);

  const renderDrawerToggle = useCallback(
    () => (
      <Pressable onPress={openDrawer} style={{ marginLeft: 4, padding: 8 }}>
        <Ionicons name="menu-outline" size={24} color={foregroundColor} />
      </Pressable>
    ),
    [openDrawer, foregroundColor]
  );

  const renderThemeToggle = useCallback(() => <ThemeToggle />, []);

  return (
    <Stack
      screenOptions={{
        headerTintColor: foregroundColor,
        headerStyle: { backgroundColor },
        headerTitleStyle: { fontWeight: "700", color: foregroundColor },
        headerBackButtonDisplayMode: "minimal",
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerTitle: "Elections",
          headerLeft: renderDrawerToggle,
          headerRight: renderThemeToggle,
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          headerTitle: "Election",
          headerRight: renderThemeToggle,
        }}
      />
    </Stack>
  );
}
