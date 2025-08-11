import { Link, NavLink } from "react-router";
import { useTranslation } from "react-i18next";
import { Upload, Users, Play, Activity, BarChart3, Phone } from "lucide-react";
import { cn } from "~/lib/utils";

export function Sidebar() {
	const { t } = useTranslation();

	const navigation = [
		{ name: t("nav.upload"), href: "/dashboard/upload", icon: Upload },
		{ name: t("nav.leads"), href: "/dashboard/leads", icon: Users },
		{ name: t("nav.campaign"), href: "/dashboard/campaign", icon: Play },
		{ name: t("nav.activity"), href: "/dashboard/activity", icon: Activity },
		{ name: t("nav.stats"), href: "/dashboard/stats", icon: BarChart3 },
	];

	return (
		<div className="flex flex-col w-16 sm:w-64 bg-white shadow-lg">
			<Link
				to="/dashboard"
				className="flex items-center justify-center h-16 px-2 sm:px-4 bg-blue-600"
			>
				<Phone className="h-6 w-6 sm:h-8 sm:w-8 text-white mr-0 sm:mr-2" />
				<h1 className="text-lg sm:text-xl font-bold text-white hidden sm:block">
					AI Calling
				</h1>
			</Link>

			<nav className="flex-1 px-2 sm:px-4 py-6 space-y-2">
				{navigation.map((item) => (
					<NavLink
						key={item.name}
						to={item.href}
						className={({ isActive }) =>
							cn(
								"flex items-center px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors",
								isActive
									? "bg-blue-100 text-blue-700"
									: "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
							)
						}
						title={item.name}
					>
						<item.icon className="mr-0 sm:mr-3 h-4 w-4 sm:h-5 sm:w-5" />
						<span className="hidden sm:block">{item.name}</span>
					</NavLink>
				))}
			</nav>
		</div>
	);
}
