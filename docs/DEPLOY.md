# Серверт байршуулах

Жишээ: Ubuntu 22.04/24.04 VPS, домэйн `www.example.mn`. Апп нь Node.js процессоор ажиллаж, түүний өмнө nginx (SSL, gzip) байрлана.

## 1. Шаардлага

- Node.js **22.16 эсвэл түүнээс шинэ** (24 LTS зөвлөмжтэй). Өгөгдлийн санд Node-ийн суурилагдсан `node:sqlite`-г ашигладаг тул native модуль хөрвүүлэх шаардлагагүй.
- nginx, certbot
- 1 GB RAM хангалттай.

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs nginx certbot python3-certbot-nginx
```

## 2. Апп суулгах

```bash
sudo useradd --system --create-home --home-dir /srv/time-booking --shell /usr/sbin/nologin booking
sudo -u booking git clone <repo> /srv/time-booking/app      # эсвэл файлуудаа хуулна
cd /srv/time-booking/app
sudo -u booking npm ci --omit=dev
sudo -u booking cp .env.example .env
sudo -u booking nano .env
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

## 4. nginx ба SSL

```bash
sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/time-booking
sudo nano /etc/nginx/sites-available/time-booking     # домэйнээ солино
sudo ln -s /etc/nginx/sites-available/time-booking /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d example.mn -d www.example.mn  # SSL, автоматаар сунгагдана
```

Гал хана: `sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable`. 3000 портыг гадагш нээх шаардлагагүй.

## 5. Нөөц хуулбар

- Апп өдөр бүр `DATA_DIR/backups/app-YYYY-MM-DD.db` файл үүсгэж, сүүлийн `BACKUP_KEEP` (анхдагч 14) хоногийнхыг хадгална.
- Гараар: `npm run backup` эсвэл админ самбар → Тохиргоо → «Өгөгдлийн сангийн хуулбар татах».
- Админы **Нүүр хуудас** цэснээс оруулсан зургууд `DATA_DIR/uploads/` хавтсанд хадгалагдана. Өгөгдлийн сангийн нөөцөд эдгээр орохгүй тул хавтсыг хамт хуулна.
- **Серверээс гадна хадгалах** (зөвлөмж). Жишээ нь өөр сервер рүү өдөр бүр хуулах cron:

```cron
30 4 * * * rsync -a /srv/time-booking/data/backups/ /srv/time-booking/data/uploads backup@backup-host:/backups/time-booking/
```

  rclone ашиглан Google Drive, S3 зэрэг үүлэн санд хадгалах боломжтой.

Сэргээх: үйлчилгээг зогсоогоод (`systemctl stop time-booking`) нөөц файлыг `DATA_DIR/app.db` болгон хуулж (`app.db-wal`, `app.db-shm` файлуудыг устгана), дахин асаана.

## 6. Шинэчлэх

```bash
cd /srv/time-booking/app
sudo -u booking git pull
sudo -u booking npm ci --omit=dev
sudo systemctl restart time-booking
```

Өгөгдлийн сангийн бүтцийн өөрчлөлт (migration) асахад автоматаар хийгдэнэ.

## 7. Facebook ба хурд

- Хуудсууд сервер талд бэлэн HTML-ээр ирж, гаднын фонт, сан ачаалдаггүй. CSS/JS нь хувилбарын hash-тай тул 1 жил кэшлэгдэнэ. nginx gzip шахалт хийнэ.
- Facebook-д хуваалцахад гарах зураг: `public/img/og.jpg` (1200×630). Өөрийн зургаар солихдоо 1200×630 хэмжээтэй, 300 KB-аас бага JPG ашиглана. Эсвэл байгууллагын нэрээ тохируулсны дараа `npm run og-image`-ээр дахин үүсгэнэ (Chrome шаардлагатай).
- Зураг, гарчиг солисны дараа https://developers.facebook.com/tools/debug/ дээр хаягаа оруулж «Scrape Again» дарснаар Facebook шинэчилнэ.
- Сайтад шинэ зураг нэмэхдээ шахаж (https://squoosh.app, WebP/JPG 80%) ашиглана.

## 8. Хяналт

- `https://www.example.mn/healthz` нь `ok` буцаана. UptimeRobot зэрэг үнэгүй үйлчилгээгээр хянана.
- Админ самбарын анхааруулга (шар хайрцаг) нь QPay/SMS тохиргоо дутуу бол мэдэгдэнэ.

## 9. Хүлээлгэн өгөх шалгах хуудас

- [ ] `.env`: `NODE_ENV=production`, `BASE_URL` https, урт `SESSION_SECRET`
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
