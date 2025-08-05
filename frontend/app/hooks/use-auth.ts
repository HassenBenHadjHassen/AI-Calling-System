import { create } from "zustand";
import { persist } from "zustand/middleware";
import { authAPI, type User } from "../services/api";
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router";

interface AuthState {
	user: User | null;
	token: string | null;
	isAuthenticated: boolean;
	login: (email: string, password: string) => Promise<boolean>;
	logout: () => void;
	setUser: (user: User, token: string) => void;
}

export const useAuth = create<AuthState>()(
	persist(
		(set, get) => ({
			user: null,
			token: null,
			isAuthenticated: false,

			login: async (email: string, password: string) => {
				try {
					const response = await authAPI.login(email, password);
					if (response.success && response.data.token) {
						localStorage.setItem("authToken", response.data.token);

						// Get user profile
						const profileResponse = await authAPI.getProfile();
						if (profileResponse.success) {
							set({
								user: profileResponse.data,
								token: response.data.token,
								isAuthenticated: true,
							});
							return true;
						}
					}
					return false;
				} catch (error) {
					console.error("Login error:", error);
					return false;
				}
			},

			logout: () => {
				localStorage.removeItem("authToken");
				set({
					user: null,
					token: null,
					isAuthenticated: false,
				});
			},

			setUser: (user: User, token: string) => {
				set({
					user,
					token,
					isAuthenticated: true,
				});
			},
		}),
		{
			name: "auth-storage",
		}
	)
);

// Hook to handle client-side authentication with SSR safety
export const useClientSideAuth = () => {
	const { isAuthenticated } = useAuth();
	const navigate = useNavigate();
	const [isClient, setIsClient] = useState(false);

	useEffect(() => {
		setIsClient(true);
	}, []);

	const redirectIfNotAuthenticated = useCallback(
		(redirectTo: string = "/login") => {
			if (isClient && !isAuthenticated) {
				navigate(redirectTo, { replace: true });
			}
		},
		[isClient, isAuthenticated, navigate]
	);

	const redirectIfAuthenticated = useCallback(
		(redirectTo: string = "/dashboard") => {
			if (isClient && isAuthenticated) {
				navigate(redirectTo, { replace: true });
			}
		},
		[isClient, isAuthenticated, navigate]
	);

	return {
		isAuthenticated,
		isClient,
		redirectIfNotAuthenticated,
		redirectIfAuthenticated,
	};
};
