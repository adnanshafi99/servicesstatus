"use client"

import { useState, useEffect } from "react"
import type { UrlWithStatus } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { CheckCircle2, XCircle, AlertCircle, Activity, Clock, TrendingUp } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { formatBeaumontDateCompact, formatBeaumontDateShort } from "@/lib/date-utils"

type ServiceStatus = "up" | "down"

interface CheckHistory {
  timestamp: string
  statusCode: number
  responseTime: number
  status: ServiceStatus
}

interface Service {
  id: string
  name: string
  url: string
  status: ServiceStatus
  statusCode: number
  responseTime: number
  lastChecked: string
  uptime: number
  errorMessage?: string
}

export default function ServiceStatusDashboard() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [environment, setEnvironment] = useState<"testing" | "production">("testing")
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [history, setHistory] = useState<CheckHistory[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  useEffect(() => {
    fetchServices()
    // Refresh every 30 seconds
    const interval = setInterval(fetchServices, 30000)
    return () => clearInterval(interval)
  }, [environment])

  const fetchServices = async () => {
    try {
      const response = await fetch(`/api/urls?environment=${environment}`)
      const data: UrlWithStatus[] = await response.json()
      
      // Transform data to match Service interface
      const transformedServices: Service[] = data.map((item) => {
        const latestStatus = item.latest_status
        const status: ServiceStatus = latestStatus?.is_up ? "up" : "down"
        const statusCode = latestStatus?.status_code ?? 0
        const responseTime = latestStatus?.response_time ?? 0
        const lastChecked = latestStatus
          ? formatBeaumontDateCompact(latestStatus.checked_at)
          : "Never"
        const uptime = item.uptime_percentage
        const errorMessage = latestStatus?.error_message || undefined

        return {
          id: item.id.toString(),
          name: item.name,
          url: item.url,
          status,
          statusCode,
          responseTime,
          lastChecked,
          uptime,
          errorMessage,
        }
      })

      setServices(transformedServices)
    } catch (error) {
      console.error("Error fetching services:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchHistory = async (serviceId: string) => {
    setLoadingHistory(true)
    try {
      const response = await fetch(`/api/urls/${serviceId}`)
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

  const handleServiceClick = (service: Service) => {
    setSelectedService(service)
    fetchHistory(service.id)
  }

  const getOverallStatus = () => {
    const downCount = services.filter((s) => s.status === "down").length
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

  const getStatusBadge = (status: ServiceStatus) => {
    switch (status) {
      case "up":
        return { text: "UP", className: "bg-emerald-500 hover:bg-emerald-600 text-white" }
      case "down":
        return { text: "DOWN", className: "bg-red-500 hover:bg-red-600 text-white" }
    }
  }

  if (loading) {
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
        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight text-balance">Service Status</h1>
          <p className="mt-2 text-muted-foreground">Real-time status and updates for our systems</p>
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

        {/* Services Status Section */}
        <div className="mb-8">
          <h2 className="mb-6 text-2xl font-bold">Services</h2>
          {services.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">
                  No services configured yet. Please contact an administrator.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {services.map((service) => {
                const statusBadge = getStatusBadge(service.status)
                return (
                  <Card
                    key={service.id}
                    className="border-border hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => handleServiceClick(service)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-lg leading-tight text-balance">
                            {service.name}
                          </CardTitle>
                          <a
                            href={service.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1.5 block text-sm text-blue-600 hover:text-blue-700 hover:underline break-all"
                          >
                            {service.url}
                          </a>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Status</span>
                        <Badge className={statusBadge.className}>{statusBadge.text}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Activity className="h-4 w-4" />
                          <span>Status Code</span>
                        </div>
                        <span className="font-mono text-sm font-medium">{service.statusCode}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span>Response Time</span>
                        </div>
                        <span className="font-mono text-sm font-medium">{service.responseTime}ms</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Last Checked</span>
                        <span className="text-xs text-muted-foreground">{service.lastChecked}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <TrendingUp className="h-4 w-4" />
                          <span>Uptime (7 days)</span>
                        </div>
                        <span className="font-mono text-sm font-medium">{service.uptime.toFixed(1)}%</span>
                      </div>
                      {service.errorMessage && (
                        <Alert className="bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900/50">
                          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                          <AlertDescription className="text-sm text-red-800 dark:text-red-300">
                            {service.errorMessage}
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

        {/* Footer */}
        <footer className="mt-12 border-t border-border pt-8">
          <div className="text-center text-sm text-muted-foreground">
            Last updated: {formatBeaumontDateShort(new Date())}
          </div>
        </footer>
      </div>

      {/* Details Modal with Check History */}
      <Dialog open={!!selectedService} onOpenChange={() => setSelectedService(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="text-2xl">{selectedService?.name}</DialogTitle>
            <DialogDescription className="break-all">{selectedService?.url}</DialogDescription>
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
                    <p className="text-sm text-muted-foreground">No check history available</p>
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
                        <Badge className={`${getStatusBadge(check.status).className} text-xs`}>
                          {getStatusBadge(check.status).text}
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
