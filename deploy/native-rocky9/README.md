# Rocky Linux 9 직접 설치 — Docker 미사용

Node.js, Python, Gunicorn, Nginx, PostgreSQL이 하나도 없는 새 Rocky Linux 9 서버용입니다.
이 구성은 Docker를 설치하거나 사용하지 않습니다. Rocky 9.2도 대상으로 작성했지만 실제 서버 검증이 필요합니다.
이 안내의 IP `192.168.0.50`, SSH 사용자 `admin`을 실제 값으로 바꾸세요.

## 설치되는 구성

| 구성 | 설치 위치 또는 데이터 위치 |
| --- | --- |
| Python 3.12.15 | 공식 소스를 빌드하여 `/opt/brainz-runtime/python` |
| Node.js 22 | 공식 최신 22 배포 파일, `/opt/brainz-runtime/node` |
| PostgreSQL 16.15 또는 17.11 | 공식 소스를 빌드하여 `/opt/brainz-runtime/postgresql` |
| PostgreSQL 데이터 | `/var/lib/brainz-postgresql` |
| Nginx | Rocky 패키지, `/etc/nginx/conf.d/brainz.conf` |
| Django/Gunicorn | `/opt/brainz/.venv` |
| Next.js 및 소스 | `/opt/brainz/frontend`, `/opt/brainz/backend` |
| 비밀번호·환경변수 | `/etc/brainz/brainz.env` (root/brainz 그룹만 읽기) |
| DB 백업 | `/var/backups/brainz` (root만 접근) |

시스템 기본 Python 경로를 교체하지 않습니다. Rocky 9.2에는 최신 PostgreSQL RPM의 OS 라이브러리 요구사항이
맞지 않을 수 있어 이 스크립트는 PGDG RPM 저장소 대신 소스를 빌드합니다.
DB는 localhost:5432, Django는 localhost:8000, Next.js는 localhost:3000에서 실행합니다.
사내 사용자는 Nginx를 통해 `http://서버IP:8080`에 접속합니다.
서비스는 systemd에 등록되어 서버 재부팅 후 자동 시작합니다.

## 실행 전 확인

- sudo 권한, 고정 IPv4 주소, 인터넷 연결, 빌드에 사용할 여유 디스크/메모리가 필요합니다.
- Rocky 패키지 저장소, GitHub, python.org, nodejs.org, ftp.postgresql.org, PyPI, npm registry에 접근해야 합니다.
- 설치 폴더 `/opt/brainz` 및 포트 5432/8000/3000/8080에 기존 서비스가 없는 새 서버를 대상으로 합니다.
- 설치는 Python/PostgreSQL을 컴파일하므로 시간이 걸립니다. 기본 병렬 작업 수는 2입니다.
- Python/Node/PostgreSQL 공식 배포 파일의 SHA-256을 확인합니다. Node 22 세부 버전은 실행 시점에 선택됩니다.
- Rocky 9.2 자체의 보안 업데이트는 별도 작업입니다. `dnf upgrade`를 자동 실행하지 않지만 패키지 설치 시 의존성 업데이트는 일어날 수 있습니다.
- source 설치한 Python/PostgreSQL과 공식 배포 파일로 설치한 Node는 `dnf update`로 업데이트되지 않습니다. 이후 보안 패치는 별도로 관리해야 합니다.
- SELinux는 유지합니다. Nginx 프록시 연결, 8080 포트 및 정적 파일 경로에 필요한 정책만 설정합니다.
- 아래 명령은 로컬 PC가 아니라 SSH로 접속한 리눅스 서버에서 실행합니다. PC 백업/전송 단계만 PowerShell입니다.

## 1. PC PostgreSQL 버전 확인과 DB 백업

PC에서 PostgreSQL 설치 경로의 버전을 실제 값으로 바꿉니다.

```powershell
& 'C:\Program Files\PostgreSQL\16\bin\psql.exe' -h 127.0.0.1 -U postgres -d company_manager -c 'SHOW server_version;'
```

PC가 16 이하이면 서버 16.15, PC가 17이면 서버 17.11을 선택합니다.
PC가 18 이상이거나 같은 메이저의 더 최신 마이너 버전을 쓰면 실행 전에 서버 버전과 빌드 스크립트를 검토하세요.
백업 도구는 PC PostgreSQL 서버보다 낮은 메이저 버전을 사용하지 않습니다.
한국어/한글 정렬은 원본 Windows DB와 서버의 locale 차이로 달라질 수 있으므로 목록 순서도 확인하세요.

