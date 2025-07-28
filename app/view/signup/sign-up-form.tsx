"use client"
import { useState, useEffect } from "react"
import { signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider } from "firebase/auth"
import { auth, db } from "@/database/firebase"
import { doc, setDoc, getDoc } from "firebase/firestore"
import { useRouter } from "next/navigation"

export default function SignUpForm() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [showOtpForm] = useState(false)

  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
  }

  const generateSessionId = (): string => {
    return Math.random().toString(36).substring(2) + Date.now().toString(36)
  }

  const handleGoogleSignUp = async () => {
    setIsLoading(true)
    try {
      console.log("=== Starting Google sign-up ===")
      const provider = new GoogleAuthProvider()
      provider.addScope('email')
      provider.addScope('profile')
      
      // Try popup first, fallback to redirect
      try {
        console.log("Trying popup...")
        const result = await signInWithPopup(auth, provider)
        await handleAuthResult(result)
      } catch (popupError: any) {
        console.log("Popup failed, trying redirect:", popupError.code)
        if (popupError.code === 'auth/popup-blocked' || popupError.code === 'auth/popup-closed-by-user') {
          console.log("Using redirect instead...")
          await signInWithRedirect(auth, provider)
        } else {
          throw popupError
        }
      }
      
    } catch (error: any) {
      console.error("=== Google sign-up error ===")
      console.error("Error:", error)
      setIsLoading(false)
      alert(`Sign-up failed: ${error.code} - ${error.message}`)
    }
  }

  const handleAuthResult = async (result: any) => {
    const user = result.user
    console.log("Google sign-in successful:", user.email)
    console.log("User auth token:", await user.getIdToken())

    if (user && user.email) {
      try {
        const userDocRef = doc(db, "users", user.email)
        const userDoc = await getDoc(userDocRef)
        const sessionId = generateSessionId()
        
        console.log("About to write to Firestore...")
        
        if (userDoc.exists()) {
          await setDoc(userDocRef, {
            currentSessionId: sessionId,
            lastActivity: new Date().toISOString(),
            userId: user.uid,
            deviceInfo: {
              userAgent: navigator.userAgent,
              timestamp: new Date().toISOString()
            }
          }, { merge: true })
        } else {
          await setDoc(userDocRef, {
            email: user.email,
            displayName: user.displayName,
            currentSessionId: sessionId,
            lastActivity: new Date().toISOString(),
            userId: user.uid,
            createdAt: new Date().toISOString(),
            deviceInfo: {
              userAgent: navigator.userAgent,
              timestamp: new Date().toISOString()
            }
          })
        }
        
        localStorage.setItem("sessionId", sessionId);
        // Start session monitoring immediately
        const sessionManager = SessionManager.getInstance();
        sessionManager.startSessionMonitoring();
        
        router.push("/view/dashboard")
      } catch (firestoreError) {
        console.error("Firestore error:", firestoreError)
        alert(`Database error: ${firestoreError.message}`)
      }
    }
  }

  useEffect(() => {
    // Debug current domain
    console.log("=== Domain Debug ===")
    console.log("Current domain:", window.location.hostname)
    console.log("Current origin:", window.location.origin)
    console.log("Current href:", window.location.href)
    
    // Debug Firebase config
    console.log("=== Firebase Config Debug ===")
    console.log("API Key:", process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.substring(0, 10) + "...")
    console.log("Auth Domain:", process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN)
    console.log("Project ID:", process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID)
    console.log("Auth object:", auth)
    console.log("Auth app:", auth.app)
    
    const handleRedirectResult = async () => {
      try {
        console.log("=== Checking redirect result ===")
        const result = await getRedirectResult(auth)
        console.log("Redirect result:", result)
        
        if (result && result.user) {
          await handleAuthResult(result)
        } else {
          console.log("No redirect result found")
        }
      } catch (error: any) {
        console.error("=== Redirect result error ===")
        console.error("Error:", error)
      } finally {
        setIsLoading(false)
      }
    }

    handleRedirectResult()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 w-full max-w-md border border-white/20">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Join WildMind</h1>
          <p className="text-gray-300">Create your account to get started</p>
        </div>

        {!showOtpForm ? (
          <div className="space-y-4">
            <button
              onClick={handleGoogleSignUp}
              disabled={isLoading}
              className="w-full bg-white text-gray-900 py-3 px-4 rounded-lg font-medium hover:bg-gray-100 transition-colors flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="text-center text-white">
            <p>OTP form would go here</p>
          </div>
        )}

        <div className="mt-6 text-center">
          <p className="text-gray-300 text-sm">
            Already have an account?{" "}
            <a href="/view/login" className="text-blue-400 hover:text-blue-300 font-medium">
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
