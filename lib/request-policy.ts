export function isCrossSiteMutation(method: string, origin: string | null, requestOrigin: string, fetchSite: string | null) {
  if (["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) return false;
  return Boolean((origin && origin !== requestOrigin) || fetchSite === "cross-site");
}
