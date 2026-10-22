# Серверт байршуулах

Өгөгдөл нь серверийн диск дээрх SQLite файлд хадгалагдах тул Vercel зэрэг serverless орчинд биш, байнгын дисктэй сервер дээр байршуулна. Хоёр арга бий:

- **Render** эсвэл **Railway** (Docker): GitHub-д push хийхэд тест ажиллаж, QPay, WeSend шалгагдаад автоматаар шинэчлэгдэнэ. Доорх эхний хоёр хэсгийг үзнэ үү.
- **Өөрийн VPS**: Ubuntu, nginx, systemd. 1-р хэсгээс эхэлнэ.

## Render (Docker)

`render.yaml` (Blueprint) нь серверийг бүхэлд нь тодорхойлно:
- Starter багц: 0.5 CPU, 512 MB, сард ~$7;
- Сингапур бүс;
- `/data` дээр 1 GB диск;
- deploy-ийн өмнөх шалгалт `scripts/check-services.js`;
- `/healthz` шалгалт;
- GitHub Actions амжилттай болсны дараа л deploy хийх тохиргоо (`autoDeployTrigger: checksPass`).

Push хийхэд юу болох дараалал нь доорх Railway хэсэгтэй ижил.

1. https://render.com-д GitHub-аараа бүртгүүлнэ. Workspace багцаас **Hobby ($0)**-г сонгоно, Pro шаардлагагүй. **Billing** хэсэгт карт нэмнэ (Starter сервер болон дискэнд).
2. **New → Blueprint** → `shaman-time-booking` repo-г сонгоно. Хэрэв жагсаалтад харагдахгүй бол **Configure GitHub App**-аар Render-т repo-д хандах эрх өгнө. **Branch** нь deploy хийх салбар (`main` эсвэл `nextjs`).
3. Render `render.yaml`-ийг уншаад нууц утгуудыг асууна:
   - `BASE_URL`: сайтын https хаяг. Домэйн холбоогүй бол эхлээд `https://time-booking.onrender.com` гэж бичээд, домэйн холбосны дараа солино. Render-ийн өгсөн хаяг өөр байвал түүнийг бичнэ.
   - `ADMIN_PASSWORD`: 10+ тэмдэгт. Анхны deploy-д админ үүсгэхэд ашиглагдана.
   - `QPAY_CLIENT_ID`, `QPAY_CLIENT_SECRET`, `QPAY_INVOICE_CODE`, `SMS_API_KEY`: `.env`-ээс хуулна.

   `SESSION_SECRET`-ийг Render өөрөө үүсгэнэ.
4. **Deploy Blueprint** дарна. Лог дээр `✓ QPay`, `✓ SMS` мөрүүд гарч, дараа нь сайт асна.
5. **Домэйн**: service → **Settings → Custom Domains** → домэйнээ нэмнэ. Render-ийн өгсөн DNS бичлэгийг домэйнээ бүртгүүлсэн газрын DNS тохиргоонд нэмнэ. SSL-ийг Render өөрөө гаргана. Дараа нь **Environment** хэсгээс `BASE_URL`-ийг шинэ хаягаар солино.

## Railway (Docker)

Төсөлд бэлэн байгаа файлууд:

| Файл | Үүрэг |
|---|---|
| `Dockerfile` | Апп-ыг build хийж ажиллуулна. Өгөгдөл `/data` хавтсанд хадгалагдана (`DATA_DIR=/data`). |
| `railway.json` | Railway-ийн тохиргоо: Dockerfile-аар build хийх, deploy-ийн өмнөх шалгалт, `/healthz` шалгалт. |
| `.github/workflows/ci.yml` | GitHub Actions: push бүрд unit, e2e тест болон Docker image-ийн шалгалт. |
| `scripts/check-services.js` | Deploy бүрийн өмнө тохиргоо, QPay, WeSend-ийг шалгана (`npm run check:services`). |

### Push хийхэд юу болох вэ

1. **GitHub Actions** (`ci.yml`) ажиллана:
   - unit тест;
   - e2e тест (апп-ыг build хийж, захиалга, төлбөр, админы урсгалыг шалгана);
   - Docker image build хийж, асаагаад хуудсуудыг нээж үзнэ.
