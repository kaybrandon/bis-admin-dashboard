# BNB Admin slice 1 pass bar

Frozen 2026-10-01 for draft PR #23 on kaybrandon/bis-admin-dashboard.
Behavior head: `0382e3f8`. Do not deploy. Do not touch the GIS repo or appgisdashboard.
QA scores the code. QA2 waits. Nothing is live. Only Chief of Staff merges.

This slice is the office shell with sample data. It is not the full Admin MVP.
The two fails already found are Musts 1 and 2.

## Must

1. The login password field starts empty. Fail if the password input is prefilled, or if the login screen prints a seed password.
   How this escapes: a default value on the password field, or a hint under the form.

2. Vault encryption is gone from the app. `VaultCrypto` is gone, and the app does not read `VAULT_DEK`. The vault page is still one masked row, and no secret is rendered.
   How this escapes: crypto code comes back, or a vault value shows in the page or the API.

3. The shell is the pale gray office theme. Pale gray page, white rounded shell, white sidebar, indigo selected pill, coral for alerts and Log out, Inter.
   How this escapes: the cream page or the dark green rail comes back.

4. The rail is in this order: Home, Clients, Flags, Team, Time, Vault, Connectors, Accounting, Reports, Settings, Service desk, Field, Security, Billing. Log out sits at the bottom.
   How this escapes: an item is missing or out of order.

5. Home uses sample data. This week, Last week, and Clients. KPI tiles with sparklines, clocked hours Monday through Friday, flags by type, and open flags for Northstar, Lakeside, and Murray Media.
   How this escapes: Home calls live data, or one of those sample clients is missing.

6. Clients lists the book and opens Murray Media. Business phone and email are on the header. Call, Email, Map, and Website are text controls. They do not place a call or send mail. Bre is pinned as primary. Flags stay collapsed as "2 flags · Warning, Care."
   How this escapes: a control places a call, sends mail, or opens a map.

7. The other rail pages are empty states that name the page. Service desk says "Connect a PSA in Connectors."
   How this escapes: a page still runs the old full feature, or an empty state does not name itself.

8. SSO stays off. Sign-in uses the local API. The shell does not call Azure, QuickBooks, or send email.
   How this escapes: SSO is on, or the shell calls a connector.

9. The sample company is BIS Consultants. The product name is Admin, not Folio.
   How this escapes: Folio naming, or a different company on the shell.

## Not this head

QA passed `0382e3f8` with two notes. They do not block, and they stay off this head unless Chief of Staff pulls them.

- The seed password is still in SeedData and the README. It is not in the login form.
- The deploy script and bicep still create a VAULT-DEK. The app does not use it.

## Won't

Deploy. GIS. Real vault encryption on this slice. A second PR for the notes above.
