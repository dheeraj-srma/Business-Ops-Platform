# 📦 Nalka Inventory Management System

> A modern enterprise inventory management and stock intelligence platform designed for real-time stock monitoring, inventory tracking, replenishment planning, audit management, and Tally/TallyPrime integration.

![Status](https://img.shields.io/badge/Status-Active-success)
![Inventory](https://img.shields.io/badge/Inventory-3681%2B%20SKUs-blue)
![Tally](https://img.shields.io/badge/Tally-TallyPrime-purple)
![License](https://img.shields.io/badge/License-Internal-orange)

---

## 🚀 Overview

The **Nalka Inventory Management System** is a centralized inventory and stock intelligence platform designed to help businesses manage large product catalogs, monitor stock levels, track inventory movements, detect shortages, plan replenishment, maintain a complete audit trail, and integrate inventory operations with **Tally/TallyPrime**.

The system is designed around a real-world industrial inventory environment and supports management of thousands of inventory items across multiple categories.

Instead of treating inventory as a static spreadsheet, the application provides a structured system for:

- 📊 Real-time inventory visibility
- 📦 Centralized product and stock management
- 🚨 Low stock and critical stock detection
- 🔴 Negative stock monitoring
- 🧮 Automated restock planning
- 💰 Replenishment cost estimation
- 📜 Complete inventory audit trails
- 🏷️ Category and stock group management
- 🔄 Tally/TallyPrime synchronization
- 📤 Inventory export for external systems
- ⚙️ Centralized system configuration
- 👥 Role-based access

---

# ✨ Features

## 📊 Executive Inventory Dashboard

The Executive Dashboard provides a centralized overview of the company's inventory health and operational status.

### Dashboard Metrics

The dashboard displays:

- Total Inventory Items
- Total Active SKUs
- Total Stock Volume
- Low Stock Alerts
- Critical Stock Alerts
- Out of Stock Items
- Negative Stock Items
- Inventory Health Distribution
- Stock Movement Activity
- Recent Inventory Alerts
- Restock Requirements

### Inventory Health Distribution

Every inventory item is automatically classified based on its current stock level.

| Status | Description |
|---|---|
| 🟢 Healthy | Stock level is above the configured minimum threshold |
| 🟡 Low Stock | Stock is approaching the minimum stock threshold |
| 🟠 Critical | Stock has reached or fallen below the critical threshold |
| 🔴 Out of Stock | Current inventory balance is zero |
| ⚠️ Negative Stock | Inventory balance has fallen below zero |

The dashboard visually represents the distribution of inventory health across the entire product catalog.

---

# 📦 Inventory Master

The Inventory Master acts as the central product and stock catalog of the application.

Each inventory item can contain:

- SKU / Product Code
- Product Name
- Product Description
- Product Category
- Unit of Measurement
- Current Stock
- Minimum Stock Threshold
- Critical Stock Threshold
- Unit Cost
- Inventory Valuation
- Stock Health Status
- Last Updated Timestamp

### Inventory Master Features

- 🔍 Search products by SKU
- 🔍 Search products by name
- 🏷️ Filter by category
- 📊 Filter by stock status
- ↕️ Sort inventory records
- ➕ Add new products
- ✏️ Edit existing products
- 📦 Monitor current stock
- 💰 Track unit costs
- 📈 View inventory valuation
- 🚨 Detect stock shortages
- 🔴 Identify negative inventory

### Available Stock Filters

- All Items
- Healthy
- Low Stock
- Critical
- Out of Stock
- Negative Stock

---

# 🔎 Advanced Product Search

The system provides centralized inventory search capabilities.

Products can be searched using:

- SKU
- Product Name
- Product Description
- Category
- Unit
- Inventory Status

This makes it easier to manage and navigate thousands of inventory records.

---

# 📈 Inventory Health Monitoring

The application continuously evaluates inventory levels against configured thresholds.

```text
Current Stock
      │
      ▼
Compare with Minimum Stock
      │
      ▼
Compare with Critical Stock
      │
      ▼
Assign Inventory Status
```

Example:

```text
Current Stock: 100 Units
Minimum Stock: 50 Units
Critical Stock: 20 Units

Status: HEALTHY
```

Another example:

```text
Current Stock: 15 Units
Minimum Stock: 50 Units
Critical Stock: 20 Units

Status: CRITICAL
```

---

# 🚨 Low Stock Alerts

The system automatically detects products that require replenishment.

Low stock alerts provide information such as:

- Product Name
- SKU
- Current Stock
- Minimum Stock
- Stock Status
- Quick Receive Action

Managers can quickly identify inventory items that require immediate attention.

---

# 🔴 Negative Stock Detection

Negative inventory is treated as a separate and important inventory condition.

Example:

```text
Current Stock: -42 NOS
Minimum Stock: 15 NOS

Status: NEGATIVE STOCK
```

Negative stock is not hidden from the system.

Instead, it is:

- Clearly highlighted
- Included in dashboard statistics
- Included in restock calculations
- Recorded in the audit ledger
- Available for investigation and reconciliation

This helps identify discrepancies between physical inventory, warehouse records, and accounting data.

---

# 🧮 Restock & Reorder Replenishment Planner

The Restock Planner is an intelligent replenishment module that identifies products requiring restocking and calculates recommended reorder quantities.

### Restock Planner Features

- Identify SKUs requiring replenishment
- Detect negative stock deficits
- Calculate recommended reorder quantities
- Calculate estimated purchase costs
- Filter by urgency
- Filter by category
- Search specific products
- Configure inventory buffer targets
- Select multiple products for bulk restocking
- Export replenishment data

---

## 🎯 Configurable Target Buffer

The system supports configurable stock buffer targets.

Available options can include:

- 1.5× Buffer
- 2× Buffer
- 2.5× Buffer
- 3× Buffer

Example:

```text
Minimum Stock: 100 Units

Selected Buffer: 2×

Target Stock:
100 × 2 = 200 Units

Current Stock:
50 Units

Recommended Reorder:
200 - 50 = 150 Units
```

For negative inventory:

```text
Current Stock: -50 Units
Target Stock: 100 Units

Recommended Reorder:

100 - (-50) = 150 Units
```

---

# 💰 Replenishment Cost Estimation

The system estimates the cost required to replenish inventory.

```text
Recommended Reorder Quantity
            ×
Unit Purchase Cost
            │
            ▼
Estimated Replenishment Cost
```

The Restock Planner can display:

- Unit Cost
- Current Stock
- Target Stock
- Recommended Reorder Quantity
- Estimated Product Cost
- Total Estimated Replenishment Cost

---

# 📜 Movement & Audit Ledger

Every important inventory movement is recorded in a centralized audit ledger.

The ledger provides a chronological and traceable history of stock changes.

### Supported Movement Types

- Initial Stock
- Stock In
- Stock Out
- Restock
- Adjustment Increase
- Adjustment Decrease
- Stock Correction
- Import Adjustment
- Tally Synchronization

Each transaction can contain:

- Date & Time
- Product
- SKU
- Movement Type
- Quantity Changed
- Previous Stock Balance
- New Stock Balance
- Reference Number
- Reason
- Related Party
- Warehouse or Location

Example:

```text
Date:
14 Aug 2026

Product:
18" SS Towel Rod

Movement:
Adjustment Decrease

Previous Balance:
0

Quantity:
-52

New Balance:
-52

Reference:
OB-NALKA-0020

Reason:
Initial opening balance reconciliation
```

---

# 🔐 Immutable Audit Trail

The system is designed around transaction-based inventory tracking.

Instead of silently modifying stock balances:

```text
Stock Transaction
       │
       ▼
Previous Balance
       │
       ▼
Quantity Change
       │
       ▼
New Balance
       │
       ▼
Audit Record
```

This provides:

- Better accountability
- Easier stock investigation
- Historical tracking
- Error identification
- Inventory reconciliation
- Improved operational transparency

---

# 🏷️ Stock Categories & Tally Groups

The system supports structured product categorization.

Categories can be used for:

- Product organization
- Inventory analysis
- Search and filtering
- Restock planning
- Reporting
- Tally synchronization
- Product group mapping

Example categories include:

- Sanitaryware
- Taps, Cocks & Mixers
- Showers & Shower Systems
- Sinks & Wash Basins
- Pipes & Pipe Fittings
- Valves
- Waste Fittings & Traps
- Water Tanks
- Channels & Drains

Each category can display:

- Total SKUs
- Total Stock Units
- Low Stock Items

---

# 🔄 Tally & TallyPrime Live Synchronization

One of the major features of the application is its Tally/TallyPrime integration architecture.

The synchronization engine is designed to connect the inventory application with the company's accounting and ERP environment.

### Synchronization Features

- Tally Server Connection
- Connection Health Monitoring
- Manual Synchronization
- Automated Background Synchronization
- Scheduled Polling
- Event-Based Synchronization
- Voucher Processing
- Stock Reservation Handling
- Product Mapping
- Voucher Rules
- Synchronization Event Logging
- Retry Handling
- Duplicate Protection
- Idempotency Protection

---

# ⚡ Event-Based Synchronization

The system supports an event-based architecture for inventory updates.

```text
Tally / TallyPrime
        │
        │
        │ Sales Order / Invoice / Voucher
        ▼
Tally Integration Layer
        │
        ▼
Synchronization Endpoint
        │
        ▼
Inventory Processing Engine
        │
        ├── Product Mapping
        ├── Voucher Validation
        ├── Duplicate Protection
        └── Stock Calculation
        │
        ▼
Inventory Database
        │
        ▼
Dashboard Updated
```

---

# 🌐 Webhook Synchronization

The application can expose a synchronization endpoint for receiving inventory-related events.

Example:

```text
POST /api/tally/sync/webhook
```

Supported payload formats may include:

- JSON
- XML

The synchronization layer can support:

- Webhook Secret Validation
- SHA-256 Verification
- Event Validation
- Duplicate Detection
- Idempotency Handling

---

# 🔁 Scheduled Background Synchronization

For environments where real-time event hooks are unavailable, the application can use scheduled polling.

Example:

```text
Every 15 Seconds
        │
        ▼
Check Tally
        │
        ▼
Fetch New Vouchers
        │
        ▼
Process Inventory Changes
        │
        ▼
Update Inventory
```

The synchronization interval can be configured through the system settings.

---

# 🔗 Product Mapping

The Product Mapping module connects inventory records with corresponding Tally stock items.

This helps handle differences caused by:

- Different Product Names
- Different SKU Formats
- Product Aliases
- Legacy Product Codes
- Duplicate Product Names

Example:

```text
Inventory Application SKU:

NAL-PIP-0001

        │
        ▼

Mapped Tally Stock Item:

1"x6" BRASS CHAAL NIPPLE - TARUN
```

---

# 🛡️ Idempotency Protection

The synchronization engine is designed to prevent duplicate processing.

If the same event or voucher is received multiple times:

```text
Incoming Event
      │
      ▼
Check Event ID
      │
      ├── Already Processed
      │       │
      │       └── Ignore Event
      │
      └── New Event
              │
              ▼
        Process Transaction
```

This prevents accidental duplicate stock additions or deductions.

---

# 📥 Initial Inventory Import

The application supports importing existing company inventory as an initial stock baseline.

The source data can originate from:

- Excel Files
- CSV Files
- Tally Stock Reports
- Existing Inventory Databases

Example field mapping:

| Source Data | Application Field |
|---|---|
| Particulars | Product Name |
| Quantity | Initial Stock |
| Rate | Unit Cost |
| Value | Inventory Valuation |

---

# 🔄 Inventory Import Pipeline

```text
Excel / Tally Report
        │
        ▼
Raw Import Staging
        │
        ▼
Data Validation
        │
        ├── Valid Products
        ├── Negative Stock
        ├── Missing Prices
        └── Mapping Issues
        │
        ▼
Import Preview
        │
        ▼
Manager Confirmation
        │
        ▼
Initial Stock Transactions
        │
        ▼
Inventory Baseline Established
```

---

# 📤 Tally Export

The application supports exporting inventory data for integration with external accounting systems.

Exported information can include:

- Product Name
- SKU
- Category
- Unit
- Current Stock
- Unit Cost
- Inventory Value

Supported export formats may include:

- XML
- JSON
- CSV

---

# 💲 Catalog & Price Master

The Catalog & Price Master provides centralized management of product configuration and pricing information.

Managers can manage:

- Product SKUs
- Product Descriptions
- Categories
- Units
- Unit Costs
- Minimum Stock Levels
- Critical Stock Levels

---

# 💰 Pricing Health Monitoring

The system identifies products with incomplete or invalid pricing information.

Possible issues include:

- Missing Price
- Zero Cost
- Invalid Unit Cost

Example:

```text
Pricing Health

525 Unpriced Products
30 Products with ₹0 Cost
```

This helps ensure inventory valuation and replenishment cost calculations remain accurate.

---

# ⚙️ Bulk Adjustment

The application supports bulk updates across multiple inventory products.

Bulk operations can include:

- Updating Unit Costs
- Updating Minimum Stock Levels
- Updating Critical Stock Levels
- Updating Product Configuration

This is particularly useful for managing large catalogs containing thousands of SKUs.

---

# 📥 CSV Import

CSV files can be used to import:

- New Products
- Product Updates
- Pricing Information
- Stock Threshold Configuration
- Inventory Data

---

# 📤 CSV Export

Inventory and operational data can be exported for:

- Excel Analysis
- Management Reporting
- Data Backup
- External Processing
- Data Migration

---

# 👥 Role-Based Access

The application supports different user access levels.

## 👨‍💼 Manager

Managers can access:

- Product Management
- Inventory Adjustment
- Stock Threshold Configuration
- Category Management
- Tally Integration
- Financial Inventory Data
- System Settings
- Database Maintenance

## 👷 Staff

Staff access can be limited to:

- Viewing Inventory
- Searching Products
- Recording Stock Movements
- Receiving Stock
- Basic Operational Tasks

Sensitive financial and system configuration controls can remain restricted to managers.

---

# ⚙️ System Settings

The application provides a centralized control panel for system configuration.

## Catalog & Price Master

Manage:

- Product Costs
- Stock Thresholds
- Critical Levels
- Catalog Configuration

## Company & Tally Configuration

Manage:

- Company Information
- Tally Server Address
- Port Configuration
- Target Company
- Synchronization Settings

## Theme & Appearance

Manage:

- Interface Appearance
- Visual Preferences
- Application Theme

## Database Maintenance

Manage:

- Database Operations
- Data Maintenance
- Backup
- Recovery
- System Cleanup

---

# 📊 Inventory Analytics

The system provides important inventory metrics including:

- Total Inventory Items
- Total Stock Volume
- Total Catalog Value
- Average Unit Cost
- Low Stock Items
- Critical Stock Items
- Out of Stock Items
- Negative Stock Items
- Total Units Required for Replenishment
- Estimated Replenishment Cost

---

# 🏭 Inventory Workflow

The application follows a structured inventory lifecycle.

```text
Product Master
      │
      ▼
Initial Inventory Import
      │
      ▼
Stock Movements
      │
      ├── Stock In
      ├── Stock Out
      ├── Adjustments
      ├── Restocking
      └── Tally Transactions
      │
      ▼
Inventory Health Analysis
      │
      ▼
Low Stock Detection
      │
      ▼
Restock Planning
      │
      ▼
Replenishment
      │
      ▼
Updated Inventory
```

---

# 🖥️ Application Modules

```text
📊 Dashboard
│
├── Inventory Overview
├── Inventory Health Distribution
├── Low Stock Alerts
└── Stock Movement Activity

📦 Inventory Master
│
├── Product Catalog
├── Current Stock
├── Search & Filters
├── Product Management
└── Inventory Status

🧮 Restock Planner
│
├── Reorder Recommendations
├── Buffer Planning
├── Negative Stock Deficit
├── Estimated Cost
└── Bulk Restock

📜 Audit Ledger
│
├── Stock Transactions
├── Adjustments
├── Initial Stock
└── Movement History

🏷️ Stock Categories
│
├── Product Groups
├── Category Statistics
└── Tally Group Mapping

🔄 Tally Live Sync
│
├── Connection Health
├── Sync Event Ledger
├── Stock Reservations
├── Product Mapping
├── Voucher Rules
└── Synchronization Logs

📤 Tally Export
│
├── XML Export
├── JSON Export
└── CSV Export

⚙️ Settings
│
├── Catalog & Pricing
├── Company Configuration
├── Tally Configuration
├── Appearance
└── Database Maintenance
```

---

# 🛠️ Technology Architecture

The project follows a modern full-stack architecture.

## Frontend

The frontend provides:

- Responsive User Interface
- Interactive Dashboard
- Data Tables
- Advanced Filtering
- Search
- Inventory Visualization
- Role-Based Interface Controls

## Backend

The backend handles:

- Inventory Management
- Stock Transactions
- Replenishment Calculations
- Audit Logging
- Import Processing
- Export Processing
- Tally Synchronization
- Authentication
- Authorization

## Database

The database can store:

```text
Products
Categories
Inventory Balances
Stock Transactions
Audit Records
Restock Plans
Tally Product Mappings
Synchronization Events
Voucher Processing Records
System Settings
Users
Roles
Permissions
```

---

# 📂 Suggested Project Structure

```text
inventory-management-system/
│
├── frontend/
│   ├── dashboard/
│   ├── inventory/
│   ├── restock/
│   ├── audit/
│   ├── categories/
│   ├── tally/
│   └── settings/
│
├── backend/
│   ├── api/
│   ├── inventory/
│   ├── transactions/
│   ├── restock/
│   ├── tally/
│   ├── imports/
│   └── exports/
│
├── database/
│   ├── schema/
│   ├── migrations/
│   └── seeds/
│
├── docs/
│   └── screenshots/
│
└── README.md
```

---

# 🔐 Inventory Integrity Principles

The system follows several important inventory management principles.

### 1. Transaction-Based Inventory

Stock changes should originate from transactions instead of directly modifying balances without history.

### 2. Auditability

Every important inventory movement should be traceable.

### 3. Negative Stock Visibility

Negative inventory should never be silently hidden.

### 4. Idempotent Synchronization

Duplicate synchronization events should not create duplicate stock movements.

### 5. Import Validation

External inventory data should be validated before modifying production records.

### 6. Product Mapping

External accounting products should be correctly mapped before synchronization.

---

# 📸 Screenshots

Application screenshots can be stored inside:

```text
docs/screenshots/
```

Example structure:

```text
docs/
└── screenshots/
    ├── dashboard.png
    ├── inventory-master.png
    ├── restock-planner.png
    ├── audit-ledger.png
    ├── stock-categories.png
    ├── tally-live-sync.png
    └── settings.png
```

Screenshots can then be displayed inside this README.

## Executive Dashboard

![Executive Dashboard](docs/screenshots/dashboard.png)

## Inventory Master

![Inventory Master](docs/screenshots/inventory-master.png)

## Restock Planner

![Restock Planner](docs/screenshots/restock-planner.png)

## Movement & Audit Ledger

![Audit Ledger](docs/screenshots/audit-ledger.png)

## Stock Categories

![Stock Categories](docs/screenshots/stock-categories.png)

## Tally Live Synchronization

![Tally Live Sync](docs/screenshots/tally-live-sync.png)

## System Settings

![Settings](docs/screenshots/settings.png)

---

# 🗺️ Future Roadmap

Potential future improvements include:

- 📱 Mobile Inventory Application
- 📷 Barcode Scanning
- 🔳 QR Code Scanning
- 🔔 Real-Time Notifications
- 📱 WhatsApp Low Stock Alerts
- 📧 Automated Email Notifications
- 🤖 AI-Based Demand Forecasting
- 📈 Sales Trend Prediction
- 🧠 Smart Reorder Recommendations
- 🏭 Multi-Warehouse Support
- 🚚 Supplier Management
- 📑 Purchase Order Generation
- 🔢 Batch Tracking
- 🔐 Serial Number Tracking
- 📅 Product Expiry Tracking
- 🗺️ Warehouse Location Tracking
- 📊 Advanced Business Intelligence Dashboard
- 🔄 Full ERP Integration

---

# 🎯 Project Goal

The goal of the **Nalka Inventory Management System** is to provide a centralized inventory intelligence platform that connects operational stock management with accounting and ERP systems.

The system combines:

```text
Real-Time Stock Visibility
        +
Inventory Health Monitoring
        +
Automated Restock Planning
        +
Complete Audit Trail
        +
Tally / TallyPrime Integration
        =
Intelligent Inventory Management
```

The objective is to move inventory management beyond static spreadsheets and provide a scalable, structured, and intelligent platform for managing thousands of products.

---

# 👨‍💻 Author

**Dheeraj**

Built as an industrial inventory management and stock intelligence solution.

---

# 📄 License

This project is currently intended for internal and organizational use.

All rights reserved.
