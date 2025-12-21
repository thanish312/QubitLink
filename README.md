# QubicLink

**QubicLink** is a Web3 identity verification and automation system that links on-chain wallet activity with Discord communities on the Qubic blockchain.

It enables secure wallet ownership verification, multi-wallet portfolio aggregation, and automated role assignment — without requiring users to sign transactions or interact with smart contracts.

QubicLink is designed for real community workflows and long-running Discord servers.

---

<div align="center">

<img width="1024" height="1024" alt="QubicLink Banner" src="https://github.com/user-attachments/assets/d889a2a1-6005-44f0-aea2-9395e8779a30" />

</div>

---

## Overview

Managing identity in Web3 communities is still largely manual and error-prone. Wallets exist on-chain, communities exist off-chain, and there is no reliable way to connect the two.

**QubicLink** bridges this gap by providing a practical identity layer between the Qubic blockchain and Discord. It allows community operators to verify wallet ownership, aggregate balances across multiple wallets, and automate Discord roles based on real on-chain data.

No smart contracts. No signatures. No friction.

---

## The Problem: On-Chain Activity, Off-Chain Blindness

Community operators face several persistent issues:

* **Invisible high-value users**
  Large token holders are visible on-chain but anonymous in Discord.

* **Manual role management**
  Assigning roles or rewards requires spreadsheets, screenshots, and trust.

* **Disconnected engagement**
  Significant on-chain events occur without any off-chain recognition or automation.

---

## The Solution: Wallet Verification + Automation

QubicLink introduces a secure, cost-neutral verification mechanism combined with automated portfolio tracking.

### Wallet Ownership Verification

Users verify ownership by placing a uniquely identifiable limit order on the Qubic Exchange (QX).
The system detects this signal instantly, and the order can be canceled immediately — resulting in zero cost to the user.

### Multi-Wallet Portfolio Aggregation

Users may link multiple wallets to a single Discord identity, allowing accurate representation of total holdings.

### Automated Role Assignment

Wallet balances are periodically fetched and aggregated. Discord roles (e.g. *Verified*, *Whale*, *Tiered Roles*) are assigned or revoked automatically based on configurable thresholds.

---

## Key Features

* **Multi-wallet identity linking**
  Aggregate balances across any number of wallets.

* **Automated Discord role synchronization**
  Roles update dynamically as balances change.

* **Self-healing role logic**
  Background jobs refresh balances and correct roles automatically.

* **Gasless & signature-free verification**
  No smart contracts, no approvals, no attack surface.

* **Anti-impersonation safeguards**
  A wallet can only be linked to one Discord account.

---

## Tech Stack

| Component           | Technology                             |
| ------------------- | -------------------------------------- |
| Backend             | Node.js, Express                       |
| Discord Integration | discord.js                             |
| Database            | PostgreSQL + Prisma ORM                |
| Scheduling          | node-cron                              |
| Hosting             | Docker / Railway                       |
| Data Sources        | EasyConnect Webhooks, Qubic Public RPC |

---

## Getting Started

### Prerequisites

* Node.js v18+
* PostgreSQL database
* Discord bot application

### Installation

```bash
git clone https://github.com/thanish312/QubicLink.git
cd QubicLink
git checkout v2_production
npm install
```

### Database Setup

```bash
cp .env.example .env
# Generate Prisma client before pushing the schema
npx prisma generate
npx prisma db push
```

---

## Configuration

```env
DISCORD_TOKEN=YOUR_BOT_TOKEN
CLIENT_ID=YOUR_APPLICATION_ID
GUILD_ID=YOUR_SERVER_ID

DATABASE_URL=postgresql://user:pass@host:port/dbname

VERIFIED_ROLE_ID=DISCORD_ROLE_ID
WHALE_ROLE_ID=DISCORD_ROLE_ID

PORT=3000
```

---

## Running the Service

```bash
node index.js
```

The bot will initialize slash commands and begin listening for verification events.

---

## Roadmap

* Admin web dashboard for role configuration
* Governance and voting integrations
* Server-agnostic global command support

---

## Deploy (Railway + Neon Postgres) & EasyConnect Setup

This guide explains how to deploy QubicLink using Railway with a PostgreSQL database (Railway or Neon) and connect EasyConnect alerts via webhooks.

### 1. Prepare the database

* Create a PostgreSQL database on **Railway** or **Neon**.
* Copy the full Postgres connection URL. This will be used as `DATABASE_URL`.

### 2. Fork and deploy on Railway

1. Fork this repository.
2. In Railway, create a **New Project → Deploy from GitHub** and select your fork.
3. Ensure the service is public and deployable.

### 3. Required shared environment variables

Create the following **Project Shared Variables** in Railway:

```
DISCORD_TOKEN      # Bot token from Discord Developer Portal
CLIENT_ID          # Discord application (client) ID
GUILD_ID           # Discord server ID (copy with Developer Mode enabled)
DATABASE_URL       # PostgreSQL connection URL
VERIFIED_ROLE_ID   # Role ID for Verified users
WHALE_ROLE_ID      # Role ID for Whale / tier role
PORT               # Set to 3000
```

### 4. Discord application setup

1. Create an application at [https://discord.com/developers/applications](https://discord.com/developers/applications).
2. Add a **Bot** and copy the **Bot Token**.
3. Enable **Server Members Intent** under Bot settings.
4. Invite the bot to your server with permissions to **Manage Roles**, **Read Messages**, and **Use Slash Commands**.
5. Enable **Developer Mode** in Discord and copy:

   * Server (Guild) ID
   * Role IDs for `VERIFIED_ROLE_ID` and `WHALE_ROLE_ID`
6. Ensure role hierarchy:

   * Bot role is higher than all managed roles
   * Whale role is higher than Verified role (if tiering is required)

### 5. Railway build and start commands

**Build command**

```bash
npm install
npx prisma generate
npx prisma db push
```

**Start command**

```bash
node index.js
```

### 6. Webhook public URL

After deployment, Railway provides a public URL such as:

```
https://<your-project>.up.railway.app
```

The webhook endpoint used by EasyConnect is:

```
https://<your-project>.up.railway.app/webhook/qubic
```

### 7. EasyConnect alert configuration (example)

* **Contract:** Qubic Qx Smart Contract
* **Method:** `AddToBidOrder`
* **Conditions:**

  * `NumberOfShares` > `30000`
  * `NumberOfShares` < `100000`
* **Notification Webhook:**

  ```
  https://<your-project>.up.railway.app/webhook/qubic
  ```

Refer to EasyConnect documentation for UI-specific configuration:
[https://easy-academy.super.site/](https://easy-academy.super.site/)

### 8. Running and testing

* Deploy the service and monitor Railway logs.
* Use `/link` in Discord to initiate wallet verification.
* If deployment fails, verify `DATABASE_URL` and restart the service.
* If roles do not update, check bot permissions and role hierarchy.

---

## Author

Developed by **Thanish B Urs**

GitHub: [https://github.com/thanish312](https://github.com/thanish312)

---

## License

MIT License

---

⭐ If this project is useful, consider starring the repository.

---
