**Track:** EasyConnect Integrations | **Status:** Live Demo & Proof of Concept

QubicLink is the first **No-Code Identity Bridge** for the Qubic ecosystem. It solves the "Identity Gap" between anonymous Qubic wallets and social communities like Discord, enabling projects to authenticate their users, gamify holding behaviors, and automate loyalty rewards without writing a single line of C++ code.

[**▶️ Watch the 2-Minute Demo Video**]([YOUR VIDEO LINK HERE])

---

### 💡 The Problem
In the Qubic ecosystem, community management operates in the dark. A project founder sees a wallet with 1M tokens on-chain but has no way to identify that person in their Discord server. This prevents automated airdrops, VIP role assignments, and real-time community gamification.

### 🚀 The Solution
QubicLink establishes a secure **"2-Factor Handshake"** between a Web2 Identity (Discord) and a Web3 Asset (Qubic Wallet) using a **Limit Order Challenge** mechanism powered by EasyConnect.

1.  **The Clerk:** A Discord Bot issues a unique, dynamic **Signal Code** (e.g., *Bid 30,482 QUBIC*) to a user.
2.  **The Bridge:** EasyConnect listens for this specific signal on the Qubic Network.
3.  **The Judge:** A Make.com scenario verifies the on-chain signal, links the identity, and automates community alerts.

<img width="1584" height="684" alt="image" src="https://github.com/user-attachments/assets/24c7011e-f18d-4b83-b7d9-5c3510d3a43f" />

<img width="914" height="295" alt="image" src="https://github.com/user-attachments/assets/ebebbcc7-b7dd-4de8-8151-616f4d91492d" />


### ⚠️ Hackathon Note
Due to age restrictions preventing Mainnet KYC and the lack of an active EasyConnect Testnet, all on-chain events in our demo are simulated. The Logic Engine, Database, and Discord Integrations are **fully functional** and production-ready.

---

### 🛠️ How to Use This Proof of Concept

This project is built with No-Code tools, but the logic can be tested and verified using our provided simulator.

#### Step 1: Join the Community
*   First, join our demonstration **[Discord Server]([YOUR DISCORD INVITE LINK HERE])**.
*   Navigate to the `#verify` channel.

#### Step 2: Request Verification
*   In the `#verify` channel, type the command:
    ```
    !link YOUR_QUBIC_WALLET_ADDRESS
    ```
*   Our bot, "The Clerk," will reply with a unique **Signal Code** (e.g., 30,482) that you must use to prove ownership(keep in mind that this is checked every 15 minutes and may take some time but once recieved a dm will pop up stating the request has been recieved along with the Signal Code).

#### Step 3: Simulate the On-Chain Event
*   Open the `simulator.html` file provided in this repository.
*   In the dropdown select Verification Transaction Alert.
*   **Enter the following:**
    *   `sourceId`: The wallet address you used in the `!link` command.
    *   `numberOfShares`: The **Signal Code** the bot gave you.
*   Click **Send Webhook**. This simulates the exact JSON payload that EasyConnect would send after a real on-chain transaction.

#### Step 4: Watch the Magic
*   Check the Discord channel. "The Judge" bot will post a confirmation message once your identity is verified.
*   To test the "Whale Alert," use the simulator again with the same `sourceId` and a `numberOfShares` value greater than 1,000.

---

### ⚙️ Tech Stack
*   **Blockchain Integration:** EasyConnect
*   **Logic Engine:** Make.com
*   **Database:** Google Sheets
*   **Interface:** Discord API
*   **Simulator:** HTML/JavaScript

---


