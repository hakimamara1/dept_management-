; Best-effort Windows Firewall rules so the phone app can reach the desktop on the shop Wi-Fi.
; Private/domain networks only. This needs an elevated installer to take effect; if it runs without
; admin rights netsh fails silently (nsExec ignores it) and Windows instead shows its usual
; "allow access" prompt the first time mobile access is enabled — choose "Private networks".
!macro customInstall
  nsExec::Exec 'netsh advfirewall firewall delete rule name="Spice ERP (mobile access)"'
  nsExec::Exec 'netsh advfirewall firewall delete rule name="Spice ERP (mobile discovery)"'
  nsExec::Exec 'netsh advfirewall firewall add rule name="Spice ERP (mobile access)" dir=in action=allow program="$INSTDIR\${APP_EXECUTABLE_FILENAME}" enable=yes profile=private,domain protocol=tcp'
  nsExec::Exec 'netsh advfirewall firewall add rule name="Spice ERP (mobile discovery)" dir=in action=allow program="$INSTDIR\${APP_EXECUTABLE_FILENAME}" enable=yes profile=private,domain protocol=udp localport=5353'
!macroend

!macro customUnInstall
  nsExec::Exec 'netsh advfirewall firewall delete rule name="Spice ERP (mobile access)"'
  nsExec::Exec 'netsh advfirewall firewall delete rule name="Spice ERP (mobile discovery)"'
!macroend
