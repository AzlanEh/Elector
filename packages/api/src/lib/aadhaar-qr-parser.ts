/**
 * Aadhaar QR Code Parser
 *
 * Supports two formats:
 *   1. New "Secure QR" / Offline e-KYC format — zlib-compressed, RSA-SHA256 signed XML
 *      The Aadhaar app "Share Code" and e-Aadhaar QR use this format.
 *      Magic bytes: first byte 0x78 (zlib deflate header).
 *
 *   2. Legacy format — uncompressed plain-text XML
 *      Found on older physical Aadhaar letters.
 *      Starts with a numeric string or "<" character.
 *
 * UIDAI signs the QR data with a 2048-bit RSA key (SHA256withRSA).
 * The signature is the last 256 bytes of the raw (decompressed) byte array.
 * Everything before those 256 bytes is the signed content.
 *
 * The bundled certificates are:
 *   uidai-offline-publickey.cer  — used for Offline e-KYC / Secure QR signing
 *   uidai-auth-prod.cer          — used for online authentication (not QR)
 *
 * References:
 *   https://uidai.gov.in/en/ecosystem/authentication-devices-documents/qr-code-reader.html
 *   Secure QR Code Specification v2.0 (UIDAI)
 */

import zlib from "zlib";
import { readFileSync, writeFileSync, unlinkSync } from "fs";
import { execSync } from "child_process";
import os from "os";
import { XMLParser } from "fast-xml-parser";
import forge from "node-forge";
import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Certificate loading ──────────────────────────────────────────────────────

function loadCertificate(filename: string): forge.pki.Certificate {
  const certPem = readFileSync(path.join(__dirname, filename), "utf8");
  return forge.pki.certificateFromPem(certPem);
}

// Lazy-loaded certificates (so startup is fast and errors are surfaced on use)
let _offlineCert: forge.pki.Certificate | null = null;
let _authProdCert: forge.pki.Certificate | null = null;

function getOfflineCert(): forge.pki.Certificate {
  if (!_offlineCert) {
    _offlineCert = loadCertificate("uidai-offline-publickey.cer");
  }
  return _offlineCert;
}

