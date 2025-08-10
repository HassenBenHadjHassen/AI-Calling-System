import dotenv from "dotenv";

// Load environment variables
dotenv.config();

interface EnvConfig {
	PORT: number;
	DATABASE_URL: string;
	TWILIO_ACCOUNT_SID: string;
	TWILIO_AUTH_TOKEN: string;
	TWILIO_FROM_NUMBER: string;
	TWILIO_TWIML_URL: string;
	VAPI_API_KEY: string;
	VAPI_PHONE_NUMBER_ID: string;
	VAPI_WORKFLOW_ID: string;
	VAPI_ASSISTANT_ID: string;
	JWT_SECRET: string;
	NODE_ENV: string;
}

function validateEnv(): EnvConfig {
	const requiredVars = [
		"DATABASE_URL",
		"VAPI_API_KEY",
		"VAPI_PHONE_NUMBER_ID",
		"VAPI_ASSISTANT_ID",
		"VAPI_WORKFLOW_ID",
		"JWT_SECRET",
	];

	const missing = requiredVars.filter((varName) => !process.env[varName]);

	if (missing.length > 0) {
		throw new Error(
			`Missing required environment variables: ${missing.join(", ")}`
		);
	}

	// Validate French phone number format
	const twilioNumber = process.env.TWILIO_FROM_NUMBER!;
	//   if (!twilioNumber.match(/^\+33[0-9]{9}$/)) {
	//     throw new Error('TWILIO_FROM_NUMBER must be a valid French number starting with +33');
	//   }

	return {
		PORT: parseInt(process.env.PORT || "3548", 10),
		DATABASE_URL: process.env.DATABASE_URL!,
		TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID!,
		TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN!,
		TWILIO_FROM_NUMBER: process.env.TWILIO_FROM_NUMBER!,
		TWILIO_TWIML_URL: process.env.TWILIO_TWIML_URL!,
		VAPI_API_KEY: process.env.VAPI_API_KEY!,
		VAPI_PHONE_NUMBER_ID: process.env.VAPI_PHONE_NUMBER_ID!,
		VAPI_WORKFLOW_ID: process.env.VAPI_WORKFLOW_ID!,
		VAPI_ASSISTANT_ID: process.env.VAPI_ASSISTANT_ID!,
		JWT_SECRET: process.env.JWT_SECRET || "default-secret-change-in-production",
		NODE_ENV: process.env.NODE_ENV || "development",
	};
}

export const env = validateEnv();
