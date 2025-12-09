export interface Url {
  id: number;
  url: string;
  name: string;
  environment: "testing" | "production";
  created_at: string;
  updated_at: string;
}

export interface UrlStatus {
  id: number;
  url_id: number;
  status_code: number | null;
  status_text: string | null;
  response_time: number | null; // Keep for backward compatibility, but new checks use response_time_ms
  is_up: boolean;
  checked_at: string;
  error_message: string | null;
  location?: string | null; // Redirect location header
  is_redirect?: boolean; // True if status is 301 or 302
}

export interface UrlWithStatus extends Url {
  latest_status: UrlStatus | null;
  uptime_percentage: number;
}