2. Тест бүгд амжилттай бол **Railway** Dockerfile-аар шинэ хувилбарыг build хийнэ. Ингэхийн тулд доорх 5-р алхмын «Wait for CI» асаалттай байх ёстой.
3. **Deploy-ийн өмнөх шалгалт** (`node scripts/check-services.js`) Railway-ийн жинхэнэ хувьсагчидтай ажиллана. SMS илгээхгүй, нэхэмжлэх үүсгэхгүй:
   - тохиргоо бүрэн эсэх (`SESSION_SECRET`, QPay түлхүүрүүд);
   - `QPAY_MODE` нь `mock` биш, `BASE_URL` нь жинхэнэ `https` хаяг эсэх;
   - QPay-д түлхүүрээрээ нэвтэрч чадаж байгаа эсэх;
   - WeSend түлхүүр ажиллаж байгаа эсэх, үлдэгдэл кредит. 10-аас цөөн SMS-ийн кредит үлдвэл анхааруулна, гэхдээ deploy-г зогсоохгүй.

   Аль нэг нь бүтэлгүйтвэл deploy зогсож, одоо ажиллаж байгаа хувилбар хэвээр үлдэнэ. Шалтгааныг Railway → Deployments → тухайн deploy-ийн лог дээр харна.
4. Шинэ хувилбар асаж `/healthz` нь `ok` буцаасны дараа л хэрэглэгчид рүү шилжинэ.

### Анх тохируулах

1. https://railway.com → **New Project → Deploy from GitHub repo** → `shaman-time-booking`-г сонгоно. Service → **Settings → Source → Branch**-аас deploy хийх салбараа (`main` эсвэл `nextjs`) сонгоно.
2. **Volume**: service дээр баруун товшоод **Attach Volume** → Mount path: `/data`. Үүнгүйгээр deploy бүрт захиалга, зураг устна.
3. **Variables** таб (`.env`-ийн утгуудыг хуулна):

   ```ini
   BASE_URL=https://www.example.mn        # сайтын жинхэнэ хаяг (доорх 6-р алхам)
   SESSION_SECRET=<openssl rand -hex 32>
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=<10+ тэмдэгт, анх асаахад л ашиглагдана>
   QPAY_MODE=live
   QPAY_CLIENT_ID=...
   QPAY_CLIENT_SECRET=...
   QPAY_INVOICE_CODE=...
   SMS_PROVIDER=wesend
   SMS_API_KEY=...
   ```

   `NODE_ENV`, `DATA_DIR`, `PORT`-ийг Dockerfile болон Railway өөрөө тохируулна. Тэдгээрийг нэмэх шаардлагагүй.
4. **Settings → Deploy**:
   - **Replicas** 1 байна (SQLite нэг л серверт ажиллана).
   - **App Sleeping (Serverless)** унтраалттай байна. Төлбөр шалгах, цаг суллах, сануулга SMS илгээх ажлууд апп дотор байнга ажилладаг.
5. **Settings → Source → Wait for CI**-г асаана. GitHub Actions-ийн тест амжилтгүй бол Railway deploy хийхгүй.
6. **Settings → Networking**:
   - **Generate Domain** (`*.up.railway.app`), эсвэл **Custom Domain**-д `www.example.mn` нэмнэ.
   - Custom domain бол Railway-ийн өгсөн CNAME бичлэгийг Datacom-ийн DNS тохиргоонд нэмнэ (4-р хэсгийг үзнэ үү). SSL сертификатыг Railway өөрөө гаргана.
   - `BASE_URL` нь энэ хаягтай яг ижил байна. QPay төлбөрийн мэдэгдлийг `BASE_URL/qpay/callback` руу илгээдэг.
7. Анхны deploy амжилттай болсны дараа `ADMIN_PASSWORD`-ийг Variables-аас устгаж болно. Админ хэрэглэгч өгөгдлийн санд хадгалагдсан байгаа.

### Өдөр тутам

- **Шинэчлэх**: `git push` хийхэд л хангалттай.
- **Шалгалтыг гараар ажиллуулах**: `railway run npm run check:services`, эсвэл локалд `.env`-тэйгээр `npm run check:services`.
- **Нөөц хуулбар**:
  - Апп өдөр бүр `/data/backups/`-д хуулбар үүсгэдэг ч энэ нь мөн л тэр volume дээр хадгалагдана.
  - Админ самбар → Тохиргоо → «Өгөгдлийн сангийн хуулбар татах»-аар үе үе компьютертоо татаж авна.
  - Railway-ийн volume backup-ийг асааж болно.
