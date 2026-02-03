"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Image from "next/image"
import type { UrlWithStatus } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { CheckCircle2, XCircle, AlertCircle, Activity, Clock, TrendingUp, Wifi, WifiOff, RefreshCw, ExternalLink } from "lucide-react"
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
  const [refreshCountdown, setRefreshCountdown] = useState(30)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefreshTime, setLastRefreshTime] = useState<Date>(new Date())
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const REFRESH_INTERVAL = 30000 // 30 seconds

  const fetchServices = useCallback(async () => {
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
      setLastRefreshTime(new Date())
    } catch (error) {
      console.error("Error fetching services:", error)
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [environment])

  // Manual (on-demand) refresh handler
  const handleManualRefresh = () => {
    if (isRefreshing) return

    setIsRefreshing(true)
    setRefreshCountdown(REFRESH_INTERVAL / 1000)
    void fetchServices()
  }

  useEffect(() => {
    fetchServices()
    
    // Set up refresh interval
    refreshIntervalRef.current = setInterval(() => {
      setIsRefreshing(true)
      fetchServices().finally(() => {
        setIsRefreshing(false)
        setRefreshCountdown(REFRESH_INTERVAL / 1000)
        setLastRefreshTime(new Date())
      })
    }, REFRESH_INTERVAL)

    // Set up countdown timer
    countdownIntervalRef.current = setInterval(() => {
      setRefreshCountdown((prev) => {
        if (prev <= 1) {
          return REFRESH_INTERVAL / 1000
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current)
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
    }
  }, [environment, fetchServices])

  // Reset countdown when environment changes
  useEffect(() => {
    setRefreshCountdown(REFRESH_INTERVAL / 1000)
  }, [environment])

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
    const totalCount = services.length
    const upCount = totalCount - downCount
    
    if (downCount > 0) {
      const text = downCount === 1 ? "1 Service Down" : `${downCount} Services Down`
      return { 
        text, 
        icon: XCircle, 
        color: "bg-red-600 text-white",
        bgGradient: "from-red-600 to-red-700",
        count: { up: upCount, down: downCount, total: totalCount }
      }
    }
    return {
      text: "All Systems Operational",
      icon: CheckCircle2,
      color: "bg-[#B00C14] text-white",
      bgGradient: "from-[#B00C14] to-[#8A0A10]",
      count: { up: upCount, down: downCount, total: totalCount }
    }
  }

  const getStatusBadge = (status: ServiceStatus) => {
    switch (status) {
      case "up":
        return { 
          text: "UP", 
          className: "bg-[#B00C14] hover:bg-[#8A0A10] text-white shadow-lg shadow-[#B00C14]/50",
          icon: Wifi,
          pulse: true
        }
      case "down":
        return { 
          text: "DOWN", 
          className: "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/50",
          icon: WifiOff,
          pulse: false
        }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="flex flex-col items-center gap-6">
          <div className="h-16 w-16 animate-spin rounded-full border-8 border-blue-500 border-t-transparent" />
          <p className="text-2xl text-white font-semibold">Loading Services...</p>
        </div>
      </div>
    )
  }

  const overallStatus = getOverallStatus()
  const StatusIcon = overallStatus.icon

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Top Status Bar - Lamar University Style */}
      <div className="sticky top-0 z-50 bg-white shadow-lg border-b-4 border-[#B00C14]">
        <div className="mx-auto px-8 py-4">
          <div className="flex items-center justify-between">
            {/* Left: Logo and Title */}
            <div className="flex items-center gap-4">
              <Image 
                src="/lamar-university-texas-logo.png" 
                alt="Lamar University Logo" 
                width={180}
                height={56}
                className="h-14 w-auto object-contain"
                priority
              />
              <div className="border-l-2 border-gray-300 h-12"></div>
              <div>
                <h1 className="text-3xl font-bold text-[#B00C14] tracking-tight">Banner ERP Applications Status</h1>
                <p className={`text-lg mt-1 font-medium ${overallStatus.count.down > 0 ? "text-red-600" : "text-[#B00C14]"}`}>
                  {overallStatus.text}
                </p>
              </div>
            </div>
            
            {/* Right: Status Count and Refresh */}
            <div className="flex items-center gap-8">
              <div className="text-right">
                <div className={`text-3xl font-bold ${overallStatus.count.down > 0 ? "text-red-600" : "text-[#B00C14]"}`}>
                  {overallStatus.count.up}/{overallStatus.count.total}
                </div>
                <div className="text-sm text-gray-600 font-medium">Services Online</div>
              </div>
              {/* Auto-refresh indicator */}
              <div className="flex flex-col items-end gap-1 border-l-2 border-gray-300 pl-6">
                <button
                  type="button"
                  onClick={handleManualRefresh}
                  className="flex items-center gap-2 cursor-pointer hover:opacity-80 active:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B00C14]/50 rounded-md"
                >
                  <RefreshCw className={`h-4 w-4 text-[#B00C14] ${isRefreshing ? "animate-spin" : ""}`} />
                  <span className="text-sm font-semibold text-[#B00C14]">Auto-refresh</span>
                </button>
                <div className="text-xs text-gray-600">
                  {isRefreshing ? (
                    <span className="animate-pulse text-[#B00C14]">Refreshing...</span>
                  ) : (
                    <span>Next refresh in {refreshCountdown}s</span>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  Last: {formatBeaumontDateShort(lastRefreshTime)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto px-8 py-8 max-w-[1920px]">
        {/* Environment Tabs - Larger */}
        <Tabs value={environment} onValueChange={(value) => setEnvironment(value as "testing" | "production")} className="mb-8">
          <TabsList className="h-16 w-fit">
            <TabsTrigger value="testing" className="text-xl px-8 py-4">Testing</TabsTrigger>
            <TabsTrigger value="production" className="text-xl px-8 py-4">Production</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Services Grid - Optimized for TV */}
        {services.length === 0 ? (
          <Card className="border-2 border-slate-800 bg-slate-900/90 backdrop-blur-sm">
            <CardContent className="flex flex-col items-center justify-center py-24 text-slate-50">
              <AlertCircle className="h-20 w-20 mb-6" />
              <p className="text-2xl text-center">
                No services configured yet. Please contact an administrator.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-8 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {services.map((service) => {
              const statusBadge = getStatusBadge(service.status)
              const StatusIcon = statusBadge.icon
              const isUp = service.status === "up"
              
              return (
                <Card
                  key={service.id}
                  className={`border-4 bg-slate-900/90 backdrop-blur-sm transition-all duration-300 cursor-pointer transform hover:scale-105 hover:shadow-2xl flex flex-col ${
                    isUp
                      ? "border-[#B00C14]/70 hover:border-[#B00C14] shadow-[#B00C14]/20"
                      : "border-red-500/70 hover:border-red-400 shadow-red-500/20"
                  }`}
                  onClick={() => handleServiceClick(service)}
                >
                  <CardHeader className="pb-4 flex-shrink-0 h-32">
                    <div className="grid grid-cols-[1fr_auto] gap-4 h-full">
                      <div className="flex flex-col justify-between min-w-0">
                        <CardTitle className="text-2xl font-bold leading-tight text-white line-clamp-2 flex-1">
                          {service.name}
                        </CardTitle>
                        <a
                          href={service.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-[#B00C14]/20 hover:bg-[#B00C14]/30 border border-[#B00C14]/50 rounded-lg transition-colors text-sm font-medium text-white hover:text-white group w-fit mt-2"
                        >
                          <ExternalLink className="h-4 w-4 group-hover:scale-110 transition-transform" />
                          <span>Open Service</span>
                        </a>
                      </div>
                      <div className={`flex flex-col items-end justify-start ${statusBadge.pulse ? "animate-pulse" : ""}`}>
                        <StatusIcon className={`h-10 w-10 ${isUp ? "text-[#B00C14]" : "text-red-400"}`} />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 flex-1 flex flex-col">
                    {/* Large Status Badge - Fixed height container */}
                    <div className="flex items-center justify-center h-20 flex-shrink-0">
                      <Badge className={`${statusBadge.className} text-2xl font-bold px-8 py-3 rounded-lg`}>
                        {statusBadge.text}
                      </Badge>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-700 text-slate-50">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-slate-100">
                          <Activity className="h-5 w-5" />
                          <span className="text-sm font-medium">Status Code</span>
                        </div>
                        <div className="text-2xl font-bold text-white font-mono">{service.statusCode}</div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-slate-100">
                          <Clock className="h-5 w-5" />
                          <span className="text-sm font-medium">Response</span>
                        </div>
                        <div className="text-2xl font-bold text-white font-mono">{service.responseTime}ms</div>
                      </div>
                      <div className="space-y-2 col-span-2">
                        <div className="flex items-center gap-2 text-slate-100">
                          <TrendingUp className="h-5 w-5" />
                          <span className="text-sm font-medium">Uptime (7 days)</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-4 bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all ${
                                service.uptime >= 99 ? "bg-[#B00C14]" : 
                                service.uptime >= 95 ? "bg-yellow-500" : "bg-red-500"
                              }`}
                              style={{ width: `${service.uptime}%` }}
                            />
                          </div>
                          <div className="text-2xl font-extrabold text-white font-mono min-w-[80px] text-right drop-shadow">
                            {service.uptime.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    </div>

                    {service.errorMessage && (
                      <Alert className="bg-red-950/50 border-red-500/50 mt-4">
                        <AlertCircle className="h-5 w-5 text-red-400" />
                        <AlertDescription className="text-base text-red-200 font-medium">
                          {service.errorMessage}
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="text-sm text-slate-200 pt-2 border-t border-slate-700">
                      Last checked: {service.lastChecked}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* Footer */}
        <footer className="mt-16 border-t-2 border-slate-700 pt-8">
          <div className="text-center text-lg text-slate-100">
            Last updated: {formatBeaumontDateShort(new Date())}
          </div>
        </footer>
      </div>

      {/* Details Modal */}
      <Dialog open={!!selectedService} onOpenChange={() => setSelectedService(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-3xl text-white">{selectedService?.name}</DialogTitle>
            <DialogDescription className="break-all text-slate-400 text-lg">{selectedService?.url}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-4">
              <h3 className="text-2xl font-semibold mb-4 text-white">Check History</h3>
              {loadingHistory ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex flex-col items-center gap-4">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
                    <p className="text-lg text-slate-400">Loading history...</p>
                  </div>
                </div>
              ) : history.length === 0 ? (
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <AlertCircle className="h-12 w-12 text-slate-400 mb-4" />
                    <p className="text-lg text-slate-400">No check history available</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="border-2 border-slate-700 rounded-lg overflow-hidden bg-slate-900/50">
                  <div className="bg-slate-800 grid grid-cols-12 gap-4 px-6 py-4 text-sm font-bold text-slate-300">
                    <div className="col-span-5">Time</div>
                    <div className="col-span-2">Status</div>
                    <div className="col-span-2">Code</div>
                    <div className="col-span-3">Response</div>
                  </div>
                  {history.map((check, index) => (
                    <div
                      key={index}
                      className={`grid grid-cols-12 gap-4 px-6 py-4 border-t border-slate-700 items-center ${
                        check.status === "down" ? "bg-red-950/20" : "bg-slate-800/30 hover:bg-slate-800/50"
                      } transition-colors`}
                    >
                      <div className="col-span-5 text-base text-slate-300">{check.timestamp}</div>
                      <div className="col-span-2">
                        <Badge className={`${getStatusBadge(check.status).className} text-sm font-bold`}>
                          {getStatusBadge(check.status).text}
                        </Badge>
                      </div>
                      <div className="col-span-2 text-base font-mono font-bold text-white">{check.statusCode}</div>
                      <div className="col-span-3 text-base font-mono font-bold text-white">{check.responseTime}ms</div>
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
