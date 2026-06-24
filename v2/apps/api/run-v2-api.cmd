@echo off
cd /d C:\Users\PC\Desktop\YYCL\v2\apps\api
"C:\Program Files\nodejs\node.exe" dist\app.js >> runtime-logs\v2-api.out.log 2>> runtime-logs\v2-api.err.log
