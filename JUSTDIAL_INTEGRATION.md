# Justdial enquiry integration

The CRM accepts Justdial's GET, form POST, and JSON POST formats from the supplied API integration document. The recommended format is POST JSON because GET places customer details in the URL.

## Configuration

1. Set `JUSTDIAL_WEBHOOK_TOKEN` in the server's deployment environment to a random secret of at least 32 characters. Do not commit the token to Git.
2. Deploy the application. The normal server startup applies the versioned Prisma migration before the server begins accepting requests.
3. Give Justdial this callback URL, replacing `<token>` with the configured value:

   `https://crm.advaitdigital.co.in/api/integrations/justdial/<token>`

4. Ask Justdial to use POST JSON if available. They may use GET or form POST with the documented field names. No extra query parameter is needed.
5. Both Justdial centres use `ternadomain@gmail.com` as their lead feedback email, per the account owner.

A valid request receives HTTP 200 with plain text `RECEIVED`. Repeated requests with the same `leadid` also receive `RECEIVED` and do not create another lead. Missing `leadid` or both contact numbers are rejected. A missing or incorrect token cannot create a lead.

Imported enquiries appear on the Leads page with source `Justdial`. The original documented fields are retained in `justdialPayload`, and location, enquiry date, contract ID, and DND flags are summarized in the notes. No automatic message is sent to the caller. Administrators, directors, and sales managers receive an in-app notification.

Both Advait Justdial centres can use the same callback URL. The `parentid` field is retained so their contract IDs remain available. The document does not include a separate centre identifier.

## Local manual test

Start the local server and client, then run `npm.cmd run justdial:test --prefix server`. A clearly marked sample enquiry will appear at `http://localhost:5174/leads`. Delete it from the Leads page after inspecting it. This command sends only to `127.0.0.1` and does not contact Justdial or the live CRM.
