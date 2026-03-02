Get-Content app\page.tsx | Select-String -Pattern "grid " -Context 0 | Select-Object -First 20
