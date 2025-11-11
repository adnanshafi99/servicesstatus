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
  response_time: number | null;
  is_up: boolean;
  checked_at: string;
  error_message: string | null;
}

export interface UrlWithStatus extends Url {
  latest_status: UrlStatus | null;
  uptime_percentage: number;
}




