"use client"

import { Navigate } from "react-router"
import { useAuth } from "~/hooks/use-auth"

export default function Home() {
  const { isAuthenticated } = useAuth()

  if (isAuthenticated) {
    return <Navigate to="/dashboard/stats" replace />
  }

  return <Navigate to="/login" replace />
}
