#!/bin/sh
set -e

if [ "${SKIP_PRISMA_MIGRATE:-false}" != "true" ]; then
  echo "Waiting for SQL Server..."
  for i in $(seq 1 60); do
    if /opt/mssql-tools18/bin/sqlcmd -S sqlserver -U sa -P "${MSSQL_SA_PASSWORD}" -C -Q "SELECT 1" >/dev/null 2>&1; then
      break
    fi
    if [ "$i" = 60 ]; then
      echo "SQL Server did not become ready." >&2
      exit 1
    fi
    sleep 2
  done

  echo "Ensuring fitness_db database exists..."
  /opt/mssql-tools18/bin/sqlcmd -S sqlserver -U sa -P "${MSSQL_SA_PASSWORD}" -C -Q "IF DB_ID(N'fitness_db') IS NULL CREATE DATABASE [fitness_db];"

  echo "Running database migrations..."
  npx prisma migrate deploy
fi

exec npm start
