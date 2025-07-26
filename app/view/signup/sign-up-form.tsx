"use client"

import { useState, useEffect, type FormEvent, useRef } from "react"
import axios from "axios"
import { useRouter } from "next/navigation"
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth"
import { auth, db } from "../../../database/firebase"
import { doc, setDoc, getDoc } from "firebase/firestore"
import { v4 as uuidv4 } from "uuid"
import Image from "next/image"
import { getImageUrl } from "@/routes/imageroute"
import { initializeTokens } from "@/app/utils/tokenManager"

export default function SignUpForm() {
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [username, setUsername] = useState("")
  const [error, setError] = useState("")
  const [processing, setProcessing] = useState(false)
  const [showOtpForm, setShowOtpForm] = useState(false)
  const [showUsernameForm, setShowUsernameForm] = useState(false)
  const router = useRouter()

  const handleGoogleLogin = async () => {
    try {
      setProcessing(true)
      setError("")
      
      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({
        prompt: 'select_account'
      })
      
      const result = await signInWithPopup(auth, provider)
      const userEmail = result.user.email

      if (!userEmail) throw new Error("No email from Google user")

      // Generate unique session ID for this device/login
      const sessionId = uuidv4()
      const loginTimestamp = new Date().toISOString()

      localStorage.setItem("otpUser", userEmail)
      localStorage.setItem("sessionId", sessionId)
      
      const userRef = doc(db, "users", userEmail)
      const userSnap = await getDoc(userRef)

      if (userSnap.exists()) {
        const data = userSnap.data()
        
        // Update session info - this will invalidate other sessions
        await setDoc(userRef, {
          ...data,
          currentSessionId: sessionId,
          lastLoginAt: loginTimestamp,
          lastActivity: loginTimestamp,
          deviceInfo: navigator.userAgent
        }, { merge: true })

        if (data.username) {
          localStorage.setItem("username", data.username)
          router.push(`/view/home/${data.username}`)
        } else {
          setShowUsernameForm(true)
        }
      } else {
        await setDoc(userRef, { 
          email: userEmail,
          currentSessionId: sessionId,
          lastLoginAt: loginTimestamp,
          lastActivity: loginTimestamp,
          deviceInfo: navigator.userAgent
        })
        setShowUsernameForm(true)
      }
    } catch (err: any) {
      console.error("Google sign-in error:", err)
      
      if (err.code === 'auth/unauthorized-domain') {
        setError("This domain is not authorized for Google sign-in. Please contact support.")
      } else if (err.code === 'auth/popup-closed-by-user') {
        setError("Sign-in was cancelled. Please try again.")
      } else if (err.code === 'auth/popup-blocked') {
        setError("Popup was blocked. Please allow popups and try again.")
      } else {
        setError("Google sign-in failed. Please try again.")
      }
    } finally {
      setProcessing(false)
    }
  }

  const handleUsernameSubmit = async () => {
    const email = localStorage.getItem("otpUser")
    if (email && username.trim()) {
      try {
        setProcessing(true)
        const realUsername = username.trim()
        const slug = `${realUsername.toLowerCase().replace(/\s+/g, "-")}-${uuidv4().slice(0, 6)}`

        await setDoc(
          doc(db, "users", email),
          {
            email,
            username: realUsername,
            slug,
          },
          { merge: true },
        )

        localStorage.setItem("username", realUsername)
        localStorage.setItem("slug", slug)
        
        // Initialize tokens for new user
        initializeTokens()

        router.push(`/view/home/${slug}`)
      } catch (error) {
        console.error("Username submission error:", error)
        setError("Failed to save username. Please try again.")
      } finally {
        setProcessing(false)
      }
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {!showOtpForm && !showUsernameForm && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-3xl font-bold mb-2">Welcome to WildMind</h1>
              <p className="text-gray-400">Sign in to continue</p>
            </div>

            {error && (
              <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <button
              onClick={handleGoogleLogin}
              disabled={processing}
              className="w-full bg-white text-black py-3 px-4 rounded-lg font-medium hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {processing ? (
                "Signing in..."
              ) : (
                <>
                  <Image src="/google-icon.png" alt="Google" width={20} height={20} />
                  Continue with Google
                </>
              )}
            </button>
          </div>
        )}

        {showUsernameForm && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Choose Your Username</h2>
              <p className="text-gray-400">This will be your display name</p>
            </div>

            {error && (
              <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
                disabled={processing}
              />
            </div>

            <button
              onClick={handleUsernameSubmit}
              disabled={processing || !username.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 py-3 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? "Creating Account..." : "Continue"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
