# Gezinsassistent — Setup & Deploy

## 1. Supabase project aanmaken

1. Ga naar https://supabase.com en maak een gratis project aan
2. Ga naar **SQL Editor** en plak de inhoud van `supabase/schema.sql` erin → **Run**
3. Kopieer van **Project Settings → API**:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

## 2. iCloud CalDAV instellen

1. Ga naar https://appleid.apple.com → **Inloggen & beveiliging → App-wachtwoorden**
2. Maak een nieuw app-wachtwoord aan: noem het "Gezinsassistent"
3. Noteer het wachtwoord (formaat: xxxx-xxxx-xxxx-xxxx)
4. Gebruik je Apple ID e-mailadres als gebruikersnaam

## 3. GitHub repo aanmaken

```bash
# In de map gezinsassistent-web:
git init
git add .
git commit -m "Initiële versie gezinsassistent"

# Maak een repo aan op github.com, dan:
git remote add origin https://github.com/JOUW-NAAM/gezinsassistent.git
git push -u origin main
```

## 4. Vercel deployen

1. Ga naar https://vercel.com → **New Project**
2. Importeer je GitHub repo
3. Voeg de volgende **Environment Variables** toe:

| Variabele | Waarde |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | https://xxx.supabase.co |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | eyJ... |
| `SUPABASE_SERVICE_ROLE_KEY` | eyJ... |
| `APP_PASSWORD` | Kies een sterk wachtwoord |
| `JWT_SECRET` | Willekeurige string van 32+ tekens |
| `ANTHROPIC_API_KEY` | sk-ant-... |
| `ICLOUD_USERNAME` | jouw@icloud.com |
| `ICLOUD_APP_PASSWORD` | xxxx-xxxx-xxxx-xxxx |
| `EMAIL_VAN` | jouw@icloud.com |
| `EMAIL_NAAR` | ontvanger@email.nl |
| `EMAIL_SMTP_SERVER` | smtp.mail.me.com |
| `EMAIL_SMTP_PORT` | 587 |
| `EMAIL_WACHTWOORD` | (zelfde app-wachtwoord of apart) |

4. Klik **Deploy** → de app is beschikbaar op `gezinsassistent.vercel.app`

## 5. Lokaal draaien

```bash
# Kopieer .env.local en vul in:
cp .env.local .env.local  # bewerk dit bestand

npm install
npm run dev
# Open http://localhost:3000
```

## Bijwerken na wijzigingen

Elke `git push` naar `main` triggert automatisch een nieuwe deploy op Vercel.

```bash
git add .
git commit -m "Beschrijving van wijziging"
git push
```