최종 이전 백업은 PC 프로그램 사용을 중단한 뒤 진행합니다. 이전 검증이 끝날 때까지 데이터를 수정하지 않습니다.
PC의 프로젝트 폴더에서:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\rocky9\backup-windows.ps1 -PgBin 'C:\Program Files\PostgreSQL\16\bin'
```

`company_manager.dump`가 생성됩니다. 기존 사용자, 비밀번호 해시, 사이트 및 이력이 포함됩니다.
덤프 파일과 실제 엑셀, 환경변수는 GitHub에 업로드하지 않습니다.

## 2. 서버에서 소스 받기와 모든 프로그램 설치

```bash
sudo dnf install -y git
sudo git clone https://github.com/monkyd80/brainz.git /opt/brainz
cd /opt/brainz
sudo bash deploy/native-rocky9/install.sh 16.15
```

원본 DB가 PostgreSQL 17이면 마지막 인자를 `17.11`로 바꿉니다.
이미 `/opt/brainz`가 있으면 새 clone 대신 기존 체크아웃 내용과 배포 방식부터 확인합니다.
Docker 방식이 이미 실행 중이면 직접 설치를 겹쳐 진행하지 마세요.
설치 스크립트는 기존 PostgreSQL 런타임/데이터가 있으면 재설치를 거부합니다.
컴파일 중 실패하면 로그를 확인하세요. PostgreSQL 설치가 완료된 상태에 설치 스크립트를 다시 실행하지 않습니다.
호스트 패키지 충돌이나 기존 데이터 삭제를 자동으로 해결하지 않습니다.

## 3. 새 DB 계정과 서버 환경 생성

```bash
cd /opt/brainz
sudo bash deploy/native-rocky9/init.sh 192.168.0.50
```

DB 비밀번호와 Django 비밀키를 자동 생성합니다. 기존 환경파일을 덮어쓰지 않습니다.
앱 DB 계정 `brainz_app`은 DB 소유자이며 PostgreSQL 슈퍼유저가 아닙니다.
만약 DB 계정 생성에서 실패했다면 환경파일과 DB 상태를 확인하고 복구한 뒤 계속하세요.
기존 환경파일을 삭제해서 초기화 스크립트를 무조건 재실행하지 마세요.

## 4. PC 백업과 양식 전송

PC PowerShell에서:

```powershell
scp .\company_manager.dump admin@192.168.0.50:/tmp/company_manager.dump
scp .\sample_kdy.xls admin@192.168.0.50:/tmp/sample_kdy.xls
```

리눅스 서버에서:

```bash
sudo install -m 600 /tmp/company_manager.dump /var/backups/brainz/company_manager.dump
sudo install -m 644 /tmp/sample_kdy.xls /opt/brainz/sample_kdy.xls
sudo rm /tmp/company_manager.dump /tmp/sample_kdy.xls
```

양식 파일이 없다면 해당 파일의 전송/설치를 생략할 수 있으나 양식 다운로드 기능은 동작하지 않습니다.

## 5. DB 복원 후 앱 설치·빌드·서비스 등록

**기존 DB를 옮길 때는 복원을 먼저 합니다.**

```bash
cd /opt/brainz
sudo bash deploy/native-rocky9/restore-db.sh /var/backups/brainz/company_manager.dump
sudo bash deploy/native-rocky9/deploy.sh
```

restore-db.sh는 DB에 기존 테이블이 있으면 거부하며, 전체 복원을 하나의 트랜잭션으로 처리합니다.
deploy.sh는 Python 가상환경 및 Gunicorn 설치, migrate, 정적 파일 수집, Next.js 설치/빌드,
Nginx 설정, systemd 서비스 등록, 로컬 HTTP 응답 확인까지 진행합니다.
사내 HTTP 구성에서는 Django의 HTTPS/HSTS/보안 쿠키 관련 배포 경고가 표시될 수 있습니다.
역프록시 설정과 서비스 시작 여부는 검사하지만 실제 데이터의 완전성은 다음 단계에서 확인해야 합니다.

기존 PC DB를 복원하면 관리자 계정을 다시 생성할 필요가 없습니다.
신규 빈 DB로 시작할 때만 복원을 생략하고 다음 방법으로 계정을 생성합니다:

```bash
sudo bash -c 'set -a; source /etc/brainz/brainz.env; set +a; cd /opt/brainz; runuser -u brainz -- .venv/bin/python backend/manage.py createsuperuser'
```

## 6. 사내 접속 대역의 방화벽 허용

아래는 firewalld가 이미 실행 중이고 서버 인터페이스가 사용하는 zone이 `public`인 예시입니다.
먼저 `sudo firewall-cmd --get-active-zones`로 실제 zone을 확인하고 `public`을 바꾸세요.
`192.168.0.0/24`도 실제 사내 사용자 대역으로 바꿉니다.

```bash
sudo firewall-cmd --get-active-zones
sudo firewall-cmd --zone=public --permanent --add-rich-rule='rule family="ipv4" source address="192.168.0.0/24" port port="8080" protocol="tcp" accept'
sudo firewall-cmd --reload
```

firewalld가 중지되어 있다면 SSH 허용 규칙과 네트워크 방화벽 구성을 먼저 확인하고 시작하세요.
설치 스크립트는 원격 SSH 접속을 끊지 않도록 firewalld 시작이나 포트 공개를 자동 수행하지 않습니다.
상위 네트워크 방화벽이 있다면 동일하게 사내 사용자 대역에서 서버 TCP 8080을 허용해야 합니다.
PostgreSQL 5432, Django 8000, Next.js 3000은 사내에 개방할 필요가 없습니다.
Rocky 기본 Nginx의 테스트 페이지가 80 포트에 존재할 수 있습니다. 업무 서비스 주소는 8080입니다.

## 7. 검증과 운영

PC에서 `http://192.168.0.50:8080`에 접속하여 로그인, 사이트 수/내용, 담당자 배정, 이력,
등록/수정, 선택 항목, 엑셀 업로드, 양식 다운로드를 검증합니다.
기존 계정/비밀번호로 다시 로그인합니다. 검증 후 직원에게 새 주소를 안내합니다.

