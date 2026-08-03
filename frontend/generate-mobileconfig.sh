#!/bin/bash
# 生成带有内嵌图标的 iOS Mobile Config
# 用法: bash generate-mobileconfig.sh [deployment-url]

URL="${1:-https://web.jmcomic.uk}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

ICON_B64=$(base64 -i logo180.png | tr -d '\n')

sed -e "s|https://web.jmcomic.uk|${URL}|g" \
    -e "s|REPLACE_WITH_LOGO180_BASE64|${ICON_B64}|g" \
    jmcomic3-pwa.template.mobileconfig > jmcomic3-pwa.mobileconfig

echo "Generated: jmcomic3-pwa.mobileconfig"
echo "Deployment URL: ${URL}"
echo ""
echo "部署方式:"
echo "  1. 上传 jmcomic3-pwa.mobileconfig 到你的服务器"
echo "  2. iOS 用户用 Safari 打开下载链接即可安装"
echo "  3. 直接链接: <a href=\"jmcomic3-pwa.mobileconfig\">安裝 JMComic3</a>"
