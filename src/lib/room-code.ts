/**
 * Google Meet 3-4-3 alphanumeric room code generator: e.g. "abc-defg-hij"
 */
export function generateRoomCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  const getSeg = (len: number) => {
    let s = "";
    for (let i = 0; i < len; i++) {
      s += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return s;
  };
  return `${getSeg(3)}-${getSeg(4)}-${getSeg(3)}`;
}
