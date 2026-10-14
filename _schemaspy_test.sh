#!/bin/bash
cd /opt/fastapi/smetadoma05
echo '=== health ==='
curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8008/health
echo ' health'
echo '=== status without auth ==='
curl -s -w '\nHTTP:%{http_code}\n' http://127.0.0.1:8008/api/dev/schemaspy/status
echo '=== login ==='
curl -s -X POST http://127.0.0.1:8008/api/auth/login -H 'Content-Type: application/json' -d '{"login":"admin","password":"admin"}' | head -c 300
echo
TOKEN=$(curl -s -X POST http://127.0.0.1:8008/api/auth/login -H 'Content-Type: application/json' -d '{"login":"admin","password":"admin"}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))")
if [ -n "$TOKEN" ]; then
  echo '=== status with token ==='
  curl -s -w '\nHTTP:%{http_code}\n' -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8008/api/dev/schemaspy/status
  echo '=== generate ==='
  curl -s -w '\nHTTP:%{http_code}\n' -X POST -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8008/api/dev/schemaspy/generate | head -c 500
  echo
else
  echo 'TOKEN empty - skipping authed calls'
fi
echo '=== openapi schemaspy paths ==='
curl -s http://127.0.0.1:8008/openapi.json | python3 -c "import sys,json; d=json.load(sys.stdin); print([p for p in d.get('paths',{}) if 'schemaspy' in p])"
