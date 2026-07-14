import { registerAs } from "@nestjs/config";

export default registerAs("email", () => ({
  provider: (process.env.EMAIL_PROVIDER ?? "disabled") as "disabled" | "resend",
  from: process.env.EMAIL_FROM ?? "notificaciones@classia.com.co",
  resendApiKey: process.env.RESEND_API_KEY,
  webUrl: process.env.APP_WEB_URL ?? "http://localhost:3000",
}));
