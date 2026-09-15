export function requireExactOwnedIds(requested:string[],owned:string[]){
  const unique=[...new Set(requested)];if(unique.length!==requested.length)throw new Error("DUPLICATE_RESOURCE");
  const allowed=new Set(owned);if(unique.some(id=>!allowed.has(id)))throw new Error("RESOURCE_NOT_FOUND");return unique;
}
