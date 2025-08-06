"use client";

import type React from "react";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
	CardContent,
} from "~/components/ui/card";
import { useAuth, useClientSideAuth } from "~/hooks/use-auth";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { LanguageSwitcher } from "~/components/language-switcher";

export default function Login() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");

	const { login } = useAuth();
	const { isClient, redirectIfAuthenticated } = useClientSideAuth();
	const { t } = useTranslation();

	useEffect(() => {
		if (isClient) {
			redirectIfAuthenticated("/dashboard");
		}
	}, [isClient, redirectIfAuthenticated]);

	// Show loading state during SSR
	if (!isClient) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gray-50">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
			</div>
		);
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);
		setError("");

		try {
			const success = await login(email, password);
			if (success) {
				// Navigation will be handled by the redirectIfAuthenticated hook
			} else {
				setError(t("auth.invalidCredentials"));
			}
		} catch (err) {
			setError(t("auth.loginError"));
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
			<div className="absolute top-4 right-4">
				<LanguageSwitcher />
			</div>
			<Card className="w-full max-w-md">
				<CardHeader className="space-y-1">
					<CardTitle className="text-2xl font-bold text-center">
						{t("auth.signIn")}
					</CardTitle>
					<CardDescription className="text-center">
						{t("auth.accessDashboard")}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit} className="space-y-4">
						{error && (
							<Alert variant="destructive">
								<AlertDescription>{error}</AlertDescription>
							</Alert>
						)}

						<div className="space-y-2">
							<Label
								htmlFor="email"
								className="block text-sm font-medium text-gray-700"
							>
								{t("auth.email")}
							</Label>
							<Input
								id="email"
								type="email"
								placeholder={t("auth.enterEmail")}
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								required
								disabled={isLoading}
							/>
						</div>

						<div className="space-y-2">
							<Label
								htmlFor="password"
								className="block text-sm font-medium text-gray-700"
							>
								{t("auth.password")}
							</Label>
							<Input
								id="password"
								type="password"
								placeholder={t("auth.enterPassword")}
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
								disabled={isLoading}
							/>
						</div>

						<Button type="submit" className="w-full" disabled={isLoading}>
							{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							{t("auth.signIn")}
						</Button>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
