# ✨ SentinelBot - Community Star Honor System

A Discord bot built in **Node.js (v24)** and **discord.js (v14)** with **Interactive Buttons UI**, **Community Stars (⭐)**, **Tier Badges**, and **Automated Monthly Role Rewards**.

---

## 🌟 Features & Highlights

* **⭐ Community Stars (Recognition Economy)**:
  * `/thank [member] [reason]` — Give **+1 ⭐ Star** with glowing endorsement cards.
  * `/stars [member]` — Rich profile with **Star Tier Badge** and **Progress Bar** to the next rank.
  * `/leaderboard` — **Interactive Buttons UI** with instant tab switching (**[ 📅 Monthly Stars ]** / **[ 👑 All-Time Stars ]**), pagination (**◀ / ▶**), and live refresh (**🔄**).
* **🏅 Star Tier System**:
  * 🌱 **Newcomer**: 0 ⭐
  * 🥉 **Bronze Helper**: 1–5 ⭐
  * 🥈 **Silver Contributor**: 6–15 ⭐
  * 🥇 **Gold Guardian**: 16–30 ⭐
  * 💎 **Diamond MVP**: 31–50 ⭐
  * 👑 **Community Legend**: 51+ ⭐
* **🏆 Automated Monthly Role Rewards**:
  * Calculates top Star earners at the end of each month.
  * Awards the Star Champion role (e.g. `@Star Champion`) for a custom duration (e.g., 30 days).
  * Automatically revokes the role upon expiration via an hourly background scheduler.
* **⚡ Admin Testing & Force Commands**:
  * `/star-config set/view` — Configure reward role, duration, winners count, and channel.
  * `/add-stars` / `/remove-stars` — Admin adjustments.
  * `/force-cycle` — Immediately distribute monthly rewards and trigger celebrations.
  * `/force-expire-roles` — Instantly scan and revoke expired roles.
  * `/force-reset` — Reset monthly stars for a fresh cycle.

---

## 📜 All Available Slash Commands

| Command | Category | Description |
| :--- | :--- | :--- |
| `/thank [member] [reason]` | Member | Award +1 ⭐ Star to someone who helped you. |
| `/stars [member]` | Member | View Star Profile, tier progress bar, rank, and recent praise notes. |
| `/leaderboard` | Member | **Interactive UI Leaderboard** with live Monthly / All-Time tab buttons. |
| `/help` | Member | View command guide and Star Tier rank charts. |
| `/ping` | Member | Bot latency & API roundtrip speed. |
| `/star-config set` | Admin | Set reward role, duration in days, top winners count, and channel. |
| `/star-config view` | Admin | View current server Star settings. |
| `/add-stars [member] [stars]` | Admin | Grant bonus ⭐ Stars to a member. |
| `/remove-stars [member] [stars]` | Admin | Deduct ⭐ Stars from a member. |
| `/force-cycle` | Admin | **Run monthly champion calculation right now!** |
| `/force-expire-roles` | Admin | **Instantly scan and remove expired roles!** |
| `/force-reset` | Admin | Reset monthly stars to 0 (Lifetime stars preserved). |

---

## 🚀 Running in VS Code
Open the project folder in VS Code:
```powershell
code "C:\Users\MrRit\.gemini\antigravity\scratch\discord_bot_node"
```
Press **`F5`** anytime to launch the bot with one-click debugging.