```bash
sudo systemctl status brainz-postgresql brainz-backend brainz-frontend nginx --no-pager
sudo journalctl -u brainz-backend -u brainz-frontend -n 100 --no-pager
sudo bash /opt/brainz/deploy/native-rocky9/backup-db.sh
```

DB 백업은 `/var/backups/brainz`에 생성됩니다. 환경파일 `/etc/brainz/brainz.env`와
양식 `/opt/brainz/sample_kdy.xls`도 별도로 보관하세요. 백업을 다른 장비에도 복사하고 용량을 관리합니다.
자동 백업 예시:

```bash
sudo dnf install -y cronie
sudo systemctl enable --now crond
timedatectl
# 필요 시: sudo timedatectl set-timezone Asia/Seoul
sudo crontab -e
```

root crontab에 추가합니다. 서버 시간대가 Asia/Seoul일 때 매일 새벽 2시입니다:

```cron
0 2 * * * /bin/bash /opt/brainz/deploy/native-rocky9/backup-db.sh >> /var/log/brainz-backup.log 2>&1
```

소스 업데이트는 사용을 중단하고 DB 백업 후 실행합니다:

```bash
sudo bash /opt/brainz/deploy/native-rocky9/backup-db.sh
sudo systemctl stop brainz-backend brainz-frontend
sudo git -C /opt/brainz pull --ff-only
sudo bash /opt/brainz/deploy/native-rocky9/deploy.sh
```

Python/PostgreSQL/Node 업데이트는 앱 소스 업데이트와 별개입니다. 특히 PostgreSQL 메이저 버전은
기존 데이터 디렉터리를 그대로 연결해서 변경하면 안 됩니다. 새 DB에 백업/복원하는 별도 이전이 필요합니다.
원본 PC DB는 이전 검증 완료 후에도 백업으로 보관합니다.

## 참고 및 검증 범위

- [Python 3.12.15 공식 소스 및 SHA-256](https://www.python.org/downloads/release/python-31215/)
- [PostgreSQL 소스 설치](https://www.postgresql.org/docs/16/installation.html)
- [PostgreSQL RPM 지원 OS 설명](https://www.postgresql.org/download/linux/redhat/)
- [Red Hat Nginx 프록시 및 SELinux](https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/9/epub/deploying_web_servers_and_reverse_proxies/configuring-nginx-as-a-reverse-proxy-for-the-http-traffic_setting-up-and-configuring-nginx)

이 스크립트는 Windows 작업 환경에서 작성했으며 실제 Rocky 9.2 설치, 컴파일, SELinux 실행 및
사용자의 실제 DB 복원은 아직 실행하지 않았습니다. 서버에서 단계별 결과를 확인하면서 진행하세요.
