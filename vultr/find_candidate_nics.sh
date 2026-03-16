#!/bin/bash

udevadm settle > /dev/null 2>&1 || :

interfaces=()
for iface in /sys/class/net/*; do
	if [[ "${iface##*/}" =~ ^lo$ ]]; then
		continue
	fi

	iface_path="$(realpath "${iface}")"
	driver="$(readlink "${iface_path}/device/driver")"
	if [[ "${driver##*/}" =~ ^(rndis_host)$ ]]; then
		continue
	fi

	interfaces+=("${iface##*/}")
done

printf '%s\n' "${interfaces[@]}"