- **Нууц үг сэргээх**: `railway ssh` → `npm run admin:password -- admin '<шинэ нууц үг>'`.

Доорх 1–7-р хэсэг нь өөрийн VPS-д зориулсан.

Жишээ: Ubuntu 22.04/24.04 VPS, домэйн `www.example.mn` (Datacom-д бүртгэлтэй). Апп нь Next.js сервер (`next start`) болж ажиллаж, түүний өмнө nginx (SSL, gzip) байрлана.

## 1. Шаардлага

- Node.js **22.16 эсвэл түүнээс шинэ** (24 LTS зөвлөмжтэй). Өгөгдлийн санд Node-ийн суурилагдсан `node:sqlite`-г ашигладаг тул native модуль хөрвүүлэх шаардлагагүй.
- nginx, certbot
- 1 GB RAM хангалттай (`npm run build` хийхэд 1 GB swap нэмэхийг зөвлөнө).

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs nginx certbot python3-certbot-nginx
```

## 2. Апп суулгах

```bash
sudo useradd --system --create-home --home-dir /srv/time-booking --shell /usr/sbin/nologin booking
sudo -u booking git clone <repo> /srv/time-booking/app      # эсвэл файлуудаа хуулна
cd /srv/time-booking/app
sudo -u booking npm ci
sudo -u booking cp .env.example .env
sudo -u booking nano .env
sudo -u booking npm run build
```

`.env` доторх заавал бөглөх утгууд:

```ini
NODE_ENV=production
BASE_URL=https://www.example.mn
SESSION_SECRET=<node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
DATA_DIR=/srv/time-booking/data
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<10+ тэмдэгт, анх асаахад л ашиглагдана>
QPAY_MODE=live   # docs/QPAY_SETUP.md
SMS_PROVIDER=http  # docs/SMS_SETUP.md
```

```bash
sudo chmod 600 /srv/time-booking/app/.env
```

Анх асаасны дараа `ADMIN_PASSWORD`-ийг `.env`-ээс устгаж болно. Админ хэрэглэгч өгөгдлийн санд хадгалагдсан. Нууц үг сэргээх:

```bash
cd /srv/time-booking/app && sudo -u booking npm run admin:password -- admin '<шинэ нууц үг>'
```

## 3. systemd үйлчилгээ

`deploy/time-booking.service`-ийг хуулна:

```bash
sudo cp deploy/time-booking.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now time-booking
sudo systemctl status time-booking
journalctl -u time-booking -f      # лог
```

## 4. Домэйн холбох (Datacom)

Домэйнээ серверийн IP хаяг руу чиглүүлнэ (Datacom-ийн «Домэйныг IP хаягаар чиглүүлэх» заавар):

1. https://www.datacom.mn руу домэйн бүртгүүлсэн и-мэйл, нууц үгээрээ нэвтэрнэ.
2. **Домэйн нэр** цэс → тухайн домэйны **Удирдах** → зүүн талын **DNS удирдлага**.
3. **Шинээр нэмэх A Record** дарж хоёр бичлэг нэмнэ. TTL-ийг 7200 буюу түүнээс их болгоно.

| Хост нэр | Төрөл | Утга |
|---|---|---|
| `www` | A | серверийн IP (жишээ `203.0.113.10`) |
| (хоосон) | A | серверийн IP |

4. Шинэчлэгдэхэд 3–24 цаг болно. Шалгах: `dig +short www.example.mn` серверийн IP-г буцаавал бэлэн.

Хэрэв домэйн Datacom-ийн бус өөр нэрийн сервер (Cloudflare г.м) ашигладаг бол A бичлэгийг тэр үйлчилгээний DNS хэсэгт нэмнэ. Нэрийн серверийг Datacom-ийн **DNS удирдлага → Нэрийн серверүүд** хэсгээс солино.

SSL гэрчилгээг (дараагийн алхам) домэйн серверийн IP руу чиглэсний **дараа** авна.

## 5. nginx ба SSL

```bash
sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/time-booking
sudo nano /etc/nginx/sites-available/time-booking     # домэйнээ солино
sudo ln -s /etc/nginx/sites-available/time-booking /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d example.mn -d www.example.mn  # SSL, автоматаар сунгагдана
```

Гал хана: `sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable`. 3000 портыг гадагш нээх шаардлагагүй.

## 6. Нөөц хуулбар

- Апп өдөр бүр `DATA_DIR/backups/app-YYYY-MM-DD.db` файл үүсгэж, сүүлийн `BACKUP_KEEP` (анхдагч 14) хоногийнхыг хадгална.
- Гараар: `npm run backup` эсвэл админ самбар → Тохиргоо → «Өгөгдлийн сангийн хуулбар татах».
- Админы **Нүүр хуудас** цэснээс оруулсан зургууд `DATA_DIR/uploads/` хавтсанд хадгалагдана. Өгөгдлийн сангийн нөөцөд эдгээр орохгүй тул хавтсыг хамт хуулна.
- **Серверээс гадна хадгалах** (зөвлөмж). Жишээ нь өөр сервер рүү өдөр бүр хуулах cron:

```cron
30 4 * * * rsync -a /srv/time-booking/data/backups/ /srv/time-booking/data/uploads backup@backup-host:/backups/time-booking/
```

  rclone ашиглан Google Drive, S3 зэрэг үүлэн санд хадгалах боломжтой.

Сэргээх: үйлчилгээг зогсоогоод (`systemctl stop time-booking`) нөөц файлыг `DATA_DIR/app.db` болгон хуулж (`app.db-wal`, `app.db-shm` файлуудыг устгана), дахин асаана.

## 7. Шинэчлэх

```bash
cd /srv/time-booking/app
sudo -u booking git pull
sudo -u booking npm ci
sudo -u booking npm run build
sudo systemctl restart time-booking
```

Өгөгдлийн сангийн бүтцийн өөрчлөлт (migration) асахад автоматаар хийгдэнэ.

## 8. Facebook ба хурд

- Хуудсууд сервер талд бэлэн HTML-ээр ирж, гаднын фонт, сан ачаалдаггүй. Next.js-ийн CSS/JS (`/_next/static/`) нь хувилбарын hash-тай тул 1 жил кэшлэгдэнэ. nginx gzip шахалт хийнэ.
- Facebook-д хуваалцахад гарах зураг: `public/img/og.jpg` (1200×630). Өөрийн зургаар солихдоо 1200×630 хэмжээтэй, 300 KB-аас бага JPG ашиглана. Эсвэл байгууллагын нэрээ тохируулсны дараа `npm run og-image`-ээр дахин үүсгэнэ (Chrome шаардлагатай).
- Зураг, гарчиг солисны дараа https://developers.facebook.com/tools/debug/ дээр хаягаа оруулж «Scrape Again» дарснаар Facebook шинэчилнэ.
- Сайтад шинэ зураг нэмэхдээ шахаж (https://squoosh.app, WebP/JPG 80%) ашиглана.

## 9. Хяналт

- `https://www.example.mn/healthz` нь `ok` буцаана. UptimeRobot зэрэг үнэгүй үйлчилгээгээр хянана.
- Админ самбарын анхааруулга (шар хайрцаг) нь QPay/SMS тохиргоо дутуу бол мэдэгдэнэ.

