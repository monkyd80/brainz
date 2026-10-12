# 기존 DB를 사용하는 Rocky Linux 9 앱 설치

배포 파일은 **`install.sh` 하나**입니다. 이전 `native-rocky9` 설치 파일은 삭제했습니다.
이미 복원된 PostgreSQL DB에 연결하여 Python 3.12, Node.js 22, Nginx, Django/Gunicorn, Next.js를 설치합니다.
PostgreSQL 설치, DB·계정 생성, DB 복원 및 DB 서비스 재시작은 하지 않습니다.

## 실행

Rocky Linux 9, sudo 권한, 인터넷 연결이 필요합니다. 서버 IP를 실제 값으로 바꾸세요.

DB만 있는 서버에서는 설치 파일 하나를 받아 실행합니다. 아래 IP를 실제 서버 IP로 바꾸세요.
`/opt/brainz`는 미리 만들 필요가 없습니다. 스크립트가 Git을 설치하고 GitHub 소스를 받아 자동 생성합니다.

```bash
curl -fL https://raw.githubusercontent.com/monkyd80/brainz/main/deploy/install.sh -o /tmp/brainz-install.sh
sudo bash /tmp/brainz-install.sh 192.168.0.50 15432
```

서버에 curl이 없다면 먼저 `sudo dnf install -y curl`을 실행하세요.
PC의 `Backup/install.sh`를 서버에 복사하여 `sudo bash install.sh 서버IP 15432`로 실행해도 됩니다.

이미 소스를 받았다면 로컬 수정 여부를 확인하고 최신 소스를 받습니다. 스크립트는 기존 소스를 자동으로 갱신하거나 덮어쓰지 않습니다:

```bash
sudo git -C /opt/brainz status --short
sudo git -C /opt/brainz pull --ff-only
cd /opt/brainz
sudo bash deploy/install.sh 192.168.0.50 15432
```

질문에서 DB 호스트는 `127.0.0.1`, DB 이름은 `manager`, DB 사용자는 `brainz`가 기본값입니다.
Enter로 기본값을 선택한 뒤 기존 DB 비밀번호를 입력합니다. 비밀번호는 화면에 표시되지 않습니다.
DB 포트는 명령의 `15432`를 실제 포트로 바꾸세요.

앱 포트까지 지정하는 형식:

```bash
sudo bash deploy/install.sh 서버IPv4 DB포트 웹포트 백엔드포트 프런트엔드포트
# 예: sudo bash deploy/install.sh 192.168.0.50 15432 8080 18000 13000
```

기본 접속 주소는 **`http://서버IP:8080`**입니다.
백엔드 `127.0.0.1:18000`, 프런트엔드 `127.0.0.1:13000`은 Nginx를 통해 연결합니다.
다른 서비스가 앱 포트를 사용하면 설치를 중단합니다.

## 진행 내용과 재실행

- 런타임은 `/opt/brainz-runtime`에 설치하며 시스템 기본 Python/Node 경로를 교체하지 않습니다.
- DB 연결 설정은 `/etc/brainz/brainz.env`에 Bash 형식으로 저장합니다.
- 기존 DB 접속과 복원된 앱의 `django_migrations` 테이블을 확인합니다.
- **Django 마이그레이션은 연결한 DB에 적용합니다.** 설치 전에 해당 DB를 백업하세요.
- 앱 빌드, 정적 파일 수집, systemd 등록, Nginx 설정 및 HTTP 응답 확인을 진행합니다.
- 실행용 파일은 스크립트가 `/etc/brainz/run-backend.sh`, `run-frontend.sh`에 자동 생성합니다.

실패 후 재개와 앱 업데이트도 **같은 `install.sh` 명령**을 사용합니다.
이미 생성된 환경파일과 설치된 런타임은 재사용합니다.
저장된 설정과 명령 인자의 IP/포트가 다르면 중단합니다. 변경하려면 환경파일을 먼저 수정하세요.
환경파일의 비밀번호는 Bash 인용 규칙을 유지해야 하며 파일 내용을 공유하지 마세요.

이전 버전의 BRAINZ 서비스가 실행 중이어도 이 스크립트로 같은 설정의 배포를 갱신할 수 있습니다.
저장소에서 파일을 삭제하는 것은 서버의 기존 DB나 서비스를 삭제하는 작업이 아닙니다.
배포 중 BRAINZ 앱 서비스는 중지·재시작되며 실패하면 중지 상태일 수 있습니다.

Nginx의 다른 사이트 설정은 유지하고 `/etc/nginx/conf.d/brainz.conf`만 생성·갱신합니다.
전체 Nginx 설정 검사 후 reload합니다. SELinux는 프록시·정적 파일·웹 포트 정책을 설정합니다.
패키지 설치 시 의존성 업데이트가 발생할 수 있으며, 전체 OS 업그레이드는 실행하지 않습니다.
런타임 보안 업데이트는 별도로 관리해야 합니다.

양식 다운로드를 사용하려면 `sample_kdy.xls`를 `/opt/brainz/sample_kdy.xls`에 별도로 배치하세요.
복원된 DB의 기존 사용자 계정을 그대로 사용합니다.

## 접속 및 점검

방화벽은 자동 변경하지 않습니다. firewalld 사용 시 실제 zone·사내 대역에 맞춰 웹 포트를 허용하세요.

```bash
sudo firewall-cmd --get-active-zones
sudo firewall-cmd --zone=public --permanent --add-rich-rule='rule family="ipv4" source address="192.168.0.0/24" port port="8080" protocol="tcp" accept'
sudo firewall-cmd --reload
sudo systemctl status brainz-backend brainz-frontend nginx --no-pager
sudo journalctl -u brainz-backend -u brainz-frontend -n 100 --no-pager
```

로그인, 사이트·담당자·이력, 등록·수정, 엑셀 업로드와 양식 다운로드를 확인하세요.
DB가 다른 호스트에 있다면 앱 서버의 접속을 허용하는 기존 DB 서버 설정이 필요합니다.

Bash 문법 및 주요 분기 검사를 수행했습니다. 실제 Rocky 서버의 패키지 설치·빌드·서비스 기동은 검증하지 않았습니다.
