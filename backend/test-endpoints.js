const axios = require("axios");

const BASE_URL = "http://localhost:3000";

// Test data
const testLead = {
  name: "Test User",
  phone1: "+1234567890",
  phone2: "+0987654321",
  address: "123 Test St",
  postalCode: "12345",
  city: "Test City",
};

const testCampaign = {
  name: "Test Campaign",
};

const testCall = {
  customerPhoneNumber: "+1234567890",
  scheduledCallAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
  note: "Test call",
};

async function testEndpoints() {
  console.log("🧪 Testing all endpoints...\n");

  try {
    // Test auth endpoints
    console.log("1. Testing Auth Endpoints:");

    // Test auth system
    const authTest = await axios.get(`${BASE_URL}/auth/test`);
    console.log("✅ Auth test:", authTest.data.message);

    // Test login
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: "admin@example.com",
      password: "admin123",
    });
    console.log("✅ Login successful:", loginResponse.data.message);

    // Test getting users
    const usersResponse = await axios.get(`${BASE_URL}/auth/users`);
    console.log(
      "✅ Users retrieved:",
      usersResponse.data.users.length,
      "users"
    );

    console.log("\n2. Testing Lead Endpoints:");

    // Test creating manual lead
    const createLeadResponse = await axios.post(
      `${BASE_URL}/leads/manual`,
      testLead
    );
    console.log("✅ Lead created:", createLeadResponse.data.message);

    // Test getting leads
    const getLeadsResponse = await axios.get(`${BASE_URL}/leads`);
    console.log("✅ Leads retrieved:", getLeadsResponse.data.length, "leads");

    // Test scheduling a call
    const scheduleCallResponse = await axios.post(
      `${BASE_URL}/leads/schedule`,
      testCall
    );
    console.log("✅ Call scheduled:", scheduleCallResponse.data.message);

    // Test getting scheduled calls
    const scheduledCallsResponse = await axios.get(
      `${BASE_URL}/leads/scheduled/calls`
    );
    console.log(
      "✅ Scheduled calls retrieved:",
      scheduledCallsResponse.data.length,
      "calls"
    );

    console.log("\n3. Testing Campaign Endpoints:");

    // Test creating campaign
    const createCampaignResponse = await axios.post(
      `${BASE_URL}/campaigns`,
      testCampaign
    );
    console.log("✅ Campaign created:", createCampaignResponse.data.message);

    // Test getting campaigns
    const getCampaignsResponse = await axios.get(`${BASE_URL}/campaigns`);
    console.log(
      "✅ Campaigns retrieved:",
      getCampaignsResponse.data.length,
      "campaigns"
    );

    console.log("\n4. Testing Call Endpoints:");

    // Test getting call stats
    const callStatsResponse = await axios.get(`${BASE_URL}/calls/stats`);
    console.log("✅ Call stats retrieved");

    console.log("\n🎉 All endpoints are working!");
  } catch (error) {
    console.error("❌ Test failed:", error.response?.data || error.message);
  }
}

// Run the test
testEndpoints();
