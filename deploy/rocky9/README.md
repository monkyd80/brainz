# Rocky Linux 9.2 서버 이전 안내

이 배포는 Docker Compose로 PostgreSQL, Django/Gunicorn, Next.js, Nginx를 실행합니다.
서버 호스트에 PostgreSQL/Python/Node.js를 별도로 설치하지 않습니다.
PC의 DB는 덤프 파일로 이전하고 서버 DB는 `brainz_pgdata` Docker 영구 볼륨에 저장합니다.
외부에 공개되는 포트는 지정한 서버 IP의 8080 하나이며 DB 5432, API 8000, 웹 3000은 공개하지 않습니다.
서버 재부팅 시 Docker와 서비스가 자동 시작합니다.

## 준비와 전제

- root 또는 sudo 권한, 고정 사내 IPv4 주소, 인터넷 연결이 필요합니다.
- GitHub, download.docker.com, Docker Hub, PyPI, npm registry 접근이 필요합니다.
- 예시는 서버 `192.168.0.50`, SSH 계정 `admin`, 설치 폴더 `/opt/brainz`입니다. 실제 값으로 바꾸세요.
- 8080 포트를 사용 중인 서비스가 없는지 `sudo ss -lntp`로 확인합니다.
- Rocky 9.2의 기본 런타임 차이를 피하기 위해 Python 3.12/Node 22 컨테이너를 사용합니다.
- 운영 전 최신 Rocky 9 보안 업데이트를 권장합니다. `dnf upgrade`는 9.2에서 최신 9.x로 올릴 수 있으므로 이 스크립트는 자동 업그레이드하지 않습니다.
- Docker 설치 스크립트는 기존 Podman/runc 등을 강제로 삭제하지 않습니다. 충돌이 발생하면 기존 서버 용도를 확인한 뒤 해결하세요.
- 제공 구성은 사내 HTTP 접속용입니다. HTTPS가 필요하면 사내 인증서와 Nginx TLS 설정을 추가하고 `FRONTEND_URL`, CSRF/CORS origin, `DJANGO_COOKIE_SECURE`를 HTTPS에 맞춰 변경하세요.
- Docker 포트 게시에는 Docker 방화벽 규칙도 적용됩니다. 사내 IP에 바인딩하고 네트워크 방화벽에서 사내 사용자 대역만 허용하세요. firewalld 서비스 허용 목록만으로 Docker 공개 포트 접근 제한이 보장되지는 않습니다.

## 1. PC의 DB 버전 확인 및 백업

PC에서 PostgreSQL 실행 파일 위치를 확인합니다. 아래 `16`은 설치된 버전으로 바꿉니다.

```powershell
& 'C:\Program Files\PostgreSQL\16\bin\psql.exe' -h 127.0.0.1 -U postgres -d company_manager -c 'SHOW server_version;'
```

서버 PostgreSQL은 원본과 같은 메이저 버전 또는 더 높은 버전을 선택하세요.
제공 스크립트는 16 또는 17을 지원합니다. 원본이 18 이상이면 실행 전에 이미지와 데이터 경로를 검토해야 합니다.
백업 도구는 원본 서버보다 낮은 메이저 버전을 사용하면 안 됩니다. 서로 다른 버전 이전은 먼저 시험 복원하세요.