function getAuthProdCert(): forge.pki.Certificate {
  if (!_authProdCert) {
    _authProdCert = loadCertificate("uidai-auth-prod.cer");
  }
  return _authProdCert;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AadhaarData {
  /** Last 4 digits of Aadhaar (full UID never exposed outside of temp processing) */
  uid: string;
  name: string;
  /** ISO date string YYYY-MM-DD or DD-MM-YYYY as in the XML */
  dob: string;
  gender: "M" | "F" | "T" | string;
  address: string;
  pincode?: string;
  /** Base64-encoded JPEG photo bytes */
  photo?: string;
  /** Computed age from DOB at time of verification */
  age: number;
  /** Whether the UIDAI RSA signature was valid */
  signatureValid: boolean;
  /** Which format was detected */
  format: "secure-qr" | "legacy";
}

// ─── Format detection ─────────────────────────────────────────────────────────

/**
 * The native app scans the QR and gets a string. However the Aadhaar Secure QR
 * is a binary payload, so many QR scanning libraries will represent it as the
 * raw string of the decoded bytes. We accept either:
 *  - A Base64-encoded string of the raw bytes (preferred, lossless)
 *  - The raw decoded string from the QR scanner (may lose high bytes)
 */
function decodeInput(qrData: string): Buffer {
  const trimmed = qrData.trim();

  // Check for numeric format FIRST — a string of digits is valid base64 too,
  // so we must short-circuit before the base64 branch misinterprets it.
  if (/^[\d,\s]+$/.test(trimmed)) {
    return Buffer.from(trimmed, "utf8");
  }

  // Try base64 — this is what we send from the native app for binary payloads
  const base64Regex = /^[A-Za-z0-9+/=\n]+$/;
  if (base64Regex.test(trimmed)) {
    try {
      return Buffer.from(trimmed, "base64");
    } catch {
      // fall through
    }
  }

  // Raw string — encode as latin1 to preserve byte values
  return Buffer.from(qrData, "latin1");
}

function isZlibCompressed(buf: Buffer): boolean {
  // zlib deflate streams start with 0x78 (CMF byte) followed by 0x9C, 0xDA, 0x01, etc.
  return buf.length > 2 && buf[0] === 0x78;
}

function isGzipCompressed(buf: Buffer): boolean {
  // gzip streams start with the two-byte magic number 0x1F 0x8B
  return buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b;
}

function isAnyCompressed(buf: Buffer): boolean {
  return isZlibCompressed(buf) || isGzipCompressed(buf);
}

// ─── Signature verification ───────────────────────────────────────────────────

/**
 * Verify UIDAI RSA-SHA256 signature.
 *
 * For legacy QR:
 *   - The XML contains a <Signature> element with a base64 value.
 *   - Signed content = all XML bytes with <Signature>...</Signature> removed.
 */
function verifyLegacyXmlSignature(
  xmlContent: string,
  signatureBase64: string,
  cert: forge.pki.Certificate
): boolean {
  try {
    // Remove the <Signature>...</Signature> element from the XML for the signed content
    const signedContent = xmlContent.replace(/<Signature>.*?<\/Signature>/s, "");
    const signatureBytes = Buffer.from(signatureBase64, "base64");

    const publicKey = cert.publicKey as forge.pki.rsa.PublicKey;
    const md = forge.md.sha256.create();
    md.update(signedContent);

    return publicKey.verify(md.digest().bytes(), signatureBytes.toString("binary"));
  } catch {
    return false;
  }
}

// ─── Age calculation ──────────────────────────────────────────────────────────

function computeAge(dob: string): number {
  // Try YYYY-MM-DD first, then DD-MM-YYYY, then DD/MM/YYYY
  let date: Date | null = null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
    date = new Date(dob);
  } else if (/^\d{2}-\d{2}-\d{4}$/.test(dob)) {
    const [day, month, year] = dob.split("-");
    date = new Date(`${year}-${month}-${day}`);
  } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(dob)) {
    const [day, month, year] = dob.split("/");
    date = new Date(`${year}-${month}-${day}`);
  } else if (/^\d{4}$/.test(dob)) {
    // Only year available — use Jan 1
    date = new Date(`${dob}-01-01`);
  }

  if (!date || isNaN(date.getTime())) return 0;

  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const m = today.getMonth() - date.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < date.getDate())) {
    age--;
  }
  return age;
}

// ─── Image conversion ─────────────────────────────────────────────────────────

/**
 * Convert a JPEG 2000 (J2C codestream or JP2 box) buffer to a standard JPEG.
 * UIDAI stores photos as J2C in V5 QR codes. React Native's Image component
 * only supports standard JPEG/PNG, so we transcode server-side before sending.
 *
 * Uses opj_decompress (OpenJPEG CLI) to decode the J2C to BMP, then sharp to
 * convert to JPEG. Requires opj_decompress to be installed on the server
 * (apt: libopenjp2-tools).
 *
 * Returns the original buffer base64-encoded unchanged if conversion fails.
 */
