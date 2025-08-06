const {
	PrismaClient,
	LeadStatus,
	ScheduledCallStatus,
} = require("@prisma/client");

const prisma = new PrismaClient();

async function testOverdueCalls() {
	try {
		console.log("🧪 Testing overdue calls functionality...");

		// Create a test lead with a scheduled call in the past
		const pastDate = new Date();
		pastDate.setHours(pastDate.getHours() - 2); // 2 hours ago

		const testLead = await prisma.lead.create({
			data: {
				name: "Test Lead - Overdue",
				phone1: "+1234567890",
				status: LeadStatus.SCHEDULED,
				scheduledCallAt: pastDate,
				scheduledCallStatus: ScheduledCallStatus.PENDING,
				retryCount: 1,
			},
		});

		console.log(
			`✅ Created test lead: ${
				testLead.id
			} with scheduled call at ${pastDate.toLocaleString()}`
		);

		// Test the overdue calls endpoint
		const response = await fetch(
			"http://localhost:3000/api/calls/trigger/overdue",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
			}
		);

		const result = await response.json();
		console.log("📅 Overdue calls processing result:", result);

		// Verify the lead was updated
		const updatedLead = await prisma.lead.findUnique({
			where: { id: testLead.id },
		});

		console.log("📊 Lead status after processing:", {
			id: updatedLead.id,
			status: updatedLead.status,
			scheduledCallAt: updatedLead.scheduledCallAt,
			scheduledCallStatus: updatedLead.scheduledCallStatus,
			retryCount: updatedLead.retryCount,
		});

		// Clean up test data
		await prisma.lead.delete({
			where: { id: testLead.id },
		});

		console.log("🧹 Cleaned up test data");
	} catch (error) {
		console.error("❌ Test failed:", error);
	} finally {
		await prisma.$disconnect();
	}
}

// Run the test if this file is executed directly
if (require.main === module) {
	testOverdueCalls();
}

module.exports = { testOverdueCalls };
