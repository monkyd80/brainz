# 2026-10-27 DB 변경 SQL

`20261027_site_updates.sql`은 PostgreSQL에서 다음 변경을 적용합니다.

- `com_lic`: Linux/Windows, UNIX, SNMP, ICMP, SDN, Oracle 수량 6개
- `com_attachment`: 추가정보파일 이름·용량·업로드 날짜·사이트·사용자
- `com_dashboard_image`: 대시보드 원본·작은 이미지·크기·형식·사이트·사용자

기존 DB의 `companies.0018_reconcile_unassigned_sites` 적용이 선행 조건입니다.
SQL은 0019~0021을 순서대로 적용하고 `django_migrations`에도 기록합니다.
이미 적용된 항목은 건너뛰므로 동일 파일을 다시 실행할 수 있습니다.
중간 오류가 나면 전체 변경이 롤백됩니다. 사이트·사용자·할당 데이터는 수정하지 않습니다.

## 실행

사용 중인 DB 접속 정보로 다음 명령을 실행합니다. 아래 접속값은 기존 Rocky 설치 문서의 예입니다.

```bash
psql -h 127.0.0.1 -p 15432 -U brainz -d manager -v ON_ERROR_STOP=1 -f deploy/sql/20261027_site_updates.sql
```

pgAdmin/DBeaver에서는 대상 DB에서 SQL 파일 전체를 실행할 수 있습니다.
소스의 Django 마이그레이션으로 0019~0021을 이미 적용한 DB에서는 SQL이 변경을 건너뜁니다.

앱 의존성에는 이미지 검증·작은 이미지 생성용 `Pillow==13.0.0`이 추가되었습니다.
소스 갱신 시 기존 가상환경에서 `python -m pip install -r backend/requirements.txt`로 반영합니다.
업로드 파일은 앱 서버의 `backend/uploads/`에 저장되며 DB에는 파일 경로와 메타데이터가 저장됩니다.
DB를 다른 서버로 옮길 때 이 디렉터리도 함께 복사합니다.
