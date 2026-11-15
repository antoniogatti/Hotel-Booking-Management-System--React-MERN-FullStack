param(
  [Parameter(Mandatory = $true)][string]$Workbook,
  [Parameter(Mandatory = $true)][string]$EnvironmentFile,
  [Parameter(Mandatory = $true)][string]$Database,
  [string]$ApplySnapshot
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
$stream = [IO.File]::Open($Workbook, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite)
try {
  $memory = [IO.MemoryStream]::new()
  try { $stream.CopyTo($memory); $bytes = $memory.ToArray() } finally { $memory.Dispose() }
} finally { $stream.Dispose() }
$sha = [Security.Cryptography.SHA256]::Create()
try { $snapshot = ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant() } finally { $sha.Dispose() }
if ($ApplySnapshot -and $ApplySnapshot -ne $snapshot) { throw 'The source snapshot changed after the dry run.' }

$memory = [IO.MemoryStream]::new($bytes)
$zip = [IO.Compression.ZipArchive]::new($memory, [IO.Compression.ZipArchiveMode]::Read)
try {
  function Read-XmlEntry($name) {
    $entry = $zip.GetEntry($name)
    if (!$entry) { throw "Required workbook component is missing." }
    $reader = [IO.StreamReader]::new($entry.Open())
    try { return [xml]$reader.ReadToEnd() } finally { $reader.Dispose() }
  }
  $slash = [char]47
  $base = 'xl' + $slash
  $workbookXml = Read-XmlEntry ($base + 'workbook.xml')
  $relationships = Read-XmlEntry ($base + '_rels' + $slash + 'workbook.xml.rels')
  $stringsXml = Read-XmlEntry ($base + 'sharedStrings.xml')
  $strings = @($stringsXml.sst.si | ForEach-Object { ($_.SelectNodes(".//*[local-name()='t']") | ForEach-Object { $_.InnerText }) -join '' })
  $sheets = @{}
  foreach ($name in @('Ricavi', 'Costi')) {
    $sheet = @($workbookXml.workbook.sheets.sheet | Where-Object { $_.name -eq $name })
    if ($sheet.Count -ne 1) { throw 'A required worksheet is missing or ambiguous.' }
    $id = $sheet[0].GetAttribute('id', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')
    $relationship = @($relationships.Relationships.Relationship | Where-Object { $_.Id -eq $id })
    if ($relationship.Count -ne 1) { throw 'A worksheet relationship is missing or ambiguous.' }
    $target = $relationship[0].Target.TrimStart($slash)
    if (!$target.StartsWith('xl' + $slash)) { $target = $base + $target }
    $xml = Read-XmlEntry $target
    $rows = @()
    foreach ($row in $xml.worksheet.sheetData.row) {
      $cells = @{}
      $errors = @()
      foreach ($cell in @($row.c)) {
        $column = $cell.r -replace '\d', ''
        if ($cell.t -eq 'e') { $errors += $column; continue }
        $value = if ($cell.t -eq 's' -and $null -ne $cell.v) { $strings[[int]$cell.v] } elseif ($cell.t -eq 'inlineStr') { $cell.is.InnerText } else { $cell.v }
        if ($null -ne $value -and "$value" -ne '') { $cells[$column] = "$value" }
      }
      $rows += @{ row = [int]$row.r; cells = $cells; errors = $errors }
    }
    $sheets[$name] = $rows
  }
  $payload = @{ snapshot = $snapshot; sheets = $sheets } | ConvertTo-Json -Depth 10 -Compress
  $arguments = @((Join-Path $PSScriptRoot 'import-pnl.js'), $EnvironmentFile, $Database)
  if ($ApplySnapshot) { $arguments += @('--apply', $ApplySnapshot) }
  $payload | node @arguments
  if ($LASTEXITCODE -ne 0) { throw 'Import validation or execution failed.' }
} finally {
  $zip.Dispose()
  $memory.Dispose()
}
