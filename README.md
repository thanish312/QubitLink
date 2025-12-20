<div align="center">
  <img src="https://github.com/user-attachments/assets/5629a3ab-4b3d-433d-a6c0-88773d8bde1c" alt="QubicLink Logo" width="150"/>
  <h1>QubicLink V1 (Proof of Concept)</h1>
  <p><strong>The First No-Code Identity Bridge for the Qubic Ecosystem</strong></p>
  <p>
    <a href="https://lablab.ai/event/easyconnect-hackathon/winners">
      <img src="https://img.shields.io/badge/EasyConnect_Hackathon-1st_Place_Winner-blueviolet?style=for-the-badge&logo=trophy" alt="Hackathon Winner"/>
    </a>
  </p>
</div>

---

**Track:** EasyConnect Integrations | **Status:** 🏆 1st Place Winning Prototype

**QubicLink** is the first **No-Code Identity Bridge** for the Qubic ecosystem. It solves the "Identity Gap" between anonymous Qubic wallets and social communities like Discord, enabling projects to authenticate their users, gamify holding behaviors, and automate loyalty rewards without writing a single line of C++ code.

### 📺 Demo Video

See the winning prototype in action:

https://github.com/user-attachments/assets/72375c96-eb3e-4e4e-9cf2-5b0b94390d68

---

### 💡 The Problem: The Identity Gap

In the Qubic ecosystem, community management operates in the dark. A project founder sees a wallet with 1M tokens on-chain but has **no way to identify that person** in their Discord server. This prevents automated airdrops, VIP role assignments, and real-time community gamification.

### 🚀 The Solution: The "2-Factor Handshake"

QubicLink establishes a secure connection between a Web2 Identity (Discord) and a Web3 Asset (Qubic Wallet) using a novel **Limit Order Challenge** mechanism powered by EasyConnect. This process is completely cost-neutral for the user.

The system is composed of three "No-Code" agents:

1.  **The Clerk (Discord Bot):** Issues a unique, dynamic **Signal Code** (e.g., *Place a bid for 30,482 QUBIC*) to a user requesting verification.
2.  **The Bridge (EasyConnect):** A webhook that listens for an `AddToBidOrder` transaction on the Qubic Network matching the exact Signal Code.
3.  **The Judge (Make.com):** A logic engine that receives the signal from EasyConnect, verifies the source wallet matches the request, and triggers automated actions in Discord (e.g., assigning a "Verified" role, sending a "Whale Alert").

<div align="center">
  <img width="900" alt="QubicLink V1 Architecture Diagram" src="https://github.com/user-attachments/assets/24c7011e-f18d-4b83-b7d9-5c3510d3a43f" />
</div>

---

### ⚙️ No-Code Tech Stack

| Component             | Technology                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Logic Engine**      | [Make.com](https://www.make.com/) (for routing, verification, and automation)                                 |
| **Database**          | [Google Sheets](https://www.google.com/sheets/about/) (as a real-time request ledger)                         |
| **Interface**         | [Discord API](https://discord.com/developers/docs/intro) (via a simple bot)                                   |
| **Blockchain Listener** | [EasyConnect](https://easyconnect.pro/) (to monitor on-chain events)                                          |
| **Simulator**         | HTML/JavaScript (for hackathon demonstration)                                                                 |

---

### 🧪 How to Test This Proof of Concept

This project's logic was demonstrated using a simulator. You can test the end-to-end flow yourself.

#### Step 1: Join the Demo Server
*   First, join our demonstration **[Discord Server]([YOUR DISCORD INVITE LINK HERE])**.
*   Navigate to the `#verify` channel.

#### Step 2: Request a Signal Code
*   In the `#verify` channel, type the command:
    ```    !link YOUR_QUBIC_WALLET_ADDRESS
    ```
*   Our bot, "The Clerk," will DM you a unique **Signal Code** (e.g., 30,482) that you must use to prove ownership.

<div align="center">
  <img width="600" alt="Bot sending a Signal Code" src="https://github.com/user-attachments/assets/ebebbcc7-b7dd-4de8-8151-616f4d91492d" />
</div>

#### Step 3: Simulate the On-Chain Event
*   Open the `simulator.html` file provided in this repository.
*   **Enter the following:**
    *   `sourceId`: The wallet address you used in the `!link` command.
    *   `amount`: The **Signal Code** the bot gave you.
*   Click **Send Webhook**. This simulates the exact JSON payload that EasyConnect would send.

#### Step 4: Watch the Magic
*   Check the Discord channel. "The Judge" bot will post a public confirmation once your identity is verified and the role is assigned.

---

### ⚠️ Hackathon Context & Simulation

Due to age restrictions preventing Mainnet KYC verification and the lack of an active EasyConnect Testnet environment during the hackathon, all on-chain interactions were simulated. The **Logic Engine (Make.com), Database (Google Sheets), and Discord Bot integrations are fully functional** and accurately represent the production logic.

### 🌱 From Prototype to Production (V2)

The core logic of this award-winning prototype has been re-engineered into a production-grade application with a robust tech stack (Node.js, PostgreSQL, Multi-Wallet Support).

➡️ **You can find the active V2 codebase on the [`v2_production`](https://github.com/thanish312/QubicLink/tree/v2_production) branch.**