## 10. Хүлээлгэн өгөх шалгах хуудас

- [ ] `.env`: `NODE_ENV=production`, `BASE_URL` https, урт `SESSION_SECRET`
- [ ] Datacom-д `www` болон хоосон хост нэрт A бичлэг серверийн IP руу, `https://` нээгдэж байна
- [ ] QPay live мэдээлэл, 100₮-ийн жинхэнэ төлбөрөөр шалгасан
- [ ] SMS gateway, илгээгчийн нэр бүртгэгдсэн, туршилтын SMS ирсэн
- [ ] Админ → Тохиргоо: байгууллагын нэр, хаяг, утас, газрын зураг, Facebook
- [ ] Бөөгийн утасны дугаар (Тохиргоо → SMS)
- [ ] Үйлчилгээ, үнэ, урьдчилгаа
- [ ] Ажлын цаг, цайны цаг, амралтын өдрүүд
- [ ] Цуцлах, буцаалтын нөхцөлийн текстийг эзэмшигч баталсан
- [ ] `npm run og-image` эсвэл өөрийн OG зураг, Facebook Sharing Debugger-ээр шалгасан
- [ ] Серверээс гадна нөөц хуулбар хадгалах cron
- [ ] Админ нууц үгийг эзэмшигчид шилжүүлж, `ADMIN_PASSWORD`-ийг `.env`-ээс устгасан
