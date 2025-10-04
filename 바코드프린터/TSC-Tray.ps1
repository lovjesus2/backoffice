# Get current script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# Check certificate expiry
function Check-CertificateExpiry {
    if (Test-Path "localhost+2.pem") {
        try {
            $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2("localhost+2.pem")
            $daysLeft = ([DateTime]$cert.NotAfter - [DateTime]::Now).Days
            if ($daysLeft -lt 30) {
                return @{
                    Status = "Warning"
                    Message = "Certificate expires in $daysLeft days!"
                    DaysLeft = $daysLeft
                    ExpiryDate = $cert.NotAfter
                }
            } else {
                return @{
                    Status = "OK"
                    Message = "Certificate valid for $daysLeft days"
                    DaysLeft = $daysLeft
                    ExpiryDate = $cert.NotAfter
                }
            }
        } catch {
            return @{
                Status = "Error"
                Message = "Cannot read certificate"
                DaysLeft = 0
                ExpiryDate = $null
            }
        }
    } else {
        return @{
            Status = "Missing"
            Message = "Certificate file not found"
            DaysLeft = 0
            ExpiryDate = $null
        }
    }
}

$certInfo = Check-CertificateExpiry

# Start TSC server
$startInfo = New-Object System.Diagnostics.ProcessStartInfo
$startInfo.FileName = "node"
$startInfo.Arguments = "tsc-server.js"
$startInfo.WorkingDirectory = $scriptDir
$startInfo.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
$startInfo.CreateNoWindow = $true

try {
    $serverProcess = [System.Diagnostics.Process]::Start($startInfo)
    Write-Host "TSC Server started in: $scriptDir"
} catch {
    Write-Host "Failed to start TSC Server: $($_.Exception.Message)"
    exit 1
}

# Wait for server to start
Start-Sleep -Seconds 3

# Create tray icon
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$tray = New-Object System.Windows.Forms.NotifyIcon
$tray.Icon = [System.Drawing.SystemIcons]::Information  
$tray.Text = "TSC TTP-244 Pro Agent"
$tray.Visible = $true

# Create context menu
$menu = New-Object System.Windows.Forms.ContextMenuStrip

# Status
$status = New-Object System.Windows.Forms.ToolStripMenuItem
$status.Text = "TSC Agent Running"
$status.Enabled = $false
$menu.Items.Add($status)

# Certificate info
$certMenuItem = New-Object System.Windows.Forms.ToolStripMenuItem
if ($certInfo.Status -eq "OK") {
    $certMenuItem.Text = "Certificate: $($certInfo.DaysLeft) days left"
    $certMenuItem.ForeColor = [System.Drawing.Color]::Green
} elseif ($certInfo.Status -eq "Warning") {
    $certMenuItem.Text = "Certificate: $($certInfo.DaysLeft) days left!"
    $certMenuItem.ForeColor = [System.Drawing.Color]::Orange
} else {
    $certMenuItem.Text = "Certificate: $($certInfo.Message)"
    $certMenuItem.ForeColor = [System.Drawing.Color]::Red
}
$certMenuItem.Enabled = $false
$menu.Items.Add($certMenuItem)

# Folder info
$folderInfo = New-Object System.Windows.Forms.ToolStripMenuItem
$folderInfo.Text = "Folder: $scriptDir"
$folderInfo.Enabled = $false
$menu.Items.Add($folderInfo)

# Separator
$menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))

# Open web interface
$openWeb = New-Object System.Windows.Forms.ToolStripMenuItem
$openWeb.Text = "Open Web Interface"
$openWeb.Add_Click({ Start-Process "https://localhost:8443" })
$menu.Items.Add($openWeb)

# Open folder
$openFolder = New-Object System.Windows.Forms.ToolStripMenuItem
$openFolder.Text = "Open Folder"
$openFolder.Add_Click({ Start-Process $scriptDir })
$menu.Items.Add($openFolder)

# Renew certificate (always available)
$renewCert = New-Object System.Windows.Forms.ToolStripMenuItem
$renewCert.Text = "Renew Certificate"
$renewCert.Add_Click({
    $result = [System.Windows.Forms.MessageBox]::Show(
        "This will generate a new certificate using mkcert.`nMake sure mkcert is installed.`nContinue?",
        "Renew Certificate",
        [System.Windows.Forms.MessageBoxButtons]::YesNo,
        [System.Windows.Forms.MessageBoxIcon]::Question
    )
    if ($result -eq [System.Windows.Forms.DialogResult]::Yes) {
        try {
            Start-Process -FilePath "mkcert" -ArgumentList "localhost", "127.0.0.1", "::1" -WorkingDirectory $scriptDir -Wait
            [System.Windows.Forms.MessageBox]::Show("Certificate renewed successfully! Please restart TSC Agent.", "Success")
        } catch {
            [System.Windows.Forms.MessageBox]::Show("Failed to renew certificate. Make sure mkcert is installed.", "Error")
        }
    }
})
$menu.Items.Add($renewCert)

# Separator
$menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))

# Exit
$exit = New-Object System.Windows.Forms.ToolStripMenuItem  
$exit.Text = "Exit"
$exit.Add_Click({
    if ($serverProcess -and !$serverProcess.HasExited) {
        $serverProcess.Kill()
    }
    Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
    $tray.Visible = $false
    $tray.Dispose()
    [System.Windows.Forms.Application]::Exit()
})
$menu.Items.Add($exit)

$tray.ContextMenuStrip = $menu
$tray.Add_DoubleClick({ Start-Process "https://localhost:8443" })

# Show balloon tip with certificate info
$tray.BalloonTipTitle = "TSC Agent"
if ($certInfo.Status -eq "Warning") {
    $tray.BalloonTipText = "TSC Agent started in $scriptDir`nWarning: Certificate expires in $($certInfo.DaysLeft) days!"
    $tray.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::Warning
} elseif ($certInfo.Status -eq "OK") {
    $tray.BalloonTipText = "TSC Agent started in $scriptDir`nCertificate valid for $($certInfo.DaysLeft) days"
    $tray.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::Info
} else {
    $tray.BalloonTipText = "TSC Agent started in $scriptDir`nCertificate issue: $($certInfo.Message)"
    $tray.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::Error
}
$tray.ShowBalloonTip(5000)

# Keep running
[System.Windows.Forms.Application]::Run()