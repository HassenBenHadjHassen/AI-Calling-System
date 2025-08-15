import { Link, NavLink } from "react-router";
import { useTranslation } from "react-i18next";
import {
	Upload,
	Users,
	Play,
	Activity,
	BarChart3,
	Phone,
	X,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { useMemo } from "react";

type SidebarProps = Readonly<{
	isOpen?: boolean;
	onClose?: () => void;
}>;

export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
	const { t } = useTranslation();

	const navigation = useMemo(
		() => [
			{ name: t("nav.upload"), href: "/dashboard/upload", icon: Upload },
			{ name: t("nav.leads"), href: "/dashboard/leads", icon: Users },
			{ name: t("nav.campaign"), href: "/dashboard/campaign", icon: Play },
			{ name: t("nav.activity"), href: "/dashboard/activity", icon: Activity },
			{ name: t("nav.stats"), href: "/dashboard/stats", icon: BarChart3 },
		],
		[t]
	);

	return (
		<>
			{/* Desktop sidebar */}
			<div className="hidden sm:flex flex-col w-64 bg-white shadow-lg">
				<Link
					to="/dashboard"
					className="flex items-center justify-center h-16 px-4 bg-blue-600"
				>
					<Phone className="h-8 w-8 text-white mr-2" />
					<h1 className="text-xl font-bold text-white">AI Calling</h1>
				</Link>

				<nav className="flex-1 px-4 py-6 space-y-2">
					{navigation.map((item) => (
						<NavLink
							key={item.name}
							to={item.href}
							className={({ isActive }) =>
								cn(
									"flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors",
									isActive
										? "bg-blue-100 text-blue-700"
										: "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
								)
							}
							title={item.name}
						>
							<item.icon className="mr-3 h-5 w-5" />
							<span>{item.name}</span>
						</NavLink>
					))}
				</nav>
			</div>

			{/* Mobile drawer wrapper with fade */}
			<div
				className={cn(
					"sm:hidden fixed inset-0 z-50 transition-opacity duration-300",
					isOpen
						? "opacity-100 pointer-events-auto"
						: "opacity-0 pointer-events-none"
				)}
			>
				{/* Backdrop */}
				<button
					type="button"
					aria-label="Close menu"
					className="absolute inset-0 bg-black/40"
					onClick={onClose}
				/>
				{/* Sliding drawer */}
				<div
					className={cn(
						"absolute left-0 top-0 h-full w-64 bg-white shadow-xl z-50 flex flex-col transform transition-transform duration-300",
						isOpen ? "translate-x-0" : "-translate-x-full"
					)}
				>
					<div className="flex items-center justify-between h-16 px-4 bg-blue-600">
						<div className="flex items-center space-x-2">
							<Phone className="h-6 w-6 text-white" />
							<h1 className="text-lg font-bold text-white">AI Calling</h1>
						</div>
						<button
							aria-label="Close menu"
							className="p-2 rounded-md hover:bg-white/10 text-white"
							onClick={onClose}
						>
							<X className="h-5 w-5" />
						</button>
					</div>
					<nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
						{navigation.map((item) => (
							<NavLink
								key={item.name}
								to={item.href}
								onClick={onClose}
								className={({ isActive }) =>
									cn(
										"flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
										isActive
											? "bg-blue-100 text-blue-700"
											: "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
									)
								}
								title={item.name}
							>
								<item.icon className="mr-3 h-5 w-5" />
								<span>{item.name}</span>
							</NavLink>
						))}
					</nav>
				</div>
			</div>
		</>
	);
}