최종 백업 직전 PC 프로그램 사용을 중단하고 이전 완료까지 수정하지 않습니다.
PowerShell에서 프로젝트 폴더로 이동한 뒤 실행합니다. 비밀번호는 도구가 요청할 때 입력합니다.

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\rocky9\backup-windows.ps1 -PgBin 'C:\Program Files\PostgreSQL\16\bin'
```

`company_manager.dump`가 생성됩니다. 사용자/비밀번호 해시, 사이트, 담당자, 이력 등 DB 내용이 포함됩니다.
DB 계정 및 비밀번호는 원본 PostgreSQL 서버의 계정을 복사하지 않고 서버에서 새로 생성합니다.
덤프 파일, `.env` 및 실제 업무 엑셀은 GitHub에 올리지 않습니다.

## 2. 서버에 소스 받기 및 Docker 설치

아래는 새 `/opt/brainz` 폴더를 사용하는 최초 설치 예시입니다. 이미 폴더가 있으면 기존 내용을 확인하세요.

```bash
sudo dnf install -y git
sudo git clone https://github.com/monkyd80/brainz.git /opt/brainz
cd /opt/brainz
sudo bash deploy/rocky9/install-docker.sh
```

비공개 저장소는 GitHub SSH 키 또는 인증 설정이 필요합니다. 토큰을 명령줄 URL에 넣지 마세요.
명령에 지정한 배포 파일이 없으면 아직 해당 커밋을 받지 않은 상태입니다. 최신 배포 커밋을 먼저 받으세요.
SELinux를 끄지 않습니다. 필요한 설정 파일 및 양식 폴더 마운트에는 `:Z` 레이블 처리가 적용됩니다.

## 3. 서버 환경 설정

원본 PostgreSQL이 16 이하인 경우:

```bash
cd /opt/brainz
sudo bash deploy/rocky9/init-env.sh 192.168.0.50 16 8080
```

원본이 17이면 인자를 `17`로 지정합니다. `.env`는 DB 비밀번호와 Django 키를 무작위로 생성하며 기존 파일은 덮어쓰지 않습니다.
접속 주소는 `http://192.168.0.50:8080`입니다. 도메인으로 접속할 경우 `.env`의
`DJANGO_ALLOWED_HOSTS`에는 도메인도 추가하고 `FRONTEND_URL`, CSRF/CORS origin을 실제 접속 URL로 변경하세요.
메일 재설정이 필요하면 기존 SMTP 설정도 `.env`에 넣습니다. SMTP 미설정 시 메일 재설정은 사용할 수 없습니다.

## 4. 백업과 양식 파일 전송

PC PowerShell에서 실행합니다. 서버에 `/tmp`로 전송한 뒤 root만 읽는 위치로 옮깁니다.

```powershell
scp .\company_manager.dump admin@192.168.0.50:/tmp/company_manager.dump
scp .\sample_kdy.xls admin@192.168.0.50:/tmp/sample_kdy.xls
```

서버에서:

```bash
sudo install -m 600 /tmp/company_manager.dump /opt/brainz/deploy/rocky9/backups/company_manager.dump
sudo install -m 644 /tmp/sample_kdy.xls /opt/brainz/deploy/rocky9/assets/sample_kdy.xls
sudo rm /tmp/company_manager.dump /tmp/sample_kdy.xls
```

`sample_kdy.xls`가 없다면 양식 다운로드를 제외한 서비스는 사용할 수 있습니다.
복원에 사용할 덤프는 보관 중 원본이 변경되지 않도록 관리합니다.

## 5. DB 복원 후 서비스 시작 — 순서 중요

**기존 PC DB를 이전할 때는 반드시 복원을 먼저 하고 start.sh를 실행합니다.**
start.sh를 먼저 실행하면 빈 DB에 테이블이 생성되어 복원 스크립트가 거부합니다.

```bash
cd /opt/brainz
sudo bash deploy/rocky9/restore-db.sh /opt/brainz/deploy/rocky9/backups/company_manager.dump
sudo bash deploy/rocky9/start.sh
```

복원 스크립트는 빈 DB만 허용하며 전체 복원을 하나의 트랜잭션으로 수행합니다.
기존 데이터가 있으면 중단합니다. 실패했을 때 DB 볼륨을 삭제하지 말고 오류를 먼저 확인하세요.
이미 앱이 실행 중이면 다른 사용자의 접속과 변경을 중단한 뒤 복원하세요.
start.sh는 이미지 빌드, migrate, 정적 파일 수집, Django 배포 검사, 서비스 기동을 순서대로 수행합니다.
HTTP 구성에서는 HTTPS/HSTS/보안 쿠키 관련 Django 경고가 표시될 수 있습니다. 오류는 해결 후 재실행하세요.
컨테이너 기동 완료는 데이터 이전 검증 완료를 뜻하지 않습니다. 다음 단계에서 실제 화면 기능을 확인하세요.

