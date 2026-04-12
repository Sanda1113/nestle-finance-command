# Nestle Finance Command Center (AI-Powered Enterprise Financial Reconciliation Engine)

An automated, enterprise-grade **Procure-to-Pay (P2P) platform** that digitizes the entire supply chain lifecycle with **AI-powered 3-way matching**, real-time discrepancy detection, and a **Bidirectional Communication Hub** for seamless stakeholder coordination.

## 🎯 System Overview

The platform serves **three key stakeholder portals**:
- **Supplier Dashboard** — Manage BOQs, track orders, access POs, submit invoices, and resubmit rejected documents
- **Finance Dashboard** — Review queue for invoice-PO matching, approve/reject with alerts to suppliers
- **Warehouse Portal** — Log physical goods received (GRN), enabling true 3-way matching (Invoice = PO = Physical Goods)

---

## 🚀 Complete MVP Roadmap

### MVP 1: The "Pre-Match" BOQ Digitizer
* **Automated Quoting:** Suppliers upload BOQs/Quotes (PDF, Image, Excel, CSV).
* **AI & Native Parsing:** Uses **Mindee V5** for unstructured documents and native `xlsx` parsing for tabular data.
* **1-Click PO Generation:** Procurement teams review digitized quotes and generate official Purchase Orders with a single click, instantly dispatching them to the supplier.

### MVP 2: Automated Invoice Processing & 2-Way Match
* **Discrepancy Detection:** AI automatically extracts Invoice and PO data, compares totals, and flags discrepancies.
* **Finance Review Queue:** Finance teams use an advanced dashboard to view original BOQs, POs, and Invoices side-by-side to manually resolve flagged exceptions.
* **Dynamic PDF Generation:** Client-side generation of formal, print-ready PDF documents with the official Nestlé letterhead directly from JSON data—no external PDF microservices required.

### MVP 3: The GRN Vault (True 3-Way Match) ✨ NEW
* **Warehouse GRN Portal:** Warehouse team logs physical goods received with barcode scanning.
* **Advanced GRN Features:**
  - Barcode/QR code scanning for automated item detection
  - Batch number and expiry date tracking
  - Shortage/overage detection with risk levels
  - Offline-first design with automatic sync when online
  - Photo evidence capture for discrepancies
* **AI Matching Engine Upgrade:** Validates Invoice = PO = Physical Goods Received.
  - Detects delivery shortages and overages
  - Calculates risk levels based on supplier trust scores and discrepancy severity
  - Locks completed shipments to prevent tampering
  - Real-time financial impact calculation
* **Stakeholder Impact:**
  - **Finance Team:** Eliminates risk of paying for undelivered items
  - **Warehouse Team:** Streamlined receiving process with smart guidance

### MVP 4: Bidirectional Communication Hub ✨ NEW
* **In-App Alerts & Notifications:**
  - Real-time alerts to suppliers (Invoice Approved, Discrepancy Found, etc.)
  - Alert system prevents spam with intelligent deduplication
  - Financial impact notifications for critical discrepancies
* **Independent Chat Icon:**
  - Live chat available in all three portals (Supplier, Finance, Warehouse)
  - Smart recipient selection: Users choose who receives their message
  - Bidirectional messaging between all portal combinations
* **Document Resubmission Loop:**
  - Suppliers can delete rejected BOQs/Invoices instantly
  - Replace and resubmit corrected documents
  - Automatic status tracking and history
  - Finance team reviews resubmitted documents in priority queue
* **Real-Time Message Delivery:**
  - WebSocket-based live messaging
  - Message routing to correct portal
  - Conversation history and audit trail

---

## 🏗️ Architecture & Tech Stack

### Frontend Stack
* **React.js** — Component-based UI framework
* **Tailwind CSS v4** — Modern styling with Dark/Light mode
* **Axios** — API communication layer
* **React Router** — Multi-portal navigation
* **Vite** — Lightning-fast development and build tool
* **Vercel** — Production hosting

### Backend Stack
* **Node.js & Express.js** — Robust middleware API
* **Mindee SDK v5** — AI/OCR for unstructured document extraction
* **XLSX Library** — Native Excel/CSV parsing
* **Socket.IO / WebSocket** — Real-time bidirectional communication
* **JWT & Bcrypt** — Secure authentication & encryption
* **Supabase PostgreSQL** — Real-time database management
* **Railway.app** — Production backend hosting

---

## 📂 Project Structure

