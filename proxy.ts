import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("Content-Security-Policy", "default-src 'self'; connect-src 'self' https://api.github.com; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://github.com");
  if (request.nextUrl.pathname.startsWith("/api/")) response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = { matcher: "/((?!_next/static|_next/image|favicon.svg).*)" };