기존 DB 없이 새로 시작하는 경우에만 restore-db.sh를 생략하고 start.sh 후 관리자 계정을 만듭니다:

```bash
cd /opt/brainz/deploy/rocky9
sudo docker compose exec backend python manage.py createsuperuser
```

## 6. 사내 접속 확인 및 전환

서버에서 아래 주소를 확인합니다:

```bash
curl -I http://192.168.0.50:8080/
cd /opt/brainz/deploy/rocky9
sudo docker compose ps
sudo docker compose logs --tail=100 backend frontend nginx
```

PC 브라우저에서 `http://192.168.0.50:8080`에 접속합니다.
로그인, 사이트 수/내용, 사용자 담당 사이트, 변경 이력, 등록/수정,
선택 항목 로딩, 엑셀 가져오기 및 양식 다운로드를 확인하세요.
이전한 사용자 계정과 비밀번호는 그대로 사용합니다. 브라우저에서 새 주소에 다시 로그인합니다.
문제가 없으면 사내 사용자에게 새 주소를 안내하고 PC 원본 DB는 검증 완료 후에도 백업으로 보관합니다.

## 7. 백업·운영·업데이트

```bash
sudo bash /opt/brainz/deploy/rocky9/backup-db.sh
```

덤프는 `deploy/rocky9/backups/`에 저장됩니다. `.env`와 `assets/sample_kdy.xls`도 별도로 안전하게 백업하세요.
서버 장애에 대비해 덤프를 다른 장비에도 복사합니다. 자동 삭제는 하지 않으므로 저장 공간을 관리합니다.
매일 새벽 2시(KST) 예약 예시: 서버 시간대를 확인한 뒤 root crontab에 추가합니다.

```bash
timedatectl
# 필요 시: sudo timedatectl set-timezone Asia/Seoul
sudo crontab -e
```

```cron
0 2 * * * /bin/bash /opt/brainz/deploy/rocky9/backup-db.sh >> /var/log/brainz-backup.log 2>&1
```

서버에 cron이 없으면 먼저 `sudo dnf install -y cronie` 및 `sudo systemctl enable --now crond`를 실행합니다.

소스 업데이트는 변경 중 사용을 중단하고 DB 백업 후 진행합니다:

```bash
sudo bash /opt/brainz/deploy/rocky9/backup-db.sh
cd /opt/brainz/deploy/rocky9
sudo docker compose stop nginx backend frontend
sudo git -C /opt/brainz pull --ff-only
sudo bash /opt/brainz/deploy/rocky9/start.sh
```

`.env`의 POSTGRES_MAJOR를 기존 볼륨에 대해 변경하면 안 됩니다. 메이저 업그레이드는 별도 새 DB로 덤프/복원합니다.
초기 설치 후 POSTGRES_PASSWORD를 파일에서만 바꾸면 기존 DB 비밀번호는 변경되지 않습니다.
단순 재시작은 `sudo docker compose restart`를 사용합니다.
`docker compose down -v`는 DB 볼륨도 삭제하므로 사용하지 마세요.

## 참고 문서와 검증 범위

- [Rocky Linux 공식 Docker 설치](https://docs.rockylinux.org/gemstones/containers/docker/)
- [PostgreSQL pg_restore](https://www.postgresql.org/docs/current/app-pgrestore.html)
- [Next.js 환경변수](https://nextjs.org/docs/app/guides/environment-variables)

스크립트는 이 저장소의 경로·설정을 기준으로 작성했습니다. 실제 Rocky 서버와 Docker 실행 환경에서의
설치, 이미지 빌드 및 실제 데이터 복원 검증은 서버에서 수행해야 합니다.

배포 준비 중 Next.js를 16.3.8로 업데이트하고 source-map-js를 수정 버전으로 갱신했습니다.
운영 프런트엔드 이미지는 빌드 후 개발 의존성을 제거합니다. 개발 의존성의 나머지 npm audit 항목은 별도 점검 대상입니다.
