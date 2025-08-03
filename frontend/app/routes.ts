import {
	type RouteConfig,
	index,
	route,
	layout,
} from "@react-router/dev/routes";

export default [
	index("routes/home.tsx"),
	route("login", "routes/login.tsx"),
	layout("routes/dashboard.tsx", [
		route("dashboard/upload", "routes/dashboard/upload.tsx"),
		route("dashboard/leads", "routes/dashboard/leads.tsx"),
		route("dashboard/campaign", "routes/dashboard/campaign.tsx"),
		route("dashboard/activity", "routes/dashboard/activity.tsx"),
		route("dashboard/stats", "routes/dashboard/stats.tsx"),
	]),
] satisfies RouteConfig;
