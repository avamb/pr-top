# Accessing PR-TOP from Russia

> **TL;DR — try `https://ru.pr-top.com` first.** Once Phase 2 of [ADR-0001](../decisions/0001-russia-accessibility.md) ships, that hostname will route directly to our origin server in Europe and bypasses Cloudflare entirely. No proxy, no VPN. If that also doesn't work for your network, the rest of this page lists manual workarounds for power users.

> ⚠️ Russian-language version below — see *§ Russian (русский)*.

---

## Why this happens

`pr-top.com` is served behind **Cloudflare**, which is currently throttled or blocked at the network layer in many parts of Russia. The Telegram bot is **not** affected — it has its own connection routing and works normally. Only the **website / dashboard / consent pages** are affected.

---

## What therapists should try, in order

### 1. Use the direct hostname (recommended once Phase 2 ships)

Open **`https://ru.pr-top.com`** instead of `https://pr-top.com`.
This is the same site and the same account; it just routes around Cloudflare.

If that loads → you're done. Bookmark it.

### 2. Use a browser with built-in proxy / WARP

- **Cloudflare WARP** (the desktop / mobile app, not the network) — confusingly, this often *unblocks* Cloudflare-hosted sites because WARP carries your traffic over Cloudflare's own tunnel which the residential ISP can't filter the same way.
- **Opera browser → Settings → Privacy & Security → VPN** — built-in free proxy. Slow but it works.
- Any of the well-known browser VPN extensions you already have.

### 3. Use the Telegram bot for everything bot-capable

The therapist bot account works without a proxy. Diary entries, voice messages, exercises, and SOS all work. The only things that *require* the website are:
- the dashboard (analytics, search, session player)
- signing up
- audio file uploads

If you can do your work via the bot today and pick up the dashboard later (from a different network), that's a valid stopgap.

### 4. SSH SOCKS5 proxy (power-user fallback)

This is the recipe Misha shared in the 2026-04-19 customer-development call. It requires **your own SSH-accessible server** outside Russia (any cheap VPS works — Hetzner, DigitalOcean, Linode, AWS Lightsail).

#### On Android

1. Install **Termux** from F-Droid (the Play Store version is outdated).
2. In Termux, run:
   ```sh
   pkg update && pkg install openssh
   ssh -D 0.0.0.0:1080 -N you@your-vps.example.com
   ```
   `-D 1080` opens a SOCKS5 proxy on port 1080 of your phone (`localhost`).
   `-N` means "don't run a remote command, just forward".
3. In Telegram → *Settings → Data and Storage → Proxy* → **Add proxy**:
   - Type: **SOCKS5**
   - Server: `127.0.0.1`
   - Port: `1080`
   - Username/password: leave blank.
4. In any browser app that lets you set a system or per-app proxy, point it at `127.0.0.1:1080` (SOCKS5). Chrome on Android does *not* — install **Kiwi Browser** or **Bromite** which do.

Now `pr-top.com` should load.

#### On Windows

```powershell
ssh -D 1080 -N you@your-vps.example.com
```

Then either:
- Set a system-wide proxy in Windows Settings → Network → Proxy → Manual → SOCKS, host `127.0.0.1`, port `1080`. (Many apps including Edge/Chrome will pick this up.)
- Or launch Chrome with `chrome.exe --proxy-server="socks5://127.0.0.1:1080"`.

#### On macOS / Linux

```sh
ssh -D 1080 -N you@your-vps.example.com
```

Then either set a system SOCKS proxy in Network Preferences, or launch a browser with `--proxy-server="socks5://127.0.0.1:1080"`.

> **Security note (paraphrasing Misha):** giving an SSH login to every client is a bad idea. Only use this recipe with *your own* server, and use SSH key authentication, not passwords.

### 5. Mobile data instead of Wi-Fi (or vice versa)

Counter-intuitively, sometimes the residential ISP filters more aggressively than the mobile carrier, or the other way around. Switching networks once is a 30-second test that occasionally just works.

---

## What clients should try

Most clients only ever talk to the **Telegram bot**, which works. They should not normally need to open `pr-top.com` at all.

If a client receives an invite link that points to `pr-top.com` and it doesn't load:
1. Ask your therapist to regenerate the invite as a Telegram deep-link (`t.me/<bot>?start=…`) — this is the default once Phase 2 ships.
2. If the client *must* visit the web (e.g. to sign the consent form), forward them this page.

---

## What to do when nothing works

Email **support@pr-top.com** (or message your therapist, who can email us on your behalf) with:
- which city / region you're in,
- which ISP (Rostelecom, MTS, Beeline, MegaFon, Yota, ER-Telecom, …),
- whether mobile data also fails,
- the exact error in the browser (timeout? TLS error? "site can't be reached"?).

We track these reports against the [ADR-0001 review trigger](../decisions/0001-russia-accessibility.md#8-risks-and-review) and will roll out option *b-fallback* (a non-Hetzner European hop) if any major RU ASN is fully blocked.

---

## Russian (русский)

### Зачем эта страница

`pr-top.com` хостится за Cloudflare, который в России частично заблокирован. Telegram-бот при этом работает нормально — у него собственный механизм соединения. Сломан только **веб-сайт** (лендинг, dashboard, страница согласия).

### Что попробовать терапевту по порядку

1. **Открыть `https://ru.pr-top.com`** вместо `https://pr-top.com`. Это тот же сайт и тот же аккаунт, просто без Cloudflare. Загрузилось — закладку и забыли.
2. **Браузер с встроенным прокси:** Cloudflare WARP (приложение, не сеть), Opera со встроенным VPN, любой VPN-аддон.
3. **Использовать бота.** Дневник, голос, упражнения, SOS — всё работает в Telegram без прокси. Сайт нужен только для dashboard, регистрации и заливки аудио — это можно отложить или сделать с другой сети.
4. **SSH SOCKS5-прокси (рецепт Миши, 19.04.2026).** Нужен свой VPS за границей. На телефоне — **Termux** (через F-Droid):
   ```sh
   pkg install openssh
   ssh -D 0.0.0.0:1080 -N you@your-vps.example.com
   ```
   Затем в Telegram → *Настройки → Данные и память → Прокси* → SOCKS5, `127.0.0.1:1080`. Для браузера — Kiwi Browser / Bromite на Android, либо системный прокси на Windows / macOS / Linux.
   ⚠️ Не давайте SSH-доступ другим людям. Используйте только свой сервер и только ключевую аутентификацию.
5. **Сменить сеть.** Wi-Fi → мобильный интернет или наоборот. Иногда фильтрация отличается.

### Что делать клиенту

Большинство клиентов общаются только с ботом — это работает. Если пришла ссылка-приглашение на `pr-top.com` и не открывается, попросите терапевта переслать deep-link через Telegram (`t.me/<бот>?start=…`).

### Если ничего не помогает

Напишите на **support@pr-top.com** (или попросите терапевта) с указанием города, провайдера (Ростелеком / МТС / Билайн / МегаФон / Yota / ЭР-Телеком / …), работает ли мобильный интернет и точного текста ошибки. По таким репортам мы триггерим план *b-fallback* из [ADR-0001](../decisions/0001-russia-accessibility.md).
