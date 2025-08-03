"use client";

import { Avatar, AvatarFallback } from "@radix-ui/react-avatar";
import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuItem,
} from "@radix-ui/react-dropdown-menu";
import { useAuth } from "../../hooks/use-auth";
import { LogOut, User } from "lucide-react";
import { Button } from "../ui/button";

export function Topbar() {
	const { user, logout } = useAuth();

	const handleLogout = () => {
		logout();
	};

	return (
		<header className="bg-white shadow-sm border-b border-gray-200">
			<div className="flex items-center justify-between px-6 py-4">
				<div className="flex items-center">
					<h2 className="text-xl font-semibold text-gray-800">Dashboard</h2>
				</div>

				<div className="flex items-center space-x-4">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" className="relative h-8 w-8 rounded-full">
								<Avatar className="h-8 w-8">
									<AvatarFallback>
										{user?.email?.charAt(0).toUpperCase() || "U"}
									</AvatarFallback>
								</Avatar>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent className="w-56" align="end" forceMount>
							<DropdownMenuItem className="flex items-center">
								<User className="mr-2 h-4 w-4" />
								<div className="flex flex-col space-y-1">
									<p className="text-sm font-medium">{user?.email}</p>
									<p className="text-xs text-muted-foreground">{user?.role}</p>
								</div>
							</DropdownMenuItem>
							<DropdownMenuItem onClick={handleLogout}>
								<LogOut className="mr-2 h-4 w-4" />
								<span>Log out</span>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
		</header>
	);
}
