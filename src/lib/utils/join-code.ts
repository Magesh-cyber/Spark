import crypto from "crypto";

// Exclude easily confused characters like 'O', '0', 'I', '1'
const JOIN_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateJoinCode(): string {
  let result = "";
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    result += JOIN_CODE_CHARS[bytes[i] % JOIN_CODE_CHARS.length];
  }
  return result;
}
