export function isCrossSiteMutation(method: string, origin: string | null, requestOrigin: string, fetchSite: string | null) {
  if (["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) return false;
  return origin !== requestOrigin || (fetchSite !== null && fetchSite !== "same-origin");
}
