import { auth, db } from "@/database/firebase"
import { signOut } from "firebase/auth"
import { doc, updateDoc, onSnapshot, Unsubscribe } from "firebase/firestore"

export class SessionManager {
  private static instance: SessionManager
  private unsubscribe: Unsubscribe | null = null
  private activityTimeout: NodeJS.Timeout | null = null
  private warningTimeout: NodeJS.Timeout | null = null
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000 // 30 minutes
  private readonly WARNING_TIME = 5 * 60 * 1000 // 5 minutes before timeout

  private constructor() {}

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager()
    }
    return SessionManager.instance
  }

  async updateLastActivity(): Promise<void> {
    const user = auth.currentUser;
    if (!user?.email) return;

    try {
      const userRef = doc(db, "users", user.email);
      await updateDoc(userRef, {
        lastActivity: new Date().toISOString(),
        userId: user.uid // Ensure userId matches auth.uid
      });
    } catch (error) {
      console.error("Error updating last activity:", error);
    }
  }

  private startActivityMonitoring(): void {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    
    const resetTimer = () => {
      this.updateLastActivity()
    }

    events.forEach(event => {
      document.addEventListener(event, resetTimer, true)
    })
  }

  private startTimeoutCheck(): void {
    const checkTimeout = () => {
      const userEmail = localStorage.getItem("otpUser")
      if (!userEmail) return

      const lastActivity = localStorage.getItem("lastActivity")
      if (!lastActivity) return

      const timeSinceActivity = Date.now() - new Date(lastActivity).getTime()
      
      if (timeSinceActivity > this.SESSION_TIMEOUT) {
        this.forceLogout("Session expired due to inactivity")
      } else if (timeSinceActivity > this.SESSION_TIMEOUT - this.WARNING_TIME) {
        if (!sessionStorage.getItem('timeoutWarningShown')) {
          sessionStorage.setItem('timeoutWarningShown', 'true')
          const remainingTime = Math.ceil((this.SESSION_TIMEOUT - timeSinceActivity) / 60000)
          alert(`Your session will expire in ${remainingTime} minutes. Click "Extend Session" to continue.`)
        }
      }
    }

    this.activityTimeout = setInterval(checkTimeout, 60000) // Check every minute
  }

  startSessionMonitoring(): void {
    const userEmail = localStorage.getItem("otpUser")
    if (!userEmail) return

    // Start Firestore listener for session changes
    const userRef = doc(db, "users", userEmail)
    this.unsubscribe = onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        const userData = doc.data()
        const localSessionId = localStorage.getItem("sessionId")
        
        if (userData.currentSessionId !== localSessionId) {
          this.forceLogout("Session invalidated - logged in from another device")
        }
      }
    }, (error) => {
      console.error("Session monitoring error:", error)
    })

    // Start activity monitoring and timeout checks
    this.startActivityMonitoring()
    this.startTimeoutCheck()
  }

  stopSessionMonitoring(): void {
    if (this.unsubscribe) {
      this.unsubscribe()
      this.unsubscribe = null
    }
    
    if (this.activityTimeout) {
      clearInterval(this.activityTimeout)
      this.activityTimeout = null
    }
    
    if (this.warningTimeout) {
      clearTimeout(this.warningTimeout)
      this.warningTimeout = null
    }
  }

  private async forceLogout(reason: string): Promise<void> {
    console.log("Force logout:", reason)
    
    try {
      await signOut(auth)
    } catch (error: unknown) {
      console.error("Error during force logout:", error)
    }

    // Clear session in Firestore
    const userEmail = localStorage.getItem("otpUser")
    if (userEmail) {
      try {
        const userRef = doc(db, "users", userEmail)
        await updateDoc(userRef, {
          currentSessionId: null,
          lastActivity: new Date().toISOString()
        })
      } catch (error) {
        console.error("Error clearing session:", error)
      }
    }

    // Clear all session data
    localStorage.removeItem("otpUser")
    localStorage.removeItem("username")
    localStorage.removeItem("slug")
    localStorage.removeItem("sessionId")
    sessionStorage.clear()
    
    // Stop monitoring
    this.stopSessionMonitoring()
    
    // Redirect to signup
    window.location.href = "/view/signup"
    
    // Show notification
    alert(reason)
  }

  async extendSession(): Promise<void> {
    await this.updateLastActivity()
    sessionStorage.removeItem('timeoutWarningShown')
  }

  async logout(): Promise<void> {
    const userEmail = localStorage.getItem("otpUser")
    
    try {
      await signOut(auth)
    } catch (error) {
      console.error("Error during logout:", error)
    }

    // Clear session in Firestore
    if (userEmail) {
      try {
        const userRef = doc(db, "users", userEmail)
        await updateDoc(userRef, {
          currentSessionId: null,
          lastActivity: new Date().toISOString()
        })
      } catch (error) {
        console.error("Error clearing session:", error)
      }
    }

    // Clear local data
    localStorage.removeItem("otpUser")
    localStorage.removeItem("username")
    localStorage.removeItem("slug")
    localStorage.removeItem("sessionId")
    sessionStorage.clear()
    
    this.stopSessionMonitoring()
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${navigator.userAgent.slice(0, 20)}`
  }

  async startNewSession(): Promise<void> {
    const user = auth.currentUser;
    if (!user?.email) return;

    const sessionId = this.generateSessionId();
    
    try {
      const userRef = doc(db, "users", user.email);
      await updateDoc(userRef, {
        currentSessionId: sessionId,
        lastActivity: new Date().toISOString(),
        userId: user.uid,
        deviceInfo: {
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString()
        }
      });
      
      localStorage.setItem("sessionId", sessionId);
      localStorage.setItem("otpUser", user.email);
    } catch (error) {
      console.error("Error starting new session:", error);
    }
  }
}








