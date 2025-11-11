"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Plus, Trash2, LogOut, RefreshCw, CheckCircle2, XCircle, Globe, Activity, Clock, AlertCircle, TrendingUp } from "lucide-react"
import type { UrlWithStatus } from "@/lib/types"
import { formatBeaumontDateCompact } from "@/lib/date-utils"

type ServiceStatus = "up" | "down"

interface CheckHistory {
  timestamp: string
  statusCode: number
  responseTime: number
  status: ServiceStatus
}

export default function AdminDashboard() {
  const router = useRouter()
  const [urls, setUrls] = useState<UrlWithStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [checking, setChecking] = useState(false)
  const [selectedUrl, setSelectedUrl] = useState<UrlWithStatus | null>(null)
  const [history, setHistory] = useState<CheckHistory[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [browserChecking, setBrowserChecking] = useState(false)
  const [browserResults, setBrowserResults] = useState<Record<number, { status: ServiceStatus; responseTimeMs: number | null; via: "img" | "iframe" | "timeout" | "error" }>>({})

  // Form state
  const [newUrl, setNewUrl] = useState("")
  const [newName, setNewName] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch("/api/auth/session")
      const data = await res.json()
      if (data.authenticated) {
        setAuthenticated(true)
        fetchUrls()
      } else {
        router.push("/login")
      }
    } catch (error) {
      router.push("/login")
    }
  }

  const fetchUrls = async () => {
    try {
      const res = await fetch("/api/urls")
      const data = await res.json()
      setUrls(data)
    } catch (error) {
      console.error("Error fetching URLs:", error)
    } finally {
      setLoading(false)
    }
  }

  // Client-side, on-campus check using resource loading (no CORS)
  const runBrowserChecks = async () => {
    if (urls.length === 0) return
    setBrowserChecking(true)
    setBrowserResults({})
    const timeoutMs = 6000

    // Helper: probe via <img> to favicon (best-effort)
    const probeWithImage = (targetUrl: string): Promise<{ ok: boolean; ms: number }> => {
      return new Promise((resolve) => {
        const start = performance.now()
        const img = new Image()
        const url = new URL(targetUrl)
        // Try to hit a lightweight asset; default to /favicon.ico
        const bust = `__cb=${Date.now()}`
        const candidatePath = url.pathname === "/" ? "/favicon.ico" : url.pathname
        img.src = `${url.origin}${candidatePath}${candidatePath.includes("?") ? "&" : "?"}${bust}`

        let done = false
        const finish = (ok: boolean) => {
          if (done) return
          done = true
          const ms = Math.round(performance.now() - start)
          resolve({ ok, ms })
        }
        const to = window.setTimeout(() => finish(false), timeoutMs)
        img.onload = () => {
          window.clearTimeout(to)
          finish(true)
        }
        img.onerror = () => {
          window.clearTimeout(to)
          finish(false)
        }
      })
    }

    // Helper: probe via <iframe> fallback
    const probeWithIframe = (targetUrl: string): Promise<{ ok: boolean; ms: number }> => {
      return new Promise((resolve) => {
        const start = performance.now()
        const iframe = document.createElement("iframe")
        iframe.style.display = "none"
        iframe.referrerPolicy = "no-referrer"
        const bustUrl = targetUrl.includes("?") ? `${targetUrl}&__cb=${Date.now()}` : `${targetUrl}?__cb=${Date.now()}`
        iframe.src = bustUrl

        let done = false
        const finish = (ok: boolean) => {
          if (done) return
          done = true
          const ms = Math.round(performance.now() - start)
          try {
            document.body.removeChild(iframe)
          } catch {}
          resolve({ ok, ms })
        }
        const to = window.setTimeout(() => finish(false), timeoutMs)
        iframe.onload = () => {
          window.clearTimeout(to)
          finish(true)
        }
        iframe.onerror = () => {
          window.clearTimeout(to)
          finish(false)
        }
        document.body.appendChild(iframe)
      })
    }

    // Run checks sequentially to avoid overwhelming network; could be parallel if desired
    const results: Record<number, { status: ServiceStatus; responseTimeMs: number | null; via: "img" | "iframe" | "timeout" | "error" }> = {}
    for (const u of urls) {
      try {
        // First try image
        const imgRes = await probeWithImage(u.url)
        if (imgRes.ok) {
          results[u.id] = { status: "up", responseTimeMs: imgRes.ms, via: "img" }
        } else {
          // Fallback to iframe
          const ifRes = await probeWithIframe(u.url)
          if (ifRes.ok) {
            results[u.id] = { status: "up", responseTimeMs: ifRes.ms, via: "iframe" }
          } else {
            results[u.id] = { status: "down", responseTimeMs: null, via: "timeout" }
          }
        }
      } catch {
        results[u.id] = { status: "down", responseTimeMs: null, via: "error" }
      }
      setBrowserResults((prev) => ({ ...prev, [u.id]: results[u.id] }))
    }
    setBrowserChecking(false)
  }

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
      router.push("/login")
    } catch (error) {
      console.error("Logout error:", error)
    }
  }

  const handleAddUrl = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const res = await fetch("/api/urls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: newUrl, name: newName }),
      })

      if (!res.ok) {
        const error = await res.json()
        alert(error.error || "Failed to add URL")
        return
      }

      setShowAddDialog(false)
      setNewUrl("")
      setNewName("")
      
      // Wait a moment for the status check to complete, then refresh
      setTimeout(() => {
        fetchUrls()
      }, 2000)
    } catch (error) {
      console.error("Error adding URL:", error)
      alert("Failed to add URL")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteUrl = async () => {
    if (!deleteId) return

    try {
      const res = await fetch(`/api/urls/${deleteId}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        alert("Failed to delete URL")
        return
      }

      setShowDeleteDialog(false)
      setDeleteId(null)
      fetchUrls()
    } catch (error) {
      console.error("Error deleting URL:", error)
      alert("Failed to delete URL")
    }
  }

  const handleCheckAll = async () => {
    setChecking(true)
    try {
      const res = await fetch("/api/check", {
        method: "POST",
      })

      if (!res.ok) {
        alert("Failed to check URLs")
        return
      }

      // Wait a bit for checks to complete, then refresh
      setTimeout(() => {
        fetchUrls()
        setChecking(false)
      }, 3000)
    } catch (error) {
      console.error("Error checking URLs:", error)
      alert("Failed to check URLs")
      setChecking(false)
    }
  }

  const getStatusBadge = (isUp: boolean | null) => {
    if (isUp === null) {
      return (
        <Badge variant="outline" className="gap-1">
          <XCircle className="h-3 w-3" />
          Unknown
        </Badge>
      )
    }
    return isUp ? (
      <Badge className="gap-1 bg-emerald-500 hover:bg-emerald-600 text-white">
        <CheckCircle2 className="h-3 w-3" />
        UP
      </Badge>
    ) : (
      <Badge className="gap-1 bg-red-500 hover:bg-red-600 text-white">
        <XCircle className="h-3 w-3" />
        DOWN
      </Badge>
    )
  }

  const formatResponseTime = (ms: number | null) => {
    if (ms === null) return "N/A"
    return `${ms}ms`
  }

  const fetchHistory = async (urlId: number) => {
    setLoadingHistory(true)
    try {
      const response = await fetch(`/api/urls/${urlId}`)
      const data = await response.json()
      
      // Transform status history to CheckHistory format
      const historyData: CheckHistory[] = data.statuses.map((status: any) => ({
        timestamp: formatBeaumontDateCompact(status.checked_at),
        statusCode: status.status_code ?? 0,
        responseTime: status.response_time ?? 0,
        status: status.is_up ? "up" : "down",
      }))
      
      setHistory(historyData)
    } catch (error) {
      console.error("Error fetching history:", error)
      setHistory([])
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleUrlClick = (url: UrlWithStatus) => {
    setSelectedUrl(url)
    fetchHistory(url.id)
  }

  const getStatusBadgeForHistory = (status: ServiceStatus) => {
    switch (status) {
      case "up":
        return { text: "UP", className: "bg-emerald-500 hover:bg-emerald-600 text-white" }
      case "down":
        return { text: "DOWN", className: "bg-red-500 hover:bg-red-600 text-white" }
    }
  }

  if (!authenticated || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Admin Dashboard</h1>
            <p className="mt-2 text-muted-foreground">Manage URLs and monitor service status</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push("/")}>
              View Home
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>

        {/* Actions */}
        <div className="mb-6 flex flex-wrap gap-4">
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add URL
          </Button>

          <Button
            variant="outline"
            onClick={handleCheckAll}
            disabled={checking}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${checking ? "animate-spin" : ""}`} />
            {checking ? "Checking..." : "Check All URLs"}
          </Button>

          <Button
            variant="outline"
            onClick={runBrowserChecks}
            disabled={browserChecking || urls.length === 0}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${browserChecking ? "animate-spin" : ""}`} />
            {browserChecking ? "Running On-campus Check..." : "On-campus Check (browser)"}
          </Button>

          <Button
            variant="outline"
            onClick={async () => {
              setExporting(true)
              try {
                const response = await fetch("/api/archive/export")
                if (!response.ok) {
                  const error = await response.json().catch(() => ({ error: "Failed to export archive" }))
                  alert(error.error || "Failed to export archive. Make sure you have archived records.")
                  return
                }
                const blob = await response.blob()
                const url = window.URL.createObjectURL(blob)
                const a = document.createElement("a")
                a.href = url
                a.download = `url-status-archive-${new Date().toISOString().split("T")[0]}.txt`
                document.body.appendChild(a)
                a.click()
                window.URL.revokeObjectURL(url)
                document.body.removeChild(a)
              } catch (error: any) {
                console.error("Error exporting archive:", error)
                alert("Failed to export archive: " + (error.message || "Unknown error"))
              } finally {
                setExporting(false)
              }
            }}
            disabled={exporting}
          >
            <Activity className={`mr-2 h-4 w-4 ${exporting ? "animate-spin" : ""}`} />
            {exporting ? "Exporting..." : "Export Archive"}
          </Button>

          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New URL</DialogTitle>
                <DialogDescription>
                  Add a new URL to monitor. The status will be checked immediately.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddUrl}>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="e.g., Banner Self Service 8 Production"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="url">URL</Label>
                    <Input
                      id="url"
                      type="url"
                      placeholder="https://example.com"
                      value={newUrl}
                      onChange={(e) => setNewUrl(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Adding..." : "Add URL"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* URLs List */}
        <div className="space-y-4">
          {urls.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Globe className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">
                  No URLs added yet. Click "Add URL" to get started.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {urls.map((url) => (
                <Card 
                  key={url.id} 
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => handleUrlClick(url)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg mb-1 truncate">{url.name}</CardTitle>
                        <CardDescription className="break-all text-xs">{url.url}</CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteId(url.id)
                          setShowDeleteDialog(true)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Status</span>
                      {getStatusBadge(url.latest_status?.is_up ?? null)}
                    </div>

                    {url.latest_status && (
                      <>
                        {url.latest_status.status_code && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground flex items-center gap-1">
                              <Activity className="h-3 w-3" />
                              Status Code
                            </span>
                            <Badge variant="secondary">{url.latest_status.status_code}</Badge>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Response Time
                          </span>
                          <span className="text-sm font-medium">
                            {formatResponseTime(url.latest_status.response_time)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Last Checked</span>
                          <span className="text-xs text-muted-foreground">
                            {formatBeaumontDateCompact(url.latest_status.checked_at)}
                          </span>
                        </div>
                      </>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="text-sm text-muted-foreground">Uptime (7 days)</span>
                      <span className="text-sm font-semibold">
                        {url.uptime_percentage.toFixed(1)}%
                      </span>
                    </div>

                    {browserResults[url.id] && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          On-campus (browser)
                        </span>
                        <div className="flex items-center gap-2">
                          <Badge className={`${getStatusBadgeForHistory(browserResults[url.id].status).className}`}>
                            {getStatusBadgeForHistory(browserResults[url.id].status).text}
                          </Badge>
                          <span className="text-xs text-muted-foreground font-mono">
                            {browserResults[url.id].responseTimeMs !== null ? `${browserResults[url.id].responseTimeMs}ms` : "N/A"}
                          </span>
                        </div>
                      </div>
                    )}

                    {url.latest_status?.error_message && (
                      <div className="mt-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                        <p className="text-xs text-destructive flex items-start gap-2">
                          <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                          {url.latest_status.error_message}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the monitoring for this URL. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUrl}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* History Dialog */}
      <Dialog open={!!selectedUrl} onOpenChange={() => setSelectedUrl(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="text-2xl">{selectedUrl?.name}</DialogTitle>
            <DialogDescription className="break-all">{selectedUrl?.url}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold mb-4">Check History</h3>
              {loadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <div className="flex flex-col items-center gap-4">
                    <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    <p className="text-sm text-muted-foreground">Loading history...</p>
                  </div>
                </div>
              ) : history.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-8">
                    <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No check history available for the last 7 days</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="bg-muted/50 grid grid-cols-12 gap-4 px-4 py-3 text-xs font-medium text-muted-foreground">
                    <div className="col-span-5">Time</div>
                    <div className="col-span-2">Status</div>
                    <div className="col-span-2">Code</div>
                    <div className="col-span-3">Response</div>
                  </div>
                  {history.map((check, index) => (
                    <div
                      key={index}
                      className={`grid grid-cols-12 gap-4 px-4 py-3 border-t border-border items-center ${
                        check.status === "down" ? "bg-red-50/50 dark:bg-red-950/20" : "bg-background hover:bg-muted/30"
                      } transition-colors`}
                    >
                      <div className="col-span-5 text-sm text-muted-foreground">{check.timestamp}</div>
                      <div className="col-span-2">
                        <Badge className={`${getStatusBadgeForHistory(check.status).className} text-xs`}>
                          {getStatusBadgeForHistory(check.status).text}
                        </Badge>
                      </div>
                      <div className="col-span-2 text-sm font-mono font-medium">{check.statusCode}</div>
                      <div className="col-span-3 text-sm font-mono font-medium">{check.responseTime}ms</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  )
}
