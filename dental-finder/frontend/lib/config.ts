export const config = {
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  },
  kakao: {
    mapKey: process.env.NEXT_PUBLIC_KAKAO_MAP_KEY!,
    jsKey: process.env.NEXT_PUBLIC_KAKAO_JS_KEY || process.env.NEXT_PUBLIC_KAKAO_MAP_KEY!,
  },
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "",
  },
} as const;
