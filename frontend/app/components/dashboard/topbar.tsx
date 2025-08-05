"use client";

import { Avatar, AvatarFallback } from "@radix-ui/react-avatar";
import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
} from "@radix-ui/react-dropdown-menu";
import { useAuth } from "../../hooks/use-auth";
import { LogOut, ChevronDown } from "lucide-react";
import { Button } from "../ui/button";
import { useState } from "react";

export function Topbar() {
	const { user, logout } = useAuth();
	const [isOpen, setIsOpen] = useState(false);

	const handleLogout = () => {
		logout();
		setIsOpen(false);
	};

	return (
		<header className="bg-white border-b border-gray-200/60 backdrop-blur-sm bg-white/80 sticky top-0 z-50">
			<div className="flex items-center justify-between px-6 py-4">
				<div className="flex items-center space-x-3">
					<div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
						<span className="text-white font-semibold text-sm">AI</span>
					</div>
					<div>
						<h1 className="text-xl font-bold text-gray-900">
							AI Calling System
						</h1>
						<p className="text-xs text-gray-500">Dashboard</p>
					</div>
				</div>

				<div className="flex items-center">
					<DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								className="group relative flex items-center space-x-2 px-3 py-2 h-auto rounded-full hover:bg-gray-50 transition-all duration-200 border border-transparent hover:border-gray-200"
							>
								<div className="relative">
									<Avatar className="h-8 w-8 ring-2 ring-white shadow-sm">
										<AvatarFallback className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white font-semibold text-sm shadow-inner">
											{user?.email?.charAt(0).toUpperCase() || "U"}
										</AvatarFallback>
									</Avatar>
									<div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 border-2 border-white rounded-full shadow-sm"></div>
								</div>
								<div className="hidden sm:flex flex-col items-start">
									<span className="text-sm font-medium text-gray-900">
										{user?.email}
									</span>
									<span className="text-xs text-gray-500 capitalize">
										{user?.role || "User"}
									</span>
								</div>
								<ChevronDown
									className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${
										isOpen ? "rotate-180" : ""
									}`}
								/>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							className="w-72 mt-2 p-3 bg-white border border-gray-200 shadow-lg rounded-lg"
							align="end"
							sideOffset={8}
						>
							<div className="px-2 py-3">
								<div className="flex items-center space-x-3">
									<div className="relative">
										<Avatar className="h-12 w-12 ring-2 ring-gray-100 shadow-sm">
											<AvatarFallback className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white font-semibold text-lg shadow-inner">
												{user?.email?.charAt(0).toUpperCase() || "U"}
											</AvatarFallback>
										</Avatar>
										<div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-400 border-2 border-white rounded-full shadow-sm"></div>
									</div>
									<div className="flex flex-col flex-1 min-w-0">
										<p className="text-sm font-semibold text-gray-900 truncate">
											{user?.email}
										</p>
										<p className="text-xs text-gray-500 capitalize">
											{user?.role || "User"}
										</p>
										<p className="text-xs text-green-600 font-medium">Online</p>
									</div>
								</div>
							</div>

							<DropdownMenuSeparator className="my-2" />

							<DropdownMenuItem
								onClick={handleLogout}
								className="flex items-center px-3 py-2.5 rounded-lg hover:bg-red-50 cursor-pointer text-red-600 hover:text-red-700 group"
							>
								<div className="mr-3 p-1.5 rounded-md bg-red-100 group-hover:bg-red-200 transition-colors">
									<LogOut className="h-4 w-4" />
								</div>
								<span className="text-sm font-medium">Sign out</span>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
		</header>
	);
}
