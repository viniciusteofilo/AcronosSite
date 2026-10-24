# E-mail

The store sends these messages (Admin → E-mails lists every one):

| When | To | Message |
| --- | --- | --- |
| Account created | customer | Confirm e-mail (link valid 24 h) |
| "Forgot your password?" | customer | Reset link (valid 1 h, one use; every device is signed out after the change) |
| Change of e-mail requested | current address, then new address | Approve link, then confirm link; nothing changes before both |
| Password changed | customer | Notice, with a link to reset if it was not them |
| Payment confirmed by Stripe/PayPal | buyer | Order confirmation with items and totals |
| Shipment added in the admin | buyer | Carrier, tracking number and tracking link |
| Refund sent | buyer | Amount and what to expect |
| Newsletter sign-up | subscriber | Confirmation link (double opt-in; valid 7 days) |
| Contact form | team address (Admin → E-mails) | The message, reply-to the person |
| Staff sign-in from a new browser | staff member | Alert with device and IP |

## Modes

- **Connected** (`RESEND_API_KEY` and `EMAIL_FROM` set): messages are sent through Resend. Only recipient, subject and status are kept, never the content.
- **Test outbox** (no provider, `APP_ENV=test` or development): nothing is sent; the full message is kept in Admin → E-mails, marked "Not sent", so every flow can be tried.
- **Off** (no provider in production): nothing is sent; "Forgot your password?" tells the person to use the contact page.

A failed e-mail never undoes a payment, an order update or a sign-up; it shows as "Failed" with the reason.

## Connecting Resend (free plan: 3,000 e-mails/month, 100/day)

Needs ACRONOS authorization: it is an account in the company's name and a DNS change.

1. Create the account at resend.com with the company e-mail.
2. Domains → Add domain → the ACRONOS domain. Resend shows 3–4 DNS records (SPF, DKIM, optionally DMARC). Adding them is a DNS change: only with authorization.
3. API Keys → Create (permission "Sending access").
4. In the hosting settings (Vercel → Settings → Environment Variables, or Cloudflare secrets) set:
   - `RESEND_API_KEY` = the key
   - `EMAIL_FROM` = `ACRONOS <store@your-domain>`
5. Redeploy, then Admin → E-mails → "Send test e-mail to me".

Newsletter campaigns are not sent from the site: export the confirmed list (Admin → Newsletter → CSV, it includes each person's unsubscribe link) into the campaign tool chosen later.
