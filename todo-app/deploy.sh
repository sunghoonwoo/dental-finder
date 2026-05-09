#!/bin/bash
set -e

cd /Users/sunghoon/woo_project

GITHUB_USER="sunghoonwoo"
REPO_NAME="todo-app"

echo ""
echo "GitHub Personal Access Token을 입력하세요 (입력 내용은 보이지 않습니다):"
read -s TOKEN
echo ""

echo ">>> GitHub에 푸시 중..."
git remote set-url origin "https://${GITHUB_USER}:${TOKEN}@github.com/${GITHUB_USER}/${REPO_NAME}.git"
git push -u origin main

echo ">>> GitHub Pages 활성화 중..."
curl -s -o /dev/null -w "%{http_code}\n" \
  -X POST "https://api.github.com/repos/${GITHUB_USER}/${REPO_NAME}/pages" \
  -H "Authorization: token ${TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  -d '{"source":{"branch":"main","path":"/"}}'

echo ""
echo "완료! 1~2분 후 아래 URL에서 접속하세요:"
echo "https://${GITHUB_USER}.github.io/${REPO_NAME}"
