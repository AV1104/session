"use client"

import { useEffect, useState } from 'react'
import { SessionManager } from '@/app/utils/sessionManager'

export default function SessionStatus() {
  const [timeLeft, setTimeLeft] = useState<number | null>(null)

  useEffect(() => {
    const interval = setInterval(() => {
      const userEmail = localStorage.getItem("otpUser")
      if (userEmail) {
        // This would require exposing a method to get remaining time
        // You can implement this if needed
      }
    }, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [])

  const handleExtendSession = () => {
    const sessionManager = SessionManager.getInstance()
    sessionManager.extendSession()
  }

  return (
    <div className="fixed bottom-4 right-4 bg-gray-800 text-white p-2 rounded text-sm">
      <button 
        onClick={handleExtendSession}
        className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-xs"
      >
        Extend Session
      </button>
    </div>
  )
}