import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
	// root index → /
	index("routes/home.tsx"),

	// /login
	route("login", "routes/login.tsx"),

	// /dashboard → overview page
	route("dashboard", "routes/dashboard/_index.tsx"),

	// /dashboard/upload
	route("dashboard/upload", "routes/dashboard/upload.tsx"),

	// /dashboard/leads
	route("dashboard/leads", "routes/dashboard/leads.tsx"),

	// /dashboard/leads/:id
	route("dashboard/leads/:id", "routes/dashboard/lead-detail.tsx"),

	// /dashboard/campaign
	route("dashboard/campaign", "routes/dashboard/campaign.tsx"),

	// /dashboard/campaign/:id
	route("dashboard/campaign/:id", "routes/dashboard/campaign-detail.tsx"),

	// /dashboard/activity
	route("dashboard/activity", "routes/dashboard/activity.tsx"),

	// /dashboard/stats
	route("dashboard/stats", "routes/dashboard/stats.tsx"),
] satisfies RouteConfig;
