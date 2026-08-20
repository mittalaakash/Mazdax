# Mazdax — Full Project Plan

A learning project: a minimal React frontend and Node/Express backend, deployed
**separately** on AWS, then grown toward production-grade infrastructure in later phases.
Depth over speed — each phase should be understood, not just completed.

**Your context (for reference across sessions):**
- AWS familiarity: some hands-on experience (launched EC2/S3 before)
- Goal: understand deployment concepts deeply, even if slower
- AWS approach: console-driven — you click through it yourself, I give exact instructions.
  No AWS automation connector for this project; the console navigation *is* the learning.
- CI/CD: GitHub Actions, hand-rolled (not AWS CodePipeline) — SSH private key stored as a
  GitHub Secret to reach EC2.
- No custom domain yet, but nothing should be hardcoded such that adding one later requires rework.

---

## Phase 0 — Local scaffold

```
mazdax/
├── client/        (React, Vite, JavaScript)
└── server/        (Node.js + Express, JavaScript)
```

**Backend (`server/`)**
```bash
mkdir server && cd server
npm init -y
npm install express cors
```

`server/index.js`
```js
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());

app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from the Node.js backend!' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
```
Run: `node index.js` → check `http://localhost:5000/api/hello`.

**Frontend (`client/`)**
```bash
npm create vite@latest client -- --template react
cd client && npm install
```

`client/src/App.jsx`
```jsx
import { useState, useEffect } from 'react';

function App() {
  const [message, setMessage] = useState('Loading...');

  useEffect(() => {
    fetch(import.meta.env.VITE_API_URL + '/api/hello')
      .then(res => res.json())
      .then(data => setMessage(data.message))
      .catch(() => setMessage('Could not reach backend'));
  }, []);

  return <h1>{message}</h1>;
}

export default App;
```

`client/.env` (dev only)
```
VITE_API_URL=http://localhost:5000
```

Run: `npm run dev`. **Milestone: React renders the message it fetched from Node, both
running locally.** Commit here.

---

## Phase 1 — Manual deploy (console-driven)

### Backend → EC2
1. Launch a t2.micro EC2 instance (Ubuntu), open inbound port 5000 in its Security Group.
2. SSH in, install Node, copy `server/` (or `git clone` your repo).
3. `npm install`, then `pm2 start index.js` so it survives disconnects/reboots.
4. Note the instance's public IP (or allocate an Elastic IP so it doesn't change on restart).
5. Confirm from your laptop: `curl http://<ip>:5000/api/hello`.

### Frontend → S3 + CloudFront
1. `cd client && npm run build` → produces `dist/`.
2. Create an S3 bucket, enable static website hosting, upload `dist/` contents.
3. Create a CloudFront distribution pointing at the bucket (HTTPS + CDN caching).
4. Before building, set `VITE_API_URL` in `client/.env.production` to the EC2 URL, then
   rebuild and re-upload.

### Wire them together
- Node's `cors()` must allow the CloudFront origin (lock down `origin:` in production
  instead of the wide-open default).
- The only link between the two deployments is `VITE_API_URL`, baked in at React's build
  time — no shared server, no shared VPC required yet.

**Milestone: the CloudFront URL loads React, which fetches from the EC2 URL.** Commit.

---

## Phase 2 — CI/CD (GitHub Actions)

Two independent pipelines — treat them as separate concerns since the frontend and
backend deploy completely differently.

### Frontend pipeline
On push to `main` (paths: `client/**`):
1. Checkout, `npm install`, `npm run build` (with `VITE_API_URL` from a GitHub Secret).
2. Sync `dist/` to the S3 bucket (`aws s3 sync`).
3. Invalidate the CloudFront cache (`aws cloudfront create-invalidation`).
- Needs: an IAM user (or OIDC role) with S3 + CloudFront permissions, stored as GitHub Secrets (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, bucket name, distribution ID).

### Backend pipeline
On push to `main` (paths: `server/**`):
1. Checkout, optionally run tests.
2. SSH into the EC2 instance (using the private key from a GitHub Secret) and run a
   deploy script: `git pull`, `npm install`, `pm2 restart index`.
- Needs: the EC2 SSH private key as a GitHub Secret (e.g. `EC2_SSH_KEY`), the instance's
  IP/hostname, and a deploy script living in `server/` that GitHub Actions calls remotely.

**Milestone: push to `main` and watch both pipelines deploy automatically.** Commit the
workflow files themselves (`.github/workflows/*.yml`) as part of this milestone.

---

## Phase 3 — Scaling: Auto Scaling Group + Application Load Balancer

Extends the backend only — same Node app, more of it, load balanced.

1. Create an **Application Load Balancer** (ALB) with a target group pointing at your
   EC2 instance(s) on port 5000.
2. Create a **Launch Template** based on your current EC2 setup (AMI + user-data script
   that installs Node, pulls the app, and starts it with `pm2`).
3. Create an **Auto Scaling Group** using that launch template, attached to the ALB's
   target group. Start with min 1 / desired 1 / max 2–3 so you can watch it scale.
4. Point `VITE_API_URL` at the ALB's DNS name instead of the raw EC2 IP (this is the
   "why we didn't hardcode an IP" payoff).
5. Update the backend GitHub Actions pipeline: instead of SSHing to one fixed IP, it now
   needs to deploy to every instance in the ASG (or bake the code into the AMI/launch
   template and redeploy by rolling the ASG — a good discussion point once you're here).

**Milestone: kill one EC2 instance manually and watch the ALB/ASG keep the app up and
replace it.** This is the core "production" lesson of this phase.

---

## Phase 4 — (Optional, exploratory) API Gateway + VPC Link

Only pursue this after Phase 3 is solid. Since we're staying EC2-based (not serverless),
API Gateway sits in front of the ALB via a VPC Link — useful for centralizing rate
limiting, API keys, or request validation, but genuinely optional: for many EC2-based
setups, the ALB alone covers what you need. Treat this phase as "learn what API Gateway
adds on top of an ALB you already understand," not a required step.

---

## Phase 5 — Custom domain (once you own one)

1. Register/point your domain's nameservers at **Route 53**.
2. Request an ACM certificate for your domain (and `www.` if needed).
3. Point a Route 53 record at the CloudFront distribution (frontend) and another at the
   ALB (backend API, e.g. `api.yourdomain.com`).
4. Update `VITE_API_URL` to `https://api.yourdomain.com` and redeploy the frontend.

Because nothing before this phase was hardcoded to a raw AWS URL beyond an env var,
this phase is pure DNS/cert work — no application code changes beyond one env var.

---

## Working conventions for every phase
- Don't skip ahead — verify each milestone works before starting the next phase.
- Commit to git after every milestone listed above, with a message naming it.
- For every AWS console step, expect exact click-by-click instructions before you act —
  ask if a step isn't clear rather than guessing.
