# Service Management CRM — React Native Mobile App

This is the mobile application for the Service Management CRM system built using **React Native (Expo)**.

---

## 🚀 How to Run on Your Mobile Phone

### Step 1: Install Expo Go App
- **Android**: Install [Expo Go from Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)
- **iOS / iPhone**: Install [Expo Go from App Store](https://apps.apple.com/app/expo-go/id982107779)

---

### Step 2: Ensure Backend Server is Running
Make sure your Node.js backend server is running in the main project folder:
```bash
# In the project root (Service Management/)
node server/index.js
```
*(Server runs on port 5001 by default)*

---

### Step 3: Start the Expo Development Server
Open a terminal inside the `mobile/` directory and run:
```bash
cd mobile
npm start
```
Or:
```bash
npx expo start
```

---

### Step 4: Connect Your Phone
1. Connect your phone to the **same Wi-Fi network** as your computer.
2. Open the **Expo Go** app on your phone.
3. Scan the QR code shown in your terminal.
4. On the login screen, if connecting via Wi-Fi, tap **"Server: ..."** at the bottom and enter your PC's IP address (e.g. `http://192.168.1.100:5001/api`).

---

## 📱 Included Screens & Features

| # | Screen | Description |
|---|---|---|
| 1 | **Login & Auth** | JWT Authentication with remember me and live API Server IP configuration |
| 2 | **Dashboard** | Revenue insights, 6 live stat cards, lead sources breakdown, recent prospects |
| 3 | **Customers** | Client account directory, services, contact shortcuts (Call, WhatsApp, Email), Add/Edit modal |
| 4 | **Customer Details** | Complete profile with installations, renewals, CCTV/GPS inventory tabs |
| 5 | **Leads Pipeline** | Prospect tracking (New, Contacted, Demo Given, Quotation Sent, Won, Lost) + quick call/WhatsApp |
| 6 | **Tasks** | Department boards, priority badges, toggle complete checkboxes, due dates |
| 7 | **Team Chat** | WhatsApp-style messaging: direct & team groups, online presence, live 2.5s polling |
| 8 | **Chat Media** | Inline image display, lightbox viewer, PDF/Word/PPT/Excel cards with direct device download |
| 9 | **Chat 10-Min Delete**| 10-minute message deletion window for both senders and Super Admin |
| 10 | **Renewals** | Expiring contracts, days left calculation, pre-filled WhatsApp reminder messages |
| 11 | **Quotations** | Proposal estimates with item breakdowns, total values, and status tracking |
| 12 | **Accounts & Billing**| Revenue collection cards, invoices list, GST auto-calculation, payment status |
| 13 | **Inventory & Stock** | Hardware SKUs, barcodes, low stock warning alerts, unit prices |
| 14 | **Installations** | Field job tracking for GPS (IMEI/vehicle), CCTV (cams/site), and Web deployments |
| 15 | **Staff & Employees** | Team directory with departments, salary figures, and designations |
| 16 | **Schedule & Calendar**| Combined daily feed of installations, task due dates, renewals, and follow-ups |
| 17 | **User Management** | Super Admin user role management and access control |
| 18 | **Profile & Settings** | Dark / Light theme toggle, password change, server URL test |

---

## 📦 Creating an Android APK Later
When ready to build a standalone `.apk` file:
```bash
npm install -g eas-cli
eas login
eas build --platform android --profile preview
```
