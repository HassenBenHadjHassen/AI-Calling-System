"use client";

import { useEffect } from "react";
import { Navigate, Outlet } from "react-router";
import { Sidebar } from "~/components/dashboard/sidebar";
import { Topbar } from "~/components/dashboard/topbar";
import { useAuth } from "~/hooks/use-auth";
import { socketService } from "~/lib/socket";

export default function Dashboard() {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      // Connect to socket when dashboard loads
      socketService.connect();
      // Start simulating activity for demo
      socketService.simulateActivity();

      return () => {
        socketService.disconnect();
      };
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
