# This script starts the Outline server container ("Shadowbox").
# If you need to customize how the server is run, you can edit this script, then restart with:
#
#     "/opt/outline/persisted-state/start_container.sh"

set -eu

docker stop "shadowbox" 2> /dev/null || true
docker rm -f "shadowbox" 2> /dev/null || true

docker_command=(
  docker
  run
  -d
  --name "shadowbox" --restart always --net host

  # Used by Watchtower to know which containers to monitor.
  --label 'com.centurylinklabs.watchtower.enable=true'
  
  # Use log rotation. See https://docs.docker.com/config/containers/logging/configure/.
  --log-driver local

  # The state that is persisted across restarts.
  -v "/opt/outline/persisted-state:/opt/outline/persisted-state"
    
  # Where the container keeps its persistent state.
  -e "SB_STATE_DIR=/opt/outline/persisted-state"

  # Port number and path prefix used by the server manager API.
  -e "SB_API_PORT=1877"
  -e "SB_API_PREFIX=IQjHv0H8FZP_rdGSLJGAQQ"

  # Location of the API TLS certificate and key.
  -e "SB_CERTIFICATE_FILE=/opt/outline/persisted-state/shadowbox-selfsigned.crt"
  -e "SB_PRIVATE_KEY_FILE=/opt/outline/persisted-state/shadowbox-selfsigned.key"

  # Where to report metrics to, if opted-in.
  -e "SB_METRICS_URL="

  # The Outline server image to run.
  "quay.io/outline/shadowbox:stable"
)
"${docker_command[@]}"
