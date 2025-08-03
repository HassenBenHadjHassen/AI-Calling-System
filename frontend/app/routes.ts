import {
  type RouteConfig,
  index,
  route,
  layout,
} from "@react-router/dev/routes";

export default [
  // root index → /
  index("routes/home.tsx"),

  // /login
  route("login", "routes/login.tsx"),

  // /dashboard  (inferred from routes/dashboard.tsx)
  layout("routes/dashboard.tsx", [
    // /dashboard/upload
    route("upload", "routes/dashboard/upload.tsx"),

    // /dashboard/leads
    route("leads", "routes/dashboard/leads.tsx"),

    // /dashboard/campaign
    route("campaign", "routes/dashboard/campaign.tsx"),

    // /dashboard/activity
    route("activity", "routes/dashboard/activity.tsx"),

    // /dashboard/stats
    route("stats", "routes/dashboard/stats.tsx"),
  ]),
] satisfies RouteConfig;