```text
├── backend/
│   ├── server.js               # Core Express API (Extraction, Matching, PDF Logic)
│   ├── db.js                   # Supabase connection singleton
│   ├── mailer.js               # Email notification service
│   ├── routes/
│   │   ├── auth.js             # JWT Login & Registration endpoints
│   │   ├── notifications.js    # In-app alert & notification routes
│   │   └── sprint2.js          # Invoice processing & reconciliation routes
│   ├── package.json            # Backend dependencies (Mindee, Supabase, xlsx, bcrypt)
│   └── .env                    # Environment variables (API Keys, DB URLs)
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── Login.jsx                # Secure Gateway & RBAC
    │   │   ├── SupplierDashboard.jsx    # Supplier Inbox, Uploads, & Timeline
    │   │   ├── Portal.jsx               # Finance Queue, Procurement & Analytics
    │   │   ├── WarehousePortal.jsx      # GRN Vault — goods receipt & 3-way match
    │   │   ├── FloatingChat.jsx         # Independent live chat icon (all portals)
    │   │   ├── LiveChat.jsx             # Chat window with recipient selection
    │   │   ├── DisputeChat.jsx          # Dispute resolution messaging
    │   │   ├── NotificationBell.jsx     # In-app notification center
    │   │   ├── AppNotifier.jsx          # Toast alert system
    │   │   ├── Scanner.jsx              # Barcode/QR scanner for GRN
    │   │   └── Upload.jsx               # Document upload component
    │   ├── App.jsx               # Main entry point & state management
    │   └── index.css             # Tailwind v4 configuration
    └── package.json            # Frontend dependencies (React, Vite, Axios)
```

---

## 🎯 Key Features by Portal

### Supplier Dashboard
✅ Upload BOQs/Invoices (PDF, Image, Excel, CSV)
✅ View generated POs and download documents
✅ Real-time invoice status tracking
✅ Resubmit rejected documents instantly
✅ Live chat with Finance/Warehouse teams
✅ Receive in-app alerts & notifications
✅ Complete lifecycle audit trail

### Finance Dashboard
✅ Review queue for invoice-PO matching
✅ View original BOQs, POs, and Invoices side-by-side
✅ Approve/Reject invoices with explanations
✅ Send real-time alerts to suppliers
✅ Live chat with suppliers & warehouse
✅ Risk-based prioritization (high discrepancies first)
✅ Dashboard with discrepancy analytics

### Warehouse Portal
✅ Log physical goods received (GRN) via barcode scanning
✅ Track batch numbers and expiry dates
✅ Capture photo evidence for discrepancies
✅ Offline-first design with automatic sync
✅ Smart risk detection (shortage/overage)
✅ Real-time communication with Finance team
✅ Blind mode for unbiased receiving

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

---

## 🔐 Security & Authentication

* **JWT Token-based** authentication for stateless API
* **Role-Based Access Control (RBAC)** — Supplier vs Finance vs Warehouse
* **Bcrypt password hashing** — Secure credential storage
* **CORS & HTTPS** — Production-grade security
* **Audit trail** — Complete transaction history
* **Document version tracking** — Resubmission history

---

## 🔄 Real-Time Features

* **1-second background polling** — Automatic UI sync without flickering
* **WebSocket messaging** — Live chat across all portals
* **Offline sync queue** — GRN data persists during connectivity loss
* **Auto-reconnection** — Seamless recovery from network failures

---

## 🚀 Deployment

### Frontend
Deploy to **Vercel** by connecting the `frontend/` directory. Set the required environment variables in the Vercel project settings.

### Backend
Deploy to **Railway.app** by connecting the `backend/` directory. A `Dockerfile` and `railway.json` are included for containerized deployment.

### Environment Variables Required

```env
# Backend
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_key
JWT_SECRET=your_jwt_secret
MINDEE_API_KEY=your_mindee_api_key

# Frontend
VITE_API_URL=your_backend_railway_url
```

---

## 📊 Impact & ROI

### Financial Risk Mitigation
- ✅ Eliminates duplicate payments
- ✅ Catches delivery shortages before payment
- ✅ Reduces manual reconciliation time by 85%

### Operational Efficiency
- ✅ 3-click PO generation (vs. days of manual work)
- ✅ Barcode scanning for instant GRN logging
- ✅ Real-time discrepancy alerts

### Stakeholder Benefits
- **Finance:** Pay only for goods actually received
- **Suppliers:** Instant feedback and resubmission capability
- **Warehouse:** Streamlined receiving with smart guidance

---

## 📝 License & Credits

**Group 01B** — Nestle Finance Command Center Development Team - Commercial Computing

---

## 🤝 Contributing

For issues, feature requests, or contributions, please contact the development team.
