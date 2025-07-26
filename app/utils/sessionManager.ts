import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore"
import { signOut } from "firebase/auth"
import { auth, db } from "@/database/firebase"

export class SessionManager {
  private static instance: SessionManager
  private unsubscribe: (() => void) | null = null
  private timeoutInterval: NodeJS.Timeout | null = null
  
  // Session timeout configurations (in milliseconds)
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000 // 30 minutes
  private readonly ACTIVITY_CHECK_INTERVAL = 60 * 1000 // Check every minute
  private readonly WARNING_TIME = 5 * 60 * 1000 // Warn 5 minutes before timeout

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager()
    }
    return SessionManager.instance
  }

  async validateSession(): Promise<boolean> {
    const userEmail = localStorage.getItem("otpUser")
    const localSessionId = localStorage.getItem("sessionId")

    if (!userEmail || !localSessionId) {
      return false
    }

    try {
      const userRef = doc(db, "users", userEmail)
      const userSnap = await getDoc(userRef)

      if (!userSnap.exists()) {
        return false
      }

      const userData = userSnap.data()
      const currentSessionId = userData.currentSessionId
      const lastActivity = userData.lastActivity

      // Check if session ID matches
      if (currentSessionId !== localSessionId) {
        await this.forceLogout("Session invalidated - logged in from another device")
        return false
      }

      // Check session timeout
      if (lastActivity) {
        const timeSinceLastActivity = Date.now() - new Date(lastActivity).getTime()
        if (timeSinceLastActivity > this.SESSION_TIMEOUT) {
          await this.forceLogout("Session expired due to inactivity")
          return false
        }
      }

      // Update last activity
      await this.updateLastActivity()
      return true
    } catch (error) {
      console.error("Session validation error:", error)
      return false
    }
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
    
    if (this.timeoutInterval) {
      clearInterval(this.timeoutInterval)
      this.timeoutInterval = null
    }
    
    this.stopActivityMonitoring()
  }

  private startActivityMonitoring(): void {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    
    const activityHandler = () => {
      this.updateLastActivity()
    }

    events.forEach(event => {
      document.addEventListener(event, activityHandler, true)
    })

    // Store reference to remove listeners later
    ;(window as any).sessionActivityHandler = activityHandler
    ;(window as any).sessionEvents = events
  }

  private stopActivityMonitoring(): void {
    const activityHandler = (window as any).sessionActivityHandler
    const events = (window as any).sessionEvents

    if (activityHandler && events) {
      events.forEach((event: string) => {
        document.removeEventListener(event, activityHandler, true)
      })
    }
  }

  private startTimeoutCheck(): void {
    this.timeoutInterval = setInterval(async () => {
      const userEmail = localStorage.getItem("otpUser")
      if (!userEmail) return

      try {
        const userRef = doc(db, "users", userEmail)
        const userSnap = await getDoc(userRef)

        if (userSnap.exists()) {
          const userData = userSnap.data()
          const lastActivity = userData.lastActivity

          if (lastActivity) {
            const timeSinceLastActivity = Date.now() - new Date(lastActivity).getTime()
            const timeUntilTimeout = this.SESSION_TIMEOUT - timeSinceLastActivity

            // Show warning before timeout
            if (timeUntilTimeout <= this.WARNING_TIME && timeUntilTimeout > 0) {
              const minutesLeft = Math.ceil(timeUntilTimeout / (60 * 1000))
              this.showTimeoutWarning(minutesLeft)
            }
            
            // Force logout if session expired
            if (timeSinceLastActivity > this.SESSION_TIMEOUT) {
              await this.forceLogout("Session expired due to inactivity")
            }
          }
        }
      } catch (error) {
        console.error("Timeout check error:", error)
      }
    }, this.ACTIVITY_CHECK_INTERVAL)
  }

  private async updateLastActivity(): Promise<void> {
    const userEmail = localStorage.getItem("otpUser")
    if (!userEmail) return

    try {
      const userRef = doc(db, "users", userEmail)
      await setDoc(userRef, {
        lastActivity: new Date().toISOString()
      }, { merge: true })
    } catch (error) {
      console.error("Error updating last activity:", error)
    }
  }

  private showTimeoutWarning(minutesLeft: number): void {
    const warningShown = sessionStorage.getItem('timeoutWarningShown')
    
    if (!warningShown) {
      sessionStorage.setItem('timeoutWarningShown', 'true')
      
      const extendSession = confirm(
        `Your session will expire in ${minutesLeft} minute(s) due to inactivity. ` +
        `Click OK to extend your session or Cancel to logout now.`
      )

      if (extendSession) {
        this.updateLastActivity()
        setTimeout(() => {
          sessionStorage.removeItem('timeoutWarningShown')
        }, this.WARNING_TIME)
      } else {
        this.forceLogout("User chose to logout")
      }
    }
  }

  private async forceLogout(reason: string): Promise<void> {
    console.log("Force logout:", reason)
    
    try {
      await signOut(auth)
    } catch (error) {
      console.error("Error during force logout:", error)
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
}

