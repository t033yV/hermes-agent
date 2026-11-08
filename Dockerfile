FROM nousresearch/hermes-agent:v0.22.5

RUN apt-get update && apt-get install -y --no-install-recommends s3fs fuse && rm -rf /var/lib/apt/lists/*

RUN printf '#!/bin/sh\n\
echo "$R2_ACCESS_KEY_ID:$R2_SECRET_ACCESS_KEY" > /tmp/.s3fs-cred\n\
chmod 600 /tmp/.s3fs-cred\n\
mkdir -p /opt/data\n\
s3fs hermes-data /opt/data \\\n\
  -o url=https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com \\\n\
  -o use_path_request_style \\\n\
  -o passwd_file=/tmp/.s3fs-cred \\\n\
  -o allow_other \\\n\
  -o umask=0002 \\\n\
  -o uid=10000 \\\n\
  -o gid=10000\n\
rm -f /tmp/.s3fs-cred\n\
' > /etc/cont-init.d/00-mount-r2 && chmod +x /etc/cont-init.d/00-mount-r2

CMD ["sleep", "infinity"]
