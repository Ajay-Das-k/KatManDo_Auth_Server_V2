# Salesforce Data Loader via Google Apps Script & AWS Node.js Server
![App Flow](https://cdni.iconscout.com/illustration/premium/thumb/cat-sitting-at-desk-illustration-download-in-svg-png-gif-file-formats--on-laptop-developer-licking-paw-miscellaneous-pack-people-illustrations-4395247.png)


This project bridges Google Sheets and Salesforce using a Google Apps Script data loader, with an external Node.js server hosted on AWS. It solves the OAuth2 redirect URL limitations caused by Google Apps Script's changing script IDs when duplicating sheets.

## 🧠 Project Overview

The Google Apps Script interacts with Salesforce APIs using OAuth2 authentication. Due to limitations with the dynamic script ID in Google Sheets (which breaks callback URLs), this project offloads OAuth handling to a centralized AWS-hosted Node.js server with a static domain: **https://catmando.xyz**.

## 🔧 Tech Stack

- **Node.js & Express** – Web server & REST API backend
- **MongoDB** – Token & user session persistence
- **Salesforce** – CRM system integration using SOQL and REST APIs
- **Google Apps Script** – Frontend in Google Sheets
- **OAuth2** – Authentication between Salesforce and Google Apps Script via external server
- **JWT** – Session handling

---

## 📁 API Endpoints

All routes are prefixed under `/appscript` unless noted otherwise.

### Auth Routes

| Method | Route            | Description                             | Access   |
|--------|------------------|-----------------------------------------|----------|
| POST   | `/login`         | Log in or register user                 | Public   |
| GET    | `/callback`      | OAuth2 token callback handler           | Public   |

### Salesforce Integration

| Method | Route                      | Description                         | Access   |
|--------|----------------------------|-------------------------------------|----------|
| POST   | `/query`                   | Execute a SOQL query                | Private  |
| GET    | `/userinfo`                | Get authenticated user info         | Private  |
| GET    | `/objects`                 | Retrieve Salesforce objects         | Private  |
| POST   | `/getObjectFields`         | Get fields for a Salesforce object  | Private  |
| POST   | `/insert`                  | Insert object into Salesforce       | Private  |
| POST   | `/upsert`                  | Upsert object into Salesforce       | Private  |
| GET    | `/deleteToken`            | Revoke user's Salesforce token      | Private  |

---

## 🌍 Deployment

Your backend is hosted on AWS and accessible via:

**🌐 https://katmando.io**


![App Flow](https://png.pngtree.com/png-clipart/20240830/original/pngtree-cat-operating-laptop-png-image_15881120.png)


The static domain ensures consistent OAuth2 callback functionality regardless of Google Apps Script duplication.

---
![App Flow](https://media.tenor.com/L4ncxhqryfQAAAAj/cat.gif)


## 🔐 Environment Configuration

Create a `.env` file with the following keys:

```env
# MongoDB Connection
MONGODB_URL=your_mongodb_connection_string

# Salesforce OAuth Configuration
CLIENT_ID=your_salesforce_client_id
CLIENT_SECRET=your_salesforce_client_secret
REDIRECT_URI=https://catmando.xyz/appscript/callback
TOKEN_URL=https://login.salesforce.com/services/oauth2/token
AUTH_URL=https://login.salesforce.com/services/oauth2/authorize

# JWT Configuration
JWT_SECRET=your_jwt_secret
JWT_EXPIRATION=24h

# Server Configuration
PORT=3000
