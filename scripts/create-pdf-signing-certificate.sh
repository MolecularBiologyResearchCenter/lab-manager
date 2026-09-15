#!/usr/bin/env bash
set -euo pipefail

output_dir="${1:-.pdf-signing}"
mkdir -p "$output_dir"

if ! command -v openssl >/dev/null 2>&1; then
  echo "opensslが必要です。macOSでは通常、標準で利用できます。" >&2
  exit 1
fi

key_file="$output_dir/pdf-signing.key"
cert_file="$output_dir/pdf-signing.crt"
p12_file="$output_dir/certificate.p12"

if [[ -e "$key_file" || -e "$cert_file" || -e "$p12_file" ]]; then
  echo "出力先に既存ファイルがあります: $output_dir" >&2
  echo "別の出力先を指定するか、内容を確認してから再実行してください。" >&2
  exit 1
fi

read -r -s -p "新しい証明書のパスフレーズ: " passphrase
echo
read -r -s -p "パスフレーズ（確認）: " passphrase_confirm
echo

if [[ -z "$passphrase" || "$passphrase" != "$passphrase_confirm" ]]; then
  echo "パスフレーズが一致しないか、空です。" >&2
  exit 1
fi

openssl genrsa -out "$key_file" 2048 >/dev/null 2>&1
openssl req -new -x509 -key "$key_file" -out "$cert_file" -days 1095 \
  -subj "/C=JP/O=分子生物実験センター/OU=内部PDF署名/CN=Lab Manager PDF Signing" \
  >/dev/null 2>&1
openssl pkcs12 -export -out "$p12_file" -inkey "$key_file" -in "$cert_file" \
  -name "Lab Manager PDF Signing" -passout "pass:$passphrase" >/dev/null 2>&1

chmod 600 "$key_file" "$p12_file"
rm -f "$key_file" "$cert_file"

echo
echo "証明書を作成しました: $p12_file"
echo "次のコマンドでVercel用の値を作成できます。証明書や値は共有・GitHub登録しないでください。"
echo "base64 -i $p12_file | tr -d '\\n'"
