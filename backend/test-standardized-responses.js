const axios = require("axios");

const BASE_URL = "http://localhost:6942/api";

async function testStandardizedResponses() {
	console.log("🧪 Testing Standardized API Responses...\n");

	try {
		// Test health endpoint
		console.log("1. Testing health endpoint...");
		const healthResponse = await axios.get(`${BASE_URL}/health`);
		console.log(
			"✅ Health response:",
			JSON.stringify(healthResponse.data, null, 2)
		);
		console.log("Expected format: { success: true, data: {...} }");
		console.log(
			"Actual format matches:",
			healthResponse.data.hasOwnProperty("success") &&
				healthResponse.data.hasOwnProperty("data")
		);
		console.log("");

		// Test auth endpoints
		console.log("2. Testing auth endpoints...");

		// Test login with invalid credentials
		try {
			const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
				email: "invalid@example.com",
				password: "wrongpassword",
			});
			console.log("❌ Login should have failed but succeeded");
		} catch (error) {
			if (error.response) {
				console.log(
					"✅ Login error response:",
					JSON.stringify(error.response.data, null, 2)
				);
				console.log(
					'Expected format: { success: false, data: null, error: "..." }'
				);
				console.log(
					"Actual format matches:",
					error.response.data.hasOwnProperty("success") &&
						error.response.data.hasOwnProperty("error")
				);
			}
		}
		console.log("");

		// Test auth test endpoint
		const authTestResponse = await axios.get(`${BASE_URL}/auth/test`);
		console.log(
			"✅ Auth test response:",
			JSON.stringify(authTestResponse.data, null, 2)
		);
		console.log(
			'Expected format: { success: true, data: {...}, message: "..." }'
		);
		console.log(
			"Actual format matches:",
			authTestResponse.data.hasOwnProperty("success") &&
				authTestResponse.data.hasOwnProperty("data")
		);
		console.log("");

		// Test 404 endpoint
		console.log("3. Testing 404 endpoint...");
		try {
			await axios.get(`${BASE_URL}/nonexistent`);
		} catch (error) {
			if (error.response && error.response.status === 404) {
				console.log(
					"✅ 404 response:",
					JSON.stringify(error.response.data, null, 2)
				);
				console.log(
					'Expected format: { success: false, data: null, error: "..." }'
				);
				console.log(
					"Actual format matches:",
					error.response.data.hasOwnProperty("success") &&
						error.response.data.hasOwnProperty("error")
				);
			}
		}
		console.log("");

		console.log("🎉 All tests completed!");
		console.log("\n📋 Summary:");
		console.log(
			"- All responses should have: success, data, and optional error/message fields"
		);
		console.log(
			'- Success responses: { success: true, data: {...}, message?: "..." }'
		);
		console.log(
			'- Error responses: { success: false, data: null, error: "..." }'
		);
	} catch (error) {
		console.error("❌ Test failed:", error.message);
		if (error.response) {
			console.error("Response data:", error.response.data);
		}
	}
}

// Run the test
testStandardizedResponses();
