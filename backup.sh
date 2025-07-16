#!/bin/bash
BACKUP_DIR="/volume1/backup/backoffice"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

echo "BackOffice 백업 시작... ($DATE)"

# 설정 파일 백업
tar -czf "$BACKUP_DIR/config_$DATE.tar.gz" \
    .env \
    ecosystem.config.js \
    package.json \
    package-lock.json

# 빌드 파일 백업
tar -czf "$BACKUP_DIR/build_$DATE.tar.gz" build/

# 소스 코드 백업
tar -czf "$BACKUP_DIR/src_$DATE.tar.gz" src/

echo "백업 완료: $BACKUP_DIR"
ls -la "$BACKUP_DIR"/*$DATE*
