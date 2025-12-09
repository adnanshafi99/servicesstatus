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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Plus, Trash2, LogOut, RefreshCw, CheckCircle2, XCircle, Globe, Activity, Clock, AlertCircle, TrendingUp, Edit } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
  const [environment, setEnvironment] = useState<"testing" | "production">("testing")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [editingUrl, setEditingUrl] = useState<UrlWithStatus | null>(null)
  const [checking, setChecking] = useState(false)
  const [selectedUrl, setSelectedUrl] = useState<UrlWithStatus | null>(null)
  const [history, setHistory] = useState<CheckHistory[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [refreshingUrlId, setRefreshingUrlId] = useState<number | null>(null)

  // Form state
  const [newUrl, setNewUrl] = useState("")
  const [newName, setNewName] = useState("")
  const [editUrl, setEditUrl] = useState("")
  const [editName, setEditName] = useState("")
  const [editEnvironment, setEditEnvironment] = useState<"testing" | "production">("testing")
  const [submitting, setSubmitting] = useState(false)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (authenticated) {
      fetchUrls()
    }
  }, [environment, authenticated])

  const checkAuth = async () => {
    try {
      const res = await fetch("/api/auth/session")
      const data = await res.json()
      if (data.authenticated) {
        setAuthenticated(true)
      } else {
        router.push("/login")
      }
    } catch (error) {
      router.push("/login")
    }
  }

  const fetchUrls = async () => {
    try {
      const res = await fetch(`/api/urls?environment=${environment}`)
      const data = await res.json()
      // Ensure data is an array
      if (Array.isArray(data)) {
        setUrls(data)
      } else {
        console.error("API did not return an array:", data)
        setUrls([])
      }
    } catch (error) {
      console.error("Error fetching URLs:", error)
      setUrls([])
    } finally {
      setLoading(false)
    }
  }

  // Browser-based check helper (fallback for campus-restricted URLs)
  const runBrowserCheckForUrl = async (url: UrlWithStatus): Promise<void> => {
    const timeoutMs = 6000

    // Helper: probe via <img> to favicon (best-effort)
    const probeWithImage = (targetUrl: string): Promise<{ ok: boolean; ms: number }> => {
      return new Promise((resolve) => {
        const start = performance.now()
        const img = new Image()
        const urlObj = new URL(targetUrl)
        const bust = `__cb=${Date.now()}`
        const candidatePath = urlObj.pathname === "/" ? "/favicon.ico" : urlObj.pathname
        img.src = `${urlObj.origin}${candidatePath}${candidatePath.includes("?") ? "&" : "?"}${bust}`

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

    try {
      let isUp = false
      let responseTime: number | null = null
      let statusCode: number | null = null
      let errorMessage: string | null = null

      // First try image
      const imgRes = await probeWithImage(url.url)
      if (imgRes.ok) {
        isUp = true
        responseTime = imgRes.ms
        statusCode = 200
      } else {
        // Fallback to iframe
        const ifRes = await probeWithIframe(url.url)
        if (ifRes.ok) {
          isUp = true
          responseTime = ifRes.ms
          statusCode = 200
        } else {
          isUp = false
          errorMessage = "Timeout or connection failed"
        }
      }

      // Save result to database
      await fetch("/api/check/browser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          urlId: url.id,
          isUp,
          responseTime,
          statusCode,
          errorMessage,
        }),
      })
    } catch (error: any) {
      // Save error result to database
      await fetch("/api/check/browser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          urlId: url.id,
          isUp: false,
          responseTime: null,
          statusCode: null,
          errorMessage: error.message || "Unknown error",
        }),
      })
    }
  }

  // Hybrid check: Try server-side first, fallback to browser for campus-restricted URLs
  const runBrowserChecks = async () => {
    if (!Array.isArray(urls) || urls.length === 0) return
    setChecking(true)

    try {
      // First, try server-side check for all URLs
      const response = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      if (!response.ok) {
        const error = await response.json()
        alert(error.error || "Failed to check URLs")
        return
      }

      const data = await response.json()
      
      // Check which URLs need browser fallback
      const urlsNeedingFallback: UrlWithStatus[] = []
      if (data.results && Array.isArray(data.results)) {
        for (const result of data.results) {
          if (result.needs_browser_fallback) {
            const url = urls.find(u => u.id === result.urlId)
            if (url) {
              urlsNeedingFallback.push(url)
            }
          }
        }
      }

      // Run browser checks for URLs that need fallback
      if (urlsNeedingFallback.length > 0) {
        for (const url of urlsNeedingFallback) {
          await runBrowserCheckForUrl(url)
        }
      }

      // Refresh URLs to show updated status
      fetchUrls()
    } catch (error: any) {
      console.error("Error checking URLs:", error)
      alert("Failed to check URLs: " + (error.message || "Unknown error"))
    } finally {
      setChecking(false)
    }
  }

  // Hybrid check for single service: Try server-side first, fallback to browser
  const refreshSingleService = async (url: UrlWithStatus) => {
    setRefreshingUrlId(url.id)

    try {
      // First, try server-side check
      const response = await fetch("/api/check/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urlId: url.id }),
      })

      if (!response.ok) {
        const error = await response.json()
        alert(error.error || "Failed to check URL")
        return
      }

      const data = await response.json()
      
      // If server-side check indicates browser fallback is needed, use browser check
      if (data.result?.needs_browser_fallback) {
        await runBrowserCheckForUrl(url)
      }

      // Refresh URLs to show updated status
      fetchUrls()
    } catch (error: any) {
      console.error("Error checking URL:", error)
      alert("Failed to check URL: " + (error.message || "Unknown error"))
    } finally {
      setRefreshingUrlId(null)
    }
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
        body: JSON.stringify({ url: newUrl, name: newName, environment: environment }),
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

  const handleEditUrl = (url: UrlWithStatus) => {
    setEditingUrl(url)
    setEditUrl(url.url)
    setEditName(url.name)
    setEditEnvironment(url.environment)
    setShowEditDialog(true)
  }

  const handleUpdateUrl = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUrl) return
    
    setUpdating(true)

    try {
      const res = await fetch(`/api/urls/${editingUrl.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: editUrl, name: editName, environment: editEnvironment }),
      })

      if (!res.ok) {
        const error = await res.json()
        alert(error.error || "Failed to update URL")
        return
      }

      setShowEditDialog(false)
      setEditingUrl(null)
      setEditUrl("")
      setEditName("")
      setEditEnvironment("testing")
      fetchUrls()
    } catch (error) {
      console.error("Error updating URL:", error)
      alert("Failed to update URL")
    } finally {
      setUpdating(false)
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

  const getOverallStatus = () => {
    // Ensure urls is an array
    if (!Array.isArray(urls)) {
      return {
        text: "All systems operational",
        icon: CheckCircle2,
        color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
      }
    }
    
    // Filter URLs by current environment
    const environmentUrls = urls.filter(url => url.environment === environment)
    const downCount = environmentUrls.filter((url) => {
      // Consider down if latest_status is null or is_up is false
      return !url.latest_status || !url.latest_status.is_up
    }).length
    if (downCount > 0) {
      const text = downCount === 1 ? "1 Service Down" : `${downCount} Services Down`
      return { text, icon: XCircle, color: "bg-red-500/10 text-red-500 border-red-500/20" }
    }
    return {
      text: "All systems operational",
      icon: CheckCircle2,
      color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
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

  const overallStatus = getOverallStatus()
  const StatusIcon = overallStatus.icon

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

        {/* Environment Tabs */}
        <Tabs value={environment} onValueChange={(value) => setEnvironment(value as "testing" | "production")} className="mb-6">
          <TabsList>
            <TabsTrigger value="testing">Testing</TabsTrigger>
            <TabsTrigger value="production">Production</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Overall Status Banner */}
        <Card className={`mb-8 border ${overallStatus.color}`}>
          <CardContent className="flex items-center gap-3 py-6">
            <StatusIcon className="h-6 w-6" />
            <span className="text-lg font-semibold">{overallStatus.text}</span>
            <Badge variant="outline" className="ml-auto">
              {environment === "production" ? "Production" : "Testing"}
            </Badge>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="mb-6 flex flex-wrap gap-4">
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add URL
          </Button>

          <Button
            variant="outline"
            onClick={runBrowserChecks}
            disabled={checking || !Array.isArray(urls) || urls.length === 0}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${checking ? "animate-spin" : ""}`} />
            {checking ? "Checking..." : "Check All URLs"}
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
                  <div className="grid gap-2">
                    <Label>Environment</Label>
                    <div className="px-3 py-2 border rounded-md bg-muted flex items-center">
                      <Badge variant="outline" className="text-sm">
                        {environment === "production" ? "Production" : "Testing"}
                      </Badge>
                      <span className="ml-2 text-sm text-muted-foreground">
                        (Based on current tab)
                      </span>
                    </div>
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

          <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit URL</DialogTitle>
                <DialogDescription>
                  Update the name and URL for this service.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleUpdateUrl}>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-name">Name</Label>
                    <Input
                      id="edit-name"
                      type="text"
                      placeholder="e.g., Banner Self Service 8 Production"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-url">URL</Label>
                    <Input
                      id="edit-url"
                      type="url"
                      placeholder="https://example.com"
                      value={editUrl}
                      onChange={(e) => setEditUrl(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Environment</Label>
                    <div className="px-3 py-2 border rounded-md bg-muted flex items-center">
                      <Badge variant="outline" className="text-sm">
                        {editEnvironment === "production" ? "Production" : "Testing"}
                      </Badge>
                      <span className="ml-2 text-sm text-muted-foreground">
                        (Cannot be changed)
                      </span>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updating}>
                    {updating ? "Updating..." : "Update URL"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* URLs List */}
        <div className="space-y-4">
          {!Array.isArray(urls) || urls.length === 0 ? (
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
              {urls.map((url) => {
                const statusBadge = url.latest_status
                  ? getStatusBadgeForHistory(url.latest_status.is_up ? "up" : "down")
                  : { text: "UNKNOWN", className: "bg-gray-500 hover:bg-gray-600 text-white" }
                return (
                  <Card
                    key={url.id}
                    className="border-border hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => handleUrlClick(url)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-lg leading-tight text-balance">
                            {url.name}
                          </CardTitle>
                          <a
                            href={url.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1.5 block text-sm text-blue-600 hover:text-blue-700 hover:underline break-all"
                          >
                            {url.url}
                          </a>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={(e) => {
                              e.stopPropagation()
                              refreshSingleService(url)
                            }}
                            disabled={refreshingUrlId === url.id}
                            title="Refresh service status"
                          >
                            <RefreshCw className={`h-4 w-4 ${refreshingUrlId === url.id ? "animate-spin" : ""}`} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEditUrl(url)
                            }}
                            title="Edit service"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteId(url.id)
                              setShowDeleteDialog(true)
                            }}
                            title="Delete service"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Status</span>
                        <Badge className={statusBadge.className}>{statusBadge.text}</Badge>
                      </div>
                      {url.latest_status && (
                        <>
                          {url.latest_status.status_code && (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Activity className="h-4 w-4" />
                                <span>Status Code</span>
                              </div>
                              <span className="font-mono text-sm font-medium">{url.latest_status.status_code}</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Clock className="h-4 w-4" />
                              <span>Response Time</span>
                            </div>
                            <span className="font-mono text-sm font-medium">
                              {formatResponseTime(url.latest_status.response_time)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Last Checked</span>
                            <span className="text-xs text-muted-foreground">
                              {formatBeaumontDateCompact(url.latest_status.checked_at)}
                            </span>
                          </div>
                        </>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <TrendingUp className="h-4 w-4" />
                          <span>Uptime (7 days)</span>
                        </div>
                        <span className="font-mono text-sm font-medium">{url.uptime_percentage.toFixed(1)}%</span>
                      </div>
                      {url.latest_status?.error_message && (
                        <Alert className="bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900/50">
                          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                          <AlertDescription className="text-sm text-red-800 dark:text-red-300">
                            {url.latest_status.error_message}
                          </AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
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
