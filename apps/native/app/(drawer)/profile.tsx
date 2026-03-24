import { Ionicons } from "@expo/vector-icons";
import {
  Button,
  Chip,
  Separator,
  Spinner,
  Surface,
  useThemeColor,
} from "heroui-native";
import { useState } from "react";
import {
  Alert,
  Image,
  ScrollView,
  Text,
  View,
} from "react-native";
import Animated, { FadeIn, FadeInDown, ZoomIn } from "react-native-reanimated";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { CameraView, useCameraPermissions, scanFromURLAsync } from "expo-camera";
import type { BarcodeScanningResult } from "expo-camera";
import { useRef } from "react";

import { orpc } from "@/utils/orpc";
import { useIdentity } from "@/hooks/useIdentity";

// ─── QR Encoding ─────────────────────────────────────────────────────────────

/**
 * Prepare a raw QR string for the server's parseAadhaarQr.
 * See scan.tsx for format details.
 */
function encodeQrData(raw: string): string {
  if (/^[\d,\s]+$/.test(raw.trim())) return raw;
  if (raw.trimStart().startsWith("<")) return raw;
  return btoa(
    Array.from(raw)
      .map((c) => String.fromCharCode(c.charCodeAt(0) & 0xff))
      .join("")
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

// ─── Inline QR Scanner ───────────────────────────────────────────────────────

function InlineQRScanner({
  onScan,
  onClose,
  accentColor,
}: {
  onScan: (data: string) => void;
  onClose: () => void;
  accentColor: string;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const scanned = useRef(false);
  const foregroundColor = useThemeColor("foreground");
  const mutedColor = useThemeColor("muted");

  const handleBarcode = (result: BarcodeScanningResult) => {
    if (scanned.current || !result.data) return;
    scanned.current = true;
    onScan(encodeQrData(result.data));
  };

  if (!permission) {
    return (
      <View style={{ height: 300, alignItems: "center", justifyContent: "center" }}>
        <Spinner size="lg" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View
        style={{ height: 300, alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 32 }}
      >
        <Ionicons name="camera-outline" size={40} color={mutedColor} />
        <Text style={{ color: foregroundColor, fontWeight: "600", textAlign: "center" }}>
          Camera permission required
        </Text>
        <Button variant="primary" size="sm" onPress={requestPermission}>
          <Button.Label>Grant Permission</Button.Label>
        </Button>
        <Button variant="secondary" size="sm" onPress={onClose}>
          <Button.Label>Cancel</Button.Label>
        </Button>
      </View>
    );
  }

  return (
    <View style={{ borderRadius: 16, overflow: "hidden" }}>
      <View style={{ height: 280, position: "relative" }}>
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={handleBarcode}
        />
        {/* Corner frame */}
        <View
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            marginTop: -80,
            marginLeft: -80,
            width: 160,
            height: 160,
          }}
          pointerEvents="none"
        >
          {[
            { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 6 },
            { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 6 },
            { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 6 },
            { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 6 },
          ].map((style, i) => (
            <View
              key={i}
              style={[
                {
                  position: "absolute",
                  width: 24,
                  height: 24,
                  borderColor: accentColor,
                  borderWidth: 3,
                },
                style,
              ]}
            />
          ))}
        </View>
      </View>
      <Button
        variant="secondary"
        style={{ margin: 12 }}
        onPress={onClose}
      >
        <Button.Label>Cancel</Button.Label>
      </Button>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { identity, isLoading, saveIdentity, clearIdentity } = useIdentity();

  const foregroundColor = useThemeColor("foreground");
  const mutedColor = useThemeColor("muted");
  const accentColor = useThemeColor("accent");
  const accentForegroundColor = useThemeColor("accent-foreground");
  const successColor = useThemeColor("success");
  const dangerColor = useThemeColor("danger");
  const backgroundColor = useThemeColor("background");


  const [scannerVisible, setScannerVisible] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const verifyQR = useMutation(orpc.auth.verifyQR.mutationOptions());

  // ── Core verify handler ───────────────────────────────────────────────────

  const handleVerify = async (qrData: string) => {
    setScannerVisible(false);
    setIsVerifying(true);

    verifyQR.mutate(
      { qrData },
      {
        onSuccess: async (data) => {
          await saveIdentity({
            userId: data.userId,
            voterToken: data.voterToken,
            displayName: data.displayName,
            dob: data.dob,
            age: data.age,
            gender: data.gender,
            photo: data.photo ?? null,
            signatureValid: data.signatureValid,
            qrFormat: data.qrFormat,
          });
          setIsVerifying(false);
        },
        onError: (error: any) => {
          setIsVerifying(false);
          Alert.alert("Verification Failed", error.message ?? "Could not verify Aadhaar QR.");
        },
      }
    );
  };

  // ── QR image upload from gallery ─────────────────────────────────────────

  const handleUploadQR = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
      allowsMultipleSelection: false,
    });

    if (result.canceled || !result.assets[0]) return;

    const uri = result.assets[0].uri;

    // Decode the QR code from the image on-device, then send the raw QR
    // payload (not the image) to the server for Aadhaar parsing.
    const scanned = await scanFromURLAsync(uri, ["qr"]);
    if (!scanned.length || !scanned[0].data) {
      Alert.alert("No QR Found", "Could not detect a QR code in the selected image. Make sure the image contains a clear Aadhaar Secure QR code.");
      return;
    }

    // Encode as base64 (latin1-safe) so binary Secure QR bytes survive transit.
    const encoded = encodeQrData(scanned[0].data);
    await handleVerify(encoded);
  };

  // ── Logout ────────────────────────────────────────────────────────────────

  const handleLogout = () => {
    Alert.alert(
      "Remove Identity",
      "This will clear your verified identity from this device. You will need to scan your Aadhaar QR again to vote.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: clearIdentity,
        },
      ]
    );
  };

  // ── Render: loading ───────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor }}>
        <Spinner size="lg" />
      </View>
    );
  }

  // ── Render: verifying overlay ─────────────────────────────────────────────

  if (isVerifying) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor,
          gap: 16,
          paddingHorizontal: 32,
        }}
      >
        <Spinner size="lg" />
        <Text style={{ color: foregroundColor, fontSize: 16, fontWeight: "600" }}>
          Verifying with UIDAI...
        </Text>
        <Text style={{ color: mutedColor, fontSize: 13, textAlign: "center" }}>
          Checking RSA signature and age eligibility
        </Text>
      </View>
    );
  }

  // ── Render: inline scanner ────────────────────────────────────────────────

  if (scannerVisible) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 20,
          paddingBottom: insets.bottom + 32,
          gap: 16,
        }}
      >
        <Animated.View entering={FadeInDown.springify()}>
          <Text
            style={{
              color: foregroundColor,
              fontSize: 20,
              fontWeight: "800",
              letterSpacing: -0.4,
              marginBottom: 4,
            }}
          >
            Scan Aadhaar QR
          </Text>
          <Text style={{ color: mutedColor, fontSize: 13, marginBottom: 12 }}>
            Open the Aadhaar app, tap{" "}
            <Text style={{ fontWeight: "700" }}>Share Code</Text>, and point the camera at the QR.
          </Text>
          <Surface
            variant="secondary"
            style={{ borderRadius: 20, overflow: "hidden", borderCurve: "continuous" }}
          >
            <InlineQRScanner
              onScan={handleVerify}
              onClose={() => setScannerVisible(false)}
              accentColor={accentColor}
            />
          </Surface>
        </Animated.View>
      </ScrollView>
    );
  }

  // ── Render: main profile view ─────────────────────────────────────────────

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor }}
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingTop: 20,
        paddingBottom: insets.bottom + 32,
        gap: 20,
      }}
    >
      {/* ── Header ── */}
      <Animated.View entering={FadeInDown.delay(30).springify()}>
        <Text
          style={{
            color: foregroundColor,
            fontSize: 28,
            fontWeight: "800",
            letterSpacing: -0.5,
          }}
        >
          Profile
        </Text>
        <Text style={{ color: mutedColor, fontSize: 13, marginTop: 4 }}>
          Your verified Aadhaar identity for voting
        </Text>
      </Animated.View>

      {identity ? (
        <>
          {/* ── Identity Card ── */}
          <Animated.View entering={FadeInDown.delay(60).springify()}>
            <Surface
              variant="secondary"
              style={{
                borderRadius: 24,
                padding: 20,
                gap: 16,
                borderCurve: "continuous",
              }}
            >
              {/* Photo + name row */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
                {identity.photo ? (
                  <Image
                    source={{ uri: `data:image/jpeg;base64,${identity.photo}` }}
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 16,
                    }}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 16,
                      backgroundColor: accentColor + "25",
                      alignItems: "center",
                      justifyContent: "center",
                      borderCurve: "continuous",
                    }}
                  >
                    <Ionicons name="person" size={34} color={accentColor} />
                  </View>
                )}

                <View style={{ flex: 1, gap: 6 }}>
                  <Text
                    style={{ color: foregroundColor, fontSize: 20, fontWeight: "800", letterSpacing: -0.3 }}
                    numberOfLines={2}
                  >
                    {identity.displayName}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                    <Chip variant="soft" color="success" size="sm">
                      <Ionicons name="checkmark-circle" size={12} color={successColor} />
                      <Chip.Label>Verified</Chip.Label>
                    </Chip>
                    <Chip variant="soft" color="default" size="sm">
                      <Chip.Label>{identity.age} yrs</Chip.Label>
                    </Chip>
                    {identity.gender ? (
                      <Chip variant="soft" color="default" size="sm">
                        <Chip.Label>{identity.gender}</Chip.Label>
                      </Chip>
                    ) : null}
                  </View>
                </View>
              </View>

              <Separator />

              {/* Detail rows */}
              {[
                {
                  icon: "calendar-outline" as const,
                  label: "Date of Birth",
                  value: identity.dob,
                },
                {
                  icon: "time-outline" as const,
                  label: "Verified on",
                  value: formatDate(identity.verifiedAt),
                },
                {
                  icon: "qr-code-outline" as const,
                  label: "QR Format",
                  value: identity.qrFormat === "secure-qr" ? "Aadhaar Secure QR" : "Legacy QR",
                },
              ].map((row) => (
                <View
                  key={row.label}
                  style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      backgroundColor: foregroundColor + "10",
                      alignItems: "center",
                      justifyContent: "center",
                      borderCurve: "continuous",
                    }}
                  >
                    <Ionicons name={row.icon} size={16} color={mutedColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: mutedColor, fontSize: 11 }}>{row.label}</Text>
                    <Text style={{ color: foregroundColor, fontSize: 14, fontWeight: "500", marginTop: 1 }}>
                      {row.value}
                    </Text>
                  </View>
                </View>
              ))}
            </Surface>
          </Animated.View>

          {/* ── Signature badge ── */}
          <Animated.View entering={FadeInDown.delay(90).springify()}>
            <Surface
              variant="secondary"
              style={{
                borderRadius: 16,
                padding: 14,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                borderCurve: "continuous",
                backgroundColor: identity.signatureValid
                  ? successColor + "12"
                  : identity.qrFormat === "secure-qr"
                    ? mutedColor + "18"
                    : dangerColor + "12",
              }}
            >
              <Ionicons
                name={
                  identity.signatureValid
                    ? "shield-checkmark"
                    : identity.qrFormat === "secure-qr"
                      ? "shield"
                      : "shield-outline"
                }
                size={22}
                color={
                  identity.signatureValid
                    ? successColor
                    : identity.qrFormat === "secure-qr"
                      ? mutedColor
                      : dangerColor
                }
              />
              <View style={{ flex: 1 }}>
                <Text style={{ color: foregroundColor, fontWeight: "600", fontSize: 13 }}>
                  UIDAI Signature{" "}
                  {identity.signatureValid
                    ? "Valid"
                    : identity.qrFormat === "secure-qr"
                      ? "Not Available"
                      : "Not Verified"}
                </Text>
                <Text style={{ color: mutedColor, fontSize: 11, marginTop: 2 }}>
                  {identity.signatureValid
                    ? "Cryptographic authenticity confirmed by UIDAI RSA-SHA256"
                    : identity.qrFormat === "secure-qr"
                      ? "Physical card QR — UIDAI signing key not publicly available"
                      : "Could not verify UIDAI digital signature"}
                </Text>
              </View>
            </Surface>
          </Animated.View>

          {/* ── Vote to vote button ── */}
          <Animated.View entering={FadeInDown.delay(130).springify()} style={{ gap: 10 }}>
            {/* Re-verify */}
            <Button variant="secondary" onPress={() => setScannerVisible(true)}>
              <Ionicons name="qr-code-outline" size={17} color={accentColor} />
              <Button.Label>Re-scan QR</Button.Label>
            </Button>

            {/* Upload QR */}
            <Button variant="secondary" onPress={handleUploadQR}>
              <Ionicons name="image-outline" size={17} color={accentColor} />
              <Button.Label>Upload QR from Gallery</Button.Label>
            </Button>

            {/* Logout */}
            <Button variant="secondary" onPress={handleLogout}>
              <Ionicons name="trash-outline" size={17} color={dangerColor} />
              <Button.Label style={{ color: dangerColor }}>Remove Identity</Button.Label>
            </Button>
          </Animated.View>
        </>
      ) : (
        /* ── Not yet verified ─────────────────────────────────────────────── */
        <Animated.View entering={ZoomIn.delay(50).springify()} style={{ gap: 16 }}>
          {/* Empty state illustration */}
          <Surface
            variant="secondary"
            style={{
              borderRadius: 24,
              padding: 32,
              alignItems: "center",
              gap: 14,
              borderCurve: "continuous",
            }}
          >
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 20,
                backgroundColor: accentColor + "20",
                alignItems: "center",
                justifyContent: "center",
                borderCurve: "continuous",
              }}
            >
              <Ionicons name="finger-print-outline" size={40} color={accentColor} />
            </View>
            <View style={{ gap: 6, alignItems: "center" }}>
              <Text
                style={{
                  color: foregroundColor,
                  fontSize: 20,
                  fontWeight: "800",
                  letterSpacing: -0.3,
                  textAlign: "center",
                }}
              >
                Not Verified Yet
              </Text>
              <Text
                style={{
                  color: mutedColor,
                  fontSize: 13,
                  textAlign: "center",
                  lineHeight: 20,
                  maxWidth: 260,
                }}
              >
                Verify your Aadhaar identity to participate in elections. Your UID is never stored —
                only a secure hash.
              </Text>
            </View>
          </Surface>

          {/* How to verify */}
          <Surface
            variant="secondary"
            style={{ borderRadius: 20, padding: 16, gap: 14, borderCurve: "continuous" }}
          >
            <Text style={{ color: foregroundColor, fontWeight: "700", fontSize: 13 }}>
              How to verify
            </Text>
            {[
              {
                step: "1",
                text: "Open the mAadhaar app and tap Share Code",
              },
              {
                step: "2",
                text: "Scan the QR code with the camera below, or upload a screenshot from your gallery",
              },
              {
                step: "3",
                text: "Your identity is verified with UIDAI's RSA signature — no data leaves your device except a secure hash",
              },
            ].map((item) => (
              <View key={item.step} style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: accentColor + "20",
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: 1,
                  }}
                >
                  <Text style={{ color: accentColor, fontSize: 11, fontWeight: "700" }}>
                    {item.step}
                  </Text>
                </View>
                <Text style={{ color: mutedColor, fontSize: 13, flex: 1, lineHeight: 20 }}>
                  {item.text}
                </Text>
              </View>
            ))}
          </Surface>

          {/* Action buttons */}
          <View style={{ gap: 10 }}>
            <Button variant="primary" onPress={() => setScannerVisible(true)}>
              <Ionicons name="qr-code-outline" size={17} color={accentForegroundColor} />
              <Button.Label>Scan Aadhaar QR</Button.Label>
            </Button>
            <Button variant="secondary" onPress={handleUploadQR}>
              <Ionicons name="image-outline" size={17} color={accentColor} />
              <Button.Label>Upload QR from Gallery</Button.Label>
            </Button>
            <Button
              variant="secondary"
              onPress={() => handleVerify("dev")}
              isDisabled={isVerifying}
            >
              <Ionicons name="code-slash-outline" size={17} color={accentColor} />
              <Button.Label>Use Test Identity (Dev)</Button.Label>
            </Button>
          </View>
        </Animated.View>
      )}
    </ScrollView>
  );
}
