# Domain plan

## Recommended order

1. `commitkeep.com` — clearest general product identity.
2. `commitkeep.app` — strong product fit if `.com` is unavailable or expensive.
3. `commitkeep.dev` — good for a developer-focused launch.
4. `commitkeep.io` — acceptable, usually less direct and often more expensive.

On 2026-09-14, registry RDAP checks returned “not found” for all four names. This is a useful availability signal, not a reservation. The registrar performs the definitive check during checkout.

## Purchase and connection steps

1. Search the names at a registrar and compare both first-year and renewal prices.
2. Purchase the domain in the owner account with auto-renew and registrar lock enabled.
3. Enable MFA on the registrar account and keep recovery codes offline.
4. Verify the registrant email and enable DNSSEC when supported.
5. Add the domain to the hosting project and follow the DNS records it provides.
6. Use `app.commitkeep.com` for the product and reserve the root domain for either the app or a small public site.
7. Set the GitHub App callback, setup, and webhook URLs to the final HTTPS domain.
8. Keep the temporary `chatgpt.site` URL private during migration; remove it from public documentation after the custom domain is verified.

The current hosting project supports a custom-domain connection. Buying a domain is a financial transaction, so it must be completed by the owner or separately authorized with a spending limit.

## Reference

- Cloudflare Registrar: https://developers.cloudflare.com/registrar/get-started/register-domain/

