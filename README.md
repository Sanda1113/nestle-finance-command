# Nestle Finance Command Center (AI-Powered P2P Platform)

An automated, enterprise-grade Procure-to-Pay (P2P) platform that digitizes the entire supply chain lifecycle. From processing initial Bills of Quantities (BOQs) to AI-powered 3-way matching between Vendor Invoices and Purchase Orders (POs), this system eliminates manual data entry and provides real-time financial oversight.

## 🚀 Sprint 1 MVPs & Key Features

### 1. The "Pre-Match" BOQ Digitizer (MVP 1)
* **Automated Quoting:** Suppliers upload BOQs or Quotes (PDF, Image, Excel, CSV).
* **AI & Native Parsing:** Uses **Mindee V5** for unstructured documents and native `xlsx` parsing for tabular data.
* **1-Click PO Generation:** Procurement teams review digitized quotes and generate official Purchase Orders with a single click, instantly dispatching them to the supplier.

### 2. Automated Invoice Processing & 3-Way Match (MVP 2)
* **Discrepancy Detection:** AI automatically extracts Invoice and PO data, compares totals, and flags discrepancies.
* **3-Way Review Queue:** Finance teams use an advanced dashboard to view original BOQs, POs, and Invoices side-by-side to manually resolve flagged exceptions.

### 3. Dynamic PDF Generation & PO Inbox
* **Supplier Inbox:** A dedicated portal for suppliers to receive, track, and download approved POs.
* **Client-Side Rendering:** The system generates formal, print-ready PDF documents featuring the official Nestlé Letterhead directly from JSON data—no external PDF microservices required.

### 4. Unified Lifecycle Timeline & Live Polling
* **Audit Trail:** Aggregates data across `boqs`, `purchase_orders`, and `reconciliations` databases into a single chronological timeline for the supplier.
* **Real-Time UI:** Implements 1-second silent background polling to keep dashboards instantly synced without screen flickering.

### 5. Enterprise Security & Role-Based Access Control (RBAC)
* **Secure Gateway:** Built-in JWT authentication and `bcrypt` password hashing.
* **Dynamic Routing:** Automatically routes users to their specific environments (Supplier Dashboard vs. Finance/Procurement Portals).

## 🛠️ Tech Stack

### Frontend
* **React.js**: Modern component-based UI.
* **Tailwind CSS v4**: High-performance "CSS-first" styling engine with native Dark/Light mode.
* **Axios**: Asynchronous API communication.
* **Vercel**: Production frontend hosting.

### Backend
* **Node.js & Express**: Robust middleware API.
* **Mindee SDK**: Advanced AI/OCR extraction engine for unstructured data.
* **XLSX**: Native Excel/CSV parsing engine for rapid tabular data extraction.
* **JSON Web Tokens (JWT) & Bcrypt**: Secure authentication architecture.
* **Supabase SDK**: Real-time PostgreSQL database management.
* **Railway**: Production backend hosting.

## 📂 Project Structure

```text
├── backend/
│   ├── server.js               # Core Express API (Extraction, Polling, PDF Logic)
│   ├── db.js                   # Supabase connection singleton
│   ├── routes/
│   │   └── auth.js             # JWT Login & Registration endpoints
│   ├── package.json            # Backend dependencies (Mindee, Supabase, xlsx, bcrypt)
│   └── .env                    # Environment variables (API Keys, DB URLs)
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── Login.jsx             # Secure Gateway & RBAC
    │   │   ├── SupplierDashboard.jsx # Supplier Inbox, Uploads, & Timeline
    │   │   └── Portal.jsx            # Procurement, Finance Queue, & Analytics
    │   ├── App.jsx               # Main entry point & state management
    │   └── index.css             # Tailwind v4 configuration
    └── package.json            # Frontend dependencies
