# QubicLink 
<img width="1024" height="1024" alt="QubicLink Logo" src="https://github.com/user-attachments/assets/4a274c60-0029-4b8b-a233-459d432faeff" />
A production-grade identity bridge that securely links **Discord identities** with **Qubic blockchain wallets**. It enables **automated, trustless verification** and **on-chain, portfolio-based role management** without requiring users to sign messages or expose private keys.

<img width="1919" height="1078" alt="Admin Dashboard" src="https://github.com/user-attachments/assets/18eb839a-8570-4cb8-9bd7-37ad07a4a489" />
---

## Key Capabilities

-   **🔐 Trustless Wallet Verification:** Users prove wallet ownership through a verifiable on-chain action (a micro-transaction signal), re-verified against the Qubic RPC.

-   **⚡ Dynamic & Automated Role Management:**
    -   Assign Discord roles automatically based on a user's total Qubic portfolio value.
    -   Create custom roles and balance thresholds (e.g., "Verified", "Whale", "Shark") directly from a secure admin dashboard. No more hardcoding!

-   **🔄 Resilient Background Jobs:**
    -   Scheduled jobs periodically refresh user portfolios and reconcile Discord roles to ensure they always reflect on-chain reality.
    -   **Connection Resiliency:** All database and RPC interactions are built with automatic retry logic and circuit breakers to handle sleeping serverless databases and temporary network failures gracefully.

-   **🛡️ Defense-in-Depth Security:**
    -   **Strict CORS Policy** for the admin API in development.
    -   **JWT-based Authentication** for the admin dashboard.
    -   Zod schema validation for all incoming API data.
    -   Idempotent transaction processing to prevent replay attacks.
    -   Ownership conflict protection to prevent wallet theft.

-   **📊 Admin Dashboard & Control:**
    -   A secure React SPA for operational visibility.
    -   Manage wallets, users, and role thresholds.
    -   Manually trigger a full portfolio and role refresh for all users, which intelligently resets the next scheduled job.

---

## Technology Stack

-   **Backend:** Node.js, Express, discord.js, Prisma, PostgreSQL, Pino (Logger)
-   **Frontend:** React, Vite, Material-UI, TanStack Query
-   **Jobs:** node-cron

---

## Environment Configuration

Create a `.env` file in the project root. **Role thresholds like "Whale" or "Verified" are no longer set here; they are managed in the admin dashboard after initial setup.**

```ini
# --- Core Discord Bot Credentials ---
DISCORD_TOKEN=
CLIENT_ID=
GUILD_ID=

# --- Admin Dashboard ---
# A strong password for the admin login page.
ADMIN_PASSWORD=
# A long, random secret for signing JWTs. Generate one from a password manager or CLI.
ADMIN_JWT_SECRET=
# The full URL where the frontend is hosted (for development and CORS).
FRONTEND_URL=http://localhost:3000

# --- Logging ---
# Set the logging verbosity. Options: 'debug', 'info', 'warn', 'error'.
LOG_LEVEL=info
```

---

## Local Development

**Prerequisites:**
-   Node.js (v18+ recommended)
-   PostgreSQL database

**Steps:**

1.  **Clone the repository**
    ```bash
    git clone <your-repo-url>
    cd qubiclink
    ```

2.  **Configure Environment**
    -   Create and populate your `.env` file as described in the section above.

3.  **Install All Dependencies**
    ```bash
    npm run install:all
    ```

4.  **Set up and Sync Database**
    *For the first time, you may need to create a migration*
    ```bash
    npx prisma migrate dev --name initial-setup
    ```

5.  **Run the Application**
    ```bash
    npm run dev
    ```
    This single command concurrently starts the backend API, the frontend Vite server with hot-reload, and the Discord bot. Your browser should automatically open to `http://localhost:3000`.

---

## Production Deployment

1.  **Set Environment Variables** in your hosting provider (e.g., Railway, Heroku).

2.  **Build Command:**
    ```bash
    npm run build
    ```
    *This single command installs all dependencies, builds the frontend, generates the Prisma client, and runs database migrations.*

3.  **Start Command:**
    ```bash
    npm start
    ```
    *This command runs the optimized Node.js server.*

---

## Initial Role Setup

After the first launch, you must configure the roles you want to manage automatically.

1.  Log into the admin dashboard.
2.  Navigate to the **Settings / Role Thresholds** page.
3.  Click **"Add New Role"**.
4.  Create your base role:
    -   **Role Name:** `Verified`
    -   **Discord Role ID:** (Paste the ID from your Discord server)
    -   **Threshold:** `0` (This means any user with a verified wallet will get this role).
5.  Create your other roles:
    -   **Role Name:** `Whale`
    -   **Discord Role ID:** (Paste the ID)
    -   **Threshold:** `1000000` (for 1 Million Qubic).

These roles will now be automatically assigned and updated by the background jobs.