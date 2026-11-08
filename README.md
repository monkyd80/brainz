# BRAINZ 사이트 관리

Django API, PostgreSQL, Next.js로 구성된 사이트 관리 서비스입니다.

## 실행

1. Python 가상환경을 만들고 의존성을 설치합니다.

   ```powershell
   python -m venv .venv
   .venv\Scripts\python.exe -m pip install -r backend/requirements.txt
   Copy-Item backend/.env.example backend/.env
   ```

2. PostgreSQL에 데이터베이스를 생성하고 `backend/.env`에 DB 연결 정보와 랜덤한 `DJANGO_SECRET_KEY`를 설정합니다.

3. DB 변경을 적용하고 관리자 계정을 생성합니다.

   ```powershell
   .venv\Scripts\python.exe backend/manage.py migrate
   .venv\Scripts\python.exe backend/manage.py createsuperuser --username brainz_admin
   ```

4. 프런트엔드 의존성을 설치합니다.

   ```powershell
   cd frontend
   npm ci
   ```

5. 프로젝트 루트의 `COM_MANAGE_start.bat`를 실행하거나 API와 웹 서버를 각각 실행합니다.

   ```powershell
   .venv\Scripts\python.exe backend/manage.py runserver 127.0.0.1:8000
   ```

   ```powershell
   cd frontend
   npm run dev
   ```

웹 주소는 `http://127.0.0.1:3000`입니다. 프런트엔드 API 주소는 `NEXT_PUBLIC_API_URL`로 변경할 수 있습니다.

## 관리 규칙

- 관리자 등록 사이트와 담당자가 없는 사이트는 `brainz` 계정에 할당합니다.
- 일반 사용자가 등록한 사이트는 등록자에게 할당됩니다. 사이트를 재할당하면 새 담당자의 담당 사이트 목록으로 이동합니다.
- 관리자는 모든 사이트를 수정할 수 있습니다. 일반 사용자는 자신에게 할당된 사이트 또는 지원인력 정·부에 본인 이름이 포함된 사이트를 수정할 수 있습니다.
- 로그인 계정의 이름은 사용자 관리에서 수정합니다.
- 사용자 삭제 시 해당 사용자에게 할당된 사이트는 보관 계정 `brainz`에 할당됩니다. `brainz`는 자신에게 할당된 사이트를 수정할 수 있습니다.
- `brainz`는 비밀번호 로그인이 차단되며 관리자 사용자 전환으로 접근합니다.
- `brainz`, `brainz_admin` 계정은 사용자 관리에서 삭제할 수 없습니다.
- 같은 사이트의 최신 현행화 엑셀은 날짜 비교와 사용자 확인 후 업데이트합니다. 기존 사용자 할당은 유지합니다.

## 제외된 로컬 데이터

사용자 비밀번호 목록, `.env`, DB 데이터, 실제 사이트 엑셀, 가상환경과 빌드 결과는 저장소에 포함하지 않습니다. 양식 다운로드에 필요한 `sample_kdy.xls`는 프로젝트 루트에 별도로 배치하세요.

일반 사용자는 계정에 등록된 이름, 사번, ID가 일치하면 로그인 화면에서 비밀번호를 초기화할 수 있습니다.

기존 PostgreSQL DB를 사용하는 Rocky Linux 9 앱 신규 설치는 [설치 안내](deploy/README.md)를 참고하세요.
