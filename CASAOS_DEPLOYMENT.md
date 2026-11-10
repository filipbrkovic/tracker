# LocalCal on CasaOS / ZimaBoard

LocalCal retains Progress Tracker's Go/SQLite/PWA architecture and MIT license.
One container, no registration, subscriptions, AI service or external database.
Docker and physical CasaOS/ZimaBoard verification are not yet available in this
development environment. Treat the commands below as deployment instructions,
not a claim of a tested appliance install.

## Build and run over SSH

```sh
git clone https://github.com/filipbrkovic/tracker.git
cd tracker
# Use the LocalCal branch after it has been pushed, or copy this checkout here.
sudo mkdir -p /DATA/AppData/localcal
sudo chown 10001:10001 /DATA/AppData/localcal
cp .env.example .env
docker compose up -d --build
curl --fail http://127.0.0.1:3187/healthz
```

The container runs as UID 10001. SQLite must stay on local storage, not NFS/SMB.
The bind mount contains `tracker.db`, its WAL/SHM sidecars and legacy migration
files. Keep the entire directory across updates. Do not delete it during rollback.

The default port binding is loopback only. For phone access set `BIND_ADDRESS`
in `.env` to the server's private LAN IP, then recreate the container. Visit
`http://SERVER_PRIVATE_IP:3187`. Never forward this unauthenticated port through
your router. Dataset keys are identifiers, not passwords.

## CasaOS GUI import

Build the image on the ZimaBoard first using `docker compose build`. In CasaOS,
import the Compose YAML as a custom app. Remove `build: .` from the imported
copy; use the already built `localcal:local` image. Replace environment
substitutions with explicit private-IP, port and bind-mount values if the GUI
does not load `.env`. A remote registry image is not published by this project.

## Phone / PWA access

Use a trusted HTTPS reverse proxy or private VPN for secure remote access.
Configure authorization at the proxy if it is reachable outside your private
network; protect **all** `/api/*` routes and `/mcp`, not just the home page.
PWA installation/service workers require HTTPS or localhost; ordinary LAN HTTP
can load the app but does not provide a trusted secure context on phones.
Android/iPhone installation and physical phone tests remain unverified.

## Backup, restore, update and rollback

For the simplest consistent backup, stop the application before copying:

```sh
docker compose stop
sudo tar -C /DATA/AppData -czf localcal-backup.tar.gz localcal
docker compose start
```

For an online database backup, use SQLite's online backup API or `VACUUM INTO`
with a new destination filename. Do not copy only `tracker.db` while WAL writes
are active. If attachments/import archives are added later, include them too.
The Settings JSON backup is an additional logical backup, not a substitute for
the complete server directory.

Restore with the application stopped, preserve ownership 10001:10001, and start
again. Restore to an empty directory rather than overlaying old WAL files.
Before updating, save the current image (`docker image save`) and make a backup.
Build the updated checkout and recreate the container. To roll back, load the
saved image and restore the matching backup if a future version changes schema.
This version does not drop tables or delete legacy workout/history records.

## Verification checklist

1. Import `templates/foods.csv`; inspect preview, then apply it twice.
2. Search `svjezi sir` and `hljeb`; verify original names and brand identity.
3. Quick-add a named meal with kcal and no macros; macros show unknown.
4. Log a fractional portion, change the food master, then edit the logged
   quantity; saved nutrition must continue to use the original snapshot.
5. Open two browser profiles; take one offline, add distinct entries to the
   same date in both, reconnect, and verify both entries remain.
6. Delete one entry, reload an older offline browser, and check it stays deleted.
7. Restart the container and verify food/diary records; perform a backup/restore
   rehearsal before entrusting real data to the deployment.
