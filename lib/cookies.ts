import { parse } from 'cookie';

export function parseCookies(cookieHeader?: string) {
  if (!cookieHeader) return {};
  return parse(cookieHeader);
}
