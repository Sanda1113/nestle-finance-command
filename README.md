# Nestle Finance Command Center (AI-Powered Enterprise Financial Reconciliation Engine)

An automated, enterprise-grade **Procure-to-Pay (P2P) platform** that digitizes the entire supply chain lifecycle with **AI-powered 3-way matching**, real-time discrepancy detection, autonomous payout scheduling, and dynamic discounting for seamless stakeholder coordination.

## 🎯 System Overview

The platform serves **three key stakeholder portals**:
- **Supplier Dashboard** — Manage BOQs, track orders, submit invoices, negotiate early payouts (Dynamic Discounting), and view the payout calendar.
- **Finance Dashboard** — Review queue for invoice-PO matching, configure AI tolerance rules, and manage cash-flow via the interactive Treasury Calendar.
- **Warehouse Portal** — Log physical goods received (GRN), enabling true 3-way matching (Invoice = PO = Physical Goods).

---

## 🚀 Complete MVP Roadmap

### MVP 1: The "Pre-Match" BOQ Digitizer
* **Automated Quoting:** Suppliers upload BOQs/Quotes (PDF, Image, Excel, CSV).
* **AI & Native Parsing:** Uses **Mindee V5** for unstructured documents and native `xlsx` parsing for tabular data.
* **1-Click PO Generation:** Procurement teams review digitized quotes and generate official Purchase Orders with a single click.

### MVP 2: Automated Invoice Processing & 2-Way Match
* **Discrepancy Detection:** AI automatically extracts Invoice and PO data, compares totals, and flags discrepancies.
* **Finance Review Queue:** Finance teams view original BOQs, POs, and Invoices side-by-side to manually resolve flagged exceptions.
* **Dynamic PDF Generation:** Client-side generation of formal, print-ready PDF documents directly from JSON data.

### MVP 3: The GRN Vault (True 3-Way Match)
* **Warehouse GRN Portal:** Warehouse team logs physical goods received with barcode scanning, shortage detection, and photo evidence.
* **AI Matching Engine Upgrade:** Validates Invoice = PO = Physical Goods Received.

### MVP 4: Bidirectional Communication Hub
* **In-App Alerts & Notifications:** Real-time alerts to suppliers and independent live chat available in all three portals.
* **Document Resubmission Loop:** Suppliers can replace and resubmit corrected documents securely.

### MVP 5: Smart Tolerance & Autonomous Reconciliation ✨ NEW
* **AI Auto-Approval Engine:** If an invoice is off by a minor, acceptable threshold (e.g., a $0.05 rounding error on tax), the system auto-approves it instead of flagging it for manual review.
* **Rule Configurator:** Finance Admins can dynamically configure allowable tax and freight variance percentages/amounts.
* **Visual Badging:** Auto-approved items display a distinct AI badge in the Review Ledger to maintain audit transparency.

### MVP 6: Automated Payout Tracking & Disbursement ✨ NEW
* **The Treasury Calendar:** Once a 3-way match clears, the system reads the terms and automatically schedules the payout in a central, drag-and-drop calendar dashboard for Finance.
* **Mock Banking Integration:** Finance can physically "Hold" or "Disburse" funds via a Calendar Action Modal, simulating a real wire transfer.
* **Supplier Visibility:** Suppliers receive a step-by-step transaction timeline, a read-only calendar of their incoming payouts, and can download a formal PDF Remittance Advice once paid.

### MVP 7: Dynamic Discounting Engine & Sandbox ✨ NEW
* **Instant Liquidity Slider:** When an invoice is approved but not due for 30-60 days, suppliers can utilize a sliding scale to request early payment in exchange for a dynamic discount fee (e.g., "Get paid tomorrow for a 2% fee").
* **Zero-Touch Math:** The system auto-recalculates the net payout and instantly updates the Finance Treasury calendar if an offer is accepted.
* **Interactive Sandbox Tutorial:** A guided, risk-free training environment to teach suppliers how to use the Liquidity Slider and manage their cash flow without affecting real invoices.

---

## 🏗️ Architecture & Tech Stack

### Frontend Stack
* **React.js** — Component-based UI framework
* **Tailwind CSS v4** — Modern styling with Dark/Light mode
* **Axios** — API communication layer
* **React Big Calendar** — Interactive drag-and-drop Treasury scheduling
* **Recharts** — Financial data visualization
* **Vite** — Lightning-fast development and build tool