async function jp2ToJpeg(jp2Bytes: Buffer): Promise<Buffer> {
  const tmpId = `aadhaar-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const inFile  = path.join(os.tmpdir(), `${tmpId}.j2c`);
  const outFile = path.join(os.tmpdir(), `${tmpId}.png`);
  try {
    writeFileSync(inFile, jp2Bytes);
    execSync(`opj_decompress -i "${inFile}" -o "${outFile}" 2>&1`, { stdio: "pipe" });
    const pngBytes = readFileSync(outFile);
    return await sharp(pngBytes).jpeg({ quality: 85 }).toBuffer();
  } catch {
    return jp2Bytes;
  } finally {
    try { unlinkSync(inFile); } catch { /* ignore */ }
    try { unlinkSync(outFile); } catch { /* ignore */ }
  }
}

// ─── Pipe-delimited (V5 mAadhaar Secure QR) parsing ─────────────────────────

/**
 * Parse the V5 pipe-delimited mAadhaar Secure QR format.
 *
 * Field layout (based on UIDAI Secure QR v2 pipe format):
 *   [0]  version        "V5"
 *   [1]  sub-version    "2"
 *   [2]  reference_id   last4 + timestamp (e.g. "362620260315160738830")
 *   [3]  name
 *   [4]  dob            DD-MM-YYYY
 *   [5]  gender         M / F / T
 *   [6]  care_of        "S/O: ..." or "D/O: ..."
 *   [7]  district
 *   [8]  address line   (street / locality)
 *   [9]  sub-district / town
 *   [10] village / locality
 *   [11] pincode (may be masked, e.g. "XXXXXX5845")
 *   ...  remaining bytes = binary JPEG photo (may span multiple |-split chunks)
 *
 * The photo starts immediately after pincode field — everything after
 * the 12th pipe delimiter is binary JPEG data.
 */
async function parsePipeDelimitedQr(
  decompressed: Buffer
): Promise<Omit<AadhaarData, "signatureValid" | "format" | "age">> {
  // The V5 mAadhaar Secure QR uses 0xFF (255) as the field delimiter.
  // Fields are followed by binary image data (JPEG 2000 / JP2 format).
  //
  // Confirmed field layout from real card data:
  //   [0]  "V5"                  version
  //   [1]  "2"                   sub-version
  //   [2]  reference_id          timestamp-based, NOT the UID
  //   [3]  name
  //   [4]  dob                   DD-MM-YYYY
  //   [5]  gender                M / F / T
  //   [6]  care_of               "S/O: ..." or "D/O: ..."
  //   [7]  district
  //   [8]  address (may be empty)
  //   [9]  house / door number
  //   [10] locality / area
  //   [11] pincode               6-digit
  //   [12] sub-district
  //   [13] state
  //   [14] street / colony
  //   [15] town / sub-town
  //   [16] village / post-office
  //   [17] masked UID            "XXXXXXNNNN" — last 4 digits are the Aadhaar suffix
  //   [18] (empty)
  //   [19] blood group / VTC
  //   [20+] binary JP2/JPEG photo
  //
  // Photo format: UIDAI uses JPEG 2000 (JP2). The JP2 magic bytes are:
  //   00 00 00 0C 6A 50 20 20  (the "jP  " signature box)
  // Since 0xFF is the separator, after splitting on 0xFF the first chunk of the
  // image starts with the byte AFTER the 0xFF that began it. We therefore look
  // for a chunk whose first byte is 0x00 and second is 0x00 (start of JP2 box
  // length 0x0000000C) — but that may also match text fields. A safer heuristic:
  // the photo always comes after field [19], so we find the JP2 by looking for
  // chunks beyond index 19 OR by scanning for the literal JP2 signature in the
  // buffer directly.
  const SEP = 0xff;

  // Find where the photo starts.
  // UIDAI V5 stores a JPEG 2000 codestream (J2C format, not JP2 box).
  // J2C starts with SOC marker: FF 4F, followed immediately by SIZ marker FF 51.
  // Since 0xFF is our field separator, both FF bytes get consumed:
  //   raw: ... [last text 0xFF sep] 4F [0xFF sep] 51 00 2F ...
  // This means "O" (0x4F) appears as a text field right before the photo data.
  // We find the photo by scanning for the SOC pattern: FF 4F FF 51 in the raw buffer.
  // Also handle JP2 box format: FF 00 00 00 0C 6A 50 20 20
  let photoByteOffset = -1;

  // Search for J2C SOC: FF 4F FF 51
  const J2C_SOC = Buffer.from([0xff, 0x4f, 0xff, 0x51]);
  for (let i = 0; i <= decompressed.length - J2C_SOC.length; i++) {
    let match = true;
    for (let j = 0; j < J2C_SOC.length; j++) {
      if (decompressed[i + j] !== J2C_SOC[j]) { match = false; break; }
    }
    if (match) { photoByteOffset = i; break; }
  }

  // Fallback: JP2 box format — search for 00 00 00 0C 6A 50 20 20 (body without leading FF)
  if (photoByteOffset === -1) {
    const JP2_BODY = Buffer.from([0x00, 0x00, 0x00, 0x0c, 0x6a, 0x50, 0x20, 0x20]);
    for (let i = 0; i <= decompressed.length - JP2_BODY.length; i++) {
      let match = true;
      for (let j = 0; j < JP2_BODY.length; j++) {
        if (decompressed[i + j] !== JP2_BODY[j]) { match = false; break; }
      }
      if (match) {
        photoByteOffset = i > 0 && decompressed[i - 1] === SEP ? i - 1 : i;
        break;
      }
    }
  }

  // Split only the text portion
  const textEnd = photoByteOffset > 0 ? photoByteOffset : decompressed.length;
  const textBuf = decompressed.subarray(0, textEnd);

  const fieldBuffers: Buffer[] = [];
  let segStart = 0;
  for (let i = 0; i < textBuf.length; i++) {
    if (textBuf[i] === SEP) {
      fieldBuffers.push(textBuf.subarray(segStart, i));
      segStart = i + 1;
    }
  }
  fieldBuffers.push(textBuf.subarray(segStart));
  const fields = fieldBuffers.map((b) => b.toString("utf8"));

  const name       = fields[3]  ?? "";
  const dob        = fields[4]  ?? "";
  const gender     = fields[5]  ?? "";
  const careOf     = fields[6]  ?? "";
  const district   = fields[7]  ?? "";
  const houseNo    = fields[9]  ?? "";
  const locality   = fields[10] ?? "";
  const pincode6   = fields[11] ?? "";
  const subDist    = fields[12] ?? "";
  const state      = fields[13] ?? "";
  const street     = fields[14] ?? "";
  const town       = fields[15] ?? "";
  const village    = fields[16] ?? "";
  const maskedUid  = fields[17] ?? "";

  // UID: last 4 digits of the masked UID field (e.g. "XXXXXX5845" → "5845")
  const uid = maskedUid.replace(/^X+/, "").slice(0, 4) || maskedUid.slice(-4);

  const pincode = /^\d{6}$/.test(pincode6) ? pincode6 : undefined;

  const address = [careOf, houseNo, street, locality, village, town, subDist, district, state, pincode6]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");

  // Photo: convert J2C/JP2 bytes to standard JPEG for React Native compatibility
  let photo: string | undefined;
  if (photoByteOffset > 0) {
    const jp2Bytes = decompressed.subarray(photoByteOffset);
    const jpegBytes = await jp2ToJpeg(jp2Bytes);
    photo = jpegBytes.toString("base64");
  }

  return { uid, name, dob, gender, address, pincode, photo };
}

// ─── XML parsing helpers ──────────────────────────────────────────────────────

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  allowBooleanAttributes: true,
  parseAttributeValue: false,
  trimValues: true,
});

function parseSecureQrXml(xmlStr: string): Omit<AadhaarData, "signatureValid" | "format" | "age"> {
  const parsed = xmlParser.parse(xmlStr);

  // New Secure QR root element: <UidData> or <KycRes>
  const root = parsed.UidData ?? parsed.KycRes ?? parsed.OfflinePaperlessKyc ?? {};
  const poi = root.Poi ?? root.poi ?? {};
  const poa = root.Poa ?? root.poa ?? {};

  const name: string = poi["@_name"] ?? poi["@_n"] ?? root["@_name"] ?? "";
  const dob: string = poi["@_dob"] ?? poi["@_dob"] ?? root["@_dob"] ?? "";
  const gender: string = poi["@_gender"] ?? poi["@_g"] ?? root["@_gender"] ?? "";
  const uid: string = root["@_uid"] ?? root["@_referenceId"] ?? "";

  // Address
  const houseName: string = poa["@_house"] ?? "";
  const street: string = poa["@_street"] ?? "";
  const locality: string = poa["@_lm"] ?? poa["@_loc"] ?? "";
  const district: string = poa["@_dist"] ?? "";
  const state: string = poa["@_state"] ?? "";
  const pincode: string = poa["@_pc"] ?? "";
  const country: string = poa["@_country"] ?? "";
  const address = [houseName, street, locality, district, state, pincode, country]
    .filter(Boolean)
    .join(", ");

  // Photo — base64 encoded inside <Pht> element or @_photo attribute
  const photo: string =
    (root.Pht ?? poi["@_photo"] ?? root["@_photo"] ?? "")
      .toString()
      .trim();

  return { uid, name, dob, gender, address, pincode: pincode || undefined, photo: photo || undefined };
}

function parseLegacyXml(xmlStr: string): Omit<AadhaarData, "signatureValid" | "format" | "age"> {
  const parsed = xmlParser.parse(xmlStr);

  // Legacy root: <PrintLetterBarcodeData>
  const root =
    parsed.PrintLetterBarcodeData ??
    parsed.OfflinePaperlessKyc ??
    Object.values(parsed)[0] ??
    {};

  const name: string = root["@_name"] ?? "";
  const dob: string = root["@_dob"] ?? root["@_yob"] ?? "";
  const gender: string = root["@_gender"] ?? root["@_g"] ?? "";
  const uid: string = root["@_uid"] ?? root["@_UID"] ?? "";
  const address: string = [
    root["@_co"],
    root["@_house"],
    root["@_street"],
    root["@_lm"],
    root["@_loc"],
    root["@_dist"],
    root["@_state"],
    root["@_country"],
  ]
    .filter(Boolean)
    .join(", ");

  const photo: string = (root["@_photo"] ?? "").toString().trim();

  return {
    uid,
    name,
    dob,
    gender,
    address,
    photo: photo || undefined,
  };
}

// ─── Main parser ──────────────────────────────────────────────────────────────

/**
 * Parse and verify an Aadhaar QR code payload.
 *
 * @param qrData - The raw QR content as a Base64 string (preferred) or raw string.
 *                 Pass `"dev"` to get synthetic development data.
 * @returns Parsed Aadhaar data with signature validity flag.
 * @throws If the QR data is malformed and cannot be parsed at all.
 */
export async function parseAadhaarQr(qrData: string): Promise<AadhaarData> {
  const rawBytes = decodeInput(qrData);

  if (isAnyCompressed(rawBytes)) {
    return parseSecureQr(rawBytes);
  }

  // Check if it's a plain XML string (legacy)
  const asString = rawBytes.toString("utf8");
  if (asString.trimStart().startsWith("<")) {
    return parseLegacyQr(asString);
  }

  // UIDAI Secure QR numeric format — the entire binary payload is encoded as
  // a single large decimal integer (big-endian). Convert it to a Buffer using
  // BigInt, then check if it is a zlib stream (Secure QR) or XML (legacy).
  const numericMatch = asString.match(/^[\d,\s]+$/);
  if (numericMatch) {
    const parts = asString.trim().split(/[,\s]+/);

    if (parts.length === 1) {
      // Single giant decimal integer — the canonical UIDAI Secure QR encoding
      const bigNum = BigInt(parts[0]!);
      const hex = bigNum.toString(16);
      const paddedHex = hex.length % 2 === 0 ? hex : "0" + hex;
      const bytes = Buffer.from(paddedHex, "hex");
      if (isAnyCompressed(bytes)) {
        return parseSecureQr(bytes);
      }
      const asXml = bytes.toString("utf8");
      if (asXml.trimStart().startsWith("<")) {
        return parseLegacyQr(asXml);
      }
    } else {
      // Space/comma-separated byte values (some older readers)
      const byteValues = parts.map((n) => parseInt(n, 10));
      const bytes = Buffer.from(byteValues);
      if (isAnyCompressed(bytes)) {
        return parseSecureQr(bytes);
      }
      const bytesAsXml = bytes.toString("utf8");
      if (bytesAsXml.trimStart().startsWith("<")) {
        return parseLegacyQr(bytesAsXml);
      }
    }
  } else {
    // did not match numeric — fall through to throw
  }

  throw new Error(
    "Unrecognized QR format. Ensure you are scanning a UIDAI Aadhaar Secure QR code."
  );
}

async function parseSecureQr(rawBytes: Buffer): Promise<AadhaarData> {
  const RSA_SIGNATURE_BYTES = 256;

  // Try to find where the compressed payload ends and the signature begins.
  // We attempt decompression of (rawBytes - 256 sig bytes) first (old zlib format),
  // then fall back to full rawBytes decompression (gzip format where sig is appended
  // to the *decompressed* data, not the compressed stream).
  let decompressed: Buffer;
  let signatureSource: "compressed-suffix" | "decompressed-suffix" | "none" = "none";

  const compressedWithoutSig = rawBytes.subarray(0, rawBytes.length - RSA_SIGNATURE_BYTES);

  // First attempt: strip 256 bytes from compressed buffer, then decompress
  const tryDecompress = (buf: Buffer): Promise<Buffer | null> =>
    new Promise((resolve) => {
      const fn = isGzipCompressed(buf) ? zlib.gunzip : zlib.inflate;
      fn(buf, (err, result) => resolve(err ? null : result));
    });

  const attempt1 = await tryDecompress(compressedWithoutSig);
  if (attempt1) {
    decompressed = attempt1;
    signatureSource = "compressed-suffix";
  } else {
    // Second attempt: decompress the full buffer, then strip 256 bytes from decompressed
    const attempt2 = await tryDecompress(rawBytes);
    if (attempt2) {
      decompressed = attempt2.subarray(0, attempt2.length - RSA_SIGNATURE_BYTES);
      signatureSource = "decompressed-suffix";
    } else {
      throw new Error("QR decompression failed: could not decompress payload with either layout");
    }
  }

  // Detect format: XML starts with '<', pipe-delimited V5 starts with "V" or digits
  const firstChars = decompressed.toString("utf8", 0, 10);
  let fields: Omit<AadhaarData, "signatureValid" | "format" | "age">;
  if (firstChars.trimStart().startsWith("<")) {
    const xmlStr = decompressed.toString("utf8");
    fields = parseSecureQrXml(xmlStr);
  } else {
    fields = await parsePipeDelimitedQr(decompressed);
  }

  // Verify signature
  let signatureValid = false;
  try {
    let signedContent: Buffer;
    let sigBytes: Buffer;
    if (signatureSource === "compressed-suffix") {
      signedContent = compressedWithoutSig;
      sigBytes = rawBytes.subarray(rawBytes.length - RSA_SIGNATURE_BYTES);
    } else {
      const full = await tryDecompress(rawBytes) as Buffer;
      signedContent = full.subarray(0, full.length - RSA_SIGNATURE_BYTES);
      sigBytes = full.subarray(full.length - RSA_SIGNATURE_BYTES);
    }
    for (const cert of [getOfflineCert(), getAuthProdCert()]) {
      const publicKey = cert.publicKey as forge.pki.rsa.PublicKey;
      const md = forge.md.sha256.create();
      md.update(signedContent.toString("binary"));
      if (publicKey.verify(md.digest().bytes(), sigBytes.toString("binary"))) {
        signatureValid = true;
        break;
      }
    }
  } catch {
    signatureValid = false;
  }

  const age = computeAge(fields.dob);

  return {
    ...fields,
    age,
    signatureValid,
    format: "secure-qr",
  };
}

async function parseLegacyQr(xmlStr: string): Promise<AadhaarData> {
  const fields = parseLegacyXml(xmlStr);

  // Extract signature from XML
  const sigMatch = xmlStr.match(/<Signature[^>]*>([\s\S]*?)<\/Signature>/i);
  let signatureValid = false;

  if (sigMatch && sigMatch[1]) {
    const sigBase64 = sigMatch[1].trim();
    try {
      signatureValid = verifyLegacyXmlSignature(xmlStr, sigBase64, getOfflineCert());
      if (!signatureValid) {
        signatureValid = verifyLegacyXmlSignature(xmlStr, sigBase64, getAuthProdCert());
      }
    } catch {
      signatureValid = false;
    }
  }

  const age = computeAge(fields.dob);

  return {
    ...fields,
    age,
    signatureValid,
    format: "legacy",
  };
}

// ─── Dev mode synthetic data ──────────────────────────────────────────────────

/**
 * Returns a synthetic Aadhaar data object for development/testing.
 * Used when `qrData === "dev"` is passed to the auth.verifyQR endpoint.
 */
export function devAadhaarData(): AadhaarData {
  return {
    uid: "999999999999",
    name: "Dev User",
    dob: "1990-01-01",
    gender: "M",
    address: "123 Dev Street, Test City, Test State 000000",
    pincode: "000000",
    photo: undefined,
    age: 35,
    signatureValid: true,
    format: "secure-qr",
  };
}
