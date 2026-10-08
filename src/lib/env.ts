import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z
    .string()
    .default('postgresql://postgres:postgres@localhost:5432/ai_calling_system'),
  PORT: z.coerce.number().default(3000),
  APP_URL: z.string().default('http://localhost:3000'),

  // Safe mode flag - when true, no actual SMS sent and no actual Google Calendar modifications made
  DRY_RUN: z
    .string()
    .default('true')
    .transform((val) => val === 'true' || val === '1'),

  // Vapi
  VAPI_API_KEY: z.string().optional().default('vapi_test_key'),
  VAPI_WEBHOOK_SECRET: z.string().optional().default('vapi_test_secret'),

  // Twilio
  TWILIO_ACCOUNT_SID: z.string().optional().default('AC_mock_twilio_account_sid'),
  TWILIO_AUTH_TOKEN: z.string().optional().default('mock_twilio_auth_token'),
  TWILIO_PHONE_NUMBER: z.string().default('+33939033663'),

  // Business Phone Numbers
  CABINET_INBOUND_PHONE: z.string().default('+33939033663'),
  BATIMENT_OUTBOUND_PHONE: z.string().default('+33939036462'),
  NURSE_ALERT_PHONE_NUMBER: z.string().default('+33612857915'),
  BATIMENT_ALERT_PHONE_NUMBER: z.string().default('+33612857915'),

  // Google Calendar
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().optional().default('service-account@test.iam.gserviceaccount.com'),
  GOOGLE_PRIVATE_KEY: z.string().optional().default(''),
  CABINET_CALENDAR_ID: z.string().default('monaldi2b@gmail.com'),
  TIMEZONE: z.string().default('Europe/Paris'),

  // OpenAI
  OPENAI_API_KEY: z.string().optional().default('sk-mock-openai-key'),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),

  // JotForm
  JOTFORM_FORM_URL: z
    .string()
    .default('https://form.jotform.com/260901590611047?callId={callId}'),
  JOTFORM_WEBHOOK_SECRET: z.string().optional().default(''),

  // Internal Dashboard
  DASHBOARD_PASSWORD: z.string().optional().default('admin123'),
});

export type Env = z.infer<typeof envSchema>;

let parsedEnv: Env;
try {
  parsedEnv = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    const formatted = error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    console.warn(`⚠️ Environment variable warnings:\n${formatted}`);
  }
  // Provide safe defaults in non-production
  parsedEnv = envSchema.parse({
    NODE_ENV: process.env.NODE_ENV || 'development',
    DRY_RUN: 'true',
  });
}

export const env = parsedEnv;
