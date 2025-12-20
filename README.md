<div align="center">

<img src="https://github.com/user-attachments/assets/5629a3ab-4b3d-433d-a6c0-88773d8bde1c" alt="QubicLink Logo" />

<h1>QubicLink V1</h1>

<p><strong>The First No-Code Identity Bridge for the Qubic Ecosystem</strong></p>

<p>
  <a href="https://lablab.ai/event/easyconnect-hackathon/winners">
    <img src="https://img.shields.io/badge/EasyConnect%20Hackathon-1st%20Place%20Winner-blueviolet?style=for-the-badge&logo=trophy" alt="Hackathon Winner" />
  </a>
</p>

<p><em>Proof of Concept · Award-Winning Prototype</em></p>

</div>

---

**Track:** EasyConnect Integrations  
**Status:** 🏆 1st Place Winning Prototype  

**QubicLink** is the first **No-Code Identity Bridge** for the Qubic ecosystem.  
It closes the *identity gap* between anonymous Qubic wallets and social platforms like Discord—enabling authentication, gamification, and automated rewards **without writing C++**.

---

## 📺 Demo Video

**Winning prototype walkthrough:**

https://github.com/user-attachments/assets/72375c96-eb3e-4e4e-9cf2-5b0b94390d68

---

## 💡 The Problem — The Identity Gap

In the Qubic ecosystem, community management operates blind.

A project founder can see a wallet holding **1M tokens on-chain** but has **no way to identify that wallet owner** inside Discord.  
This blocks:

- Automated airdrops  
- Role-based access  
- Whale alerts  
- Loyalty rewards  

---

## 🚀 The Solution — The 2-Factor Handshake

QubicLink securely binds a **Web2 identity (Discord)** to a **Web3 asset (Qubic wallet)** using a **Limit Order Challenge**, powered by EasyConnect.

- Cost-neutral  
- Non-custodial  
- No smart contracts  
- No custom backend  

### No-Code Architecture

1. **The Clerk (Discord Bot)**  
   Issues a unique **Signal Code**  
   *(e.g., “Place a bid for 30,482 QUBIC”)*

2. **The Bridge (EasyConnect)**  
   Listens for an `AddToBidOrder` transaction matching the Signal Code

3. **The Judge (Make.com)**  
   Verifies wallet ↔ request pairing and triggers Discord automation

<div align="center">
  <img src="https://github.com/user-attachments/assets/24c7011e-f18d-4b83-b7d9-5c3510d3a43f" alt="QubicLink V1 Architecture Diagram" width="900" />
</div>

---

## ⚙️ No-Code Tech Stack

| Layer | Technology |
|-----|-----------|
| Logic Engine | Make.com |
| Database | Google Sheets |
| Interface | Discord Bot (Discord API) |
| Blockchain Listener | EasyConnect |
| Simulator | HTML + JavaScript |

---

## 🧪 How to Test the Proof of Concept

This demo uses a simulator to represent on-chain events.

### Step 1 — Join the Demo Server

- Join the **[Discord Server]DEPRECATED**
- Navigate to `#verify`

### Step 2 — Request a Signal Code

Run the command:

```text
!link YOUR_QUBIC_WALLET_ADDRESS
