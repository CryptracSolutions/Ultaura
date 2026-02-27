# Ultaura Admin Suite - Complete User Guide

> **Last updated:** February 27, 2026
> **Audience:** Platform owner / super-admin (non-developer)
> **Purpose:** Definitive reference for every screen, button, and workflow in the Ultaura admin panel

---

## Table of Contents

1. [What Is the Admin Panel?](#1-what-is-the-admin-panel)
2. [Access and Security](#2-access-and-security)
   - [How Admin Access Works](#how-admin-access-works)
   - [Multi-Factor Authentication (MFA)](#multi-factor-authentication-mfa)
   - [The MFA Gate Page](#the-mfa-gate-page)
   - [Audit Logging](#audit-logging)
   - [CSRF Protection](#csrf-protection)
3. [Overview Dashboard](#3-overview-dashboard)
4. [Search](#4-search)
5. [Manage](#5-manage)
   - [Users](#users)
   - [User Detail](#user-detail)
   - [Organizations](#organizations)
   - [Organization Detail](#organization-detail)
   - [Organization Members](#organization-members)
   - [Billing Lookup](#billing-lookup)
6. [Content](#6-content)
   - [Subscribers](#subscribers)
   - [Broadcasts](#broadcasts)
   - [Broadcast Composer (New Broadcast)](#broadcast-composer-new-broadcast)
   - [Broadcast Detail](#broadcast-detail)
   - [Changelog](#changelog)
7. [Observe](#7-observe)
   - [Timeline](#timeline)
   - [Debug Logs](#debug-logs)
   - [Diagnostics](#diagnostics)
   - [Feedback](#feedback)
   - [Feedback Detail](#feedback-detail)
8. [Deep-Dive: Account Detail](#8-deep-dive-account-detail)
9. [Deep-Dive: Line Detail](#9-deep-dive-line-detail)
10. [Common Workflows (Step-by-Step)](#10-common-workflows-step-by-step)
11. [Glossary](#11-glossary)

---

## 1. What Is the Admin Panel?

The admin panel is the internal super-admin control center for the entire Ultaura platform. It lives at `/admin` and is only accessible to users with the **super-admin** role. From here you can:

- **Monitor platform health** -- see how many users, organizations, paying customers, and active phone lines you have, and how much revenue the platform generates.
- **Manage users and organizations** -- look up any user, check their account status, investigate billing problems, impersonate them to debug their view, or take action (ban, reactivate, delete).
- **Manage content** -- send email newsletters to subscribers, publish changelog updates, and view user feedback.
- **Observe everything** -- review a unified timeline of every call, safety event, reminder, schedule change, and privacy action across the entire platform. View telephony debug logs with encrypted payload decryption. Run system health diagnostics.

Think of it as your mission control for running Ultaura.

---

## 2. Access and Security

### How Admin Access Works

The admin panel uses a **three-layer security system** to make sure only authorized people can access it:

1. **Layer 1 -- The Front Door (Middleware):** Before any admin page even starts loading, the system checks three things at the network level:

   - Are you logged in? If not, you're sent to the sign-in page.
   - Do you have the super-admin role? If not, you see a 404 page (the system hides the fact that the admin panel even exists from non-admins).
   - Have you completed MFA? If MFA is enforced (it is in production) and you haven't verified with your second factor, you're sent to the MFA gate page.

2. **Layer 2 -- The Layout Check:** Even after passing the front door, the admin layout itself double-checks your role before rendering the sidebar and content area.

3. **Layer 3 -- Per-Page and Per-Action Checks:** Every individual page and every destructive action (banning a user, deleting an organization, etc.) independently verifies your admin status one more time. This means even if somehow a request slipped through layers 1 and 2, it would still be caught.

**Why three layers?** Defense in depth. If any single layer has a bug, the other two still protect the system.

### Multi-Factor Authentication (MFA)

In production, MFA is **enforced** for all admin access. This means you need both your password and a second factor (like an authenticator app) to access the admin panel.

- MFA enforcement is controlled by an environment setting. In production, it defaults to "on."
- The system checks for **AAL2** (Authenticator Assurance Level 2), which means you've verified with at least one additional authentication factor beyond your password.
- If you haven't set up MFA yet, you'll be redirected to the MFA gate page every time you try to access the admin panel.

### The MFA Gate Page

**How to get here:** Navigate to `/admin` without having completed MFA verification.

**What you see:**

- If MFA is enforced: A warning message explaining that MFA is required to access the admin panel.
- If MFA is not enforced: An informational message recommending MFA setup.

**What you can do:**

- Click **Set Up MFA** -- this takes you to your profile settings page where you can configure an authenticator app.
- Click **Continue Without MFA** -- this only appears when MFA is not enforced (typically in development). In production, this button is hidden.
- Click **Back to Dashboard** -- returns you to the regular user dashboard.

**When you'd use this:** You'll only see this page when you first set up your admin account or when your MFA session has expired. Once you've set up MFA and verified, you'll be taken straight to the admin dashboard.

### Audit Logging

Admin audit logging is comprehensive for sensitive and investigative actions, but not literally every single page interaction. Logged events include:

- **Who did it:** Your user ID and email address
- **What they did:** The specific action (e.g., "user.ban", "org.delete", "admin.search")
- **What they targeted:** The type and ID of the thing you acted on (e.g., a specific user, organization, or broadcast)
- **When:** Timestamp of the action
- **From where:** Your IP address and browser information
- **Details:** Action-specific metadata (e.g., what search terms you used, what filters you applied, what role change you made)

**You can view recent audit logs** on the Diagnostics page (the last 20 entries are shown there). The audit log cannot be edited or deleted from the admin panel.

**Actions that are audit-logged include:** Viewing user details, searching for users, looking up billing information, banning/reactivating/impersonating/deleting users, deleting organizations, managing organization members, viewing debug logs (especially decrypted payloads), viewing timeline raw data, changing timeline redaction modes, viewing subscriber lists, sending/canceling broadcasts, and creating/editing/deleting/publishing changelog entries.

### CSRF Protection

All state-changing requests (anything that modifies data) are protected against Cross-Site Request Forgery (CSRF) attacks. This means a malicious website cannot trick your browser into performing admin actions. The system automatically handles this -- you don't need to do anything, but it's good to know it's there.

---

## 3. Overview Dashboard

### What This Page Is

The Overview dashboard is your at-a-glance snapshot of the entire Ultaura platform. It shows key business metrics organized into four tabs: overall platform health, revenue details, usage statistics, and operational costs. This is the first thing you see when you enter the admin panel.

### How to Get Here

**Sidebar -> Overview** (the home icon at the top of the sidebar), or navigate directly to `/admin`.

### What You See on the Screen

The page has **four tabs** across the top. Each tab reveals a different set of metric cards:

#### Overview Tab (Default)

Six stat cards:

| Card                 | What It Shows                                                                                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MRR**              | Monthly Recurring Revenue -- the total amount all paying subscribers are billed per month, calculated from active subscriptions. This is one of the most important business health metrics. |
| **ARR**              | Annual Recurring Revenue -- MRR multiplied by 12. Represents projected yearly revenue if current subscriptions hold steady.                                                                 |
| **Users**            | Total number of registered user accounts on the platform (both active and inactive).                                                                                                        |
| **Organizations**    | Total number of organizations (family groups) created on the platform.                                                                                                                      |
| **Paying Customers** | Number of active, paid subscriptions (excludes trials and cancelled).                                                                                                                       |
| **Trials**           | Number of users currently in the 14-day free trial period.                                                                                                                                  |

#### Revenue Tab

Three stat cards plus a chart:

| Card                       | What It Shows                                                                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Overage / PAYG Revenue** | Total revenue from overage minutes (when users exceed their plan's included minutes) and pay-as-you-go usage.                                                 |
| **Subscribers**            | Breakdown of paying subscribers by billing interval -- how many are on monthly plans vs. annual plans.                                                        |
| **Pending Cancellations**  | Number of subscriptions that are set to cancel at the end of their current billing period (the user has cancelled but their subscription hasn't expired yet). |

Below the cards is a **Plan Distribution Chart** -- a horizontal bar chart showing how many accounts are on each plan (Free Trial, Care, Comfort, Family, Usage Based). This tells you which plans are most popular.

#### Usage Tab

Six stat cards:

| Card                        | What It Shows                                                                                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Minutes Used This Month** | Total phone call minutes consumed across all accounts in the current period.                                                                                              |
| **Minutes Allotted**        | Total phone call minutes available across all active plans (the sum of every account's included minutes).                                                                 |
| **Active Lines**            | Number of phone lines that are currently set up and active (lines that can receive or place calls).                                                                       |
| **Total Calls**             | Number of phone calls made or received this month across the entire platform.                                                                                             |
| **Call Answer Rate**        | Platform-level answered-call ratio from aggregated call records. Treat this as an overall engagement/connection metric (not a strict outbound-only senior-answer metric). |
| **Avg Call Duration**       | Average length of a phone call in minutes and seconds. Helps gauge engagement -- longer calls generally mean better conversations.                                        |

#### Costs Tab

Two stat cards:

| Card                          | What It Shows                                                                       |
| ----------------------------- | ----------------------------------------------------------------------------------- |
| **Twilio Costs This Month**   | Total costs paid to Twilio (the phone provider) for call minutes and phone numbers. |
| **AI Model Costs This Month** | Total costs paid to xAI for the Grok voice AI model usage.                          |

Note: the **Encryption Health Card** is currently shown on the **Diagnostics** page (not directly on the Overview tabs). It auto-checks every 60 seconds in production (every 120 seconds in development) and also supports manual refresh.

### What Actions You Can Take

This page is primarily read-only -- it's a monitoring dashboard. You can:

- **Switch between tabs** by clicking Overview, Revenue, Usage, or Costs.
- **Use Diagnostics for encryption health** when you need to validate encryption status or run a manual refresh.

### When and Why You'd Use This

- **Check daily** to monitor platform growth, revenue trends, and overall health.
- **Before investor meetings or reports** to get current numbers on MRR, ARR, user counts, and usage.
- **When investigating cost spikes** -- check the Costs tab to see if Twilio or AI costs have increased unexpectedly.
- **When evaluating plan popularity** -- the Revenue tab's plan distribution chart shows you which plans resonate most.

### Important Things to Know

- MRR and ARR are calculated from active subscription data in your database, not directly from Stripe. They should match, but if you notice a discrepancy, use the Billing Lookup page to cross-reference.
- Encryption health should be checked on Diagnostics. If it ever shows "Warning" or "Auth/Config issue," investigate immediately -- encryption is critical for protecting senior call data.

---

## 4. Search

### What This Page Is

The Search page is your universal lookup tool for finding any user, organization, account, or phone line on the platform. It's the starting point for most admin investigations -- when someone contacts you with an issue, this is where you start.

### How to Get Here

**Sidebar -> Search** (the magnifying glass icon), or navigate to `/admin/search`.

### What You See on the Screen

At the top is a **search form** with two parts:

1. A **dropdown selector** for the search type, with four options:
   - **Email** -- search by the user's email address (partial matches work)
   - **Phone** -- search by a phone number associated with the user (searches Ultaura line phone numbers and traces back to the owning user)
   - **User ID** -- search by the exact user UUID
   - **Line Phone** -- search by an Ultaura phone line number (the number the AI calls from)
2. A **text input** where you type your search query
3. A **Search button** to execute the search

Below the form, **search results** appear as hierarchical cards showing the full picture for each matched user:

**User Card** (top level):

- User ID (clickable link to user detail page)
- Email address
- Phone number
- Account creation date
- Last sign-in date
- Status badge (Active or Banned)

**Nested under each user -- Organizations:**

- Organization name
- The user's role in that organization (stored as role codes; some views may display numeric enum values)

**Nested under each organization -- Accounts:**

- Account ID
- Account name
- Plan name
- Account status

**Nested under each account -- Lines:**

- Line display name
- Phone number
- Line status

This hierarchical view lets you see the complete picture: User -> Organization -> Account -> Lines, all from a single search.

### What Actions You Can Take

- **Change the search type** by selecting from the dropdown (Email, Phone, User ID, Line Phone).
- **Type your search query** and click **Search** or press Enter.
- **Click on any user ID** in the results to go to their User Detail page.
- **Click on an organization entry** to open that organization's members view (from there you can navigate deeper into organization management).
- **Click on any account** to see account details.

### When and Why You'd Use This

- **"A user says they can't log in"** -- search by their email to check if their account is banned or if they even exist in the system.
- **"A family called about their mom's phone line"** -- search by the senior's phone number or the Ultaura line number to find the associated account.
- **"I have a user ID from a support ticket"** -- paste it in to pull up their full account hierarchy.
- **"I need to check what plan someone is on"** -- search by email and look at the account section of the results.

### Important Things to Know

- **Every search is audit-logged**, including what you searched for and what type of search you performed. This is for accountability.
- **Email search is partial and case-insensitive** -- searching "john" will find "john@example.com" and "johnson@gmail.com."
- **Phone search is smart about formatting** -- it handles numbers with or without country codes, with or without the "+" prefix. You don't need to worry about exact format. Note: this searches Ultaura line phone numbers (not user auth phone numbers) and traces back to the associated user.
- **User ID search requires the exact UUID** -- no partial matching.
- **Line Phone search is also smart about formatting** -- like Phone search, it normalizes your input and checks multiple format variants. You don't need to enter the exact E.164 format.

---

## 5. Manage

### Users

#### What This Page Is

The Users page shows a paginated list of every registered user on the platform. It's your user directory -- you can see who signed up, when they were last active, and whether their account is in good standing.

#### How to Get Here

**Sidebar -> Manage -> Users**, or navigate to `/admin/users`.

#### What You See on the Screen

A **paginated table** with the following columns:

| Column           | What It Shows                                                                      |
| ---------------- | ---------------------------------------------------------------------------------- |
| **Avatar**       | The user's profile photo (or a default placeholder)                                |
| **ID**           | The user's UUID, displayed as a clickable link that takes you to their detail page |
| **Email**        | The user's email address                                                           |
| **Name**         | The user's display name (may be blank if they haven't set one)                     |
| **Created at**   | When the user registered                                                           |
| **Last sign in** | When they last logged in                                                           |
| **Status**       | A badge showing either "Active" (green) or "Banned" (red)                          |
| **Actions**      | A three-dot menu (**...**) with available actions                                  |

Below the table is a **pagination control** with:

- A "rows per page" dropdown (20, 50, or 100 rows)
- Previous and Next page buttons

#### What Actions You Can Take

For each user row, click the **... menu** to see available actions. The menu changes depending on the user's status:

**For active (non-banned) users:**

1. **Copy user ID** -- copies the user's UUID to your clipboard. Useful for support tickets or cross-referencing.
2. **Impersonate User** -- opens a confirmation dialog. If you confirm, you'll be logged in as that user and redirected to their dashboard. (See [Impersonation Workflow](#i-need-to-impersonate-a-user-to-debug-their-view) for details.)
3. **Ban User** (orange text) -- opens a confirmation dialog where you must type "BAN" to confirm. This prevents the user from logging in.
4. **Delete User** (red text) -- opens a confirmation dialog where you must type "DELETE" to confirm. This permanently removes the user and their data.

**For banned users:**

1. **Copy user ID** -- same as above.
2. **Reactivate User** -- lifts the ban and restores access.

#### When and Why You'd Use This

- **Routine monitoring** -- scan the list to see new signups and recent activity.
- **Finding a specific user** -- though the Search page is better for targeted lookups, this page lets you browse and sort through all users.
- **Managing bad actors** -- use the ban or delete actions from the row menu.

#### Important Things to Know

- **You cannot ban, delete, or impersonate yourself.** The system prevents self-destructive actions.
- **Banning is reversible** -- you can reactivate a banned user at any time.
- **Deletion is permanent** -- there is no undo. The confirmation dialog requires you to type "DELETE" for this reason.
- All user management actions are audit-logged.

---

### User Detail

#### What This Page Is

The User Detail page shows everything about a single user: their identity, status, and which organizations they belong to. It's also where you take actions on that specific user.

#### How to Get Here

**Sidebar -> Manage -> Users -> click a user's ID link** in the table, or navigate to `/admin/users/[uid]`.

#### What You See on the Screen

**Breadcrumbs** at the top: Admin > Users > [User ID]

**User Information Section:**

- **Status badge** -- Active (green) or Banned (red)
- **Display Name** -- the user's chosen name
- **Email** -- their email address
- **Phone** -- their phone number (if provided)

**Organizations Table** showing every organization this user belongs to:

| Column   | What It Shows                                                                     |
| -------- | --------------------------------------------------------------------------------- |
| **ID**   | The organization ID                                                               |
| **UUID** | The organization's UUID                                                           |
| **Name** | The organization's name (clickable link into the organization members/admin flow) |
| **Role** | The user's role in that organization: Owner, Admin, or Member                     |

**Actions Dropdown** (top-right corner) with these options:

- **Impersonate** -- log in as this user (available for both active and banned users)
- **Ban** (orange text) -- ban this user (only for active users)
- **Reactivate** -- lift a ban (only for banned users)
- **Delete** (red text) -- permanently delete this user (available for both active and banned users)

Note: Unlike the users table's row menu, the detail page dropdown does not have a "Copy User ID" option (the UUID is already visible in the breadcrumbs), and it shows the **Impersonate** and **Delete** options even for banned users.

#### What Actions You Can Take

- **Take action on the user** via the dropdown (impersonate, ban, reactivate, delete).
- **Click any organization name** in the table to navigate to that organization's members/admin flow.

#### When and Why You'd Use This

- **Investigating a support request** -- see what organizations and roles a user has.
- **Checking if someone is in the right organization** -- verify their membership and role.
- **Taking action on a specific user** -- ban, reactivate, impersonate, or delete from the dropdown.

#### Important Things to Know

- **Viewing this page is audit-logged** -- the system records that you looked at this user's details.
- The user's UUID is shown in the breadcrumbs, making it easy to copy for reference.

---

### Organizations

#### What This Page Is

The Organizations page lists every organization (family group) on the platform. Organizations are the containers that hold Ultaura accounts and phone lines -- a family creates an organization, sets up an account with a plan, and adds lines for their senior loved ones.

#### How to Get Here

**Sidebar -> Manage -> Organizations**, or navigate to `/admin/organizations`.

#### What You See on the Screen

At the top is a **search bar** for filtering organizations by name.

Below is a **paginated table** with:

| Column           | What It Shows                                                                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **ID**           | Internal numeric ID                                                                                                                            |
| **UUID**         | The organization's unique identifier                                                                                                           |
| **Name**         | The organization's display name                                                                                                                |
| **Subscription** | The plan for the organization's subscription (e.g., "Care", "Comfort")                                                                         |
| **Status**       | Subscription status badge (e.g., Active, Trialing, Cancelled)                                                                                  |
| **Period**       | The current billing period end date -- shows "Renews [date]" or "Stops [date]" depending on whether the subscription is set to renew or cancel |
| **Members**      | Number of members, with invite count in parentheses if there are pending invites (e.g., "3 (1 invited)")                                       |
| **Actions**      | Three-dot menu                                                                                                                                 |

**Pagination** at the bottom (10 organizations per page).

#### What Actions You Can Take

For each organization row, click the **... menu**:

1. **Copy UUID** -- copies the organization UUID to your clipboard.
2. **View Members** -- navigates to the dedicated members page for that organization.
3. **Delete** (red text) -- opens a confirmation dialog where you must type "DELETE" to confirm. This permanently deletes the organization and all its associated data (accounts, lines, subscriptions).

You can also:

- **Search by name** using the search bar at the top.
- **Click a row** to navigate to the organization members view.
- **Navigate between pages** using the pagination controls.

#### When and Why You'd Use This

- **Finding a specific family's organization** -- use the search bar.
- **Checking subscription status** -- see which organizations are active, trialing, or have cancelled.
- **Monitoring growth** -- browse the list to see new organizations being created.

#### Important Things to Know

- **Deleting an organization is permanent and cascading** -- it removes the organization, all its accounts, all its lines, all call data, and all subscriptions. This cannot be undone.
- The confirmation dialog requires typing "DELETE" to prevent accidental deletion.
- Organization deletion is audit-logged.

---

### Organization Detail

#### What This Page Is

The Organization Detail page shows everything about a single organization: its metadata, linked Ultaura accounts, and all its members. This is where you manage membership -- add people, change roles, transfer ownership, or remove members.

#### How to Get Here

**Sidebar -> Manage -> Organizations -> click an organization row**, or navigate to `/admin/organizations/[uid]`.

#### What You See on the Screen

**Breadcrumbs** at the top: Admin > Organizations > [Organization Name]

**Four sections:**

**1. Organization Info**

- Organization Name
- UUID
- Internal ID (numeric)
- Created At (date and time)

**2. Ultaura Accounts**

A list of all accounts linked to this organization. Each account shows:

- Account name
- Status badge
- Plan ID (which plan they're on)
- A **View Account** link that takes you to the Account Detail page

**3. Members Section**

A table showing every member of this organization:

| Column            | What It Shows                                                     |
| ----------------- | ----------------------------------------------------------------- |
| **Membership ID** | Internal ID for this membership record                            |
| **User**          | The member's display name or email                                |
| **User ID**       | Their UUID, as a clickable link to the User Detail page           |
| **Role**          | A badge showing Owner (purple), Admin (blue), or Member (default) |
| **Actions**       | Three-dot menu with role and membership management options        |

Above the members table:

- An **Add Member** button that opens a dialog

For each member row, the **... menu** offers:

- **View User** -- navigate to the User Detail page
- **Set as Admin** -- change the member's role to Admin (not available for the owner)
- **Set as Member** -- change the member's role to Member (not available for the owner)
- **Remove Member** -- remove this person from the organization (not available for the owner)

Each non-owner member row also has a **Transfer Ownership** button next to the dropdown menu. Clicking it opens a dialog to transfer organization ownership to that specific member.

**4. Quick Links**

- **Full Members List** -- link to the dedicated members page (with pagination)
- **Delete Organization** -- link to the delete confirmation modal

#### What Actions You Can Take

1. **Add a Member:**

   - Click the **Add Member** button
   - Enter the email address of an existing Ultaura user
   - Select their role (Member or Admin -- you cannot add someone directly as Owner)
   - Click **Add**
   - The user must already have an Ultaura account. If the email isn't found, you'll see an error.

2. **Change a Member's Role:**

   - Click the **... menu** next to the member
   - Select **Set as Admin** or **Set as Member**
   - The change takes effect immediately

3. **Remove a Member:**

   - Click the **... menu** next to the member
   - Select **Remove Member**
   - The member is immediately removed from the organization

4. **Transfer Ownership:**

   - Click the **Transfer Ownership** button on the row of the member you want to make the new owner
   - A confirmation dialog appears showing who the current owner is and who will become the new owner (the member whose button you clicked)
   - You must type "TRANSFER" to confirm
   - The current owner is automatically demoted to Admin, and the new owner gets the Owner role
   - If something goes wrong during the promotion, the system attempts to roll back the demotion

5. **View Account Details:**

   - Click **View Account** on any listed account to go to the Account Detail page

6. **Delete Organization:**
   - Click **Delete Organization** in Quick Links
   - Type "DELETE" in the confirmation dialog
   - This permanently removes the organization and all its data

#### When and Why You'd Use This

- **"A user needs to be added to their family's organization"** -- use Add Member.
- **"The account holder passed away and the family needs to transfer ownership"** -- use Transfer Ownership.
- **"Someone left the family and should be removed"** -- use Remove Member.
- **"I need to understand what accounts and lines belong to this family"** -- check the Accounts section.

#### Important Things to Know

- **You cannot remove the organization owner** -- you must transfer ownership first.
- **You cannot directly set someone as Owner** -- you must use the Transfer Ownership flow, which handles the demotion of the current owner automatically.
- **Transfer Ownership requires typing "TRANSFER"** as a safety confirmation.
- **Adding a member requires they already have an Ultaura user account** -- they must have signed up first.
- All membership changes are audit-logged with full details (who was affected, what role changed, etc.).

---

### Organization Members

#### What This Page Is

A dedicated, full-page view of all members in an organization. This is a simplified, read-only version of the members section on the Organization Detail page, with pagination for organizations that have many members. Unlike the inline members section on the detail page, this page focuses on viewing and quick access rather than role management.

#### How to Get Here

**Organization Detail page -> Quick Links -> Full Members List**, or **Organizations table -> ... menu -> View Members**, or navigate to `/admin/organizations/[uid]/members`.

#### What You See on the Screen

**Breadcrumbs:** Admin > Organizations > [Organization Name] > Members

A **paginated table** with:

| Column            | What It Shows                                    |
| ----------------- | ------------------------------------------------ |
| **Membership ID** | Internal membership record ID                    |
| **User ID**       | The member's UUID, clickable link to User Detail |
| **Name**          | Display name                                     |
| **Role**          | Owner, Admin, or Member badge                    |
| **Actions**       | Menu with view and impersonation options         |

#### What Actions You Can Take

For each member, the **... menu** offers:

- **View User** -- navigate to the User Detail page
- **Impersonate User** -- impersonate this user (opens the impersonation confirmation flow)

Note: This page does not have role management actions (Set as Admin, Set as Member, Remove Member, Transfer Ownership). To manage member roles, use the inline Members section on the Organization Detail page instead.

---

### Billing Lookup

#### What This Page Is

The Billing Lookup page is your tool for investigating billing questions. It lets you search for a subscription using any identifier you have (email, organization UUID, account ID, or Stripe IDs), then shows you the complete billing picture: what's in your database, what Stripe has on file, and the user's recent invoices. Most importantly, it gives you deep links directly into the Stripe Dashboard for when you need to take billing actions.

#### How to Get Here

**Sidebar -> Manage -> Billing**, or navigate to `/admin/billing`.

#### What You See on the Screen

**Search Form** at the top with five input fields:

- **Email** -- the user's email address
- **Organization UUID** -- the organization's unique identifier
- **Account ID** -- the Ultaura account ID
- **Stripe Customer ID** -- starts with "cus\_"
- **Stripe Subscription ID** -- starts with "sub\_"

You only need to fill in one field -- the system will trace the connection to find the associated subscription. If you fill in multiple fields, only the first one (in top-to-bottom order) is used.

**Results Grid** (appears after a successful lookup) with four cards:

**Card 1: Database Subscription**
What your system knows about this subscription:

- Subscription ID
- Account ID
- Plan ID (e.g., "care", "comfort", "family")
- Status badge (active, trialing, cancelled, etc.)
- Billing Interval (monthly or annually)
- Current Period dates (start and end)
- Cancel at Period End (yes/no -- if yes, the subscription is set to expire)
- Stripe Customer ID
- Stripe Subscription ID

**Card 2: Stripe Customer**
What Stripe knows about the customer:

- Customer ID
- Email address
- Name
- Mode badge: **Live** (real charges) or **Test** (test mode)
- Created date
- **Open in Stripe Dashboard** -- a direct link to this customer in your Stripe Dashboard

**Card 3: Stripe Subscription**
What Stripe knows about the subscription:

- Subscription ID
- Status badge
- Mode badge (Live/Test)
- **Price Items** -- a list showing each line item: product name, amount, and billing interval (e.g., "Ultaura Care Plan -- $19.00 / month")
- Current Period dates
- Trial End date (if applicable)
- Cancellation details (if cancelled)
- Payment Method -- the card brand, last 4 digits, and expiration date (e.g., "Visa ending in 4242, expires 12/2025")
- **Open in Stripe Dashboard** -- direct link to this subscription in Stripe

**Card 4: Recent Invoices**
A table of the last 5 invoices:

| Column     | What It Shows                                                                         |
| ---------- | ------------------------------------------------------------------------------------- |
| **Date**   | Invoice creation date                                                                 |
| **Amount** | Invoice total (e.g., "$19.00")                                                        |
| **Status** | Badge: paid, open, draft, void, uncollectible                                         |
| **View**   | Link to the invoice (opens the hosted invoice page if available, or Stripe Dashboard) |

#### What Actions You Can Take

- **Enter any one of the five identifiers** and click **Look Up** (or press Enter). If you fill in multiple fields, only the first one found is used (checked in order: Email, Organization UUID, Account ID, Stripe Customer ID, Stripe Subscription ID).
- **Click "Open in Stripe Dashboard"** on the Customer or Subscription card to go directly to Stripe for actions like refunds, plan changes, or invoice management.
- **Click "View" on any invoice** to see the full invoice details.

#### When and Why You'd Use This

- **"A customer says they were double-charged"** -- look up their subscription, check the invoice history, and use the Stripe Dashboard link to investigate and issue a refund if needed.
- **"Someone's subscription shows as cancelled but they say they're still paying"** -- compare the database subscription status with the Stripe subscription status. If they differ, the webhook might have failed.
- **"What plan is this customer on?"** -- search by email and check the Database Subscription card.
- **"I need to verify a payment method"** -- the Stripe Subscription card shows the card brand, last 4 digits, and expiration.

#### Important Things to Know

- **This page is read-only** -- you cannot modify billing from the admin panel. To make changes (refunds, plan changes, cancellations), use the Stripe Dashboard links provided.
- **Every billing lookup is audit-logged** -- the system records what you searched for and what results were returned.
- **Live vs. Test mode matters** -- the mode badge tells you whether you're looking at real charges or test data. Make sure you're looking at the right environment.
- **The "Payment Method" field only shows the last 4 digits** -- for security, the full card number is never stored or displayed anywhere.

---

## 6. Content

### Subscribers

#### What This Page Is

The Subscribers page shows everyone who has signed up for Ultaura's email newsletter. You can see how many subscribers you have, filter by status or topic preference, and browse the full subscriber list.

#### How to Get Here

**Sidebar -> Content -> Subscribers**, or navigate to `/admin/newsletter`.

#### What You See on the Screen

**Stat Cards** at the top (six cards):

| Card                | What It Shows                                                |
| ------------------- | ------------------------------------------------------------ |
| **Confirmed**       | Number of subscribers who have confirmed their email address |
| **Pending**         | Number who signed up but haven't confirmed yet               |
| **Unsubscribed**    | Number who opted out                                         |
| **Blog Digest**     | Number subscribed to the blog digest topic                   |
| **Elder Care Tips** | Number subscribed to the elder care tips topic               |
| **Product Updates** | Number subscribed to the product updates topic               |

**Filter Controls** -- three dropdown selectors:

- **Status:** All, Confirmed, Pending, Unsubscribed, Expired
- **Source:** All, Homepage, Footer, Blog Listing, Blog Post
- **Topic:** All, Blog Digest, Elder Care Tips, Product Updates

**Subscriber Table** with:

| Column        | What It Shows                                                                         |
| ------------- | ------------------------------------------------------------------------------------- |
| **Email**     | The subscriber's email address                                                        |
| **Name**      | Their name (if provided)                                                              |
| **Status**    | Badge: Confirmed (green), Pending (yellow), Unsubscribed (neutral)                    |
| **Topics**    | Three compact badges using short labels (BD, ECT, PU) to indicate topic subscriptions |
| **Source**    | Where they signed up from (homepage, footer, blog listing, or blog post)              |
| **Confirmed** | Date they confirmed their subscription (if applicable)                                |
| **Created**   | Date they signed up                                                                   |

Pagination at the bottom.

#### What Actions You Can Take

- **Filter the list** using the Status, Source, and Topic dropdowns.
- **Browse the paginated list** to see individual subscriber details.

Note: This page is read-only. You cannot edit or delete subscribers from here. Subscriber management (unsubscribing, etc.) is handled through the email unsubscribe links sent to subscribers.

#### When and Why You'd Use This

- **Before sending a broadcast** -- check how many confirmed subscribers you have for the target topic.
- **Monitoring newsletter growth** -- track confirmed vs. pending counts over time.
- **Investigating delivery issues** -- if someone says they're not getting emails, check if they're confirmed and which topics they're subscribed to.

#### Important Things to Know

- Only **Confirmed** subscribers receive broadcasts. Pending and Unsubscribed subscribers are skipped.
- Viewing the subscriber list is audit-logged.

---

### Broadcasts

#### What This Page Is

The Broadcasts page shows all email broadcasts (newsletters) you've sent or are planning to send. From here you can create new broadcasts and see the status of past ones.

#### How to Get Here

**Sidebar -> Content -> Broadcasts**, or navigate to `/admin/newsletter/broadcasts`.

#### What You See on the Screen

A **New Broadcast** button at the top right.

A **table of all broadcasts**:

| Column      | What It Shows                                                                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Subject** | The email subject line, clickable to view broadcast details                                                                                      |
| **Status**  | Badge showing the broadcast state: Draft (gray), Queued (blue), Sending (blue), Sent (green), Failed (red), Cancelled (gray), Scheduled (yellow) |
| **Created** | When the broadcast was created                                                                                                                   |

#### What Actions You Can Take

- **Click "New Broadcast"** to create and compose a new email.
- **Click any broadcast subject** to view its details (content, delivery status, ability to cancel).

#### When and Why You'd Use This

- **Sending a newsletter** -- click New Broadcast to compose and send.
- **Checking delivery status** -- see if a recent broadcast was successfully sent or if it failed.
- **Reviewing past broadcasts** -- click into any broadcast to see what was sent.

---

### Broadcast Composer (New Broadcast)

#### What This Page Is

The Broadcast Composer is a full email editor where you write and send newsletters to your subscribers. It has a rich text editor, subject line input, and controls for immediate or scheduled sending.

#### How to Get Here

**Broadcasts page -> New Broadcast button**, or navigate to `/admin/newsletter/broadcasts/new`.

#### What You See on the Screen

**The composer form** with:

1. **Subject Line** -- a text input for the email subject
2. **Preview Text** -- a text input for the email preview text (the snippet that appears next to the subject in email clients)
3. **Target Topic** -- a dropdown to select which subscriber group receives this email:
   - Blog Digest
   - Elder Care Tips
   - Product Updates
4. **Rich Text Editor** -- a full formatting toolbar with:
   - **Bold** and **Italic** buttons
   - **H2** and **H3** heading buttons
   - **Link** button (to insert hyperlinks)
   - **Bullet List** and **Numbered List** buttons
   - A text editing area below the toolbar
5. **Send Now** button -- sends the broadcast immediately
6. **Schedule** button -- opens a scheduling dialog

#### What Actions You Can Take

1. **Compose the email:**

   - Enter a subject line
   - Optionally enter preview text
   - Select the target topic (determines which subscribers receive it)
   - Write your content in the rich text editor using the formatting tools

2. **Send immediately:**

   - Click **Send Now**
   - A browser confirmation dialog appears: "Are you sure you want to send this broadcast now? This cannot be undone."
   - Click **OK** to send
   - The broadcast is created and immediately queued for delivery to all confirmed subscribers of the selected topic

3. **Schedule for later:**
   - Click **Schedule**
   - A dialog appears with a date picker (minimum: tomorrow) and a time input
   - Select your desired date and time
   - Click **Schedule**
   - The broadcast is created and will be sent at the scheduled time

#### When and Why You'd Use This

- **Sending a weekly blog digest** -- compose a summary of recent blog posts and send to Blog Digest subscribers.
- **Announcing a new feature** -- write up the feature details and send to Product Updates subscribers.
- **Scheduling a weekend newsletter** -- compose on Friday and schedule for Saturday morning.

#### Important Things to Know

- **HTML is sanitized** -- the system strips out any potentially dangerous HTML to prevent security issues in email clients. Only safe formatting tags (headings, bold, italic, links, lists) are preserved.
- **You can only target one topic per broadcast** -- if you need to send to multiple topics, create separate broadcasts.
- **Sending is audit-logged** with the subject, topic, and whether it was sent immediately or scheduled.
- **You cannot edit a broadcast after sending** -- double-check your content before clicking Send or Schedule.

---

### Broadcast Detail

#### What This Page Is

The Broadcast Detail page shows the full content and status of a single broadcast. For broadcasts that haven't been sent yet, you can cancel them from here.

#### How to Get Here

**Broadcasts page -> click a broadcast subject**, or navigate to `/admin/newsletter/broadcasts/[id]`.

#### What You See on the Screen

- **Broadcast title** (the subject line)
- **Status badge** (Draft, Queued, Sending, Sent, Failed, Cancelled, Scheduled)
- **Created date and time**
- **Sent date and time** (if already sent)
- **Email content preview** -- the full HTML content of the broadcast rendered as it would appear in an email

If the broadcast is in **Draft** or **Queued** status:

- A **Cancel Broadcast** button (red)

#### What Actions You Can Take

- **Cancel a broadcast** that hasn't been sent yet:

  1. Click **Cancel Broadcast**
  2. The broadcast status changes to Cancelled and it will not be delivered

- **Review the content** -- the full email body is rendered so you can see exactly what was (or will be) sent.

#### When and Why You'd Use This

- **Reviewing what was sent** -- check the content of a past broadcast.
- **Canceling an unsent broadcast** -- if you notice an error while it is still Draft or Queued, cancel it before it goes out.
- **Checking delivery status** -- see if a broadcast was successfully sent or if it failed.

#### Important Things to Know

- **You can only cancel broadcasts in Draft or Queued status.** Once a broadcast moves beyond these states, it cannot be cancelled.
- **Cancellation is audit-logged.**
- Once a broadcast is sent, it cannot be recalled or deleted.

---

### Changelog

#### What This Page Is

The Changelog page is where you manage "What's New" updates for Ultaura users. You can create draft entries, publish them to the public changelog, and optionally send email notifications to subscribers about new updates. Think of it as your product update management tool.

#### How to Get Here

**Sidebar -> Content -> Changelog**, or navigate to `/admin/changelog`.

#### What You See on the Screen

**Three action buttons** at the top:

1. **New Entry** -- creates a new changelog draft
2. **Retry Unsent Email** -- retries sending notification emails for the latest batch that failed to send
3. **Publish & Send Email** -- publishes all draft entries and sends email notifications

**Changelog Admin card** explaining the publishing workflow:

- How the "Publish & Send Email" button works (publishes drafts and sends notifications)
- How the "Retry Latest Unsent Email" button works (resends emails for published entries that failed)

**All Entries card** containing the entries table:

**Entries Table:**

| Column           | What It Shows                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------- |
| **Title**        | The entry title, with the description shown below it in smaller text, and the sort order number |
| **Category**     | A badge showing the category (New Feature, Improvement, Fix, or Announcement)                   |
| **Status**       | Published (green) or Draft (gray)                                                               |
| **Published At** | When the entry was published (blank for drafts)                                                 |
| **Email Sent**   | Whether notification emails were sent for this entry, with the send timestamp                   |
| **Actions**      | Three-dot menu with Edit and Delete options                                                     |

#### What Actions You Can Take

1. **Create a New Entry:**

   - Click **New Entry**
   - A dialog appears with: Title (required), Description (required), Category (required, select from dropdown), Sort Order (optional number for controlling display order)
   - Fill in the fields and click **Save**
   - The entry is created as a Draft

2. **Edit an Entry:**

   - Click the **... menu** on any entry -> **Edit**
   - The same dialog appears with the current values pre-filled
   - Make your changes and click **Save**

3. **Delete an Entry:**

   - Click the **... menu** on any entry -> **Delete**
   - A confirmation dialog appears
   - Click **"Delete Entry"** to permanently delete it

4. **Publish All Drafts & Send Email:**

   - Click **Publish & Send Email**
   - All draft entries are published (made visible to users)
   - Email notifications are sent to subscribed users
   - Each published batch gets a unique batch ID for tracking

5. **Retry Failed Emails:**
   - Click **Retry Unsent Email**
   - The system finds the latest batch of published entries where emails were not successfully sent
   - It attempts to resend the notification emails
   - Only entries that were published but not yet emailed are included

#### When and Why You'd Use This

- **Shipping a new feature** -- create a "New Feature" entry with the title and description, then publish when ready.
- **Fixing a bug** -- create a "Fix" entry so users know the issue has been resolved.
- **Batch publishing** -- create multiple draft entries over the week, then publish them all at once on Friday with a single email notification.
- **Email delivery failed** -- use the Retry Unsent Email button to try again without re-publishing.

#### Important Things to Know

- **Draft entries are invisible to users** -- only published entries appear on the public changelog.
- **Publishing is one-way** -- you can't un-publish an entry (but you can delete it).
- **Email sending is separate from publishing** -- publishing makes entries visible; email notification is an additional step that happens during the "Publish & Send Email" action.
- **The sort order** controls the display order of entries within the same publish date.
- **Every action is audit-logged** -- creating, editing, deleting, publishing, and email sends/retries.
- **Category options** are predefined -- exactly four choices: **New Feature**, **Improvement**, **Fix**, and **Announcement**. You select from a dropdown rather than typing free text.

---

## 7. Observe

### Timeline

#### What This Page Is

The Timeline is the most powerful observation tool in the admin panel. It creates a unified, chronological view of everything that happens across the Ultaura platform -- every phone call, safety event, reminder, schedule change, privacy action, and more -- all pulled together from 11 different data sources. It also has a unique feature: **redaction simulation**, which lets you see what a family member (payer) or the senior (recipient) would see, versus what you see as an admin.

#### How to Get Here

**Sidebar -> Observe -> Timeline**, or navigate to `/admin/timeline`.

#### What You See on the Screen

**Filter Bar** across the top, organized into four groups:

**Source Filters** (toggle buttons grouped by category):

- **Calls:** Call Sessions, Call Events, Telephony Events
- **Safety & Scheduling:** Safety Events, Reminders, Schedule Events
- **Contacts:** Trusted Contacts, Notification Recipients
- **Privacy & Data:** Opt-Outs, Data Exports, Consent Audit

Each source has a color-coded badge. Toggle them on/off to show/hide those event types in the timeline.

**Redaction Preview Selector** -- three options:

- **Admin Full** -- you see everything (the default)
- **Payer View** -- simulates what a family member/caregiver sees (some details hidden)
- **Recipient View** -- simulates what the senior sees (most details hidden)

**ID Filters** -- two text inputs:

- **Account UUID** -- filter to show events for a specific account
- **Line UUID** -- filter to show events for a specific phone line
- **Apply** and **Clear** buttons

The timeline supports URL-based filtering context in addition to the Account UUID and Line UUID inputs. In day-to-day admin work, the most reliable direct filters are Account UUID and Line UUID.

**The Timeline** itself is a vertical list of events, each showing:

- A **color-coded dot** indicating the source type
- A **source badge** (e.g., "Call Session", "Safety Event", "Reminder")
- A **summary** describing what happened (e.g., "Inbound call -- completed -- 4m 32s", "Medium safety event detected")
- A **relative timestamp** (e.g., "2 hours ago", "Yesterday at 3:15 PM")
- **Metadata tags** showing the associated Account ID and Line ID
- A **"View Raw" toggle** that expands to show the full JSON payload of the event

**Pagination** at the bottom: Previous and Next buttons.

#### What Actions You Can Take

1. **Filter by source type** -- toggle the source buttons to focus on specific types of events (e.g., only safety events, or only calls).

2. **Filter by account or line** -- enter an Account UUID or Line UUID in the ID filter fields and click **Apply**. Click **Clear** to remove the filter.

3. **Switch redaction mode** -- click between Admin Full, Payer View, and Recipient View to see how the same events look under different privacy levels:

   - **Admin Full:** Everything is visible, including Twilio session IDs, safety signal details, exact phone numbers, consent audit details, and raw payload data.
   - **Payer View:** Sensitive details are hidden. Call sessions show direction, status, and duration but hide Twilio IDs. Safety events show severity but hide specific signals and actions taken. Encrypted reminder messages show as "[hidden]." Trusted contact phone numbers are hidden. Consent audit old/new values are hidden.
   - **Recipient View:** Only safety events are visible, and even those only show a minimal severity-level summary.

4. **View raw data** -- click "View Raw" on any event to expand the full JSON payload. This shows every field the system recorded for that event.

#### When and Why You'd Use This

- **"A family member reports concerning behavior from a call"** -- filter to that account/line, look for safety events, and review call sessions around that time.
- **"I need to verify a reminder was set correctly"** -- filter to Reminders for the relevant account.
- **"I need to see what the family actually sees"** -- switch to Payer View to confirm the privacy system is working correctly.
- **"I need to understand the full sequence of events for a call"** -- filter to Call Sessions and Call Events for a specific line, and read them in chronological order.
- **"A user exercised their privacy rights"** -- look for Consent Audit and Opt-Out entries.
- **"I need to audit data access patterns"** -- the timeline shows Data Export events.

#### Important Things to Know

- **Viewing raw payloads is audit-logged** -- the system records when you expand the "View Raw" section, what entry you viewed, and what source type it was.
- **Changing redaction modes is audit-logged** -- the system records when you switch between Admin Full, Payer View, and Recipient View, and what you switched from.
- **Encrypted content shows as "[encrypted reminder]"** -- some data (like reminder messages) is encrypted at rest. The timeline shows a placeholder instead of decrypting it.
- **The timeline aggregates from 11 sources** -- Call Sessions, Call Events, Safety Events, Reminders, Schedule Events, Opt-Outs, Trusted Contacts, Notification Recipients, Data Exports, Consent Audit, and Telephony Events. Each fetch pulls up to 500 rows.
- **Performance note:** For very active accounts, the timeline may take a moment to load since it's aggregating across many tables.
- You can navigate directly to the timeline for a specific account or line from the Account Detail or Line Detail pages via their "View Timeline" quick link.

---

### Debug Logs

#### What This Page Is

The Debug Logs page shows detailed telephony event logs from the voice AI system. Every tool call, state change, DTMF (keypad) input, error, and safety tier event during phone calls is logged here. This is the deep-dive debugging tool for when something goes wrong with a phone call.

#### How to Get Here

**Sidebar -> Observe -> Debug Logs**, or navigate to `/admin/debug-logs`.

#### What You See on the Screen

A banner at the top shows the **log retention period** (how many days of logs are kept -- typically 3 days, configurable up to 30).

A **Filters** button that opens a filter dialog with six filter options:

| Filter              | What It Does                                                                                                                                                                                                                                                                                                                  |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Start Date**      | Only show logs from this date onward                                                                                                                                                                                                                                                                                          |
| **End Date**        | Only show logs up to this date                                                                                                                                                                                                                                                                                                |
| **Call Session ID** | Filter to a specific phone call                                                                                                                                                                                                                                                                                               |
| **Account ID**      | Filter to a specific account                                                                                                                                                                                                                                                                                                  |
| **Event Type**      | Filter by: DTMF (keypad), Tool Call, State Change, Error, Safety Tier                                                                                                                                                                                                                                                         |
| **Tool Name**       | Filter by specific tool (16 tools available, including: set_reminder, list_reminders, edit_reminder, pause_reminder, resume_reminder, snooze_reminder, cancel_reminder, schedule_call, store_memory, update_memory, forget_memory, mark_private, choose_overage_action, request_opt_out, log_safety_concern, request_upgrade) |

When filters are active, the button shows a **badge with the count** of active filters, and **pills** appear below showing each active filter.

**Debug Log Table:**

| Column           | What It Shows                                                                                                                             |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Created**      | Date and time of the event                                                                                                                |
| **Event**        | Badge showing: DTMF, Tool Call, State Change, Error, or Safety Tier                                                                       |
| **Tool**         | Badge showing which voice AI tool was used (blank if not a tool call event)                                                               |
| **Call Session** | Truncated session ID (hover to see full)                                                                                                  |
| **Account**      | Truncated account ID (hover to see full)                                                                                                  |
| **Payload**      | The event data -- click to expand. Shows "[Encrypted]" for encrypted payloads, or "[Unable to decrypt]" if the system couldn't decrypt it |
| **Metadata**     | Additional context data -- click to expand                                                                                                |

Pagination at the bottom.

#### What Actions You Can Take

1. **Apply filters** -- click the Filters button, set your criteria, and apply. The table updates to show only matching logs.
2. **Clear or adjust filters** -- reopen the Filters dialog to change values or clear them.
3. **Expand payloads** -- click on any Payload or Metadata cell to see the full JSON data.
4. **Page through results** -- use the pagination controls.

#### When and Why You'd Use This

- **"A call dropped unexpectedly"** -- filter by the Call Session ID and look for Error events to see what went wrong.
- **"The AI did something unexpected during a call"** -- filter by the Call Session ID and Event Type "Tool Call" to see exactly what tools the AI used and what data it passed.
- **"I need to verify a reminder was set correctly during a call"** -- filter by Account ID and Tool Name "set_reminder."
- **"A safety event was triggered"** -- filter by Event Type "Safety Tier" to see what triggered it and how the system responded.
- **"I want to see all DTMF keypresses during a call"** -- filter by Call Session ID and Event Type "DTMF."

#### Important Things to Know

- **Logs are only kept for a limited time** (default 3 days, max 30 days). If you need to investigate an issue, do it promptly before the logs expire.
- **Some payloads are encrypted** -- debug logs can contain sensitive call data that's encrypted at rest. The system automatically decrypts them when you view them, using per-account encryption keys.
- **Viewing debug logs is audit-logged** -- the system records that you accessed debug logs, how many were encrypted, and how many failed to decrypt. This is because debug logs can contain sensitive conversation data.
- **Decryption failures** indicate a problem with the encryption key for that account -- this should be investigated on the Diagnostics page.
- **Maximum 200 results per page** to keep the page responsive.

---

### Diagnostics

#### What This Page Is

The Diagnostics page is your system health dashboard. It runs automated checks against every critical system component (database, authentication, Stripe billing, encryption, environment configuration) and shows you pass/fail results. It also displays the recent admin audit log so you can see what other admins have been doing.

#### How to Get Here

**Sidebar -> Observe -> Diagnostics**, or navigate to `/admin/diagnostics`.

#### What You See on the Screen

**Diagnostic Cards Grid** -- seven cards total. Six standard diagnostic checks plus the Encryption Health Card:

| Check                     | What It Tests                                         | Pass Means                                                                                                  | Fail Means                                                                                                    |
| ------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Supabase Admin Client** | Can the system connect to the database and read data? | Database is reachable and working                                                                           | Database connection is broken -- calls, signups, and the dashboard will all be affected                       |
| **Supabase Auth Admin**   | Can the system manage user authentication?            | Auth service is working                                                                                     | Auth is broken -- users can't sign in, sign up, or manage their accounts                                      |
| **Stripe API**            | Can the system connect to Stripe for billing?         | Billing integration is working                                                                              | Stripe connection is broken -- payments, subscription changes, and checkout will fail                         |
| **Environment Variables** | Are all required configuration values present?        | All 7 critical environment variables are set (Stripe keys, Supabase URLs and keys, MFA config, API secrets) | Missing configuration -- the specific missing variable is listed in the error detail                          |
| **Encryption Key Health** | Is the master encryption key valid?                   | The encryption key exists and is in the correct format (64-character hex string)                            | Encryption is broken -- call data, memories, and other sensitive information cannot be encrypted or decrypted |
| **Telephony Event Log**   | Is the telephony system logging events?               | Recent telephony events exist, meaning calls are being processed                                            | No recent events -- the telephony system may be down or not logging correctly                                 |

Each card shows:

- The check name
- A **Pass** (green), **Fail** (red), or **Warn** (yellow) badge
- Detail text explaining the result
- Error message (if the check failed)

Below the diagnostic cards is the **Encryption Health Card** (the primary location for this auto-refreshing encryption health check).

**Admin Audit Log Table** at the bottom -- the last 20 admin actions:

| Column        | What It Shows                                                                         |
| ------------- | ------------------------------------------------------------------------------------- |
| **Timestamp** | When the action was taken                                                             |
| **Admin**     | Who performed the action (shows the admin's email address)                            |
| **Action**    | The action code in monospace font (e.g., "user.ban", "admin.search", "stripe.lookup") |
| **Target**    | The type and ID of what was acted on                                                  |
| **Details**   | Truncated JSON string showing additional context                                      |

#### What Actions You Can Take

- **Review each health check** -- scan the cards for any failures or warnings.
- **Click the Refresh button** on the Encryption Health Card to force a fresh encryption check.
- **Review the audit log** -- scan recent admin actions for anything unexpected.

#### When and Why You'd Use This

- **Daily health check** -- visit this page each morning to verify all systems are operational.
- **After a deployment** -- check that all environment variables are still set and all services are connected.
- **When users report issues** -- start here to rule out system-level problems before investigating individual accounts.
- **When you suspect encryption issues** -- check both the Encryption Key Health diagnostic and the Encryption Health Card.
- **To review admin activity** -- the audit log shows what actions have been taken and by whom.

#### Important Things to Know

- **Visiting this page is audit-logged** -- even viewing the diagnostics is recorded.
- **The diagnostic checks run fresh on every page load** -- they're not cached, so you always see current status.
- **The Encryption Health Card auto-refreshes every 60 seconds** -- you don't need to manually reload the page to get updated encryption status.
- **Environment variable check** verifies 7 specific variables: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, ADMIN_ENFORCE_MFA, and ULTAURA_INTERNAL_API_SECRET. If any is missing, the check tells you which one.
- **A failing Telephony Event Log check** doesn't necessarily mean the telephony system is down -- it could mean no calls have happened recently. Check the time of the last event.

---

### Feedback

#### What This Page Is

The Feedback page shows all user-submitted feedback from the in-app feedback widget. Users can report bugs, ask questions, or leave general feedback, and it all lands here. The system uses AI-powered similarity matching to group related feedback together.

#### How to Get Here

**Sidebar -> Observe -> Feedback**, or navigate to `/admin/feedback`.

#### What You See on the Screen

A **search bar** at the top for filtering feedback by text content.

A **paginated table** (8 submissions per page):

| Column          | What It Shows                                                                                               |
| --------------- | ----------------------------------------------------------------------------------------------------------- |
| **Type**        | A colored badge: red for **Bug**, blue for **Question**, green for **Feedback** (or other types)            |
| **Text**        | The first 35 characters of the feedback, clickable to view the full submission                              |
| **User**        | A "View User" link to the user's admin detail page, or a dash (-) if the feedback was submitted anonymously |
| **Language**    | The user's browser language (e.g., "en-US")                                                                 |
| **Screen Size** | The user's screen dimensions (e.g., "1440x900") -- helpful for reproducing UI bugs                          |
| **Date**        | When the feedback was submitted                                                                             |
| **Actions**     | Three-dot menu                                                                                              |

For each row, the **... menu** offers:

1. **View** -- opens the full feedback detail page
2. **Reply** (only for questions) -- opens your email client with the submitter's email address pre-filled
3. **Delete** -- opens a confirmation dialog ("Are you sure you want to delete this feedback submission?") with a red **Yep, delete it** button

Pagination at the bottom.

#### What Actions You Can Take

1. **Search feedback** -- type in the search bar to filter submissions by text content.
2. **View a submission** -- click the text snippet or use the menu -> View.
3. **Reply to a question** -- use the menu -> Reply (opens your email client).
4. **Delete feedback** -- use the menu -> Delete, then confirm in the dialog.
5. **Navigate to the submitter's user profile** -- click the "View User" link.

#### When and Why You'd Use This

- **Monitoring user satisfaction** -- regularly check for new feedback to understand user sentiment.
- **Bug triaging** -- filter for "Bug" type submissions to find reported issues.
- **Responding to questions** -- use the Reply action to email users who have questions.
- **Understanding device-specific issues** -- the Language and Screen Size columns help you reproduce bugs on the right device/browser.

#### Important Things to Know

- **Anonymous feedback** doesn't have a user link -- the User column shows a dash.
- **Reply only appears for questions** -- for bugs and general feedback, you'd need to contact the user through other means.
- **Deleting feedback is permanent** -- the confirmation dialog protects against accidental deletion.

---

### Feedback Detail

#### What This Page Is

The full view of a single feedback submission, including the complete text, any attached screenshots, and AI-matched similar submissions.

#### How to Get Here

**Feedback page -> click a feedback text snippet**, or **Feedback page -> ... menu -> View**, or navigate to `/admin/feedback/[id]`.

#### What You See on the Screen

**Breadcrumbs:** Admin > Feedback > Submission

**Metadata badges** at the top:

- **Type** -- Bug (red), Question (blue), or Feedback (green)
- **User** -- the user's ID as a clickable link to their admin profile, or "Anonymous"
- **Screen** -- the page/screen the user was on when they submitted feedback (e.g., "Dashboard", "Settings")
- **Created** -- date and time of submission

**The full feedback text** -- displayed in a bordered, left-accented block with the heading "The user submitted the following feedback:"

**Attachment** (if any) -- displayed under the heading "The user also attached the following file:" The image is shown at a large size. Attachments are stored securely and loaded via a time-limited signed URL.

**Similar Submissions** (if any) -- under the heading, a numbered list of up to 5 related feedback submissions found by AI similarity matching (using vector embeddings with a similarity threshold of 0.8). Each shows the first 100 characters as a clickable link to that submission's detail page.

#### What Actions You Can Take

This page is **read-only** -- navigate back using the breadcrumbs.

#### When and Why You'd Use This

- **Reading full feedback** -- when the 35-character preview on the list page isn't enough.
- **Viewing screenshots** -- users can attach images (often screenshots of bugs) that are shown here.
- **Finding patterns** -- the "Similar Submissions" section automatically groups related feedback, helping you spot recurring issues or feature requests.

---

## 8. Deep-Dive: Account Detail

### What This Page Is

The Account Detail page shows everything about a single Ultaura account -- the container that holds a subscription, phone lines, and minute usage. An account belongs to an organization and represents one subscription/billing relationship.

### How to Get Here

**Search for a user -> click an account in the results**, or **Organization Detail -> Ultaura Accounts -> View Account**, or navigate to `/admin/accounts/[accountId]`.

### What You See on the Screen

**Five sections:**

**1. Account Info**

- Account Status badge (e.g., Active, Trialing) -- displayed prominently in the header
- Account ID (UUID)
- Account Name
- Billing Email
- Plan ID (e.g., "care", "comfort", "family", "payg")
- User Type
- Organization ID (linked to the parent organization)
- Created At
- Overage Cap in cents (the maximum overage charges allowed per billing cycle, default 10000 cents = $100)
- Trial Starts and Trial Ends dates (if the account is or was in a trial -- these only appear for trial accounts)

**2. Minutes Usage**

Four stat cards:

| Card                      | What It Shows                                                                             |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| **Included Minutes**      | How many minutes are included in the account's plan (e.g., 200 for Care, 600 for Comfort) |
| **Minutes Used**          | How many minutes have been used in the current billing cycle                              |
| **Overage Minutes**       | How many minutes were used beyond the included amount (these are billed at $0.15/minute)  |
| **Total Connected (min)** | Total minutes of actual connected call time                                               |

Below the cards: **Cycle Start** and **Cycle End** dates showing the current billing cycle period.

**3. Subscription**

Full subscription details:

- Subscription ID
- Status (active, trialing, cancelled, etc.)
- Plan name
- Billing Interval (monthly or annually)
- Stripe Customer ID
- Stripe Subscription ID
- Current Period (start and end dates)
- Cancel at Period End (yes/no)

**4. Lines**

A table of all phone lines on this account:

| Column           | What It Shows                                                               |
| ---------------- | --------------------------------------------------------------------------- |
| **Display Name** | The name given to this line (usually the senior's name, e.g., "Mom's Line") |
| **Phone**        | The Ultaura phone number assigned to this line                              |
| **Status**       | Active, Paused, etc.                                                        |
| **Timezone**     | The timezone configured for this line (affects call scheduling)             |
| **Actions**      | A "View" button that links to the Line Detail page                          |

**5. Quick Links**

- **View Timeline** -- opens the Timeline page filtered to this account

### What Actions You Can Take

- **View any line's details** by clicking the View link in the Lines table.
- **View the timeline for this account** by clicking the View Timeline quick link.

### When and Why You'd Use This

- **Investigating minute usage** -- see exactly how many minutes have been used vs. what's included in the plan.
- **Checking overage charges** -- see if the account has gone over its included minutes and by how much.
- **Understanding the subscription status** -- verify the plan, billing interval, and whether cancellation is pending.
- **Seeing all phone lines** on an account and their statuses.

### Important Things to Know

- **Viewing this page is audit-logged.**
- **Overage Cap** limits how much a user can be charged for overage minutes in a single billing cycle. Displayed in cents on this page (default: 10000 cents = $100). If overage reaches this cap, calls may be blocked until the next cycle.
- **Minutes are tracked per billing cycle** -- they reset when a new billing period starts.

---

## 9. Deep-Dive: Line Detail

### What This Page Is

The Line Detail page shows everything about a single phone line -- the specific "connection" that the AI uses to call a senior. Each line has its own phone number, call schedule, quiet hours, and configuration.

### How to Get Here

**Account Detail -> Lines table -> View**, or navigate to `/admin/lines/[lineId]`.

### What You See on the Screen

**Four sections:**

**1. Line Info**

- Line Status badge (e.g., Active, Paused) -- displayed prominently in the header
- Line ID (full UUID)
- Short ID (abbreviated version, used in some interfaces)
- Display Name (the human-friendly name, e.g., "Mom's Line")
- Phone Number (the Ultaura number assigned to this line)
- Timezone (used for scheduling calls at the right local time)
- Preferred Voice (the AI voice style configured for this senior)
- Created At
- Account ID (link back to the parent account)

**2. Call Configuration**

- **Quiet Hours Start** and **Quiet Hours End** -- the time window when no calls should be made (e.g., 9 PM to 8 AM)
- **Voicemail Behavior** -- what the AI does when the call goes to voicemail
- **Inbound Allowed** -- badge showing whether the senior can call Ultaura (yes/no)
- **Do Not Call** -- badge showing whether this line is set to "do not call" (the AI will not place outbound calls)
- **Vacation Ranges** -- any date ranges when calls are paused (displayed as JSON data)

**3. Recent Call Sessions (Last 10)**

A table showing the most recent phone calls:

| Column          | What It Shows                                                                      |
| --------------- | ---------------------------------------------------------------------------------- |
| **Session ID**  | Truncated call session identifier                                                  |
| **Direction**   | Badge: Inbound (the senior called Ultaura) or Outbound (Ultaura called the senior) |
| **Status**      | Badge: Completed, No Answer, Busy, Failed, etc.                                    |
| **Answered By** | Who/what answered (e.g., "human", "voicemail")                                     |
| **Duration**    | Call length in minutes and seconds                                                 |
| **End Reason**  | Why the call ended (e.g., "normal", "timeout")                                     |
| **Created**     | When the call happened                                                             |

**4. Quick Links**

- **View Parent Account** -- navigate to the Account Detail page
- **View Timeline** -- open the Timeline filtered to this line

### What Actions You Can Take

- **Navigate to the parent account** via the Quick Links.
- **View the timeline** for this specific line.
- **Review recent calls** to understand the senior's call patterns and any issues.

### When and Why You'd Use This

- **"Why isn't mom getting her calls?"** -- check "Do Not Call" status, quiet hours, and vacation ranges. Then look at recent call sessions to see if calls are being made and what's happening (no answer? busy? failed?).
- **"The AI called at a weird time"** -- check the timezone setting and quiet hours to see if they're configured correctly.
- **"Calls keep going to voicemail"** -- look at the "Answered By" column in recent calls to see how often voicemail is the answer.
- **"How often is mom talking to the AI?"** -- review the recent call sessions for frequency and duration patterns.

### Important Things to Know

- **Viewing this page is audit-logged.**
- **Only the last 10 calls are shown** -- for a complete call history, use the Timeline page with a line filter.
- **"Do Not Call"** is a hard stop -- if this is set, no outbound calls will be made to this line regardless of schedule.
- **Quiet Hours** prevent calls during sleeping/resting times -- calls will be scheduled outside this window.
- **Inbound Allowed** controls whether the senior can call Ultaura on their own (not just receive scheduled calls).

---

## 10. Common Workflows (Step-by-Step)

### "A user says they can't access their account"

1. Go to **Search** (Sidebar -> Search).
2. Select **Email** from the dropdown and enter the user's email address.
3. Click **Search**.
4. In the results, check:
   - **Status badge**: Is it "Banned"? If so, someone banned their account. Check the audit log on the Diagnostics page to find out who and why. If it was a mistake, go to their User Detail page and click **... -> Reactivate User**.
   - **Organizations**: Do they have any? If none, they may not have completed onboarding.
   - **Accounts**: Is there an account with an active subscription? Check the plan and status.
   - **Last sign-in date**: Have they ever successfully logged in?
5. If their subscription looks wrong, click the account to go to Account Detail, then note the Stripe Customer ID.
6. Go to **Billing Lookup** (Sidebar -> Manage -> Billing), enter the Stripe Customer ID, and check if the Stripe subscription matches your database.
7. If you need to see exactly what they see, use **Impersonate User** from their User Detail page to log in as them and investigate directly.

### "I need to investigate a billing discrepancy"

1. Go to **Billing Lookup** (Sidebar -> Manage -> Billing).
2. Enter whatever identifier you have (email, org UUID, account ID, or Stripe ID).
3. Click **Look Up**.
4. Compare the four result cards:
   - Does the **Database Subscription** plan/status match the **Stripe Subscription** plan/status? If they differ, there may be a webhook delivery issue.
   - Check the **Stripe Subscription** card for the exact price items -- are they charging the right amount?
   - Check **Recent Invoices** -- are there unexpected charges, failed payments, or unusual amounts?
5. Click **"Open in Stripe Dashboard"** on either the Customer or Subscription card to access Stripe's full tools.
6. In Stripe, you can: issue refunds, adjust subscriptions, retry failed payments, or review the complete invoice history.

### "A family member reports concerning behavior from a call"

1. Go to **Search** and find the user or account.
2. Note the **Account ID** or **Line ID** from the search results.
3. Go to **Timeline** (Sidebar -> Observe -> Timeline).
4. Enter the Account UUID or Line UUID in the ID filters and click **Apply**.
5. Turn on the **Safety Events** and **Call Sessions** source filters (turn others off to reduce noise).
6. Look for **Safety Events** -- these are flagged when the AI detects something concerning. Check the severity level:
   - Low: informational / lower concern
   - Medium: moderate concern
   - High: urgent concern (immediate attention needed)
7. For each safety event, click **View Raw** to see the full details: what signals triggered the flag, what action the system took, and the associated call session.
8. Cross-reference with **Call Sessions** around the same time to understand the full context.
9. If you need more detail about what happened during the call, go to **Debug Logs** (Sidebar -> Observe -> Debug Logs), filter by the Call Session ID, and review the tool calls and state changes.

### "I need to verify the system is healthy"

1. Go to **Diagnostics** (Sidebar -> Observe -> Diagnostics).
2. Scan all diagnostic cards. Every card should show **Pass** (green):
   - **Supabase Admin Client**: Database is connected
   - **Supabase Auth Admin**: Authentication service is working
   - **Stripe API**: Billing integration is active
   - **Environment Variables**: All 7 required configs are present
   - **Encryption Key Health**: Master key is valid
   - **Telephony Event Log**: Calls are being processed
3. Check the **Encryption Health Card** -- it should show "Healthy."
4. Scroll down to the **Audit Log Table** and scan for any unusual actions or unfamiliar admin emails.
5. If any check fails:
   - **Supabase checks failed**: The database or auth service may be down. Check the Supabase dashboard.
   - **Stripe check failed**: The Stripe API key may have been rotated or expired. Check the Stripe dashboard.
   - **Environment Variables check failed**: A required configuration value is missing. The error details tell you which one.
   - **Encryption Key failed**: The master encryption key is missing or malformed. This is critical -- encrypted data cannot be read until this is fixed.
   - **Telephony Event Log failed**: No recent call events. Check if the telephony server is running.

### "I need to send a newsletter to all subscribers"

1. Go to **Subscribers** (Sidebar -> Content -> Subscribers) to check your audience size.
2. Note how many **Confirmed** subscribers you have for your target topic (Blog Digest, Elder Care Tips, or Product Updates).
3. Go to **Broadcasts** (Sidebar -> Content -> Broadcasts).
4. Click **New Broadcast**.
5. Fill in:
   - **Subject** -- write a compelling email subject line
   - **Preview Text** (optional) -- the snippet shown in email clients next to the subject
   - **Target Topic** -- select which subscriber group should receive this
6. Write your content in the rich text editor. Use the toolbar for formatting:
   - **Bold** and **Italic** for emphasis
   - **H2** and **H3** for section headings
   - **Link** to add clickable URLs
   - **Lists** for bullet points or numbered steps
7. When ready:
   - To send now: Click **Send Now** -> **OK** in the confirmation dialog
   - To schedule: Click **Schedule** -> pick a date and time -> **Schedule**
8. After sending, go back to the **Broadcasts** list and verify the status shows "Sent" (or "Scheduled" if you scheduled it).

### "I need to impersonate a user to debug their view"

1. Find the user via **Search** or the **Users** list.
2. Navigate to their **User Detail** page (or use the row menu in the Users table).
3. Click **Impersonate** (or **Impersonate User** in the table menu).
4. A confirmation dialog appears explaining what impersonation means. Click **"Yes, let's do it"** to proceed. (Unlike ban and delete, impersonation does not require typing a confirmation word -- it's a simple button click.)
5. You'll be automatically logged in as that user and redirected to their dashboard.
6. You can now see exactly what they see -- their lines, schedules, insights, everything.
7. **To return to your admin account**: Log out of the impersonated session and log back in with your own credentials. You can also navigate directly to `/admin` (you'll need to re-authenticate).

**Safety notes:**

- You cannot impersonate yourself.
- The impersonation is audit-logged with your admin ID, the target user's ID, and the timestamp. There is a permanent record that cannot be deleted.
- While impersonated, you have full access to the user's account. Be careful not to make changes -- you're there to observe, not modify.
- The impersonation session uses real authentication tokens, so the user's dashboard will behave exactly as it does for them.

### "I need to remove a bad actor from the platform"

**Ban vs. Delete -- when to use which:**

| Action     | When to Use                                                                                                                                                           | Reversible?                           |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| **Ban**    | The user is violating terms of service but you might need their data for investigation, or you may want to reactivate them later                                      | Yes -- you can reactivate at any time |
| **Delete** | The user needs to be permanently removed and all their data destroyed. Use for spam accounts, or after an investigation is complete and you're certain about removal. | No -- permanent and irreversible      |

**To ban a user:**

1. Find the user via **Search** or the **Users** list.
2. Navigate to their **User Detail** page (or use the row menu in the Users table).
3. Click the **... menu** -> **Ban User**.
4. A confirmation dialog appears. Type **BAN** in the text field.
5. Click **"Yes, ban user"**.
6. The user's status changes to "Banned" and they can no longer log in.
7. Their data remains intact for investigation purposes.

**To delete a user:**

1. Find the user via **Search** or the **Users** list.
2. Navigate to their **User Detail** page (or use the row menu in the Users table).
3. Click the **... menu** -> **Delete User**.
4. A confirmation dialog appears with a warning that this will also delete their organization data. Type **DELETE** in the text field.
5. Click **"Yes, delete user"**.
6. The user and their data are permanently removed. You're redirected to the Users list.

**Recommended workflow for bad actors:**

1. **First, ban** -- this immediately blocks access while preserving data.
2. **Investigate** -- use Timeline and Debug Logs to understand what happened.
3. **Document** -- note the audit log entries for your records.
4. **Then delete** (if appropriate) -- only after you've completed your investigation and no longer need the data.

### "I want to understand platform growth and revenue"

1. Go to the **Overview Dashboard** (Sidebar -> Overview).
2. Start with the **Overview Tab**:
   - **MRR** tells you current monthly revenue from subscriptions
   - **ARR** tells you projected annual revenue
   - **Users** and **Organizations** show total platform size
   - **Paying Customers** vs. **Trials** shows your conversion funnel top-level
3. Switch to the **Revenue Tab**:
   - **Overage / PAYG Revenue** shows additional revenue beyond base subscriptions
   - **Subscribers** breakdown shows the monthly vs. annual split (annual subscribers have higher lifetime value)
   - **Pending Cancellations** shows churn risk
   - The **Plan Distribution Chart** shows which plans are most popular -- if most users are on the cheapest plan, there may be upsell opportunities
4. Switch to the **Usage Tab**:
   - **Minutes Used vs. Allotted** shows overall platform utilization. If total usage is well below allotted, users aren't fully utilizing their plans. If it's near or above, expect overage revenue.
   - **Active Lines** shows how many seniors are actually connected
   - **Call Answer Rate** indicates overall engagement/connection quality in aggregate call data -- a low rate can still suggest timing or reachability problems
   - **Avg Call Duration** indicates conversation quality -- longer calls generally mean better AI engagement
5. Switch to the **Costs Tab**:
   - **Twilio Costs** and **AI Model Costs** are your two main variable costs
   - Compare these against revenue to understand margins

### "I need to debug why a phone call failed"

1. Find the relevant account or line (via **Search** or by navigating from a user's detail page).
2. Go to the **Line Detail** page for the specific phone line.
3. Check the **Recent Call Sessions** table -- look for the failed call. Note:
   - The **Status** column will show "Failed" or another non-success status
   - The **End Reason** column may give a clue (e.g., "timeout", "error", "busy")
   - Note the **Session ID** of the failed call
4. Go to **Debug Logs** (Sidebar -> Observe -> Debug Logs).
5. Click **Filters** and enter the **Call Session ID** from step 3.
6. Apply the filter and look at all events for that call:
   - **Error** events will show exactly what went wrong
   - **State Change** events show the call's progression
   - **Tool Call** events show what the AI attempted to do
7. Expand the **Payload** column on error events to see the full error details.
8. If you need even more context, go to **Timeline** (Sidebar -> Observe -> Timeline), filter by the Line UUID, and look at Call Events and Telephony Events around the same time.

### "I need to publish a changelog update and notify users"

1. Go to **Changelog** (Sidebar -> Content -> Changelog).
2. Click **New Entry**.
3. In the dialog:
   - Enter a **Title** (e.g., "New: Vacation Mode for Phone Lines")
   - Enter a **Description** explaining the update
   - Select a **Category** (New Feature, Improvement, Fix, or Announcement)
   - Optionally set a **Sort Order** (controls display order when multiple entries publish on the same date)
4. Click **Save**. The entry appears in the table as a "Draft."
5. Repeat steps 2-4 for any additional updates you want to include in this batch.
6. When all entries are ready, click **Publish & Send Email** at the top.
7. This does two things:
   - Publishes all draft entries (they become visible on the public changelog page)
   - Sends a single email notification to subscribed users summarizing all the new entries
8. If the email sending fails (you'll see an error message), click **Retry Unsent Email** to try again.
9. Verify in the table that entries show "Published" status. The "Email Sent" field reflects send state, but a timestamp may be blank in some records depending on the underlying entry data.

---

## 11. Glossary

| Term                   | Definition                                                                                                                                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AAL2**               | Authenticator Assurance Level 2 -- a security standard meaning the user has verified their identity with at least two different authentication methods (e.g., password + authenticator app). Required for admin access in production. |
| **Account**            | An Ultaura account represents one subscription and billing relationship. It belongs to an organization and contains one or more phone lines.                                                                                          |
| **ARR**                | Annual Recurring Revenue -- the total value of all active subscriptions projected over a full year (MRR x 12).                                                                                                                        |
| **Audit Log**          | A permanent record of sensitive/admin actions. Includes who did it, what they did, when, and related context metadata.                                                                                                                |
| **Broadcast**          | A one-time email sent to newsletter subscribers. Can be sent immediately or scheduled for later.                                                                                                                                      |
| **CSRF**               | Cross-Site Request Forgery -- a type of attack where a malicious website tricks your browser into performing actions. The admin panel has built-in protection against this.                                                           |
| **DEK**                | Data Encryption Key -- a unique encryption key assigned to each Ultaura account. Used to encrypt sensitive data (call content, memories, reminders) so that even database access alone can't read the data.                           |
| **Do Not Call**        | A line setting that prevents Ultaura from making any outbound calls to that phone number. The senior can still call Ultaura inbound if inbound is allowed.                                                                            |
| **DTMF**               | Dual-Tone Multi-Frequency -- the technical term for phone keypad tones. When a senior presses a number key during a call, it's logged as a DTMF event.                                                                                |
| **E.164**              | The international standard format for phone numbers (e.g., +15551234567). Includes the country code prefix.                                                                                                                           |
| **Impersonation**      | Logging in as another user to see exactly what they see. Used for debugging user-reported issues. Always audit-logged.                                                                                                                |
| **KEK**                | Key Encryption Key -- the master encryption key used to encrypt/decrypt individual DEKs. Stored as an environment variable, never in the database.                                                                                    |
| **Line**               | A phone line in Ultaura -- represents the connection to one senior. Each line has its own phone number, call schedule, quiet hours, and AI personality.                                                                               |
| **MFA**                | Multi-Factor Authentication -- requiring two or more forms of identity verification (typically password + authenticator app code).                                                                                                    |
| **MRR**                | Monthly Recurring Revenue -- the total amount of revenue generated by all active subscriptions per month. The most common SaaS metric for tracking business health.                                                                   |
| **Organization**       | A family group in Ultaura. Contains members (family/caregivers), accounts (billing relationships), and lines (connections to seniors).                                                                                                |
| **Overage**            | Minutes used beyond what's included in a subscription plan. Billed at $0.15 per minute.                                                                                                                                               |
| **Overage Cap**        | The maximum dollar amount of overage charges allowed per billing cycle (default: $100). Protects users from unexpectedly large bills.                                                                                                 |
| **PAYG**               | Pay As You Go -- a pricing plan with no base fee and no included minutes. Every minute is billed at the overage rate ($0.15/min).                                                                                                     |
| **Quiet Hours**        | A time window (e.g., 9 PM - 8 AM) when Ultaura will not make outbound calls to a line. Respects the line's timezone.                                                                                                                  |
| **Redaction**          | Hiding or removing sensitive details from data displays. The Timeline has three redaction modes: Admin Full (see everything), Payer View (see what the family sees), Recipient View (see what the senior sees).                       |
| **Redaction Mode**     | The privacy filter applied to Timeline data. "Admin Full" shows all data. "Payer View" shows what a paying family member would see (some details hidden). "Recipient View" shows what the senior would see (most details hidden).     |
| **RLS**                | Row-Level Security -- a database feature that restricts which rows a user can see based on their identity. Prevents users from accessing other users' data. Admin operations bypass RLS using a special service key.                  |
| **Safety Event**       | An event triggered when the AI detects something potentially concerning during a call -- signs of distress, confusion, dangerous situations, or other safety-relevant signals. Categorized by severity (`low`, `medium`, `high`).     |
| **Safety Severity**    | The severity level of a safety event. `low`: informational/lower concern. `medium`: moderate concern, may trigger notifications. `high`: urgent concern and can trigger immediate caregiver alerts.                                   |
| **Session ID**         | A unique identifier for a single phone call. Used to look up all events, tool calls, and logs associated with that call.                                                                                                              |
| **Stripe**             | The payment processing service Ultaura uses for subscriptions, charges, and invoices.                                                                                                                                                 |
| **Super Admin**        | The highest privilege level in Ultaura. Only super-admins can access the admin panel. The role is stored in the user's authentication metadata.                                                                                       |
| **Topic**              | A newsletter subscription category. Ultaura has three: Blog Digest, Elder Care Tips, and Product Updates. Subscribers choose which topics they want to receive.                                                                       |
| **UUID**               | Universally Unique Identifier -- a long string of letters and numbers (e.g., "550e8400-e29b-41d4-a716-446655440000") used as a unique ID for users, organizations, accounts, and lines.                                               |
| **Voicemail Behavior** | What Ultaura does when an outbound call goes to the senior's voicemail -- options include leaving a message, hanging up, or trying again later.                                                                                       |

---

_This guide covers the Ultaura admin panel as of February 27, 2026. If you encounter features or screens not documented here, they may have been added after this guide was written._