### Backend Stack
* **Node.js & Express.js** — Robust middleware API
* **Mindee SDK v5** — AI/OCR for unstructured document extraction
* **Socket.IO / Supabase Realtime** — WebSocket bidirectional communication
* **Supabase PostgreSQL** — Real-time database management with Row Level Security (RLS)
* **Resend** — Automated transactional email engine

---

## 📂 Project Structure

```text
├── backend/
│   ├── server.js                # Core Express API (Extraction, Matching, PDF Logic)
│   ├── db.js                    # Supabase connection singleton
│   ├── mailer.js                # Email notification service
│   ├── routes/
│   │   ├── sprint2.js           # Invoice processing, Payouts, & Reconciliation routes
│   ├── package.json             # Backend dependencies
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── SupplierDashboard.jsx    # Supplier Inbox, Liquidity Slider, Sandbox & Timeline
    │   │   ├── Portal.jsx               # Finance Queue, Tolerance Settings & Treasury Calendar
    │   │   ├── WarehousePortal.jsx      # GRN Vault — goods receipt & 3-way match
    │   │   ├── DigitalCalendar.jsx      # Drag-and-drop payout management component
    │   │   ├── DisputeChat.jsx          # Context-aware messaging hub
    │   │   └── Scanner.jsx              # Barcode/QR scanner for GRN
    │   ├── App.jsx                # Main entry point & state management
    │   └── index.css              # Tailwind v4 configuration
```
---
## 🎯 Key Features by Portal
### Supplier Dashboard
* ✅ Upload BOQs/Invoices (PDF, Image, Excel, CSV)
* ✅ Negotiate early payments via the Dynamic Discounting Slider
* ✅ Learn the system via the Interactive Sandbox Tutorial
* ✅ Track incoming funds on the read-only Payout Calendar
* ✅ Download formal PDF Remittance Advice receipts

### Finance Dashboard
* ✅ Review queue for manual exception handling
* ✅ Configure AI Tolerance Rules for automated approvals
* ✅ Manage cash flow via the drag-and-drop Treasury Calendar
* ✅ Simulate bank wire disbursements with 1-click execution
* ✅ Put suspicious payouts on strategic Hold

### Warehouse Portal
* ✅ Log physical goods received (GRN) via barcode scanning
* ✅ Track batch numbers and expiry dates
* ✅ Smart risk detection (shortage/overage)
* ✅ 1-Click "Clear Goods for Payout" trigger

---

## 🗄️ Database Schema
| Table | Purpose |
|---|---|
| `users` | Authentication & role management (Supplier / Finance / Warehouse) |
| `boqs` | Bill of Quantities & supplier quotes |
| `purchase_orders` | Generated POs and dispatch tracking |
| `invoices` | Supplier invoices for matching |
| `grns` | Goods Receipt Notes (warehouse received items) |
| `reconciliations` | 3-way match results & discrepancies |
| `messages` | Live chat messages between portals |
| `notifications` | Alert history for audit trail |
| `resubmissions` | Document resubmission tracking |
| `payout_schedules` | Tracks scheduled payout dates, final negotiated amounts, and mock bank references |
| `tolerance_rules` | Configuration for allowable AI variance thresholds (Tax, Freight, etc.) |
| `vendor_trust_profiles` | Tracks supplier accuracy scores to dictate AI approval leniency |
| `reconciliations` | 3-way match results & discrepancies |
| `notifications` | Alert history for audit trail |
| `resubmissions` | Document resubmission tracking |

---

## 🔐 Security & Authentication
* Role-Based Access Control (RLS & RBAC) — Strict separation between Supplier, Finance, and Warehouse data.
* Mathematical Immutability — Financial payloads cannot be edited post-submission; they must be formally renegotiated or resubmitted.
* Audit trail — Complete transaction and timestamp history for SOX compliance.

---

## 📊 Impact & ROI
### Financial Risk Mitigation
* Eliminates duplicate payments and catches delivery shortages before payment.
* Reduces manual reconciliation time by 85% via Smart Tolerance Auto-Approvals.
### Operational Efficiency & Treasury Yield
* Transforms AP from a cost-center to a revenue generator via Dynamic Discounting fees.
* Optimizes working capital by allowing Finance to visually balance the Treasury Calendar.

---

## 📝 License & Credits
Group 01B — Nestle Finance Command Center Development Team - Commercial Computing - APIIT- Stafforshire University London.
