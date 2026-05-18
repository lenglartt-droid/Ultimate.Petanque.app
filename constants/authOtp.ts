/** Must match Supabase Dashboard → Authentication → Providers → Email → OTP length (often 8). */
const parsed = parseInt(process.env.EXPO_PUBLIC_AUTH_OTP_LENGTH ?? '8', 10);
export const AUTH_EMAIL_OTP_LENGTH =
  Number.isFinite(parsed) && parsed >= 6 && parsed <= 10 ? parsed : 8;
