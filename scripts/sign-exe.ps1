# Signe xldiff.exe avec le certificat de signature de code « XLDiff »
# du magasin personnel de l'utilisateur (Cert:\CurrentUser\My).
#
# Le certificat est auto-signé (voir signing/xldiff-code-signing.cer pour
# la partie publique à approuver sur les postes). L'horodatage DigiCert
# permet à la signature de rester valable après expiration du certificat.
param(
  [string]$ExePath = (Join-Path $PSScriptRoot '..\src-tauri\target\release\xldiff.exe')
)

$ExePath = (Resolve-Path $ExePath).Path

$cert = Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert |
  Where-Object { $_.Subject -like '*XLDiff*' } |
  Sort-Object NotAfter -Descending |
  Select-Object -First 1
if (-not $cert) {
  throw "Certificat de signature XLDiff introuvable dans Cert:\CurrentUser\My (voir README, section Signature)."
}

$sig = Set-AuthenticodeSignature -FilePath $ExePath -Certificate $cert `
  -HashAlgorithm SHA256 -TimestampServer 'http://timestamp.digicert.com'

"Fichier   : $($sig.Path)"
"Statut    : $($sig.Status) — $($sig.StatusMessage)"
"Signataire: $($sig.SignerCertificate.Subject)"
if ($sig.TimeStamperCertificate) { "Horodatage: $($sig.TimeStamperCertificate.Subject)" }
