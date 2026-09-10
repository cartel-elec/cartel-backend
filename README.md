# CARTEL MULTI-ENGINEERING LTD – Quote Request Backend

Receive quote requests from the website, store them, **get email notifications**, and manage them in a simple admin panel.

## Features

- Receives form submissions (`POST /api/quote`)
- Saves every request in `data/quotes.json`
- **Sends you an email** for every new quote request
- Password-protected Admin panel (`/admin`) to view, filter and update status
- Rate limiting + CORS protection

## Folder structure

```
cartel-backend/
├── server.js
├── package.json
├── public/
│   └── admin.html
├── data/
│   └── quotes.json
└── README.md
```

## 1. Deploy the backend (free)

### Render.com (recommended)

1. Create account at [render.com](https://render.com)
2. **New → Web Service**
3. Upload this folder or connect a GitHub repo
4. Settings:
   - Runtime: **Node**
   - Build Command: `npm install`
   - Start Command: `npm start`
5. Add these **Environment Variables**:

| Variable | Value | Required |
|----------|-------|----------|
| `ADMIN_PASSWORD` | Strong password for admin login | Yes |
| `ADMIN_TOKEN_SECRET` | Any long random string | Yes |
| `NOTIFY_EMAIL` | `roi.nipatrick@gmail.com` | Yes |
| `SMTP_USER` | Your Gmail address | Yes (for email) |
| `SMTP_PASS` | Gmail **App Password** | Yes (for email) |
| `SMTP_HOST` | `smtp.gmail.com` | Optional |
| `SMTP_PORT` | `587` | Optional |
| `SMTP_FROM` | Same as SMTP_USER | Optional |

6. Deploy. You get a URL like:  
   `https://cartel-quotes.onrender.com`

---

## 2. Enable Gmail email notifications (important)

Gmail does **not** allow normal passwords for apps. You must create an **App Password**:

1. Go to your Google Account → **Security**
2. Enable **2-Step Verification** (if not already on)
3. Search for **App passwords**
4. Create a new App Password:
   - App: Mail
   - Device: Other → type “CARTEL Backend”
5. Copy the 16-character password (e.g. `abcd efgh ijkl mnop`)
6. Put it in the environment variable `SMTP_PASS` (no spaces)

Also set:
- `SMTP_USER` = `roi.nipatrick@gmail.com`
- `NOTIFY_EMAIL` = `roi.nipatrick@gmail.com` (where you want to receive the alerts)

After deploying with these variables, every new quote request will send a professional email to your inbox.

---

## 3. Connect the website form

1. Open `script.js` on the website
2. Find:

```js
const API_URL = ''; // <-- PASTE YOUR BACKEND URL HERE
```

3. Change to:

```js
const API_URL = 'https://YOUR-BACKEND-URL.onrender.com/api/quote';
```

4. Re-upload the website files to GitHub Pages.

---

## 4. Use the Admin panel

Open:  
`https://YOUR-BACKEND-URL.onrender.com/admin`

Login with the `ADMIN_PASSWORD` you set.

You can:
- See all quote requests
- Filter by status (New / Contacted / Quoted / Closed)
- Click email or phone to contact the client
- Change status
- Delete old requests

---

## Local testing

```bash
cd cartel-backend
npm install
# Optional: create a .env or export the variables
export SMTP_USER=roi.nipatrick@gmail.com
export SMTP_PASS=your-16-char-app-password
export NOTIFY_EMAIL=roi.nipatrick@gmail.com
export ADMIN_PASSWORD=Cartel2026!
npm start
```

Then open http://localhost:3000/admin

---

## Emails sent

**1. To you (company notification)**
- Client name, email, phone, subject, full message, date
- Reply-To is set to the client so you can reply directly

**2. To the client (confirmation)**
- Professional thank-you message
- Confirms their request was received
- Mentions typical response time (1–2 business days)
- Includes your phone number for urgent cases

---

## Security notes

- Change the default admin password
- Never put your real Gmail password in the code – use App Password only
- Rate limit is active (10 submissions per 15 minutes per IP)
- CORS restricted to your GitHub Pages domain

---

© 2026 CARTEL MULTI-ENGINEERING LTD
