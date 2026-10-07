# Rocky Linux 9 앱 신규 설치 — 기존 PostgreSQL 사용

이미 PostgreSQL에 복원한 `manager` DB가 있는 서버용입니다.
Python 3.12.15, Node.js 22, Gunicorn, Next.js, Nginx와 앱 systemd 서비스를 설치합니다.
PostgreSQL 설치, DB/계정 생성, 백업 복원, DB 서비스 시작·중지 및 설정 변경은 하지 않습니다.
기존 Docker 배포와 DB 신규 설치 스크립트는 이 구성으로 교체했습니다.

## 실행

Rocky Linux 9(9.2 포함), sudo 권한, 인터넷 연결이 필요합니다.
실제 설치 및 SELinux 동작은 대상 서버에서 확인해야 합니다.

새로 소스를 받는 경우:

```bash
sudo dnf install -y git
sudo git clone https://github.com/monkyd80/brainz.git /opt/brainz
cd /opt/brainz
sudo bash deploy/native-rocky9/setup.sh 192.168.0.50 15432
```

이미 `/opt/brainz`에 소스를 받았다면 로컬 수정 여부를 확인하고:

```bash
sudo git -C /opt/brainz status --short
sudo git -C /opt/brainz pull --ff-only
cd /opt/brainz
sudo bash deploy/native-rocky9/setup.sh 192.168.0.50 15432
```

`192.168.0.50`은 사용자가 접속할 서버의 실제 IPv4로, `15432`는 기존 DB 포트로 바꾸세요.
입력 질문에서 DB 호스트 기본값은 `127.0.0.1`, DB 이름은 `manager`, DB 계정은 `brainz`입니다.
Enter로 기본값을 선택하고 기존 DB 비밀번호를 입력합니다. 비밀번호는 화면과 명령 인자에 표시되지 않습니다.

앱 포트까지 변경하는 전체 명령:

```bash
sudo bash deploy/native-rocky9/setup.sh 서버IPv4 DB포트 웹포트 백엔드포트 프런트엔드포트
# 예: sudo bash deploy/native-rocky9/setup.sh 192.168.0.50 15432 8080 18000 13000
```

기본 접속 주소는 `http://서버IPv4:8080`입니다.
백엔드는 localhost:18000, 프런트엔드는 localhost:13000으로 외부에 직접 공개하지 않습니다.
신규 설치 시 앱 포트를 다른 서비스가 사용 중이면 중단합니다.
DB 포트는 이미 사용 중인 것이 정상입니다.

## 설치 진행과 기존 데이터

1. 시스템 Python/Node 경로와 별개로 `/opt/brainz-runtime`에 런타임을 설치합니다.
2. 비밀번호 및 연결 설정을 `/etc/brainz/brainz.env`에 저장합니다(root와 brainz 그룹만 읽기).
3. Python 의존성을 설치하고 기존 DB 접속 및 복원된 `django_migrations` 테이블을 확인합니다.
4. 앱의 필요한 Django 마이그레이션을 기존 `manager` DB에 적용합니다.
5. 정적 파일 수집과 Next.js 빌드를 수행하고 서비스를 등록·시작합니다.
6. 홈페이지와 관리자 로그인 페이지의 HTTP 응답을 확인합니다.

**앱 마이그레이션은 연결한 DB의 스키마 및 앱 데이터에 변경을 적용할 수 있습니다.**
배포 직전 기존 DB를 백업하고, DB 이름을 정확히 입력하세요.
다른 서비스의 DB나 PostgreSQL 설정은 변경하지 않습니다.
기존 사용자/관리자 계정은 복원한 DB의 계정을 그대로 사용합니다.

Nginx는 `/etc/nginx/conf.d/brainz.conf`를 추가하며 기존 다른 사이트 파일은 유지합니다.
Nginx 전체 설정 검사 후 reload하므로, 기존 Nginx 설정에도 오류가 없어야 합니다.
SELinux는 유지하며 Nginx 프록시·정적 파일·웹 포트에 필요한 정책을 설정합니다.
`dnf upgrade`는 실행하지 않지만 패키지 설치에 따른 의존성 업데이트는 발생할 수 있습니다.
Python은 소스 빌드이므로 시간이 걸립니다. Python/Node 보안 업데이트는 별도로 관리하세요.

양식 다운로드를 사용하려면 실제 `sample_kdy.xls`를 `/opt/brainz/sample_kdy.xls`에 따로 배치하세요.
이 파일과 DB 백업, 비밀번호는 GitHub에 올리지 않습니다.

## 실패 후 재개 및 업데이트

`setup.sh`는 기존 BRAINZ 환경이나 서비스 설정을 덮어쓰지 않습니다.
런타임 설치만 완료됐다면 `init.sh`와 `deploy.sh`를 순서대로 실행합니다.
환경파일까지 생성됐다면 접속 설정을 확인한 뒤 `deploy.sh`만 실행합니다.

```bash
sudo bash /opt/brainz/deploy/native-rocky9/init.sh 192.168.0.50 15432
sudo bash /opt/brainz/deploy/native-rocky9/deploy.sh
```

환경파일은 Bash 형식입니다. 특수문자가 있는 비밀번호를 수정할 때 Bash 인용 규칙을 유지하세요.
비밀번호를 포함한 파일 내용을 공유하지 마세요.

앱 업데이트는 DB를 백업하고 사용을 중단한 뒤:

```bash
sudo git -C /opt/brainz pull --ff-only
sudo bash /opt/brainz/deploy/native-rocky9/deploy.sh
```

`deploy.sh`는 BRAINZ 앱 서비스만 중지·시작합니다. 실패하면 앱이 중지된 상태일 수 있습니다.
기존 PostgreSQL 서비스는 계속 운영됩니다.

## 방화벽과 점검

방화벽은 SSH 접속과 기존 서비스를 보호하기 위해 자동 변경하지 않습니다.
firewalld가 실행 중이라면 실제 zone과 사내 접속 대역에 맞춰 웹 포트만 허용하세요.

```bash
sudo firewall-cmd --get-active-zones
sudo firewall-cmd --zone=public --permanent --add-rich-rule='rule family="ipv4" source address="192.168.0.0/24" port port="8080" protocol="tcp" accept'
sudo firewall-cmd --reload
sudo systemctl status brainz-backend brainz-frontend nginx --no-pager
sudo journalctl -u brainz-backend -u brainz-frontend -n 100 --no-pager
```

기존 DB가 다른 호스트에 있다면 기존 서버에서 앱 호스트의 DB 접속을 허용해야 합니다.
로그인, 사이트/담당자/이력, 등록·수정, 엑셀 업로드와 양식 다운로드를 실제 화면에서 확인하세요.

## 검증 범위와 참고

저장소의 Bash 문법과 설정·기존 DB 제외 경로를 검사했습니다.
Windows 개발 환경이므로 Rocky Linux 실제 패키지 설치, 컴파일, DB 접속 및 서비스 기동은 실행하지 않았습니다.

- [Python 3.12.15 공식 소스 및 체크섬](https://www.python.org/downloads/release/python-31215/)
- [Red Hat Nginx 및 SELinux 설정](https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/9/html/deploying_web_servers_and_reverse_proxies/setting-up-and-configuring-nginx_deploying-web-servers-and-reverse-proxies)
